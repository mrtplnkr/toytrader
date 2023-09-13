import { faBatteryEmpty, faCirclePlus, faGear} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState } from "react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase-config";
import Item from "../components/item";
import { GoodAppContext } from "../hooks/context";
import { useContextSelector } from "use-context-selector";
import { Toy } from "../types/toy";

function HistoryPage() {
  let navigate = useNavigate();

  const toys = useContextSelector(GoodAppContext, (state: any) => state.toys);

  useEffect(() => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [myWishedItems, setMyWishedItems] = useState<any[]>(localStorage.getItem('wishListItems') ? JSON.parse(localStorage.getItem('wishListItems')!) : []);

  useEffect(() => {
    localStorage.setItem("wishListItems", JSON.stringify(myWishedItems))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myWishedItems?.length]);

  const addRemoveWish = (newItem: any) => {
      if (myWishedItems && myWishedItems.some(x => x.id === newItem.id)) {
        setMyWishedItems(myWishedItems.filter(x => x.id !== newItem.id));
      } else {
        setMyWishedItems(myWishedItems.concat([newItem]));
      }
  }

  return (
    <>
        <h3>Search for toys in your area</h3>

        <div style={{display: 'flex', flexDirection: 'column'}}>
          <button id="addButton" onClick={() => navigate('/addNew')}>
            <FontAwesomeIcon color="darkviolet" icon={faCirclePlus} />
          </button>
          <button style={{alignSelf: 'flex-start'}} onClick={() => alert('not in use')}>refresh</button>
        </div>

        <ul id="toyList">
          {toys.length > 0 ? toys.filter((x: Toy) => x.userId !== auth.currentUser?.uid).map((x: any) => {
            return (
              <Item key={x.id} {...x} addRemoveWish={addRemoveWish}
                wished={myWishedItems.some(w => w.id === x.id)} /> )
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

export default HistoryPage;