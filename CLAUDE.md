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
4. Omniva has no business API integration — users register their own shipment directly on Omniva's consumer site and self-report the resulting barcode into the app (see Architecture below); `OMNIVA_MODE` defaults to `stub` ([functions/src/omniva.ts](functions/src/omniva.ts)), which only affects the shipping-price *estimate* shown in the UI and the scheduled tracking-status sync, neither of which needs real Omniva credentials locally. The only thing Stripe is used for is the optional tip (see below) — `stripe listen` is only needed if you're testing that.

Firebase emulators (auth/firestore/storage/hosting/ui/functions) are configured in [firebase.json](firebase.json) — `firebase emulators:start` if the Firebase CLI is installed.

**End-to-end tests** ([e2e/](e2e/), Playwright): `npm run test:e2e` runs [e2e/toy-swap.spec.ts](e2e/toy-swap.spec.ts) — two real browser contexts sign in via the Auth Emulator's fake Google IDP widget ([e2e/helpers/auth.ts](e2e/helpers/auth.ts)), list toys, trade, accept, each side self-reports an Omniva barcode, completes both shipping directions, rates the trade, and pays the optional tip, all against a real Firestore/Storage/Auth emulator (`playwright.config.ts`'s `webServer` starts both the emulator suite and `npm start`, pointed at each other via `REACT_APP_USE_FIREBASE_EMULATORS=true` — see the emulator-connect block in [src/firebase-config.ts](src/firebase-config.ts)). Since there are no real Stripe test keys yet, the `startShipmentCheckout` network call (now used only for the tip) is mocked at the Playwright layer instead of hitting real Stripe; the mock also writes the tip fields straight to the Firestore emulator via the Admin SDK ([e2e/helpers/adminSeed.ts](e2e/helpers/adminSeed.ts)) — exactly what the real `stripeWebhook` function would do once payment succeeds. **Requires Java** (for the Firestore emulator) and `npx playwright install chromium` once.

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

**Shipping has no mandatory charge at all.** Omniva has no business API contract with this app, so there's no way to create a shipment programmatically — instead each user registers their own parcel directly on Omniva's consumer site (a link out, via `OMNIVA_SEND_PARCEL_URL`) and pastes the resulting real barcode into the app themselves via `submitOmnivaBarcode` ([src/hooks/helper.ts](src/hooks/helper.ts)), a plain client-side Firestore `updateDoc` — self-reported and trusted the same way `offerAccepted`/`offerPosted`/`offerReceived` already are. This sets `offerShipmentBarcode`/`offerShipmentToySize`/`offerShipmentStatus`/`offerShipmentStatusUpdatedAt` (and the `target*` equivalents), which the UI then renders as a scannable QR of that barcode via `qrcode.react` for convenience at drop-off. [myOffers.tsx](src/pages/myOffers.tsx) also shows a non-binding shipping-price *estimate* (`getShippingPrice`/[functions/src/omnivaShippingPrice.ts](functions/src/omnivaShippingPrice.ts)) alongside a link to Omniva's own price list — this is never charged, just informational. A scheduled function, `syncOmnivaShipmentStatuses` ([functions/src/omnivaStatusSync.ts](functions/src/omnivaStatusSync.ts), every 30 min), polls real Omniva tracking by barcode once `OMNIVA_MODE=real` and a real `getTrackingStatus` implementation exist — neither does yet, so it currently no-ops immediately on every run.

**The only payment anywhere in the trade flow is a fully optional, per-trade tip** ("☕ Buy me a coffee (€1)", `TIP_EUR_CENTS = 100` in [functions/src/shipment.ts](functions/src/shipment.ts)) — offerable once both toys are confirmed received *and* the viewer has left their own rating, payable by either side, first to pay closes it for both (`tipPaid`/`tipStripeSessionId`/`tipPaidByUid` on the offer). [myOffers.tsx](src/pages/myOffers.tsx) calls `startShipmentCheckout` ([src/hooks/helper.ts](src/hooks/helper.ts) → [functions/src/shipment.ts](functions/src/shipment.ts), names unchanged from an earlier design but now tip-only) to create a Stripe Checkout session and redirect the browser to it; Stripe redirects back to `/shipment/result` ([src/pages/shipmentResult.tsx](src/pages/shipmentResult.tsx)), which polls briefly for `tipPaid` since the `stripeWebhook` function runs async, slightly behind the redirect. These three tip fields are **only ever written by the `stripeWebhook` Cloud Function** via the Admin SDK — [firestore.rules](firestore.rules) has a dedicated `match /offers/{offerId}` block that blocks any client `update` touching them (`diff().affectedKeys().hasAny([...])`), which is the actual security boundary; the client only ever reads them. The barcode/size/status fields above are validated for shape (`validBarcodeOrAbsent`) but are otherwise client-writable by design, per the self-reporting model.

**Firebase config/keys are committed** in [src/firebase-config.ts](src/firebase-config.ts) (this is standard for Firebase web apps — the client config is not a secret; access control is enforced by [firestore.rules](firestore.rules) and [storage.rules](storage.rules), not by hiding these values). Cloud Functions are pinned to the `europe-west1` region (both the function definitions and the client's `getFunctions(app, 'europe-west1')` call) — Omniva is Baltic and payment data should stay in-EU; moving a deployed function's region later requires delete+recreate, so don't change this casually.

**Security rules are mostly permissive, with two carve-outs**: any authenticated user (`request.auth.uid != null`) can read/write any document in most Firestore collections and any object in Storage — there is no per-user or per-document ownership check for `toys`, for instance. The `offers` collection is the exception: since an offer can carry a self-reported shipping phone number, **reads are restricted to the two participants and admins** (not open to any authenticated user like the rest of the app), and client *updates* to the three tip-payment fields are rejected regardless of who's writing. `fcmTokens` is the other carve-out (a user can only read/create/delete their own token docs). Don't treat client-side filtering (e.g. by `userId`) as a security boundary anywhere else in the app.
