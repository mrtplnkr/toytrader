import {onCall, HttpsError} from "firebase-functions/v2/https";
import {getApps, initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import {deleteProjectFiles, toyFileNames} from "./storageCleanup";

if (getApps().length === 0) {
  initializeApp();
}

const REGION = "europe-west1";

function requireAdmin(request: {auth?: {uid?: string, token?: Record<string, unknown>}}): string {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }
  if (request.auth.token?.admin !== true) {
    throw new HttpsError("permission-denied", "Admin only.");
  }
  return request.auth.uid;
}

interface BanUserRequest {
  uid: string;
  reason?: string;
}

/**
 * Bans a user: disables their Firebase Auth account (blocks sign-in
 * immediately), records the ban in Firestore (checked by firestore.rules on
 * toys/offers writes, so an already-issued ID token can't keep posting
 * during its remaining lifetime), and deletes every toy they've listed -
 * a ban removes their whole presence, not just whichever listing triggered
 * it.
 */
export const banUser = onCall<BanUserRequest>(
  {region: REGION},
  async (request) => {
    const adminUid = requireAdmin(request);

    const {uid, reason} = request.data ?? {};
    if (!uid) {
      throw new HttpsError("invalid-argument", "uid is required.");
    }

    await getAuth().updateUser(uid, {disabled: true});

    const db = getFirestore();
    await db.collection("bannedUsers").doc(uid).set({
      bannedAt: FieldValue.serverTimestamp(),
      bannedBy: adminUid,
      reason: reason ?? null,
    });

    const theirToys = await db.collection("toys").where("userId", "==", uid).get();
    const batch = db.batch();
    theirToys.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    const fileNames = theirToys.docs.flatMap((d) => toyFileNames(d.data()));
    await deleteProjectFiles(fileNames);

    return {bannedToyCount: theirToys.size};
  }
);

interface UnbanUserRequest {
  uid: string;
}

/**
 * Reverses banUser - re-enables sign-in and clears the ban record. Doesn't
 * restore deleted toys (the user would need to re-list them).
 */
export const unbanUser = onCall<UnbanUserRequest>(
  {region: REGION},
  async (request) => {
    requireAdmin(request);

    const {uid} = request.data ?? {};
    if (!uid) {
      throw new HttpsError("invalid-argument", "uid is required.");
    }

    await getAuth().updateUser(uid, {disabled: false});
    await getFirestore().collection("bannedUsers").doc(uid).delete();

    return {ok: true};
  }
);

interface RemoveToyRequest {
  toyId: string;
}

/**
 * Removes a single listing without banning its owner - for a one-off bad
 * listing where the whole account doesn't warrant a ban. Doesn't touch any
 * offers referencing this toy, same as banUser's bulk toy deletion above.
 */
export const removeToy = onCall<RemoveToyRequest>(
  {region: REGION},
  async (request) => {
    requireAdmin(request);

    const {toyId} = request.data ?? {};
    if (!toyId) {
      throw new HttpsError("invalid-argument", "toyId is required.");
    }

    const toyRef = getFirestore().collection("toys").doc(toyId);
    const toySnap = await toyRef.get();
    const toyData = toySnap.data();
    await toyRef.delete();
    if (toyData) {
      await deleteProjectFiles(toyFileNames(toyData));
    }

    return {ok: true};
  }
);

interface GetUserProfilesRequest {
  uids: string[];
}

interface UserProfile {
  uid: string;
  email?: string;
  displayName?: string;
}

/**
 * Resolves uids to email/displayName for the admin review page - Toy docs
 * only carry a raw userId, and Firebase Auth user records aren't otherwise
 * readable from the client.
 */
export const getUserProfiles = onCall<GetUserProfilesRequest>(
  {region: REGION},
  async (request) => {
    requireAdmin(request);

    const {uids} = request.data ?? {};
    if (!Array.isArray(uids) || uids.length === 0) {
      return {profiles: [] as UserProfile[]};
    }

    const result = await getAuth().getUsers(uids.map((uid) => ({uid})));
    const profiles: UserProfile[] = result.users.map((u) => ({
      uid: u.uid,
      email: u.email,
      displayName: u.displayName,
    }));

    return {profiles};
  }
);
