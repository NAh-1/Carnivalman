import type {
  PaymentMethod,
  SaleLineItem,
  SaleRecord,
  TimeRangeFilter,
} from '../types/stall';

export interface StallMetrics {
  grossRevenue: number;
  refundedAmount: number;
  netRevenue: number;
  ordersCount: number;
  completedOrders: number;
  customersServed: number;
  avgOrderValue: number;
  goalProgressPct: number;
}

export interface HourlyBucket {
  hour: number;
  label: string;
  shortLabel: string;
  orders: number;
  customers: number;
  revenue: number;
  isPeak: boolean;
}

export interface PeakRushWindow {
  startHour: number;
  endHour: number;
  label: string;
  peakHourLabel: string;
  peakCustomers: number;
  peakRevenue: number;
  avgHourlyCustomers: number;
  rushMultiplier: number;
}

export interface RushHeatmapCell {
  dayIndex: number;
  dayLabel: string;
  hour: number;
  hourLabel: string;
  customers: number;
  revenue: number;
  orders: number;
}

export interface RushHeatmapData {
  days: string[];
  hours: number[];
  cells: RushHeatmapCell[];
  maxCustomers: number;
}

export interface ItemPerformance {
  itemId: string;
  name: string;
  unitsSold: number;
  revenue: number;
  orderAppearances: number;
  revenueSharePct: number;
}

export interface PaymentBreakdown {
  method: PaymentMethod;
  label: string;
  orders: number;
  revenue: number;
  sharePct: number;
}

export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatMoney(amount: number, currency = 'QR'): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const formatted = Number.isInteger(safe) ? String(safe) : safe.toFixed(2);
  return `${formatted} ${currency}`;
}

export function formatTimer(seconds: number): string {
  const clamped = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

export function formatHourLabel(hour: number): string {
  const normalized = ((hour % 24) + 24) % 24;
  if (normalized === 0) return '12:00 AM';
  if (normalized === 12) return '12:00 PM';
  return normalized < 12 ? `${normalized}:00 AM` : `${normalized - 12}:00 PM`;
}

export function formatShortHour(hour: number): string {
  const normalized = ((hour % 24) + 24) % 24;
  if (normalized === 0) return '12a';
  if (normalized === 12) return '12p';
  return normalized < 12 ? `${normalized}a` : `${normalized - 12}p`;
}

export function filterSalesByRange(
  sales: SaleRecord[],
  range: TimeRangeFilter,
  nowMs: number = Date.now(),
): SaleRecord[] {
  if (range === 'all') {
    return [...sales];
  }

  const now = new Date(nowMs);
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0,
  ).getTime();

  if (range === 'today') {
    const endOfToday = startOfToday + 24 * 60 * 60 * 1000;
    return sales.filter((s) => s.occurredAt >= startOfToday && s.occurredAt < endOfToday);
  }

  const threeDaysAgo = startOfToday - 2 * 24 * 60 * 60 * 1000;
  return sales.filter((s) => s.occurredAt >= threeDaysAgo);
}

export function computeStallMetrics(sales: SaleRecord[], dailyGoal: number): StallMetrics {
  let grossRevenue = 0;
  let refundedAmount = 0;
  let completedOrders = 0;
  let customersServed = 0;

  for (const sale of sales) {
    if (sale.status === 'completed') {
      grossRevenue += sale.totalAmount;
      completedOrders += 1;
      customersServed += sale.partySize;
    } else if (sale.status === 'refunded') {
      refundedAmount += sale.totalAmount;
    }
  }

  const netRevenue = roundCurrency(grossRevenue);
  const roundedRefunded = roundCurrency(refundedAmount);
  const avgOrderValue =
    completedOrders > 0 ? roundCurrency(netRevenue / completedOrders) : 0;
  const goalProgressPct =
    dailyGoal > 0 ? Math.min(100, Math.round((netRevenue / dailyGoal) * 100)) : 0;

  return {
    grossRevenue: roundCurrency(grossRevenue + refundedAmount),
    refundedAmount: roundedRefunded,
    netRevenue,
    ordersCount: sales.length,
    completedOrders,
    customersServed,
    avgOrderValue,
    goalProgressPct,
  };
}

export function computeHourlyTraffic(sales: SaleRecord[]): {
  buckets: HourlyBucket[];
  peakWindow: PeakRushWindow | null;
} {
  const completed = sales.filter((s) => s.status === 'completed');

  const map = new Map<number, { orders: number; customers: number; revenue: number }>();
  for (let h = 10; h <= 23; h += 1) {
    map.set(h, { orders: 0, customers: 0, revenue: 0 });
  }

  for (const sale of completed) {
    const hour = new Date(sale.occurredAt).getHours();
    const existing = map.get(hour) ?? { orders: 0, customers: 0, revenue: 0 };
    existing.orders += 1;
    existing.customers += sale.partySize;
    existing.revenue = roundCurrency(existing.revenue + sale.totalAmount);
    map.set(hour, existing);
  }

  const sortedHours = Array.from(map.keys()).sort((a, b) => a - b);

  let maxCustomers = 0;
  let peakHour = sortedHours[0] ?? 18;
  let totalCustomers = 0;
  let activeHours = 0;

  for (const hour of sortedHours) {
    const entry = map.get(hour)!;
    totalCustomers += entry.customers;
    if (entry.customers > 0) {
      activeHours += 1;
    }
    if (entry.customers > maxCustomers) {
      maxCustomers = entry.customers;
      peakHour = hour;
    }
  }

  const buckets: HourlyBucket[] = sortedHours.map((hour) => {
    const entry = map.get(hour)!;
    const isPeak = maxCustomers > 0 && entry.customers >= Math.max(1, maxCustomers * 0.78);
    return {
      hour,
      label: formatHourLabel(hour),
      shortLabel: formatShortHour(hour),
      orders: entry.orders,
      customers: entry.customers,
      revenue: entry.revenue,
      isPeak,
    };
  });

  if (maxCustomers === 0) {
    return { buckets, peakWindow: null };
  }

  let bestStart = peakHour;
  let bestWindowCustomers = -1;
  let bestWindowRevenue = 0;

  for (let i = 0; i < sortedHours.length - 1; i += 1) {
    const h1 = sortedHours[i];
    const h2 = sortedHours[i + 1];
    if (h2 !== h1 + 1) continue;
    const b1 = map.get(h1)!;
    const b2 = map.get(h2)!;
    const sumCust = b1.customers + b2.customers;
    const sumRev = roundCurrency(b1.revenue + b2.revenue);
    if (sumCust > bestWindowCustomers) {
      bestWindowCustomers = sumCust;
      bestWindowRevenue = sumRev;
      bestStart = h1;
    }
  }

  const avgHourlyCustomers =
    activeHours > 0 ? roundCurrency(totalCustomers / activeHours) : 0;
  const peakEntry = map.get(peakHour)!;
  const rushMultiplier =
    avgHourlyCustomers > 0
      ? roundCurrency(peakEntry.customers / avgHourlyCustomers)
      : 1;

  return {
    buckets,
    peakWindow: {
      startHour: bestStart,
      endHour: bestStart + 2,
      label: `${formatHourLabel(bestStart)} – ${formatHourLabel(bestStart + 2)}`,
      peakHourLabel: formatHourLabel(peakHour),
      peakCustomers: peakEntry.customers,
      peakRevenue: bestWindowRevenue,
      avgHourlyCustomers,
      rushMultiplier,
    },
  };
}

export function computeRushHeatmap(
  sales: SaleRecord[],
  nowMs: number = Date.now(),
): RushHeatmapData {
  const hours = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
  const dayBuckets: { label: string; key: string }[] = [];

  for (let offset = 0; offset <= 4; offset += 1) {
    const d = new Date(nowMs - offset * 24 * 60 * 60 * 1000);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const label =
      offset === 0
        ? 'Today'
        : offset === 1
          ? 'Yesterday'
          : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    dayBuckets.push({ label, key });
  }

  const grid = new Map<string, { customers: number; revenue: number; orders: number }>();
  for (const sale of sales) {
    if (sale.status !== 'completed') continue;
    const d = new Date(sale.occurredAt);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}:${d.getHours()}`;
    const cell = grid.get(key) ?? { customers: 0, revenue: 0, orders: 0 };
    cell.customers += sale.partySize;
    cell.revenue = roundCurrency(cell.revenue + sale.totalAmount);
    cell.orders += 1;
    grid.set(key, cell);
  }

  let maxCustomers = 0;
  const cells: RushHeatmapCell[] = [];

  dayBuckets.forEach((day, dayIndex) => {
    for (const hour of hours) {
      const entry = grid.get(`${day.key}:${hour}`) ?? {
        customers: 0,
        revenue: 0,
        orders: 0,
      };
      if (entry.customers > maxCustomers) {
        maxCustomers = entry.customers;
      }
      cells.push({
        dayIndex,
        dayLabel: day.label,
        hour,
        hourLabel: formatShortHour(hour),
        customers: entry.customers,
        revenue: entry.revenue,
        orders: entry.orders,
      });
    }
  });

  return {
    days: dayBuckets.map((d) => d.label),
    hours,
    cells,
    maxCustomers,
  };
}

export function computeItemPerformance(sales: SaleRecord[]): ItemPerformance[] {
  const completed = sales.filter((s) => s.status === 'completed');
  const map = new Map<string, ItemPerformance>();
  let totalItemRevenue = 0;

  for (const sale of completed) {
    const seenInOrder = new Set<string>();
    for (const line of sale.items) {
      const lineTotal = roundCurrency(line.qty * line.unitPrice);
      totalItemRevenue += lineTotal;
      const current = map.get(line.itemId) ?? {
        itemId: line.itemId,
        name: line.name,
        unitsSold: 0,
        revenue: 0,
        orderAppearances: 0,
        revenueSharePct: 0,
      };
      current.unitsSold += line.qty;
      current.revenue = roundCurrency(current.revenue + lineTotal);
      if (!seenInOrder.has(line.itemId)) {
        current.orderAppearances += 1;
        seenInOrder.add(line.itemId);
      }
      map.set(line.itemId, current);
    }
  }

  return Array.from(map.values())
    .map((item) => ({
      ...item,
      revenueSharePct:
        totalItemRevenue > 0 ? Math.round((item.revenue / totalItemRevenue) * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function computePaymentBreakdown(sales: SaleRecord[]): PaymentBreakdown[] {
  const completed = sales.filter((s) => s.status === 'completed');
  const labels: Record<PaymentMethod, string> = {
    card: 'Card',
    cash: 'Cash',
    mobile: 'QR / Mobile',
  };
  const totals: Record<PaymentMethod, { orders: number; revenue: number }> = {
    card: { orders: 0, revenue: 0 },
    cash: { orders: 0, revenue: 0 },
    mobile: { orders: 0, revenue: 0 },
  };

  let grandTotal = 0;
  for (const sale of completed) {
    totals[sale.paymentMethod].orders += 1;
    totals[sale.paymentMethod].revenue = roundCurrency(
      totals[sale.paymentMethod].revenue + sale.totalAmount,
    );
    grandTotal += sale.totalAmount;
  }

  return (['mobile', 'cash', 'card'] as PaymentMethod[]).map((method) => ({
    method,
    label: labels[method],
    orders: totals[method].orders,
    revenue: totals[method].revenue,
    sharePct:
      grandTotal > 0 ? Math.round((totals[method].revenue / grandTotal) * 100) : 0,
  }));
}

function escapeCsvCell(value: string | number): string {
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function formatSalesCsv(stallName: string, sales: SaleRecord[]): string {
  const headers = [
    'Stall',
    'Order ID',
    'Timestamp',
    'Player',
    'Players',
    'Station',
    'Payment',
    'Status',
    'Total',
  ];

  const rows = sales.map((sale) => {
    const itemsSummary = sale.items.map((item) => `${item.qty}x ${item.name}`).join('; ');
    return [
      stallName,
      sale.id,
      new Date(sale.occurredAt).toISOString(),
      sale.customerLabel || 'Walk-up',
      sale.partySize,
      itemsSummary,
      sale.paymentMethod,
      sale.status,
      sale.totalAmount.toFixed(2),
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  return [headers.map(escapeCsvCell).join(','), ...rows].join('\n');
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateSaleInput(input: {
  customerLabel: string;
  partySize: number;
  items: SaleLineItem[];
}): ValidationResult {
  if (input.customerLabel.trim().length > 60) {
    return { valid: false, error: 'Name must be 60 characters or less.' };
  }
  if (!Number.isInteger(input.partySize) || input.partySize < 1 || input.partySize > 20) {
    return { valid: false, error: 'Players must be between 1 and 20.' };
  }
  if (input.items.length < 1 || input.items.length > 20) {
    return { valid: false, error: 'Select at least 1 game.' };
  }
  return { valid: true };
}
