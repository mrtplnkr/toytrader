import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";

interface Props {
    onAgree: () => void;
    onCancel: () => void;
    confirmLabel: string;
}

// Shown before either side commits to a trade (addNewOffer.tsx's propose
// button, myOffers.tsx's accept button) - makes the Privacy Policy's
// otherwise-passive disclosure (shipping name/phone/parcel machine shared
// with a trade partner) an explicit, must-agree step at the two moments
// that actually trigger it.
function TradeConsentModal({ onAgree, onCancel, confirmLabel }: Props) {
    const { t } = useTranslation();
    const [agreed, setAgreed] = useState(false);

    return (
        <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center gap-4 bg-bg/90 backdrop-blur-sm p-4"
            onClick={onCancel}>
            <div className="card flex flex-col gap-4 max-w-[420px] p-6 text-left" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-start gap-4">
                    <h3 className="m-0">{t('tradeConsent:heading')}</h3>
                    <button onClick={onCancel} title={t('tradeConsent:cancel')}>
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>

                <p className="m-0 text-[0.9em]">{t('tradeConsent:body')}</p>

                <label className="flex items-start gap-2 text-[0.9em] cursor-pointer">
                    <input type="checkbox" className="mt-1" checked={agreed}
                        onChange={(e) => setAgreed(e.target.checked)} />
                    {t('tradeConsent:checkboxLabel')}
                </label>

                <div className="flex gap-2 justify-end">
                    <button onClick={onCancel}>{t('tradeConsent:cancel')}</button>
                    <button className="btn-primary" disabled={!agreed} onClick={onAgree}>
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default TradeConsentModal;
