import { faShareNodes, faStar as faStarSolid, faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { memo, MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { Toy } from "../types/toy";

const SITE_URL = "https://toystrader-a494f.web.app";

interface Props extends Toy {
    wished?: boolean;
    deleteItem?: any;
    addRemoveWish?: any;
    averageRating?: number;
    ratingCount?: number;
    // offers?: ToyOffer[];
}

function Item(props: Props) {
    const { t } = useTranslation();

    const shareToy = (e: MouseEvent) => {
        e.stopPropagation();
        const text = t('item:shareText', { title: props.title });
        // /toy/<id> is a Cloud Function (functions/src/toyShareCard.ts,
        // routed via the Hosting rewrite in firebase.json) that serves this
        // toy's own Open Graph title/image for crawlers, then bounces real
        // visitors into /list?toyId=<id> (which opens it in the viewer -
        // works even logged-out, since login.tsx returns here after
        // sign-in). Always goes straight to Facebook's own share dialog -
        // navigator.share hands off to whatever the OS offers, which often
        // doesn't even list Facebook as an option.
        const shareUrl = `${SITE_URL}/toy/${props.id}`;
        const fbShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(text)}`;
        window.open(fbShareUrl, '_blank', 'noopener,noreferrer');
    };

    return (
        <li>
            <div className="flex justify-between w-[90%]">
                <h3 className="italic m-0 flex-1">{props.title}</h3>
                <button className="ml-4" onClick={shareToy} title={t('item:share')}>
                    <FontAwesomeIcon icon={faShareNodes} />
                </button>
                {props.deleteItem && <button className="ml-4" onClick={() => props.deleteItem(props.id)}>
                    <FontAwesomeIcon icon={faTrash} />
                </button>}
            </div>
            {!!props.ratingCount && <p className="text-sm text-text-dim m-0">
                <FontAwesomeIcon icon={faStarSolid} /> {props.averageRating!.toFixed(1)} ({props.ratingCount})
            </p>}
            <img alt={props.title} src={props.file} />
            {props.wished != null && <div className="flex w-[90%] justify-between">
                <button className="self-center" onClick={() => props.addRemoveWish(props)}>
                    {props.wished ? t('item:wished') : t('item:wish')}</button>
            </div>}
        </li>
    );
}

export default memo(Item);
