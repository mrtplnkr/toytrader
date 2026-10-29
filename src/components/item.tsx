import { faChevronLeft, faChevronRight, faShareNodes, faStar as faStarSolid, faTrash, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { memo, MouseEvent, useState } from "react";
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

interface MediaItem {
    type: 'image' | 'video';
    url: string;
}

function Item(props: Props) {
    const { t } = useTranslation();
    const [lightboxIndex, setLightboxIndex] = useState<number | undefined>(undefined);

    const media: MediaItem[] = [
        ...(props.images ?? [props.file]).map((url) => ({ type: 'image' as const, url })),
        ...(props.video ? [{ type: 'video' as const, url: props.video }] : []),
    ];
    const hasGallery = media.length > 1;

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

    const openLightbox = (e: MouseEvent) => {
        if (!hasGallery) return;
        e.stopPropagation();
        setLightboxIndex(0);
    };

    const step = (e: MouseEvent, delta: number) => {
        e.stopPropagation();
        setLightboxIndex((i) => ((i ?? 0) + delta + media.length) % media.length);
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
            <div className="relative inline-block w-full">
                <img alt={props.title} src={props.file} onClick={openLightbox}
                    className={hasGallery ? "cursor-pointer" : undefined} />
                {hasGallery &&
                    // Inset enough to clear the image's own rounded corner
                    // (bottom-1/right-1 sat right on top of the curve,
                    // making the badge look clipped) and padded enough on
                    // both axes to read as a pill rather than a cramped tag.
                    <span className="absolute bottom-2 right-2 bg-bg/85 text-text rounded-full px-2 py-0.5 text-[0.75em] font-medium shadow">
                        {t('item:moreMedia', { count: media.length - 1 })}
                    </span>}
            </div>
            {props.wished != null && <div className="flex w-[90%] justify-between">
                <button className="self-center" onClick={() => props.addRemoveWish(props)}>
                    {props.wished ? t('item:wished') : t('item:wish')}</button>
            </div>}

            {lightboxIndex !== undefined &&
                <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center gap-4 bg-bg/90 backdrop-blur-sm"
                    onClick={(e) => { e.stopPropagation(); setLightboxIndex(undefined); }}>
                    <button className="absolute top-4 right-4 text-2xl" onClick={(e) => { e.stopPropagation(); setLightboxIndex(undefined); }}
                        title={t('item:close')}>
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                    <div className="flex items-center gap-4 max-w-[90vw] max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
                        {media.length > 1 &&
                            <button onClick={(e) => step(e, -1)} title={t('item:previous')}>
                                <FontAwesomeIcon icon={faChevronLeft} size="2x" />
                            </button>}
                        {media[lightboxIndex].type === 'image' ?
                            <img src={media[lightboxIndex].url} alt={props.title} className="max-w-[80vw] max-h-[75vh] object-contain" />
                        :
                            <video src={media[lightboxIndex].url} controls autoPlay className="max-w-[80vw] max-h-[75vh]" />}
                        {media.length > 1 &&
                            <button onClick={(e) => step(e, 1)} title={t('item:next')}>
                                <FontAwesomeIcon icon={faChevronRight} size="2x" />
                            </button>}
                    </div>
                </div>}
        </li>
    );
}

export default memo(Item);
