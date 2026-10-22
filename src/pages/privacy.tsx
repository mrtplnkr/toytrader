import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBackspace } from "@fortawesome/free-solid-svg-icons";
import { Trans, useTranslation } from "react-i18next";

function PrivacyPage() {
    const navigate = useNavigate();
    const { t } = useTranslation();

    return (
        <>
            <div className="flex flex-col my-4">
                <button id="backButton" onClick={() => navigate(-1)}>
                    <FontAwesomeIcon color="darkviolet" icon={faBackspace} />
                </button>
            </div>

            <div className="card max-w-[600px] mx-auto p-6 text-left">
                <h3>{t('privacy:heading')}</h3>
                <p className="text-[0.85em] text-text-dim">{t('privacy:updated')}</p>

                <p>{t('privacy:introP1')}</p>

                <h4 className="font-bold mt-4 mb-1">{t('privacy:collectHeading')}</h4>
                <ul className="pl-5 list-disc">
                    <li>{t('privacy:collectAccount')}</li>
                    <li>{t('privacy:collectContent')}</li>
                    <li>{t('privacy:collectShipping')}</li>
                    <li>{t('privacy:collectPayment')}</li>
                    <li>{t('privacy:collectDevice')}</li>
                </ul>

                <h4 className="font-bold mt-4 mb-1">{t('privacy:useHeading')}</h4>
                <p>{t('privacy:useP1')}</p>

                <h4 className="font-bold mt-4 mb-1">{t('privacy:shareHeading')}</h4>
                <ul className="pl-5 list-disc">
                    <li>{t('privacy:shareTradePartner')}</li>
                    <li>{t('privacy:shareProviders')}</li>
                    <li>{t('privacy:shareStripe')}</li>
                    <li>{t('privacy:shareOmniva')}</li>
                </ul>
                <p>{t('privacy:noSale')}</p>

                <h4 className="font-bold mt-4 mb-1">{t('privacy:retentionHeading')}</h4>
                <p>{t('privacy:retentionP1')}</p>

                <h4 className="font-bold mt-4 mb-1">{t('privacy:rightsHeading')}</h4>
                <p>{t('privacy:rightsP1')}</p>

                <h4 className="font-bold mt-4 mb-1">{t('privacy:childrenHeading')}</h4>
                <p>{t('privacy:childrenP1')}</p>

                <h4 className="font-bold mt-4 mb-1">{t('privacy:securityHeading')}</h4>
                <p>{t('privacy:securityP1')}</p>

                <h4 className="font-bold mt-4 mb-1">{t('privacy:changesHeading')}</h4>
                <p>{t('privacy:changesP1')}</p>

                <h4 className="font-bold mt-4 mb-1">{t('privacy:contactHeading')}</h4>
                <p>
                    {/* eslint-disable-next-line jsx-a11y/anchor-has-content -- Trans clones this element and fills in the translated email at render */}
                    <Trans i18nKey="privacy:contactP1" components={{ EmailLink: <a href="mailto:toytrader27@gmail.com" /> }} />
                </p>
            </div>
        </>
    );
}

export default PrivacyPage;
