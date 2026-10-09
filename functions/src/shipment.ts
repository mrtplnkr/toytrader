import {onCall, onRequest, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {defineString} from "firebase-functions/params";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, FieldValue, Firestore} from "firebase-admin/firestore";
import type Stripe from "stripe";
import {getStripe, stripeSecretKey, stripeWebhookSecret} from "./stripe";
import {ShipmentSide} from "./omniva";

if (getApps().length === 0) {
  initializeApp();
}

const REGION = "europe-west1";
const SERVICE_FEE_EUR_CENTS = 100;

// Base URL of the deployed frontend, used to build Stripe's success/cancel
// redirect URLs. Override with `firebase functions:config` / a deployed
// param value once the production Hosting domain is known.
const appBaseUrl = defineString("APP_BASE_URL", {default: "http://localhost:3000"});

interface StartShipmentCheckoutRequest {
  offerId: string;
  side: ShipmentSide;
}

/**
 * Callable that starts a Stripe Checkout session for ToyTrader's own 1 EUR
 * service fee. This is charged per side, only once that side's own shipment
 * has been confirmed received by the other party - i.e. only after a
 * successful trade, not upfront. Omniva registration/shipping itself is
 * handled entirely by the user on Omniva's own site (see submitOmnivaBarcode
 * in helper.ts) - this app has no business contract with Omniva and never
 * calls their API to create or charge for a shipment.
 */
export const startShipmentCheckout = onCall<StartShipmentCheckoutRequest>(
  {region: REGION, secrets: [stripeSecretKey]},
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

    // "My shipment succeeded" = the toy on my side was confirmed received by
    // the other party - offerReceived tracks toyOffered's receipt (the
    // initiator's shipment), targetReceived tracks toyTargeted's (the
    // receiver's shipment), so each side checks its own same-prefixed field.
    const receivedField = side === "offer" ? "offerReceived" : "targetReceived";
    if (!offer[receivedField]) {
      throw new HttpsError(
        "failed-precondition",
        "This shipment hasn't been confirmed received yet - the fee is only charged after a successful trade."
      );
    }

    const paidField = `${side}ShipmentPaid`;
    if (offer[paidField]) {
      throw new HttpsError("already-exists", "This fee has already been paid.");
    }

    const stripe = getStripe();
    const baseUrl = appBaseUrl.value();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "eur",
          unit_amount: SERVICE_FEE_EUR_CENTS,
          product_data: {name: "ToyTrader service fee"},
        },
        quantity: 1,
      }],
      metadata: {offerId, side, uid},
      success_url:
        `${baseUrl}/shipment/result?offerId=${offerId}&side=${side}&status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/shipment/result?offerId=${offerId}&side=${side}&status=cancel`,
    });

    await offerRef.update({[`${side}ShipmentStripeSessionId`]: session.id});

    return {checkoutUrl: session.url};
  }
);

/**
 * Marks one side of an offer's service fee as paid. Idempotent (no-ops if
 * already paid) and shared between the webhook and recheckShipmentPayment,
 * so a missed/delayed webhook can be recovered from without duplicating
 * this logic or double-charging anyone - Stripe is only ever charged once
 * (this never creates a new Checkout session, it just reconciles Firestore
 * with a payment Stripe already confirmed).
 */
async function finalizeShipmentPayment(
  db: Firestore,
  offerId: string,
  side: ShipmentSide
): Promise<{alreadyProcessed: boolean}> {
  const offerRef = db.collection("offers").doc(offerId);
  const offerSnap = await offerRef.get();
  if (!offerSnap.exists) {
    logger.error("finalizeShipmentPayment: offer not found", offerId);
    return {alreadyProcessed: false};
  }

  const offer = offerSnap.data() ?? {};
  const paidField = `${side}ShipmentPaid`;

  if (offer[paidField]) {
    // Stripe can redeliver webhook events, and recheckShipmentPayment can
    // race with a webhook that just fired - already processed, no-op.
    return {alreadyProcessed: true};
  }

  await offerRef.update({[paidField]: FieldValue.serverTimestamp()});
  return {alreadyProcessed: false};
}

/**
 * Stripe webhook endpoint. Verifies the event signature against the raw
 * request body (Functions v2 onRequest exposes req.rawBody natively), then
 * on checkout.session.completed finalizes the payment via the Admin SDK
 * (bypasses Firestore rules, since the client is never allowed to set these
 * fields directly - see firestore.rules).
 */
export const stripeWebhook = onRequest(
  {region: REGION, secrets: [stripeSecretKey, stripeWebhookSecret]},
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

    if (!offerId || (side !== "offer" && side !== "target")) {
      logger.error("Missing/invalid metadata on checkout session", session.id);
      res.status(200).send("ignored - missing metadata");
      return;
    }

    await finalizeShipmentPayment(getFirestore(), offerId, side);
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
 * never processed it, so the offer is stuck showing "pay" again. Looks up
 * the actual Stripe session status and, if paid, reconciles Firestore the
 * same way the webhook would - never creates a new charge.
 */
export const recheckShipmentPayment = onCall<RecheckShipmentPaymentRequest>(
  {region: REGION, secrets: [stripeSecretKey]},
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
      throw new HttpsError("failed-precondition", "No checkout session found for this fee yet.");
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return {paid: false};
    }

    await finalizeShipmentPayment(db, offerId, side);
    return {paid: true};
  }
);
