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

// Link-preview crawlers for the platforms this app's own share button
// targets (Facebook/Messenger share the same crawler) plus the other major
// ones, so a pasted link looks right wherever it lands, not just on
// Facebook. Not exhaustive - new crawlers show up over time - but covers
// every platform actually mentioned as broken or targeted by this app.
// Instagram has no meta tag namespace of its own (unlike Twitter's
// twitter:* tags) - link previews there (DMs, the Story "Link" sticker)
// read the same og:* tags as Facebook, since both run on Meta's shared
// crawler infrastructure. "Instagram" is included explicitly anyway in
// case a request ever comes from a differently-labeled IG-specific
// fetcher rather than facebookexternalhit.
const BOT_USER_AGENT_RE = new RegExp([
  "facebookexternalhit", "Facebot", "Instagram", "Twitterbot", "WhatsApp",
  "TelegramBot", "Slackbot", "LinkedInBot", "Discordbot", "Pinterest",
  "redditbot", "Googlebot", "bingbot", "Applebot", "vkShare", "Viber",
  "SkypeUriPreview", "Embedly", "Bluesky",
].join("|"), "i");

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

interface ToyMetaFields {
  title: string;
  description: string;
  keywords: string;
  imageUrl: string;
}

// Resolves everything a toy's share card needs from its Firestore doc -
// shared by both the /toy/{id} redirect page and /viewToy/{id}'s
// crawler branch, so the two can never drift out of sync with each other.
async function resolveToyMeta(toyId: string): Promise<ToyMetaFields | undefined> {
  const db = getFirestore();
  const toySnap = await db.collection("toys").doc(toyId).get();
  if (!toySnap.exists) return undefined;

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
      logger.warn("resolveToyMeta: couldn't resolve image, falling back to og-image.png", toyId, err);
    }
  }

  return {
    title,
    description: ownDescription || buildToyDescription(title),
    keywords: buildToyKeywords(title),
    imageUrl,
  };
}

function buildOgHtml(pageUrl: string, meta: ToyMetaFields, bodyLinkHref?: string): string {
  const safeTitle = escapeHtml(meta.title);
  const safeDescription = escapeHtml(meta.description);
  const safeKeywords = escapeHtml(meta.keywords);
  // bodyLinkHref (the /toy/{id} redirect page only) bounces a real,
  // JS-capable visitor into the actual app - crawlers read the <head>
  // without following either the meta-refresh or the script. Omitted on
  // /viewToy/{id}'s crawler branch below, since that path is only ever
  // reached by a request this function has already identified as a bot
  // (see BOT_USER_AGENT_RE) - a real visitor there gets the live app
  // instead (see viewToyPage), never this HTML at all.
  const redirectTags = bodyLinkHref ?
    `<meta http-equiv="refresh" content="0; url=${bodyLinkHref}">
<script>location.replace(${JSON.stringify(bodyLinkHref)});</script>` : "";
  const bodyContent = bodyLinkHref ?
    `<p>Taking you to <a href="${bodyLinkHref}">${safeTitle} on ToyTrader</a>...</p>` :
    `<p>${safeTitle} on ToyTrader</p>`;

  // schema.org/Product structured data for Google - deliberately no
  // `offers` block: there's no price (this is a free toy-for-toy trade,
  // not a sale), and asserting one just to satisfy Product's optional
  // offers field would be inaccurate. JSON.stringify doesn't escape "</"
  // though, so a toy description containing the literal text "</script>"
  // would otherwise prematurely close this tag once embedded in the HTML
  // below - the trailing .replace() guards against that.
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    "name": meta.title,
    "description": meta.description,
    "image": meta.imageUrl,
    "url": pageUrl,
  }).replace(/<\//g, "<\\/");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${safeTitle} - ToyTrader</title>
<meta name="description" content="${safeDescription}">
<meta name="keywords" content="${safeKeywords}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${pageUrl}">
<script type="application/ld+json">${jsonLd}</script>
<meta property="og:type" content="website">
<meta property="og:site_name" content="ToyTrader">
<meta property="og:title" content="${safeTitle} on ToyTrader">
<meta property="og:description" content="${safeDescription}">
<meta property="og:url" content="${pageUrl}">
<meta property="og:image" content="${meta.imageUrl}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${safeTitle} on ToyTrader">
<meta name="twitter:description" content="${safeDescription}">
<meta name="twitter:image" content="${meta.imageUrl}">
${redirectTags}
</head>
<body>
${bodyContent}
</body>
</html>`;
}

/**
 * Serves a crawler-friendly HTML page for a single toy, with Open Graph
 * tags pointing at that toy's own title/image. The React SPA has no
 * server-side rendering, so it can only ever serve the one static set of
 * meta tags in public/index.html regardless of route - Facebook/etc. would
 * see the generic ToyTrader card for every toy. Routed here via the
 * Hosting rewrite on /toy/** (firebase.json), ahead of the SPA catch-all -
 * note this means /toy/** itself can never be a client-side route. Kept
 * around as a redirect-only legacy path (anything that still links to
 * /toy/{id} keeps working) - the canonical, actually-shared URL is now
 * /viewToy/{id} (see viewToyPage below and item.tsx's share button), which
 * serves real per-toy meta tags to crawlers too, instead of needing a
 * bounce. Real visitors here get bounced into the actual app (meta refresh
 * + JS redirect); crawlers read the raw HTML's <head> without following
 * either. Must stay fully public (no auth) - crawlers never sign in.
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
      const meta = await resolveToyMeta(toyId);
      if (!meta) {
        res.redirect(302, redirectUrl);
        return;
      }

      const pageUrl = `${APP_URL}/toy/${encodeURIComponent(toyId)}`;
      res.set("Content-Type", "text/html; charset=utf-8");
      res.status(200).send(buildOgHtml(pageUrl, meta, redirectUrl));
    } catch (err) {
      logger.error("toyShareCard failed", toyId, err);
      res.redirect(302, redirectUrl);
    }
  }
);

/**
 * The canonical per-toy URL - what item.tsx's share button links to, what
 * ends up in a real visitor's address bar, and so what they'd actually
 * paste/re-share themselves (unlike /toy/{id} above, which only ever
 * exists for a moment before bouncing away). Routed here via the Hosting
 * rewrite on /viewToy/** (firebase.json), ahead of the SPA catch-all, so it
 * can branch on the requester instead of always being one or the other:
 * a detected link-preview crawler (BOT_USER_AGENT_RE) gets this toy's own
 * Open Graph tags directly, with no redirect to follow (most crawlers
 * don't run JS or follow a meta-refresh anyway, and even one that does
 * would just be fetching this exact same URL again). A real browser
 * instead gets the actual built app (fetched from Hosting's own static
 * index.html) so React Router mounts normally and renders
 * src/pages/toyView.tsx at this same URL - indistinguishable from hitting
 * any other SPA route directly, just proxied through a function instead of
 * served as a static file.
 */
export const viewToyPage = onRequest(
  {region: REGION},
  async (req, res) => {
    const toyId = decodeURIComponent(req.path.replace(/^\/viewToy\/?/, "").replace(/\/$/, ""));
    const userAgent = req.get("User-Agent") ?? "";
    const isBot = BOT_USER_AGENT_RE.test(userAgent);

    if (isBot && toyId) {
      try {
        const meta = await resolveToyMeta(toyId);
        if (meta) {
          const pageUrl = `${APP_URL}/viewToy/${encodeURIComponent(toyId)}`;
          res.set("Content-Type", "text/html; charset=utf-8");
          res.status(200).send(buildOgHtml(pageUrl, meta));
          return;
        }
      } catch (err) {
        logger.error("viewToyPage: failed resolving toy meta for crawler", toyId, err);
        // Falls through to serving the plain app below - a crawler gets a
        // generic card rather than an error page.
      }
    }

    // Real visitor (or a bot with no toyId to look up, or a lookup that
    // failed) - serve the actual app so client-side routing takes over.
    try {
      const appRes = await fetch(`${APP_URL}/index.html`);
      const html = await appRes.text();
      res.set("Content-Type", "text/html; charset=utf-8");
      res.status(200).send(html);
    } catch (err) {
      logger.error("viewToyPage: failed fetching app shell", toyId, err);
      res.redirect(302, `${APP_URL}/list`);
    }
  }
);
