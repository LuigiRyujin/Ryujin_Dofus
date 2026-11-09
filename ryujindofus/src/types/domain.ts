export type EmailStatus = "D" | "U" | "B"; // Disponível, Utilizado, Bloqueado
export type AccountStatus = "C" | "B"; // Criada, Banida
export type CharacterStatus = "C" | "E" | "F" | "B"; // Criado, Em Progresso, Finalizado, Banido
export type OperationState = "waiting" | "running" | "done" | "failed" | "uncertain";
export type OperationType = "create_account" | "create_character" | "import_emails" | "purchase_emails";

export interface EmailRecord {
  id: string;
  address: string;
  origin: string;
  purchasedAt: string; // ISO 8601
  status: EmailStatus;
  password?: string; // fictícia; nunca exibir sem "Revelar"
}

export interface AnkamaAccount {
  id: string;
  login: string;
  emailId: string; // FK -> EmailRecord.id (email com status "U")
  status: AccountStatus;
  createdAt: string;
  password?: string;
}

export interface Character {
  id: string;
  name: string;
  accountId: string; // FK -> AnkamaAccount.id
  race: string;
  server: string;
  status: CharacterStatus;
  // O email é derivado de account.emailId, nunca armazenado aqui.
}

export interface Operation {
  id: string;
  type: OperationType;
  subject: string; // login ou email
  state: OperationState;
  step: string;
  updatedAt: string;
  needsCode?: boolean;
  recoverable?: boolean;
}

export interface ConnectionSnapshot {
  api: { ok: boolean; latencyMs: number };
  database: { ok: boolean };
  automation: { state: "idle" | "running" | "offline" };
  checkedAt: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

