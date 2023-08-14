import { signInWithPopup, signOut } from "firebase/auth";
import { auth, facebookProvider, googleProvider } from "../firebase-config";

export const logOff = async () => {
    await signOut(auth);
};
export const checkStatus = async () => {
    return await auth.onAuthStateChanged((e) => {
        console.log('eee', e);
        return e;
    });
}
export const googleSign = async (callback: any) => {
    try {
        await signInWithPopup(auth, googleProvider)
        callback();
    } catch (err) {
        throw new Error('google signIn error' + (err as Error).message);
    }
    return true;
};
export const facebookSign = async (callback: any) => {
    try {
        await signInWithPopup(auth, facebookProvider);
        callback();
    } catch (err) {
        throw new Error('facebook signIn error' + (err as Error).message);
    }
    return true;
};
