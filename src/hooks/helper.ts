import { FacebookAuthProvider, signInWithPopup, signOut, updateProfile } from "firebase/auth";
import { addDoc, collection, deleteDoc, doc, DocumentData, getDoc, getDocs, or, query, setDoc, Timestamp, updateDoc, where } from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { auth, db, facebookProvider, googleProvider, functions, storage } from "../firebase-config";
import { Offer } from "../types/offer";
import { Toy } from "../types/toy";
import { Rating } from "../types/rating";
import { Complaint } from "../types/complaint";
import { ShippingProfile } from "../types/shippingProfile";

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

// Firebase Auth custom claims aren't included on the base User object - they
// only show up after decoding the ID token, and only reflect a claim grant
// once the token's been refreshed since that grant (getIdTokenResult's
// second arg forces that refresh rather than waiting for the ~1hr natural one).
export const checkIsAdmin = async (): Promise<boolean> => {
    const user = auth.currentUser;
    if (!user) return false;
    const result = await user.getIdTokenResult(true);
    return result.claims.admin === true;
};

interface UserProfile {
    uid: string;
    email?: string;
    displayName?: string;
}

const getUserProfilesCallable = httpsCallable<
    { uids: string[] },
    { profiles: UserProfile[] }
>(functions, "getUserProfiles");

export const getUserProfiles = async (uids: string[]) => {
    const result = await getUserProfilesCallable({ uids });
    return result.data.profiles;
};

const banUserCallable = httpsCallable<
    { uid: string, reason?: string },
    { bannedToyCount: number }
>(functions, "banUser");

// Disables the user's account, removes every toy they've listed, and
// records the ban so firestore.rules can keep rejecting writes from an
// already-issued token during its remaining lifetime - see
// functions/src/admin.ts.
export const banUser = async (uid: string, reason?: string) => {
    const result = await banUserCallable({ uid, reason });
    return result.data;
};

const unbanUserCallable = httpsCallable<{ uid: string }, { ok: boolean }>(functions, "unbanUser");

export const unbanUser = async (uid: string) => {
    await unbanUserCallable({ uid });
};

// Looks up a single offer directly by id, independent of getOfferList's
// current-user scoping (that query is `where userReceived/userInitiated ==
// uid`, so it only ever returns the signed-in user's own trades) - offers
// have no ownership check on read, so this works for any offer, which is
// what the admin page needs to show trade context for someone else's
// complaint.
export const getOfferById = async (offerId: string): Promise<Offer | undefined> => {
    const snap = await getDoc(doc(db, "offers", offerId));
    if (!snap.exists()) return undefined;
    const data = snap.data();
    return { ...data, id: snap.id } as Offer;
};

const complaintsCollectionRef = collection(db, "complaints");

// photoFile is a Storage object name under projectFiles/ (same upload
// convention as addNewToy.tsx/profile.tsx), not a resolved URL - resolved
// lazily on read, same as Toy.file.
export const submitComplaint = async (offerId: string, reportedUid: string, message: string, photoFile?: string) => {
    await addDoc(complaintsCollectionRef, {
        offerId,
        reportedUid,
        reporterUid: auth.currentUser?.uid,
        message,
        photoFile: photoFile ?? null,
        createdAt: Date.now(),
    });
};

// Admin-only in practice: firestore.rules only lets a non-admin read back
// complaints they filed themselves, so an unfiltered fetch like this only
// succeeds for an admin account - see src/pages/admin.tsx.
export const getComplaintList = async (): Promise<Complaint[]> => {
    const querySnapshot = await getDocs(query(complaintsCollectionRef));
    const complaints: Complaint[] = [];
    await Promise.all(querySnapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        let photoUrl: string | undefined;
        if (data.photoFile) {
            try {
                photoUrl = await getDownloadURL(ref(storage, `projectFiles/${data.photoFile}`));
            } catch (err) {
                photoUrl = undefined;
            }
        }
        complaints.push({
            id: docSnap.id,
            offerId: data.offerId,
            reporterUid: data.reporterUid,
            reportedUid: data.reportedUid,
            message: data.message,
            photoFile: photoUrl,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
        });
    }));
    return complaints;
};

export interface ParcelMachine {
    id: string;
    name: string;
    address: string;
    countryCode: string;
    type: string;
    lat: number;
    lng: number;
}

const listParcelMachinesCallable = httpsCallable<
    Record<string, never>,
    { machines: ParcelMachine[], fetchedAt: string }
>(functions, "listParcelMachines");

export const listParcelMachines = async () => {
    const result = await listParcelMachinesCallable({});
    return result.data.machines;
};

const shippingProfileDocRef = (uid: string) => doc(db, "shippingProfiles", uid);

export const getShippingProfile = async (): Promise<ShippingProfile | undefined> => {
    const uid = auth.currentUser?.uid;
    if (!uid) return undefined;
    const snap = await getDoc(shippingProfileDocRef(uid));
    return snap.exists() ? (snap.data() as ShippingProfile) : undefined;
};

export const saveShippingProfile = async (profile: ShippingProfile) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    await setDoc(shippingProfileDocRef(uid), profile);
};

// Copies a user's saved ShippingProfile onto this specific offer's
// ${side}-prefixed fields, self-reported same as the barcode fields - this
// is what actually becomes visible to the other trader (the private
// shippingProfiles doc itself never is).
export const shareShippingInfo = async (offerId: string, side: ShipmentSide, profile: ShippingProfile) => {
    await updateDoc(doc(db, "offers", offerId), {
        [`${side}ShippingName`]: profile.name,
        [`${side}ShippingPhone`]: profile.phone,
        [`${side}ShippingParcelMachineId`]: profile.parcelMachineId,
        [`${side}ShippingParcelMachineLabel`]: profile.parcelMachineLabel,
    });
};