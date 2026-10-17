import { faBatteryEmpty, faCirclePlus, faGear} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState } from "react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { auth } from "../firebase-config";
import Item from "../components/item";
import { GoodAppContext } from "../hooks/context";
import { useContextSelector } from "use-context-selector";
import { Toy } from "../types/toy";

function HistoryPage() {
  let navigate = useNavigate();
  const { t } = useTranslation();

  const toys = useContextSelector(GoodAppContext, (state: any) => state.toys);
  const refresh = useContextSelector(GoodAppContext, (state: any) => state.refresh);

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
        <h3>{t('inPost:heading')}</h3>

        <div className="flex flex-col">
          <button id="addButton" onClick={() => navigate('/addNew')}>
            <FontAwesomeIcon color="darkviolet" icon={faCirclePlus} />
          </button>
          <button className="self-start" onClick={() => refresh()}>{t('inPost:refresh')}</button>
        </div>

        <ul id="toyList">
          {toys.length > 0 ? toys.filter((x: Toy) => x.userId !== auth.currentUser?.uid).map((x: any) => {
            return (
              <Item key={x.id} {...x} addRemoveWish={addRemoveWish}
                wished={myWishedItems.some(w => w.id === x.id)} /> )
          }) :
          <div className="text-[0.5em]">
            <h2>
              <FontAwesomeIcon icon={faBatteryEmpty} />
              {' '}{t('inPost:nothingInArea')}
            </h2>
            <h3 className="underline">
              {t('inPost:updateLocation')}{' '}
              <FontAwesomeIcon icon={faGear} />
            </h3>
          </div>}
        </ul>
    </>
  );
}

export default HistoryPage;