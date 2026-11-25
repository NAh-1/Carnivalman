export type StallId = 'rushbox' | 'gamingzone';
export type PaymentMethod = 'cash' | 'card' | 'mobile';
export type SaleStatus = 'completed' | 'refunded';
export type TimeRangeFilter = 'today' | 'weekend' | 'all';
export type DashboardView = 'queue' | 'analytics' | 'ledger' | 'settings';

export interface GameStationConfig {
  id: string;
  name: string;
  gear: string;
  turn: number;
  team: boolean;
  unit: string;
  price: number;
}

export interface QueueEntry {
  id: string;
  name: string;
  party: number;
  paid: boolean;
  saleId?: string;
  startedAt?: number;
}

export interface StationQueueState {
  now: QueueEntry | null;
  wait: QueueEntry[];
  turn: number;
}

export interface SaleLineItem {
  itemId: string;
  name: string;
  qty: number;
  unitPrice: number;
}

export interface SaleRecord {
  id: string;
  stallId: StallId;
  customerLabel: string;
  partySize: number;
  items: SaleLineItem[];
  totalAmount: number;
  paymentMethod: PaymentMethod;
  status: SaleStatus;
  occurredAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface StallState {
  stallId: StallId;
  displayName: string;
  currency: string;
  dailyGoal: number;
  games: GameStationConfig[];
  queues: Record<string, StationQueueState>;
  sales: SaleRecord[];
  updatedAt: number;
}
