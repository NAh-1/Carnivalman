import { useEffect, useState } from 'react';
import { Maximize2, Monitor, Settings } from 'lucide-react';
import { AnalyticsView } from './components/AnalyticsView';
import { CustomerLogView } from './components/CustomerLogView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginGate } from './components/LoginGate';
import { QueueBoardView } from './components/QueueBoardView';
import { StallSettingsView } from './components/StallSettingsView';
import {
  addToQueue,
  callNextPlayer,
  createDirectSale,
  createStationGame,
  deleteSaleById,
  deleteStationGame,
  ensureStallInitialized,
  finishTurn,
  moveQueueUp,
  refundSaleById,
  removeFromQueue,
  resetQueuesForDay,
  setQueuePaid,
  signOutStall,
  subscribeStallAuth,
  subscribeStallRealtime,
  updateStallSettings,
  updateStationGame,
  updateTurnMinutes,
} from './services/firestoreStall';
import type { DashboardView, StallId, StallState } from './types/stall';

interface AuthSession {
  stallId: StallId;
  uid: string;
}

function StallApp() {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [stall, setStall] = useState<StallState | null>(null);
  const [liveConnected, setLiveConnected] = useState(false);
  const [view, setView] = useState<DashboardView>('queue');
  const [isDisplayMode, setIsDisplayMode] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    return subscribeStallAuth((nextAuth) => {
      setSession(nextAuth);
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!session) {
      setStall(null);
      setLiveConnected(false);
      setIsDisplayMode(false);
      setLoadError(null);
      setActionError(null);
      return;
    }

    let cancelled = false;
    let unsubscribeRealtime: (() => void) | null = null;
    setLoadError(null);

    ensureStallInitialized(session.stallId, session.uid)
      .then(() => {
        if (cancelled) return;
        unsubscribeRealtime = subscribeStallRealtime(
          session.stallId,
          session.uid,
          (nextState) => {
            if (!cancelled) setStall(nextState);
          },
          (connected) => {
            if (!cancelled) setLiveConnected(connected);
          },
          (err) => {
            if (!cancelled) {
              setLoadError(err.message || 'Unable to sync stall data.');
            }
          },
        );
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Unable to initialize stall.');
        }
      });

    return () => {
      cancelled = true;
      if (unsubscribeRealtime) unsubscribeRealtime();
    };
  }, [session]);

  function handleFullscreen() {
    try {
      const req = document.documentElement.requestFullscreen?.();
      if (req && typeof req.catch === 'function') {
        req.catch(() => {});
      }
    } catch {
      // Ignore fullscreen denial in restricted iframes
    }
  }

  async function handleSignOut() {
    setIsDisplayMode(false);
    setView('queue');
    setStall(null);
    await signOutStall();
  }

  async function runAction(fn: () => Promise<void>) {
    setActionError(null);
    try {
      await fn();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Cloud sync error.');
      throw err;
    }
  }

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#050507] text-[#8E8E9E] flex items-center justify-center p-6">
        <span className="text-xs">Loading...</span>
      </div>
    );
  }

  if (!session) {
    return <LoginGate />;
  }

  if (!stall) {
    return (
      <div className="min-h-screen bg-[#050507] text-[#F4F4F8] flex items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-3">
          <div className="text-xs text-[#8E8E9E] break-words">
            {loadError ? loadError : `Loading ${session.stallId}...`}
          </div>
          {loadError && (
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="px-4 py-2 text-xs font-semibold bg-[#3DD9EB] text-[#050507] rounded-lg cursor-pointer"
            >
              Back to Sign In
            </button>
          )}
        </div>
      </div>
    );
  }

  const activeStallId = session.stallId;

  return (
    <div className="min-h-screen bg-[#050507] text-[#F4F4F8] flex flex-col">
      <header className="border-b border-[#1E1E28] bg-[#050507]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 min-h-14 py-2 flex flex-wrap items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <h1
              data-testid="active-stall-name"
              className="font-display text-xl sm:text-2xl font-bold tracking-wide uppercase text-white whitespace-nowrap"
            >
              {stall.displayName}
            </h1>
            <span className="text-xs font-mono text-[#8E8E9E] whitespace-nowrap">
              {liveConnected ? 'LIVE' : 'SYNCING'}
            </span>
          </div>

          {!isDisplayMode && (
            <nav
              aria-label="Main sections"
              className="order-3 w-full sm:order-none sm:w-auto flex items-center gap-1 overflow-x-auto"
            >
              {(
                [
                  { id: 'queue', label: 'Queue' },
                  { id: 'analytics', label: 'Sales Report' },
                  { id: 'ledger', label: 'Ledger' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setView(tab.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer ${
                    view === tab.id
                      ? 'bg-[#3DD9EB] text-[#050507]'
                      : 'text-[#8E8E9E] hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              <button
                type="button"
                aria-label="Stall settings"
                onClick={() => setView('settings')}
                className={`p-2 rounded-lg shrink-0 cursor-pointer ${
                  view === 'settings'
                    ? 'bg-[#3DD9EB] text-[#050507]'
                    : 'text-[#8E8E9E] hover:text-white'
                }`}
              >
                <Settings className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </nav>
          )}

          <div className="flex items-center gap-2 shrink-0">
            {isDisplayMode ? (
              <>
                <button
                  type="button"
                  onClick={handleFullscreen}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#13131A] border border-[#1E1E28] text-white rounded-lg hover:border-[#3DD9EB] cursor-pointer whitespace-nowrap"
                >
                  <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Fullscreen</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsDisplayMode(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-[#3DD9EB] text-[#050507] rounded-lg hover:brightness-110 cursor-pointer whitespace-nowrap"
                >
                  Exit Display
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setView('queue');
                    setIsDisplayMode(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0C0C10] border border-[#1E1E28] text-white rounded-lg hover:border-[#3DD9EB] cursor-pointer whitespace-nowrap"
                >
                  <Monitor className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Display Mode</span>
                </button>
                <button
                  type="button"
                  onClick={handleFullscreen}
                  aria-label="Fullscreen"
                  className="p-2 text-xs bg-[#0C0C10] border border-[#1E1E28] text-[#8E8E9E] hover:text-white rounded-lg cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="px-3 py-1.5 text-xs font-medium text-[#8E8E9E] hover:text-white border border-[#1E1E28] rounded-lg cursor-pointer whitespace-nowrap"
                >
                  Sign Out
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {actionError && (
          <div
            role="alert"
            className="mb-4 px-4 py-2.5 rounded-xl bg-[#FF6FB5]/10 border border-[#FF6FB5]/40 text-xs text-[#FF6FB5] flex items-center justify-between gap-3"
          >
            <span className="break-words">{actionError}</span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="text-white hover:underline shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {(isDisplayMode || view === 'queue') && (
          <QueueBoardView
            stall={stall}
            isDisplayMode={isDisplayMode}
            onAddQueue={(gameId, name, party) =>
              runAction(async () => {
                const game = stall.games.find((g) => g.id === gameId);
                if (!game) throw new Error('Game not found');
                const waitLen = stall.queues[gameId]?.wait.length ?? 0;
                await addToQueue(activeStallId, game, name, party, waitLen);
              })
            }
            onTogglePaid={async (gameId, entryId, paid) => {
              const game = stall.games.find((g) => g.id === gameId);
              const q = stall.queues[gameId];
              if (!game || !q) return;
              const isNowSlot = q.now?.id === entryId;
              const target = isNowSlot ? q.now : q.wait.find((e) => e.id === entryId);
              if (!target) return;

              const prev = stall;
              setActionError(null);
              setStall((curr) => {
                if (!curr) return curr;
                const st = curr.queues[gameId];
                if (!st) return curr;
                return {
                  ...curr,
                  queues: {
                    ...curr.queues,
                    [gameId]: {
                      ...st,
                      now: st.now?.id === entryId ? { ...st.now, paid } : st.now,
                      wait: st.wait.map((entry) =>
                        entry.id === entryId ? { ...entry, paid } : entry,
                      ),
                    },
                  },
                };
              });

              try {
                await setQueuePaid(activeStallId, game, target, isNowSlot, q.now, paid);
              } catch (err) {
                setStall(prev);
                setActionError(err instanceof Error ? err.message : 'Unable to update payment.');
                throw err;
              }
            }}
            onMoveUp={(gameId, entryId) =>
              runAction(async () => {
                const waitList = stall.queues[gameId]?.wait ?? [];
                await moveQueueUp(activeStallId, gameId, waitList, entryId);
              })
            }
            onRemoveEntry={(gameId, entryId) =>
              runAction(() => removeFromQueue(activeStallId, gameId, entryId))
            }
            onCallNext={(gameId) =>
              runAction(async () => {
                const firstWait = stall.queues[gameId]?.wait[0];
                await callNextPlayer(activeStallId, gameId, firstWait);
              })
            }
            onFinishTurn={(gameId, nextAfter) =>
              runAction(async () => {
                const nextWait = nextAfter ? stall.queues[gameId]?.wait[0] : undefined;
                await finishTurn(activeStallId, gameId, nextWait);
              })
            }
            onUpdateTurn={(gameId, turn) =>
              runAction(() => updateTurnMinutes(activeStallId, gameId, turn))
            }
            onAddGame={(input) =>
              runAction(() => createStationGame(activeStallId, input))
            }
            onUpdateGame={(gameId, patch) =>
              runAction(() => updateStationGame(activeStallId, gameId, patch))
            }
            onDeleteGame={(gameId) =>
              runAction(async () => {
                const waitList = stall.queues[gameId]?.wait ?? [];
                await deleteStationGame(activeStallId, gameId, waitList);
              })
            }
            onResetDay={() =>
              runAction(() => resetQueuesForDay(activeStallId, stall.games, stall.queues))
            }
          />
        )}

        {!isDisplayMode && view === 'analytics' && <AnalyticsView stall={stall} />}

        {!isDisplayMode && view === 'ledger' && (
          <CustomerLogView
            stall={stall}
            onAddDirectSale={(params) =>
              runAction(async () => {
                const game = stall.games.find((g) => g.id === params.gameId);
                if (!game) throw new Error('Game not found');
                await createDirectSale(activeStallId, game, params);
              })
            }
            onRefundSale={(saleId) =>
              runAction(() => refundSaleById(activeStallId, saleId))
            }
            onDeleteSale={(saleId) =>
              runAction(() => deleteSaleById(activeStallId, saleId))
            }
          />
        )}

        {!isDisplayMode && view === 'settings' && (
          <StallSettingsView
            stall={stall}
            onSaveSettings={(params) =>
              runAction(() => updateStallSettings(activeStallId, params))
            }
            onUpdateGame={(gameId, patch) =>
              runAction(() => updateStationGame(activeStallId, gameId, patch))
            }
            onDeleteGame={(gameId) =>
              runAction(async () => {
                const waitList = stall.queues[gameId]?.wait ?? [];
                await deleteStationGame(activeStallId, gameId, waitList);
              })
            }
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <StallApp />
    </ErrorBoundary>
  );
}
