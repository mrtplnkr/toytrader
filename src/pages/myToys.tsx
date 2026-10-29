import { deleteDoc, doc } from "firebase/firestore";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { auth, db } from "../firebase-config";
import Item from "../components/item";
import { Offer } from "../types/offer";
import { GoodAppContext } from "../hooks/context";
import { useContextSelector } from "use-context-selector";
import { Store } from "react-notifications-component";
import { Toy } from "../types/toy";
import { Rating } from "../types/rating";

function MyToysPage() {
  let navigate = useNavigate();
  const { t } = useTranslation();

  const refresh = useContextSelector(GoodAppContext, (state: any) => state.refresh);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toys = useContextSelector(GoodAppContext, (state: any) => state.toys);
  const offers = useContextSelector(GoodAppContext, (state: any) => state.offers);
  const ratings = useContextSelector(GoodAppContext, (state: any) => state.ratings);
  // toys from context is the whole app's list (no per-user filtering at the
  // data layer - see CLAUDE.md) - this page only ever cares about the
  // signed-in user's own. Deriving it once here instead of inline fixes a
  // real bug: the old code checked toys.length (the global count) to decide
  // whether to show "no toys yet", so that empty state only ever appeared
  // if literally every user's toy list was empty, not just this user's.
  const myToys = toys.filter((x: Toy) => x.userId === auth.currentUser?.uid);

  const toyRatingStats = (toyId: string) => {
    const toyRatings = ratings.filter((r: Rating) => r.toyId === toyId);
    if (!toyRatings.length) return { averageRating: undefined, ratingCount: 0 };
    const averageRating = toyRatings.reduce((sum: number, r: Rating) => sum + r.stars, 0) / toyRatings.length;
    return { averageRating, ratingCount: toyRatings.length };
  };

  const countOffers = (items: Offer[], target: string) => {
    return items.filter((x:Offer) => x.toyOffered === target || x.toyTargeted === target).length;
  };

  const deleteItem = async (id: string) => {
    if (countOffers(offers, id)) {
      Store.addNotification({
        title: t('myToys:cantRemoveTitle'),
        message: t('myToys:cantRemoveBody'),
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

    const movieDoc = doc(db, "toys", id);
    await deleteDoc(movieDoc)
      .then(async () => {
        Store.addNotification({
          title: t('myToys:removeSuccessTitle'),
          message: t('myToys:removeSuccessBody'),
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
        // Without this, the deleted toy stays visible until the user
        // manually refreshes or navigates away and back - context state
        // isn't updated just by the Firestore write succeeding.
        await refresh();
      })
      .catch((e) =>
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
    );
  };

  return (
    <>
        <h3>{t('myToys:heading')}</h3>

        <div className="flex justify-between mb-6">
          <button onClick={() => refresh()}>{t('myToys:refresh')}</button>
          <button className="btn-primary" onClick={() => navigate('/addNew')}>{t('myToys:addYourToy')}</button>
        </div>

        <ul id="toyList">
          {myToys.length > 0 ? myToys.map((x: Toy) => {
            return (
              <div key={x.id}>
                <Item {...x} deleteItem={deleteItem} {...toyRatingStats(x.id)} />
                <div className="text-[0.9em] text-text-dim">
                  {countOffers(offers, x.id) ?
                    <div>
                      <Trans i18nKey="myToys:offersNotice"
                        values={{ count: countOffers(offers, x.id) }}
                        components={{ OfferLink: <span className="text-primary underline cursor-pointer" onClick={() => navigate('/myOffers')} /> }} />
                    </div>
                  :
                    <>{t('myToys:noOffers')}</>}
                </div>
              </div>
            )
          }) : <div>{t('myToys:noToysYet')}</div>}
        </ul>
    </>
  );
}

export default MyToysPage;
