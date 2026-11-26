import { faChevronDown, faChevronLeft, faChevronRight, faFlagCheckered, faHandHolding, faPen, faRemove } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { memo, TouchEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { Toy } from "../types/toy";
import TradeConsentModal from "../components/tradeConsentModal";
import { auth } from "../firebase-config";

interface Props {
    yourToys: Toy[];
    toy: Toy;
    nextToy: any;
    proposeOffer: any;
}

function ToyDisplay(props: Props) {//TODO: change to NewOffer

    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const [showYourToys, setShowYourToys] = useState<boolean>(true);
    const [triedWithoutSelection, setTriedWithoutSelection] = useState<boolean>(false);

    const [selectedToy, setSelectedToy] = useState<string | undefined>();
    const [showConsent, setShowConsent] = useState(false);

    const { nextToy } = props;

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') nextToy(-1);
            else if (e.key === 'ArrowRight') nextToy(1);
            else if (e.key === 'Escape') nextToy(undefined);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    // list.tsx's nextToy isn't wrapped in useCallback, so it's a new
    // function (closing over the current selectedToyId) every render -
    // this must re-bind each time or the listener keeps calling a stale
    // closure and gets stuck after the first keypress.
    }, [nextToy]);

    // Swipe-to-browse on touch devices, mirroring the arrow-key/button nav
    // above. A ref (not state) is enough here since the start point is only
    // ever read once, synchronously, at touchEnd of the same gesture.
    const touchStart = useRef<{ x: number, y: number } | undefined>();
    const SWIPE_THRESHOLD_PX = 50;

    const onTouchStart = (e: TouchEvent) => {
        const t = e.touches[0];
        touchStart.current = { x: t.clientX, y: t.clientY };
    };

    const onTouchEnd = (e: TouchEvent) => {
        const start = touchStart.current;
        touchStart.current = undefined;
        if (!start) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;
        // Require a mostly-horizontal gesture so scrolling the "your toys"
        // list vertically on the left doesn't get mistaken for a swipe.
        if (Math.abs(dx) > SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy)) {
            nextToy(dx < 0 ? 1 : -1);
        }
    };

    return (
        <div className="largeOffer" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            <button onClick={() => setShowYourToys(x => !x)} className={`border border-dashed border-[green] fixed left-4 top-4 z-[1] ${showYourToys ? "animateBorder" : ''}`}>
                    <FontAwesomeIcon icon={faChevronDown} />
            </button>
            <div className={`fixed left-4 top-20 w-[120px] overflow-y-scroll transition-all duration-[2000ms] ${!showYourToys ? 'h-px' : 'h-[82%]'}`}>
                {showYourToys &&
                    <p className={`text-[0.75em] mt-0 mb-2 ${triedWithoutSelection ? 'text-[#ff6b6b]' : ''}`}>
                        {triedWithoutSelection ? t('addNewOffer:pickFirst') : t('addNewOffer:pickToyToOffer')}
                    </p>}
                <div className="relative block">
                {
                    props.yourToys.map((x:Toy) =>
                    <div key={x.id} className="relative">
                        <img onClick={() => { setSelectedToy(x.id); setTriedWithoutSelection(false); }}
                            alt={x.title} className="w-[100px] mt-4 cursor-pointer" src={x.file} />
                            {selectedToy === x.id &&
                        <FontAwesomeIcon className="absolute top-[17px] right-[2px]"
                            color='#81fc51' icon={faFlagCheckered} />}
                        <button
                            className="absolute top-[17px] left-[2px] bg-surface-raised/85 rounded-full w-[1.6em] h-[1.6em] flex items-center justify-center text-[0.8em]"
                            onClick={(e) => { e.stopPropagation(); navigate(`/editToy/${x.id}`); }}
                            title={t('addNewOffer:editThisToy')}>
                            <FontAwesomeIcon icon={faPen} />
                        </button>
                    </div>)
                }
                </div>
            </div>
            {showConsent &&
                <TradeConsentModal
                    confirmLabel={t('addNewOffer:proposeTrade')}
                    onCancel={() => setShowConsent(false)}
                    onAgree={() => {
                        setShowConsent(false);
                        if (selectedToy) props.proposeOffer(selectedToy);
                    }}
                />}
            {/* Positioned relative to .largeOffer itself (fixed, full-screen),
                not the centered flex column below, so it sits at the very
                top of the view regardless of how tall the image is. Inset
                left/right (rather than centered with a max-width) so the
                title can never reach into the close button's corner
                (.buttonFixedRight.topRight: right:0, margin:3em, width:4em -
                occupies the rightmost ~7em) or, while "pick your toy" is
                open, the toy-picker column (left-4, w-[120px] - ~9em total)
                regardless of how many lines it wraps to. line-clamp caps an
                extreme title (rather than wrapping indefinitely) with an
                ellipsis - the full text is still on the image's own alt
                text and this element's title attribute. */}
            <p className="absolute top-4 left-[9em] right-[7.5em] z-[1] text-white text-[1.1em] font-semibold m-0 text-center line-clamp-2"
                title={props.toy.title}>
                {props.toy.title}
            </p>
            <div className="flex flex-col items-center justify-center h-full gap-2">
                {/* Inline maxHeight overrides the shared ".largeOffer img { max-height: 100% }"
                    rule (by specificity) - otherwise the image alone fills this whole flex
                    column and the caption below it gets squeezed off-screen. */}
                <img alt={props.toy.title} src={props.toy.file} className="max-h-[80%] max-w-full" />
                {props.toy.description &&
                    <p className="text-text-dim text-[0.85em] m-0 max-w-[80%] text-center">{props.toy.description}</p>}
            </div>
            {/* Prev/propose/next together in one fixed bottom row - the only
                on-screen indication this view can move between toys at all
                used to be invisible full-height click zones (no size, no
                icon); arrow keys/touch swipe still work regardless, but
                nothing used to show they existed. */}
            <div className="fixed bottom-0 left-0 right-0 z-[1] flex items-center justify-center gap-8 pb-10">
                <button
                    className="w-12 h-12 rounded-full bg-surface-raised/80 border border-solid border-border flex items-center justify-center text-text hover:bg-surface-raised"
                    onClick={() => props.nextToy(-1)}
                    title={t('addNewOffer:previousToy')}
                >
                    <FontAwesomeIcon icon={faChevronLeft} />
                </button>
                <button onClick={() => {
                    // /list is public now (anonymous visitors can browse/search) -
                    // this is the actual "initiate a trade" moment, so it's the
                    // right place to prompt sign-in rather than gating the whole
                    // page. state.from sends them right back here afterward.
                    if (!auth.currentUser) {
                        navigate('/login', { state: { from: location } });
                        return;
                    }
                    if (selectedToy) setShowConsent(true);
                    else {
                        setTriedWithoutSelection(true);
                        setShowYourToys(true);
                    } }}
                    className={`proposeButton ${selectedToy ? 'cursor-pointer opacity-100' : 'cursor-not-allowed opacity-60 animateBorder'}`}
                    title={selectedToy ? t('addNewOffer:proposeTrade') : t('addNewOffer:selectYourToyFirst')}>
                        <FontAwesomeIcon icon={faHandHolding} />
                </button>
                <button
                    className="w-12 h-12 rounded-full bg-surface-raised/80 border border-solid border-border flex items-center justify-center text-text hover:bg-surface-raised"
                    onClick={() => props.nextToy(1)}
                    title={t('addNewOffer:nextToy')}
                >
                    <FontAwesomeIcon icon={faChevronRight} />
                </button>
            </div>
            <button onClick={() => props.nextToy(undefined)}
                className={'buttonFixedRight topRight'}>
                    <FontAwesomeIcon icon={faRemove} />
            </button>
      </div>
    );
}

export default memo(ToyDisplay);
