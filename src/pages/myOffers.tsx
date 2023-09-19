import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase-config";
import { Offer } from "../types/offer";
import { GoodAppContext } from "../hooks/context";
import { useContextSelector } from "use-context-selector";
import { Toy } from "../types/toy";

const newToy = 'https://images.thewest.com.au/publication/C-7139668/f9b8852d964a8de53d6089791d3e176fbb732976-16x9-x0y723w3000h1688.jpg';
interface HistoryItem {
    id: string,
    toyIOffered: Toy;
    status: string;
    toyTargeted: Toy;
}

enum Status {
    created, pending, accepted, posted, received
}

function MyOffersPage() {
    let navigate = useNavigate();

    const toys = useContextSelector(GoodAppContext, (state: any) => state.toys);
    const offers = useContextSelector(GoodAppContext, (state: any) => state.offers);

    const [history, setHistory] = useState<HistoryItem[]>([]);

    useEffect(() => {
        let history:HistoryItem[] = [];
        offers.filter((a:Offer) => a.userInitiated === auth.currentUser?.uid).forEach((o: Offer) => {
            history.push({
                toyIOffered: toys.find((x:Toy) => x.id === o.toyOffered),
                id: o.id,
                status: `<li>you offered your <a href="${newToy}" target="_target">toy</a>
                            on ${(o.offerCreated as Date).toDateString()}</li>
                    ${o.offerAccepted ?
                        `<li>your offer was accepted on ${(o.offerAccepted as Date).toDateString()}</li>`
                        :
                        '<li>waiting for your offer to be accepted by user</li>'}
                    ${o.offerPosted ?
                        `<li>your <a href="${newToy}" target="_blank">toy</a> was ${Status[Status.posted]} on ${(o.offerReceived as Date).toDateString()}</li>`
                        :
                        `<li>it's your turn to send your toy out and show us the proof</li>`}
                    ${o.targetPosted ?
                        `<li>your new <a href="${newToy}" target="_blank">toy</a> was ${Status[Status.posted]} on ${(o.offerReceived as Date).toDateString()}
                            and will arrive soon</li>`
                        :
                        `<li>waiting for user to send your new toy</li>`}
                    ${o.offerReceived ?
                        `<li>your toy was received - ${(o.offerReceived as Date).toDateString()}</li>`
                        :
                        '<li>expect your toy to arrive within (x) days</li>'}
                    `,
                toyTargeted: toys.find((x:Toy) => x.id === o.toyTargeted),
            });
        });
        setHistory(history);
    }, []);

  return (
    <>
        <h3>All offers made by you</h3>

        <div style={{display: 'flex', flexDirection: 'column'}}>
          <button style={{alignSelf: 'flex-end'}} onClick={() => navigate('/addNew')}>add your toy</button>
          <button style={{alignSelf: 'flex-start'}} onClick={() => alert('not sure if its needed')}>refresh</button>
        </div>

        {history.map((x:HistoryItem) => 
            <div style={{display: 'flex', justifyContent: 'center', margin: '1em 0', padding: '1em', border: '1px solid purple'}} key={x.id}>
                <img style={{width:'50px'}} alt="offered" src={x.toyIOffered.file} />
                <ul className="statusLines" dangerouslySetInnerHTML={{__html: x.status}} style={{
                    color: 'white',
                    verticalAlign: 'top',
                    margin: '20px'
                }}></ul>
                <img style={{width:'50px'}} alt="targeted" src={x.toyTargeted.file} />
            </div>
        )}

    </>
  );
}

export default MyOffersPage;
