import { faShareNodes, faStar as faStarSolid, faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { memo, MouseEvent } from "react";
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
    const shareToy = (e: MouseEvent) => {
        e.stopPropagation();
        const text = `Check out "${props.title}" on ToyTrader!`;
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
            <div style={{display:'flex', justifyContent: "space-between", width: '90%'}}>
                <h3 style={{fontStyle: 'italic', margin: '0', flex: 1}}>{props.title}</h3>
                <button style={{marginLeft: '1em'}} onClick={shareToy} title="Share">
                    <FontAwesomeIcon icon={faShareNodes} />
                </button>
                {props.deleteItem && <button style={{marginLeft: '1em'}} onClick={() => props.deleteItem(props.id)}>
                    <FontAwesomeIcon icon={faTrash} />
                </button>}
            </div>
            {!!props.ratingCount && <p style={{fontSize: '0.85em', color: 'var(--color-text-dim)', margin: 0}}>
                <FontAwesomeIcon icon={faStarSolid} /> {props.averageRating!.toFixed(1)} ({props.ratingCount})
            </p>}
            <img alt={props.title} src={props.file} />
            {props.wished != null && <div style={{ display: 'flex', width: '90%', justifyContent: 'space-between' }}>
                <button style={{ alignSelf: 'center' }} onClick={() => props.addRemoveWish(props)}>
                    {props.wished ? 'wished' : 'wish'}</button>
            </div>}
        </li>
    );
}

export default memo(Item);
