import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useContextSelector } from "use-context-selector";
import { useTranslation } from "react-i18next";
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
    const { t } = useTranslation();
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
            <div className="flex justify-center items-center h-full flex-col p-4">
                <div className="card flex flex-col items-center gap-3 max-w-[400px] p-8 text-center">
                    {status === 'cancel' ?
                        <p>{t('shipmentResult:cancelled')}</p>
                    : barcode ?
                        <>
                            <p>{t('shipmentResult:scanInstruction')}</p>
                            <div className="bg-white p-4 rounded-sm">
                                <QRCodeSVG value={barcode} size={256} />
                            </div>
                            <p className="text-text-dim text-[0.9em]">{barcode}</p>
                            <p>{t('shipmentResult:currentStatus', { status: shipmentStatus ?? t('shipmentResult:awaitingFirstScan') })}</p>
                        </>
                    : status === 'success' && !polling && !paid ?
                        <>
                            <p>{t('shipmentResult:paymentUnconfirmed')}</p>
                            <button className="btn-primary" disabled={rechecking} onClick={onRecheckPayment}>
                                {rechecking ? t('shipmentResult:checking') : t('shipmentResult:recheckPayment')}
                            </button>
                            {recheckResult === 'not-paid' &&
                                <p className="text-text-dim text-[0.9em]">
                                    {t('shipmentResult:recheckNotPaid')}
                                </p>}
                            {recheckResult === 'failed' &&
                                <p className="text-danger text-[0.9em]">
                                    {t('shipmentResult:recheckFailed')}
                                </p>}
                        </>
                    : status === 'success' ?
                        <p>{polling ? t('shipmentResult:confirmingTip') : t('shipmentResult:thanksForTip')}</p>
                    :
                        <p>{t('shipmentResult:noBarcodeYet')}</p>
                    }
                    <button onClick={() => navigate('/myOffers')} className="mt-2">
                        {t('shipmentResult:backToMyOffers')}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ShipmentResultPage;
