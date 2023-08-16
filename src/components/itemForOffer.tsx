import { memo, useState } from "react";
import { useUserContext } from "../hooks/context";

interface ItemProps {
    title: string;
    id: string;
    file: string;
    userId: string;
    wished: boolean;
    addRemoveWish?: any;
}

function ItemForOffer(props: ItemProps) {
    const setItemOffers = useUserContext();
    const [offerInProgress, setOfferInProgress] = useState<string>();
    const [showYourToys, setShowYourToys] = useState([]);
    const initiateOffer = (id: string) => {
        setOfferInProgress(id);
        setShowYourToys([]);
    };

    return (
        <li>
            <>
                {<button onClick={() => initiateOffer(props.id)}>make offer</button>}
                <img alt={props.title} src={props.file} />
                <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between' }}>
                    <span style={{flex: 1}}>{props.title}</span>
                    {props.wished != null && <button style={{ alignSelf: 'center' }} onClick={() => props.addRemoveWish(props)}>
                        {props.wished ? 'wished' : 'wish'}</button>}
                </div>
                <span style={{flex: 1}}>{props.userId}</span>
            </>
            <div style={{}}>

            </div>
        </li>
    );
}

export default memo(ItemForOffer);
