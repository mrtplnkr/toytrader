import { signInWithPopup, signOut } from "firebase/auth";
import { addDoc, collection, doc, DocumentData, documentId, FieldPath, getDocs, or, query, Timestamp, updateDoc, where } from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import { auth, db, facebookProvider, googleProvider, storage } from "../firebase-config";
import { Offer } from "../types/offer";
import { Toy } from "../types/toy";

export const logOff = async () => {
    await signOut(auth);
};
export const checkStatus = async () => {
    return await auth.onAuthStateChanged((e) => {
        return e;
    });
}
export const googleSign = async (callback: any) => {
    try {
        const user = await signInWithPopup(auth, googleProvider);
        callback(user);
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
        console.log('facebook signIn error' + (err as Error).message);
    }
    return true;
};

export const toysCollectionRef = collection(db, "toys");

export const addNewToy = async (title: string, file: string) => {
    await addDoc(toysCollectionRef, {
        title,
        file: file,
        userId: auth.currentUser?.uid,
    });
}

export const addNewOffer = async (toyOffered: string, toyTargeted: string, userReceived: string) => {
    await addDoc(toyOffersCollectionRef, {
        toyTargeted,
        toyOffered,
        userInitiated: auth.currentUser?.uid,
        userReceived,
        offerCreated: Date.now(),
    });
}

export const getToyList = async () => {
    try {
        const toyList: Toy[] = [];
        const q = query(toysCollectionRef)
        const querySnapshot = await getDocs(q);

        const dataList: DocumentData[] = [];
        querySnapshot.forEach(async (doc) => {
            dataList.push({...doc.data(), id: doc.id});
      });
      
      await Promise.all(dataList.map(async (d) => {
        const filesFolderRef = ref(storage, `projectFiles/${d.file}`);
        const url = await getDownloadURL(filesFolderRef);

        toyList.push({
            id: d.id,
            userId: d.userId,
            title: d.title,
            file: url,
            // offers: offerList ? offerList : [],
        });
      }));
      return toyList;
    } catch (err) {
      console.error(err);
      return [];
    }
};

export const toyOffersCollectionRef = collection(db, "offers");

export const getOfferList = async (userId: string) => {
    try {
        const offers: Offer[] = [];

        const toq = query(toyOffersCollectionRef, 
            or(where('userReceived', "==", userId), where('userInitiated', "==", userId)));
        const qs = await getDocs(toq);

        qs.forEach((doc: any) => {
            offers.push({...doc.data(), id: doc.id,
                offerCreated:doc.data().offerCreated ?
                    new Timestamp(doc.data().offerCreated.seconds, doc.data().offerCreated.nanoseconds).toDate() : undefined,
                offerReceived:doc.data().offerReceived ?
                    new Timestamp(doc.data().offerReceived.seconds, doc.data().offerReceived.nanoseconds).toDate() : undefined,
                offerAccepted:doc.data().offerAccepted ?
                    new Timestamp(doc.data().offerAccepted.seconds, doc.data().offerAccepted.nanoseconds).toDate() : undefined });
        });

        console.log('offers received', offers);
        return offers;
    } catch (err) {
      console.error(err);
      return [];
    }
};

export const updateOffer = async (id: string) => {
    const docToUpdate = doc(db, "offers", id)
    await updateDoc(docToUpdate, {"offerAccepted": Date.now()});
};

export const isAuthLoading = () => {
    if (auth.currentUser) return false;
    else return true;
}