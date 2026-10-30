import {onCall, HttpsError} from "firebase-functions/v2/https";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import {deleteProjectFiles, toyFileNames} from "./storageCleanup";

if (getApps().length === 0) {
  initializeApp();
}

const REGION = "europe-west1";

export interface DataDeletionResult {
  toysDeleted: number;
  toysKept: number;
}

/**
 * Deletes everything that's safely a given user's alone (toy listings not
 * tied to any trade, their shipping profile, their push-notification
 * tokens, ratings they've given, complaints they've filed), and anonymizes
 * their self-reported shipping name/phone on any offer instead of deleting
 * the offer itself - the other trader's view of a shared trade shouldn't
 * disappear because this user's data is gone. Never touches the Firebase
 * Auth account - shared by deleteMyData (data only) and deleteMyAccount
 * (data + account) below.
 */
export async function deleteAllDataFor(uid: string): Promise<DataDeletionResult> {
  const db = getFirestore();

  const theirToysQ = db.collection("toys").where("userId", "==", uid).get();
  const initiatedOffersQ = db.collection("offers").where("userInitiated", "==", uid).get();
  const receivedOffersQ = db.collection("offers").where("userReceived", "==", uid).get();
  const theirRatingsQ = db.collection("ratings").where("raterUid", "==", uid).get();
  const theirComplaintsQ = db.collection("complaints").where("reporterUid", "==", uid).get();
  const theirTokensQ = db.collection("fcmTokens").where("uid", "==", uid).get();
  const shippingProfileQ = db.collection("shippingProfiles").doc(uid).get();

  const [theirToys, initiatedOffers, receivedOffers, theirRatings, theirComplaints, theirTokens, shippingProfileSnap] =
    await Promise.all([
      theirToysQ, initiatedOffersQ, receivedOffersQ, theirRatingsQ, theirComplaintsQ, theirTokensQ, shippingProfileQ,
    ]);

  // A toy referenced by any offer - even a long-completed trade - stays, so
  // the other trader's history doesn't lose its record. Same restriction
  // myToys.tsx's own delete button already enforces.
  const tradedToyIds = new Set<string>();
  [...initiatedOffers.docs, ...receivedOffers.docs].forEach((d) => {
    tradedToyIds.add(d.data().toyOffered);
    tradedToyIds.add(d.data().toyTargeted);
  });

  const batch = db.batch();
  let toysDeleted = 0;
  let toysKept = 0;
  const fileNamesToDelete: string[] = [];
  theirToys.docs.forEach((d) => {
    if (tradedToyIds.has(d.id)) {
      toysKept++;
    } else {
      batch.delete(d.ref);
      fileNamesToDelete.push(...toyFileNames(d.data()));
      toysDeleted++;
    }
  });

  initiatedOffers.docs.forEach((d) => batch.update(d.ref, {
    offerShippingName: FieldValue.delete(),
    offerShippingPhone: FieldValue.delete(),
  }));
  receivedOffers.docs.forEach((d) => batch.update(d.ref, {
    targetShippingName: FieldValue.delete(),
    targetShippingPhone: FieldValue.delete(),
  }));

  theirRatings.docs.forEach((d) => batch.delete(d.ref));
  theirComplaints.docs.forEach((d) => batch.delete(d.ref));
  theirTokens.docs.forEach((d) => batch.delete(d.ref));
  if (shippingProfileSnap.exists) {
    batch.delete(shippingProfileSnap.ref);
  }

  await batch.commit();

  const complaintPhotos = theirComplaints.docs
    .map((d) => d.data().photoFile)
    .filter((f): f is string => !!f);
  await deleteProjectFiles([...fileNamesToDelete, ...complaintPhotos]);

  return {toysDeleted, toysKept};
}

function requireCallerUid(request: {auth?: {uid?: string}}): string {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }
  return uid;
}

/**
 * Self-service: deletes the caller's own data (see deleteAllDataFor above)
 * without touching their Firebase Auth account - they stay signed in and
 * can keep using ToyTrader right after.
 */
export const deleteMyData = onCall<void>(
  {region: REGION},
  async (request) => deleteAllDataFor(requireCallerUid(request))
);
