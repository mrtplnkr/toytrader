import { faHandshake, faRemove } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { memo, useState } from "react";
import { Store } from "react-notifications-component";
import { updateOffer } from "../hooks/helper";
import { Toy } from "../types/toy";

interface ItemProps extends Toy {
    refuseOffer: any;
    setActive: any;
}

function ItemForOffer(props: ItemProps) {

    return (
        <li style={{flex: 1, border: '1px dashed orange', margin: '0.5em'}}>
            <div>
                {/* <button onClick={() => initiateOffer(props.id)}>accept (tick)</button>
                <button onClick={() => props.refuseOffer(props.id)}>refuse (x)</button> */}
                <img onClick={() => props.setActive(props.file)} alt={props.title} src={props.file}
                    className={'smallOffer'} />
                {/* <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between' }}>
                    <span style={{flex: 1}}>{props.title}</span>
                </div> */}
                {/* <span style={{flex: 1}}>{props.userId}</span> */}
            </div>
        </li>
    );
}

export default memo(ItemForOffer);
