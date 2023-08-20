import { memo, useState } from "react";
import { useUserContext } from "../hooks/context";

interface ItemProps {
    title: string;
    id: string;
    file: string;
    userId: string;
    refuseOffer: any;
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
        <li style={{flex: 1, border: '1px dashed orange', margin: '0.5em'}}>
            <>
                {/* <button onClick={() => initiateOffer(props.id)}>accept (tick)</button>
                <button onClick={() => props.refuseOffer(props.id)}>refuse (x)</button> */}
                <img style={{ height: '5em', width: 'auto' }} onClick={() => alert('enlarge')} alt={props.title} src={props.file} />
                {/* <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between' }}>
                    <span style={{flex: 1}}>{props.title}</span>
                </div> */}
                {/* <span style={{flex: 1}}>{props.userId}</span> */}
            </>
        </li>
    );
}

export default memo(ItemForOffer);
