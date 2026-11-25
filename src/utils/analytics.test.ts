import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeHourlyTraffic,
  computeItemPerformance,
  computePaymentBreakdown,
  computeRushHeatmap,
  computeStallMetrics,
  filterSalesByRange,
  formatMoney,
  formatSalesCsv,
  formatTimer,
  validateSaleInput,
} from './analytics';
import type { SaleRecord } from '../types/stall';

function makeSale(overrides: Partial<SaleRecord> & { hour?: number; dayOffset?: number }): SaleRecord {
  const base = new Date(2026, 10, 25, overrides.hour ?? 18, 15, 0, 0);
  if (overrides.dayOffset) {
    base.setDate(base.getDate() - overrides.dayOffset);
  }
  const ts = overrides.occurredAt ?? base.getTime();
  return {
    id: overrides.id ?? 'sale-1',
    stallId: overrides.stallId ?? 'gamingzone',
    customerLabel: overrides.customerLabel ?? 'Player 1',
    partySize: overrides.partySize ?? 2,
    items: overrides.items ?? [{ itemId: 'fc26', name: 'FC 26', qty: 2, unitPrice: 5 }],
    totalAmount: overrides.totalAmount ?? 10,
    paymentMethod: overrides.paymentMethod ?? 'mobile',
    status: overrides.status ?? 'completed',
    occurredAt: ts,
    createdAt: ts,
    updatedAt: ts,
  };
}

test('formatTimer and formatMoney format queue displays accurately', () => {
  assert.equal(formatTimer(300), '05:00');
  assert.equal(formatTimer(65.2), '01:06');
  assert.equal(formatTimer(-3), '00:00');
  assert.equal(formatMoney(15, 'QR'), '15 QR');
  assert.equal(formatMoney(12.5, 'QR'), '12.50 QR');
});

test('computeStallMetrics calculates net revenue, refunds, players, and avg ticket', () => {
  const sales: SaleRecord[] = [
    makeSale({ id: 's1', totalAmount: 20, partySize: 4, status: 'completed' }),
    makeSale({ id: 's2', totalAmount: 5, partySize: 1, status: 'completed' }),
    makeSale({ id: 's3', totalAmount: 10, partySize: 2, status: 'refunded' }),
  ];

  const metrics = computeStallMetrics(sales, 100);
  assert.equal(metrics.netRevenue, 25);
  assert.equal(metrics.refundedAmount, 10);
  assert.equal(metrics.completedOrders, 2);
  assert.equal(metrics.customersServed, 5);
  assert.equal(metrics.avgOrderValue, 12.5);
});

test('computeHourlyTraffic identifies peak rush window', () => {
  const sales: SaleRecord[] = [
    makeSale({ id: 's1', hour: 14, partySize: 2, totalAmount: 10 }),
    makeSale({ id: 's2', hour: 19, partySize: 6, totalAmount: 30 }),
    makeSale({ id: 's3', hour: 19, partySize: 4, totalAmount: 20 }),
    makeSale({ id: 's4', hour: 20, partySize: 8, totalAmount: 40 }),
  ];

  const { peakWindow } = computeHourlyTraffic(sales);
  assert.ok(peakWindow !== null);
  assert.equal(peakWindow.peakHourLabel, '7:00 PM');
  assert.equal(peakWindow.startHour, 19);
  assert.equal(peakWindow.endHour, 21);
  assert.equal(peakWindow.peakRevenue, 90);
});

test('filterSalesByRange filters today vs weekend vs all', () => {
  const now = new Date(2026, 10, 25, 16, 0, 0, 0).getTime();
  const sales: SaleRecord[] = [
    makeSale({ id: 'today', dayOffset: 0, hour: 14 }),
    makeSale({ id: 'yesterday', dayOffset: 1, hour: 18 }),
    makeSale({ id: 'old', dayOffset: 5, hour: 18 }),
  ];

  assert.equal(filterSalesByRange(sales, 'today', now).length, 1);
  assert.equal(filterSalesByRange(sales, 'weekend', now).length, 2);
  assert.equal(filterSalesByRange(sales, 'all', now).length, 3);
});

test('computeItemPerformance, computePaymentBreakdown, and computeRushHeatmap work accurately', () => {
  const now = new Date(2026, 10, 25, 19, 0, 0, 0).getTime();
  const sales: SaleRecord[] = [
    makeSale({
      id: 's1',
      paymentMethod: 'mobile',
      totalAmount: 20,
      dayOffset: 0,
      hour: 19,
      items: [{ itemId: 'fc26', name: 'FC 26', qty: 4, unitPrice: 5 }],
    }),
    makeSale({
      id: 's2',
      paymentMethod: 'cash',
      totalAmount: 5,
      dayOffset: 0,
      hour: 18,
      items: [{ itemId: 'nohesi', name: 'No Hesi', qty: 1, unitPrice: 5 }],
    }),
  ];

  const items = computeItemPerformance(sales);
  assert.equal(items[0].itemId, 'fc26');
  assert.equal(items[0].revenueSharePct, 80);

  const payments = computePaymentBreakdown(sales);
  assert.equal(payments.find((p) => p.method === 'mobile')?.sharePct, 80);

  const matrix = computeRushHeatmap(sales, now);
  assert.equal(matrix.days[0], 'Today');
  assert.equal(matrix.cells.length, 60);
});

test('formatSalesCsv and validateSaleInput enforce bounds and escaping', () => {
  const csv = formatSalesCsv('GamingZone', [
    makeSale({ id: 'ord-1', customerLabel: 'Ali, Team', totalAmount: 15 }),
  ]);
  assert.ok(csv.includes('"Ali, Team"'));
  assert.equal(
    validateSaleInput({ customerLabel: 'P1', partySize: 0, items: [{ itemId: 'a', name: 'A', qty: 1, unitPrice: 5 }] }).valid,
    false,
  );
});

test('empty initial cloud sales produce zero metrics and null rush peak', () => {
  const metrics = computeStallMetrics([], 300);
  assert.equal(metrics.netRevenue, 0);
  assert.equal(metrics.customersServed, 0);
  assert.equal(metrics.completedOrders, 0);
  assert.equal(metrics.avgOrderValue, 0);
  assert.equal(metrics.goalProgressPct, 0);

  const { buckets, peakWindow } = computeHourlyTraffic([]);
  assert.equal(peakWindow, null);
  assert.equal(buckets.every((b) => b.customers === 0 && b.revenue === 0), true);
  assert.equal(computeItemPerformance([]).length, 0);
  assert.equal(computeRushHeatmap([]).maxCustomers, 0);
});

