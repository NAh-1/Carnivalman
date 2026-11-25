import { useMemo, useState, type FormEvent } from 'react';
import { Download, RotateCcw, Search, Trash2 } from 'lucide-react';
import type { PaymentMethod, StallState } from '../types/stall';
import { formatMoney, formatSalesCsv } from '../utils/analytics';

interface CustomerLogViewProps {
  stall: StallState;
  onAddDirectSale: (params: {
    gameId: string;
    customerLabel: string;
    partySize: number;
    paymentMethod: PaymentMethod;
  }) => Promise<void>;
  onRefundSale: (saleId: string) => Promise<void>;
  onDeleteSale: (saleId: string) => Promise<void>;
}

export function CustomerLogView({
  stall,
  onAddDirectSale,
  onRefundSale,
  onDeleteSale,
}: CustomerLogViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGameId, setSelectedGameId] = useState(stall.games[0]?.id ?? '');
  const gameId = stall.games.some((g) => g.id === selectedGameId)
    ? selectedGameId
    : (stall.games[0]?.id ?? '');
  const [customerLabel, setCustomerLabel] = useState('');
  const [partySize, setPartySize] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mobile');
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return stall.sales;
    return stall.sales.filter(
      (s) =>
        s.customerLabel.toLowerCase().includes(q) ||
        s.items.some((i) => i.name.toLowerCase().includes(q)),
    );
  }, [stall.sales, searchQuery]);

  async function handleQuickSale(e: FormEvent) {
    e.preventDefault();
    if (!gameId) return;
    setSubmitting(true);
    try {
      await onAddDirectSale({
        gameId,
        customerLabel: customerLabel.trim() || 'Walk-up',
        partySize,
        paymentMethod,
      });
      setCustomerLabel('');
      setPartySize(1);
    } finally {
      setSubmitting(false);
    }
  }

  function handleExport() {
    const csv = formatSalesCsv(stall.displayName, filtered);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${stall.stallId}-ledger.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <form
        onSubmit={(e) => void handleQuickSale(e)}
        className="bg-[#0C0C10] border border-[#1E1E28] rounded-xl p-4 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
      >
        <div className="sm:col-span-3">
          <label htmlFor="walkup-game" className="block text-[11px] text-[#8E8E9E] mb-1">
            Station
          </label>
          <select
            id="walkup-game"
            value={gameId}
            onChange={(e) => setSelectedGameId(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-[#050507] border border-[#242430] rounded-lg text-white focus:outline-none focus:border-[#3DD9EB]"
          >
            {stall.games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.price} {stall.currency})
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-3">
          <label htmlFor="walkup-name" className="block text-[11px] text-[#8E8E9E] mb-1">
            Player
          </label>
          <input
            id="walkup-name"
            type="text"
            maxLength={60}
            value={customerLabel}
            onChange={(e) => setCustomerLabel(e.target.value)}
            placeholder="Walk-up"
            className="w-full px-3 py-2 text-xs bg-[#050507] border border-[#242430] rounded-lg text-white placeholder:text-[#555566] focus:outline-none focus:border-[#3DD9EB]"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="walkup-party" className="block text-[11px] text-[#8E8E9E] mb-1">
            Players
          </label>
          <input
            id="walkup-party"
            type="number"
            min={1}
            max={20}
            value={partySize}
            onChange={(e) => setPartySize(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
            className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-[#050507] border border-[#242430] rounded-lg text-white focus:outline-none focus:border-[#3DD9EB]"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="walkup-pay" className="block text-[11px] text-[#8E8E9E] mb-1">
            Payment
          </label>
          <select
            id="walkup-pay"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            className="w-full px-3 py-2 text-xs bg-[#050507] border border-[#242430] rounded-lg text-white focus:outline-none focus:border-[#3DD9EB]"
          >
            <option value="mobile">QR / Mobile</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2 px-3 bg-[#3DD9EB] text-[#050507] text-xs font-semibold rounded-lg hover:brightness-110 transition-all cursor-pointer"
          >
            Log Sale
          </button>
        </div>
      </form>

      <section className="bg-[#0C0C10] border border-[#1E1E28] rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#1E1E28]">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search
              className="w-3.5 h-3.5 text-[#8E8E9E] absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search player or game..."
              aria-label="Search sales ledger"
              className="w-full pl-8 pr-3 py-2 text-xs bg-[#050507] border border-[#242430] rounded-lg text-white placeholder:text-[#555566] focus:outline-none focus:border-[#3DD9EB]"
            />
          </div>

          <button
            type="button"
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#13131A] border border-[#1E1E28] rounded-lg hover:border-[#3DD9EB] disabled:opacity-40 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>CSV</span>
          </button>
        </div>

        {filtered.length === 0 ? (
          <p className="py-10 text-center text-xs text-[#6E6E7E]">No sales recorded.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[#8E8E9E] border-b border-[#1E1E28]">
                  <th className="py-2.5 pr-3 font-medium">Time</th>
                  <th className="py-2.5 pr-3 font-medium">Player</th>
                  <th className="py-2.5 pr-3 font-medium">Station</th>
                  <th className="py-2.5 pr-3 font-medium text-right">Qty</th>
                  <th className="py-2.5 pr-3 font-medium">Pay</th>
                  <th className="py-2.5 pr-3 font-medium">Status</th>
                  <th className="py-2.5 pr-3 font-medium text-right">Amount</th>
                  <th className="py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#16161E]">
                {filtered.map((sale) => {
                  const timeStr = new Date(sale.occurredAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  });
                  const gameStr = sale.items.map((i) => i.name).join(', ');
                  return (
                    <tr key={sale.id} className="hover:bg-[#13131A]">
                      <td className="py-2.5 pr-3 font-mono tabular-nums text-[#8E8E9E] whitespace-nowrap">
                        {timeStr}
                      </td>
                      <td className="py-2.5 pr-3 font-medium text-white">
                        {sale.customerLabel || 'Walk-up'}
                      </td>
                      <td className="py-2.5 pr-3 text-[#B9B2D6]">{gameStr}</td>
                      <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-[#8E8E9E]">
                        {sale.partySize}
                      </td>
                      <td className="py-2.5 pr-3 capitalize text-[#8E8E9E]">{sale.paymentMethod}</td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={
                            sale.status === 'refunded' ? 'text-[#FF6FB5]' : 'text-emerald-400'
                          }
                        >
                          {sale.status === 'refunded' ? 'Refunded' : 'Paid'}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono font-semibold tabular-nums text-white">
                        {formatMoney(sale.totalAmount, stall.currency)}
                      </td>
                      <td className="py-2.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {sale.status === 'completed' && (
                            <button
                              type="button"
                              onClick={() => void onRefundSale(sale.id)}
                              aria-label={`Refund ${sale.customerLabel}`}
                              className="px-2 py-1 text-[11px] bg-[#1C1C26] text-[#F4F4F8] hover:text-[#FF6FB5] rounded cursor-pointer inline-flex items-center gap-1"
                            >
                              <RotateCcw className="w-3 h-3" aria-hidden="true" />
                              <span>Refund</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void onDeleteSale(sale.id)}
                            aria-label={`Delete ${sale.customerLabel}`}
                            className="p-1 text-[#6E6E7E] hover:text-[#FF6FB5] rounded cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
