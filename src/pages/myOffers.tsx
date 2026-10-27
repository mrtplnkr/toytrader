import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Store } from "react-notifications-component";
import { Trans, useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { auth } from "../firebase-config";
import { Offer } from "../types/offer";
import { GoodAppContext } from "../hooks/context";
import { useContextSelector } from "use-context-selector";
import { Toy } from "../types/toy";
import { Rating } from "../types/rating";
import { ParcelMachine, ShipmentSide, ShippingPrice, declineOffer, getShippingPrice, getShippingProfile, markToyPosted, markToyReceived, saveShippingProfile, shareShippingInfo, startShipmentCheckout, submitOmnivaBarcode, submitRating, updateOffer } from "../hooks/helper";
import { ShippingProfile } from "../types/shippingProfile";
import ParcelMachinePicker from "../components/parcelMachinePicker";
import { DEFAULT_TOY_SIZE, OMNIVA_COUNTRIES, OMNIVA_PRICE_LIST_URL, OMNIVA_SEND_PARCEL_URL, TOY_SIZES, ToySize } from "../constants/omnivaPricing";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar as faStarSolid } from "@fortawesome/free-solid-svg-icons";
import { faStar as faStarRegular } from "@fortawesome/free-regular-svg-icons";

// Omniva's documented barcode length bounds (a real one is typically 13
// chars, e.g. CC730129455EE) - mirrored in firestore.rules'
// validBarcodeOrAbsent, which can't share this constant across languages.
const MIN_BARCODE_LENGTH = 5;
const MAX_BARCODE_LENGTH = 30;

const COUNTRY_LABEL_KEYS: Record<typeof OMNIVA_COUNTRIES[number], string> = {
    EE: 'myOffers:countryEstonia',
    LV: 'myOffers:countryLatvia',
    LT: 'myOffers:countryLithuania',
};

interface HistoryItem {
    id: string,
    toyIOffered: Toy;
    status: string;
    toyTargeted: Toy;
    mySide: ShipmentSide;
    otherSide: ShipmentSide;
    isAccepted: boolean;
    canOfferTip: boolean;
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

function buildStatusHtml(t: TFunction, o: Offer, isInitiator: boolean, isReceiver: boolean, params: {
    offeredToyUrl: string;
    targetedToyUrl: string;
    myShipmentStatus?: string;
    myReceived?: Date;
    otherSideShipmentStatus?: string;
    otherSideReceived?: Date;
    otherSideShipmentBarcode?: string;
}): string {
    // "Your toy" means different things depending on perspective: for the
    // initiator it's the one they offered (toyOffered); for the receiver
    // it's the one that got targeted (toyTargeted, which is theirs).
    const createdLine = isInitiator ?
        t('myOffers:status.offeredYourToy', { toyUrl: params.offeredToyUrl, date: (o.offerCreated as Date).toDateString() }) :
        t('myOffers:status.receivedOfferForYourToy', { toyUrl: params.targetedToyUrl, date: (o.offerCreated as Date).toDateString() });

    const acceptedLine = o.offerAccepted ?
        t('myOffers:status.offerAccepted', { date: (o.offerAccepted as Date).toDateString() }) :
        isReceiver ?
        t('myOffers:status.yourTurnToRespond') :
        t('myOffers:status.waitingForAcceptance');

    const offeredLine = o.offerPosted ?
        (o.offerReceived ?
            t('myOffers:status.offeredToyPostedAndReceived', { toyUrl: params.offeredToyUrl, date: (o.offerReceived as Date).toDateString() }) :
            t('myOffers:status.offeredToyPosted', { toyUrl: params.offeredToyUrl })) :
        t('myOffers:status.offeredToyNotSent');

    const targetLine = o.targetPosted ?
        (o.targetReceived ?
            t('myOffers:status.requestedToyPostedAndReceived', { toyUrl: params.targetedToyUrl, date: (o.targetReceived as Date).toDateString() }) :
            t('myOffers:status.requestedToyPosted', { toyUrl: params.targetedToyUrl })) :
        t('myOffers:status.requestedToyNotSent');

    const myShipmentLine = params.myShipmentStatus && !params.myReceived ?
        t('myOffers:status.yourShipmentStatus', { status: params.myShipmentStatus }) : '';

    const otherShipmentLine = params.otherSideShipmentStatus && !params.otherSideReceived ?
        t('myOffers:status.otherShipmentStatus', { status: params.otherSideShipmentStatus }) :
        (params.otherSideShipmentBarcode || params.otherSideReceived) ?
        '' :
        t('myOffers:status.otherNotRegistered');

    return `<li>${createdLine}</li>
            <li>${acceptedLine}</li>
            <li>${offeredLine}</li>
            <li>${targetLine}</li>
            ${myShipmentLine ? `<li>${myShipmentLine}</li>` : ''}
            ${otherShipmentLine ? `<li>${otherShipmentLine}</li>` : ''}
            `;
}

function MyOffersPage() {
    let navigate = useNavigate();
    const { t } = useTranslation();

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
                // The optional 1 EUR "buy me a coffee" tip is per *trade*,
                // not per side: offerable once the whole trade has
                // completed (both toys confirmed received) and I've left my
                // own feedback, payable by either party. Entirely voluntary
                // - nothing else depends on it.
                canOfferTip: !!(o.offerReceived && o.targetReceived) && alreadyRated && !o.tipPaid,
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
                status: buildStatusHtml(t, o, isInitiator, isReceiver, {
                    offeredToyUrl: toyIOffered.file, targetedToyUrl: toyTargeted.file,
                    myShipmentStatus, myReceived, otherSideShipmentStatus, otherSideReceived, otherSideShipmentBarcode,
                }),
                toyTargeted,
            });
        });
        setHistory(history);
    }, [offers, toys, ratings, t]);

    const notifyError = (err: Error) => {
        Store.addNotification({
            title: t('common:toast.actionFailedTitle'),
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

            // Nothing stops a toy from being offered or targeted by several
            // competing offers at once before any of them is accepted (see
            // isToyCommittedElsewhere in list.tsx, which only guards the
            // toy *you're* offering, not the one you're asking for) - now
            // that one of them has won, a toy can only physically go to one
            // trade, so auto-decline every other still-pending offer that
            // shares either of this trade's two toys.
            const acceptedOffer = offers.find((o: Offer) => o.id === offerId);
            if (acceptedOffer) {
                const theseToys = [acceptedOffer.toyOffered, acceptedOffer.toyTargeted];
                const competingOfferIds = offers
                    .filter((o: Offer) => o.id !== offerId && !o.offerAccepted &&
                        (theseToys.includes(o.toyOffered) || theseToys.includes(o.toyTargeted)))
                    .map((o: Offer) => o.id);
                await Promise.all(competingOfferIds.map((id: string) => declineOffer(id)));
            }

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
        if (!window.confirm(t('myOffers:confirmCancel'))) {
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
            notifyError(new Error(t('profile:missingInfoBody')));
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
            notifyError(new Error(t('myOffers:enterBarcodeFirst')));
            return;
        }
        // Doesn't verify the barcode is real, just catches obvious typos/junk
        // before it's saved.
        if (barcode.length < MIN_BARCODE_LENGTH || barcode.length > MAX_BARCODE_LENGTH) {
            notifyError(new Error(t('myOffers:invalidBarcode')));
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

    const payForShipment = async (offerId: string) => {
        try {
            setPayingId(offerId);
            const { checkoutUrl } = await startShipmentCheckout(offerId);
            window.location.href = checkoutUrl;
        } catch (err) {
            setPayingId(undefined);
            notifyError(err as Error);
        }
    };

  return (
    <>
        <h3>{t('myOffers:heading')}</h3>

        <div className="flex justify-between mb-6">
          <button onClick={() => refresh()}>{t('myOffers:refresh')}</button>
          <button className="btn-primary" onClick={() => navigate('/addNew')}>{t('myOffers:addYourToy')}</button>
        </div>

        {history.map((x:HistoryItem) =>
            <div className="card flex flex-col items-center gap-4 mb-4 p-5" key={x.id}>
                <div className="flex items-center justify-center gap-6">
                    <img className="w-[50px] rounded-sm" alt="offered" src={x.toyIOffered.file} />
                    <ul className="statusLines" dangerouslySetInnerHTML={{__html: x.status}}></ul>
                    <img className="w-[50px] rounded-sm" alt="targeted" src={x.toyTargeted.file} />
                </div>
                {x.isMyTurnToRespond ?
                    <div className="flex gap-2">
                        <button className="btn-primary" disabled={respondingId === x.id} onClick={() => acceptOffer(x.id)}>
                            {t('myOffers:accept')}
                        </button>
                        <button className="btn-danger" disabled={respondingId === x.id} onClick={() => declineThisOffer(x.id)}>
                            {t('myOffers:decline')}
                        </button>
                    </div>
                :
                    <div className="flex flex-col gap-2 items-center">
                        {x.myShipmentBarcode &&
                            <button onClick={() => navigate(`/shipment/result?offerId=${x.id}&side=${x.mySide}`)}>
                                {t('myOffers:viewMyQrCode')}
                            </button>}
                        {x.myShipmentStatus === 'RETURNED' &&
                            <p className="text-[0.8em] text-danger m-0">
                                {t('myOffers:shipmentReturned')}
                            </p>}
                        {x.isAccepted &&
                            <div className="flex flex-col gap-2 items-center text-[0.85em] border border-border rounded-sm p-3">
                                {x.hasSharedMyShipping ?
                                    <p className="m-0 text-text-dim">{t('myOffers:sharedShippingInfo')}</p>
                                : myShippingProfile ?
                                    <button className="btn-primary" disabled={sharingShippingId === x.id}
                                        onClick={() => onShareShipping(x.id, x.mySide)}>
                                        {sharingShippingId === x.id ? t('myOffers:sharing') : t('myOffers:shareMyShippingInfo')}
                                    </button>
                                :
                                    <div className="flex flex-col gap-2 w-full items-center">
                                        <p className="m-0">
                                            {/* eslint-disable-next-line jsx-a11y/anchor-has-content -- Trans clones this element and fills in the translated link text at render */}
                                            <Trans i18nKey="myOffers:noShippingInfoYet" components={{ ProfileLink: <a href="/profile" /> }} />
                                        </p>
                                        <input type="text" placeholder={t('myOffers:yourNamePlaceholder')}
                                            value={shippingSetupName[x.id] ?? ''}
                                            onChange={(e) => setShippingSetupName((prev) => ({...prev, [x.id]: e.target.value}))} />
                                        <input type="tel" placeholder={t('myOffers:yourPhonePlaceholder')}
                                            value={shippingSetupPhone[x.id] ?? ''}
                                            onChange={(e) => setShippingSetupPhone((prev) => ({...prev, [x.id]: e.target.value}))} />
                                        <ParcelMachinePicker
                                            value={shippingSetupMachine[x.id]?.id}
                                            onChange={(machine) => setShippingSetupMachine((prev) => ({...prev, [x.id]: machine}))}
                                        />
                                        <button className="btn-primary" disabled={sharingShippingId === x.id}
                                            onClick={() => onSetupAndShareShipping(x.id, x.mySide)}>
                                            {sharingShippingId === x.id ? t('myOffers:saving') : t('myOffers:saveAndShareShippingInfo')}
                                        </button>
                                    </div>}
                                {x.otherShippingName ?
                                    <p className="m-0">
                                        {t('myOffers:shipTo')} <strong>{x.otherShippingName}</strong>, {x.otherShippingPhone},{' '}
                                        {x.otherShippingParcelMachineLabel}
                                    </p>
                                :
                                    <p className="m-0 text-text-dim">
                                        {t('myOffers:waitingForOtherShipping')}
                                    </p>}
                            </div>}
                        {x.canSubmitBarcode &&
                            <div className="flex flex-col gap-2 items-center">
                                <p className="text-[0.85em] text-text-dim m-0 text-center">
                                    {t('myOffers:registerShipmentInstructions')}
                                </p>
                                <label className="flex items-center gap-2 text-[0.9em]">
                                    {t('myOffers:shippingCountry')}
                                    <select
                                        value={selectedCountryByOfferId[x.id] ?? ''}
                                        onChange={(e) => onCountryChange(x.id, e.target.value)}
                                    >
                                        <option value="" disabled>{t('myOffers:selectEllipsis')}</option>
                                        {OMNIVA_COUNTRIES.map((code) =>
                                            <option key={code} value={code}>{t(COUNTRY_LABEL_KEYS[code])}</option>)}
                                    </select>
                                </label>
                                <label className="flex items-center gap-2 text-[0.9em]">
                                    {t('myOffers:toySize')}
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
                                            <p className="text-[0.85em] m-0">{t('myOffers:fetchingPrice')}</p>
                                        : quoteByOfferId[x.id] && quoteByOfferId[x.id] !== 'error' ?
                                            <p className="text-[0.85em] m-0">
                                                {t('myOffers:estimatedPrice', { price: ((quoteByOfferId[x.id] as ShippingPrice).priceCents / 100).toFixed(2) })}
                                                {t('myOffers:estimateOnlyNote')}
                                            </p>
                                        : null}
                                        <a
                                            href={OMNIVA_PRICE_LIST_URL[selectedCountryByOfferId[x.id]]}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-[0.85em]"
                                        >
                                            {t('myOffers:checkExactPrice', { country: selectedCountryByOfferId[x.id] })}
                                        </a>
                                        <a
                                            href={OMNIVA_SEND_PARCEL_URL[selectedCountryByOfferId[x.id]]}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="btn-primary no-underline text-center"
                                        >
                                            {t('myOffers:registerOnOmniva')}
                                        </a>
                                        <p className="text-[0.8em] text-text-dim m-0 text-center">
                                            {t('myOffers:openedInNewTab')}
                                        </p>
                                    </>
                                }
                                <input
                                    type="text"
                                    placeholder={t('myOffers:pasteBarcodePlaceholder')}
                                    value={barcodeInputByOfferId[x.id] ?? ''}
                                    onChange={(e) => setBarcodeInputByOfferId((prev) => ({...prev, [x.id]: e.target.value}))}
                                />
                                <button
                                    className="btn-primary"
                                    disabled={submittingBarcodeId === x.id}
                                    onClick={() => onSubmitBarcode(x.id, x.mySide)}
                                >
                                    {submittingBarcodeId === x.id ? t('myOffers:saving') : t('myOffers:saveMyBarcode')}
                                </button>
                            </div>}
                        {x.canMarkPosted &&
                            <button className="btn-primary" disabled={markingId === x.id} onClick={() => markAsPosted(x.id, x.mySide)}>
                                {markingId === x.id ? t('myOffers:saving')
                                    : x.myShipmentStatus === 'RETURNED' ? t('myOffers:markPostedAgain')
                                    : t('myOffers:markPosted')}
                            </button>}
                        {x.awaitingOtherRegistration &&
                            <p className="text-[0.8em] text-text-dim m-0">
                                {t('myOffers:awaitingOtherRegistration')}
                            </p>}
                        {x.canMarkReceived &&
                            <button className="btn-primary" disabled={markingId === x.id} onClick={() => markAsReceived(x.id, x.otherSide)}>
                                {markingId === x.id ? t('myOffers:saving') : t('myOffers:markReceived')}
                            </button>}
                        {x.canRate && x.toyToRate && !dismissedRatingIds.has(x.id) &&
                            <div className="flex flex-col gap-2 items-center">
                                <p className="text-[0.85em] text-text-dim m-0 text-center">
                                    {t('myOffers:howWasToy', { title: x.toyToRate.title })}
                                </p>
                                <div className="flex gap-1">
                                    {[1, 2, 3, 4, 5].map((n) => (
                                        <button
                                            key={n}
                                            aria-label={t('myOffers:rateStarsLabel', { count: n })}
                                            className="bg-transparent border-none cursor-pointer p-0 text-[1.4em]"
                                            onClick={() => setStarsByOfferId((prev) => ({...prev, [x.id]: n}))}
                                        >
                                            <FontAwesomeIcon
                                                icon={(starsByOfferId[x.id] ?? 0) >= n ? faStarSolid : faStarRegular}
                                                color="var(--color-primary)"
                                            />
                                        </button>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        className="btn-primary"
                                        disabled={submittingRatingId === x.id || !starsByOfferId[x.id]}
                                        onClick={() => onSubmitRating(x.id, x.otherSide, x.toyToRate!.id)}
                                    >
                                        {submittingRatingId === x.id ? t('myOffers:saving') : t('myOffers:submitRating')}
                                    </button>
                                    <button onClick={() => dismissRatingPrompt(x.id)}>{t('myOffers:skip')}</button>
                                </div>
                            </div>}
                        {x.canOfferTip && !dismissedTipIds.has(x.id) &&
                            <div className="flex flex-col gap-2 items-center">
                                <p className="text-[0.8em] text-text-dim m-0 text-center">
                                    {t('myOffers:tipPrompt')}
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        className="btn-primary"
                                        disabled={payingId === x.id}
                                        onClick={() => payForShipment(x.id)}
                                    >
                                        {payingId === x.id ? t('myOffers:redirectingToPayment') : t('myOffers:leaveTip')}
                                    </button>
                                    <button onClick={() => dismissTipPrompt(x.id)}>{t('myOffers:noThanks')}</button>
                                </div>
                            </div>
                        }
                        {x.canCancel ?
                            <button className="btn-danger" disabled={respondingId === x.id} onClick={() => cancelThisOffer(x.id)}>
                                {respondingId === x.id ? t('myOffers:cancelling') : t('myOffers:cancelTrade')}
                            </button>
                        : x.isAccepted &&
                            <p className="text-[0.8em] text-text-dim m-0">
                                {t('myOffers:cannotCancelAnymore')}
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
