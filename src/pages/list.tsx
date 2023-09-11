import { faBatteryEmpty, faGear } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState } from "react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase-config";
import Item from "../components/item";
import { GoodAppContext } from "../hooks/context";
import { useContextSelector } from "use-context-selector";
import { Toy } from "../types/toy";

function ListPage() {
  let navigate = useNavigate();

  const toys = useContextSelector(GoodAppContext, (state: any) => state.toys);

  useEffect(() => {
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

  return (
    <>
        <h3>Search for toys in your area</h3>

        <div style={{display: 'flex', flexDirection: 'column'}}>
          <button style={{alignSelf: 'flex-end'}} onClick={() => navigate('/addNew')}>add your toy</button>
          <button style={{alignSelf: 'flex-start'}} onClick={() => alert('not in use')}>refresh</button>
        </div>

        <ul id="toyList">
          {toys.length > 0 ? toys.filter((x: Toy) => x.userId !== auth.currentUser?.uid).map((x: any) => {
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
    </>
  );
}

export default ListPage;