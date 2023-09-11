import { faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { memo } from "react";
import { Toy } from "../types/toy";

interface Props extends Toy {
    wished?: boolean;
    deleteItem?: any;
    addRemoveWish?: any;
    // offers?: ToyOffer[];
}

function Item(props: Props) {
    
    return (
        <li>
            <div style={{display:'flex', justifyContent: "space-between", width: '90%'}}>
                <h3 style={{fontStyle: 'italic', margin: '0', flex: 1}}>{props.title}</h3>
                {props.deleteItem && <button style={{marginLeft: '1em'}} onClick={() => props.deleteItem(props.id)}>
                    <FontAwesomeIcon icon={faTrash} />
                </button>}
            </div>
            <img alt={props.title} src={props.file} />
            {props.wished != null && <div style={{ display: 'flex', width: '90%', justifyContent: 'space-between' }}>
                <button style={{ alignSelf: 'center' }} onClick={() => props.addRemoveWish(props)}>
                    {props.wished ? 'wished' : 'wish'}</button>
            </div>}
        </li>
    );
}

export default memo(Item);
