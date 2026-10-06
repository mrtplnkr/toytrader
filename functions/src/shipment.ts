import {onCall, onRequest, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {defineString} from "firebase-functions/params";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, FieldValue, Firestore} from "firebase-admin/firestore";
import type Stripe from "stripe";
import {getStripe, stripeSecretKey, stripeWebhookSecret} from "./stripe";
import {getOmnivaClient, omnivaUsername, omnivaPassword, ShipmentSide} from "./omniva";
import {isValidParcelMachineId} from "./omnivaParcelMachines";

if (getApps().length === 0) {
  initializeApp();
}

const REGION = "europe-west1";
const SHIPMENT_PRICE_EUR_CENTS = 100;

// Base URL of the deployed frontend, used to build Stripe's success/cancel
// redirect URLs. Override with `firebase functions:config` / a deployed
// param value once the production Hosting domain is known.
const appBaseUrl = defineString("APP_BASE_URL", {default: "http://localhost:3000"});

interface StartShipmentCheckoutRequest {
  offerId: string;
  side: ShipmentSide;
  parcelMachineId: string;
  toySize: string;
}

/**
 * Callable that starts a Stripe Checkout session for one side of an
 * accepted trade to pay for their Omniva shipment. The caller must be the
 * user responsible for that side (userInitiated for "offer", userReceived
 * for "target") - this is the real authorization check, since Firestore
 * rules alone can't validate "is this the right side of the trade".
 */
export const startShipmentCheckout = onCall<StartShipmentCheckoutRequest>(
  {region: REGION, secrets: [stripeSecretKey, omnivaUsername, omnivaPassword]},
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }

    const {offerId, side, parcelMachineId, toySize} = request.data ?? {};
    if (!offerId || (side !== "offer" && side !== "target") || !parcelMachineId || !toySize) {
      throw new HttpsError(
        "invalid-argument",
        "offerId, side ('offer'|'target'), parcelMachineId, and toySize are required."
      );
    }

    if (!(await isValidParcelMachineId(parcelMachineId))) {
      throw new HttpsError("invalid-argument", "Unknown parcel machine.");
    }

    const db = getFirestore();
    const offerRef = db.collection("offers").doc(offerId);
    const offerSnap = await offerRef.get();
    if (!offerSnap.exists) {
      throw new HttpsError("not-found", "Offer not found.");
    }
    const offer = offerSnap.data() ?? {};

    const expectedUid = side === "offer" ? offer.userInitiated : offer.userReceived;
    if (expectedUid !== uid) {
      throw new HttpsError(
        "permission-denied",
        "You are not the party responsible for this side of the trade."
      );
    }

    if (!offer.offerAccepted) {
      throw new HttpsError("failed-precondition", "This offer has not been accepted yet.");
    }

    const paidField = `${side}ShipmentPaid`;
    if (offer[paidField]) {
      throw new HttpsError("already-exists", "This shipment has already been paid for.");
    }

    const stripe = getStripe();
    const baseUrl = appBaseUrl.value();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "eur",
          unit_amount: SHIPMENT_PRICE_EUR_CENTS,
          product_data: {name: "Omniva parcel shipment"},
        },
        quantity: 1,
      }],
      metadata: {offerId, side, uid, parcelMachineId, toySize},
      success_url:
        `${baseUrl}/shipment/result?offerId=${offerId}&side=${side}&status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/shipment/result?offerId=${offerId}&side=${side}&status=cancel`,
    });

    await offerRef.update({[`${side}ShipmentStripeSessionId`]: session.id});

    return {checkoutUrl: session.url};
  }
);

/**
 * Marks one side of an offer as paid and registers the Omniva shipment.
 * Idempotent (no-ops if already paid) and shared between the webhook and
 * recheckShipmentPayment, so a missed/delayed webhook can be recovered from
 * without duplicating this logic or double-charging anyone - Stripe is only
 * ever charged once (this never creates a new Checkout session, it just
 * reconciles Firestore with a payment Stripe already confirmed).
 */
async function finalizeShipmentPayment(
  db: Firestore,
  offerId: string,
  side: ShipmentSide,
  parcelMachineId: string,
  toySize: string
): Promise<{alreadyProcessed: boolean}> {
  const offerRef = db.collection("offers").doc(offerId);
  const offerSnap = await offerRef.get();
  if (!offerSnap.exists) {
    logger.error("finalizeShipmentPayment: offer not found", offerId);
    return {alreadyProcessed: false};
  }

  const offer = offerSnap.data() ?? {};
  const paidField = `${side}ShipmentPaid`;
  const barcodeField = `${side}ShipmentBarcode`;
  const qrIssuedField = `${side}ShipmentQrIssuedAt`;
  const errorField = `${side}ShipmentError`;
  const terminalIdField = `${side}ShipmentTerminalId`;
  const sizeField = `${side}ShipmentToySize`;
  const statusField = `${side}ShipmentStatus`;
  const statusUpdatedField = `${side}ShipmentStatusUpdatedAt`;

  if (offer[paidField]) {
    // Stripe can redeliver webhook events, and recheckShipmentPayment can
    // race with a webhook that just fired - already processed, no-op.
    return {alreadyProcessed: true};
  }

  try {
    const result = await getOmnivaClient().createShipment({
      offerId, side, destinationTerminalId: parcelMachineId, toySize,
    });
    await offerRef.update({
      [paidField]: FieldValue.serverTimestamp(),
      [barcodeField]: result.barcode,
      [qrIssuedField]: FieldValue.serverTimestamp(),
      [errorField]: FieldValue.delete(),
      [terminalIdField]: parcelMachineId,
      [sizeField]: toySize,
      [statusField]: "REGISTERED",
      [statusUpdatedField]: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    // Payment already captured at this point - surface the failure on the
    // offer doc rather than silently leaving the user without a barcode.
    logger.error("Omniva shipment creation failed after successful payment", offerId, side, err);
    await offerRef.update({
      [paidField]: FieldValue.serverTimestamp(),
      [errorField]: (err as Error).message,
    });
  }

  return {alreadyProcessed: false};
}

/**
 * Stripe webhook endpoint. Verifies the event signature against the raw
 * request body (Functions v2 onRequest exposes req.rawBody natively), then
 * on checkout.session.completed finalizes the shipment via the Admin SDK
 * (bypasses Firestore rules, since the client is never allowed to set these
 * fields directly - see firestore.rules).
 */
export const stripeWebhook = onRequest(
  {region: REGION, secrets: [stripeSecretKey, stripeWebhookSecret, omnivaUsername, omnivaPassword]},
  async (req, res) => {
    const stripe = getStripe();
    const signature = req.headers["stripe-signature"];

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        signature as string,
        stripeWebhookSecret.value()
      );
    } catch (err) {
      logger.error("Stripe webhook signature verification failed", err);
      res.status(400).send(`Webhook Error: ${(err as Error).message}`);
      return;
    }

    if (event.type !== "checkout.session.completed") {
      res.status(200).send("ignored - not checkout.session.completed");
      return;
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const offerId = session.metadata?.offerId;
    const side = session.metadata?.side as ShipmentSide | undefined;
    const parcelMachineId = session.metadata?.parcelMachineId;
    const toySize = session.metadata?.toySize;

    if (!offerId || (side !== "offer" && side !== "target") || !parcelMachineId || !toySize) {
      logger.error("Missing/invalid metadata on checkout session", session.id);
      res.status(200).send("ignored - missing metadata");
      return;
    }

    await finalizeShipmentPayment(getFirestore(), offerId, side, parcelMachineId, toySize);
    res.status(200).send("ok");
  }
);

interface RecheckShipmentPaymentRequest {
  offerId: string;
  side: ShipmentSide;
}

/**
 * Recovery path for a missed/delayed webhook: the user already paid at
 * Stripe (confirmed by retrieving the session directly), but our webhook
 * never processed it, so the offer is stuck showing "pay" again with no
 * barcode. Looks up the actual Stripe session status and, if paid,
 * reconciles Firestore the same way the webhook would - never creates a
 * new charge.
 */
export const recheckShipmentPayment = onCall<RecheckShipmentPaymentRequest>(
  {region: REGION, secrets: [stripeSecretKey, omnivaUsername, omnivaPassword]},
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }

    const {offerId, side} = request.data ?? {};
    if (!offerId || (side !== "offer" && side !== "target")) {
      throw new HttpsError("invalid-argument", "offerId and side ('offer'|'target') are required.");
    }

    const db = getFirestore();
    const offerRef = db.collection("offers").doc(offerId);
    const offerSnap = await offerRef.get();
    if (!offerSnap.exists) {
      throw new HttpsError("not-found", "Offer not found.");
    }
    const offer = offerSnap.data() ?? {};

    const expectedUid = side === "offer" ? offer.userInitiated : offer.userReceived;
    if (expectedUid !== uid) {
      throw new HttpsError(
        "permission-denied",
        "You are not the party responsible for this side of the trade."
      );
    }

    if (offer[`${side}ShipmentPaid`]) {
      return {paid: true};
    }

    const sessionId = offer[`${side}ShipmentStripeSessionId`];
    if (!sessionId) {
      throw new HttpsError("failed-precondition", "No checkout session found for this shipment yet.");
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return {paid: false};
    }

    const parcelMachineId = session.metadata?.parcelMachineId;
    const toySize = session.metadata?.toySize;
    if (!parcelMachineId || !toySize) {
      throw new HttpsError(
        "internal",
        "Payment succeeded but the checkout session is missing shipment details - contact support."
      );
    }

    await finalizeShipmentPayment(db, offerId, side, parcelMachineId, toySize);
    return {paid: true};
  }
);
