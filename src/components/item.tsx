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
            <span style={{flex: 1}}>{props.title}</span>
            {props.deleteItem && <button onClick={() => props.deleteItem(props.id)}>del</button>}
            <img alt={props.title} src={props.file} />
            <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between' }}>
                {props.wished != null && <button style={{ alignSelf: 'center' }} onClick={() => props.addRemoveWish(props)}>
                    {props.wished ? 'wished' : 'wish'}</button>}
            </div>
            <div>
                View{' '}
                <span style={{ textDecoration: 'underline', cursor: 'pointer' }} 
                    onClick={() => props.getOffers(props.id, props.offers)}>{props.offers?.length} offer(s)</span>
                ...
            </div>
        </li>
    );
}

export default memo(Item);
