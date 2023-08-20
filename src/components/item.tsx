import { faBatteryEmpty, faDeleteLeft, faRemove, faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { memo, useState } from "react";
import { getOfferList } from "../hooks/helper";
import { Toy } from "../types/toy";

interface ItemProps {
    title: string;
    id: string;
    file: string;
    userId: string;
    wished?: boolean;
    deleteItem?: any;
    addRemoveWish?: any;
    offers?: string[];
    getOffers?: any;
}

function Item(props: ItemProps) {

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
            <div style={{width: '90%'}}>
                View{' '}
                <span style={{ textDecoration: 'underline', cursor: 'pointer' }} 
                    onClick={() => props.getOffers(props.id, props.offers)}>{props.offers?.length} offer(s)</span>
                ...
            </div>
        </li>
    );
}

export default memo(Item);
