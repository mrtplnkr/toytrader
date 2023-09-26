import { deleteDoc, doc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase-config";
import Item from "../components/item";
import ItemForOffer from "../components/itemForOffer";
import { Offer } from "../types/offer";
import { GoodAppContext } from "../hooks/context";
import { useContextSelector } from "use-context-selector";
import { Store } from "react-notifications-component";
import { Toy } from "../types/toy";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClose, faHandshake } from "@fortawesome/free-solid-svg-icons";
import { updateOffer } from "../hooks/helper";

function MyToysPage() {
  let navigate = useNavigate();

  const refresh = useContextSelector(GoodAppContext, (state: any) => state.refresh);

  useEffect(() => {
    refresh();
  }, []);

  const [selectedOffer, setSelectedOffer] = useState<Offer>();
  const [selectedToyOffers, setSelectedToyOffers] = useState<Array<Toy>>([]);

  const toys = useContextSelector(GoodAppContext, (state: any) => state.toys);
  const offers = useContextSelector(GoodAppContext, (state: any) => state.offers);

  const countOffers = (items: Offer[], target: string) => {
    return items.filter((x:Offer) => x.toyOffered === target).length;
  };
  
  const showOffers = async (target: string) => {
    const filterOffers = offers.filter((x:Offer) => x.toyOffered === target);
    const toyOffereds = filterOffers.map((x:Offer) => { return x.toyOffered });
    setSelectedOffer(filterOffers[0]);
    setSelectedToyOffers(
      toys
        .filter((x: Toy) => toyOffereds.some((a: any) => a === x.id))
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

  const [activeFile, setActiveFile] = useState<string | undefined>(undefined);
  const [activeOfferId, setActiveOfferId] = useState<string | undefined>(undefined);

  const setActive = (toyFile: string) => {
    setActiveFile(toyFile);
    setActiveOfferId(selectedOffer!.id);
  };

  const acceptOffer = async (id: string) => {
    await updateOffer(id)
        .then(() => Store.addNotification({
            title: "Wonderful",
            message: "this toy is on your way !",
            type: "success",
            insert: "top",
            container: "top-right",
            animationIn: ["animated", "fadeIn"],
            animationOut: ["animated", "fadeOut"],
            dismiss: {
              duration: 5000,
              onScreen: true
            }
          })
        )
        .catch((e) => Store.addNotification({
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
  
        <div style={{display: 'flex', flexDirection: 'column'}}>
          <button style={{alignSelf: 'flex-end'}} onClick={() => navigate('/addNew')}>add your toy</button>
          <button style={{alignSelf: 'flex-start'}} onClick={() => alert('not sure if its needed')}>refresh</button>
        </div>

        {activeOfferId && 
          <div className="largeOffer">
            <button onClick={() => acceptOffer(activeOfferId!)} className={'buttonFixedLeft'}>
              <FontAwesomeIcon icon={faHandshake} />
            </button>
            <img alt="my toy offer viewer" src={activeFile} />
            <button onClick={() => setActiveOfferId(undefined)} className={'buttonFixedRight'}>
              <FontAwesomeIcon icon={faClose} />
            </button>
          </div>
        }
  
        <ul id="toyList">
          {toys.length > 0 ? toys.filter((x: Toy) => x.userId === auth.currentUser?.uid).map((x: Toy) => {
            return (
              <div key={x.id}>
                <Item {...toys.find((o: Toy) => x.id === o.id)} deleteItem={deleteItem} />
                <div style={{width: '90%', margin: 'auto', color: 'yellow'}}>
                  {countOffers(offers, x.id) ? <>
                    View{' '}
                    <span style={{ textDecoration: 'underline', cursor: 'pointer' }} 
                        onClick={() => showOffers(x.id)}>{countOffers(offers, x.id)} offer(s)</span>
                    ...
                  </>
                  :
                  <>no offers..</>}
                </div>
                {countOffers(offers, x.id) && selectedToyOffers.length > 0 ?
                  <div style={{display: 'flex', flexDirection: 'row'}}>
                    {selectedToyOffers.map((ao: any) => {
                      return (
                        <div key={ao.id}>
                          <ItemForOffer setActive={setActive} {...ao} refuseOffer={refuseOffer} />
                        </div>
                      )
                    })}
                  </div>
                : <hr/> }
              </div>
            )
          }) : <div>you haven't added anything yet</div>}
        </ul>
    </>
  );
}

export default MyToysPage;
