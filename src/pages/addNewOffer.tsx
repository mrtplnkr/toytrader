import { faChevronDown, faFlagCheckered, faHandshake, faRemove } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { memo, TouchEvent, useEffect, useRef, useState } from "react";
import { Toy } from "../types/toy";

interface Props {
    yourToys: Toy[];
    toy: Toy;
    nextToy: any;
    proposeOffer: any;
}

function ToyDisplay(props: Props) {//TODO: change to NewOffer

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
            <button onClick={() => setShowYourToys(x => !x)} className={showYourToys ? "animateBorder" : ''}
                style={{border: '1px green dashed', position: 'fixed',left: '1em',top: '1em',zIndex: 1}}>
                    <FontAwesomeIcon icon={faChevronDown} />
            </button>
            <div style={{ height: !showYourToys ? '1px' : '82%', transition: '2s',
                position: 'fixed', left: '1em', top: '3.5em', width: '120px', overflowY: 'scroll'}}>
                {showYourToys &&
                    <p style={{fontSize: '0.75em', margin: '0 0 0.5em', color: triedWithoutSelection ? '#ff6b6b' : undefined}}>
                        {triedWithoutSelection ? '👇 pick a toy first!' : '👇 pick your toy to offer'}
                    </p>}
                <div style={{position: 'relative', display: 'block'}}>
                {
                    props.yourToys.map((x:Toy) =>
                    <div key={x.id} style={{position: 'relative'}}>
                        <img onClick={() => { setSelectedToy(x.id); setTriedWithoutSelection(false); }}
                            alt={x.title} style={{width:'100px', marginTop: '1em', cursor: 'pointer'}} src={x.file} />
                            {selectedToy === x.id &&
                        <FontAwesomeIcon style={{top: '17px', right: '2px', position: 'absolute'}}
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
                className={`buttonFixedLeft${selectedToy ? '' : ' animateBorder'}`}
                title={selectedToy ? 'Propose this trade' : 'Select your toy above first'}
                style={{cursor: selectedToy ? 'pointer' : 'not-allowed', opacity: selectedToy ? 1 : 0.6}}>
                    <FontAwesomeIcon icon={faHandshake} />
            </button>
            <button className="leftButton" onClick={() => props.nextToy(-1)} />
            <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                height: '100%', gap: '0.5em'}}>
                {/* Inline maxHeight overrides the shared ".largeOffer img { max-height: 100% }"
                    rule (by specificity) - otherwise the image alone fills this whole flex
                    column and the caption below it gets squeezed off-screen. */}
                <img alt={props.toy.title} src={props.toy.file} style={{maxHeight: '80%', maxWidth: '100%'}} />
                <p style={{color: 'white', fontSize: '1.1em', margin: 0}}>{props.toy.title}</p>
            </div>
            <button className="rightButton" onClick={() => props.nextToy(1)} />
            <button onClick={() => props.nextToy(undefined)}
                className={'buttonFixedRight'}>
                    <FontAwesomeIcon icon={faRemove} />
            </button>
      </div>
    );
}

export default memo(ToyDisplay);
