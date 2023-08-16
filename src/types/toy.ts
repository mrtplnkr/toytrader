
export interface Toy {
    title: string;
    id: string;
    file: string;
    userId: string;
    offers?: number;
}
 export interface ToyOffer extends Toy {
    offerId: string;
 }