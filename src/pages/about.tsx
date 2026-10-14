import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBackspace } from "@fortawesome/free-solid-svg-icons";

function AboutPage() {
    const navigate = useNavigate();

    return (
        <>
            <div style={{display: 'flex', flexDirection: 'column', margin: '1em 0'}}>
                <button id="backButton" onClick={() => navigate(-1)}>
                    <FontAwesomeIcon color="darkviolet" icon={faBackspace} />
                </button>
            </div>

            <div className="card" style={{maxWidth: '600px', margin: '0 auto', padding: '1.5em', textAlign: 'left'}}>
                <h3>About ToyTrader</h3>
                <p>
                    ToyTrader is a small, independent project for trading toys directly with other
                    families nearby - no money changes hands in the trade itself, just toy for toy.
                    It started as a way to help kids pass unwanted toys on to someone who'll actually
                    enjoy them, instead of letting them pile up or get thrown away.
                </p>
                <p>
                    It's run by a single developer, not a company, and it's a side project rather than
                    a full-time business. There's no customer support team - if something goes wrong,
                    the person reading your report on the <a href="/help">Help</a> page is also the
                    person who built the app.
                </p>
                <p>
                    Shipping happens through Omniva's own parcel-machine network, arranged directly by
                    each trader on Omniva's site - ToyTrader never handles your toy or your payment for
                    shipping. The optional 1 EUR tip some traders choose to leave simply helps keep the
                    app running; it's never required.
                </p>
                <p>
                    Questions, problems, or just want to say hi? Use the <a href="/help">Help</a> page
                    to report an issue with a specific trade, or see the <a href="/disclaimer">Disclaimer</a>{' '}
                    for what ToyTrader can and can't be responsible for.
                </p>
            </div>
        </>
    );
}

export default AboutPage;
