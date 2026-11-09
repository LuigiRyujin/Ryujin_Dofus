import {
  AccountStatus,
  AnkamaAccount,
  Character,
  CharacterStatus,
  ConnectionSnapshot,
  EmailRecord,
  EmailStatus,
  Operation,
  Page,
} from '../types/domain';

export interface EmailService {
  list(params: {
    q?: string;
    status?: EmailStatus | 'all';
    page: number;
    pageSize: number;
  }): Promise<Page<EmailRecord>>;
  create(input: { address: string; origin: string; password?: string }): Promise<EmailRecord>;
  setStatus(id: string, status: EmailStatus): Promise<EmailRecord>;
  purchase(quantity: number): Promise<{ added: EmailRecord[]; newBalance: number }>;
}

export interface AccountService {
  list(params: {
    q?: string;
    status?: AccountStatus | 'all';
    page: number;
    pageSize: number;
  }): Promise<Page<AnkamaAccount>>;
  create(input: { login: string; emailId: string; password?: string }): Promise<AnkamaAccount>;
  setBan(id: string, banned: boolean): Promise<AnkamaAccount>;
}

export interface CharacterService {
  list(params: {
    q?: string;
    accountId?: string;
    race?: string;
    server?: string;
    status?: CharacterStatus | 'all';
    page: number;
    pageSize: number;
  }): Promise<Page<Character>>;
  create(input: { name: string; accountId: string; race: string; server: string }): Promise<Character>;
  setStatus(id: string, status: CharacterStatus): Promise<Character>;
}

export interface OperationService {
  list(): Promise<Operation[]>;
  submitCode(id: string, code: string): Promise<Operation>;
  retry(id: string): Promise<Operation>;
  reconcile(id: string): Promise<Operation>;
}

export interface ConnectionService {
  check(): Promise<ConnectionSnapshot>;
}

