import {onCall, onRequest, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {defineString} from "firebase-functions/params";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
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
 * Stripe webhook endpoint. Verifies the event signature against the raw
 * request body (Functions v2 onRequest exposes req.rawBody natively), then
 * on checkout.session.completed marks the relevant side of the offer as
 * paid and calls the Omniva abstraction to obtain a shipping barcode.
 *
 * This must go through the Admin SDK (bypasses Firestore rules) since the
 * client is never allowed to set these fields directly - see firestore.rules.
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

    const db = getFirestore();
    const offerRef = db.collection("offers").doc(offerId);
    const offerSnap = await offerRef.get();
    if (!offerSnap.exists) {
      logger.error("Offer not found for completed checkout session", offerId, session.id);
      res.status(200).send("ignored - offer not found");
      return;
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
      // Stripe can redeliver webhook events - already processed, no-op.
      res.status(200).send("already processed");
      return;
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

    res.status(200).send("ok");
  }
);
