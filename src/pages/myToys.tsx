import { deleteDoc, doc } from "firebase/firestore";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase-config";
import Item from "../components/item";
import ItemForOffer from "../components/itemForOffer";
import { Offer } from "../types/offer";
import { GoodAppContext } from "../hooks/context";
import { useContextSelector } from "use-context-selector";
import { Store } from "react-notifications-component";
import { Toy } from "../types/toy";

function MyToysPage() {
  let navigate = useNavigate();

  const [selectedOfferId, setSelectedOfferId] = useState<string>();
  const [selectedToyOffers, setSelectedToyOffers] = useState<Array<Toy>>([]);

  const toys = useContextSelector(GoodAppContext, (state: any) => state.toys);
  const offers = useContextSelector(GoodAppContext, (state: any) => state.offers);

  const countOffers = (items: Offer[], target: string) => {
    return items.filter((x:any) => x.toyTargeted === target).length;
  };
  
  const showOffers = async (target: string) => {
    const filterOffers = offers.filter((x:Offer) => x.toyTargeted === target);
    const offeredToys = filterOffers.map((x:Offer) => { return x.toyOffered });
    setSelectedOfferId(filterOffers[0].id);
    setSelectedToyOffers(
      toys
        .filter((x: Toy) => offeredToys.some((a: any) => a === x.id))
        .map((x: Toy) => { return { ...x } })
    );
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
    // await getToys();
  };

  const refuseOffer = async () => {
    alert('not implemented');
    // await updateDoc(offersCollectionRef, );
    // where 1 toy
    // and where 2 toy
  };
  
  return (
    <>
        <h3>All your toys</h3>
  
        <div style={{display: 'flex', flexDirection: 'column'}}>
          <button style={{alignSelf: 'flex-end'}} onClick={() => navigate('/addNew')}>add your toy</button>
          <button style={{alignSelf: 'flex-start'}} onClick={() => alert('not sure if its needed')}>refresh</button>
        </div>
  
        <ul id="toyList">
          {toys.length > 0 ? toys.filter((x: Toy) => x.userId === auth.currentUser?.uid).map((x: Toy) => {
            return (
              <div key={x.id}>
                <Item {...toys.find((o: Toy) => x.id === o.id)} deleteItem={deleteItem} />
                <div style={{width: '90%', margin: 'auto', color: 'yellow'}}>
                  <>
                    View{' '}
                    <span style={{ textDecoration: 'underline', cursor: 'pointer' }} 
                        onClick={() => showOffers(x.id)}>{countOffers(offers, x.id)} offer(s)</span>
                    ...
                  </>
                </div>
                {selectedToyOffers.length > 0 &&
                  <div style={{display: 'flex', flexDirection: 'row'}}>
                    {selectedToyOffers.map((ao: any) => {
                      return (
                        <div key={ao.id}>
                          <ItemForOffer {...ao} refuseOffer={refuseOffer} offerId={selectedOfferId!} />
                        </div>
                      )
                    })}
                  </div>
                }
              </div>
            )
          }) : <div>you haven't added anything yet</div>}
        </ul>
    </>
  );
}

export default MyToysPage;