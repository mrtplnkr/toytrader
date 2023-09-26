
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
}
