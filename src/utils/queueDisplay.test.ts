import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeGlobalNextUp,
  computeQueueWaitSeconds,
  computeRemainingPlaySeconds,
  formatWaitDuration,
} from './queueDisplay';
import type { GameStationConfig, StationQueueState } from '../types/stall';

const games: GameStationConfig[] = [
  { id: 'nohesi', name: 'No Hesi', gear: 'PC + Wheel', turn: 5, team: false, unit: 'per run', price: 5 },
  { id: 'fc26', name: 'FC 26', gear: 'PS5', turn: 9, team: true, unit: 'per person', price: 5 },
];

test('computeQueueWaitSeconds computes exact wait across active player and queue depth', () => {
  const nowMs = 1_700_000_000_000;
  const activeQueue: StationQueueState = {
    turn: 5,
    now: { id: 'q1', name: 'Ali', party: 1, paid: true, startedAt: nowMs - 120_000 }, // 3 min left
    wait: [
      { id: 'q2', name: 'Sara', party: 1, paid: false },
      { id: 'q3', name: 'Zaid', party: 1, paid: false },
    ],
  };

  assert.equal(computeRemainingPlaySeconds(activeQueue, nowMs, 5), 180);
  assert.equal(computeRemainingPlaySeconds(activeQueue, nowMs - 200_000, 5), 300);
  assert.equal(computeQueueWaitSeconds(activeQueue, nowMs, 0, 5), 180);
  assert.equal(computeQueueWaitSeconds(activeQueue, nowMs, 1, 5), 480);

  const freeQueue: StationQueueState = {
    turn: 9,
    now: null,
    wait: [{ id: 'q4', name: 'Omar', party: 2, paid: false }],
  };
  assert.equal(computeQueueWaitSeconds(freeQueue, nowMs, 0, 9), 0);
});

test('computeGlobalNextUp prioritizes ready-now stations and sorts shortest wait first', () => {
  const nowMs = 1_700_000_000_000;
  const queues: Record<string, StationQueueState> = {
    nohesi: {
      turn: 5,
      now: { id: 'q1', name: 'Ali', party: 1, paid: true, startedAt: nowMs - 60_000 }, // 4 min left
      wait: [{ id: 'q2', name: 'Sara', party: 1, paid: false }],
    },
    fc26: {
      turn: 9,
      now: null,
      wait: [
        { id: 'q3', name: 'Omar', party: 2, paid: false },
        { id: 'q4', name: 'Kareem', party: 2, paid: false },
      ],
    },
  };

  const nextUp = computeGlobalNextUp(games, queues, nowMs);
  assert.equal(nextUp.length, 3);
  assert.equal(nextUp[0].playerName, 'Omar');
  assert.equal(nextUp[0].gameName, 'FC 26');
  assert.equal(nextUp[0].isReadyNow, true);
  assert.equal(nextUp[0].waitSeconds, 0);

  assert.equal(nextUp[1].playerName, 'Sara');
  assert.equal(nextUp[1].gameName, 'No Hesi');
  assert.equal(nextUp[1].waitSeconds, 240);

  assert.equal(nextUp[2].playerName, 'Kareem');
  assert.equal(nextUp[2].waitSeconds, 540);
});

test('formatWaitDuration formats ready, seconds, and MM:SS wait cleanly', () => {
  assert.equal(formatWaitDuration(0, false), 'Ready now');
  assert.equal(formatWaitDuration(0, true), 'Up right now');
  assert.equal(formatWaitDuration(45, true), '45s wait');
  assert.equal(formatWaitDuration(240, true), '4:00 wait');
});
