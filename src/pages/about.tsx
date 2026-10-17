import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBackspace } from "@fortawesome/free-solid-svg-icons";
import { Trans, useTranslation } from "react-i18next";

function AboutPage() {
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
                <h3>{t('about:heading')}</h3>
                <p>{t('about:p1')}</p>
                <p>
                    {/* eslint-disable-next-line jsx-a11y/anchor-has-content -- Trans clones this element and fills in the translated link text at render */}
                    <Trans i18nKey="about:p2" components={{ HelpLink: <a href="/help" /> }} />
                </p>
                <p>{t('about:p3')}</p>
                <p>
                    {/* eslint-disable-next-line jsx-a11y/anchor-has-content -- same as above, two link placeholders this time */}
                    <Trans i18nKey="about:p4" components={{ HelpLink: <a href="/help" />, DisclaimerLink: <a href="/disclaimer" /> }} />
                </p>
            </div>
        </>
    );
}

export default AboutPage;
