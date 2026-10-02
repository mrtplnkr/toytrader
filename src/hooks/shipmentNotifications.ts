import { Store } from "react-notifications-component";
import { Offer } from "../types/offer";

const STATUS_LABELS: Record<string, string> = {
    REGISTERED: "registered with Omniva",
    IN_TRANSIT: "in transit",
    ARRIVED_AT_TERMINAL: "arrived at the parcel machine",
    DELIVERED: "delivered",
    RETURNED: "returned",
    UNKNOWN: "unknown",
};

/**
 * Compares the previous and current offers list for the signed-in user and
 * fires an in-app toast for each shipment status change on "my side" of an
 * offer. Only reaches a currently-open tab - background delivery is covered
 * separately by the email notification sent from syncOmnivaShipmentStatuses.
 */
export function diffAndNotifyShipmentStatus(uid: string, prevOffers: Offer[], newOffers: Offer[]) {
    const prevById = new Map(prevOffers.map((o) => [o.id, o]));

    for (const offer of newOffers) {
        const prev = prevById.get(offer.id);
        if (!prev) continue;

        const isInitiator = offer.userInitiated === uid;
        const isReceiver = offer.userReceived === uid;
        if (!isInitiator && !isReceiver) continue;

        const mySide = isInitiator ? 'offer' : 'target';
        const prevStatus = mySide === 'offer' ? prev.offerShipmentStatus : prev.targetShipmentStatus;
        const newStatus = mySide === 'offer' ? offer.offerShipmentStatus : offer.targetShipmentStatus;

        if (!newStatus || newStatus === prevStatus) continue;

        Store.addNotification({
            title: "Shipment update",
            message: `Your parcel is now ${STATUS_LABELS[newStatus] ?? newStatus}.`,
            type: "info",
            insert: "top",
            container: "top-right",
            animationIn: ["animate__animated", "animate__fadeIn"],
            animationOut: ["animate__animated", "animate__fadeOut"],
            dismiss: { duration: 5000 },
        });
    }
}
