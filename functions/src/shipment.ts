import {onCall, onRequest, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {defineString} from "firebase-functions/params";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, FieldValue, Firestore} from "firebase-admin/firestore";
import type Stripe from "stripe";
import {getStripe, stripeSecretKey, stripeWebhookSecret} from "./stripe";

if (getApps().length === 0) {
  initializeApp();
}

const REGION = "europe-west1";
const TIP_EUR_CENTS = 100;

// Base URL of the deployed frontend, used to build Stripe's success/cancel
// redirect URLs. Override with `firebase functions:config` / a deployed
// param value once the production Hosting domain is known.
const appBaseUrl = defineString("APP_BASE_URL", {default: "http://localhost:3000"});

interface StartShipmentCheckoutRequest {
  offerId: string;
}

/**
 * Callable that starts a Stripe Checkout session for an optional 1 EUR
 * "buy me a coffee" tip to ToyTrader. Nothing in the trade depends on this
 * being paid - it's per *trade*, not per side: offerable by either party
 * once the whole trade has completed (both toys confirmed received), not
 * upfront, and first to pay closes it for both sides. Omniva
 * registration/shipping itself is handled entirely by the user on Omniva's
 * own site (see submitOmnivaBarcode in helper.ts) - this app has no
 * business contract with Omniva and never calls their API to create or
 * charge for a shipment.
 */
export const startShipmentCheckout = onCall<StartShipmentCheckoutRequest>(
  {region: REGION, secrets: [stripeSecretKey]},
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }

    const {offerId} = request.data ?? {};
    if (!offerId) {
      throw new HttpsError("invalid-argument", "offerId is required.");
    }

    const db = getFirestore();
    const offerRef = db.collection("offers").doc(offerId);
    const offerSnap = await offerRef.get();
    if (!offerSnap.exists) {
      throw new HttpsError("not-found", "Offer not found.");
    }
    const offer = offerSnap.data() ?? {};

    if (offer.userInitiated !== uid && offer.userReceived !== uid) {
      throw new HttpsError("permission-denied", "You are not a party to this trade.");
    }

    if (!offer.offerReceived || !offer.targetReceived) {
      throw new HttpsError(
        "failed-precondition",
        "This trade hasn't fully completed yet - the optional tip only becomes " +
        "available once both toys have been confirmed received."
      );
    }

    if (offer.tipPaid) {
      throw new HttpsError("already-exists", "This tip has already been paid.");
    }

    const stripe = getStripe();
    const baseUrl = appBaseUrl.value();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "eur",
          unit_amount: TIP_EUR_CENTS,
          product_data: {name: "ToyTrader optional tip"},
        },
        quantity: 1,
      }],
      metadata: {offerId, uid},
      success_url:
        `${baseUrl}/shipment/result?offerId=${offerId}&status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/shipment/result?offerId=${offerId}&status=cancel`,
    });

    await offerRef.update({tipStripeSessionId: session.id});

    return {checkoutUrl: session.url};
  }
);

/**
 * Marks an offer's shared, per-trade tip as paid. Idempotent (no-ops if
 * already paid) and shared between the webhook and recheckShipmentPayment,
 * so a missed/delayed webhook can be recovered from without duplicating
 * this logic or double-charging anyone - Stripe is only ever charged once
 * (this never creates a new Checkout session, it just reconciles Firestore
 * with a payment Stripe already confirmed).
 */
async function finalizeShipmentPayment(
  db: Firestore,
  offerId: string,
  payerUid: string
): Promise<{alreadyProcessed: boolean}> {
  const offerRef = db.collection("offers").doc(offerId);
  const offerSnap = await offerRef.get();
  if (!offerSnap.exists) {
    logger.error("finalizeShipmentPayment: offer not found", offerId);
    return {alreadyProcessed: false};
  }

  const offer = offerSnap.data() ?? {};

  if (offer.tipPaid) {
    // Stripe can redeliver webhook events, and recheckShipmentPayment can
    // race with a webhook that just fired - already processed, no-op.
    return {alreadyProcessed: true};
  }

  await offerRef.update({tipPaid: FieldValue.serverTimestamp(), tipPaidByUid: payerUid});
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

    // Donations (functions/src/donation.ts) go through this same webhook
    // endpoint but aren't tied to any offer - nothing to reconcile in
    // Firestore, just acknowledge so Stripe doesn't retry.
    if (session.metadata?.kind === "donation") {
      logger.info("stripeWebhook: donation completed", session.id);
      res.status(200).send("ok - donation");
      return;
    }

    const offerId = session.metadata?.offerId;
    const payerUid = session.metadata?.uid;

    if (!offerId || !payerUid) {
      logger.error("Missing/invalid metadata on checkout session", session.id);
      res.status(200).send("ignored - missing metadata");
      return;
    }

    await finalizeShipmentPayment(getFirestore(), offerId, payerUid);
    res.status(200).send("ok");
  }
);

interface RecheckShipmentPaymentRequest {
  offerId: string;
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

    const {offerId} = request.data ?? {};
    if (!offerId) {
      throw new HttpsError("invalid-argument", "offerId is required.");
    }

    const db = getFirestore();
    const offerRef = db.collection("offers").doc(offerId);
    const offerSnap = await offerRef.get();
    if (!offerSnap.exists) {
      throw new HttpsError("not-found", "Offer not found.");
    }
    const offer = offerSnap.data() ?? {};

    if (offer.userInitiated !== uid && offer.userReceived !== uid) {
      throw new HttpsError("permission-denied", "You are not a party to this trade.");
    }

    if (offer.tipPaid) {
      return {paid: true};
    }

    const sessionId = offer.tipStripeSessionId;
    if (!sessionId) {
      throw new HttpsError("failed-precondition", "No checkout session found for this tip yet.");
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return {paid: false};
    }

    await finalizeShipmentPayment(db, offerId, uid);
    return {paid: true};
  }
);
