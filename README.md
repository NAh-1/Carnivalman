# RushBox & GamingZone — Stall Queue & Sales

Minimalistic dark queue board, real-time customer Display Mode, sales report, rush-time analytics, and transaction ledger for the **RushBox** and **GamingZone** gaming stalls, backed by Firebase Auth and Cloud Firestore.

## Features

- **Isolated Stall Dashboards**: Password-protected access for `rushbox` and `gamingzone` using Firebase Auth and per-stall Firestore security rules.
- **Queue & Turn Timers**: Add players/groups, mark paid, reorder or call next, edit games/prices/durations, and sync live across devices.
- **Display Mode**: Fullscreen public view showing `NEXT UP` (player, game, wait countdown) and real-time queue wait estimates per station.
- **Sales Report & Rush Analytics**: Real revenue metrics, hourly rush chart, 5-day rush matrix, game breakdown, payment split, and CSV export.
- **Transaction Ledger**: Quick walk-up sales, search, refunds, and CSV export.

## Deploying on Vercel (with Environment Variables)

`firebase-applet-config.json` is gitignored so no config/keys are pushed to GitHub. In your **Vercel Project Settings → Environment Variables**, add:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_DATABASE_ID` (`ai-studio-f466c1fa-6217-4ca3-84c0-615742805033` for the provisioned Firestore database, or `(default)`)

Also ensure **Email/Password** sign-in is enabled in **Firebase Console → Authentication → Sign-in method** and `firestore.rules` is deployed.

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env.local` from `.env.example` and fill in your `VITE_FIREBASE_*` values (or use a local `firebase-applet-config.json`).

3. Start development server:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```

5. Run tests and typecheck:
   ```bash
   npm run lint
   npx tsx --test src/utils/analytics.test.ts src/utils/queueDisplay.test.ts
   npx eslint firestore.rules
   ```
