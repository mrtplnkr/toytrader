import {onDocumentWritten, onDocumentCreated} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {getMessaging} from "firebase-admin/messaging";

if (getApps().length === 0) {
  initializeApp();
}

const REGION = "europe-west1";

/**
 * Sends a push notification to every device/browser a user has registered
 * (fcmTokens/{token}, one doc per token - see src/hooks/helper.ts's
 * requestNotificationPermission). Self-cleaning: a token FCM reports as
 * unregistered/invalid gets deleted so this collection doesn't accumulate
 * stale entries from uninstalled browsers/revoked permissions.
 */
async function sendPushToUser(
  uid: string,
  notification: {title: string, body: string},
  data?: Record<string, string>
): Promise<void> {
  const db = getFirestore();
  const tokenDocs = await db.collection("fcmTokens").where("uid", "==", uid).get();
  if (tokenDocs.empty) return;

  const tokens = tokenDocs.docs.map((d) => d.id);
  const response = await getMessaging().sendEachForMulticast({tokens, notification, data});
  logger.info(
    `sendPushToUser: uid=${uid} title="${notification.title}" tokens=${tokens.length} ` +
    `successes=${response.successCount} failures=${response.failureCount}`
  );

  const staleTokenDocs = tokenDocs.docs.filter((_, i) => {
    const error = response.responses[i].error;
    return error?.code === "messaging/registration-token-not-registered" ||
      error?.code === "messaging/invalid-registration-token";
  });
  if (staleTokenDocs.length > 0) {
    const batch = db.batch();
    staleTokenDocs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

async function toyTitle(db: FirebaseFirestore.Firestore, toyId: string): Promise<string> {
  const snap = await db.collection("toys").doc(toyId).get();
  return (snap.data()?.title as string | undefined) ?? "a toy";
}

// "IN_TRANSIT" -> "in transit". Omniva's own status values (see
// functions/src/omniva.ts's OmnivaShipmentStatus) are already readable
// enough once de-shouted/de-underscored - no need for a second label map to
// keep in sync with that one.
function formatShipmentStatus(status: string): string {
  return status.toLowerCase().replace(/_/g, " ");
}

/**
 * Covers every trade-progress notification in one trigger by diffing
 * before/after on each write to an offer: a brand new offer, it being
 * declined/cancelled, accepted, each side's shipping info being shared,
 * barcode registered/shipment status changing, each side's toy being
 * posted/received, and the optional tip being paid. One function per
 * collection (rather than one per event type) keeps the before/after diff
 * logic in a single place, matching how myOffers.tsx itself derives UI
 * state from the same offer fields.
 */
export const onOfferWritten = onDocumentWritten(
  {document: "offers/{offerId}", region: REGION},
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const db = getFirestore();

    if (!after) {
      // Deleted - either side declining a pending offer, or either side
      // cancelling an already-accepted one (declineOffer hard-deletes the
      // doc either way, see src/hooks/helper.ts - there's no "declined by"
      // field to say who, so both participants are notified; whoever
      // actually clicked decline/cancel just gets told about their own
      // action, same low-cost tradeoff as the tip-paid case below).
      if (before) {
        await Promise.all([
          sendPushToUser(before.userInitiated, {
            title: "Trade didn't go through",
            body: "This trade was declined or cancelled.",
          }, {offerId: event.params.offerId}),
          sendPushToUser(before.userReceived, {
            title: "Trade didn't go through",
            body: "This trade was declined or cancelled.",
          }, {offerId: event.params.offerId}),
        ]);
      }
      return;
    }

    if (!before) {
      // Brand new offer - the toy owner (userReceived) needs to know.
      const title = await toyTitle(db, after.toyTargeted);
      await sendPushToUser(after.userReceived, {
        title: "New trade offer!",
        body: `Someone wants to trade for your ${title}.`,
      }, {offerId: event.params.offerId});
      return;
    }

    const newlySet = (field: string) => !before[field] && after[field];
    const changed = (field: string) => before[field] !== after[field] && after[field] !== undefined;

    if (newlySet("offerAccepted")) {
      await sendPushToUser(after.userInitiated, {
        title: "Offer accepted!",
        body: "Your trade offer was accepted.",
      }, {offerId: event.params.offerId});
    }

    // Shipping name/phone/parcel machine shared on this trade (see
    // src/hooks/helper.ts's shareShippingInfo) - lets the other side know
    // they can go ahead and register/drop off their own shipment.
    if (newlySet("offerShippingName")) {
      await sendPushToUser(after.userReceived, {
        title: "Shipping info shared",
        body: "Your trade partner shared their shipping details.",
      }, {offerId: event.params.offerId});
    }
    if (newlySet("targetShippingName")) {
      await sendPushToUser(after.userInitiated, {
        title: "Shipping info shared",
        body: "Your trade partner shared their shipping details.",
      }, {offerId: event.params.offerId});
    }

    // Covers both the initial self-reported barcode submission (which also
    // sets status to "REGISTERED", see submitOmnivaBarcode in helper.ts)
    // and every later change the scheduled Omniva poll writes
    // (IN_TRANSIT/ARRIVED_AT_TERMINAL/DELIVERED/RETURNED, see
    // omnivaStatusSync.ts) - both participants have a stake in either leg
    // of the shipment (RETURNED in particular needs the sender's action),
    // unlike the posted/received milestones below which are each
    // meaningful to only one specific side.
    if (changed("offerShipmentStatus")) {
      const status = formatShipmentStatus(after.offerShipmentStatus);
      await Promise.all([
        sendPushToUser(after.userInitiated, {
          title: "Shipment update",
          body: `Your shipment is now ${status}.`,
        }, {offerId: event.params.offerId}),
        sendPushToUser(after.userReceived, {
          title: "Shipment update",
          body: `Your trade partner's shipment is now ${status}.`,
        }, {offerId: event.params.offerId}),
      ]);
    }
    if (changed("targetShipmentStatus")) {
      const status = formatShipmentStatus(after.targetShipmentStatus);
      await Promise.all([
        sendPushToUser(after.userReceived, {
          title: "Shipment update",
          body: `Your shipment is now ${status}.`,
        }, {offerId: event.params.offerId}),
        sendPushToUser(after.userInitiated, {
          title: "Shipment update",
          body: `Your trade partner's shipment is now ${status}.`,
        }, {offerId: event.params.offerId}),
      ]);
    }

    if (newlySet("offerPosted")) {
      await sendPushToUser(after.userReceived, {
        title: "Toy shipped",
        body: "Your trade partner shipped their toy.",
      }, {offerId: event.params.offerId});
    }
    if (newlySet("targetPosted")) {
      await sendPushToUser(after.userInitiated, {
        title: "Toy shipped",
        body: "Your trade partner shipped their toy.",
      }, {offerId: event.params.offerId});
    }
    if (newlySet("offerReceived")) {
      await sendPushToUser(after.userInitiated, {
        title: "Toy received",
        body: "Your toy was confirmed received!",
      }, {offerId: event.params.offerId});
    }
    if (newlySet("targetReceived")) {
      await sendPushToUser(after.userReceived, {
        title: "Toy received",
        body: "Your toy was confirmed received!",
      }, {offerId: event.params.offerId});
    }

    // Tip is per-trade, payable by either side, first to pay closes it for
    // both (see stripeWebhook in shipment.ts, the only writer of this
    // field) - notify whichever side didn't pay; the payer already knows,
    // they're the one who just paid.
    if (newlySet("tipPaid") && after.tipPaidByUid) {
      const otherUid = after.tipPaidByUid === after.userInitiated ? after.userReceived : after.userInitiated;
      await sendPushToUser(otherUid, {
        title: "☕ Tip received",
        body: "Your trade partner bought you a coffee - thanks for using ToyTrader!",
      }, {offerId: event.params.offerId});
    }
  }
);

/**
 * Ratings have no owning-user field of their own (just toyId) - the
 * notification recipient is whoever owns the toy that got rated.
 */
export const onRatingCreated = onDocumentCreated(
  {document: "ratings/{ratingId}", region: REGION},
  async (event) => {
    const rating = event.data?.data();
    if (!rating) return;

    const db = getFirestore();
    const toySnap = await db.collection("toys").doc(rating.toyId).get();
    const ownerUid = toySnap.data()?.userId as string | undefined;
    if (!ownerUid) {
      logger.warn("onRatingCreated: rated toy has no owner on record", rating.toyId);
      return;
    }

    const title = (toySnap.data()?.title as string | undefined) ?? "your toy";
    await sendPushToUser(ownerUid, {
      title: "New rating!",
      body: `Someone rated ${title} ${rating.stars} star${rating.stars === 1 ? "" : "s"}.`,
    }, {offerId: rating.offerId});
  }
);
