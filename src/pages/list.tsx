import { faBatteryEmpty, faGear } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { collection } from "firebase/firestore";
import { useState } from "react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase-config";
import { DashboardContext } from "../hooks/context";
import Item from "../components/item";
import { getToyList } from "../hooks/helper";

interface Toy {
  title: string;
  id: string;
  file: string;
  userId: string;
}

function ListPage() {
  let navigate = useNavigate();

  const [toyList, setToyList] = useState<Array<Toy>>([]);

  const toysCollectionRef = collection(db, "toys");

  useEffect(() => {
    getToys();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [myWishedItems, setMyWishedItems] = useState<any[]>([]);

  useEffect(() => {
    localStorage.setItem("wishListItems", JSON.stringify(myWishedItems))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myWishedItems?.length]);

  const addRemoveWish = (newItem: any) => {
      if (myWishedItems && myWishedItems.filter(x => x.id === newItem.id).length) {
        setMyWishedItems(myWishedItems.filter(x => x.id !== newItem.id));
      } else {
        setMyWishedItems(myWishedItems.concat([newItem]));
      }
  }

  const getToys = async () => {
    if (auth.currentUser) setToyList(await getToyList(false, auth.currentUser.uid));
  };

  return (
    <>
      <DashboardContext.Provider value={{
        userId: auth?.currentUser?.uid,
        userName: auth?.currentUser?.displayName,
        photoUrl: auth?.currentUser?.photoURL,
      }}>
        <h3>Search for toys in your area</h3>

        <div style={{display: 'flex', flexDirection: 'column'}}>
          <button style={{alignSelf: 'flex-end'}} onClick={() => navigate('/addNew')}>add your toy</button>
          <button style={{alignSelf: 'flex-start'}} onClick={() => getToys()}>refresh</button>
        </div>

        <ul id="toyList">
          {toyList.length > 0 ? toyList.map((x) => {
            return (
              <Item key={x.id} {...x} addRemoveWish={addRemoveWish}
                wished={myWishedItems.filter(w => w.id === x.id).length > 0} /> )
          }) :
          <div style={{fontSize: '0.5em'}}>
            <h2>
              <FontAwesomeIcon icon={faBatteryEmpty} />  
              {' '}nothing in your area
            </h2>
            <h3 style={{textDecoration: 'underline'}}>
              update your location settings{' '}
              <FontAwesomeIcon icon={faGear} />
            </h3>
          </div>}
        </ul>
      </DashboardContext.Provider>
    </>
  );
}

export default ListPage;