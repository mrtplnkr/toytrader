
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
    userId: string;
}
