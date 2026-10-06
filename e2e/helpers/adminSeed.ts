import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { PROJECT_ID, EMULATOR_HOSTS } from "./constants";

// Safety: this must only ever talk to the local Firestore emulator, never a
// real project - refuse to proceed otherwise so a misconfigured env can
// never cause this helper to write to production data.
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || EMULATOR_HOSTS.firestore;
if (!/^(127\.0\.0\.1|localhost)/.test(process.env.FIRESTORE_EMULATOR_HOST)) {
  throw new Error(
    `adminSeed refuses to run against a non-local FIRESTORE_EMULATOR_HOST: ${process.env.FIRESTORE_EMULATOR_HOST}`
  );
}

if (getApps().length === 0) {
  initializeApp({ projectId: PROJECT_ID });
}

export type ShipmentSide = "offer" | "target";

/**
 * Simulates what the real stripeWebhook Cloud Function does once Stripe
 * confirms payment (functions/src/shipment.ts): writes the shipment-paid
 * and barcode fields via the Admin SDK, which bypasses firestore.rules
 * exactly like the real webhook does. The e2e suite has no real Stripe test
 * keys, so checkout-session creation is mocked at the network layer instead
 * (see e2e/toy-swap.spec.ts) - this fills in what the webhook would have
 * done once that mocked "payment" completes.
 */
export async function markShipmentPaid(
  offerId: string,
  side: ShipmentSide,
  barcode: string,
  parcelMachineId: string,
  toySize: string
) {
  const db = getFirestore();
  await db.collection("offers").doc(offerId).update({
    [`${side}ShipmentPaid`]: FieldValue.serverTimestamp(),
    [`${side}ShipmentBarcode`]: barcode,
    [`${side}ShipmentQrIssuedAt`]: FieldValue.serverTimestamp(),
    [`${side}ShipmentTerminalId`]: parcelMachineId,
    [`${side}ShipmentToySize`]: toySize,
    [`${side}ShipmentStatus`]: "REGISTERED",
    [`${side}ShipmentStatusUpdatedAt`]: FieldValue.serverTimestamp(),
  });
}
