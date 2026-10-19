// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { connectAuthEmulator, getAuth, FacebookAuthProvider, GoogleAuthProvider } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { getMessaging, isSupported as isMessagingSupported, Messaging } from "firebase/messaging";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// The public half of the Web Push certificate (Project Settings > Cloud
// Messaging > Web Push certificates in the Firebase Console - the CLI has no
// command for this, it's a one-time manual step). Safe to commit: this is
// the PUBLIC key, same trust level as the rest of this file's config -
// Firebase's infra holds the private half.
export const VAPID_KEY = "BPYWeiqxJjRjgoom9QvFdox0ABNIY_JuAM-KRReqmwcQuVfNyou3Si6n8txBb7sCmbqTroglE5ZE_xJpNWmYeXM";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAnTyORfOZdmU8GqK7MRof2aAy2JUgTPKM",
  authDomain: "toystrader-a494f.firebaseapp.com",
  projectId: "toystrader-a494f",
  storageBucket: "toystrader-a494f.appspot.com",
  messagingSenderId: "267868385149",
  appId: "1:267868385149:web:96d5672eabeba4b4efe614",
  measurementId: "G-WGYN2J08TG",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const facebookProvider = new FacebookAuthProvider();
export const googleProvider = new GoogleAuthProvider();
export const auth = getAuth(app);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, "europe-west1");

// Messaging needs a browser capability check (isSupported() - Safari has
// historically had gaps) before it's safe to call getMessaging() at all, so
// this is lazy/on-demand rather than initialized eagerly like the exports
// above - callers (src/hooks/helper.ts) await this instead of importing a
// plain instance.
let messagingInstance: Messaging | null | undefined;
export async function getMessagingIfSupported(): Promise<Messaging | null> {
  if (messagingInstance === undefined) {
    messagingInstance = (await isMessagingSupported()) ? getMessaging(app) : null;
  }
  return messagingInstance;
}

// Point the SDK at the local Firebase Emulator Suite instead of production
// when explicitly opted in (see firebase.json for the emulator ports) -
// used by the Playwright e2e suite (see playwright.config.ts) so tests never
// touch the real toystrader-a494f project.
if (process.env.REACT_APP_USE_FIREBASE_EMULATORS === "true") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}

console.log('analytics', analytics);
