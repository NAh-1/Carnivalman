import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import type { StallState, TimeRangeFilter } from '../types/stall';
import {
  computeHourlyTraffic,
  computeItemPerformance,
  computePaymentBreakdown,
  computeRushHeatmap,
  computeStallMetrics,
  filterSalesByRange,
  formatMoney,
  formatSalesCsv,
} from '../utils/analytics';

interface AnalyticsViewProps {
  stall: StallState;
}

export function AnalyticsView({ stall }: AnalyticsViewProps) {
  const [range, setRange] = useState<TimeRangeFilter>('today');
  const [metric, setMetric] = useState<'customers' | 'revenue'>('customers');
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);

  const filteredSales = useMemo(
    () => filterSalesByRange(stall.sales, range),
    [stall.sales, range],
  );
  const metrics = useMemo(
    () => computeStallMetrics(filteredSales, stall.dailyGoal),
    [filteredSales, stall.dailyGoal],
  );
  const { buckets, peakWindow } = useMemo(
    () => computeHourlyTraffic(filteredSales),
    [filteredSales],
  );
  const heatmap = useMemo(() => computeRushHeatmap(stall.sales), [stall.sales]);
  const items = useMemo(() => computeItemPerformance(filteredSales), [filteredSales]);
  const payments = useMemo(() => computePaymentBreakdown(filteredSales), [filteredSales]);

  const maxVal = useMemo(() => {
    const vals = buckets.map((b) => (metric === 'customers' ? b.customers : b.revenue));
    return Math.max(1, ...vals);
  }, [buckets, metric]);

  const activeBucket = useMemo(() => {
    if (hoveredHour !== null) {
      return buckets.find((b) => b.hour === hoveredHour) ?? null;
    }
    return buckets.reduce<(typeof buckets)[number] | null>((best, curr) => {
      if (!best) return curr;
      return curr.customers > best.customers ? curr : best;
    }, null);
  }, [buckets, hoveredHour]);

  function handleExportCsv() {
    const csv = formatSalesCsv(stall.displayName, filteredSales);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${stall.stallId}-${range}-sales.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Time range"
          className="flex items-center gap-1 p-1 bg-[#0C0C10] border border-[#1E1E28] rounded-xl"
        >
          {(
            [
              { id: 'today', label: 'Today' },
              { id: 'weekend', label: 'Weekend' },
              { id: 'all', label: 'All' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setRange(opt.id)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                range === opt.id
                  ? 'bg-[#3DD9EB] text-[#050507]'
                  : 'text-[#8E8E9E] hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          disabled={filteredSales.length === 0}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-[#0C0C10] border border-[#1E1E28] rounded-lg hover:border-[#3DD9EB] disabled:opacity-40 transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" aria-hidden="true" />
          <span>CSV</span>
        </button>
      </div>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#0C0C10] border border-[#1E1E28] rounded-xl p-4">
          <div className="text-xs text-[#8E8E9E]">Net Sales</div>
          <div
            data-testid="analytics-net-revenue"
            className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-white"
          >
            {formatMoney(metrics.netRevenue, stall.currency)}
          </div>
          <div className="mt-2 h-1 w-full bg-[#1C1C26] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#3DD9EB] rounded-full"
              style={{ width: `${metrics.goalProgressPct}%` }}
            />
          </div>
          <div className="mt-1.5 text-[11px] text-[#8E8E9E] tabular-nums">
            {metrics.goalProgressPct}% of {formatMoney(stall.dailyGoal, stall.currency)}
          </div>
        </div>

        <div className="bg-[#0C0C10] border border-[#1E1E28] rounded-xl p-4">
          <div className="text-xs text-[#8E8E9E]">Players</div>
          <div
            data-testid="analytics-customers"
            className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-white"
          >
            {metrics.customersServed}
          </div>
          <div className="mt-2 text-[11px] text-[#8E8E9E] tabular-nums">
            {metrics.completedOrders} sessions
          </div>
        </div>

        <div className="bg-[#0C0C10] border border-[#1E1E28] rounded-xl p-4">
          <div className="text-xs text-[#8E8E9E]">Avg Ticket</div>
          <div className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-white">
            {formatMoney(metrics.avgOrderValue, stall.currency)}
          </div>
          <div className="mt-2 text-[11px] text-[#8E8E9E] tabular-nums">
            Refunds {formatMoney(metrics.refundedAmount, stall.currency)}
          </div>
        </div>

        <div className="bg-[#0C0C10] border border-[#1E1E28] rounded-xl p-4">
          <div className="text-xs text-[#8E8E9E]">Peak Rush</div>
          <div
            data-testid="analytics-rush-window"
            className="mt-1.5 font-display text-xl font-bold tabular-nums text-[#FF6FB5]"
          >
            {peakWindow ? peakWindow.label : '—'}
          </div>
          <div className="mt-2 text-[11px] text-[#8E8E9E] tabular-nums">
            {peakWindow ? `${peakWindow.rushMultiplier}x avg · ${peakWindow.peakCustomers} players/hr` : 'No traffic'}
          </div>
        </div>
      </section>

      <section className="bg-[#0C0C10] border border-[#1E1E28] rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#1E1E28]">
          <div>
            <h2 className="font-display text-base font-bold text-white uppercase tracking-wide">
              Hourly Rush
            </h2>
            <p className="text-xs text-[#8E8E9E] tabular-nums mt-0.5">
              {activeBucket
                ? `${activeBucket.label} · ${activeBucket.customers} players · ${formatMoney(activeBucket.revenue, stall.currency)}`
                : 'No activity'}
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#050507] border border-[#1E1E28] rounded-lg">
            <button
              type="button"
              onClick={() => setMetric('customers')}
              className={`px-3 py-1 text-xs font-semibold rounded-md cursor-pointer ${
                metric === 'customers' ? 'bg-[#3DD9EB] text-[#050507]' : 'text-[#8E8E9E]'
              }`}
            >
              Players
            </button>
            <button
              type="button"
              onClick={() => setMetric('revenue')}
              className={`px-3 py-1 text-xs font-semibold rounded-md cursor-pointer ${
                metric === 'revenue' ? 'bg-[#3DD9EB] text-[#050507]' : 'text-[#8E8E9E]'
              }`}
            >
              {stall.currency}
            </button>
          </div>
        </div>

        <div className="mt-5 h-48 flex items-end gap-1.5 sm:gap-2.5">
          {buckets.map((bucket) => {
            const raw = metric === 'customers' ? bucket.customers : bucket.revenue;
            const pct = raw > 0 ? Math.max(10, Math.round((raw / maxVal) * 100)) : 4;
            return (
              <button
                key={bucket.hour}
                type="button"
                onMouseEnter={() => setHoveredHour(bucket.hour)}
                onMouseLeave={() => setHoveredHour(null)}
                onFocus={() => setHoveredHour(bucket.hour)}
                aria-label={`${bucket.label}: ${bucket.customers} players, ${formatMoney(bucket.revenue, stall.currency)}`}
                className="flex-1 h-full flex flex-col items-center justify-end cursor-pointer focus:outline-none"
              >
                <span className="mb-1 text-[10px] font-mono tabular-nums text-[#8E8E9E]">
                  {raw > 0 ? raw : ''}
                </span>
                <div
                  className={`w-full rounded-t transition-all ${
                    raw === 0
                      ? 'bg-[#181820]'
                      : bucket.isPeak
                        ? 'bg-[#FF6FB5]'
                        : 'bg-[#3DD9EB]'
                  }`}
                  style={{ height: `${pct}%` }}
                />
                <span className="mt-1.5 text-[11px] font-mono tabular-nums text-[#8E8E9E]">
                  {bucket.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <section className="lg:col-span-7 bg-[#0C0C10] border border-[#1E1E28] rounded-xl p-5">
          <h2 className="font-display text-base font-bold text-white uppercase tracking-wide pb-3 border-b border-[#1E1E28]">
            By Game
          </h2>
          {items.length === 0 ? (
            <p className="py-6 text-xs text-[#6E6E7E]">No sales yet.</p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[#8E8E9E] border-b border-[#1E1E28]">
                    <th className="py-2 font-medium">Game</th>
                    <th className="py-2 font-medium text-right">Runs</th>
                    <th className="py-2 font-medium text-right">Revenue</th>
                    <th className="py-2 font-medium text-right">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#16161E]">
                  {items.map((it) => (
                    <tr key={it.itemId}>
                      <td className="py-2.5 font-medium text-white">{it.name}</td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-[#8E8E9E]">
                        {it.unitsSold}
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-white font-semibold">
                        {formatMoney(it.revenue, stall.currency)}
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-[#3DD9EB]">
                        {it.revenueSharePct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="lg:col-span-5 bg-[#0C0C10] border border-[#1E1E28] rounded-xl p-5">
          <h2 className="font-display text-base font-bold text-white uppercase tracking-wide pb-3 border-b border-[#1E1E28]">
            Payments
          </h2>
          <div className="mt-4 space-y-3.5">
            {payments.map((pm) => (
              <div key={pm.method}>
                <div className="flex justify-between text-xs">
                  <span className="text-[#F4F4F8]">{pm.label}</span>
                  <span className="font-mono tabular-nums text-[#8E8E9E]">
                    {formatMoney(pm.revenue, stall.currency)} · {pm.sharePct}%
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 bg-[#181820] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#3DD9EB] rounded-full"
                    style={{ width: `${pm.sharePct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="bg-[#0C0C10] border border-[#1E1E28] rounded-xl p-5">
        <h2 className="font-display text-base font-bold text-white uppercase tracking-wide pb-3 border-b border-[#1E1E28]">
          5-Day Rush Matrix
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-left text-[#8E8E9E] font-medium py-1.5 pr-3 w-24">Day</th>
                {heatmap.hours.map((h) => (
                  <th key={h} className="text-center font-mono text-[#8E8E9E] font-medium py-1.5 px-1">
                    {h > 12 ? `${h - 12}p` : `${h}p`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#16161E]">
              {heatmap.days.map((dayLabel, dayIdx) => {
                const rowCells = heatmap.cells.filter((c) => c.dayIndex === dayIdx);
                return (
                  <tr key={dayLabel}>
                    <td className="py-1.5 pr-3 text-[#F4F4F8] whitespace-nowrap">{dayLabel}</td>
                    {rowCells.map((cell) => {
                      const ratio =
                        heatmap.maxCustomers > 0 ? cell.customers / heatmap.maxCustomers : 0;
                      const cls =
                        cell.customers === 0
                          ? 'bg-[#121218] text-[#353545]'
                          : ratio >= 0.75
                            ? 'bg-[#FF6FB5] text-[#050507] font-bold'
                            : ratio >= 0.45
                              ? 'bg-[#3DD9EB] text-[#050507] font-semibold'
                              : 'bg-[#1D2D38] text-[#3DD9EB]';
                      return (
                        <td key={`${dayIdx}-${cell.hour}`} className="p-1">
                          <div
                            title={`${cell.dayLabel} ${cell.hourLabel}: ${cell.customers} players`}
                            className={`h-7 min-w-[30px] rounded flex items-center justify-center font-mono tabular-nums ${cls}`}
                          >
                            {cell.customers > 0 ? cell.customers : '·'}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
