import { faChevronDown, faChevronLeft, faChevronRight, faFlagCheckered, faHandshake, faRemove } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { memo, TouchEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Toy } from "../types/toy";

interface Props {
    yourToys: Toy[];
    toy: Toy;
    nextToy: any;
    proposeOffer: any;
}

function ToyDisplay(props: Props) {//TODO: change to NewOffer

    const { t } = useTranslation();
    const [showYourToys, setShowYourToys] = useState<boolean>(true);
    const [triedWithoutSelection, setTriedWithoutSelection] = useState<boolean>(false);

    const [selectedToy, setSelectedToy] = useState<string | undefined>();

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
            <div className={`fixed left-4 top-14 w-[120px] overflow-y-scroll transition-all duration-[2000ms] ${!showYourToys ? 'h-px' : 'h-[82%]'}`}>
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
                    </div>)
                }
                </div>
            </div>
            <button onClick={() => {
                if (selectedToy) props.proposeOffer(selectedToy)
                else {
                    setTriedWithoutSelection(true);
                    setShowYourToys(true);
                } }}
                className={`buttonFixedLeft ${selectedToy ? 'cursor-pointer opacity-100' : 'cursor-not-allowed opacity-60 animateBorder'}`}
                title={selectedToy ? t('addNewOffer:proposeTrade') : t('addNewOffer:selectYourToyFirst')}>
                    <FontAwesomeIcon icon={faHandshake} />
            </button>
            {/* The only on-screen indication this view can move between
                toys at all used to be invisible full-height click zones
                (no size, no icon) - arrow keys/touch swipe still work, but
                nothing showed they existed. These give it a visible,
                clickable affordance, same chevron pattern as item.tsx's
                gallery lightbox. */}
            <button
                className="fixed top-1/2 left-4 -translate-y-1/2 z-[1] w-12 h-12 rounded-full bg-surface-raised/80 border border-border flex items-center justify-center text-text hover:bg-surface-raised"
                onClick={() => props.nextToy(-1)}
                title={t('addNewOffer:previousToy')}
            >
                <FontAwesomeIcon icon={faChevronLeft} />
            </button>
            <div className="flex flex-col items-center justify-center h-full gap-2">
                {/* Inline maxHeight overrides the shared ".largeOffer img { max-height: 100% }"
                    rule (by specificity) - otherwise the image alone fills this whole flex
                    column and the caption below it gets squeezed off-screen. */}
                <img alt={props.toy.title} src={props.toy.file} className="max-h-[80%] max-w-full" />
                <p className="text-white text-[1.1em] m-0">{props.toy.title}</p>
            </div>
            <button
                className="fixed top-1/2 right-4 -translate-y-1/2 z-[1] w-12 h-12 rounded-full bg-surface-raised/80 border border-border flex items-center justify-center text-text hover:bg-surface-raised"
                onClick={() => props.nextToy(1)}
                title={t('addNewOffer:nextToy')}
            >
                <FontAwesomeIcon icon={faChevronRight} />
            </button>
            <button onClick={() => props.nextToy(undefined)}
                className={'buttonFixedRight'}>
                    <FontAwesomeIcon icon={faRemove} />
            </button>
      </div>
    );
}

export default memo(ToyDisplay);
