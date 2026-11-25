import { useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import type { StationGameInput } from '../services/firestoreStall';
import type { GameStationConfig, StallState } from '../types/stall';

interface StallSettingsViewProps {
  stall: StallState;
  onSaveSettings: (params: { dailyGoal: number; currency: string }) => Promise<void>;
  onUpdateGame: (gameId: string, patch: Partial<StationGameInput>) => Promise<void>;
  onDeleteGame: (gameId: string) => Promise<void>;
}

function GamePriceRow({
  game,
  currency,
  onUpdateGame,
  onDeleteGame,
}: {
  game: GameStationConfig;
  currency: string;
  onUpdateGame: (gameId: string, patch: Partial<StationGameInput>) => Promise<void>;
  onDeleteGame: (gameId: string) => Promise<void>;
}) {
  const [name, setName] = useState(game.name);
  const [price, setPrice] = useState(String(game.price));
  const [turn, setTurn] = useState(String(game.turn));
  const [saved, setSaved] = useState(false);

  async function handleRowSave(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    await onUpdateGame(game.id, {
      name: name.trim() || game.name,
      price: Math.max(0, Number(price) || 0),
      turn: Math.min(90, Math.max(1, parseInt(turn, 10) || game.turn)),
    });
    setSaved(true);
  }

  return (
    <form
      onSubmit={(e) => void handleRowSave(e)}
      className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center py-2.5 border-b border-[#16161E] last:border-b-0"
    >
      <div className="sm:col-span-5">
        <input
          type="text"
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label={`Game name for ${game.name}`}
          className="w-full px-2.5 py-1.5 text-xs bg-[#050507] border border-[#242430] rounded-lg text-white focus:outline-none focus:border-[#3DD9EB]"
        />
      </div>
      <div className="sm:col-span-3">
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={0}
            max={10000}
            step="0.5"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            aria-label={`Price for ${game.name}`}
            className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-[#050507] border border-[#242430] rounded-lg text-white focus:outline-none focus:border-[#3DD9EB]"
          />
          <span className="text-[11px] text-[#8E8E9E] shrink-0">{currency}</span>
        </div>
      </div>
      <div className="sm:col-span-2">
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={1}
            max={90}
            value={turn}
            onChange={(e) => setTurn(e.target.value)}
            aria-label={`Minutes for ${game.name}`}
            className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-[#050507] border border-[#242430] rounded-lg text-white focus:outline-none focus:border-[#3DD9EB]"
          />
          <span className="text-[11px] text-[#8E8E9E] shrink-0">m</span>
        </div>
      </div>
      <div className="sm:col-span-2 flex items-center justify-end gap-1.5">
        <button
          type="submit"
          className="px-2.5 py-1.5 text-[11px] font-semibold bg-[#13131A] border border-[#242430] hover:border-[#3DD9EB] text-white rounded-md cursor-pointer"
        >
          {saved ? 'Saved' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => void onDeleteGame(game.id)}
          aria-label={`Remove ${game.name}`}
          className="p-1.5 text-[#6E6E7E] hover:text-[#FF6FB5] cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}

export function StallSettingsView({
  stall,
  onSaveSettings,
  onUpdateGame,
  onDeleteGame,
}: StallSettingsViewProps) {
  const [dailyGoal, setDailyGoal] = useState(String(stall.dailyGoal));
  const [currency, setCurrency] = useState(stall.currency);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    setSaving(true);
    try {
      await onSaveSettings({
        dailyGoal: Math.max(0, Number(dailyGoal) || 0),
        currency: currency.trim() || 'QR',
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <section className="lg:col-span-5 bg-[#0C0C10] border border-[#1E1E28] rounded-xl p-6">
        <h2 className="font-display text-lg font-bold text-white uppercase tracking-wide">
          {stall.displayName} Settings
        </h2>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="set-currency" className="block text-xs text-[#8E8E9E] mb-1">
                Currency
              </label>
              <input
                id="set-currency"
                type="text"
                maxLength={5}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#050507] border border-[#242430] rounded-lg text-white focus:outline-none focus:border-[#3DD9EB]"
              />
            </div>

            <div>
              <label htmlFor="set-goal" className="block text-xs text-[#8E8E9E] mb-1">
                Daily Goal
              </label>
              <input
                id="set-goal"
                type="number"
                min={0}
                max={1000000}
                value={dailyGoal}
                onChange={(e) => setDailyGoal(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#050507] border border-[#242430] rounded-lg text-white focus:outline-none focus:border-[#3DD9EB]"
              />
            </div>
          </div>

          {saved && <p className="text-xs text-[#3DD9EB]">Saved.</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 bg-[#3DD9EB] text-[#050507] text-xs font-semibold rounded-lg hover:brightness-110 transition-all cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </section>

      <section className="lg:col-span-7 bg-[#0C0C10] border border-[#1E1E28] rounded-xl p-6">
        <h2 className="font-display text-lg font-bold text-white uppercase tracking-wide pb-3 border-b border-[#1E1E28]">
          Games &amp; Prices
        </h2>

        {stall.games.length === 0 ? (
          <p className="py-6 text-xs text-[#6E6E7E]">
            No games added yet. Add games from the Queue tab.
          </p>
        ) : (
          <div className="mt-2">
            {stall.games.map((game) => (
              <GamePriceRow
                key={game.id}
                game={game}
                currency={stall.currency}
                onUpdateGame={onUpdateGame}
                onDeleteGame={onDeleteGame}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
