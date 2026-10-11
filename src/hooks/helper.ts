import { FacebookAuthProvider, signInWithPopup, signOut, updateProfile } from "firebase/auth";
import { addDoc, collection, deleteDoc, doc, DocumentData, getDocs, or, query, setDoc, Timestamp, updateDoc, where } from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { auth, db, facebookProvider, googleProvider, functions, storage } from "../firebase-config";
import { Offer } from "../types/offer";
import { Toy } from "../types/toy";
import { Rating } from "../types/rating";

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
        const result = await signInWithPopup(auth, facebookProvider);
        // Firebase doesn't reliably populate photoURL for Facebook sign-in -
        // Facebook's Graph API requires the OAuth access token to fetch the
        // profile picture, which Firebase doesn't do automatically. Fetch it
        // ourselves using the token from this sign-in and persist it.
        const credential = FacebookAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
            await updateProfile(result.user, {
                photoURL: `https://graph.facebook.com/me/picture?type=large&access_token=${credential.accessToken}`,
            });
        }
        callback(result.user);
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
        const q = query(toysCollectionRef)
        const querySnapshot = await getDocs(q);

        const dataList: DocumentData[] = [];
        querySnapshot.forEach((doc) => {
            dataList.push({...doc.data(), id: doc.id});
      });

      // Returning (not pushing) from each mapped promise keeps the result
      // array in dataList's original order regardless of which
      // getDownloadURL call resolves first - pushing inside the callback
      // ordered by resolution time instead, so the list's order (and
      // anything tracking a toy by position, e.g. list.tsx) would shuffle
      // on every refetch.
      const toyList: Toy[] = await Promise.all(dataList.map(async (d) => {
        const filesFolderRef = ref(storage, `projectFiles/${d.file}`);
        const url = await getDownloadURL(filesFolderRef);

        return {
            id: d.id,
            userId: d.userId,
            title: d.title,
            file: url,
        };
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
                offerShipmentStatusUpdatedAt: toDate(data, 'offerShipmentStatusUpdatedAt'),
                targetShipmentPaid: toDate(data, 'targetShipmentPaid'),
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

const ratingsCollectionRef = collection(db, "ratings");

// One rating per receipt event - doc id doubles as "has this already been
// rated" (no query needed), and as the Firestore rule's self-attribution
// check (raterUid must match the signed-in user).
export const getRatingList = async (): Promise<Rating[]> => {
    try {
        const ratings: Rating[] = [];
        const querySnapshot = await getDocs(query(ratingsCollectionRef));
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            ratings.push({
                id: doc.id,
                offerId: data.offerId,
                toyId: data.toyId,
                raterUid: data.raterUid,
                stars: data.stars,
                createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
            });
        });
        return ratings;
    } catch (err) {
        console.error(err);
        return [];
    }
};

export const submitRating = async (offerId: string, side: ShipmentSide, toyId: string, stars: number) => {
    await setDoc(doc(db, "ratings", `${offerId}_${side}`), {
        offerId,
        toyId,
        stars,
        raterUid: auth.currentUser?.uid,
        createdAt: Date.now(),
    });
};

const startShipmentCheckoutCallable = httpsCallable<
    { offerId: string, side: ShipmentSide },
    { checkoutUrl: string }
>(functions, "startShipmentCheckout");

// Charges an optional 1 EUR tip to ToyTrader - only callable once the
// backend confirms this side's shipment was received by the other party.
export const startShipmentCheckout = async (offerId: string, side: ShipmentSide) => {
    const result = await startShipmentCheckoutCallable({ offerId, side });
    return result.data;
};

const startDonationCheckoutCallable = httpsCallable<
    { amountCents: number },
    { checkoutUrl: string }
>(functions, "startDonationCheckout");

// A one-off donation from the public landing page - no sign-in or offer
// involved, unlike startShipmentCheckout above.
export const startDonationCheckout = async (amountCents: number) => {
    const result = await startDonationCheckoutCallable({ amountCents });
    return result.data;
};

// Self-reported: the user registers their own shipment directly on Omniva's
// site (no business contract needed there) and enters the resulting barcode
// here themselves - same trust model as markToyPosted/markToyReceived.
export const submitOmnivaBarcode = async (
    id: string,
    side: ShipmentSide,
    barcode: string,
    toySize?: string
) => {
    const docToUpdate = doc(db, "offers", id);
    await updateDoc(docToUpdate, {
        [`${side}ShipmentBarcode`]: barcode,
        [`${side}ShipmentToySize`]: toySize ?? null,
        [`${side}ShipmentStatus`]: "REGISTERED",
        [`${side}ShipmentStatusUpdatedAt`]: Date.now(),
    });
};

const recheckShipmentPaymentCallable = httpsCallable<
    { offerId: string, side: ShipmentSide },
    { paid: boolean }
>(functions, "recheckShipmentPayment");

// Recovery path if the Stripe webhook never processed a successful payment -
// looks up the real Stripe session status and reconciles Firestore. Never
// creates a new charge.
export const recheckShipmentPayment = async (offerId: string, side: ShipmentSide) => {
    const result = await recheckShipmentPaymentCallable({ offerId, side });
    return result.data;
};

export interface ShippingPrice {
    priceCents: number;
    currency: string;
}

const getShippingPriceCallable = httpsCallable<
    { toySize: string },
    ShippingPrice
>(functions, "getShippingPrice");

export const getShippingPrice = async (toySize: string) => {
    const result = await getShippingPriceCallable({ toySize });
    return result.data;
};

export const isAuthLoading = () => {
    if (auth.currentUser) return false;
    else return true;
}