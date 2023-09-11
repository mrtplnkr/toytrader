
export interface Offer {
    id: string;

    userInitiated: string;
    userReceived: string;
    
    toyTargeted: string;
    toyOffered: string;

    offerReceived: Date;
    offerAccepted: Date;
    targetCompleted: Date;
    // offerCompleted: Date;
}
