export type EmailStatus = 'D' | 'U' | 'B';
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };
export interface EmailAccount {
  id: string; email: string; purchaseDate: string | null; origin: 'apimail';
  status: EmailStatus; createdAt: string; updatedAt: string;
}
export interface EmailInput { email: string; password: string; purchaseDate?: string | null; status?: EmailStatus }
export interface EmailFilters {
  search?: string; status?: EmailStatus; domain?: string; from?: string; to?: string;
  unknownDate?: boolean; page?: number; pageSize?: number;
}
export interface EmailPage { items: EmailAccount[]; total: number; page: number; pageSize: number }
export interface EmailCredentials { password: string; refreshToken: string | null; clientId: string | null; original: string }
export type ImportInput = { source: 'csv'; csv: string; purchaseDate?: string | null }
  | { source: 'purchase'; paymentId: string; purchaseDate?: string | null; operationId?: string };
export interface ImportPreview {
  total: number; valid: number; duplicates: number; errors: { line: number; message: string }[];
  sample: { email: string; purchaseDate: string | null; status: EmailStatus }[];
}
export interface ImportResult { inserted: number; duplicates: number; total: number }
export interface EmailSummary {
  total: number; byStatus: { status: EmailStatus; count: number }[];
  byDomain: { domain: string; count: number }[]; byDay: { date: string; count: number }[]; unknownDate: number;
}
export interface Balance { balance: string; currency: 'USD' }
export interface Availability { items: { domain: string; age: string; available: number; price: string }[]; currency: 'USD' }
export interface PurchaseInput { idempotencyKey: string; count: number; domain?: string; age?: string; maxTotal: string }
export interface PurchaseOperation {
  id: string; idempotencyKey: string; state: 'pending' | 'completed' | 'uncertain' | 'failed';
  paymentId: string | null; count: number; inserted: number; totalPrice: string | null; message?: string;
}
export type ConnectionStatus = 'ok' | 'unavailable' | 'network_error' | 'timeout' | 'invalid_response' | 'http_error';
export interface EndpointResult { status: ConnectionStatus; elapsedMs: number }
export interface ConnectionResult { api: EndpointResult; database: EndpointResult; checkedAt: string }

export type AnkamaStatus = 'C' | 'B';
export type CharacterStatus = 'C' | 'E' | 'F' | 'B';
export interface AnkamaAccount { id: string; login: string; emailId: string; email: string; status: AnkamaStatus; createdAt: string; updatedAt: string }
export interface Character { id: string; ankamaId: string; emailId: string; email?: string; login?: string; name: string; breedId: number; serverId: number; status: CharacterStatus; createdAt: string; updatedAt: string }
export interface EntityFilters { search?: string; status?: string; ankamaId?: string; emailId?: string; breedId?: number; serverId?: number; page?: number; pageSize?: number }
export interface EntityPage<T> { items: T[]; total: number; page: number; pageSize: number }
export interface CharacterOptions { breeds: { id: number; name: string }[]; servers: { id: number; name: string }[] }
export interface CreationOperation { id: string; type: string; state: 'queued' | 'running' | 'completed' | 'failed' | 'uncertain'; stage?: string; message?: string; error?: string; createdAt: string }

export interface LegacyRyujinBridge {
  readonly appVersion: string;
  checkConnection(): Promise<ConnectionResult>;
  hasCredential(): Promise<boolean>;
  setCredential(token: string): Promise<ApiResult<null>>;
  listEmails(filters: EmailFilters): Promise<ApiResult<EmailPage>>;
  createEmail(input: EmailInput): Promise<ApiResult<EmailAccount>>;
  getEmail(id: string): Promise<ApiResult<EmailAccount>>;
  changeEmailStatus(id: string, status: EmailStatus): Promise<ApiResult<EmailAccount>>;
  revealEmail(id: string): Promise<ApiResult<EmailCredentials>>;
  previewImport(input: ImportInput): Promise<ApiResult<ImportPreview>>;
  importEmails(input: ImportInput): Promise<ApiResult<ImportResult>>;
  getSummary(filters: EmailFilters): Promise<ApiResult<EmailSummary>>;
  exportEmails(filters: EmailFilters): Promise<ApiResult<{ saved: boolean }>>;
  getBalance(): Promise<ApiResult<Balance>>;
  getAvailability(): Promise<ApiResult<Availability>>;
  purchaseEmails(input: PurchaseInput): Promise<ApiResult<PurchaseOperation>>;
  listPurchases(): Promise<ApiResult<{ items: PurchaseOperation[] }>>;
  getPurchase(id: string): Promise<ApiResult<PurchaseOperation>>;
  copyText(text: string): Promise<ApiResult<null>>;
  listAnkamaAccounts(filters: EntityFilters): Promise<ApiResult<EntityPage<AnkamaAccount>>>;
  getAnkamaAccount(id: string): Promise<ApiResult<AnkamaAccount>>;
  createAnkamaAccount(input: { login: string; password: string; emailId: string }): Promise<ApiResult<AnkamaAccount>>;
  changeAnkamaStatus(id: string, status: AnkamaStatus): Promise<ApiResult<AnkamaAccount>>;
  revealAnkama(id: string): Promise<ApiResult<{ password: string }>>;
  listCharacters(filters: EntityFilters): Promise<ApiResult<EntityPage<Character>>>;
  getCharacter(id: string): Promise<ApiResult<Character>>;
  createCharacter(input: { ankamaId: string; name: string; breedId: number; serverId: number }): Promise<ApiResult<Character>>;
  changeCharacterStatus(id: string, status: CharacterStatus): Promise<ApiResult<Character>>;
  characterOptions(): Promise<ApiResult<CharacterOptions>>;
  createAnkamaOperation(input: { emailId: string; idempotencyKey: string }): Promise<ApiResult<CreationOperation>>;
  createCharacterOperation(input: { ankamaId: string; breedId: number; serverId: number; idempotencyKey: string }): Promise<ApiResult<CreationOperation>>;
  listCreationOperations(): Promise<ApiResult<EntityPage<CreationOperation>>>;
  retryCreationOperation(id: string): Promise<ApiResult<CreationOperation>>;
  submitCreationCode(id: string, code: string): Promise<ApiResult<CreationOperation>>;
  automationStatus(): Promise<ApiResult<{ running: boolean; enabled: boolean; error: string }>>;
  reconcileCreationOperation(id: string): Promise<ApiResult<CreationOperation>>;
}

declare global {
  const __APP_VERSION__: string;
}
