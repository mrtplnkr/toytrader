
export interface Offer {
    id: string;

    userInitiated: string;
    userReceived: string;
    
    toyTargeted: string;
    toyOffered: string;

    offerCreated: Date;
    
    offerAccepted?: Date;
    offerPosted?: Date;
    offerReceived?: Date;

    targetPosted?: Date;
    targetReceived?: Date;

    // Our own optional 1 EUR "buy me a coffee" tip - per *trade*, not per
    // side: offerable once the whole trade has completed (both toys
    // received) and the viewing user has left their own feedback, payable
    // by either party, first to pay closes it for both. Entirely voluntary -
    // nothing else in the trade depends on this being paid.
    tipPaid?: Date;
    tipStripeSessionId?: string;
    tipPaidByUid?: string;

    // Self-reported: the user registers their own shipment directly on
    // Omniva's site (no business contract needed for that) and enters the
    // resulting barcode here themselves - this app never calls Omniva's API
    // to create a shipment.
    offerShipmentBarcode?: string;
    offerShipmentToySize?: string;
    offerShipmentStatus?: string;
    offerShipmentStatusUpdatedAt?: Date;

    targetShipmentBarcode?: string;
    targetShipmentToySize?: string;
    targetShipmentStatus?: string;
    targetShipmentStatusUpdatedAt?: Date;

    // Self-reported, shared on this specific trade once each side is ready
    // to ship - copied from their own private ShippingProfile (see
    // src/types/shippingProfile.ts), so the other trader knows who/where
    // to actually send their toy to.
    offerShippingName?: string;
    offerShippingPhone?: string;
    offerShippingParcelMachineId?: string;
    offerShippingParcelMachineLabel?: string;

    targetShippingName?: string;
    targetShippingPhone?: string;
    targetShippingParcelMachineId?: string;
    targetShippingParcelMachineLabel?: string;
}
