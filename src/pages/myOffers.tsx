import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Store } from "react-notifications-component";
import { auth } from "../firebase-config";
import { Offer } from "../types/offer";
import { GoodAppContext } from "../hooks/context";
import { useContextSelector } from "use-context-selector";
import { Toy } from "../types/toy";
import { Rating } from "../types/rating";
import { ParcelMachine, ShipmentSide, ShippingPrice, declineOffer, getShippingPrice, getShippingProfile, markToyPosted, markToyReceived, saveShippingProfile, shareShippingInfo, startShipmentCheckout, submitOmnivaBarcode, submitRating, updateOffer } from "../hooks/helper";
import { ShippingProfile } from "../types/shippingProfile";
import ParcelMachinePicker from "../components/parcelMachinePicker";
import { DEFAULT_TOY_SIZE, OMNIVA_PRICE_LIST_URL, OMNIVA_SEND_PARCEL_URL, TOY_SIZES, ToySize } from "../constants/omnivaPricing";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar as faStarSolid } from "@fortawesome/free-solid-svg-icons";
import { faStar as faStarRegular } from "@fortawesome/free-regular-svg-icons";

const newToy = 'https://images.thewest.com.au/publication/C-7139668/f9b8852d964a8de53d6089791d3e176fbb732976-16x9-x0y723w3000h1688.jpg';
interface HistoryItem {
    id: string,
    toyIOffered: Toy;
    status: string;
    toyTargeted: Toy;
    mySide: ShipmentSide;
    otherSide: ShipmentSide;
    isAccepted: boolean;
    isMyTurnToPay: boolean;
    isMyTurnToRespond: boolean;
    canSubmitBarcode: boolean;
    canMarkPosted: boolean;
    canMarkReceived: boolean;
    canCancel: boolean;
    awaitingOtherRegistration: boolean;
    canRate: boolean;
    toyToRate?: Toy;
    myShipmentBarcode?: string;
    myShipmentStatus?: string;
    hasSharedMyShipping: boolean;
    otherShippingName?: string;
    otherShippingPhone?: string;
    otherShippingParcelMachineLabel?: string;
}

enum Status {
    created, pending, accepted, posted, received
}

function MyOffersPage() {
    let navigate = useNavigate();

    const refresh = useContextSelector(GoodAppContext, (state: any) => state.refresh);

    useEffect(() => {
      refresh();
    }, [refresh]);

    const toys = useContextSelector(GoodAppContext, (state: any) => state.toys);
    const offers = useContextSelector(GoodAppContext, (state: any) => state.offers);
    const ratings = useContextSelector(GoodAppContext, (state: any) => state.ratings);

    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [payingId, setPayingId] = useState<string | undefined>();
    const [respondingId, setRespondingId] = useState<string | undefined>();
    const [markingId, setMarkingId] = useState<string | undefined>();
    const [submittingBarcodeId, setSubmittingBarcodeId] = useState<string | undefined>();
    const [selectedCountryByOfferId, setSelectedCountryByOfferId] = useState<Record<string, string>>({});
    const [selectedSizeByOfferId, setSelectedSizeByOfferId] = useState<Record<string, ToySize>>({});
    const [quoteByOfferId, setQuoteByOfferId] = useState<Record<string, ShippingPrice | 'loading' | 'error'>>({});
    const [barcodeInputByOfferId, setBarcodeInputByOfferId] = useState<Record<string, string>>({});
    const [starsByOfferId, setStarsByOfferId] = useState<Record<string, number>>({});
    const [submittingRatingId, setSubmittingRatingId] = useState<string | undefined>();
    const [dismissedRatingIds, setDismissedRatingIds] = useState<Set<string>>(new Set());
    const [dismissedTipIds, setDismissedTipIds] = useState<Set<string>>(new Set());
    const [myShippingProfile, setMyShippingProfile] = useState<ShippingProfile | undefined>();
    const [sharingShippingId, setSharingShippingId] = useState<string | undefined>();
    // Inline fallback for a user placing their first trade with no saved
    // profile yet - not enforced (setting one up on /profile beforehand is
    // still the normal path), just an alternative that avoids a detour.
    const [shippingSetupName, setShippingSetupName] = useState<Record<string, string>>({});
    const [shippingSetupPhone, setShippingSetupPhone] = useState<Record<string, string>>({});
    const [shippingSetupMachine, setShippingSetupMachine] = useState<Record<string, ParcelMachine>>({});

    useEffect(() => {
        getShippingProfile().then(setMyShippingProfile);
    }, []);

    useEffect(() => {
        let history:HistoryItem[] = [];
        const uid = auth.currentUser?.uid;

        offers.forEach((o: Offer) => {
            const isInitiator = o.userInitiated === uid;
            const isReceiver = o.userReceived === uid;
            if (!isInitiator && !isReceiver) return;

            // Defensive: a referenced toy can go missing (e.g. deleted before
            // the delete-time guard in myToys.tsx existed, or any other stale
            // reference) - skip rather than crash the whole page on everyone's
            // offer list.
            const toyIOffered = toys.find((x: Toy) => x.id === o.toyOffered);
            const toyTargeted = toys.find((x: Toy) => x.id === o.toyTargeted);
            if (!toyIOffered || !toyTargeted) return;

            const mySide: ShipmentSide = isInitiator ? 'offer' : 'target';
            const otherSide: ShipmentSide = mySide === 'offer' ? 'target' : 'offer';
            const myPosted = mySide === 'offer' ? o.offerPosted : o.targetPosted;
            const myShipmentPaid = mySide === 'offer' ? o.offerShipmentPaid : o.targetShipmentPaid;
            const myShipmentBarcode = mySide === 'offer' ? o.offerShipmentBarcode : o.targetShipmentBarcode;
            const myShipmentStatus = mySide === 'offer' ? o.offerShipmentStatus : o.targetShipmentStatus;
            // "My shipment was confirmed received" uses the SAME prefix as
            // mySide (not otherSide) - offerReceived tracks toyOffered's
            // receipt, i.e. the initiator's own shipment succeeding.
            const myReceived = mySide === 'offer' ? o.offerReceived : o.targetReceived;
            // The toy I'm waiting to receive is the *other* side's toy -
            // its shipper marks it posted, I mark it received.
            const otherSidePosted = otherSide === 'offer' ? o.offerPosted : o.targetPosted;
            const otherSideReceived = otherSide === 'offer' ? o.offerReceived : o.targetReceived;
            const otherSideShipmentBarcode = otherSide === 'offer' ? o.offerShipmentBarcode : o.targetShipmentBarcode;
            const otherSideShipmentStatus = otherSide === 'offer' ? o.offerShipmentStatus : o.targetShipmentStatus;
            // The toy *I* just received is the other side's toy - same
            // otherSide-prefixed fields as otherSidePosted/otherSideReceived
            // above, since "otherSideReceived" becomes true exactly when I
            // click "Mark the other toy as received".
            const toyIReceived = otherSide === 'offer' ? toyIOffered : toyTargeted;
            const alreadyRated = ratings.some((r: Rating) => r.id === `${o.id}_${otherSide}`);
            const myShippingName = mySide === 'offer' ? o.offerShippingName : o.targetShippingName;
            const otherShippingName = otherSide === 'offer' ? o.offerShippingName : o.targetShippingName;
            const otherShippingPhone = otherSide === 'offer' ? o.offerShippingPhone : o.targetShippingPhone;
            const otherShippingParcelMachineLabel = otherSide === 'offer' ?
                o.offerShippingParcelMachineLabel : o.targetShippingParcelMachineLabel;

            history.push({
                id: o.id,
                mySide,
                otherSide,
                myShipmentBarcode,
                myShipmentStatus,
                hasSharedMyShipping: !!myShippingName,
                otherShippingName,
                otherShippingPhone,
                otherShippingParcelMachineLabel,
                isAccepted: !!o.offerAccepted,
                // The optional 1 EUR tip only becomes offerable after a
                // successful trade - once the toy I shipped is confirmed
                // received. Entirely voluntary - nothing else depends on it.
                isMyTurnToPay: !!myReceived && !myShipmentPaid,
                isMyTurnToRespond: isReceiver && !o.offerAccepted,
                canSubmitBarcode: !!o.offerAccepted && (!myShipmentBarcode || myShipmentStatus === 'RETURNED'),
                // Posting is gated on the other side having also registered
                // with Omniva - mutual real-world commitment, replacing the
                // old payment-based gate now that payment happens at the
                // end, not the start. A RETURNED shipment counts as "not
                // posted" again so there's a way to re-attempt it.
                canMarkPosted: !!myShipmentBarcode && (!myPosted || myShipmentStatus === 'RETURNED') && !!otherSideShipmentBarcode,
                awaitingOtherRegistration: !!myShipmentBarcode && (!myPosted || myShipmentStatus === 'RETURNED') && !otherSideShipmentBarcode,
                canMarkReceived: !!otherSidePosted && !otherSideReceived,
                // Cancellable any time before either toy has physically shipped -
                // once posted, the parcel's in Omniva's hands and can't be recalled.
                canCancel: !o.offerPosted && !o.targetPosted,
                canRate: !!otherSideReceived && !alreadyRated,
                toyToRate: toyIReceived,
                toyIOffered,
                status: `<li>${isInitiator ?
                            `you offered your <a href="${newToy}" target="_target">toy</a>` :
                            `you received an offer for your <a href="${newToy}" target="_target">toy</a>`}
                            on ${(o.offerCreated as Date).toDateString()}</li>
                    ${o.offerAccepted ?
                        `<li>the offer was accepted on ${(o.offerAccepted as Date).toDateString()}</li>`
                        : isReceiver ?
                        '<li>it\'s your turn to accept or decline this offer</li>'
                        :
                        '<li>waiting for the offer to be accepted by user</li>'}
                    ${o.offerPosted ?
                        `<li>the offered <a href="${newToy}" target="_blank">toy</a> was ${Status[Status.posted]}${o.offerReceived ? ` and received on ${(o.offerReceived as Date).toDateString()}` : ''}</li>`
                        :
                        `<li>the offered toy hasn't been sent yet</li>`}
                    ${o.targetPosted ?
                        `<li>the requested <a href="${newToy}" target="_blank">toy</a> was ${Status[Status.posted]}${o.targetReceived ? ` and received on ${(o.targetReceived as Date).toDateString()}` : ''}</li>`
                        :
                        `<li>the requested toy hasn't been sent yet</li>`}
                    ${myShipmentStatus && !myReceived ?
                        `<li>your shipment status: ${myShipmentStatus}</li>`
                        : ''}
                    ${otherSideShipmentStatus && !otherSideReceived ?
                        `<li>the other user's shipment status: ${otherSideShipmentStatus}</li>`
                        : otherSideShipmentBarcode || otherSideReceived ?
                        ''
                        : `<li>the other user hasn't registered with Omniva yet</li>`}
                    `,
                toyTargeted,
            });
        });
        setHistory(history);
    }, [offers, toys, ratings]);

    const notifyError = (err: Error) => {
        Store.addNotification({
            title: "Unfortunately this action failed !",
            message: err.message,
            type: "danger",
            insert: "top",
            container: "top-right",
            animationIn: ["animate__animated", "animate__fadeIn"],
            animationOut: ["animate__animated", "animate__fadeOut"],
            dismiss: { duration: 5000 },
        });
    };

    const acceptOffer = async (offerId: string) => {
        try {
            setRespondingId(offerId);
            await updateOffer(offerId);
            await refresh();
        } catch (err) {
            notifyError(err as Error);
        } finally {
            setRespondingId(undefined);
        }
    };

    const declineThisOffer = async (offerId: string) => {
        try {
            setRespondingId(offerId);
            await declineOffer(offerId);
            await refresh();
        } catch (err) {
            notifyError(err as Error);
        } finally {
            setRespondingId(undefined);
        }
    };

    const cancelThisOffer = async (offerId: string) => {
        if (!window.confirm('Cancel this trade? This cannot be undone.')) {
            return;
        }
        try {
            setRespondingId(offerId);
            await declineOffer(offerId);
            await refresh();
        } catch (err) {
            notifyError(err as Error);
        } finally {
            setRespondingId(undefined);
        }
    };

    const markAsPosted = async (offerId: string, side: ShipmentSide) => {
        try {
            setMarkingId(offerId);
            await markToyPosted(offerId, side);
            await refresh();
        } catch (err) {
            notifyError(err as Error);
        } finally {
            setMarkingId(undefined);
        }
    };

    const markAsReceived = async (offerId: string, side: ShipmentSide) => {
        try {
            setMarkingId(offerId);
            await markToyReceived(offerId, side);
            await refresh();
        } catch (err) {
            notifyError(err as Error);
        } finally {
            setMarkingId(undefined);
        }
    };

    const onSubmitRating = async (offerId: string, side: ShipmentSide, toyId: string) => {
        const stars = starsByOfferId[offerId];
        if (!stars) return;
        try {
            setSubmittingRatingId(offerId);
            await submitRating(offerId, side, toyId, stars);
            await refresh();
        } catch (err) {
            notifyError(err as Error);
        } finally {
            setSubmittingRatingId(undefined);
        }
    };

    const dismissRatingPrompt = (offerId: string) => {
        setDismissedRatingIds((prev) => new Set(prev).add(offerId));
    };

    const dismissTipPrompt = (offerId: string) => {
        setDismissedTipIds((prev) => new Set(prev).add(offerId));
    };

    const onShareShipping = async (offerId: string, side: ShipmentSide) => {
        if (!myShippingProfile) return;
        try {
            setSharingShippingId(offerId);
            await shareShippingInfo(offerId, side, myShippingProfile);
            await refresh();
        } catch (err) {
            notifyError(err as Error);
        } finally {
            setSharingShippingId(undefined);
        }
    };

    // First-trade fallback: saves this as the user's reusable default too
    // (not just a one-off for this offer), so future trades skip straight
    // to the one-click "Share my shipping info" button above.
    const onSetupAndShareShipping = async (offerId: string, side: ShipmentSide) => {
        const name = shippingSetupName[offerId]?.trim();
        const phone = shippingSetupPhone[offerId]?.trim();
        const machine = shippingSetupMachine[offerId];
        if (!name || !phone || !machine) {
            notifyError(new Error("Name, phone, and a parcel machine are all required."));
            return;
        }
        const profile: ShippingProfile = {
            name,
            phone,
            parcelMachineId: machine.id,
            parcelMachineLabel: `${machine.name} — ${machine.address}`,
            countryCode: machine.countryCode,
        };
        try {
            setSharingShippingId(offerId);
            await saveShippingProfile(profile);
            await shareShippingInfo(offerId, side, profile);
            setMyShippingProfile(profile);
            await refresh();
        } catch (err) {
            notifyError(err as Error);
        } finally {
            setSharingShippingId(undefined);
        }
    };

    const fetchQuote = async (offerId: string, toySize: ToySize) => {
        setQuoteByOfferId((prev) => ({...prev, [offerId]: 'loading'}));
        try {
            const price = await getShippingPrice(toySize);
            setQuoteByOfferId((prev) => ({...prev, [offerId]: price}));
        } catch (err) {
            setQuoteByOfferId((prev) => ({...prev, [offerId]: 'error'}));
        }
    };

    // There's no way to carry a chosen destination terminal over to Omniva's
    // own site (no deep-linking support there), so this only asks for the
    // country - just enough to send the user to the right Omniva domain and
    // price-list page. The actual terminal is picked on Omniva's own site.
    const onCountryChange = (offerId: string, countryCode: string) => {
        setSelectedCountryByOfferId((prev) => ({...prev, [offerId]: countryCode}));
        fetchQuote(offerId, selectedSizeByOfferId[offerId] ?? DEFAULT_TOY_SIZE);
        // Fires from the select's own change handler, within the same user
        // gesture, so this won't be blocked as a popup.
        window.open(OMNIVA_SEND_PARCEL_URL[countryCode], '_blank', 'noopener,noreferrer');
    };

    const onSizeChange = (offerId: string, size: ToySize) => {
        setSelectedSizeByOfferId((prev) => ({...prev, [offerId]: size}));
        if (selectedCountryByOfferId[offerId]) fetchQuote(offerId, size);
    };

    const onSubmitBarcode = async (offerId: string, side: ShipmentSide) => {
        const barcode = barcodeInputByOfferId[offerId]?.trim();
        if (!barcode) {
            notifyError(new Error("Enter the barcode Omniva gave you first."));
            return;
        }
        // Omniva's own technical docs accept barcodes between 5 and 30
        // characters (a real one is typically 13, e.g. CC730129455EE) -
        // this doesn't verify the barcode is real, just catches obvious
        // typos/junk before it's saved.
        if (barcode.length < 5 || barcode.length > 30) {
            notifyError(new Error("That doesn't look like a real Omniva barcode - it should be 5-30 characters."));
            return;
        }
        try {
            setSubmittingBarcodeId(offerId);
            await submitOmnivaBarcode(
                offerId,
                side,
                barcode,
                selectedSizeByOfferId[offerId] ?? DEFAULT_TOY_SIZE
            );
            setBarcodeInputByOfferId((prev) => ({...prev, [offerId]: ''}));
            await refresh();
        } catch (err) {
            notifyError(err as Error);
        } finally {
            setSubmittingBarcodeId(undefined);
        }
    };

    const payForShipment = async (offerId: string, side: ShipmentSide) => {
        try {
            setPayingId(offerId);
            const { checkoutUrl } = await startShipmentCheckout(offerId, side);
            window.location.href = checkoutUrl;
        } catch (err) {
            setPayingId(undefined);
            Store.addNotification({
                title: "Unfortunately this action failed !",
                message: (err as Error).message,
                type: "danger",
                insert: "top",
                container: "top-right",
                animationIn: ["animate__animated", "animate__fadeIn"],
                animationOut: ["animate__animated", "animate__fadeOut"],
                dismiss: { duration: 5000 },
            });
        }
    };

  return (
    <>
        <h3>All offers made by you</h3>

        <div style={{display: 'flex', justifyContent: 'space-between', margin: '0 0 1.5em'}}>
          <button onClick={() => refresh()}>refresh</button>
          <button className="btn-primary" onClick={() => navigate('/addNew')}>add your toy</button>
        </div>

        {history.map((x:HistoryItem) =>
            <div className="card" style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1em', margin: '0 0 1em', padding: '1.25em'}} key={x.id}>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5em'}}>
                    <img style={{width:'50px', borderRadius: 'var(--radius-sm)'}} alt="offered" src={x.toyIOffered.file} />
                    <ul className="statusLines" dangerouslySetInnerHTML={{__html: x.status}}></ul>
                    <img style={{width:'50px', borderRadius: 'var(--radius-sm)'}} alt="targeted" src={x.toyTargeted.file} />
                </div>
                {x.isMyTurnToRespond ?
                    <div style={{display: 'flex', gap: '0.5em'}}>
                        <button className="btn-primary" disabled={respondingId === x.id} onClick={() => acceptOffer(x.id)}>
                            Accept
                        </button>
                        <button className="btn-danger" disabled={respondingId === x.id} onClick={() => declineThisOffer(x.id)}>
                            Decline
                        </button>
                    </div>
                :
                    <div style={{display: 'flex', flexDirection: 'column', gap: '0.5em', alignItems: 'center'}}>
                        {x.myShipmentBarcode &&
                            <button onClick={() => navigate(`/shipment/result?offerId=${x.id}&side=${x.mySide}`)}>
                                View my QR code
                            </button>}
                        {x.myShipmentStatus === 'RETURNED' &&
                            <p style={{fontSize: '0.8em', color: '#ff6b6b', margin: 0}}>
                                Your shipment was returned by Omniva - register it again and enter the new barcode below.
                            </p>}
                        {x.isAccepted &&
                            <div style={{display: 'flex', flexDirection: 'column', gap: '0.5em', alignItems: 'center',
                                fontSize: '0.85em', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '0.75em'}}>
                                {x.hasSharedMyShipping ?
                                    <p style={{margin: 0, color: 'var(--color-text-dim)'}}>You've shared your shipping info.</p>
                                : myShippingProfile ?
                                    <button className="btn-primary" disabled={sharingShippingId === x.id}
                                        onClick={() => onShareShipping(x.id, x.mySide)}>
                                        {sharingShippingId === x.id ? 'sharing...' : 'Share my shipping info'}
                                    </button>
                                :
                                    <div style={{display: 'flex', flexDirection: 'column', gap: '0.5em', width: '100%', alignItems: 'center'}}>
                                        <p style={{margin: 0}}>
                                            No shipping info saved yet - set it up here (also saves it for next
                                            time), or do it anytime on <a href="/profile">your profile</a>.
                                        </p>
                                        <input type="text" placeholder="Your name"
                                            value={shippingSetupName[x.id] ?? ''}
                                            onChange={(e) => setShippingSetupName((prev) => ({...prev, [x.id]: e.target.value}))} />
                                        <input type="tel" placeholder="Your phone"
                                            value={shippingSetupPhone[x.id] ?? ''}
                                            onChange={(e) => setShippingSetupPhone((prev) => ({...prev, [x.id]: e.target.value}))} />
                                        <ParcelMachinePicker
                                            value={shippingSetupMachine[x.id]?.id}
                                            onChange={(machine) => setShippingSetupMachine((prev) => ({...prev, [x.id]: machine}))}
                                        />
                                        <button className="btn-primary" disabled={sharingShippingId === x.id}
                                            onClick={() => onSetupAndShareShipping(x.id, x.mySide)}>
                                            {sharingShippingId === x.id ? 'saving...' : 'Save & share my shipping info'}
                                        </button>
                                    </div>}
                                {x.otherShippingName ?
                                    <p style={{margin: 0}}>
                                        Ship to: <strong>{x.otherShippingName}</strong>, {x.otherShippingPhone},{' '}
                                        {x.otherShippingParcelMachineLabel}
                                    </p>
                                :
                                    <p style={{margin: 0, color: 'var(--color-text-dim)'}}>
                                        Waiting for the other side to share their shipping info.
                                    </p>}
                            </div>}
                        {x.canSubmitBarcode &&
                            <div style={{display: 'flex', flexDirection: 'column', gap: '0.5em', alignItems: 'center'}}>
                                <p style={{fontSize: '0.85em', color: 'var(--color-text-dim)', margin: 0, textAlign: 'center'}}>
                                    Register your shipment yourself on Omniva's own site/app
                                    (no account with us needed there), then paste the barcode it gives you below.
                                    That barcode is what the parcel machine scans when you drop your toy off -
                                    saving it here turns it into a QR code you can pull up on your phone at the
                                    machine, and lets us know both sides have registered before either of you ships.
                                </p>
                                <label style={{display: 'flex', alignItems: 'center', gap: '0.5em', fontSize: '0.9em'}}>
                                    Shipping country:
                                    <select
                                        value={selectedCountryByOfferId[x.id] ?? ''}
                                        onChange={(e) => onCountryChange(x.id, e.target.value)}
                                    >
                                        <option value="" disabled>Select...</option>
                                        <option value="EE">Estonia</option>
                                        <option value="LV">Latvia</option>
                                        <option value="LT">Lithuania</option>
                                    </select>
                                </label>
                                <label style={{display: 'flex', alignItems: 'center', gap: '0.5em', fontSize: '0.9em'}}>
                                    Toy size:
                                    <select
                                        value={selectedSizeByOfferId[x.id] ?? DEFAULT_TOY_SIZE}
                                        onChange={(e) => onSizeChange(x.id, e.target.value as ToySize)}
                                    >
                                        {TOY_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                                    </select>
                                </label>
                                {selectedCountryByOfferId[x.id] &&
                                    <>
                                        {quoteByOfferId[x.id] === 'loading' ?
                                            <p style={{fontSize: '0.85em', margin: 0}}>Fetching Omniva price estimate...</p>
                                        : quoteByOfferId[x.id] && quoteByOfferId[x.id] !== 'error' ?
                                            <p style={{fontSize: '0.85em', margin: 0}}>
                                                Estimated Omniva price: €{((quoteByOfferId[x.id] as ShippingPrice).priceCents / 100).toFixed(2)}
                                                {' '}(estimate only - not an official quote)
                                            </p>
                                        : null}
                                        <a
                                            href={OMNIVA_PRICE_LIST_URL[selectedCountryByOfferId[x.id]]}
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{fontSize: '0.85em'}}
                                        >
                                            Check exact Omniva shipping price for {selectedCountryByOfferId[x.id]}
                                        </a>
                                        <a
                                            href={OMNIVA_SEND_PARCEL_URL[selectedCountryByOfferId[x.id]]}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="btn-primary"
                                            style={{textDecoration: 'none', textAlign: 'center'}}
                                        >
                                            Register this shipment on Omniva ↗
                                        </a>
                                        <p style={{fontSize: '0.8em', color: 'var(--color-text-dim)', margin: 0, textAlign: 'center'}}>
                                            This already opened in a new tab - pick your parcel machine over there,
                                            and once Omniva gives you a barcode, come back and paste it below.
                                        </p>
                                    </>
                                }
                                <input
                                    type="text"
                                    placeholder="Paste your Omniva barcode here"
                                    value={barcodeInputByOfferId[x.id] ?? ''}
                                    onChange={(e) => setBarcodeInputByOfferId((prev) => ({...prev, [x.id]: e.target.value}))}
                                />
                                <button
                                    className="btn-primary"
                                    disabled={submittingBarcodeId === x.id}
                                    onClick={() => onSubmitBarcode(x.id, x.mySide)}
                                >
                                    {submittingBarcodeId === x.id ? 'saving...' : 'Save my barcode'}
                                </button>
                            </div>}
                        {x.canMarkPosted &&
                            <button className="btn-primary" disabled={markingId === x.id} onClick={() => markAsPosted(x.id, x.mySide)}>
                                {markingId === x.id ? 'saving...'
                                    : x.myShipmentStatus === 'RETURNED' ? "Mark my toy as dropped off again"
                                    : "Mark my toy as dropped off"}
                            </button>}
                        {x.awaitingOtherRegistration &&
                            <p style={{fontSize: '0.8em', color: 'var(--color-text-dim)', margin: 0}}>
                                Hold off dropping your toy off - waiting for the other side to register with Omniva too.
                            </p>}
                        {x.canMarkReceived &&
                            <button className="btn-primary" disabled={markingId === x.id} onClick={() => markAsReceived(x.id, x.otherSide)}>
                                {markingId === x.id ? 'saving...' : "Mark the other toy as received"}
                            </button>}
                        {x.canRate && x.toyToRate && !dismissedRatingIds.has(x.id) &&
                            <div style={{display: 'flex', flexDirection: 'column', gap: '0.5em', alignItems: 'center'}}>
                                <p style={{fontSize: '0.85em', color: 'var(--color-text-dim)', margin: 0, textAlign: 'center'}}>
                                    How was the {x.toyToRate.title} you received?
                                </p>
                                <div style={{display: 'flex', gap: '0.25em'}}>
                                    {[1, 2, 3, 4, 5].map((n) => (
                                        <button
                                            key={n}
                                            style={{background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '1.4em'}}
                                            onClick={() => setStarsByOfferId((prev) => ({...prev, [x.id]: n}))}
                                        >
                                            <FontAwesomeIcon
                                                icon={(starsByOfferId[x.id] ?? 0) >= n ? faStarSolid : faStarRegular}
                                                color="var(--color-primary)"
                                            />
                                        </button>
                                    ))}
                                </div>
                                <div style={{display: 'flex', gap: '0.5em'}}>
                                    <button
                                        className="btn-primary"
                                        disabled={submittingRatingId === x.id || !starsByOfferId[x.id]}
                                        onClick={() => onSubmitRating(x.id, x.otherSide, x.toyToRate!.id)}
                                    >
                                        {submittingRatingId === x.id ? 'saving...' : 'Submit rating'}
                                    </button>
                                    <button onClick={() => dismissRatingPrompt(x.id)}>Skip</button>
                                </div>
                            </div>}
                        {x.isMyTurnToPay && !dismissedTipIds.has(x.id) &&
                            <div style={{display: 'flex', flexDirection: 'column', gap: '0.5em', alignItems: 'center'}}>
                                <p style={{fontSize: '0.8em', color: 'var(--color-text-dim)', margin: 0, textAlign: 'center'}}>
                                    Your toy was confirmed received! If ToyTrader was useful to you, you're welcome
                                    to leave an entirely optional 1 EUR tip - totally your call either way.
                                </p>
                                <div style={{display: 'flex', gap: '0.5em'}}>
                                    <button
                                        className="btn-primary"
                                        disabled={payingId === x.id}
                                        onClick={() => payForShipment(x.id, x.mySide)}
                                    >
                                        {payingId === x.id ? 'redirecting to payment...' : 'Leave a 1 EUR tip'}
                                    </button>
                                    <button onClick={() => dismissTipPrompt(x.id)}>No thanks</button>
                                </div>
                            </div>
                        }
                        {x.canCancel ?
                            <button className="btn-danger" disabled={respondingId === x.id} onClick={() => cancelThisOffer(x.id)}>
                                {respondingId === x.id ? 'cancelling...' : 'Cancel this trade'}
                            </button>
                        : x.isAccepted &&
                            <p style={{fontSize: '0.8em', color: 'var(--color-text-dim)', margin: 0}}>
                                This trade can no longer be cancelled - a toy is already on its way.
                            </p>
                        }
                    </div>
                }
            </div>
        )}

    </>
  );
}

export default MyOffersPage;
