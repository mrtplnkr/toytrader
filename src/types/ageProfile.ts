
// Self-reported once, right after a user's first sign-in (any method -
// email, Google, or Facebook - none of which reliably expose real age/
// birthdate, see components/ageProfileModal.tsx) - fully private, read/write
// only by the owning user (firestore.rules), same trust model as
// shippingProfiles.
export interface AgeProfile {
    isAdult: boolean;
    // Only present when isAdult is false - a school grade/class number
    // (1-12), not an exact birthdate - a lighter-weight, less sensitive
    // signal than collecting a real date of birth from a child.
    schoolClass?: number;
}
