import { faChevronDown, faFlagCheckered, faHandshake, faRemove } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { memo, useState } from "react";
import { Toy } from "../types/toy";

interface Props {
    yourToys: Toy[];
    toy: Toy;
    nextToy: any;
    proposeOffer: any;
}

function ToyDisplay(props: Props) {//TODO: change to NewOffer

    const [showYourToys, setShowYourToys] = useState<boolean>(false);

    const [selectedToy, setSelectedToy] = useState<string | undefined>();
    
    return (
        <div className="largeOffer">
            <button style={{position: 'fixed',left: '1em',top: '1em',zIndex: 1}} onClick={() => setShowYourToys(x => !x)}>
                <FontAwesomeIcon icon={faChevronDown} />
            </button>
            <div style={{ height: !showYourToys ? '1px' : '90%', transition: '2s',
                position: 'fixed', left: '1em', top: '1em', width: '120px', overflowY: 'scroll'}}>
                <div style={{position: 'relative', display: 'block'}}>
                {
                    props.yourToys.map((x:Toy) => <div style={{position: 'relative'}}>
                        <div key={x.id}>
                            <img onClick={() => setSelectedToy(x.id)}
                                alt={x.title} style={{width:'100px', marginTop: '1em', cursor: 'pointer'}} src={x.file} />
                                {selectedToy === x.id && 
                            <FontAwesomeIcon style={{top: '17px', right: '2px', position: 'absolute'}}
                                color='green' icon={faFlagCheckered} />}
                        </div>
                    </div>)
                }
                </div>
            </div>
            <button onClick={() => props.proposeOffer(selectedToy)}
                className={'buttonFixedLeft'}>
                    <FontAwesomeIcon icon={faHandshake} />
            </button>
            <button className="leftButton" onClick={() => props.nextToy(-1)} />
            <img alt="being viewed" src={props.toy.file} />
            <button className="rightButton" onClick={() => props.nextToy(1)} />
            <button onClick={() => props.nextToy(undefined)}
                className={'buttonFixedRight'}>
                    <FontAwesomeIcon icon={faRemove} />
            </button>
      </div>
    );
}

export default memo(ToyDisplay);
