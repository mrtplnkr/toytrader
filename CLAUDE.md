# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ToyTrader — a React + TypeScript + Firebase app for trading toys: list toys you own, browse other users' toys, and propose/accept trade offers. Bootstrapped with Create React App.

## Commands

Run from the repo root for the frontend; `functions/` is a separate TypeScript package with its own `package.json`/`node_modules`.

- `npm start` — dev server at http://localhost:3000
- `npm run build` — production build to `build/` (this is what gets deployed to Firebase Hosting)
- `npm test` — CRA/Jest test runner in interactive watch mode
- `npm test -- --watchAll=false` — run tests once (CI mode)
- `npm test -- -t "<name>"` — run a single test by name
- There is no lint script wired up; ESLint runs implicitly via `react-scripts` (config: `eslintConfig` in [package.json](package.json), extends `react-app`).

**`functions/`** (Cloud Functions, TypeScript):
- `npm --prefix functions run build` — compiles `functions/src` → `functions/lib` via `tsc` (also runs automatically as a `predeploy` hook on `firebase deploy --only functions`, see [firebase.json](firebase.json))
- `npx eslint src --ext .ts` (run from `functions/`) — lint the functions source
- `firebase deploy --only functions` — deploy (requires Firebase CLI auth and project access; not automated via CI)

**Local Stripe/Omniva dev loop:**
1. `firebase emulators:start` — starts auth/firestore/storage/functions/hosting emulators on their standard default ports ([firebase.json](firebase.json): auth 9099, firestore 8080, storage 9199, functions 5001, hosting 5000, UI 4000) — requires a local Java install for the Firestore emulator. These are deliberately Firebase's standard ports, not CRA's default 3000, so `npm start` and the emulators can run side by side.
2. Put test-mode values in a gitignored `functions/.secret.local` (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) — this is how `defineSecret` values resolve locally; without it, emulator startup blocks on an interactive prompt for each declared secret.
3. `stripe listen --forward-to http://127.0.0.1:5001/<project-id>/europe-west1/stripeWebhook` (Stripe CLI) to forward `checkout.session.completed` events to the emulator; use the printed `whsec_...` as `STRIPE_WEBHOOK_SECRET`.
4. Omniva has no real integration yet — `OMNIVA_MODE` defaults to `stub` ([functions/src/omniva.ts](functions/src/omniva.ts)), so the full pay → barcode flow works locally with zero Omniva credentials.

Firebase emulators (auth/firestore/storage/hosting/ui/functions) are configured in [firebase.json](firebase.json) — `firebase emulators:start` if the Firebase CLI is installed.

**End-to-end tests** ([e2e/](e2e/), Playwright): `npm run test:e2e` runs [e2e/toy-swap.spec.ts](e2e/toy-swap.spec.ts) — two real browser contexts sign in via the Auth Emulator's fake Google IDP widget ([e2e/helpers/auth.ts](e2e/helpers/auth.ts)), list toys, trade, and accept, all against a real Firestore/Storage/Auth emulator (`playwright.config.ts`'s `webServer` starts both the emulator suite and `npm start`, pointed at each other via `REACT_APP_USE_FIREBASE_EMULATORS=true` — see the emulator-connect block in [src/firebase-config.ts](src/firebase-config.ts)). Since there are no real Stripe test keys yet, the `startShipmentCheckout` network call is mocked at the Playwright layer instead of hitting real Stripe; the mock also writes the shipment/barcode fields straight to the Firestore emulator via the Admin SDK ([e2e/helpers/adminSeed.ts](e2e/helpers/adminSeed.ts)) — exactly what the real `stripeWebhook` function would do once payment succeeds — so the test still exercises the real QR-code UI. **Requires Java** (for the Firestore emulator) and `npx playwright install chromium` once.

## Deployment

GitHub Actions ([.github/workflows/](.github/workflows/)) auto-deploy to Firebase Hosting:
- `firebase-hosting-merge.yml` — deploys to live on push to `master`
- `firebase-hosting-pull-request.yml` — builds and deploys a PR preview channel

Both require repo secrets and are not something to trigger manually from local dev.

## Architecture

**Single global context, no reducer/store library.** [src/App.tsx](src/App.tsx)'s `StateProvider` holds all toys and the current user's offers in React state and exposes them (plus `refresh` and `signOut`) via `GoodAppContext` ([src/hooks/context.ts](src/hooks/context.ts)), built with `use-context-selector` so consumers subscribe to individual fields instead of the whole context re-rendering. Components read from it with `useContextSelector(GoodAppContext, state => state.x)` rather than plain `useContext`.

**All Firebase access goes through [src/hooks/helper.ts](src/hooks/helper.ts).** This one file is the entire data layer: auth (Google/Facebook sign-in via popup, sign-out), Firestore reads/writes for the `toys` and `offers` collections, and resolving toy images out of Firebase Storage (`projectFiles/{file}` → download URL). There's no repository/service class per entity — new data operations should be added here following the existing flat function-per-operation style (`addNewToy`, `getToyList`, `addNewOffer`, `getOfferList`, `updateOffer`, ...).

**Auth gating happens per-route in [src/App.tsx](src/App.tsx)**, not via a layout-level guard: a local `RequireAuth(children)` component wraps individual `<Route>` elements and redirects to `/login` if `auth.onAuthStateChanged` resolves to no user. Routes: `/` (public), `/login`, and the auth-gated `/list`, `/myToys`, `/myOffers`, `/history`, `/addNew`, `/shipment/result`.

**Domain model is two Firestore collections**, typed in [src/types/toy.ts](src/types/toy.ts) and [src/types/offer.ts](src/types/offer.ts):
- `toys` — `{ title, file, userId }`, where `file` is a Storage object name resolved to a download URL on read.
- `offers` — links a `toyOffered` to a `toyTargeted` between `userInitiated` and `userReceived`, with a state machine of optional timestamp fields tracking the trade's progress through creation → acceptance → shipping both directions: `offerAccepted`, then `offerPosted`/`offerReceived` (the `toyOffered` shipment, initiator's job) and `targetPosted`/`targetReceived` (the `toyTargeted` shipment, receiver's job) once each side has *physically* dropped the toy off. Firestore `Timestamp`s are converted to `Date` in `getOfferList` for all of these.

**Shipment payment is a separate, parallel state machine from the fields above** — `offer*`/`target*` still mean "physically posted"; they are never set by payment alone. Each side pays independently (5 EUR via Stripe) to obtain an Omniva parcel-machine barcode before they can post their toy: `offerShipmentPaid`/`offerShipmentStripeSessionId`/`offerShipmentBarcode`/`offerShipmentQrIssuedAt`/`offerShipmentError` for the initiator's shipment, and the `target*` equivalents for the receiver's. These fields are **only ever written by the `stripeWebhook` Cloud Function** via the Admin SDK — [firestore.rules](firestore.rules) has a dedicated `match /offers/{offerId}` block that blocks any client `update` touching them (`diff().affectedKeys().hasAny([...])`), which is the actual security boundary; the client only ever reads them.

Flow: [src/pages/myOffers.tsx](src/pages/myOffers.tsx) shows a "Pay & Get QR Code" button once `offerAccepted` is set and that side hasn't paid, calling `startShipmentCheckout` ([src/hooks/helper.ts](src/hooks/helper.ts)) → the `startShipmentCheckout` callable ([functions/src/shipment.ts](functions/src/shipment.ts)) creates a Stripe Checkout session and redirects the browser to it. Stripe redirects back to `/shipment/result` ([src/pages/shipmentResult.tsx](src/pages/shipmentResult.tsx)), which polls briefly for the barcode (the `stripeWebhook` function runs async, slightly behind the redirect) and renders it as a scannable QR via `qrcode.react`. The actual Omniva API call is behind an `OmnivaClient` abstraction ([functions/src/omniva.ts](functions/src/omniva.ts)) — real credentials/API docs don't exist yet, so it currently always returns a stub barcode (`OMNIVA_MODE` config flag); swapping to the real API later is a config change, not a call-site change.

**Firebase config/keys are committed** in [src/firebase-config.ts](src/firebase-config.ts) (this is standard for Firebase web apps — the client config is not a secret; access control is enforced by [firestore.rules](firestore.rules) and [storage.rules](storage.rules), not by hiding these values). Cloud Functions are pinned to the `europe-west1` region (both the function definitions and the client's `getFunctions(app, 'europe-west1')` call) — Omniva is Baltic and payment data should stay in-EU; moving a deployed function's region later requires delete+recreate, so don't change this casually.

**Security rules are mostly permissive, with one carve-out**: any authenticated user (`request.auth.uid != null`) can read/write any document in most Firestore collections and any object in Storage — there is no per-user or per-document ownership check for `toys`, for instance. The `offers` collection is the one exception (see above): reads/creates are still open, but client updates to the payment/shipment fields are rejected. Don't treat client-side filtering (e.g. by `userId`) as a security boundary anywhere else in the app.
