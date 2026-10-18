import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { PROJECT_ID, EMULATOR_HOSTS } from "./constants";

// Safety: this must only ever talk to the local Firestore/Auth emulators,
// never a real project - refuse to proceed otherwise so a misconfigured env
// can never cause this helper to write to production data.
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || EMULATOR_HOSTS.firestore;
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || EMULATOR_HOSTS.auth;
if (!/^(127\.0\.0\.1|localhost)/.test(process.env.FIRESTORE_EMULATOR_HOST) ||
    !/^(127\.0\.0\.1|localhost)/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST)) {
  throw new Error(
    "adminSeed refuses to run against non-local emulator hosts: " +
    `${process.env.FIRESTORE_EMULATOR_HOST} / ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`
  );
}

if (getApps().length === 0) {
  initializeApp({ projectId: PROJECT_ID });
}

// The tip is now paid-by-uid rather than paid-by-side, and the mocked
// checkout route in toy-swap.spec.ts only knows the test user's email - this
// resolves it to a real uid via the Auth emulator, same trust boundary as
// the rest of this file (Admin SDK against the local emulator only).
export async function getUidByEmail(email: string): Promise<string> {
  const user = await getAuth().getUserByEmail(email);
  return user.uid;
}

export type ShipmentSide = "offer" | "target";

/**
 * Simulates what the real stripeWebhook Cloud Function does once Stripe
 * confirms the optional "buy me a coffee" tip payment
 * (functions/src/shipment.ts): marks the shared, per-trade tip fields via
 * the Admin SDK, bypassing firestore.rules exactly like the real webhook
 * does. The e2e suite has no real Stripe test keys, so checkout-session
 * creation is mocked at the network layer instead (see
 * e2e/toy-swap.spec.ts) - this fills in what the webhook would have done
 * once that mocked "payment" completes. Omniva barcodes are now entered by
 * the user directly through the UI (self-reported, client-writable), not
 * seeded here.
 */
export async function markTipPaid(offerId: string, payerUid: string) {
  const db = getFirestore();
  await db.collection("offers").doc(offerId).update({
    tipPaid: FieldValue.serverTimestamp(),
    tipPaidByUid: payerUid,
  });
}
