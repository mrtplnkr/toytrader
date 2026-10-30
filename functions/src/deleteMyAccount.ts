import {onCall, HttpsError} from "firebase-functions/v2/https";
import {getApps, initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {deleteAllDataFor} from "./deleteMyData";

if (getApps().length === 0) {
  initializeApp();
}

const REGION = "europe-west1";

/**
 * Self-service account deletion: runs the same data deletion as
 * deleteMyData, then permanently deletes the caller's Firebase Auth
 * account (unlike banUser in admin.ts, which only disables it). The
 * client's existing ID token keeps working for up to an hour after this -
 * Firebase doesn't revoke tokens on user deletion - so the client must
 * sign out immediately after a successful call here.
 */
export const deleteMyAccount = onCall<void>(
  {region: REGION},
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }

    const result = await deleteAllDataFor(uid);
    await getAuth().deleteUser(uid);
    return result;
  }
);
