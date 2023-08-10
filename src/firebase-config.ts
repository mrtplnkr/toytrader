// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, FacebookAuthProvider, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

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

console.log('analytics', analytics);
