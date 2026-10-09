
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

    // Our own 1 EUR service fee - charged per side, only once that side's
    // shipment is confirmed received by the other party.
    offerShipmentPaid?: Date;
    offerShipmentStripeSessionId?: string;

    // Self-reported: the user registers their own shipment directly on
    // Omniva's site (no business contract needed for that) and enters the
    // resulting barcode here themselves - this app never calls Omniva's API
    // to create a shipment.
    offerShipmentBarcode?: string;
    offerShipmentTerminalId?: string;
    offerShipmentToySize?: string;
    offerShipmentStatus?: string;
    offerShipmentStatusUpdatedAt?: Date;

    targetShipmentPaid?: Date;
    targetShipmentStripeSessionId?: string;
    targetShipmentBarcode?: string;
    targetShipmentTerminalId?: string;
    targetShipmentToySize?: string;
    targetShipmentStatus?: string;
    targetShipmentStatusUpdatedAt?: Date;
}
