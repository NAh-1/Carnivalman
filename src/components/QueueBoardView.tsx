import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { StationGameInput } from '../services/firestoreStall';
import type { GameStationConfig, StallState } from '../types/stall';
import { formatTimer } from '../utils/analytics';
import {
  computeGlobalNextUp,
  computeQueueWaitSeconds,
  computeRemainingPlaySeconds,
  formatWaitDuration,
} from '../utils/queueDisplay';

interface QueueBoardViewProps {
  stall: StallState;
  isDisplayMode: boolean;
  onAddQueue: (gameId: string, name: string, party: number) => Promise<void>;
  onTogglePaid: (gameId: string, entryId: string, paid: boolean) => Promise<void>;
  onMoveUp: (gameId: string, entryId: string) => Promise<void>;
  onRemoveEntry: (gameId: string, entryId: string) => Promise<void>;
  onCallNext: (gameId: string) => Promise<void>;
  onFinishTurn: (gameId: string, next: boolean) => Promise<void>;
  onUpdateTurn: (gameId: string, turn: number) => Promise<void>;
  onAddGame: (input: StationGameInput) => Promise<void>;
  onUpdateGame: (gameId: string, patch: Partial<StationGameInput>) => Promise<void>;
  onDeleteGame: (gameId: string) => Promise<void>;
  onResetDay: () => Promise<void>;
}

interface StationCardProps {
  game: GameStationConfig;
  stall: StallState;
  nowMs: number;
  isDisplayMode: boolean;
  onAddQueue: (gameId: string, name: string, party: number) => Promise<void>;
  onTogglePaid: (gameId: string, entryId: string, paid: boolean) => Promise<void>;
  onMoveUp: (gameId: string, entryId: string) => Promise<void>;
  onRemoveEntry: (gameId: string, entryId: string) => Promise<void>;
  onCallNext: (gameId: string) => Promise<void>;
  onFinishTurn: (gameId: string, next: boolean) => Promise<void>;
  onUpdateTurn: (gameId: string, turn: number) => Promise<void>;
  onUpdateGame: (gameId: string, patch: Partial<StationGameInput>) => Promise<void>;
  onDeleteGame: (gameId: string) => Promise<void>;
}

function StationCard({
  game,
  stall,
  nowMs,
  isDisplayMode,
  onAddQueue,
  onTogglePaid,
  onMoveUp,
  onRemoveEntry,
  onCallNext,
  onFinishTurn,
  onUpdateTurn,
  onUpdateGame,
  onDeleteGame,
}: StationCardProps) {
  const q = stall.queues[game.id] ?? { now: null, wait: [], turn: game.turn };
  const [playerName, setPlayerName] = useState('');
  const [party, setParty] = useState(1);
  const [formError, setFormError] = useState('');
  const [turnDraft, setTurnDraft] = useState(String(q.turn));
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(game.name);
  const [editGear, setEditGear] = useState(game.gear);
  const [editPrice, setEditPrice] = useState(String(game.price));
  const [editUnit, setEditUnit] = useState(game.unit);
  const [editTurn, setEditTurn] = useState(String(game.turn));
  const [editTeam, setEditTeam] = useState(game.team);
  const [editError, setEditError] = useState('');

  useEffect(() => {
    setTurnDraft(String(q.turn));
  }, [q.turn]);

  useEffect(() => {
    if (!editing) {
      setEditName(game.name);
      setEditGear(game.gear);
      setEditPrice(String(game.price));
      setEditUnit(game.unit);
      setEditTurn(String(game.turn));
      setEditTeam(game.team);
    }
  }, [editing, game]);

  const remainingSec = computeRemainingPlaySeconds(q, nowMs, game.turn);
  const isOvertime = Boolean(q.now && remainingSec < 0);
  const displayLimit = isDisplayMode ? 6 : 100;
  const visibleQueue = q.wait.slice(0, displayLimit);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const trimmed = playerName.trim();
    if (!trimmed) {
      setFormError('Type a name first.');
      return;
    }
    setFormError('');
    setBusy(true);
    try {
      await onAddQueue(game.id, trimmed, party);
      setPlayerName('');
      setParty(1);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to add.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    const nameTrim = editName.trim();
    const parsedPrice = Number(editPrice);
    const parsedTurn = parseInt(editTurn, 10);
    if (!nameTrim) {
      setEditError('Name is required.');
      return;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setEditError('Invalid price.');
      return;
    }
    if (!Number.isFinite(parsedTurn) || parsedTurn < 1 || parsedTurn > 90) {
      setEditError('Minutes must be 1–90.');
      return;
    }
    setEditError('');
    setBusy(true);
    try {
      await onUpdateGame(game.id, {
        name: nameTrim,
        gear: editGear.trim() || 'Station',
        price: parsedPrice,
        unit: editUnit.trim() || (editTeam ? 'per person' : 'per run'),
        turn: parsedTurn,
        team: editTeam,
      });
      setEditing(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Unable to save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label={game.name}
      data-testid={`station-${game.id}`}
      className="bg-[#0C0C10] border border-[#1E1E28] rounded-2xl p-5 flex flex-col gap-4 min-w-0"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            className={`font-display font-bold tracking-tight text-white leading-none ${
              isDisplayMode ? 'text-3xl' : 'text-2xl'
            }`}
          >
            {game.name}
          </h2>
          <p className="text-xs text-[#8E8E9E] mt-1.5">{game.gear}</p>
        </div>

        <div className="flex items-start gap-2 shrink-0">
          {!isDisplayMode && (
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              aria-label={`Edit ${game.name}`}
              aria-expanded={editing}
              className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                editing
                  ? 'bg-[#3DD9EB] border-[#3DD9EB] text-[#050507]'
                  : 'bg-[#13131A] border-[#1E1E28] text-[#8E8E9E] hover:text-white'
              }`}
            >
              <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}

          <div className="bg-[#FF6FB5] text-[#050507] rounded-xl px-3 py-1.5 text-center shrink-0">
            <div className="font-display text-xl font-bold leading-none tabular-nums">
              {game.price} {stall.currency}
            </div>
            <div className="text-[11px] font-semibold leading-tight mt-0.5">{game.unit}</div>
          </div>
        </div>
      </div>

      {!isDisplayMode && editing && (
        <form
          onSubmit={(e) => void handleSaveEdit(e)}
          className="bg-[#13131A] border border-[#242430] rounded-xl p-3.5 space-y-2.5"
        >
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label
                htmlFor={`edit-name-${game.id}`}
                className="block text-[11px] text-[#8E8E9E] mb-1"
              >
                Game name
              </label>
              <input
                id={`edit-name-${game.id}`}
                type="text"
                maxLength={40}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-[#050507] border border-[#242430] rounded-lg text-white focus:outline-none focus:border-[#3DD9EB]"
              />
            </div>

            <div className="col-span-2">
              <label
                htmlFor={`edit-gear-${game.id}`}
                className="block text-[11px] text-[#8E8E9E] mb-1"
              >
                Setup / gear
              </label>
              <input
                id={`edit-gear-${game.id}`}
                type="text"
                maxLength={50}
                value={editGear}
                onChange={(e) => setEditGear(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-[#050507] border border-[#242430] rounded-lg text-white focus:outline-none focus:border-[#3DD9EB]"
              />
            </div>

            <div>
              <label
                htmlFor={`edit-price-${game.id}`}
                className="block text-[11px] text-[#8E8E9E] mb-1"
              >
                Price ({stall.currency})
              </label>
              <input
                id={`edit-price-${game.id}`}
                type="number"
                min={0}
                max={10000}
                step="0.5"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-[#050507] border border-[#242430] rounded-lg text-white focus:outline-none focus:border-[#3DD9EB]"
              />
            </div>

            <div>
              <label
                htmlFor={`edit-unit-${game.id}`}
                className="block text-[11px] text-[#8E8E9E] mb-1"
              >
                Unit
              </label>
              <input
                id={`edit-unit-${game.id}`}
                type="text"
                maxLength={20}
                value={editUnit}
                onChange={(e) => setEditUnit(e.target.value)}
                placeholder="per run"
                className="w-full px-2.5 py-1.5 text-xs bg-[#050507] border border-[#242430] rounded-lg text-white focus:outline-none focus:border-[#3DD9EB]"
              />
            </div>

            <div>
              <label
                htmlFor={`edit-turn-${game.id}`}
                className="block text-[11px] text-[#8E8E9E] mb-1"
              >
                Minutes
              </label>
              <input
                id={`edit-turn-${game.id}`}
                type="number"
                min={1}
                max={90}
                value={editTurn}
                onChange={(e) => setEditTurn(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-[#050507] border border-[#242430] rounded-lg text-white focus:outline-none focus:border-[#3DD9EB]"
              />
            </div>

            <div className="flex items-end pb-1">
              <label className="inline-flex items-center gap-1.5 text-xs text-[#F4F4F8] cursor-pointer">
                <input
                  type="checkbox"
                  checked={editTeam}
                  onChange={(e) => setEditTeam(e.target.checked)}
                  className="w-4 h-4 accent-[#3DD9EB] rounded cursor-pointer"
                />
                <span>Group pricing</span>
              </label>
            </div>
          </div>

          {editError && <p className="text-xs text-[#FF6FB5]">{editError}</p>}

          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => void onDeleteGame(game.id)}
              aria-label={`Delete ${game.name}`}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-[#8E8E9E] hover:text-[#FF6FB5] rounded-md cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Delete</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-3 py-1.5 text-xs text-[#8E8E9E] hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-3.5 py-1.5 text-xs font-semibold bg-[#3DD9EB] text-[#050507] rounded-lg hover:brightness-110 cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </form>
      )}

      <div
        className={`rounded-xl p-4 flex flex-col gap-1.5 transition-colors ${
          q.now
            ? isOvertime
              ? 'bg-[#FF6FB5] text-[#050507]'
              : 'bg-[#3DD9EB] text-[#050507]'
            : 'bg-[#13131A] border border-[#1E1E28] text-white'
        }`}
      >
        <span className="text-[11px] font-bold tracking-[0.18em] uppercase">
          {q.now ? 'NOW PLAYING' : 'FREE'}
        </span>

        <div
          className={`font-display font-bold leading-tight ${
            isDisplayMode ? 'text-3xl' : 'text-2xl'
          }`}
        >
          {q.now
            ? `${q.now.name}${game.team && q.now.party > 1 ? ` ×${q.now.party}` : ''}`
            : q.wait.length > 0
              ? `Next up: ${q.wait[0].name}`
              : 'Step up and play'}
        </div>

        {q.now && (
          <div
            data-testid={`timer-${game.id}`}
            className={`font-display font-bold tabular-nums leading-none mt-1 ${
              isDisplayMode ? 'text-5xl' : 'text-4xl'
            } ${isOvertime ? 'overtime-flash' : ''}`}
          >
            {isOvertime ? 'TIME’S UP' : formatTimer(remainingSec)}
          </div>
        )}

        {!isDisplayMode && (
          <div className="flex flex-wrap gap-2 mt-2">
            {q.now ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onFinishTurn(game.id, false)}
                  className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#050507] text-white hover:bg-[#1A1A24] transition-colors cursor-pointer"
                >
                  Finish turn
                </button>
                {q.wait.length > 0 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onFinishTurn(game.id, true)}
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#050507] text-white hover:bg-[#1A1A24] transition-colors cursor-pointer"
                  >
                    Finish &amp; call next
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                disabled={busy || q.wait.length === 0}
                onClick={() => void onCallNext(game.id)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#3DD9EB] text-[#050507] hover:brightness-110 disabled:opacity-35 transition-all cursor-pointer"
              >
                Call next
              </button>
            )}
          </div>
        )}
      </div>

      <div>
        <div className="text-[11px] font-semibold tracking-[0.18em] text-[#8E8E9E] uppercase mb-2">
          UP NEXT
        </div>

        {visibleQueue.length === 0 ? (
          <p className="text-xs text-[#6E6E7E] py-1">Nobody waiting.</p>
        ) : (
          <ul className="space-y-2">
            {visibleQueue.map((entry, idx) => {
              const due = game.price * (game.team ? entry.party : 1);
              const waitSec = computeQueueWaitSeconds(q, nowMs, idx, game.turn);
              const waitLabel = formatWaitDuration(waitSec, Boolean(q.now));

              return (
                <li
                  key={entry.id}
                  className="bg-[#13131A] border border-[#1E1E28] rounded-xl p-3 space-y-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-display text-xl font-bold text-[#3DD9EB] w-6 shrink-0 tabular-nums">
                      {idx + 1}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div
                        className={`font-semibold text-white truncate ${
                          isDisplayMode ? 'text-lg' : 'text-sm'
                        }`}
                      >
                        {entry.name}
                      </div>
                      <div className="text-xs text-[#8E8E9E]">
                        {game.team && entry.party > 1 ? `${entry.party} players` : ''}
                        {!isDisplayMode && (
                          <span>
                            {game.team && entry.party > 1 ? ' · ' : ''}
                            due {due} {stall.currency}{' '}
                            <span
                              className={
                                entry.paid ? 'text-emerald-400 font-medium' : 'text-[#8E8E9E]'
                              }
                            >
                              ({entry.paid ? 'paid' : 'unpaid'})
                            </span>
                          </span>
                        )}
                      </div>
                    </div>

                    <span
                      className={`text-xs font-mono font-semibold tabular-nums shrink-0 ${
                        !q.now && idx === 0 ? 'text-[#3DD9EB]' : 'text-[#F4F4F8]'
                      }`}
                    >
                      {waitLabel}
                    </span>
                  </div>

                  {!isDisplayMode && (
                    <div className="flex flex-wrap items-center gap-2 pl-9">
                      <label className="inline-flex items-center gap-1.5 text-xs text-[#F4F4F8] cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={entry.paid}
                          onChange={(e) =>
                            void onTogglePaid(game.id, entry.id, e.target.checked)
                          }
                          aria-label={`Mark ${entry.name} paid`}
                          className="w-4 h-4 accent-[#3DD9EB] rounded cursor-pointer"
                        />
                        <span>Paid</span>
                      </label>

                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => void onMoveUp(game.id, entry.id)}
                          className="px-2.5 py-1 text-xs font-medium bg-[#1C1C26] text-[#F4F4F8] rounded-md hover:bg-[#272734] transition-colors cursor-pointer"
                        >
                          Move up
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => void onRemoveEntry(game.id, entry.id)}
                        className="px-2.5 py-1 text-xs font-medium bg-[#1C1C26] text-[#8E8E9E] hover:text-[#FF6FB5] rounded-md transition-colors cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {q.wait.length > displayLimit && (
          <p className="text-xs text-[#8E8E9E] mt-2">
            +{q.wait.length - displayLimit} more waiting
          </p>
        )}
      </div>

      {!isDisplayMode && (
        <>
          <form onSubmit={(e) => void handleAdd(e)} className="space-y-2 pt-1">
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                maxLength={40}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Player or group name"
                aria-label={`Name for ${game.name}`}
                className="flex-1 min-w-[140px] px-3 py-2 text-sm bg-[#050507] border border-[#242430] rounded-lg text-white placeholder:text-[#555566] focus:outline-none focus:border-[#3DD9EB]"
              />

              {game.team && (
                <select
                  value={party}
                  onChange={(e) => setParty(Number(e.target.value))}
                  aria-label={`Players for ${game.name}`}
                  className="px-2.5 py-2 text-sm bg-[#050507] border border-[#242430] rounded-lg text-white focus:outline-none focus:border-[#3DD9EB]"
                >
                  <option value={1}>1 player</option>
                  <option value={2}>2 players</option>
                  <option value={3}>3 players</option>
                  <option value={4}>4 players</option>
                </select>
              )}

              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 text-xs font-semibold bg-[#3DD9EB] text-[#050507] rounded-lg hover:brightness-110 transition-all cursor-pointer whitespace-nowrap"
              >
                Add
              </button>
            </div>
            {formError && (
              <p role="status" className="text-xs text-[#FF6FB5]">
                {formError}
              </p>
            )}
          </form>

          <label className="flex items-center gap-2 text-xs text-[#8E8E9E] pt-1 border-t border-[#1E1E28]">
            <span>Minutes per turn</span>
            <input
              type="number"
              min={1}
              max={90}
              value={turnDraft}
              onChange={(e) => setTurnDraft(e.target.value)}
              onBlur={() => {
                const n = parseInt(turnDraft, 10);
                if (n >= 1 && n <= 90 && n !== q.turn) {
                  void onUpdateTurn(game.id, n);
                } else {
                  setTurnDraft(String(q.turn));
                }
              }}
              className="w-16 px-2.5 py-1.5 text-xs font-mono tabular-nums bg-[#050507] border border-[#242430] rounded-md text-white focus:outline-none focus:border-[#3DD9EB]"
            />
          </label>
        </>
      )}
    </section>
  );
}

export function QueueBoardView({
  stall,
  isDisplayMode,
  onAddQueue,
  onTogglePaid,
  onMoveUp,
  onRemoveEntry,
  onCallNext,
  onFinishTurn,
  onUpdateTurn,
  onAddGame,
  onUpdateGame,
  onDeleteGame,
  onResetDay,
}: QueueBoardViewProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [armedReset, setArmedReset] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [addingGame, setAddingGame] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGear, setNewGear] = useState('');
  const [newPrice, setNewPrice] = useState('5');
  const [newUnit, setNewUnit] = useState('per run');
  const [newTurn, setNewTurn] = useState('5');
  const [newTeam, setNewTeam] = useState(false);
  const [addError, setAddError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  function handleResetClick() {
    if (!armedReset) {
      setArmedReset(true);
      resetTimer.current = setTimeout(() => setArmedReset(false), 4000);
      return;
    }
    if (resetTimer.current) clearTimeout(resetTimer.current);
    setArmedReset(false);
    void onResetDay();
  }

  async function handleCreateGame(e: FormEvent) {
    e.preventDefault();
    const trimmed = newName.trim();
    const priceNum = Number(newPrice);
    const turnNum = parseInt(newTurn, 10);
    if (!trimmed) {
      setAddError('Game name is required.');
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setAddError('Enter a valid price.');
      return;
    }
    if (!Number.isFinite(turnNum) || turnNum < 1 || turnNum > 90) {
      setAddError('Minutes must be 1 to 90.');
      return;
    }
    setAddError('');
    setCreating(true);
    try {
      await onAddGame({
        name: trimmed,
        gear: newGear.trim() || 'Station',
        price: priceNum,
        unit: newUnit.trim() || (newTeam ? 'per person' : 'per run'),
        turn: turnNum,
        team: newTeam,
      });
      setNewName('');
      setNewGear('');
      setNewPrice('5');
      setNewUnit('per run');
      setNewTurn('5');
      setNewTeam(false);
      setAddingGame(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Unable to add game.');
    } finally {
      setCreating(false);
    }
  }

  const nextUpList = isDisplayMode ? computeGlobalNextUp(stall.games, stall.queues, nowMs) : [];
  const leadNext = nextUpList[0] ?? null;
  const followingNext = nextUpList.slice(1, 4);

  return (
    <div className="space-y-5">
      {isDisplayMode && (
        <section
          aria-label="Next up overview"
          data-testid="display-next-up"
          className="bg-[#0C0C10] border border-[#1E1E28] rounded-2xl p-5 sm:p-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs font-bold tracking-[0.2em] text-[#3DD9EB] uppercase">
                NEXT UP
              </div>
              {leadNext ? (
                <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-display text-3xl sm:text-4xl font-bold text-white leading-none">
                    {leadNext.playerName}
                    {leadNext.team && leadNext.party > 1 ? ` ×${leadNext.party}` : ''}
                  </span>
                  <span className="text-[#8E8E9E] text-lg" aria-hidden="true">
                    ·
                  </span>
                  <span className="font-display text-2xl sm:text-3xl font-bold text-[#FF6FB5] leading-none">
                    {leadNext.gameName}
                  </span>
                </div>
              ) : (
                <div className="mt-1 font-display text-2xl sm:text-3xl font-bold text-white leading-none">
                  No line — step up and play
                </div>
              )}
            </div>

            {leadNext && (
              <div className="shrink-0 sm:text-right">
                <div className="text-[11px] font-semibold tracking-[0.18em] text-[#8E8E9E] uppercase">
                  WAIT TIME
                </div>
                <div
                  data-testid="display-next-wait"
                  className={`font-display text-3xl sm:text-4xl font-bold tabular-nums leading-none mt-1 ${
                    leadNext.isReadyNow ? 'text-[#3DD9EB]' : 'text-white'
                  }`}
                >
                  {formatWaitDuration(leadNext.waitSeconds, leadNext.stationBusy)}
                </div>
              </div>
            )}
          </div>

          {followingNext.length > 0 && (
            <div className="mt-4 pt-3.5 border-t border-[#1E1E28] flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#8E8E9E]">
              <span className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[#6E6E7E]">
                AFTER THAT
              </span>
              {followingNext.map((item) => (
                <span key={item.entryId} className="inline-flex items-center gap-2 text-white">
                  <span className="font-semibold">{item.playerName}</span>
                  <span className="text-[#6E6E7E]" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-[#B9B2D6]">{item.gameName}</span>
                  <span className="text-[#6E6E7E]" aria-hidden="true">
                    ·
                  </span>
                  <span className="font-mono text-xs tabular-nums text-[#3DD9EB]">
                    {formatWaitDuration(item.waitSeconds, item.stationBusy)}
                  </span>
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {!isDisplayMode && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setAddingGame((v) => !v)}
              aria-expanded={addingGame}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                addingGame
                  ? 'bg-[#3DD9EB] text-[#050507]'
                  : 'bg-[#0C0C10] border border-[#1E1E28] text-white hover:border-[#3DD9EB]'
              }`}
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Add Game</span>
            </button>

            <button
              type="button"
              onClick={handleResetClick}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                armedReset
                  ? 'bg-[#FF6FB5] text-[#050507]'
                  : 'bg-[#0C0C10] border border-[#1E1E28] text-[#8E8E9E] hover:text-white'
              }`}
            >
              {armedReset ? 'Tap again to clear queues' : 'Reset day'}
            </button>
          </div>

          {addingGame && (
            <form
              onSubmit={(e) => void handleCreateGame(e)}
              className="bg-[#0C0C10] border border-[#1E1E28] rounded-xl p-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
            >
              <div className="sm:col-span-3">
                <label htmlFor="add-game-name" className="block text-[11px] text-[#8E8E9E] mb-1">
                  Game name
                </label>
                <input
                  id="add-game-name"
                  type="text"
                  maxLength={40}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Tekken 8"
                  className="w-full px-3 py-2 text-xs bg-[#050507] border border-[#242430] rounded-lg text-white placeholder:text-[#555566] focus:outline-none focus:border-[#3DD9EB]"
                />
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="add-game-gear" className="block text-[11px] text-[#8E8E9E] mb-1">
                  Setup / gear
                </label>
                <input
                  id="add-game-gear"
                  type="text"
                  maxLength={50}
                  value={newGear}
                  onChange={(e) => setNewGear(e.target.value)}
                  placeholder="PS5 · Wheel"
                  className="w-full px-3 py-2 text-xs bg-[#050507] border border-[#242430] rounded-lg text-white placeholder:text-[#555566] focus:outline-none focus:border-[#3DD9EB]"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="add-game-price" className="block text-[11px] text-[#8E8E9E] mb-1">
                  Price ({stall.currency})
                </label>
                <input
                  id="add-game-price"
                  type="number"
                  min={0}
                  max={10000}
                  step="0.5"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-[#050507] border border-[#242430] rounded-lg text-white focus:outline-none focus:border-[#3DD9EB]"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="add-game-unit" className="block text-[11px] text-[#8E8E9E] mb-1">
                  Unit
                </label>
                <input
                  id="add-game-unit"
                  type="text"
                  maxLength={20}
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#050507] border border-[#242430] rounded-lg text-white focus:outline-none focus:border-[#3DD9EB]"
                />
              </div>

              <div className="sm:col-span-1">
                <label htmlFor="add-game-turn" className="block text-[11px] text-[#8E8E9E] mb-1">
                  Min
                </label>
                <input
                  id="add-game-turn"
                  type="number"
                  min={1}
                  max={90}
                  value={newTurn}
                  onChange={(e) => setNewTurn(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs font-mono tabular-nums bg-[#050507] border border-[#242430] rounded-lg text-white focus:outline-none focus:border-[#3DD9EB]"
                />
              </div>

              <div className="sm:col-span-1 flex items-center justify-end gap-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="w-full py-2 px-3 bg-[#3DD9EB] text-[#050507] text-xs font-semibold rounded-lg hover:brightness-110 cursor-pointer"
                >
                  Save
                </button>
              </div>

              <div className="sm:col-span-12 flex flex-wrap items-center justify-between gap-2 pt-1">
                <label className="inline-flex items-center gap-1.5 text-xs text-[#8E8E9E] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newTeam}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setNewTeam(checked);
                      setNewUnit(checked ? 'per person' : 'per run');
                    }}
                    className="w-4 h-4 accent-[#3DD9EB] rounded cursor-pointer"
                  />
                  <span>Charge per player (group mode)</span>
                </label>
                {addError && <span className="text-xs text-[#FF6FB5]">{addError}</span>}
              </div>
            </form>
          )}
        </div>
      )}

      {stall.games.length === 0 ? (
        <div className="bg-[#0C0C10] border border-[#1E1E28] rounded-2xl p-8 text-center">
          <p className="text-sm text-[#8E8E9E]">No games configured yet.</p>
        </div>
      ) : (
        <div
          className={`grid gap-4 items-start ${
            isDisplayMode
              ? 'grid-cols-1 md:grid-cols-3'
              : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
          }`}
        >
          {stall.games.map((game) => (
            <StationCard
              key={game.id}
              game={game}
              stall={stall}
              nowMs={nowMs}
              isDisplayMode={isDisplayMode}
              onAddQueue={onAddQueue}
              onTogglePaid={onTogglePaid}
              onMoveUp={onMoveUp}
              onRemoveEntry={onRemoveEntry}
              onCallNext={onCallNext}
              onFinishTurn={onFinishTurn}
              onUpdateTurn={onUpdateTurn}
              onUpdateGame={onUpdateGame}
              onDeleteGame={onDeleteGame}
            />
          ))}
        </div>
      )}
    </div>
  );
}
