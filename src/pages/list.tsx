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
import ToyDisplay from "./addNewOffer";
import { addNewOffer } from "../hooks/helper";
import { Store } from "react-notifications-component";

function ListPage() {
  let navigate = useNavigate();

  const toys = useContextSelector(GoodAppContext, (state: any) => state.toys);
  const refresh = useContextSelector(GoodAppContext, (state: any) => state.refresh);
  const user = useContextSelector(GoodAppContext, (state: any) => state.user);

  useEffect(() => {
    if (auth.currentUser?.uid)
      refresh();
    else {
      navigate('/login');
    }
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
  };

  const [toyDisplayIndex, setToyDisplayIndex] = useState<number | undefined>(undefined);

  const nextToy = (direction: number | undefined) => {
    setToyDisplayIndex(direction);
  };

  const proposeOffer = async (toyOffered: string) => {
    try {
      if (toyDisplayIndex) await addNewOffer(toyOffered, toys[toyDisplayIndex].id, toys[toyDisplayIndex].userId);
      Store.addNotification({
        title: "Success !",
        message: "Toy successfully offered .",
        type: "success",
        insert: "top",
        container: "top-right",
        animationIn: ["animated", "fadeIn"],
        animationOut: ["animated", "fadeOut"],
        dismiss: {
          duration: 5000,
          onScreen: true
        }
      });
      navigate('/history');
    } catch (e: any) {
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
    }
  };

  return (
    <>
        <h3>Search for toys in your area</h3>

        {
          toyDisplayIndex !== undefined && 
            <ToyDisplay yourToys={toys.filter((x: Toy) => x.userId === auth.currentUser?.uid)} 
              toy={toys[toyDisplayIndex]} nextToy={nextToy} proposeOffer={proposeOffer} />
        }

        <div style={{display: 'flex', flexDirection: 'column'}}>
          <button id="addButton" onClick={() => navigate('/addNew')}>
            <FontAwesomeIcon color="darkviolet" icon={faCirclePlus} />
          </button>
          <button style={{alignSelf: 'flex-start'}} onClick={() => alert('not in use')}>refresh</button>
        </div>

        <ul id="toyList">
          {toys.length > 0 ? toys.filter((x: Toy) => x.userId !== auth.currentUser?.uid).map((x: any) => {
            return (
              <div key={x.id} style={{cursor: 'pointer'}} onClick={() => setToyDisplayIndex(toys.indexOf(x))}>
                <Item key={x.id} {...x} addRemoveWish={addRemoveWish}
                  wished={myWishedItems.filter(w => w.id === x.id).length > 0} />
              </div>
            )
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