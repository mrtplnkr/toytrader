
export interface Toy {
    id: string;
    title: string;
    // Main/thumbnail image - unchanged from the original single-image design,
    // still what every existing card/offer/share-preview renders. Always one
    // of the entries in `images` (getToyList resolves both from the same
    // underlying Storage object, see helper.ts).
    file: string;
    // Up to 3 images total, in upload order (getToyList defaults this to
    // `[file]` for pre-existing docs that predate this field).
    images: string[];
    // Optional single video - absent for toys listed before this field, or
    // for toys whose owner didn't add one.
    video?: string;
    // Free-text, owner-written, optional - shown on the toy's full-screen
    // view (addNewOffer.tsx) and used verbatim (instead of the
    // title-derived fallback) in /toy/{id}'s share-link meta tags, see
    // functions/src/toyShareCard.ts.
    description?: string;
    // Set to the accepted offer's id once a trade for this toy is accepted
    // (helper.ts's updateOffer), cleared if that same offer is later
    // declined/cancelled before shipping (declineOffer) - lets list.tsx hide
    // an already-spoken-for toy from every visitor, not just the two people
    // actually party to that offer (offers are read-restricted, toys
    // aren't - see the comment on updateOffer).
    lockedByOfferId?: string;
    userId: string;
    // Set on creation and every edit (see addNewToy/updateToy in helper.ts) -
    // absent for toys listed before this field existed.
    updatedAt?: Date;
}
