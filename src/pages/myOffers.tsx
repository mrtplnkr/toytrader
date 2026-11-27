import { Fragment, useEffect, useMemo, useState } from "react";
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
import { ParcelMachine, ShipmentSide, ShippingPrice, declineOffer, getShippingPrice, getShippingProfile, getTradePartnerNames, markToyPosted, markToyReceived, saveShippingProfile, shareShippingInfo, startShipmentCheckout, submitOmnivaBarcode, submitRating, updateOffer } from "../hooks/helper";
import { ShippingProfile } from "../types/shippingProfile";
import ParcelMachinePicker from "../components/parcelMachinePicker";
import TradeConsentModal from "../components/tradeConsentModal";
import FeedbackCelebration from "../components/feedbackCelebration";
import { DEFAULT_TOY_SIZE, OMNIVA_PRICE_LIST_URL, OMNIVA_SEND_PARCEL_URL, TOY_SIZES, ToySize } from "../constants/omnivaPricing";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
    faStar as faStarSolid,
    faPaperPlane,
    faHandshake,
    faTruck,
    faBoxOpen,
    faChevronRight,
    faUser,
    faLocationDot,
} from "@fortawesome/free-solid-svg-icons";
import { faStar as faStarRegular } from "@fortawesome/free-regular-svg-icons";
import AdSlot from "../components/adSlot";

// Omniva's documented barcode length bounds (a real one is typically 13
// chars, e.g. CC730129455EE) - mirrored in firestore.rules'
// validBarcodeOrAbsent, which can't share this constant across languages.
const MIN_BARCODE_LENGTH = 5;
const MAX_BARCODE_LENGTH = 30;

// The three Omniva country domains all land on the same shared
// "/parcel/baltics/new" shipment flow (see constants/omnivaPricing.ts), so
// asking which country to use before showing these links was collecting a
// choice that didn't actually change the destination - Lithuania's domain
// works the same for any Baltic user. The price estimate itself only ever
// depended on toy size, never country, on the backend (getShippingPrice).
const OMNIVA_DEFAULT_COUNTRY = 'LT';

// The most recent thing that's happened on a trade - used to sort myOffers
// with the most recently active trades first, rather than by creation date
// alone (an old trade that just had a shipping update should bubble back up,
// not stay buried under newer-but-stalled ones).
function latestOfferActivity(o: Offer): Date {
    const dates = [o.offerCreated, o.offerAccepted, o.offerPosted, o.offerReceived,
        o.targetPosted, o.targetReceived, o.tipPaid].filter((d): d is Date => !!d);
    return dates.reduce((latest, d) => d > latest ? d : latest, o.offerCreated);
}

interface HistoryItem {
    id: string,
    offerCreated: Date;
    lastActivity: Date;
    toyIOffered: Toy;
    status: string;
    toyTargeted: Toy;
    mySide: ShipmentSide;
    otherSide: ShipmentSide;
    isInitiator: boolean;
    partnerUid: string;
    // Per-person progress for the trade-ladder avatars (TradeStepsBar) -
    // unlike bothPosted/bothReceived/hasRated above (which are either
    // symmetric or viewer-only), these track each individual's own two
    // shipping actions (ship their own toy, confirm receipt of the
    // incoming one) and their own rating, regardless of which side the
    // viewer is on.
    offerPosted: boolean;
    targetPosted: boolean;
    offerReceivedConfirmed: boolean;
    targetReceivedConfirmed: boolean;
    initiatorRated: boolean;
    receiverRated: boolean;
    // Each side shares their own shipping info independently (see
    // shareShippingInfo in helper.ts) - initiatorSharedShipping/
    // receiverSharedShipping are the per-person facts used by the ladder,
    // bothSharedShipping is their joint AND used by the shared step bar.
    initiatorSharedShipping: boolean;
    receiverSharedShipping: boolean;
    bothSharedShipping: boolean;
    isAccepted: boolean;
    canOfferTip: boolean;
    isMyTurnToRespond: boolean;
    canSubmitBarcode: boolean;
    canMarkPosted: boolean;
    canMarkReceived: boolean;
    canCancel: boolean;
    awaitingOtherRegistration: boolean;
    canRate: boolean;
    bothPosted: boolean;
    bothReceived: boolean;
    hasRated: boolean;
    toyToRate?: Toy;
    myShipmentBarcode?: string;
    myShipmentStatus?: string;
    hasSharedMyShipping: boolean;
    partnerName: string;
    myShippingName?: string;
    myShippingPhone?: string;
    myShippingParcelMachineLabel?: string;
    otherShippingName?: string;
    otherShippingPhone?: string;
    otherShippingParcelMachineLabel?: string;
}

function buildStatusHtml(t: TFunction, o: Offer, isInitiator: boolean, isReceiver: boolean, partnerName: string, params: {
    offeredToyUrl: string;
    targetedToyUrl: string;
    offeredToyTitle: string;
    targetedToyTitle: string;
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
        t('myOffers:status.offeredYourToy', { toyUrl: params.offeredToyUrl, title: params.offeredToyTitle, date: (o.offerCreated as Date).toDateString() }) :
        t('myOffers:status.receivedOfferForYourToy', { name: partnerName, toyUrl: params.targetedToyUrl, title: params.targetedToyTitle, date: (o.offerCreated as Date).toDateString() });

    const acceptedLine = o.offerAccepted ?
        (isInitiator ?
            t('myOffers:status.partnerAcceptedOffer', { name: partnerName, date: (o.offerAccepted as Date).toDateString() }) :
            t('myOffers:status.youAcceptedOffer', { date: (o.offerAccepted as Date).toDateString() })) :
        isReceiver ?
        t('myOffers:status.yourTurnToRespond') :
        t('myOffers:status.waitingForAcceptance', { name: partnerName });

    // toyOffered always ships from the initiator - "my action" when I'm the
    // initiator, otherwise it's the other side's action and gets named.
    const offeredLine = o.offerPosted ?
        (o.offerReceived ?
            t(isInitiator ? 'myOffers:status.offeredToyPostedAndReceived' : 'myOffers:status.partnerOfferedToyPostedAndReceived',
                { name: partnerName, toyUrl: params.offeredToyUrl, date: (o.offerReceived as Date).toDateString() }) :
            t(isInitiator ? 'myOffers:status.offeredToyPosted' : 'myOffers:status.partnerOfferedToyPosted',
                { name: partnerName, toyUrl: params.offeredToyUrl })) :
        t(isInitiator ? 'myOffers:status.offeredToyNotSent' : 'myOffers:status.partnerOfferedToyNotSent', { name: partnerName });

    // toyTargeted always ships from the receiver - reversed from above.
    const targetLine = o.targetPosted ?
        (o.targetReceived ?
            t(isReceiver ? 'myOffers:status.requestedToyPostedAndReceived' : 'myOffers:status.partnerRequestedToyPostedAndReceived',
                { name: partnerName, toyUrl: params.targetedToyUrl, date: (o.targetReceived as Date).toDateString() }) :
            t(isReceiver ? 'myOffers:status.requestedToyPosted' : 'myOffers:status.partnerRequestedToyPosted',
                { name: partnerName, toyUrl: params.targetedToyUrl })) :
        t(isReceiver ? 'myOffers:status.requestedToyNotSent' : 'myOffers:status.partnerRequestedToyNotSent', { name: partnerName });

    const myShipmentLine = params.myShipmentStatus && !params.myReceived ?
        t('myOffers:status.yourShipmentStatus', { status: params.myShipmentStatus }) : '';

    const otherShipmentLine = params.otherSideShipmentStatus && !params.otherSideReceived ?
        t('myOffers:status.otherShipmentStatus', { name: partnerName, status: params.otherSideShipmentStatus }) :
        (params.otherSideShipmentBarcode || params.otherSideReceived) ?
        '' :
        t('myOffers:status.otherNotRegistered', { name: partnerName });

    return `<li>${createdLine}</li>
            <li>${acceptedLine}</li>
            <li>${offeredLine}</li>
            <li>${targetLine}</li>
            ${myShipmentLine ? `<li>${myShipmentLine}</li>` : ''}
            ${otherShipmentLine ? `<li>${otherShipmentLine}</li>` : ''}
            `;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function daysAgoText(t: TFunction, date: Date): string {
    const diffDays = Math.floor((Date.now() - date.getTime()) / MS_PER_DAY);
    return diffDays < 1 ? t('myOffers:today') : t('myOffers:daysAgo', { count: diffDays });
}

// Overall trade lifecycle, independent of which side (initiator/receiver)
// the viewer is on - unlike the per-side text in buildStatusHtml above,
// this is the same six milestones for both participants, since "both sides
// shipped"/"both sides received" are true or false regardless of who's
// looking. shippingShared sits between accepted and shipped - it's possible
// (and common) to be accepted but not yet actually ship anything while
// still having exchanged where/who to send it to.
type TradeStepKey = 'proposed' | 'accepted' | 'shippingShared' | 'shipped' | 'received' | 'rated';

const TRADE_STEP_ICONS: Record<TradeStepKey, IconDefinition> = {
    proposed: faPaperPlane,
    accepted: faHandshake,
    shippingShared: faLocationDot,
    shipped: faTruck,
    received: faBoxOpen,
    rated: faStarSolid,
};

function buildTradeSteps(x: HistoryItem): { key: TradeStepKey; done: boolean }[] {
    return [
        { key: 'proposed', done: true },
        { key: 'accepted', done: x.isAccepted },
        { key: 'shippingShared', done: x.bothSharedShipping },
        { key: 'shipped', done: x.bothPosted },
        { key: 'received', done: x.bothReceived },
        { key: 'rated', done: x.hasRated },
    ];
}

// Each trader's own position on the ladder - unlike the joint steps above
// (which need BOTH sides done), this tracks one person's two individual
// shipping actions (shipping their own toy, confirming receipt of the
// incoming one) plus their own rating, so the two climber avatars can sit
// at different rungs (e.g. "I shipped already, they haven't yet").
// Not a strict prerequisite chain - e.g. canRate only requires the OTHER
// side's toy to have been posted/received, not that this person has
// shipped their own yet - so this picks the single highest rung reached
// rather than requiring every earlier one too.
function personalRung(isInitiatorPerson: boolean, x: HistoryItem): number {
    if (!x.isAccepted) return 1;
    const rated = isInitiatorPerson ? x.initiatorRated : x.receiverRated;
    if (rated) return 6;
    const received = isInitiatorPerson ? x.targetReceivedConfirmed : x.offerReceivedConfirmed;
    if (received) return 5;
    const shipped = isInitiatorPerson ? x.offerPosted : x.targetPosted;
    if (shipped) return 4;
    const sharedShipping = isInitiatorPerson ? x.initiatorSharedShipping : x.receiverSharedShipping;
    if (sharedShipping) return 3;
    return 2;
}

interface Climber {
    uid: string;
    photoUrl?: string;
    rating?: { avg: number; count: number };
    rung: number;
}

// Fixed pixel widths (not just gap/padding) so the circles+arrows row and
// the labels row underneath line up column-for-column regardless of how
// wide each translated label is.
const TRADE_STEP_CIRCLE_WIDTH = "w-10";
const TRADE_STEP_ARROW_WIDTH = "w-5";
const TRADE_STEP_CIRCLE_PX = 40;
const TRADE_STEP_ARROW_PX = 20;
const TRADE_STEP_COUNT = 6;
const TRADE_LADDER_WIDTH_PX = TRADE_STEP_COUNT * TRADE_STEP_CIRCLE_PX + (TRADE_STEP_COUNT - 1) * TRADE_STEP_ARROW_PX;

function rungCenterX(rung: number): number {
    return (rung - 1) * (TRADE_STEP_CIRCLE_PX + TRADE_STEP_ARROW_PX) + TRADE_STEP_CIRCLE_PX / 2;
}

function ClimberAvatar({ climber, offsetX }: { climber: Climber; offsetX: number }) {
    return (
        <div
            className="absolute top-0 flex flex-col items-center gap-0.5"
            style={{ left: rungCenterX(climber.rung) + offsetX, transform: 'translateX(-50%)' }}
        >
            <div className="w-6 h-6 rounded-full border-2 border-solid border-primary overflow-hidden bg-surface-raised flex items-center justify-center shrink-0">
                {climber.photoUrl ?
                    <img src={climber.photoUrl} alt="" className="w-full h-full object-cover" /> :
                    <FontAwesomeIcon icon={faUser} className="text-[0.6em] text-text-dim" />}
            </div>
            {climber.rating &&
                <span className="text-[0.55em] text-text-dim leading-none whitespace-nowrap">
                    {`★${climber.rating.avg.toFixed(1)}`}
                </span>}
        </div>
    );
}

function tradeStepCircleClasses(done: boolean, isNext: boolean): string {
    // border-solid/border-dashed is required (not just border-{color}) -
    // Preflight is disabled app-wide (tailwind.config.js), so without an
    // explicit style class border-style stays at the browser default of
    // "none" and the border renders with zero effective width.
    if (done) return "bg-primary border-solid border-primary text-white";
    if (isNext) return "bg-transparent border-dashed border-success text-success";
    return "bg-transparent border-solid border-border text-text-dim";
}

function tradeStepLabelClasses(done: boolean, isNext: boolean): string {
    if (done) return "text-text";
    if (isNext) return "text-success";
    return "text-text-dim";
}

function TradeStepsBar({ steps, climbers }: { steps: { key: TradeStepKey; done: boolean }[]; climbers: Climber[] }) {
    const { t } = useTranslation();
    const nextIndex = steps.findIndex((s) => !s.done);

    return (
        <div className="flex flex-col items-center gap-1 w-full">
            {climbers.length > 0 &&
                <div className="relative h-7" style={{ width: TRADE_LADDER_WIDTH_PX }}>
                    {climbers.map((c, i) => <ClimberAvatar key={c.uid} climber={c} offsetX={i === 0 ? -6 : 6} />)}
                </div>}
            <div className="flex items-center justify-center">
                {steps.map((s, i) => (
                    <Fragment key={s.key}>
                        <div
                            className={`flex items-center justify-center h-10 ${TRADE_STEP_CIRCLE_WIDTH} rounded-full border-2 shrink-0 ${tradeStepCircleClasses(s.done, i === nextIndex)}`}
                        >
                            <FontAwesomeIcon icon={TRADE_STEP_ICONS[s.key]} />
                        </div>
                        {i < steps.length - 1 &&
                            <div className={`flex items-center justify-center ${TRADE_STEP_ARROW_WIDTH} shrink-0`}>
                                <FontAwesomeIcon
                                    icon={faChevronRight}
                                    className={(s.done ? "text-primary" : "text-border") + (i + 1 === nextIndex ? " nextStepArrow" : "")}
                                />
                            </div>}
                    </Fragment>
                ))}
            </div>
            <div className="flex items-center justify-center">
                {steps.map((s, i) => (
                    <Fragment key={s.key}>
                        <span className={`${TRADE_STEP_CIRCLE_WIDTH} text-center text-[0.65em] leading-tight shrink-0 ${tradeStepLabelClasses(s.done, i === nextIndex)}`}>
                            {t(`myOffers:steps.${s.key}`)}
                        </span>
                        {i < steps.length - 1 && <span className={`${TRADE_STEP_ARROW_WIDTH} shrink-0`} />}
                    </Fragment>
                ))}
            </div>
        </div>
    );
}

function MyOffersPage() {
    let navigate = useNavigate();
    const { t } = useTranslation();

    const toys = useContextSelector(GoodAppContext, (state: any) => state.toys);
    const offers = useContextSelector(GoodAppContext, (state: any) => state.offers);
    const ratings = useContextSelector(GoodAppContext, (state: any) => state.ratings);

    // Average star rating per uid, for the trade-ladder avatar badges below -
    // computed from data every signed-in user can already read (ratings and
    // toys are both unrestricted, see firestore.rules), not just the
    // viewer's own trades, by resolving each rating's toyId to that toy's
    // owner (the person who shipped it, i.e. who's being rated).
    const avgRatingByUid = useMemo(() => {
        const sums: Record<string, { total: number; count: number }> = {};
        ratings.forEach((r: Rating) => {
            const toy = toys.find((x: Toy) => x.id === r.toyId);
            if (!toy) return;
            const entry = sums[toy.userId] ?? { total: 0, count: 0 };
            entry.total += r.stars;
            entry.count += 1;
            sums[toy.userId] = entry;
        });
        const result: Record<string, { avg: number; count: number }> = {};
        Object.entries(sums).forEach(([uid, { total, count }]) => {
            result[uid] = { avg: total / count, count };
        });
        return result;
    }, [ratings, toys]);

    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [pendingAcceptOfferId, setPendingAcceptOfferId] = useState<string | undefined>();
    const [payingId, setPayingId] = useState<string | undefined>();
    const [respondingId, setRespondingId] = useState<string | undefined>();
    const [markingId, setMarkingId] = useState<string | undefined>();
    const [submittingBarcodeId, setSubmittingBarcodeId] = useState<string | undefined>();
    const [selectedSizeByOfferId, setSelectedSizeByOfferId] = useState<Record<string, ToySize>>({});
    const [quoteByOfferId, setQuoteByOfferId] = useState<Record<string, ShippingPrice | 'loading' | 'error'>>({});
    const [barcodeInputByOfferId, setBarcodeInputByOfferId] = useState<Record<string, string>>({});
    const [starsByOfferId, setStarsByOfferId] = useState<Record<string, number>>({});
    const [feedbackByOfferId, setFeedbackByOfferId] = useState<Record<string, string>>({});
    const [showFeedbackCelebration, setShowFeedbackCelebration] = useState(false);
    const [submittingRatingId, setSubmittingRatingId] = useState<string | undefined>();
    const [dismissedRatingIds, setDismissedRatingIds] = useState<Set<string>>(new Set());
    const [dismissedTipIds, setDismissedTipIds] = useState<Set<string>>(new Set());
    const [partnerNamesByUid, setPartnerNamesByUid] = useState<Record<string, string>>({});
    const [partnerPhotosByUid, setPartnerPhotosByUid] = useState<Record<string, string>>({});
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
        const uid = auth.currentUser?.uid;
        const partnerUids = new Set<string>();
        offers.forEach((o: Offer) => {
            if (o.userInitiated === uid) partnerUids.add(o.userReceived);
            else if (o.userReceived === uid) partnerUids.add(o.userInitiated);
        });
        const uidsToResolve = Array.from(partnerUids).filter((id) => !(id in partnerNamesByUid));
        if (uidsToResolve.length === 0) return;
        getTradePartnerNames(uidsToResolve)
            .then(({ names, photoURLs }) => {
                setPartnerNamesByUid((prev) => ({ ...prev, ...names }));
                setPartnerPhotosByUid((prev) => ({ ...prev, ...photoURLs }));
            })
            .catch(() => {});
    // partnerNamesByUid is a dependency on purpose, not an oversight - it's
    // what lets uidsToResolve correctly shrink to empty once names come
    // back, instead of re-requesting the same already-resolved uids every
    // time this effect happens to re-run (e.g. a live offers update
    // unrelated to the partner uids involved).
    }, [offers, partnerNamesByUid]);

    useEffect(() => {
        let history:HistoryItem[] = [];
        const uid = auth.currentUser?.uid;

        offers.forEach((o: Offer) => {
            const isInitiator = o.userInitiated === uid;
            const isReceiver = o.userReceived === uid;
            if (!isInitiator && !isReceiver) return;

            const partnerUid = isInitiator ? o.userReceived : o.userInitiated;
            const partnerName = partnerNamesByUid[partnerUid] ?? t('myOffers:tradePartnerFallback');

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
            const myShippingPhone = mySide === 'offer' ? o.offerShippingPhone : o.targetShippingPhone;
            const myShippingParcelMachineLabel = mySide === 'offer' ?
                o.offerShippingParcelMachineLabel : o.targetShippingParcelMachineLabel;
            const otherShippingName = otherSide === 'offer' ? o.offerShippingName : o.targetShippingName;
            const otherShippingPhone = otherSide === 'offer' ? o.offerShippingPhone : o.targetShippingPhone;
            const otherShippingParcelMachineLabel = otherSide === 'offer' ?
                o.offerShippingParcelMachineLabel : o.targetShippingParcelMachineLabel;

            history.push({
                id: o.id,
                offerCreated: o.offerCreated as Date,
                lastActivity: latestOfferActivity(o),
                mySide,
                otherSide,
                isInitiator,
                partnerUid,
                offerPosted: !!o.offerPosted,
                targetPosted: !!o.targetPosted,
                offerReceivedConfirmed: !!o.offerReceived,
                targetReceivedConfirmed: !!o.targetReceived,
                // Rating doc ids are keyed by which toy got rated (see
                // alreadyRated below) - toyTargeted is rated by the
                // initiator (they're the one who received it), toyOffered
                // by the receiver - independent of which side is "me" here.
                initiatorRated: ratings.some((r: Rating) => r.id === `${o.id}_target`),
                receiverRated: ratings.some((r: Rating) => r.id === `${o.id}_offer`),
                initiatorSharedShipping: !!o.offerShippingName,
                receiverSharedShipping: !!o.targetShippingName,
                bothSharedShipping: !!o.offerShippingName && !!o.targetShippingName,
                myShipmentBarcode,
                myShipmentStatus,
                hasSharedMyShipping: !!myShippingName,
                partnerName,
                myShippingName,
                myShippingPhone,
                myShippingParcelMachineLabel,
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
                // Rating only makes sense once the trade's been accepted,
                // the other side's toy has actually shipped, and I've
                // confirmed receiving it - otherSideReceived alone should
                // already imply the first two, but checking all three
                // explicitly means a stale/partial write on any one field
                // can't surface the "how was it?" prompt early.
                canRate: !!o.offerAccepted && !!otherSidePosted && !!otherSideReceived && !alreadyRated,
                // For the step indicator - unlike the per-side booleans
                // above, these are symmetric (true/false the same way for
                // both participants) since they require BOTH toys to have
                // shipped/been received, not just "my" side of the trade.
                bothPosted: !!myPosted && !!otherSidePosted,
                bothReceived: !!myReceived && !!otherSideReceived,
                hasRated: alreadyRated,
                toyToRate: toyIReceived,
                toyIOffered,
                status: buildStatusHtml(t, o, isInitiator, isReceiver, partnerName, {
                    offeredToyUrl: toyIOffered.file, targetedToyUrl: toyTargeted.file,
                    offeredToyTitle: toyIOffered.title, targetedToyTitle: toyTargeted.title,
                    myShipmentStatus, myReceived, otherSideShipmentStatus, otherSideReceived, otherSideShipmentBarcode,
                }),
                toyTargeted,
            });
        });
        history.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
        setHistory(history);
    }, [offers, toys, ratings, t, partnerNamesByUid]);

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
            await submitRating(offerId, side, toyId, stars, feedbackByOfferId[offerId]);
            setShowFeedbackCelebration(true);
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

    // The form is always prefilled from myShippingProfile (see the JSX
    // below) when it exists, but the user may not have touched a field at
    // all if they're just confirming what's already there - so each value
    // falls back to the saved profile too, not just the local per-offer
    // override, otherwise an untouched field would wrongly read as missing.
    // Always re-saves the profile (not just shares it) so any edit made
    // here for this one trade also becomes the new default going forward.
    const onSetupAndShareShipping = async (offerId: string, side: ShipmentSide) => {
        const name = (shippingSetupName[offerId] ?? myShippingProfile?.name)?.trim();
        const phone = (shippingSetupPhone[offerId] ?? myShippingProfile?.phone)?.trim();
        const machine = shippingSetupMachine[offerId];
        const parcelMachineId = machine?.id ?? myShippingProfile?.parcelMachineId;
        const parcelMachineLabel = machine ? `${machine.name} — ${machine.address}` : myShippingProfile?.parcelMachineLabel;
        const countryCode = machine?.countryCode ?? myShippingProfile?.countryCode;
        if (!name || !phone || !parcelMachineId || !parcelMachineLabel || !countryCode) {
            notifyError(new Error(t('profile:missingInfoBody')));
            return;
        }
        const profile: ShippingProfile = { name, phone, parcelMachineId, parcelMachineLabel, countryCode };
        try {
            setSharingShippingId(offerId);
            await saveShippingProfile(profile);
            await shareShippingInfo(offerId, side, profile);
            setMyShippingProfile(profile);
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

    // Used to require picking a country first (just to decide which Omniva
    // domain's link to open), but the price estimate itself only ever
    // depended on toy size - fetch it for the default size as soon as the
    // barcode-submission step becomes reachable, instead of waiting on a
    // selection that no longer exists.
    useEffect(() => {
        history.forEach((x) => {
            if (x.canSubmitBarcode && !(x.id in quoteByOfferId)) {
                fetchQuote(x.id, selectedSizeByOfferId[x.id] ?? DEFAULT_TOY_SIZE);
            }
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [history]);

    const onSizeChange = (offerId: string, size: ToySize) => {
        setSelectedSizeByOfferId((prev) => ({...prev, [offerId]: size}));
        fetchQuote(offerId, size);
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

  // Split by direction rather than one flat list - "offers made to me"
  // (someone else proposed a trade for my toy, isInitiator false) and
  // "offers I made to others" (isInitiator true) need different actions
  // (Accept/Decline vs just Cancel, see isMyTurnToRespond/canCancel below),
  // so keeping them visually separate avoids scanning past irrelevant cards
  // to find the one offer still waiting on a response from you.
  const receivedOffers = history.filter((x) => !x.isInitiator);
  const sentOffers = history.filter((x) => x.isInitiator);

  const myUid = auth.currentUser?.uid;
  const myPhotoUrl = auth.currentUser?.photoURL ?? undefined;

  const buildClimbers = (x: HistoryItem): Climber[] => {
        if (!myUid) return [];
        const initiatorUid = x.isInitiator ? myUid : x.partnerUid;
        const receiverUid = x.isInitiator ? x.partnerUid : myUid;
        const photoFor = (uid: string) => uid === myUid ? myPhotoUrl : partnerPhotosByUid[uid];
        return [
            { uid: initiatorUid, photoUrl: photoFor(initiatorUid), rating: avgRatingByUid[initiatorUid], rung: personalRung(true, x) },
            { uid: receiverUid, photoUrl: photoFor(receiverUid), rating: avgRatingByUid[receiverUid], rung: personalRung(false, x) },
        ];
  };

  const renderOfferCard = (x: HistoryItem) =>
            <div className="card flex flex-col items-center gap-4 mb-4 p-5" key={x.id}>
                <TradeStepsBar steps={buildTradeSteps(x)} climbers={buildClimbers(x)} />
                <span className="text-[0.7em] text-text-dim">{daysAgoText(t, x.offerCreated)}</span>
                <div className="flex items-center justify-center gap-6">
                    <img className="w-[50px] rounded-sm" alt="offered" src={x.toyIOffered.file} />
                    <ul className="statusLines" dangerouslySetInnerHTML={{__html: x.status}}></ul>
                    <img className="w-[50px] rounded-sm" alt="targeted" src={x.toyTargeted.file} />
                </div>
                {x.isMyTurnToRespond ?
                    <div className="flex gap-2">
                        <button className="btn-primary" disabled={respondingId === x.id} onClick={() => setPendingAcceptOfferId(x.id)}>
                            {t('myOffers:accept')}
                        </button>
                        <button className="btn-danger" disabled={respondingId === x.id} onClick={() => declineThisOffer(x.id)}>
                            {t('myOffers:decline')}
                        </button>
                    </div>
                :
                    <div className="flex flex-col gap-2 items-center">
                        {x.myShipmentStatus === 'RETURNED' &&
                            <p className="text-[0.8em] text-danger m-0">
                                {t('myOffers:shipmentReturned')}
                            </p>}
                        {/* Once both toys are confirmed received there's
                            nothing left to ship, so this box (whether
                            showing the shared-info summary, the "share
                            now" button, or - most confusingly - a blank
                            name/phone/parcel-machine form) has no reason
                            to keep showing, even though isAccepted stays
                            true forever. */}
                        {x.isAccepted && !x.bothReceived &&
                            <div className="flex flex-col gap-2 items-center text-[0.85em] border border-border rounded-sm p-3">
                                {x.hasSharedMyShipping ?
                                    <>
                                        <p className="m-0 text-text-dim">{t('myOffers:sharedShippingInfo')}</p>
                                        <p className="m-0 text-text-dim">
                                            {t('myOffers:sharedShippingInfoWith')} <strong>{x.partnerName}</strong>:{' '}
                                            {x.myShippingName}, {x.myShippingPhone}, {x.myShippingParcelMachineLabel}
                                        </p>
                                    </>
                                :
                                    /* Always shown as editable, prefilled fields - never a
                                       blind one-click "Share my shipping info" button, even
                                       once a saved profile exists. Clicking through without
                                       ever seeing what name/phone/parcel machine was about to
                                       go out, and with no way to tweak it for just this one
                                       trade, is exactly the thing this form exists to avoid. */
                                    <div className="flex flex-col gap-2 w-full items-center">
                                        {/* Once a parcel machine's been picked for this trade (even
                                            before a reusable profile exists), "no shipping info saved
                                            yet" is no longer true - the user's already partway through,
                                            so the hint (and its /profile link, which would just send
                                            them away from what they're already doing) would be noise. */}
                                        {myShippingProfile ?
                                            <p className="m-0">{t('myOffers:reviewShippingInfo')}</p>
                                        : !shippingSetupMachine[x.id] &&
                                            <p className="m-0">
                                                {/* eslint-disable-next-line jsx-a11y/anchor-has-content -- Trans clones this element and fills in the translated link text at render */}
                                                <Trans i18nKey="myOffers:noShippingInfoYet" components={{ ProfileLink: <a href="/profile" /> }} />
                                            </p>}
                                        <div className="flex gap-2 w-full">
                                            <input type="text" placeholder={t('myOffers:yourNamePlaceholder')} className="flex-1 min-w-0"
                                                value={shippingSetupName[x.id] ?? myShippingProfile?.name ?? ''}
                                                onChange={(e) => setShippingSetupName((prev) => ({...prev, [x.id]: e.target.value}))} />
                                            <input type="tel" placeholder={t('myOffers:yourPhonePlaceholder')} className="flex-1 min-w-0"
                                                value={shippingSetupPhone[x.id] ?? myShippingProfile?.phone ?? ''}
                                                onChange={(e) => setShippingSetupPhone((prev) => ({...prev, [x.id]: e.target.value}))} />
                                        </div>
                                        <ParcelMachinePicker
                                            value={shippingSetupMachine[x.id]?.id ?? myShippingProfile?.parcelMachineId}
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
                                    {t('myOffers:toySize')}
                                    <select
                                        value={selectedSizeByOfferId[x.id] ?? DEFAULT_TOY_SIZE}
                                        onChange={(e) => onSizeChange(x.id, e.target.value as ToySize)}
                                    >
                                        {TOY_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                                    </select>
                                </label>
                                {quoteByOfferId[x.id] === 'loading' ?
                                    <p className="text-[0.85em] m-0">{t('myOffers:fetchingPrice')}</p>
                                : quoteByOfferId[x.id] && quoteByOfferId[x.id] !== 'error' ?
                                    <p className="text-[0.85em] m-0">
                                        {t('myOffers:estimatedPrice', { price: ((quoteByOfferId[x.id] as ShippingPrice).priceCents / 100).toFixed(2) })}
                                        {t('myOffers:estimateOnlyNote')}
                                    </p>
                                : null}
                                <a
                                    href={OMNIVA_PRICE_LIST_URL[OMNIVA_DEFAULT_COUNTRY]}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[0.85em]"
                                >
                                    {t('myOffers:checkExactPrice')}
                                </a>
                                <a
                                    href={OMNIVA_SEND_PARCEL_URL[OMNIVA_DEFAULT_COUNTRY]}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="btn-primary no-underline text-center"
                                >
                                    {t('myOffers:registerOnOmniva')}
                                </a>
                                <p className="text-[0.8em] text-text-dim m-0 text-center">
                                    {t('myOffers:openedInNewTab')}
                                </p>
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
                                            className="starRatingButton bg-transparent border-none cursor-pointer p-0 text-[1.4em]"
                                            onClick={() => setStarsByOfferId((prev) => ({...prev, [x.id]: n}))}
                                        >
                                            <FontAwesomeIcon
                                                icon={(starsByOfferId[x.id] ?? 0) >= n ? faStarSolid : faStarRegular}
                                                color="var(--color-primary)"
                                            />
                                        </button>
                                    ))}
                                </div>
                                <textarea
                                    className="w-full max-w-[320px]"
                                    rows={3}
                                    placeholder={t('myOffers:feedbackPlaceholder') ?? undefined}
                                    value={feedbackByOfferId[x.id] ?? ''}
                                    onChange={(e) => setFeedbackByOfferId((prev) => ({...prev, [x.id]: e.target.value}))}
                                />
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
                        {/* A natural pause point - the trade just fully
                            completed - same "sometimes, not every time"
                            frequency gating as the /list placement, just a
                            separate counter (trigger="tradeComplete"). */}
                        {x.canOfferTip && <AdSlot trigger="tradeComplete" />}
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
            </div>;

  return (
    <>
        <h3>{t('myOffers:heading')}</h3>

        <div className="flex justify-end mb-6">
          <button className="btn-primary" onClick={() => navigate('/addNew')}>{t('myOffers:addYourToy')}</button>
        </div>

        {receivedOffers.length > 0 &&
            <>
                <h4>{t('myOffers:receivedHeading')}</h4>
                {receivedOffers.map(renderOfferCard)}
            </>}

        {sentOffers.length > 0 &&
            <>
                <h4>{t('myOffers:sentHeading')}</h4>
                {sentOffers.map(renderOfferCard)}
            </>}

        {pendingAcceptOfferId &&
            <TradeConsentModal
                confirmLabel={t('myOffers:accept')}
                onCancel={() => setPendingAcceptOfferId(undefined)}
                onAgree={() => {
                    const offerId = pendingAcceptOfferId;
                    setPendingAcceptOfferId(undefined);
                    acceptOffer(offerId);
                }}
            />}

        {showFeedbackCelebration &&
            <FeedbackCelebration onClose={() => setShowFeedbackCelebration(false)} />}
    </>
  );
}

export default MyOffersPage;
