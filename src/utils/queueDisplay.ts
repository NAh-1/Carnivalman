import type { GameStationConfig, StationQueueState } from '../types/stall';

export interface NextUpItem {
  entryId: string;
  playerName: string;
  party: number;
  gameId: string;
  gameName: string;
  team: boolean;
  waitSeconds: number;
  isReadyNow: boolean;
  stationBusy: boolean;
}

export function computeRemainingPlaySeconds(
  queue: StationQueueState | undefined,
  nowMs: number,
  fallbackTurnMinutes: number,
): number {
  const turnMin = queue?.turn ?? fallbackTurnMinutes;
  if (!queue?.now?.startedAt) {
    return turnMin * 60;
  }
  const elapsed = Math.max(0, (nowMs - queue.now.startedAt) / 1000);
  return turnMin * 60 - elapsed;
}

export function computeQueueWaitSeconds(
  queue: StationQueueState | undefined,
  nowMs: number,
  positionIndex: number,
  fallbackTurnMinutes: number,
): number {
  const turnMin = queue?.turn ?? fallbackTurnMinutes;
  const activeRemaining = queue?.now
    ? Math.max(0, computeRemainingPlaySeconds(queue, nowMs, turnMin))
    : 0;
  const idx = Math.max(0, positionIndex);
  return Math.max(0, Math.ceil(activeRemaining + idx * turnMin * 60));
}

export function formatWaitDuration(waitSeconds: number, stationBusy: boolean): string {
  const clamped = Math.max(0, Math.ceil(waitSeconds));
  if (clamped === 0) {
    return stationBusy ? 'Up right now' : 'Ready now';
  }
  if (clamped < 60) {
    return `${clamped}s wait`;
  }
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs} wait`;
}

export function computeGlobalNextUp(
  games: GameStationConfig[],
  queues: Record<string, StationQueueState>,
  nowMs: number,
): NextUpItem[] {
  const items: NextUpItem[] = [];

  for (const game of games) {
    const q = queues[game.id];
    if (!q || q.wait.length === 0) continue;

    q.wait.forEach((entry, idx) => {
      const waitSeconds = computeQueueWaitSeconds(q, nowMs, idx, game.turn);
      const stationBusy = Boolean(q.now);
      items.push({
        entryId: entry.id,
        playerName: entry.name,
        party: entry.party,
        gameId: game.id,
        gameName: game.name,
        team: game.team,
        waitSeconds,
        isReadyNow: !stationBusy && idx === 0,
        stationBusy,
      });
    });
  }

  return items.sort((a, b) => {
    if (a.isReadyNow !== b.isReadyNow) return a.isReadyNow ? -1 : 1;
    if (a.waitSeconds !== b.waitSeconds) return a.waitSeconds - b.waitSeconds;
    return a.gameName.localeCompare(b.gameName);
  });
}
