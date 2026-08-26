import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useContextSelector } from "use-context-selector";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRemove } from "@fortawesome/free-solid-svg-icons";
import { QRCodeSVG } from "qrcode.react";
import { GoodAppContext } from "../hooks/context";
import { Offer } from "../types/offer";
import { ShipmentSide } from "../hooks/helper";

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

    const [polling, setPolling] = useState(status === 'success');

    const offer: Offer | undefined = offers.find((o: Offer) => o.id === offerId);
    const barcode = offer && side ?
        (side === 'offer' ? offer.offerShipmentBarcode : offer.targetShipmentBarcode) : undefined;
    const shipmentError = offer && side ?
        (side === 'offer' ? offer.offerShipmentError : offer.targetShipmentError) : undefined;

    useEffect(() => {
        if (status !== 'success' || barcode) {
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
    }, [status, barcode]);

    return (
        <div className="largeOffer">
            <button className="buttonFixedRight" onClick={() => navigate('/myOffers')}>
                <FontAwesomeIcon icon={faRemove} />
            </button>
            <div style={{
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                height: '100%', flexDirection: 'column', background: 'white'
            }}>
                {status === 'cancel' ?
                    <p>Checkout was cancelled - you can try again from your offers.</p>
                : shipmentError ?
                    <p>Payment succeeded but we couldn't generate your shipping label yet.
                        Please contact support and mention offer {offerId}.</p>
                : barcode ?
                    <>
                        <QRCodeSVG value={barcode} size={256} />
                        <p>{barcode}</p>
                    </>
                : polling ?
                    <p>Payment received - generating your shipping label...</p>
                :
                    <p>We couldn't find your shipping label yet - check back on your offers page shortly.</p>
                }
            </div>
        </div>
    );
}

export default ShipmentResultPage;
