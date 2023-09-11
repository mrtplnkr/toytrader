import { faHandshake, faRemove } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { memo, useState } from "react";
import { Store } from "react-notifications-component";
import { updateOffer } from "../hooks/helper";
import { Toy } from "../types/toy";

interface ItemProps extends Toy {
    refuseOffer: any;
    offerId: string;
}

function ItemForOffer(props: ItemProps) {
    const [hovered, setHovered] = useState(false);
    
    const acceptOffer = async (id: string) => {
        await updateOffer(id)
            .then(() => Store.addNotification({
                title: "Wonderful",
                message: "this toy is on your way !",
                type: "success",
                insert: "top",
                container: "top-right",
                animationIn: ["animated", "fadeIn"],
                animationOut: ["animated", "fadeOut"],
                dismiss: {
                  duration: 5000,
                  onScreen: true
                }
              })
            )
            .catch((e) => Store.addNotification({
                title: "Unfortunately this action failed !",
                message: "Please try again later... " + e.message.toString(),
                type: "danger",
                insert: "top",
                container: "top-right",
                animationIn: ["animated", "fadeIn"],
                animationOut: ["animated", "fadeOut"],
                dismiss: {
                  duration: 5000,
                  onScreen: true
                }
            })
        );
    };

    return (
        <li style={{flex: 1, border: '1px dashed orange', margin: '0.5em'}}>
            <div>
                {/* <button onClick={() => initiateOffer(props.id)}>accept (tick)</button>
                <button onClick={() => props.refuseOffer(props.id)}>refuse (x)</button> */}
                <img onClick={() => setHovered(x => !x)} alt={props.title} src={props.file}
                    className={hovered ? 'largeOffer' : 'smallOffer'} />
                <button onClick={() => acceptOffer(props.id)}
                    className={hovered ? 'buttonFixedLeft' : ''}>
                        <FontAwesomeIcon icon={faHandshake} />
                </button>
                {hovered && <button onClick={() => setHovered(false)}
                    className={hovered ? 'buttonFixedRight' : ''}>
                        <FontAwesomeIcon icon={faRemove} />
                </button>}
                {/* <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between' }}>
                    <span style={{flex: 1}}>{props.title}</span>
                </div> */}
                {/* <span style={{flex: 1}}>{props.userId}</span> */}
            </div>
        </li>
    );
}

export default memo(ItemForOffer);
