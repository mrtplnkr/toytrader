import { Timestamp } from "firebase-admin/firestore";
import { memo } from "react";
import { Toy } from "../types/toy";

interface ItemProps extends Toy {
    refuseOffer: any;
    setActive: any;
    offerAccepted: Date;
}

function ItemForOffer(props: ItemProps) {
console.log(props);

    return (
        <li style={{flex: 1, border: '1px dashed violet', margin: '0.5em'}}>
            <img onClick={() => props.setActive(props.file)} alt={props.title} src={props.file}
                className={'smallOffer'} />
        </li>
    );
}

export default memo(ItemForOffer);
