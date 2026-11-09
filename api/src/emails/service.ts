import { ModuleError, ProviderError } from './errors.js';
import { EmailRepository } from './repository.js';
import { importSchema, moneyUnits, normalizeAccount, parseImportCsv } from './validation.js';
import type { AccountInput, MailProvider, PurchaseInput } from './types.js';
import type { z } from 'zod';

export class EmailService {
  constructor(private readonly repository: EmailRepository, private readonly provider: MailProvider) {}

  private async imported(input: z.infer<typeof importSchema>) {
    if (input.source === 'csv') return parseImportCsv(input.csv, input.purchaseDate ?? null);
    const result = await this.provider.purchased(input.paymentId);
    let accounts: AccountInput[];
    try {
      accounts = result.accounts.map((account) => normalizeAccount({ ...account, purchaseDate: input.purchaseDate ?? null, status: 'D' }));
    } catch {
      throw new ProviderError('INVALID_PROVIDER_RESPONSE', 'A compra contém dados de contas inválidos.');
    }
    return { accounts, errors: [], total: accounts.length };
  }

  async preview(input: z.infer<typeof importSchema>) {
    const imported = await this.imported(input);
    const seen = await this.repository.existing(imported.accounts.map((account) => account.email));
    let duplicates = 0;
    for (const account of imported.accounts) {
      if (seen.has(account.email)) duplicates++;
      seen.add(account.email);
    }
    return {
      total: imported.total, valid: imported.accounts.length, duplicates, errors: imported.errors,
      sample: imported.accounts.slice(0, 20).map(({ email, purchaseDate, status }) => ({ email, purchaseDate, status })),
    };
  }

  async import(input: z.infer<typeof importSchema>) {
    const imported = await this.imported(input);
    if (imported.errors.length) throw new ModuleError(400, 'IMPORT_VALIDATION', 'Corrija as linhas indicadas na prévia antes de importar.');
    const options = input.source === 'purchase' ? { paymentId: input.paymentId, operationId: input.operationId } : {};
    return this.repository.import(imported.accounts, options);
  }

  async purchase(input: PurchaseInput) {
    const claim = await this.repository.claim(input);
    if (!claim.claimed) return this.repository.operation(claim.id);
    let submitted = false;
    let paymentId: string | null = null;
    let totalPrice: string | null = null;
    try {
      const [balance, availability] = await Promise.all([this.provider.balance(), this.provider.availability()]);
      const selected = availability.items.filter((item) => (!input.domain || item.domain === input.domain)
        && (!input.age || item.age === input.age) && item.available > 0)
        .sort((left, right) => moneyUnits(left.price) < moneyUnits(right.price) ? -1 : 1);
      let remaining = input.count;
      let expected = 0n;
      for (const item of selected) {
        const count = Math.min(remaining, item.available);
        expected += BigInt(count) * moneyUnits(item.price);
        remaining -= count;
        if (!remaining) break;
      }
      if (remaining) throw new ModuleError(409, 'INSUFFICIENT_STOCK', 'Estoque insuficiente para a quantidade selecionada.');
      if (expected > moneyUnits(input.maxTotal)) throw new ModuleError(409, 'PRICE_CHANGED', 'O preço mudou. Atualize o estoque e confirme novamente.');
      if (expected > moneyUnits(balance.balance)) throw new ModuleError(409, 'INSUFFICIENT_BALANCE', 'Saldo insuficiente na API Mail.');
      submitted = true;
      const result = await this.provider.purchase(input);
      paymentId = result.paymentId;
      totalPrice = result.totalPrice;
      if (result.accounts.length !== input.count) throw new ProviderError('PURCHASE_COUNT_MISMATCH', 'A quantidade recebida difere da solicitada. Concilie a compra pelo fornecedor.');
      const purchaseDate = new Date().toISOString().slice(0, 10);
      const accounts = result.accounts.map((account) => normalizeAccount({ ...account, purchaseDate, status: 'D' }));
      if (new Set(accounts.map((account) => account.email)).size !== accounts.length) throw new ProviderError('DUPLICATE_PROVIDER_ACCOUNTS', 'O fornecedor retornou contas duplicadas. Concilie a compra.');
      await this.repository.import(accounts, { operationId: claim.id, paymentId: paymentId ?? undefined, totalPrice });
    } catch (error) {
      const uncertain = submitted && !(error instanceof ProviderError && error.definitive);
      const message = uncertain
        ? 'Resultado incerto. Confira o histórico da API Mail e importe pelo payment_id para conciliar. Não repita esta compra.'
        : error instanceof ModuleError ? error.message : 'Não foi possível preparar a compra. Tente novamente com uma nova operação.';
      // If persistence is unavailable too, the durable pending ledger prevents another charge.
      try { await this.repository.updateOperation(claim.id, uncertain ? 'uncertain' : 'failed', message, paymentId, totalPrice); }
      catch { throw new ModuleError(503, 'PURCHASE_PENDING', 'A operação foi registrada, mas seu resultado ainda não foi confirmado. Consulte as compras antes de continuar.'); }
    }
    return this.repository.operation(claim.id);
  }
}
