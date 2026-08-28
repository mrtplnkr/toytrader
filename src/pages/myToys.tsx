import { deleteDoc, doc } from "firebase/firestore";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase-config";
import Item from "../components/item";
import { Offer } from "../types/offer";
import { GoodAppContext } from "../hooks/context";
import { useContextSelector } from "use-context-selector";
import { Store } from "react-notifications-component";
import { Toy } from "../types/toy";

function MyToysPage() {
  let navigate = useNavigate();

  const refresh = useContextSelector(GoodAppContext, (state: any) => state.refresh);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toys = useContextSelector(GoodAppContext, (state: any) => state.toys);
  const offers = useContextSelector(GoodAppContext, (state: any) => state.offers);

  const countOffers = (items: Offer[], target: string) => {
    return items.filter((x:Offer) => x.toyOffered === target).length;
  };

  const deleteItem = async (id: string) => {
    const movieDoc = doc(db, "toys", id);
    await deleteDoc(movieDoc)
      .then(() => Store.addNotification({
        title: "Success !",
        message: "Toy successfully removed from your toy list.",
        type: "success",
        insert: "top",
        container: "top-right",
        animationIn: ["animated", "fadeIn"],
        animationOut: ["animated", "fadeOut"],
        dismiss: {
          duration: 5000,
          onScreen: true
        }
      }))
      .catch((e) =>
        Store.addNotification({
          title: "Unfortunately this action failed !",
          message: "Please try again later... " + e.message.toString(),
          type: "danger",
          insert: "top",
          container: "top-right",
          animationIn: ["animated", "fadeIn"],
          animationOut: ["animated", "fadeOut"],
          dismiss: {
            duration: 5000,
            onScreen: true
          }
      })
    );
  };

  return (
    <>
        <h3>All your toys</h3>

        <div style={{display: 'flex', justifyContent: 'space-between', margin: '0 0 1.5em'}}>
          <button onClick={() => alert('not sure if its needed')}>refresh</button>
          <button className="btn-primary" onClick={() => navigate('/addNew')}>add your toy</button>
        </div>

        <ul id="toyList">
          {toys.length > 0 ? toys.filter((x: Toy) => x.userId === auth.currentUser?.uid).map((x: Toy) => {
            return (
              <div key={x.id}>
                <Item {...toys.find((o: Toy) => x.id === o.id)} deleteItem={deleteItem} />
                <div style={{fontSize: '0.9em', color: 'var(--color-text-dim)'}}>
                  {countOffers(offers, x.id) ?
                    <div>
                      You have{' '}
                      <span style={{ color: 'var(--color-primary)', textDecoration: 'underline', cursor: 'pointer' }}
                          onClick={() => navigate('/myOffers')}>{countOffers(offers, x.id)} offer(s)</span>
                      {' '}on this toy - accept or decline them from My Offers.
                    </div>
                  :
                    <>no offers..</>}
                </div>
              </div>
            )
          }) : <div>you haven't added anything yet</div>}
        </ul>
    </>
  );
}

export default MyToysPage;
