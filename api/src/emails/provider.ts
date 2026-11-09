import { z } from 'zod';
import { ModuleError, ProviderError } from './errors.js';
import { moneyUnits } from './validation.js';
import type { AvailabilityItem, MailProvider, ProviderAccounts, PurchaseInput } from './types.js';

const ages = ['fresh', 'medium', 'aged', 'old'] as const;
const accountResponse = z.object({ email: z.string(), password: z.string().min(1).max(16384) });
const accountListResponse = z.object({
  accounts: z.array(accountResponse).min(1).max(500),
  payment_id: z.union([z.string(), z.number().int()]).optional(),
  total_price: z.union([z.string(), z.number()]).optional(),
});
const definitiveFailures: Record<string, string> = {
  BAD_TOKEN: 'O token da API Mail é inválido.',
  BAD_BALANCE: 'Saldo insuficiente na API Mail.',
  NO_ACCOUNTS: 'Não há contas disponíveis para essa seleção.',
  NO_EMAILS: 'Não há contas disponíveis para essa seleção.',
  BAD_COUNT: 'A quantidade foi recusada pelo fornecedor.',
  INVALID_COUNT: 'A quantidade foi recusada pelo fornecedor.',
  BAD_DOMAIN: 'O domínio foi recusado pelo fornecedor.',
};

export class ApiMailClient implements MailProvider {
  constructor(private readonly token?: string, private readonly fetcher: typeof fetch = fetch) {}

  private async request(path: string, parameters: Record<string, string> = {}) {
    if (!this.token) throw new ModuleError(503, 'APIMAIL_NOT_CONFIGURED', 'Configure o token da API Mail no servidor para usar esta operação.');
    const url = new URL(`https://api.apimail.me/${path}`);
    url.searchParams.set('token', this.token);
    url.searchParams.set('type', 'json');
    for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
    let raw: unknown;
    try {
      const response = await this.fetcher(url, { signal: AbortSignal.timeout(30000), redirect: 'error', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Provider HTTP failure');
      raw = await response.json();
    } catch {
      throw new ProviderError('APIMAIL_UNAVAILABLE', 'Não foi possível confirmar a resposta da API Mail.');
    }
    if (!raw || typeof raw !== 'object') throw new ProviderError('INVALID_PROVIDER_RESPONSE', 'A API Mail retornou uma resposta inválida.');
    const body = raw as Record<string, unknown>;
    if (body.status !== 'OK') {
      const code = typeof body.value === 'string' ? body.value : '';
      const message = definitiveFailures[code];
      if (message) throw new ProviderError(`APIMAIL_${code}`, message, true);
      throw new ProviderError('APIMAIL_REJECTED', 'A operação não foi confirmada pela API Mail. Confira o histórico no fornecedor.');
    }
    return body;
  }

  async balance() {
    const body = await this.request('userBalance');
    if (typeof body.balance !== 'string' && typeof body.balance !== 'number') throw new ProviderError('INVALID_PROVIDER_RESPONSE', 'Saldo inválido retornado pela API Mail.');
    moneyUnits(body.balance);
    return { balance: String(body.balance), currency: 'USD' as const };
  }

  async availability() {
    const body = await this.request('domainAvailability');
    if (!Array.isArray(body.domains)) throw new ProviderError('INVALID_PROVIDER_RESPONSE', 'Estoque inválido retornado pela API Mail.');
    const items: AvailabilityItem[] = [];
    for (const entry of body.domains) {
      if (!entry || typeof entry !== 'object' || typeof entry.domain !== 'string') throw new ProviderError('INVALID_PROVIDER_RESPONSE', 'Estoque inválido retornado pela API Mail.');
      for (const age of ages) {
        const available = entry.age === age ? entry.available : entry[`${age}_count`];
        const price = entry.age === age ? entry.price : entry[`${age}_price`];
        if (available === undefined) continue;
        if (!Number.isInteger(available) || available < 0 || (typeof price !== 'string' && typeof price !== 'number')) {
          throw new ProviderError('INVALID_PROVIDER_RESPONSE', 'Estoque inválido retornado pela API Mail.');
        }
        moneyUnits(price);
        items.push({ domain: entry.domain, age, available, price: String(price) });
      }
    }
    return { items, currency: 'USD' as const };
  }

  private accounts(body: Record<string, unknown>): ProviderAccounts {
    const parsed = accountListResponse.safeParse(body);
    if (!parsed.success) throw new ProviderError('INVALID_PROVIDER_RESPONSE', 'A API Mail retornou dados de contas inválidos.');
    const totalPrice = parsed.data.total_price === undefined ? null : String(parsed.data.total_price);
    if (totalPrice !== null) moneyUnits(totalPrice);
    return { accounts: parsed.data.accounts, paymentId: parsed.data.payment_id === undefined ? null : String(parsed.data.payment_id), totalPrice };
  }

  async purchased(paymentId: string) {
    const result = this.accounts(await this.request('purchasedEmails', { payment_id: paymentId }));
    if (result.paymentId && result.paymentId !== paymentId) throw new ProviderError('PAYMENT_MISMATCH', 'O fornecedor retornou outra compra.');
    return { ...result, paymentId };
  }

  async purchase(input: PurchaseInput) {
    const parameters: Record<string, string> = { count: String(input.count) };
    if (input.domain) parameters.domain = input.domain;
    if (input.age) parameters.age = input.age;
    // Although documented as GET, this endpoint charges money. Never retry it.
    return this.accounts(await this.request('getEmail', parameters));
  }
}
