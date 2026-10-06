import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Store } from "react-notifications-component";
import { auth } from "../firebase-config";
import { Offer } from "../types/offer";
import { GoodAppContext } from "../hooks/context";
import { useContextSelector } from "use-context-selector";
import { Toy } from "../types/toy";
import { ParcelMachine, ShipmentSide, declineOffer, startShipmentCheckout, updateOffer } from "../hooks/helper";
import ParcelMachinePicker from "../components/parcelMachinePicker";
import { DEFAULT_TOY_SIZE, OMNIVA_PRICE_LIST_URL, TOY_SIZES, ToySize } from "../constants/omnivaPricing";

const newToy = 'https://images.thewest.com.au/publication/C-7139668/f9b8852d964a8de53d6089791d3e176fbb732976-16x9-x0y723w3000h1688.jpg';
interface HistoryItem {
    id: string,
    toyIOffered: Toy;
    status: string;
    toyTargeted: Toy;
    mySide: ShipmentSide;
    isMyTurnToPay: boolean;
    isMyTurnToRespond: boolean;
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
    const [selectedMachineByOfferId, setSelectedMachineByOfferId] = useState<Record<string, ParcelMachine>>({});
    const [selectedSizeByOfferId, setSelectedSizeByOfferId] = useState<Record<string, ToySize>>({});

    useEffect(() => {
        let history:HistoryItem[] = [];
        const uid = auth.currentUser?.uid;

        offers.forEach((o: Offer) => {
            const isInitiator = o.userInitiated === uid;
            const isReceiver = o.userReceived === uid;
            if (!isInitiator && !isReceiver) return;

            const mySide: ShipmentSide = isInitiator ? 'offer' : 'target';
            const myPosted = mySide === 'offer' ? o.offerPosted : o.targetPosted;
            const myShipmentPaid = mySide === 'offer' ? o.offerShipmentPaid : o.targetShipmentPaid;
            const myShipmentBarcode = mySide === 'offer' ? o.offerShipmentBarcode : o.targetShipmentBarcode;
            const myShipmentStatus = mySide === 'offer' ? o.offerShipmentStatus : o.targetShipmentStatus;

            history.push({
                id: o.id,
                mySide,
                myShipmentBarcode,
                myShipmentStatus,
                isMyTurnToPay: !!o.offerAccepted && !myPosted && !myShipmentPaid,
                isMyTurnToRespond: isReceiver && !o.offerAccepted,
                toyIOffered: toys.find((x:Toy) => x.id === o.toyOffered),
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
                    `,
                toyTargeted: toys.find((x:Toy) => x.id === o.toyTargeted),
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

    const payForShipment = async (offerId: string, side: ShipmentSide, parcelMachineId: string, toySize: ToySize) => {
        try {
            setPayingId(offerId);
            const { checkoutUrl } = await startShipmentCheckout(offerId, side, parcelMachineId, toySize);
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
                : x.myShipmentBarcode ?
                    <button onClick={() => navigate(`/shipment/result?offerId=${x.id}&side=${x.mySide}&status=success`)}>
                        View QR Code
                    </button>
                : x.isMyTurnToPay ?
                    <div style={{display: 'flex', flexDirection: 'column', gap: '0.5em', alignItems: 'center'}}>
                        <ParcelMachinePicker
                            value={selectedMachineByOfferId[x.id]?.id}
                            onChange={(machine) => setSelectedMachineByOfferId((prev) => ({...prev, [x.id]: machine}))}
                        />
                        <label style={{display: 'flex', alignItems: 'center', gap: '0.5em', fontSize: '0.9em'}}>
                            Toy size:
                            <select
                                value={selectedSizeByOfferId[x.id] ?? DEFAULT_TOY_SIZE}
                                onChange={(e) => setSelectedSizeByOfferId((prev) => ({...prev, [x.id]: e.target.value as ToySize}))}
                            >
                                {TOY_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                            </select>
                        </label>
                        {selectedMachineByOfferId[x.id] &&
                            <a
                                href={OMNIVA_PRICE_LIST_URL[selectedMachineByOfferId[x.id].countryCode]}
                                target="_blank"
                                rel="noreferrer"
                                style={{fontSize: '0.85em'}}
                            >
                                Check exact Omniva shipping price for {selectedMachineByOfferId[x.id].countryCode}
                            </a>
                        }
                        <p style={{fontSize: '0.8em', color: 'var(--color-text-dim)', margin: 0}}>
                            Our 1 EUR fee covers the QR label only - Omniva's own parcel delivery price
                            (based on toy size) is paid separately, check the link above.
                        </p>
                        <button
                            className="btn-primary"
                            disabled={payingId === x.id || !selectedMachineByOfferId[x.id]}
                            onClick={() => payForShipment(
                                x.id,
                                x.mySide,
                                selectedMachineByOfferId[x.id].id,
                                selectedSizeByOfferId[x.id] ?? DEFAULT_TOY_SIZE
                            )}
                        >
                            {payingId === x.id ? 'redirecting to payment...' : 'Pay & Get QR Code (1 EUR)'}
                        </button>
                    </div>
                : null}
            </div>
        )}

    </>
  );
}

export default MyOffersPage;
