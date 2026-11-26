export interface Rating {
    id: string;
    offerId: string;
    toyId: string;
    raterUid: string;
    stars: number;
    feedback?: string;
    createdAt: Date;
}
