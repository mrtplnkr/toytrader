
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

    offerShipmentPaid?: Date;
    offerShipmentStripeSessionId?: string;
    offerShipmentBarcode?: string;
    offerShipmentQrIssuedAt?: Date;
    offerShipmentError?: string;
    offerShipmentTerminalId?: string;
    offerShipmentStatus?: string;
    offerShipmentStatusUpdatedAt?: Date;

    targetShipmentPaid?: Date;
    targetShipmentStripeSessionId?: string;
    targetShipmentBarcode?: string;
    targetShipmentQrIssuedAt?: Date;
    targetShipmentError?: string;
    targetShipmentTerminalId?: string;
    targetShipmentStatus?: string;
    targetShipmentStatusUpdatedAt?: Date;
}
