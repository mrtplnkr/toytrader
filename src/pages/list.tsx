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
import AdSlot from "../components/adSlot";

function ListPage() {
  let navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  const toys = useContextSelector(GoodAppContext, (state: any) => state.toys);
  const offers = useContextSelector(GoodAppContext, (state: any) => state.offers);
  const ratings = useContextSelector(GoodAppContext, (state: any) => state.ratings);

  const toyRatingStats = (toyId: string) => {
    const toyRatings = ratings.filter((r: Rating) => r.toyId === toyId);
    if (!toyRatings.length) return { averageRating: undefined, ratingCount: 0 };
    const averageRating = toyRatings.reduce((sum: number, r: Rating) => sum + r.stars, 0) / toyRatings.length;
    return { averageRating, ratingCount: toyRatings.length };
  };

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

  // Tracked by id, not array position - toys is a live Firestore listener
  // (App.tsx) and the array's order isn't guaranteed stable across updates,
  // so an index into it could silently end up pointing at a different toy
  // than the one actually being viewed.
  // Seeded from ?toyId=... so a shared toy link (see item.tsx's shareToy)
  // opens straight into that toy's full-screen view - toys may not have
  // loaded yet at this point, but toyBeingDisplayed below re-resolves
  // against visibleToys on every render, so it picks it up as soon as
  // the fetch completes.
  const [selectedToyId, setSelectedToyId] = useState<string | undefined>(searchParams.get('toyId') ?? undefined);

  // Hide toys I've already proposed a trade for - declineOffer/cancelThisOffer
  // hard-delete the offer doc (myOffers.tsx), so any offer doc that still
  // exists here represents a still-live ask on my part; nothing left to do
  // by browsing to it again.
  const alreadyOfferedToyIds = new Set(
    offers.filter((o: Offer) => o.userInitiated === auth.currentUser?.uid).map((o: Offer) => o.toyTargeted)
  );
  // A toy with lockedByOfferId set has an accepted offer and a winner - no
  // longer up for grabs, unlike a merely pending offer (several of those are
  // deliberately allowed to coexist on the same toy at once; myOffers.tsx's
  // acceptOffer auto-declines the losers the moment one is accepted).
  // Read off the toy doc itself (set by helper.ts's updateOffer/declineOffer)
  // rather than derived from `offers` here - offers are read-restricted to
  // the two participants/admins, so an uninvolved visitor's `offers` array
  // would never contain this accepted offer at all, even though the toy
  // itself is public-read and needs to disappear for *everyone*.
  // Approximate age-range filter - a toy matches when its [ageMin, ageMax]
  // overlaps the filter's [from, to] (either bound left blank means
  // unbounded on that side). A toy listed before this field existed has
  // neither bound set and can't be confirmed to match, so it's excluded
  // once the filter is actually in use rather than guessed into the
  // results - but still shown normally when no filter is applied.
  const [filterAgeFrom, setFilterAgeFrom] = useState<string>('');
  const [filterAgeTo, setFilterAgeTo] = useState<string>('');
  const ageFilterActive = filterAgeFrom.trim() !== '' || filterAgeTo.trim() !== '';
  const filterFromNum = filterAgeFrom.trim() !== '' ? Number(filterAgeFrom) : undefined;
  const filterToNum = filterAgeTo.trim() !== '' ? Number(filterAgeTo) : undefined;
  const matchesAgeFilter = (toy: Toy) => {
    if (!ageFilterActive) return true;
    if (toy.ageMin === undefined || toy.ageMax === undefined) return false;
    if (filterFromNum !== undefined && toy.ageMax < filterFromNum) return false;
    if (filterToNum !== undefined && toy.ageMin > filterToNum) return false;
    return true;
  };

  const visibleToys = toys.filter((x: Toy) =>
    x.userId !== auth.currentUser?.uid && !alreadyOfferedToyIds.has(x.id) && !x.lockedByOfferId && matchesAgeFilter(x));
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
    // toyBeingDisplayed can only ever be a toy from visibleToys (which
    // already excludes locked toys), so this only actually fires in the
    // narrow race where someone else's offer got accepted after this toy's
    // full-screen view was already open.
    if (isToyCommittedElsewhere(toyOffered) || toyBeingDisplayed?.lockedByOfferId) {
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
        </div>

        <div className="flex items-center justify-center gap-2 mb-4 text-[0.85em]">
          <span className="text-text-dim">{t('list:ageFilterLabel')}</span>
          <input type="number" min={0} className="w-[4.5em]" placeholder={t('list:ageFilterFrom')}
            value={filterAgeFrom} onChange={(e) => setFilterAgeFrom(e.target.value)} />
          <span className="text-text-dim">{t('list:ageFilterTo')}</span>
          <input type="number" min={0} className="w-[4.5em]" placeholder={t('list:ageFilterToPlaceholder')}
            value={filterAgeTo} onChange={(e) => setFilterAgeTo(e.target.value)} />
          {ageFilterActive &&
            <button type="button" onClick={() => { setFilterAgeFrom(''); setFilterAgeTo(''); }}>
              {t('list:ageFilterClear')}
            </button>}
        </div>

        <AdSlot trigger="list" />

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