import {onCall, HttpsError} from "firebase-functions/v2/https";
import {getApps, initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore} from "firebase-admin/firestore";

if (getApps().length === 0) {
  initializeApp();
}

const REGION = "europe-west1";

interface GetTradePartnerNamesRequest {
  uids: string[];
}

/**
 * Resolves display names (and, for the trade-progress-ladder avatars in
 * myOffers.tsx, profile photos) for the caller's own trade partners -
 * myOffers.tsx names the other side of a trade in its status sentences
 * ("Alex accepted the offer") instead of a generic "the offer was
 * accepted". Firebase Auth user records aren't otherwise readable from the
 * client (only getUserProfiles in admin.ts can, and that's admin-only), so
 * this is a narrower, self-service equivalent: a uid is only resolved if
 * the caller actually shares an offer with it (either side), not an open
 * uid->name lookup. photoURLs only includes uids that actually have one set
 * (Google/Facebook sign-in) - myOffers.tsx falls back to a generic icon.
 */
export const getTradePartnerNames = onCall<GetTradePartnerNamesRequest>(
  {region: REGION},
  async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }

    const {uids} = request.data ?? {};
    if (!Array.isArray(uids) || uids.length === 0) {
      return {names: {} as Record<string, string>, photoURLs: {} as Record<string, string>};
    }

    const db = getFirestore();
    const [initiated, received] = await Promise.all([
      db.collection("offers").where("userInitiated", "==", callerUid).get(),
      db.collection("offers").where("userReceived", "==", callerUid).get(),
    ]);
    const legitimatePartnerUids = new Set<string>();
    initiated.docs.forEach((d) => legitimatePartnerUids.add(d.data().userReceived));
    received.docs.forEach((d) => legitimatePartnerUids.add(d.data().userInitiated));

    const allowedUids = [...new Set(uids)].filter((uid) => legitimatePartnerUids.has(uid));
    if (allowedUids.length === 0) {
      return {names: {} as Record<string, string>, photoURLs: {} as Record<string, string>};
    }

    const result = await getAuth().getUsers(allowedUids.map((uid) => ({uid})));
    const names: Record<string, string> = {};
    const photoURLs: Record<string, string> = {};
    result.users.forEach((u) => {
      names[u.uid] = u.displayName || u.email || u.uid;
      if (u.photoURL) photoURLs[u.uid] = u.photoURL;
    });

    return {names, photoURLs};
  }
);
