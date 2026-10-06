import { signInWithPopup, signOut } from "firebase/auth";
import { addDoc, collection, deleteDoc, doc, DocumentData, getDocs, or, query, Timestamp, updateDoc, where } from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { auth, db, facebookProvider, googleProvider, functions, storage } from "../firebase-config";
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

        // Firestore Timestamp fields (written server-side via serverTimestamp(),
        // e.g. the Stripe webhook's writes) come back as Timestamp instances.
        // Fields written client-side via Date.now() (offerCreated, offerAccepted,
        // offerPosted/Received, targetPosted/Received) come back as plain
        // numbers instead - treating every value as Timestamp-shaped produced
        // "Invalid Date" for those. Handle both shapes.
        const toDate = (data: DocumentData, field: string) => {
            const value = data[field];
            if (value === undefined || value === null) return undefined;
            if (value instanceof Timestamp) return value.toDate();
            if (typeof value === 'number') return new Date(value);
            return new Timestamp(value.seconds, value.nanoseconds).toDate();
        };

        qs.forEach((doc: any) => {
            const data = doc.data();
            offers.push({...data, id: doc.id,
                offerCreated: toDate(data, 'offerCreated'),
                offerAccepted: toDate(data, 'offerAccepted'),
                offerPosted: toDate(data, 'offerPosted'),
                offerReceived: toDate(data, 'offerReceived'),
                targetPosted: toDate(data, 'targetPosted'),
                targetReceived: toDate(data, 'targetReceived'),
                offerShipmentPaid: toDate(data, 'offerShipmentPaid'),
                offerShipmentQrIssuedAt: toDate(data, 'offerShipmentQrIssuedAt'),
                offerShipmentStatusUpdatedAt: toDate(data, 'offerShipmentStatusUpdatedAt'),
                targetShipmentPaid: toDate(data, 'targetShipmentPaid'),
                targetShipmentQrIssuedAt: toDate(data, 'targetShipmentQrIssuedAt'),
                targetShipmentStatusUpdatedAt: toDate(data, 'targetShipmentStatusUpdatedAt'),
            });
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

export const declineOffer = async (id: string) => {
    await deleteDoc(doc(db, "offers", id));
};

export type ShipmentSide = "offer" | "target";

// Marks physical drop-off/pickup of one side's toy. "side" means which toy
// (offer = toyOffered, target = toyTargeted), not who is acting - e.g. the
// person *receiving* toyOffered is the one who calls markToyReceived(id,
// "offer"), same as offerShipmentBarcode etc. already work.
export const markToyPosted = async (id: string, side: ShipmentSide) => {
    const docToUpdate = doc(db, "offers", id);
    await updateDoc(docToUpdate, {[`${side}Posted`]: Date.now()});
};

export const markToyReceived = async (id: string, side: ShipmentSide) => {
    const docToUpdate = doc(db, "offers", id);
    await updateDoc(docToUpdate, {[`${side}Received`]: Date.now()});
};

const startShipmentCheckoutCallable = httpsCallable<
    { offerId: string, side: ShipmentSide, parcelMachineId: string, toySize: string },
    { checkoutUrl: string }
>(functions, "startShipmentCheckout");

export const startShipmentCheckout = async (
    offerId: string,
    side: ShipmentSide,
    parcelMachineId: string,
    toySize: string
) => {
    const result = await startShipmentCheckoutCallable({ offerId, side, parcelMachineId, toySize });
    return result.data;
};

export interface ParcelMachine {
    id: string;
    name: string;
    address: string;
    countryCode: string;
    type: string;
}

const listParcelMachinesCallable = httpsCallable<
    Record<string, never>,
    { machines: ParcelMachine[], fetchedAt: string }
>(functions, "listParcelMachines");

export const listParcelMachines = async () => {
    const result = await listParcelMachinesCallable({});
    return result.data.machines;
};

export const isAuthLoading = () => {
    if (auth.currentUser) return false;
    else return true;
}