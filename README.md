# RushBox & GamingZone — Stall Queue & Sales

Minimalistic dark queue board, real-time customer Display Mode, sales report, rush-time analytics, and transaction ledger for the **RushBox** and **GamingZone** gaming stalls, backed by Firebase Auth and Cloud Firestore.

## Features

- **Isolated Stall Dashboards**: Password-protected access for `rushbox` and `gamingzone` using Firebase Auth and per-stall Firestore security rules.
- **Queue & Turn Timers**: Add players/groups, mark paid, reorder or call next, edit games/prices/durations, and sync live across devices.
- **Display Mode**: Fullscreen public view showing `NEXT UP` (player, game, wait countdown) and real-time queue wait estimates per station.
- **Sales Report & Rush Analytics**: Real revenue metrics, hourly rush chart, 5-day rush matrix, game breakdown, payment split, and CSV export.
- **Transaction Ledger**: Quick walk-up sales, search, refunds, and CSV export.

## Setup & Deployment

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure Firebase:
   - Firebase client config is loaded from `firebase-applet-config.json` (which contains public client identifiers; access is enforced by `firestore.rules` and Firebase Auth).
   - In **Firebase Console → Authentication → Sign-in method**, enable **Email/Password**.
   - Deploy `firestore.rules` to your Firestore database.
   - Optionally restrict the public browser API key in Google Cloud Console to your Vercel/app domains.

3. Start development server:
   ```bash
   npm run dev
   ```

4. Build for production (Vercel auto-detects Vite and outputs `dist/`):
   ```bash
   npm run build
   ```

5. Run tests and typecheck:
   ```bash
   npm run lint
   npx tsx --test src/utils/analytics.test.ts src/utils/queueDisplay.test.ts
   npx eslint firestore.rules
   ```
