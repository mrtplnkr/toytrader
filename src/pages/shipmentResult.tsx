import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useContextSelector } from "use-context-selector";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRemove } from "@fortawesome/free-solid-svg-icons";
import { QRCodeSVG } from "qrcode.react";
import { GoodAppContext } from "../hooks/context";
import { Offer } from "../types/offer";
import { ShipmentSide, recheckShipmentPayment } from "../hooks/helper";

const POLL_ATTEMPTS = 3;
const POLL_DELAY_MS = 1500;

function ShipmentResultPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const offerId = searchParams.get('offerId') ?? undefined;
    const side = (searchParams.get('side') as ShipmentSide | null) ?? undefined;
    const status = searchParams.get('status');

    const refresh = useContextSelector(GoodAppContext, (state: any) => state.refresh);
    const offers = useContextSelector(GoodAppContext, (state: any) => state.offers);

    const [rechecking, setRechecking] = useState(false);
    const [recheckResult, setRecheckResult] = useState<'not-paid' | 'failed' | undefined>();

    const offer: Offer | undefined = offers.find((o: Offer) => o.id === offerId);
    const barcode = offer && side ?
        (side === 'offer' ? offer.offerShipmentBarcode : offer.targetShipmentBarcode) : undefined;
    const paid = offer && side ?
        !!(side === 'offer' ? offer.offerShipmentPaid : offer.targetShipmentPaid) : false;
    const shipmentStatus = offer && side ?
        (side === 'offer' ? offer.offerShipmentStatus : offer.targetShipmentStatus) : undefined;

    // Payment confirmation came back from Stripe (status=success) but the
    // webhook hasn't caught up to mark it paid yet - poll briefly, same
    // fallback-to-manual-recheck pattern as before, just targeting the
    // payment flag instead of a barcode (barcode is now entered separately
    // by the user, not generated automatically after payment).
    const [polling, setPolling] = useState(status === 'success' && !paid);

    useEffect(() => {
        if (status !== 'success' || paid) {
            setPolling(false);
            return;
        }

        let attempts = 0;
        const interval = setInterval(async () => {
            attempts += 1;
            await refresh();
            if (attempts >= POLL_ATTEMPTS) {
                clearInterval(interval);
                setPolling(false);
            }
        }, POLL_DELAY_MS);

        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, paid]);

    const onRecheckPayment = async () => {
        if (!offerId || !side) return;
        setRechecking(true);
        setRecheckResult(undefined);
        try {
            const { paid: nowPaid } = await recheckShipmentPayment(offerId, side);
            if (nowPaid) {
                await refresh();
            } else {
                setRecheckResult('not-paid');
            }
        } catch (err) {
            setRecheckResult('failed');
        } finally {
            setRechecking(false);
        }
    };

    return (
        <div className="largeOffer">
            <button className="buttonFixedRight" onClick={() => navigate('/myOffers')}>
                <FontAwesomeIcon icon={faRemove} />
            </button>
            <div style={{
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                height: '100%', flexDirection: 'column', padding: '1em'
            }}>
                <div className="card" style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75em',
                    maxWidth: '400px', padding: '2em', textAlign: 'center'
                }}>
                    {status === 'cancel' ?
                        <p>Checkout was cancelled - you can try again from your offers.</p>
                    : barcode ?
                        <>
                            <p>Scan this code at an Omniva parcel machine to drop off your toy.</p>
                            <div style={{background: '#fff', padding: '1em', borderRadius: 'var(--radius-sm)'}}>
                                <QRCodeSVG value={barcode} size={256} />
                            </div>
                            <p style={{color: 'var(--color-text-dim)', fontSize: '0.9em'}}>{barcode}</p>
                            <p>Current status: {shipmentStatus ?? 'awaiting first scan'}</p>
                        </>
                    : status === 'success' && !polling && !paid ?
                        <>
                            <p>We couldn't confirm your payment yet - this can happen if the
                                confirmation is still catching up.</p>
                            <button className="btn-primary" disabled={rechecking} onClick={onRecheckPayment}>
                                {rechecking ? 'checking...' : "I already paid - check again"}
                            </button>
                            {recheckResult === 'not-paid' &&
                                <p style={{color: 'var(--color-text-dim)', fontSize: '0.9em'}}>
                                    Stripe shows this payment hasn't gone through yet. If you completed
                                    checkout, give it a minute and try again.
                                </p>}
                            {recheckResult === 'failed' &&
                                <p style={{color: 'var(--color-danger)', fontSize: '0.9em'}}>
                                    Couldn't check right now - please try again shortly.
                                </p>}
                        </>
                    : status === 'success' ?
                        <p>{polling ? 'Confirming your payment...' : 'Thanks - your service fee was received!'}</p>
                    :
                        <p>Register your shipment on Omniva's own site, then save your barcode
                            from your offers page to see it here as a QR code.</p>
                    }
                    <button onClick={() => navigate('/myOffers')} style={{marginTop: '0.5em'}}>
                        Back to My Offers
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ShipmentResultPage;
