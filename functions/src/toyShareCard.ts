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

/**
 * Serves a crawler-friendly HTML page for a single toy, with Open Graph
 * tags pointing at that toy's own title/image. The React SPA has no
 * server-side rendering, so it can only ever serve the one static set of
 * meta tags in public/index.html regardless of route - Facebook/etc. would
 * see the generic ToyTrader card for every toy. Routed here via the
 * Hosting rewrite on /toy/** (firebase.json), ahead of the SPA catch-all.
 * Real visitors get bounced into the actual app (meta refresh + JS
 * redirect); crawlers read the raw HTML's <head> without following either.
 * Must stay fully public (no auth) - crawlers never sign in.
 */
export const toyShareCard = onRequest(
  {region: REGION},
  async (req, res) => {
    const toyId = decodeURIComponent(req.path.replace(/^\/toy\/?/, "").replace(/\/$/, ""));
    const redirectUrl = `${APP_URL}/list?toyId=${encodeURIComponent(toyId)}`;

    if (!toyId) {
      res.redirect(302, redirectUrl);
      return;
    }

    try {
      const db = getFirestore();
      const toySnap = await db.collection("toys").doc(toyId).get();
      if (!toySnap.exists) {
        res.redirect(302, redirectUrl);
        return;
      }
      const toy = toySnap.data() ?? {};
      const title = String(toy.title ?? "A toy on ToyTrader");

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
      const pageUrl = `${APP_URL}/toy/${encodeURIComponent(toyId)}`;

      res.set("Content-Type", "text/html; charset=utf-8");
      res.status(200).send(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${safeTitle} - ToyTrader</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="ToyTrader">
<meta property="og:title" content="${safeTitle} on ToyTrader">
<meta property="og:description" content="Trade for this toy on ToyTrader - no money, just toy for toy.">
<meta property="og:url" content="${pageUrl}">
<meta property="og:image" content="${imageUrl}">
<meta name="twitter:card" content="summary_large_image">
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
