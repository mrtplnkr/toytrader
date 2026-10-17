
import { faFaceSmileBeam, faHeart, faSmileWink } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import logo from '../logo.svg';
import { startDonationCheckout } from '../hooks/helper';

const DONATION_TIERS_EUR_CENTS = [300, 500, 1000];

function PublicPage() {
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const donationStatus = searchParams.get('donation');

    const [donatingCents, setDonatingCents] = useState<number | undefined>();

    const donate = async (amountCents: number) => {
        try {
            setDonatingCents(amountCents);
            const { checkoutUrl } = await startDonationCheckout(amountCents);
            window.location.href = checkoutUrl;
        } catch (err) {
            setDonatingCents(undefined);
        }
    };

    const randomSelect = () => {
      const actionWords = t('public:actionWords', { returnObjects: true }) as string[];
      return actionWords[Math.floor(Math.random() * actionWords.length)];
    }

    return (
      <>
        <h1 className="App-header">{t('public:appHeading')}</h1>

        <img src={logo} className="App-logo" alt="ToyTrader logo" />

        <div id="intro">
          <h3>
            <Trans i18nKey="public:boredQuestion" components={{ Old: <span className="text-primary" /> }} />
          </h3>
          <h2>
            <Trans i18nKey="public:wellTradeThem" values={{ word: randomSelect() }} components={{ Action: <span className="text-success" /> }} />
          </h2>
          <div className="text-[1.5em]">
            <Trans i18nKey="public:discoverFun" components={{
              Discover: <span className="font-bold" />,
              Fun: <span className="text-primary font-bold" />,
              Trading: <span className="text-success font-bold" />,
              GrownUps: <span className="font-bold" />,
            }} />
             <div className="text-[0.8em] text-text-dim">{t('public:exceptToy4Toy', { word: randomSelect() })}</div>
          </div>
          <p className="text-[1.2em]">
            {t('public:justLogin')}
          </p>
          <p className="text-primary font-bold text-[1.5em]">{t('public:enjoy')}</p>
        </div>

        <div id="parentIntro">
          <p className="text-[1.4em]">{t('public:asForParents')}</p>
          <p className="text-success text-[1.2em]">{t('public:enoughPlastic')} <FontAwesomeIcon icon={faSmileWink} /></p>
          <p className="text-[1.5em]">{t('public:helpYoungsters')}</p>
          <p className="text-primary text-[1.3em]">{t('public:someoneAppreciate')}</p>
          <p className="text-[1.6em]">{t('public:letThemTrade')}</p>
          <p className="text-[1.3em]">{t('public:learnSkills')} <FontAwesomeIcon icon={faFaceSmileBeam} /></p>
        </div>

        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('public:learnReact')}
        </a>

        <div className="flex flex-col items-center gap-2 my-8">
          {donationStatus === 'success' ?
            <p className="text-primary text-[1.2em]">
              {t('public:donationThankYou')} <FontAwesomeIcon icon={faHeart} />
            </p>
          : donationStatus === 'cancel' ?
            <p className="text-text-dim">{t('public:donationCancelled')}</p>
          :
            <>
              <p className="text-[0.95em] text-text-dim">
                {t('public:donationSupportPrompt')} <FontAwesomeIcon icon={faHeart} />
              </p>
              <div className="flex gap-3">
                {DONATION_TIERS_EUR_CENTS.map((cents) => (
                  <button
                    key={cents}
                    className="btn-primary"
                    disabled={donatingCents !== undefined}
                    onClick={() => donate(cents)}
                  >
                    {donatingCents === cents ? t('public:redirecting') : `€${(cents / 100).toFixed(0)}`}
                  </button>
                ))}
              </div>
            </>
          }
        </div>

        <div className="flex gap-4 justify-center text-[0.85em] my-4">
          <a href="/about">{t('public:aboutUs')}</a>
          <a href="/disclaimer">{t('public:disclaimer')}</a>
        </div>
      </>
    );
}
  
export default PublicPage;