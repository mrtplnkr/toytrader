import { faBatteryEmpty, faCirclePlus, faGear} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState } from "react";
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { auth } from "../firebase-config";
import Item from "../components/item";
import { GoodAppContext } from "../hooks/context";
import { useContextSelector } from "use-context-selector";
import { Toy } from "../types/toy";
import { Offer } from "../types/offer";
import { Rating } from "../types/rating";
import ToyDisplay from "./addNewOffer";
import { addNewOffer } from "../hooks/helper";
import { Store } from "react-notifications-component";

function ListPage() {
  let navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  const toys = useContextSelector(GoodAppContext, (state: any) => state.toys);
  const offers = useContextSelector(GoodAppContext, (state: any) => state.offers);
  const ratings = useContextSelector(GoodAppContext, (state: any) => state.ratings);
  const refresh = useContextSelector(GoodAppContext, (state: any) => state.refresh);

  const toyRatingStats = (toyId: string) => {
    const toyRatings = ratings.filter((r: Rating) => r.toyId === toyId);
    if (!toyRatings.length) return { averageRating: undefined, ratingCount: 0 };
    const averageRating = toyRatings.reduce((sum: number, r: Rating) => sum + r.stars, 0) / toyRatings.length;
    return { averageRating, ratingCount: toyRatings.length };
  };

  useEffect(() => {
    refresh();
  }, [refresh]);

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

  // Tracked by id, not array position - toys re-fetch periodically (App.tsx's
  // 60s polling) and the array's order isn't guaranteed stable across
  // fetches, so an index into it could silently end up pointing at a
  // different toy than the one actually being viewed.
  // Seeded from ?toyId=... so a shared toy link (see item.tsx's shareToy)
  // opens straight into that toy's full-screen view - toys may not have
  // loaded yet at this point, but toyBeingDisplayed below re-resolves
  // against visibleToys on every render, so it picks it up as soon as
  // the fetch completes.
  const [selectedToyId, setSelectedToyId] = useState<string | undefined>(searchParams.get('toyId') ?? undefined);

  const visibleToys = toys.filter((x: Toy) => x.userId !== auth.currentUser?.uid);
  const toyBeingDisplayed = visibleToys.find((x: Toy) => x.id === selectedToyId);

  const nextToy = (direction: number | undefined) => {
    if (direction === undefined) {
      setSelectedToyId(undefined);
      return;
    }
    const currentIndex = visibleToys.findIndex((x: Toy) => x.id === selectedToyId);
    const newToy = visibleToys[currentIndex + direction];
    if (newToy) setSelectedToyId(newToy.id);
  };

  // A toy already tied up in another not-yet-fully-completed trade (either as
  // what's being offered or what's being requested) shouldn't be offered
  // again - it can only physically go to one trade.
  const isToyCommittedElsewhere = (toyId: string) =>
    offers.some((o: Offer) =>
      (o.toyOffered === toyId || o.toyTargeted === toyId) &&
      !(o.offerReceived && o.targetReceived));

  const proposeOffer = async (toyOffered: string) => {
    if (isToyCommittedElsewhere(toyOffered)) {
      Store.addNotification({
        title: t('list:cantOfferTitle'),
        message: t('list:cantOfferBody'),
        type: "danger",
        insert: "top",
        container: "top-right",
        animationIn: ["animated", "fadeIn"],
        animationOut: ["animated", "fadeOut"],
        dismiss: {
          duration: 5000,
          onScreen: true
        }
      });
      return;
    }
    try {
      if (toyBeingDisplayed) await addNewOffer(toyOffered, toyBeingDisplayed.id, toyBeingDisplayed.userId);
      Store.addNotification({
        title: t('list:offerSuccessTitle'),
        message: t('list:offerSuccessBody'),
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
        title: t('common:toast.actionFailedTitle'),
        message: t('common:toast.tryAgainLaterWithError', { error: e.message.toString() }),
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
        <h3>{t('list:heading')}</h3>

        {
          toyBeingDisplayed &&
            <ToyDisplay yourToys={toys.filter((x: Toy) => x.userId === auth.currentUser?.uid)}
              toy={toyBeingDisplayed} nextToy={nextToy} proposeOffer={proposeOffer} />
        }

        <div className="flex flex-col">
          <button id="addButton" onClick={() => navigate('/addNew')}>
            <FontAwesomeIcon color="darkviolet" icon={faCirclePlus} />
          </button>
          <button className="self-start" onClick={() => refresh()}>{t('list:refresh')}</button>
        </div>

        <ul id="toyList">
          {visibleToys.length > 0 ? visibleToys.map((x: any) => {
            return (
              <div key={x.id} className="cursor-pointer" onClick={() => setSelectedToyId(x.id)}>
                <Item key={x.id} {...x} addRemoveWish={addRemoveWish}
                  wished={myWishedItems.filter(w => w.id === x.id).length > 0}
                  {...toyRatingStats(x.id)} />
              </div>
            )
          }) :
          <div className="text-[0.5em]">
            <h2>
              <FontAwesomeIcon icon={faBatteryEmpty} />
              {' '}{t('list:nothingInArea')}
            </h2>
            <h3 className="underline">
              {t('list:updateLocation')}{' '}
              <FontAwesomeIcon icon={faGear} />
            </h3>
          </div>}
        </ul>
    </>
  );
}

export default ListPage;