# Next steps

Status snapshot as of 2026-10-27. Not a design doc - just who's waiting on whom, so nothing stalls silently.

## Waiting on you

- **Clear `toys`/`offers` in production.** I tried and got blocked by the safety classifier (mass-delete). Run this yourself from the repo root:
  ```
  firebase firestore:delete offers --recursive --force
  firebase firestore:delete toys --recursive --force
  ```
  or do it via Firebase Console → Firestore Database → select all docs in each collection → delete.
  Ratings/complaints referencing the deleted docs will become orphaned but harmless (existing UI already falls back to "a toy (no longer listed)") - say if you want those cleared too.

- **Google Play Console account status unclear.** Last known state: your old account was closed for inactivity and you were re-registering fresh, blocked partway by a phone-verification rate limit ("this phone number has already been used too many times"). Let me know if that's resolved - the signed `.aab` is built and ready to upload the moment you have console access (see "Ready, waiting on Play Console access" below).

## Waiting on me

- **Build the test toy dataset** - blocked on the Firestore clear above, so the new listings start from a clean slate instead of mixing with whatever's deleted. Plan once unblocked: create a dedicated demo account via the (now working) email/password sign-in, generate ~6 clearly-labeled placeholder toy images (text baked into the image itself, e.g. "TEST DATA - Wooden Train Set", via placehold.co), and list them through the real app flow via Playwright automation - same approach used to verify email/password auth. Will say explicitly when it's done and that it's test data.

- **myOffers.tsx hardcoded-value cleanup** - in progress, not yet committed. Changes made so far:
  - Fixed a real bug: every toy status link (`<a href="{{toyUrl}}">toy</a>`) pointed at one hardcoded external stock photo (`images.thewest.com.au/...`) regardless of which toy was involved - now correctly links to each toy's actual photo.
  - Country dropdown (EE/LV/LT) now derives from a new shared `OMNIVA_COUNTRIES` constant instead of 3 independently-hardcoded `<option>` tags that could silently drift from the URL maps.
  - Barcode length bounds (5/30) pulled into named constants.
  - A hardcoded hex color (`#ff6b6b`) that had drifted from the theme's actual `--color-danger` token (`#ff5c7a`) replaced with the proper `text-danger` class.
  - Removed a block of duplicated toast-notification code in `payForShipment` that was functionally identical to the existing `notifyError` helper.
  Still needs: a clean build/typecheck pass, then commit + push (CI will deploy automatically now that it's fixed).

## Ready, waiting on Play Console access

- Signed `app-release-bundle.aab` and APK are built (`android-twa/`), verified full-screen on a real Android 14 emulator, Digital Asset Links live in production. Nothing left to do here except upload once you have console access - internal testing track first, Play App Signing enrolled.

## Done, deployed, verified in production

- Email/password sign-in (alongside Google/Facebook) - Firebase Console setting enabled, verified against real production auth.
- CI auto-deploy pipeline - was broken (expired/invalid service account secret), fixed by rotating the key; confirmed with a real end-to-end deploy.
- Multi-image/video toy uploads (up to 3 photos + 1 video, selectable main photo) - storage.rules enforces real size/type limits server-side, not just client-side.
- Privacy Policy page - public `/privacy` route, linked from the landing page footer, translated en/lt/ru.
- Flag-based language switcher, admin "Remove toy" action, push notifications (FCM) - all shipped in earlier rounds this session.
