import { Toy } from "../types/toy";

interface ItemProps extends Toy {
    setActive: any;
}

function ItemForOffer(props: ItemProps) {

    return (
        <li style={{flex: 1, border: '1px dashed violet', margin: '0.5em'}}>
            <img onClick={() => props.setActive(props.file)} alt={props.title} src={props.file}
                className={'smallOffer'} />
        </li>
    );
}

export default ItemForOffer;
