import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBackspace } from "@fortawesome/free-solid-svg-icons";
import { Trans, useTranslation } from "react-i18next";

function DisclaimerPage() {
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
                <h3>{t('disclaimer:heading')}</h3>

                <p><strong>{t('disclaimer:p1Strong')}</strong> {t('disclaimer:p1Rest')}</p>

                <p><strong>{t('disclaimer:p2Strong')}</strong> {t('disclaimer:p2Rest')}</p>

                <p><strong>{t('disclaimer:p3Strong')}</strong> {t('disclaimer:p3Rest')}</p>

                <p><strong>{t('disclaimer:p4Strong')}</strong> {t('disclaimer:p4Rest')}</p>

                <p><strong>{t('disclaimer:p5Strong')}</strong> {t('disclaimer:p5Rest')}</p>

                <p>
                    {/* eslint-disable-next-line jsx-a11y/anchor-has-content -- Trans clones this element and fills in the translated link text at render */}
                    <Trans i18nKey="disclaimer:p6" components={{ HelpLink: <a href="/help" /> }} />
                </p>
            </div>
        </>
    );
}

export default DisclaimerPage;
