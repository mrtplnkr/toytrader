import {getStorage} from "firebase-admin/storage";

/**
 * Best-effort deletion of projectFiles/* Storage objects (toy photos/video,
 * complaint evidence) by their raw filename. Never throws - a missing file
 * (already cleaned up, or a toy that predates this cleanup existing at all)
 * or a transient Storage error shouldn't block whatever Firestore mutation
 * this cleanup is attached to.
 */
export async function deleteProjectFiles(fileNames: string[]): Promise<void> {
  const bucket = getStorage().bucket();
  await Promise.all(fileNames.map((name) =>
    bucket.file(`projectFiles/${name}`).delete().catch(() => undefined)
  ));
}

/** All Storage filenames referenced by a toy doc's raw Firestore data. */
export function toyFileNames(data: FirebaseFirestore.DocumentData): string[] {
  const images: string[] = Array.isArray(data.images) ?
    data.images :
    (data.file ? [data.file] : []);
  return data.video ? [...images, data.video] : images;
}
