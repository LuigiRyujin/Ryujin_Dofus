export type EmailStatus = 'D' | 'U' | 'B';
export interface AccountInput {
  email: string;
  password: string;
  purchaseDate: string | null;
  status: EmailStatus;
}
export interface Account {
  id: string;
  email: string;
  purchaseDate: string | null;
  origin: 'apimail';
  status: EmailStatus;
  createdAt: string;
  updatedAt: string;
}
export interface AccountFilters {
  search?: string;
  status?: EmailStatus;
  domain?: string;
  from?: string;
  to?: string;
  unknownDate?: 'true' | 'false';
  page: number;
  pageSize: number;
}
export interface PurchaseInput {
  idempotencyKey: string;
  count: number;
  domain?: string;
  age?: 'fresh' | 'medium' | 'aged' | 'old';
  maxTotal: string;
}
export interface PurchaseOperation {
  id: string;
  idempotencyKey: string;
  state: 'pending' | 'completed' | 'uncertain' | 'failed';
  paymentId: string | null;
  count: number;
  inserted: number;
  totalPrice: string | null;
  message?: string;
}
export interface AvailabilityItem {
  domain: string;
  age: string;
  available: number;
  price: string;
}
export interface ProviderAccounts {
  accounts: { email: string; password: string }[];
  paymentId: string | null;
  totalPrice: string | null;
}
export interface MailProvider {
  balance(): Promise<{ balance: string; currency: 'USD' }>;
  availability(): Promise<{ items: AvailabilityItem[]; currency: 'USD' }>;
  purchased(paymentId: string): Promise<ProviderAccounts>;
  purchase(input: PurchaseInput): Promise<ProviderAccounts>;
}
