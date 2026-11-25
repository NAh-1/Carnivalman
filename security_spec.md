# Security Specification: RushBox & GamingZone Cloud Ledger

## 1. Data Invariants
1. **Strict Stall Account Isolation**: Only `rushbox` (`rushbox@stall.local`) and `gamingzone` (`gamingzone@stall.local`) exist as valid stall IDs. Every read, list, create, update, and delete under `/stalls/{stallId}` requires `request.auth != null`, `request.auth.token.email == (stallId + '@stall.local')`, and `ownerId == request.auth.uid`.
2. **Master Gate Integrity**: Subcollections `/stalls/{stallId}/games/{gameId}`, `/stalls/{stallId}/games/{gameId}/queue/{entryId}`, and `/stalls/{stallId}/sales/{saleId}` verify parent stall ownership via `get(/databases/$(database)/documents/stalls/$(stallId)).data.ownerId == request.auth.uid` on single-document operations and verify `resource.data.ownerId == request.auth.uid && resource.data.stallId == stallId` on `list` queries without `get()` loops.
3. **Immutable Ownership & Timestamps**: `ownerId`, `stallId`, `gameId`, and `createdAt` cannot change after creation. `createdAt == request.time` on create and `updatedAt == request.time` on create/update.
4. **Terminal Refund Lock**: A `SaleRecord` with `status == 'refunded'` is terminal and cannot be modified back to `completed`.
5. **Strict Schema & Volumetric Bounds**: All writes enforce `hasAll` + `hasOnly` on create, `affectedKeys().hasOnly(...)` on update, `isValidId` (`^[a-zA-Z0-9_\-]+$`, 1..128 chars), string length limits, bounded numeric ranges, and bounded `items` array (`1..20`).

## 2. The "Dirty Dozen" Attack Payloads
1. **Cross-Stall Read / List**: `gamingzone` user reads `/stalls/rushbox` or queries `/stalls/rushbox/sales` -> `PERMISSION_DENIED`.
2. **Unauthenticated Access**: Request with `request.auth == null` attempts read/write -> `PERMISSION_DENIED`.
3. **Identity Spoofing on Stall Create**: User creates `/stalls/rushbox` with `ownerId: 'other_uid'` -> `PERMISSION_DENIED`.
4. **Orphaned Queue / Sale Injection**: User writes `/stalls/rushbox/games/g1/queue/q1` when parent `/stalls/rushbox/games/g1` does not exist -> `PERMISSION_DENIED`.
5. **Shadow Field Injection on Create**: Create `GameStation` with extra field `isAdmin: true` -> `PERMISSION_DENIED`.
6. **Shadow Update on GameStation**: Update `GameStation` with `ownerId: 'uid_b'` -> `PERMISSION_DENIED`.
7. **ID Poisoning**: Write to `/stalls/invalid_stall/sales/s1` or 500-char doc ID -> `PERMISSION_DENIED`.
8. **Type / Bounds Poisoning**: Create `GameStation` with `price: -50` or `turn: 999` or 500-char `name` -> `PERMISSION_DENIED`.
9. **Unbounded Array / Denial of Wallet**: Submit `SaleRecord` with `items: []` or 25 items -> `PERMISSION_DENIED`.
10. **Timestamp Forgery**: Submit `createdAt` not equal to `request.time` -> `PERMISSION_DENIED`.
11. **Terminal Refund Reversal**: Update a `refunded` sale back to `completed` -> `PERMISSION_DENIED`.
12. **Stall ID Mismatch**: Write `/stalls/rushbox/sales/s1` with `stallId: 'gamingzone'` -> `PERMISSION_DENIED`.
