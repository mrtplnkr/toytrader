import {onDocumentWritten, onDocumentCreated} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {getMessaging} from "firebase-admin/messaging";

if (getApps().length === 0) {
  initializeApp();
}

const REGION = "europe-west1";

type Lang = "en" | "lt" | "ru";
const SUPPORTED_LANGS: Lang[] = ["en", "lt", "ru"];
function normalizeLang(lang: unknown): Lang {
  return SUPPORTED_LANGS.includes(lang as Lang) ? (lang as Lang) : "en";
}

/**
 * One entry per notification "kind" this app ever sends, in every
 * supported language - kept here (not shared with src/locales) because
 * functions/ is a separate TypeScript package with its own build, and this
 * is a small, closed set of strings that rarely changes. The frontend
 * itself doesn't translate Omniva's own raw shipment-status values either
 * (see myOffers.tsx's status.yourShipmentStatus) - {{status}} here is kept
 * consistent with that, untranslated on purpose.
 */
const STRINGS: Record<Lang, {
  tradeDidntGoThrough: { title: string; body: string };
  newTradeOffer: (toyTitle: string) => { title: string; body: string };
  offerAccepted: { title: string; body: string };
  shippingInfoShared: { title: string; body: string };
  shipmentUpdateMine: (status: string) => { title: string; body: string };
  shipmentUpdateTheirs: (status: string) => { title: string; body: string };
  toyShipped: { title: string; body: string };
  toyReceived: { title: string; body: string };
  tipReceived: { title: string; body: string };
  newRating: (toyTitle: string, stars: number) => { title: string; body: string };
}> = {
  en: {
    tradeDidntGoThrough: {title: "Trade didn't go through", body: "This trade was declined or cancelled."},
    newTradeOffer: (toyTitle) => ({
      title: "New trade offer!", body: `Someone wants to trade for your ${toyTitle}.`,
    }),
    offerAccepted: {title: "Offer accepted!", body: "Your trade offer was accepted."},
    shippingInfoShared: {
      title: "Shipping info shared", body: "Your trade partner shared their shipping details.",
    },
    shipmentUpdateMine: (status) => ({title: "Shipment update", body: `Your shipment is now ${status}.`}),
    shipmentUpdateTheirs: (status) => ({
      title: "Shipment update", body: `Your trade partner's shipment is now ${status}.`,
    }),
    toyShipped: {title: "Toy shipped", body: "Your trade partner shipped their toy."},
    toyReceived: {title: "Toy received", body: "Your toy was confirmed received!"},
    tipReceived: {
      title: "☕ Tip received", body: "Your trade partner bought you a coffee - thanks for using ToyTrader!",
    },
    newRating: (toyTitle, stars) => ({
      title: "New rating!", body: `Someone rated ${toyTitle} ${stars} star${stars === 1 ? "" : "s"}.`,
    }),
  },
  lt: {
    tradeDidntGoThrough: {title: "Mainai neįvyko", body: "Šis pasiūlymas buvo atmestas arba atšauktas."},
    newTradeOffer: (toyTitle) => ({
      title: "Naujas mainų pasiūlymas!", body: `Kažkas nori išsimainyti jūsų ${toyTitle}.`,
    }),
    offerAccepted: {title: "Pasiūlymas priimtas!", body: "Jūsų mainų pasiūlymas buvo priimtas."},
    shippingInfoShared: {
      title: "Pristatymo informacija pasidalinta",
      body: "Jūsų mainų partneris pasidalino savo pristatymo duomenimis.",
    },
    shipmentUpdateMine: (status) => ({title: "Siuntos atnaujinimas", body: `Jūsų siunta dabar yra ${status}.`}),
    shipmentUpdateTheirs: (status) => ({
      title: "Siuntos atnaujinimas", body: `Jūsų mainų partnerio siunta dabar yra ${status}.`,
    }),
    toyShipped: {title: "Žaislas išsiųstas", body: "Jūsų mainų partneris išsiuntė savo žaislą."},
    toyReceived: {title: "Žaislas gautas", body: "Jūsų žaislo gavimas patvirtintas!"},
    tipReceived: {
      title: "☕ Gautas arbatpinigis",
      body: "Jūsų mainų partneris nupirko jums kavos - ačiū, kad naudojatės ToyTrader!",
    },
    newRating: (toyTitle, stars) => ({
      title: "Naujas įvertinimas!", body: `Kažkas įvertino ${toyTitle} ${stars}/5 žvaigždučių.`,
    }),
  },
  ru: {
    tradeDidntGoThrough: {title: "Обмен не состоялся", body: "Эта сделка была отклонена или отменена."},
    newTradeOffer: (toyTitle) => ({
      title: "Новое предложение обмена!", body: `Кто-то хочет обменять вашу игрушку ${toyTitle}.`,
    }),
    offerAccepted: {title: "Предложение принято!", body: "Ваше предложение обмена было принято."},
    shippingInfoShared: {
      title: "Данные доставки отправлены",
      body: "Ваш партнёр по обмену поделился данными доставки.",
    },
    shipmentUpdateMine: (status) => ({
      title: "Обновление доставки", body: `Статус вашей посылки теперь: ${status}.`,
    }),
    shipmentUpdateTheirs: (status) => ({
      title: "Обновление доставки", body: `Статус посылки вашего партнёра теперь: ${status}.`,
    }),
    toyShipped: {title: "Игрушка отправлена", body: "Ваш партнёр по обмену отправил свою игрушку."},
    toyReceived: {title: "Игрушка получена", body: "Получение вашей игрушки подтверждено!"},
    tipReceived: {
      title: "☕ Получены чаевые",
      body: "Ваш партнёр по обмену угостил вас кофе - спасибо, что пользуетесь ToyTrader!",
    },
    newRating: (toyTitle, stars) => ({
      title: "Новая оценка!", body: `Кто-то оценил ${toyTitle} на ${stars}/5.`,
    }),
  },
};

/**
 * Sends a push notification to every device/browser a user has registered
 * (fcmTokens/{token}, one doc per token - see src/hooks/helper.ts's
 * requestNotificationPermission/syncNotificationLanguage). Tokens are
 * grouped by their own `lang` field (set at registration time, kept in
 * sync when the user switches language in the UI) so each device gets the
 * notification in whatever language it was last registered under - a user
 * signed in on two devices in two different languages gets each worded
 * correctly. Self-cleaning: a token FCM reports as unregistered/invalid
 * gets deleted so this collection doesn't accumulate stale entries from
 * uninstalled browsers/revoked permissions.
 */
async function sendPushToUser(
  uid: string,
  build: (strings: typeof STRINGS["en"]) => { title: string; body: string },
  data?: Record<string, string>
): Promise<void> {
  const db = getFirestore();
  const tokenDocs = await db.collection("fcmTokens").where("uid", "==", uid).get();
  if (tokenDocs.empty) return;

  const groups = new Map<Lang, FirebaseFirestore.QueryDocumentSnapshot[]>();
  tokenDocs.docs.forEach((d) => {
    const lang = normalizeLang(d.data().lang);
    const group = groups.get(lang) ?? [];
    group.push(d);
    groups.set(lang, group);
  });

  const staleTokenDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  await Promise.all([...groups.entries()].map(async ([lang, docs]) => {
    const notification = build(STRINGS[lang]);
    const tokens = docs.map((d) => d.id);
    const response = await getMessaging().sendEachForMulticast({tokens, notification, data});
    logger.info(
      `sendPushToUser: uid=${uid} lang=${lang} title="${notification.title}" tokens=${tokens.length} ` +
      `successes=${response.successCount} failures=${response.failureCount}`
    );
    docs.forEach((d, i) => {
      const error = response.responses[i].error;
      if (error?.code === "messaging/registration-token-not-registered" ||
        error?.code === "messaging/invalid-registration-token") {
        staleTokenDocs.push(d);
      }
    });
  }));

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
          sendPushToUser(before.userInitiated, (s) => s.tradeDidntGoThrough, {offerId: event.params.offerId}),
          sendPushToUser(before.userReceived, (s) => s.tradeDidntGoThrough, {offerId: event.params.offerId}),
        ]);
      }
      return;
    }

    if (!before) {
      // Brand new offer - the toy owner (userReceived) needs to know.
      const title = await toyTitle(db, after.toyTargeted);
      await sendPushToUser(after.userReceived, (s) => s.newTradeOffer(title), {offerId: event.params.offerId});
      return;
    }

    const newlySet = (field: string) => !before[field] && after[field];
    const changed = (field: string) => before[field] !== after[field] && after[field] !== undefined;

    if (newlySet("offerAccepted")) {
      await sendPushToUser(after.userInitiated, (s) => s.offerAccepted, {offerId: event.params.offerId});
    }

    // Shipping name/phone/parcel machine shared on this trade (see
    // src/hooks/helper.ts's shareShippingInfo) - lets the other side know
    // they can go ahead and register/drop off their own shipment.
    if (newlySet("offerShippingName")) {
      await sendPushToUser(after.userReceived, (s) => s.shippingInfoShared, {offerId: event.params.offerId});
    }
    if (newlySet("targetShippingName")) {
      await sendPushToUser(after.userInitiated, (s) => s.shippingInfoShared, {offerId: event.params.offerId});
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
        sendPushToUser(after.userInitiated, (s) => s.shipmentUpdateMine(status), {offerId: event.params.offerId}),
        sendPushToUser(after.userReceived, (s) => s.shipmentUpdateTheirs(status), {offerId: event.params.offerId}),
      ]);
    }
    if (changed("targetShipmentStatus")) {
      const status = formatShipmentStatus(after.targetShipmentStatus);
      await Promise.all([
        sendPushToUser(after.userReceived, (s) => s.shipmentUpdateMine(status), {offerId: event.params.offerId}),
        sendPushToUser(after.userInitiated, (s) => s.shipmentUpdateTheirs(status), {offerId: event.params.offerId}),
      ]);
    }

    if (newlySet("offerPosted")) {
      await sendPushToUser(after.userReceived, (s) => s.toyShipped, {offerId: event.params.offerId});
    }
    if (newlySet("targetPosted")) {
      await sendPushToUser(after.userInitiated, (s) => s.toyShipped, {offerId: event.params.offerId});
    }
    if (newlySet("offerReceived")) {
      await sendPushToUser(after.userInitiated, (s) => s.toyReceived, {offerId: event.params.offerId});
    }
    if (newlySet("targetReceived")) {
      await sendPushToUser(after.userReceived, (s) => s.toyReceived, {offerId: event.params.offerId});
    }

    // Tip is per-trade, payable by either side, first to pay closes it for
    // both (see stripeWebhook in shipment.ts, the only writer of this
    // field) - notify whichever side didn't pay; the payer already knows,
    // they're the one who just paid.
    if (newlySet("tipPaid") && after.tipPaidByUid) {
      const otherUid = after.tipPaidByUid === after.userInitiated ? after.userReceived : after.userInitiated;
      await sendPushToUser(otherUid, (s) => s.tipReceived, {offerId: event.params.offerId});
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
    await sendPushToUser(ownerUid, (s) => s.newRating(title, rating.stars), {offerId: rating.offerId});
  }
);
