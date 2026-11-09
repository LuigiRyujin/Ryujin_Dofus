import {
  AccountService,
  CharacterService,
  ConnectionService,
  EmailService,
  OperationService,
} from './types';
import {
  AnkamaAccount,
  Character,
  CharacterStatus,
  ConnectionSnapshot,
  EmailRecord,
  EmailStatus,
  Operation,
  Page,
} from '../types/domain';

// Simula delay de rede realista (150 - 350 ms)
export const delay = (ms?: number) =>
  new Promise((resolve) => setTimeout(resolve, ms ?? Math.floor(Math.random() * 200 + 150)));

export function createMockEmailService(
  getEmails: () => EmailRecord[],
  onAdd: (email: { address: string; origin: string; password?: string }) => void,
  onSetStatus: (id: string, status: EmailStatus) => void,
  onPurchase: (quantity: number, cost: number) => void
): EmailService {
  return {
    async list({ q, status, page, pageSize }): Promise<Page<EmailRecord>> {
      await delay();
      let filtered = [...getEmails()];
      if (q) {
        const query = q.toLowerCase();
        filtered = filtered.filter(
          (e) => e.address.toLowerCase().includes(query) || e.origin.toLowerCase().includes(query)
        );
      }
      if (status && status !== 'all') {
        filtered = filtered.filter((e) => e.status === status);
      }
      const total = filtered.length;
      const start = (page - 1) * pageSize;
      const items = filtered.slice(start, start + pageSize);
      return { items, total, page, pageSize };
    },

    async create(input) {
      await delay();
      onAdd(input);
      return {
        id: `email-${Date.now()}`,
        address: input.address,
        origin: input.origin,
        purchasedAt: new Date().toISOString(),
        status: 'D',
        password: input.password,
      };
    },

    async setStatus(id, status) {
      await delay();
      onSetStatus(id, status);
      const email = getEmails().find((e) => e.id === id);
      return email ? { ...email, status } : ({} as EmailRecord);
    },

    async purchase(quantity) {
      await delay(400);
      const unitPrice = 1.25; // Preço unitário R$ 1,25
      const total = quantity * unitPrice;
      onPurchase(quantity, total);
      return { added: [], newBalance: 0 };
    },
  };
}

export function createMockAccountService(
  getAccounts: () => AnkamaAccount[],
  onAdd: (acc: { login: string; emailId: string; password?: string }) => void,
  onBan: (id: string) => void,
  onUnban: (id: string) => void
): AccountService {
  return {
    async list({ q, status, page, pageSize }): Promise<Page<AnkamaAccount>> {
      await delay();
      let filtered = [...getAccounts()];
      if (q) {
        const query = q.toLowerCase();
        filtered = filtered.filter((a) => a.login.toLowerCase().includes(query));
      }
      if (status && status !== 'all') {
        filtered = filtered.filter((a) => a.status === status);
      }
      const total = filtered.length;
      const start = (page - 1) * pageSize;
      const items = filtered.slice(start, start + pageSize);
      return { items, total, page, pageSize };
    },

    async create(input) {
      await delay();
      onAdd(input);
      return {
        id: `acc-${Date.now()}`,
        login: input.login,
        emailId: input.emailId,
        status: 'C',
        createdAt: new Date().toISOString(),
        password: input.password,
      };
    },

    async setBan(id, banned) {
      await delay();
      if (banned) {
        onBan(id);
      } else {
        onUnban(id);
      }
      const acc = getAccounts().find((a) => a.id === id);
      return acc ? { ...acc, status: banned ? 'B' : 'C' } : ({} as AnkamaAccount);
    },
  };
}

export function createMockCharacterService(
  getCharacters: () => Character[],
  onAdd: (char: { name: string; accountId: string; race: string; server: string }) => void,
  onSetStatus: (id: string, status: CharacterStatus) => void
): CharacterService {
  return {
    async list({ q, accountId, race, server, status, page, pageSize }): Promise<Page<Character>> {
      await delay();
      let filtered = [...getCharacters()];
      if (q) {
        const query = q.toLowerCase();
        filtered = filtered.filter((c) => c.name.toLowerCase().includes(query));
      }
      if (accountId) {
        filtered = filtered.filter((c) => c.accountId === accountId);
      }
      if (race) {
        filtered = filtered.filter((c) => c.race === race);
      }
      if (server) {
        filtered = filtered.filter((c) => c.server === server);
      }
      if (status && status !== 'all') {
        filtered = filtered.filter((c) => c.status === status);
      }
      const total = filtered.length;
      const start = (page - 1) * pageSize;
      const items = filtered.slice(start, start + pageSize);
      return { items, total, page, pageSize };
    },

    async create(input) {
      await delay();
      onAdd(input);
      return {
        id: `char-${Date.now()}`,
        name: input.name,
        accountId: input.accountId,
        race: input.race,
        server: input.server,
        status: 'C',
      };
    },

    async setStatus(id, status) {
      await delay();
      onSetStatus(id, status);
      const char = getCharacters().find((c) => c.id === id);
      return char ? { ...char, status } : ({} as Character);
    },
  };
}

export function createMockOperationService(
  getOperations: () => Operation[],
  onUpdate: (op: Operation) => void,
  onReconcile: (id: string, targetState: 'done' | 'failed') => void
): OperationService {
  return {
    async list() {
      await delay();
      return [...getOperations()];
    },

    async submitCode(id, code) {
      await delay(500);
      const op = getOperations().find((o) => o.id === id);
      if (!op) throw new Error('Operação não encontrada');
      const updated: Operation = {
        ...op,
        state: 'done',
        step: `Código ${code} aceito. Operação concluída.`,
        updatedAt: new Date().toISOString(),
        needsCode: false,
      };
      onUpdate(updated);
      return updated;
    },

    async retry(id) {
      await delay(500);
      const op = getOperations().find((o) => o.id === id);
      if (!op) throw new Error('Operação não encontrada');
      const updated: Operation = {
        ...op,
        state: 'running',
        step: 'Retomando execução a partir da última etapa',
        updatedAt: new Date().toISOString(),
      };
      onUpdate(updated);
      return updated;
    },

    async reconcile(id) {
      await delay(800);
      onReconcile(id, 'done');
      const op = getOperations().find((o) => o.id === id);
      return op ? { ...op, state: 'done' } : ({} as Operation);
    },
  };
}

export function createMockConnectionService(getConnection: () => ConnectionSnapshot): ConnectionService {
  return {
    async check() {
      // Simula ~800ms de checagem conforme especificação
      await delay(800);
      return {
        ...getConnection(),
        checkedAt: new Date().toISOString(),
      };
    },
  };
}

