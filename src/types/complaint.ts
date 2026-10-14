export interface Complaint {
    id: string;
    offerId: string;
    reporterUid: string;
    reportedUid: string;
    message: string;
    photoFile?: string;
    createdAt: Date;
}
