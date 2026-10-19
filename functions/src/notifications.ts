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

/**
 * Covers every trade-progress notification in one trigger by diffing
 * before/after on each write to an offer: a brand new offer, it being
 * accepted, and each side's toy being posted/received. One function per
 * collection (rather than one per event type) keeps the before/after diff
 * logic in a single place, matching how myOffers.tsx itself derives UI
 * state from the same offer fields.
 */
export const onOfferWritten = onDocumentWritten(
  {document: "offers/{offerId}", region: REGION},
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!after) return; // deleted (e.g. declined/superseded) - nothing to notify

    const db = getFirestore();

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

    if (newlySet("offerAccepted")) {
      await sendPushToUser(after.userInitiated, {
        title: "Offer accepted!",
        body: "Your trade offer was accepted.",
      }, {offerId: event.params.offerId});
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
