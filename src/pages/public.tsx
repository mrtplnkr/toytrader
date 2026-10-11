
import { faFaceSmileBeam, faHeart, faSmileWink } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import logo from '../logo.svg';
import { startDonationCheckout } from '../hooks/helper';

const randomWord = ['trade', 'swap', 'switch', 'exchange']

const DONATION_TIERS_EUR_CENTS = [300, 500, 1000];

function PublicPage() {
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
      return randomWord[Math.floor(Math.random() * randomWord.length)];
    }

    return (
      <>
        <h1 className="App-header">Toy Trader App</h1>

        <img src={logo} className="App-logo" alt="ToyTrader logo" />
        
        <div id="intro">
          <h3>
            Bored of <span style={{color: 'var(--color-primary)'}}>your old</span> toys ?
          </h3>
          <h2>Well, <span style={{color: 'var(--color-success)'}}>{randomSelect()}</span> them !</h2>
          <div style={{fontSize: '1.5em'}}>
            <span style={{fontWeight: 'bold'}}> Discover </span> the
            <span style={{color: 'var(--color-primary)', fontWeight: 'bold' }}> fun </span>
             of
             <span style={{color: 'var(--color-success)', fontWeight: 'bold'}}> trading </span>
             , just like the <span style={{fontWeight: 'bold'}}> GROWN UPS </span> do !
             <div style={{fontSize: '0.8em', color: 'var(--color-text-dim)'}}>Except, not for money, just {randomSelect()} toy4toy</div>
          </div>
          <p style={{fontSize: '1.2em'}}>
            Just login and start checking all them toys of other children
             which you can swap and share as you grow.
          </p>
          <p style={{color: 'var(--color-primary)', fontWeight: 'bold', fontSize: '1.5em'}}>Enjoy !</p>
        </div>

        <div id="parentIntro">
          <p style={{fontSize: '1.4em'}}>as for the parents :</p>
          <p style={{color: 'var(--color-success)', fontSize: '1.2em'}}>don't you have enough plastic at home ? <FontAwesomeIcon icon={faSmileWink} /></p>
          <p style={{fontSize: '1.5em'}}>help your youngsters to showcase their unwanted toys instead of discarding them..</p>
          <p style={{color: 'var(--color-primary)', fontSize: '1.3em'}}>someone would still appreciate them as new !</p>
          <p style={{fontSize: '1.6em'}}>so go ahead, let them trade with each other!</p>
          <p style={{fontSize: '1.3em'}}>they might as well learn new skills for life <FontAwesomeIcon icon={faFaceSmileBeam} /></p>
        </div>

        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>

        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5em', margin: '2em 0'}}>
          {donationStatus === 'success' ?
            <p style={{color: 'var(--color-primary)', fontSize: '1.2em'}}>
              Thank you so much for the donation! <FontAwesomeIcon icon={faHeart} />
            </p>
          : donationStatus === 'cancel' ?
            <p style={{color: 'var(--color-text-dim)'}}>Donation cancelled - no charge was made.</p>
          :
            <>
              <p style={{fontSize: '0.95em', color: 'var(--color-text-dim)'}}>
                Enjoying ToyTrader? You can support it with a small donation <FontAwesomeIcon icon={faHeart} />
              </p>
              <div style={{display: 'flex', gap: '0.75em'}}>
                {DONATION_TIERS_EUR_CENTS.map((cents) => (
                  <button
                    key={cents}
                    className="btn-primary"
                    disabled={donatingCents !== undefined}
                    onClick={() => donate(cents)}
                  >
                    {donatingCents === cents ? 'redirecting...' : `€${(cents / 100).toFixed(0)}`}
                  </button>
                ))}
              </div>
            </>
          }
        </div>
      </>
    );
}
  
export default PublicPage;