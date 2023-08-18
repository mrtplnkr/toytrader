import { signInWithPopup, signOut } from "firebase/auth";
import { collection, DocumentData, getDocs, query, where } from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import { auth, db, facebookProvider, googleProvider, storage } from "../firebase-config";
import { OfferModel } from "../types/offerModel";
import { Toy } from "../types/toy";
import { ToyOffer } from "../types/toyOffer";

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

export const toysCollectionRef = collection(db, "toys");

export const getToyList = async (equals: boolean, uid: string) => {
    try {
        const toyList: Toy[] = [];
        const q = query(toysCollectionRef, where("userId", equals ? "==" : "!=", uid))
        const querySnapshot = await getDocs(q);

        const dataList: DocumentData[] = [];
        querySnapshot.forEach(async (doc) => {
            dataList.push({...doc.data(), id: doc.id});
      });
      
      await Promise.all(dataList.map(async (d) => {
        const filesFolderRef = ref(storage, `projectFiles/${d.file}`);
        const url = await getDownloadURL(filesFolderRef);

        const offerCount = query(toyOffersCollectionRef, where("targetToy", "==", d.id));
        const ocSnapshot = await getDocs(offerCount);
        const offerList: string[] | undefined = [];
        ocSnapshot.forEach(async (doc) => {
            offerList.push(doc.data().targetToy);
        });

        toyList.push({
            id: d.id,
            userId: d.userId,
            title: d.title,
            file: url,
            offers: offerList ? offerList : [],
        });
    }));
      return toyList;
    } catch (err) {
      console.error(err);
      return [];
    }
};

export const toyOffersCollectionRef = collection(db, "offers");
// export const offersCollectionRef = collection(db, "offers", "1", "2");

export const getOfferList = async (toy: string, toyOffers: string[]) => {
    try {
        const toyList: ToyOffer[] = [];

        const dataList: Toy[] = [];
        const toq = query(toysCollectionRef);
        const qs = await getDocs(toq);

        qs.forEach((doc: any) => {
            if (toyOffers.indexOf(doc.id))
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
                toyOffered: toy,
            });
        }));
        return toyList;
    } catch (err) {
      console.error(err);
      return [];
    }
};