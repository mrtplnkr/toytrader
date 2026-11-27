import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useContextSelector } from "use-context-selector";
import { GoodAppContext } from "../hooks/context";
import { Toy } from "../types/toy";
import { Rating } from "../types/rating";
import Item from "../components/item";

// Public (no RequireAuth) - this is where a shared toy link actually lands
// a real visitor, so it has to work for someone who's never signed in and
// never will. Routed here by functions/src/toyShareCard.ts, which itself
// only serves crawlers (Facebook/etc.) their Open Graph preview tags at
// /toy/{id} and redirects every real browser straight to /viewToy/{id}.
function ToyViewPage() {
    const { toyId } = useParams();
    const { t } = useTranslation();

    const toys = useContextSelector(GoodAppContext, (state: any) => state.toys);
    const ratings = useContextSelector(GoodAppContext, (state: any) => state.ratings);

    const toy = toys.find((x: Toy) => x.id === toyId);

    const toyRatings = ratings.filter((r: Rating) => r.toyId === toyId);
    const ratingCount = toyRatings.length;
    const averageRating = ratingCount > 0 ?
        toyRatings.reduce((sum: number, r: Rating) => sum + r.stars, 0) / ratingCount : undefined;

    if (!toy) {
        return (
            <div className="max-w-[420px] mx-auto my-12 p-6 flex flex-col items-center gap-4 text-center">
                <p className="m-0">{t('toyView:notFound')}</p>
                <Link to="/list" className="btn-primary no-underline">{t('toyView:browseOthers')}</Link>
            </div>
        );
    }

    return (
        <div className="max-w-[420px] mx-auto my-8 flex flex-col gap-4">
            <ul className="card p-4">
                <Item {...toy} averageRating={averageRating} ratingCount={ratingCount} />
            </ul>
            {toy.lockedByOfferId &&
                <p className="text-[0.85em] text-text-dim m-0 text-center">{t('toyView:alreadyTraded')}</p>}
            <Link to={`/list?toyId=${toy.id}`} className="btn-primary no-underline text-center">
                {t('toyView:signInToTrade')}
            </Link>
        </div>
    );
}

export default ToyViewPage;
