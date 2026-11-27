import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";

if (getApps().length === 0) {
  initializeApp();
}

const REGION = "europe-west1";
const APP_URL = "https://toystrader-a494f.web.app";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// A keyword-rich, per-toy description/keywords pair - generated from the
// title rather than a field on the toy doc, so every toy (including ones
// listed before this existed) gets one automatically, with no new form
// field or backfill needed. Feeds <meta name="description">,
// <meta name="keywords"> (Google itself hasn't used the keywords tag for
// ranking since ~2009, kept for other/legacy crawlers, same as
// public/index.html's site-wide one) and og:description, so it's also
// what shows as the caption when a toy URL is shared on Facebook/etc.
function buildToyDescription(title: string): string {
  return `${title} - trade it for free on ToyTrader. Swap, exchange or give away ` +
    "kids' toys near you, no money involved, just toy for toy.";
}

function buildToyKeywords(title: string): string {
  return [
    title,
    "toy swap", "toy exchange", "kids toys", "trade toys for free",
    "second hand toys", "toy trader", "swap toys near me", "give away toys",
  ].join(", ");
}

/**
 * Serves a crawler-friendly HTML page for a single toy, with Open Graph
 * tags pointing at that toy's own title/image. The React SPA has no
 * server-side rendering, so it can only ever serve the one static set of
 * meta tags in public/index.html regardless of route - Facebook/etc. would
 * see the generic ToyTrader card for every toy. Routed here via the
 * Hosting rewrite on /toy/** (firebase.json), ahead of the SPA catch-all -
 * note this means /toy/** itself can never be a client-side route, which is
 * why real visitors land on /viewToy/{id} instead (a real, public SPA page,
 * see src/pages/toyView.tsx) rather than /toy/{id}. Real visitors get
 * bounced into the actual app (meta refresh + JS redirect); crawlers read
 * the raw HTML's <head> without following either. Must stay fully public
 * (no auth) - crawlers never sign in.
 */
export const toyShareCard = onRequest(
  {region: REGION},
  async (req, res) => {
    const toyId = decodeURIComponent(req.path.replace(/^\/toy\/?/, "").replace(/\/$/, ""));
    // /viewToy/:toyId (the client route) requires an id segment - a bare
    // /toy/ hit with nothing to redirect to falls back to the general
    // browse page instead of a dead link.
    if (!toyId) {
      res.redirect(302, `${APP_URL}/list`);
      return;
    }
    const redirectUrl = `${APP_URL}/viewToy/${encodeURIComponent(toyId)}`;

    try {
      const db = getFirestore();
      const toySnap = await db.collection("toys").doc(toyId).get();
      if (!toySnap.exists) {
        res.redirect(302, redirectUrl);
        return;
      }
      const toy = toySnap.data() ?? {};
      const title = String(toy.title ?? "A toy on ToyTrader");
      // The owner's own description (addNewToy.tsx, optional) wins when
      // present - it's more accurate than the generic title-derived one.
      const ownDescription = typeof toy.description === "string" ? toy.description.trim() : "";

      let imageUrl = `${APP_URL}/og-image.png`;
      const fileName = toy.file as string | undefined;
      if (fileName) {
        try {
          const filePath = `projectFiles/${fileName}`;
          const bucket = getStorage().bucket();
          const [metadata] = await bucket.file(filePath).getMetadata();
          const token = metadata.metadata?.firebaseStorageDownloadTokens?.toString().split(",")[0];
          if (token) {
            imageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/` +
              `${encodeURIComponent(filePath)}?alt=media&token=${token}`;
          }
        } catch (err) {
          logger.warn("toyShareCard: couldn't resolve image, falling back to og-image.png", toyId, err);
        }
      }

      const safeTitle = escapeHtml(title);
      const safeDescription = escapeHtml(ownDescription || buildToyDescription(title));
      const safeKeywords = escapeHtml(buildToyKeywords(title));
      const pageUrl = `${APP_URL}/toy/${encodeURIComponent(toyId)}`;

      res.set("Content-Type", "text/html; charset=utf-8");
      res.status(200).send(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${safeTitle} - ToyTrader</title>
<meta name="description" content="${safeDescription}">
<meta name="keywords" content="${safeKeywords}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="ToyTrader">
<meta property="og:title" content="${safeTitle} on ToyTrader">
<meta property="og:description" content="${safeDescription}">
<meta property="og:url" content="${pageUrl}">
<meta property="og:image" content="${imageUrl}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${safeTitle} on ToyTrader">
<meta name="twitter:description" content="${safeDescription}">
<meta name="twitter:image" content="${imageUrl}">
<meta http-equiv="refresh" content="0; url=${redirectUrl}">
<script>location.replace(${JSON.stringify(redirectUrl)});</script>
</head>
<body>
<p>Taking you to <a href="${redirectUrl}">${safeTitle} on ToyTrader</a>...</p>
</body>
</html>`);
    } catch (err) {
      logger.error("toyShareCard failed", toyId, err);
      res.redirect(302, redirectUrl);
    }
  }
);
