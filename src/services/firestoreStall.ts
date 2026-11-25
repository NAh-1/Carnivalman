import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import type {
  GameStationConfig,
  PaymentMethod,
  QueueEntry,
  SaleRecord,
  StallId,
  StallState,
  StationQueueState,
} from '../types/stall';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface StationGameInput {
  name: string;
  gear: string;
  price: number;
  unit: string;
  turn: number;
  team: boolean;
}

interface ActiveNowDoc {
  id: string;
  name: string;
  party: number;
  paid: boolean;
  saleId: string;
  startedAt: number;
}

interface GameStationDoc {
  stallId: StallId;
  ownerId: string;
  name: string;
  gear: string;
  price: number;
  unit: string;
  turn: number;
  team: boolean;
  sortOrder: number;
  now: ActiveNowDoc | null;
}

interface QueueEntryDoc {
  stallId: StallId;
  ownerId: string;
  gameId: string;
  name: string;
  party: number;
  paid: boolean;
  saleId: string;
  position: number;
}

interface SaleRecordDoc {
  stallId: StallId;
  ownerId: string;
  customerLabel: string;
  partySize: number;
  items: { itemId: string; name: string; qty: number; unitPrice: number }[];
  totalAmount: number;
  paymentMethod: PaymentMethod;
  status: 'completed' | 'refunded';
  occurredAt: Timestamp | number | Date;
  createdAt?: Timestamp | number | Date;
  updatedAt?: Timestamp | number | Date;
}

function stallEmail(stallId: StallId): string {
  return `${stallId}@stall.local`;
}

export function stallIdFromEmail(email: string | null | undefined): StallId | null {
  if (!email) return null;
  const lower = email.toLowerCase();
  if (lower === 'rushbox@stall.local') return 'rushbox';
  if (lower === 'gamingzone@stall.local') return 'gamingzone';
  return null;
}

function makeDocId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function toMillis(val: Timestamp | number | Date | undefined): number {
  if (typeof val === 'number') return val;
  if (val instanceof Timestamp) return val.toMillis();
  if (val instanceof Date) return val.getTime();
  return Date.now();
}

function getUidOrThrow(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('Authentication required');
  }
  return uid;
}

function defaultGamesForStall(stallId: StallId): Array<StationGameInput & { id: string; sortOrder: number }> {
  if (stallId === 'gamingzone') {
    return [
      { id: 'nohesi', name: 'No Hesi', gear: 'PC + racing wheel', turn: 5, team: false, unit: 'per run', price: 5, sortOrder: 1 },
      { id: 'fc26', name: 'FC 26', gear: 'PS5', turn: 9, team: true, unit: 'per person', price: 5, sortOrder: 2 },
      { id: 'rocket', name: 'Rocket League', gear: 'Gaming laptop', turn: 6, team: false, unit: 'per match', price: 5, sortOrder: 3 },
    ];
  }
  return [
    { id: 'rb-sim', name: 'Assetto Corsa', gear: 'Sim Rig + Wheel', turn: 6, team: false, unit: 'per race', price: 5, sortOrder: 1 },
    { id: 'rb-tekken', name: 'Tekken 8', gear: 'PS5 · 2 Pads', turn: 5, team: true, unit: 'per person', price: 5, sortOrder: 2 },
    { id: 'rb-vr', name: 'VR Beat Saber', gear: 'Meta Quest 3', turn: 7, team: false, unit: 'per run', price: 5, sortOrder: 3 },
  ];
}

export async function signInStallWithPassword(stallId: StallId, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, stallEmail(stallId), password);
}

export async function claimStallWithPassword(stallId: StallId, password: string): Promise<void> {
  await createUserWithEmailAndPassword(auth, stallEmail(stallId), password);
}

export async function signOutStall(): Promise<void> {
  await signOut(auth);
}

export function subscribeStallAuth(
  onChange: (session: { stallId: StallId; uid: string } | null) => void,
): () => void {
  return onAuthStateChanged(auth, (user) => {
    const stallId = stallIdFromEmail(user?.email);
    if (user && stallId) {
      onChange({ stallId, uid: user.uid });
    } else {
      onChange(null);
    }
  });
}

export async function ensureStallInitialized(stallId: StallId, uid: string): Promise<void> {
  const stallPath = `stalls/${stallId}`;
  const stallRef = doc(db, 'stalls', stallId);
  let stallExists = false;

  try {
    const snap = await getDoc(stallRef);
    stallExists = snap.exists();
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, stallPath);
  }

  if (!stallExists) {
    try {
      await setDoc(stallRef, {
        stallId,
        ownerId: uid,
        displayName: stallId === 'rushbox' ? 'RushBox' : 'GamingZone',
        currency: 'QR',
        dailyGoal: stallId === 'rushbox' ? 350 : 300,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, stallPath);
    }
  }

  const gamesPath = `stalls/${stallId}/games`;
  try {
    const gamesQuery = query(
      collection(db, 'stalls', stallId, 'games'),
      where('ownerId', '==', uid),
      where('stallId', '==', stallId),
    );
    const gamesSnap = await getDocs(gamesQuery);
    if (gamesSnap.empty && !stallExists) {
      const batch = writeBatch(db);
      for (const template of defaultGamesForStall(stallId)) {
        batch.set(doc(db, 'stalls', stallId, 'games', template.id), {
          stallId,
          ownerId: uid,
          name: template.name,
          gear: template.gear,
          price: template.price,
          unit: template.unit,
          turn: template.turn,
          team: template.team,
          sortOrder: template.sortOrder,
          now: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, gamesPath);
  }
}

export function subscribeStallRealtime(
  stallId: StallId,
  uid: string,
  onState: (state: StallState) => void,
  onConnectionChange: (connected: boolean) => void,
  onError: (err: Error) => void,
): () => void {
  let stallMeta: {
    displayName: string;
    currency: string;
    dailyGoal: number;
    updatedAt: number;
  } | null = null;
  let gamesDocs: Array<{ id: string; data: GameStationDoc }> = [];
  const queuesByGame = new Map<string, QueueEntry[]>();
  const queueUnsubs = new Map<string, Unsubscribe>();
  let salesList: SaleRecord[] = [];
  let loadedStall = false;
  let loadedGames = false;
  let loadedSales = false;

  function emitIfReady() {
    if (!loadedStall || !loadedGames || !loadedSales || !stallMeta) return;

    const sortedGames = [...gamesDocs].sort((a, b) => a.data.sortOrder - b.data.sortOrder);
    const games: GameStationConfig[] = sortedGames.map(({ id, data }) => ({
      id,
      name: data.name,
      gear: data.gear,
      turn: data.turn,
      team: data.team,
      unit: data.unit,
      price: data.price,
    }));

    const queues: Record<string, StationQueueState> = {};
    for (const { id, data } of sortedGames) {
      const now: QueueEntry | null = data.now
        ? {
            id: data.now.id,
            name: data.now.name,
            party: data.now.party,
            paid: data.now.paid,
            saleId: data.now.saleId || undefined,
            startedAt: data.now.startedAt,
          }
        : null;
      queues[id] = {
        now,
        wait: queuesByGame.get(id) ?? [],
        turn: data.turn,
      };
    }

    onConnectionChange(true);
    onState({
      stallId,
      displayName: stallMeta.displayName,
      currency: stallMeta.currency,
      dailyGoal: stallMeta.dailyGoal,
      games,
      queues,
      sales: salesList,
      updatedAt: Date.now(),
    });
  }

  const stallRef = doc(db, 'stalls', stallId);
  const unsubStall = onSnapshot(
    stallRef,
    (snap) => {
      if (snap.exists()) {
        const d = snap.data() as {
          displayName: string;
          currency: string;
          dailyGoal: number;
          updatedAt?: Timestamp;
        };
        stallMeta = {
          displayName: d.displayName,
          currency: d.currency,
          dailyGoal: d.dailyGoal,
          updatedAt: toMillis(d.updatedAt),
        };
        loadedStall = true;
        emitIfReady();
      }
    },
    (err) => {
      onConnectionChange(false);
      try {
        handleFirestoreError(err, OperationType.GET, `stalls/${stallId}`);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    },
  );

  const gamesQuery = query(
    collection(db, 'stalls', stallId, 'games'),
    where('ownerId', '==', uid),
    where('stallId', '==', stallId),
  );
  const unsubGames = onSnapshot(
    gamesQuery,
    (snap) => {
      gamesDocs = snap.docs.map((d) => ({
        id: d.id,
        data: d.data() as GameStationDoc,
      }));
      const activeIds = new Set(gamesDocs.map((g) => g.id));

      for (const [existingId, unsub] of queueUnsubs.entries()) {
        if (!activeIds.has(existingId)) {
          unsub();
          queueUnsubs.delete(existingId);
          queuesByGame.delete(existingId);
        }
      }

      for (const { id: gameId } of gamesDocs) {
        if (queueUnsubs.has(gameId)) continue;
        const queuePath = `stalls/${stallId}/games/${gameId}/queue`;
        const qQuery = query(
          collection(db, 'stalls', stallId, 'games', gameId, 'queue'),
          where('ownerId', '==', uid),
          where('stallId', '==', stallId),
        );
        const unsubQ = onSnapshot(
          qQuery,
          (qSnap) => {
            const entries = qSnap.docs
              .map((docSnap) => {
                const qd = docSnap.data() as QueueEntryDoc;
                return {
                  position: qd.position,
                  entry: {
                    id: docSnap.id,
                    name: qd.name,
                    party: qd.party,
                    paid: qd.paid,
                    saleId: qd.saleId || undefined,
                  } satisfies QueueEntry,
                };
              })
              .sort((a, b) => a.position - b.position)
              .map((x) => x.entry);
            queuesByGame.set(gameId, entries);
            emitIfReady();
          },
          (err) => {
            onConnectionChange(false);
            try {
              handleFirestoreError(err, OperationType.LIST, queuePath);
            } catch (wrapped) {
              onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
            }
          },
        );
        queueUnsubs.set(gameId, unsubQ);
      }

      loadedGames = true;
      emitIfReady();
    },
    (err) => {
      onConnectionChange(false);
      try {
        handleFirestoreError(err, OperationType.LIST, `stalls/${stallId}/games`);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    },
  );

  const salesQuery = query(
    collection(db, 'stalls', stallId, 'sales'),
    where('ownerId', '==', uid),
    where('stallId', '==', stallId),
  );
  const unsubSales = onSnapshot(
    salesQuery,
    (snap) => {
      salesList = snap.docs
        .map((docSnap) => {
          const sd = docSnap.data() as SaleRecordDoc;
          return {
            id: docSnap.id,
            stallId: sd.stallId,
            customerLabel: sd.customerLabel,
            partySize: sd.partySize,
            items: sd.items,
            totalAmount: sd.totalAmount,
            paymentMethod: sd.paymentMethod,
            status: sd.status,
            occurredAt: toMillis(sd.occurredAt),
            createdAt: toMillis(sd.createdAt),
            updatedAt: toMillis(sd.updatedAt),
          } satisfies SaleRecord;
        })
        .sort((a, b) => b.occurredAt - a.occurredAt);
      loadedSales = true;
      emitIfReady();
    },
    (err) => {
      onConnectionChange(false);
      try {
        handleFirestoreError(err, OperationType.LIST, `stalls/${stallId}/sales`);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    },
  );

  return () => {
    unsubStall();
    unsubGames();
    unsubSales();
    for (const unsub of queueUnsubs.values()) {
      unsub();
    }
    queueUnsubs.clear();
  };
}

export async function addToQueue(
  stallId: StallId,
  game: GameStationConfig,
  name: string,
  party: number,
  currentWaitLength: number,
): Promise<void> {
  const uid = getUidOrThrow();
  const trimmed = name.trim().slice(0, 40);
  if (!trimmed) throw new Error('Player name is required');
  const clampedParty = game.team ? Math.min(4, Math.max(1, Math.round(party))) : 1;
  const entryId = makeDocId('q');
  const path = `stalls/${stallId}/games/${game.id}/queue/${entryId}`;

  try {
    await setDoc(doc(db, 'stalls', stallId, 'games', game.id, 'queue', entryId), {
      stallId,
      ownerId: uid,
      gameId: game.id,
      name: trimmed,
      party: clampedParty,
      paid: false,
      saleId: '',
      position: Date.now() + currentWaitLength,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function setQueuePaid(
  stallId: StallId,
  game: GameStationConfig,
  entry: QueueEntry,
  isNowSlot: boolean,
  currentNow: QueueEntry | null,
  paid: boolean,
): Promise<void> {
  const uid = getUidOrThrow();
  const batch = writeBatch(db);
  const path = isNowSlot
    ? `stalls/${stallId}/games/${game.id}`
    : `stalls/${stallId}/games/${game.id}/queue/${entry.id}`;

  let nextSaleId = entry.saleId ?? '';

  if (paid && !entry.paid) {
    nextSaleId = makeDocId('sale');
    const units = game.team ? entry.party : 1;
    const total = Math.round(units * game.price * 100) / 100;
    batch.set(doc(db, 'stalls', stallId, 'sales', nextSaleId), {
      stallId,
      ownerId: uid,
      customerLabel: entry.name.slice(0, 60),
      partySize: entry.party,
      items: [
        {
          itemId: game.id,
          name: game.name.slice(0, 60),
          qty: units,
          unitPrice: game.price,
        },
      ],
      totalAmount: total,
      paymentMethod: 'mobile',
      status: 'completed',
      occurredAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else if (!paid && entry.paid) {
    if (entry.saleId) {
      batch.delete(doc(db, 'stalls', stallId, 'sales', entry.saleId));
    }
    nextSaleId = '';
  }

  if (isNowSlot && currentNow) {
    batch.update(doc(db, 'stalls', stallId, 'games', game.id), {
      now: {
        id: currentNow.id,
        name: currentNow.name,
        party: currentNow.party,
        paid,
        saleId: nextSaleId,
        startedAt: currentNow.startedAt ?? Date.now(),
      },
      updatedAt: serverTimestamp(),
    });
  } else {
    batch.update(doc(db, 'stalls', stallId, 'games', game.id, 'queue', entry.id), {
      paid,
      saleId: nextSaleId,
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function moveQueueUp(
  stallId: StallId,
  gameId: string,
  waitList: QueueEntry[],
  entryId: string,
): Promise<void> {
  const idx = waitList.findIndex((e) => e.id === entryId);
  if (idx <= 0) return;

  const reordered = [...waitList];
  const tmp = reordered[idx - 1];
  reordered[idx - 1] = reordered[idx];
  reordered[idx] = tmp;

  const batch = writeBatch(db);
  const base = Date.now();
  reordered.forEach((entry, index) => {
    batch.update(doc(db, 'stalls', stallId, 'games', gameId, 'queue', entry.id), {
      position: base + index * 10,
      updatedAt: serverTimestamp(),
    });
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `stalls/${stallId}/games/${gameId}/queue`);
  }
}

export async function removeFromQueue(
  stallId: StallId,
  gameId: string,
  entryId: string,
): Promise<void> {
  const path = `stalls/${stallId}/games/${gameId}/queue/${entryId}`;
  try {
    await deleteDoc(doc(db, 'stalls', stallId, 'games', gameId, 'queue', entryId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function callNextPlayer(
  stallId: StallId,
  gameId: string,
  firstWaitEntry: QueueEntry | undefined,
): Promise<void> {
  if (!firstWaitEntry) return;
  const batch = writeBatch(db);
  batch.update(doc(db, 'stalls', stallId, 'games', gameId), {
    now: {
      id: firstWaitEntry.id,
      name: firstWaitEntry.name,
      party: firstWaitEntry.party,
      paid: firstWaitEntry.paid,
      saleId: firstWaitEntry.saleId ?? '',
      startedAt: Date.now(),
    },
    updatedAt: serverTimestamp(),
  });
  batch.delete(doc(db, 'stalls', stallId, 'games', gameId, 'queue', firstWaitEntry.id));

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `stalls/${stallId}/games/${gameId}`);
  }
}

export async function finishTurn(
  stallId: StallId,
  gameId: string,
  nextWaitEntry: QueueEntry | undefined,
): Promise<void> {
  const batch = writeBatch(db);
  if (nextWaitEntry) {
    batch.update(doc(db, 'stalls', stallId, 'games', gameId), {
      now: {
        id: nextWaitEntry.id,
        name: nextWaitEntry.name,
        party: nextWaitEntry.party,
        paid: nextWaitEntry.paid,
        saleId: nextWaitEntry.saleId ?? '',
        startedAt: Date.now(),
      },
      updatedAt: serverTimestamp(),
    });
    batch.delete(doc(db, 'stalls', stallId, 'games', gameId, 'queue', nextWaitEntry.id));
  } else {
    batch.update(doc(db, 'stalls', stallId, 'games', gameId), {
      now: null,
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `stalls/${stallId}/games/${gameId}`);
  }
}

export async function updateTurnMinutes(
  stallId: StallId,
  gameId: string,
  turn: number,
): Promise<void> {
  const rounded = Math.round(turn);
  if (!Number.isFinite(rounded) || rounded < 1 || rounded > 90) {
    throw new Error('Turn minutes must be 1 to 90');
  }
  const path = `stalls/${stallId}/games/${gameId}`;
  try {
    await updateDoc(doc(db, 'stalls', stallId, 'games', gameId), {
      turn: rounded,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function createStationGame(
  stallId: StallId,
  input: StationGameInput,
): Promise<void> {
  const uid = getUidOrThrow();
  const name = input.name.trim().slice(0, 40);
  if (!name) throw new Error('Game name is required');
  const gear = input.gear.trim().slice(0, 50) || 'Station';
  const unit = input.unit.trim().slice(0, 20) || (input.team ? 'per person' : 'per run');
  const price = Math.round(Number(input.price) * 100) / 100;
  if (!Number.isFinite(price) || price < 0 || price > 10000) {
    throw new Error('Price must be between 0 and 10000');
  }
  const turn = Math.round(Number(input.turn));
  if (!Number.isFinite(turn) || turn < 1 || turn > 90) {
    throw new Error('Minutes per turn must be 1 to 90');
  }

  const gameId = makeDocId('game');
  const path = `stalls/${stallId}/games/${gameId}`;
  try {
    await setDoc(doc(db, 'stalls', stallId, 'games', gameId), {
      stallId,
      ownerId: uid,
      name,
      gear,
      price,
      unit,
      turn,
      team: Boolean(input.team),
      sortOrder: Date.now(),
      now: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateStationGame(
  stallId: StallId,
  gameId: string,
  patch: Partial<StationGameInput>,
): Promise<void> {
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (typeof patch.name === 'string') {
    const name = patch.name.trim().slice(0, 40);
    if (!name) throw new Error('Game name is required');
    payload.name = name;
  }
  if (typeof patch.gear === 'string') {
    payload.gear = patch.gear.trim().slice(0, 50) || 'Station';
  }
  if (typeof patch.unit === 'string') {
    const u = patch.unit.trim().slice(0, 20);
    if (u) payload.unit = u;
  }
  if (patch.price !== undefined) {
    const price = Math.round(Number(patch.price) * 100) / 100;
    if (!Number.isFinite(price) || price < 0 || price > 10000) {
      throw new Error('Price must be between 0 and 10000');
    }
    payload.price = price;
  }
  if (patch.turn !== undefined) {
    const turn = Math.round(Number(patch.turn));
    if (!Number.isFinite(turn) || turn < 1 || turn > 90) {
      throw new Error('Minutes per turn must be 1 to 90');
    }
    payload.turn = turn;
  }
  if (typeof patch.team === 'boolean') {
    payload.team = patch.team;
  }

  const path = `stalls/${stallId}/games/${gameId}`;
  try {
    await updateDoc(doc(db, 'stalls', stallId, 'games', gameId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteStationGame(
  stallId: StallId,
  gameId: string,
  waitEntries: QueueEntry[],
): Promise<void> {
  const batch = writeBatch(db);
  for (const entry of waitEntries) {
    batch.delete(doc(db, 'stalls', stallId, 'games', gameId, 'queue', entry.id));
  }
  batch.delete(doc(db, 'stalls', stallId, 'games', gameId));

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `stalls/${stallId}/games/${gameId}`);
  }
}

export async function resetQueuesForDay(
  stallId: StallId,
  games: GameStationConfig[],
  queues: Record<string, StationQueueState>,
): Promise<void> {
  const batch = writeBatch(db);
  for (const game of games) {
    const q = queues[game.id];
    if (q?.now) {
      batch.update(doc(db, 'stalls', stallId, 'games', game.id), {
        now: null,
        updatedAt: serverTimestamp(),
      });
    }
    for (const entry of q?.wait ?? []) {
      batch.delete(doc(db, 'stalls', stallId, 'games', game.id, 'queue', entry.id));
    }
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `stalls/${stallId}/games`);
  }
}

export async function createDirectSale(
  stallId: StallId,
  game: GameStationConfig,
  params: {
    customerLabel: string;
    partySize: number;
    paymentMethod: PaymentMethod;
  },
): Promise<void> {
  const uid = getUidOrThrow();
  const party = Math.max(1, Math.min(20, Math.round(params.partySize)));
  const units = game.team ? party : 1;
  const total = Math.round(units * game.price * 100) / 100;
  const saleId = makeDocId('sale');
  const path = `stalls/${stallId}/sales/${saleId}`;

  try {
    await setDoc(doc(db, 'stalls', stallId, 'sales', saleId), {
      stallId,
      ownerId: uid,
      customerLabel: params.customerLabel.trim().slice(0, 60) || 'Walk-up',
      partySize: party,
      items: [
        {
          itemId: game.id,
          name: game.name.slice(0, 60),
          qty: units,
          unitPrice: game.price,
        },
      ],
      totalAmount: total,
      paymentMethod: params.paymentMethod,
      status: 'completed',
      occurredAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function refundSaleById(stallId: StallId, saleId: string): Promise<void> {
  const path = `stalls/${stallId}/sales/${saleId}`;
  try {
    await updateDoc(doc(db, 'stalls', stallId, 'sales', saleId), {
      status: 'refunded',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteSaleById(stallId: StallId, saleId: string): Promise<void> {
  const path = `stalls/${stallId}/sales/${saleId}`;
  try {
    await deleteDoc(doc(db, 'stalls', stallId, 'sales', saleId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function updateStallSettings(
  stallId: StallId,
  params: { dailyGoal?: number; currency?: string },
): Promise<void> {
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (
    typeof params.dailyGoal === 'number' &&
    Number.isFinite(params.dailyGoal) &&
    params.dailyGoal >= 0 &&
    params.dailyGoal <= 1000000
  ) {
    payload.dailyGoal = Math.round(params.dailyGoal);
  }
  if (typeof params.currency === 'string' && params.currency.trim().length > 0) {
    payload.currency = params.currency.trim().slice(0, 5);
  }

  const path = `stalls/${stallId}`;
  try {
    await updateDoc(doc(db, 'stalls', stallId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}
