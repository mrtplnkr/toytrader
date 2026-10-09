import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Store } from "react-notifications-component";
import { auth } from "../firebase-config";
import { Offer } from "../types/offer";
import { GoodAppContext } from "../hooks/context";
import { useContextSelector } from "use-context-selector";
import { Toy } from "../types/toy";
import { ParcelMachine, ShipmentSide, ShippingPrice, declineOffer, getShippingPrice, markToyPosted, markToyReceived, startShipmentCheckout, submitOmnivaBarcode, updateOffer } from "../hooks/helper";
import ParcelMachinePicker from "../components/parcelMachinePicker";
import { DEFAULT_TOY_SIZE, OMNIVA_PRICE_LIST_URL, TOY_SIZES, ToySize } from "../constants/omnivaPricing";

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
    myShipmentBarcode?: string;
    myShipmentStatus?: string;
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

    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [payingId, setPayingId] = useState<string | undefined>();
    const [respondingId, setRespondingId] = useState<string | undefined>();
    const [markingId, setMarkingId] = useState<string | undefined>();
    const [submittingBarcodeId, setSubmittingBarcodeId] = useState<string | undefined>();
    const [selectedMachineByOfferId, setSelectedMachineByOfferId] = useState<Record<string, ParcelMachine>>({});
    const [selectedSizeByOfferId, setSelectedSizeByOfferId] = useState<Record<string, ToySize>>({});
    const [quoteByOfferId, setQuoteByOfferId] = useState<Record<string, ShippingPrice | 'loading' | 'error'>>({});
    const [barcodeInputByOfferId, setBarcodeInputByOfferId] = useState<Record<string, string>>({});

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

            history.push({
                id: o.id,
                mySide,
                otherSide,
                myShipmentBarcode,
                myShipmentStatus,
                isAccepted: !!o.offerAccepted,
                // The 1 EUR service fee is charged only after a successful
                // trade - once the toy I shipped is confirmed received.
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
                    ${myShipmentStatus ?
                        `<li>your shipment status: ${myShipmentStatus}</li>`
                        : ''}
                    ${otherSideShipmentStatus ?
                        `<li>the other user's shipment status: ${otherSideShipmentStatus}</li>`
                        : otherSideShipmentBarcode ?
                        ''
                        : `<li>the other user hasn't registered with Omniva yet</li>`}
                    `,
                toyTargeted,
            });
        });
        setHistory(history);
    }, [offers, toys]);

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

    const fetchQuote = async (offerId: string, parcelMachineId: string, toySize: ToySize) => {
        setQuoteByOfferId((prev) => ({...prev, [offerId]: 'loading'}));
        try {
            const price = await getShippingPrice(parcelMachineId, toySize);
            setQuoteByOfferId((prev) => ({...prev, [offerId]: price}));
        } catch (err) {
            setQuoteByOfferId((prev) => ({...prev, [offerId]: 'error'}));
        }
    };

    const onMachineChange = (offerId: string, machine: ParcelMachine) => {
        setSelectedMachineByOfferId((prev) => ({...prev, [offerId]: machine}));
        fetchQuote(offerId, machine.id, selectedSizeByOfferId[offerId] ?? DEFAULT_TOY_SIZE);
    };

    const onSizeChange = (offerId: string, size: ToySize) => {
        setSelectedSizeByOfferId((prev) => ({...prev, [offerId]: size}));
        const machine = selectedMachineByOfferId[offerId];
        if (machine) fetchQuote(offerId, machine.id, size);
    };

    const onSubmitBarcode = async (offerId: string, side: ShipmentSide) => {
        const barcode = barcodeInputByOfferId[offerId]?.trim();
        if (!barcode) {
            notifyError(new Error("Enter the barcode Omniva gave you first."));
            return;
        }
        try {
            setSubmittingBarcodeId(offerId);
            await submitOmnivaBarcode(
                offerId,
                side,
                barcode,
                selectedMachineByOfferId[offerId]?.id,
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
                        {x.canSubmitBarcode &&
                            <div style={{display: 'flex', flexDirection: 'column', gap: '0.5em', alignItems: 'center'}}>
                                <p style={{fontSize: '0.85em', color: 'var(--color-text-dim)', margin: 0, textAlign: 'center'}}>
                                    Register your shipment yourself on Omniva's own site/app
                                    (no account with us needed there), then paste the barcode it gives you below.
                                </p>
                                <ParcelMachinePicker
                                    value={selectedMachineByOfferId[x.id]?.id}
                                    onChange={(machine) => onMachineChange(x.id, machine)}
                                />
                                <label style={{display: 'flex', alignItems: 'center', gap: '0.5em', fontSize: '0.9em'}}>
                                    Toy size:
                                    <select
                                        value={selectedSizeByOfferId[x.id] ?? DEFAULT_TOY_SIZE}
                                        onChange={(e) => onSizeChange(x.id, e.target.value as ToySize)}
                                    >
                                        {TOY_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                                    </select>
                                </label>
                                {selectedMachineByOfferId[x.id] &&
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
                                            href={OMNIVA_PRICE_LIST_URL[selectedMachineByOfferId[x.id].countryCode]}
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{fontSize: '0.85em'}}
                                        >
                                            Check exact Omniva shipping price for {selectedMachineByOfferId[x.id].countryCode}
                                        </a>
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
                        {x.isMyTurnToPay &&
                            <div style={{display: 'flex', flexDirection: 'column', gap: '0.5em', alignItems: 'center'}}>
                                <p style={{fontSize: '0.8em', color: 'var(--color-text-dim)', margin: 0, textAlign: 'center'}}>
                                    Your toy was confirmed received - time to pay ToyTrader's 1 EUR service fee.
                                </p>
                                <button
                                    className="btn-primary"
                                    disabled={payingId === x.id}
                                    onClick={() => payForShipment(x.id, x.mySide)}
                                >
                                    {payingId === x.id ? 'redirecting to payment...' : 'Pay service fee (1 EUR)'}
                                </button>
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
