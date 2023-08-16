import { deleteDoc, doc, updateDoc } from "firebase/firestore";
import { useState } from "react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase-config";
import { DashboardContext } from "../hooks/context";
import Item from "../components/item";
import { getOfferList, getToyList, offersCollectionRef } from "../hooks/helper";
import { Toy } from "../types/toy";
import ItemForOffer from "../components/itemForOffer";
  
function MyToysPage() {
  let navigate = useNavigate();

  const [toyList, setToyList] = useState<Array<Toy>>([]);
  const [allOffers, setAllOffers] = useState<Array<Toy>>([]);

  useEffect(() => {
    getToys();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getToys = async () => {
    if (auth.currentUser) setToyList(await getToyList(true, auth.currentUser.uid));
  };

  useEffect(() => {
      if (toyList.length > 0) localStorage.setItem('myToys', toyList.length.toString())
  }, [toyList.length]);

  const getOffers = async (id: string) => {
    setAllOffers(await getOfferList(id));
  };

  const deleteItem = async (id: string) => {
    const movieDoc = doc(db, "toys", id);
    await deleteDoc(movieDoc);
    await getToys();
  };

  const refuseOffer = async () => {
    alert('not implemented');
    // await updateDoc(offersCollectionRef, );
    // where 1 toy
    // and where 2 toy
  };
  
  return (
    <>
      <DashboardContext.Provider value={{
        userId: auth?.currentUser?.uid,
        userName: auth?.currentUser?.displayName,
        photoUrl: auth?.currentUser?.photoURL,
      }}>
        <h3>All your toys</h3>
  
        <div style={{display: 'flex', flexDirection: 'column'}}>
          <button style={{alignSelf: 'flex-end'}} onClick={() => navigate('/addNew')}>add your toy</button>
          <button style={{alignSelf: 'flex-start'}} onClick={() => getToys()}>refresh</button>
        </div>
  
        <ul id="toyList">
          {toyList.length > 0 ? toyList.map((x) => {
            return (
              <div>
                <span style={{position: 'absolute'}} onClick={() => getOffers(x.id)}>check for offers</span>
                <Item key={x.id} {...x} deleteItem={deleteItem} />
                {allOffers.some(o => o.id === x.id) ? 
                  <>
                    {allOffers.map((ao) => {
                      return (
                        <ItemForOffer key={ao.id} {...ao} refuseOffer={refuseOffer} />
                      )
                    })}
                  </> 
                  : 
                  <span>no offers</span>
                }
              </div>
            )
          }) : <div>you haven't added anything yet</div>}
        </ul>
      </DashboardContext.Provider>
    </>
  );
}

export default MyToysPage;