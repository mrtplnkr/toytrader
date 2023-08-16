import { signInWithPopup, signOut } from "firebase/auth";
import { collection, DocumentData, getDocs, query, where } from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import { auth, db, facebookProvider, googleProvider, storage } from "../firebase-config";
import { Toy } from "../types/toy";

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
        
        toyList.push({
            id: d.id,
            userId: d.userId,
            title: d.title,
            file: url,
        });
    }));
      return toyList;
    } catch (err) {
      console.error(err);
      return [];
    }
};

export const offersCollectionRef = collection(db, "offers");

export const getOfferList = async (id: string) => {
    try {
        const toyList: Toy[] = [];
        const q = query(offersCollectionRef, where("targetId", "==", id))
        const querySnapshot = await getDocs(q);

        const offeredItemIds: DocumentData[] = [];
        querySnapshot.forEach((doc) => {
            offeredItemIds.push(doc.data().destinationToy);
        });

        const dataList: Toy[] = [];
        const toq = query(toysCollectionRef, where("id", "==", offeredItemIds));
        const qs = await getDocs(toq);

        qs.forEach((doc: any) => {
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
            });
        }));
        return toyList;
    } catch (err) {
      console.error(err);
      return [];
    }
};