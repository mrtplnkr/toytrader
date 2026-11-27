import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";

if (getApps().length === 0) {
  initializeApp();
}

const REGION = "europe-west1";
const APP_URL = "https://toystrader-a494f.web.app";

// Static, always-public pages - kept in sync with the actual public routes
// in src/App.tsx (not every route belongs here: /login, /myToys, /myOffers
// etc. are either auth-gated or have no SEO value of their own).
const STATIC_PAGES: { path: string; changefreq: string; priority: string }[] = [
  {path: "/", changefreq: "weekly", priority: "1.0"},
  {path: "/list", changefreq: "daily", priority: "0.9"},
  {path: "/about", changefreq: "monthly", priority: "0.5"},
  {path: "/help", changefreq: "monthly", priority: "0.4"},
  {path: "/privacy", changefreq: "yearly", priority: "0.2"},
  {path: "/disclaimer", changefreq: "monthly", priority: "0.3"},
];

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Replaces the old static public/sitemap.xml (which only ever listed 3
 * fixed pages and could never know about an individual toy) - this is
 * regenerated from Firestore on every request instead, so every toy that
 * exists right now is in it, and one that's since been deleted/traded away
 * naturally drops out on the next crawl rather than needing its own
 * removal step. Routed here via the Hosting rewrite on /sitemap.xml
 * (firebase.json), ahead of the SPA catch-all - the previously-committed
 * static public/sitemap.xml file was deleted, since Hosting serves an
 * actual static file at an exact path before ever considering a rewrite,
 * which would have silently shadowed this function forever. Deliberately
 * public (no auth) - this is exactly what search engines are meant to read.
 */
export const sitemapXml = onRequest(
  {region: REGION},
  async (req, res) => {
    try {
      const db = getFirestore();
      const toysSnap = await db.collection("toys").get();

      const staticEntries = STATIC_PAGES.map(({path, changefreq, priority}) => `  <url>
    <loc>${APP_URL}${path}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`);

      const toyEntries = toysSnap.docs.map((doc) => {
        const data = doc.data();
        const updatedAt = typeof data.updatedAt === "number" ? new Date(data.updatedAt) : undefined;
        const lastmod = updatedAt ? `\n    <lastmod>${updatedAt.toISOString().slice(0, 10)}</lastmod>` : "";
        return `  <url>
    <loc>${escapeXml(`${APP_URL}/viewToy/${doc.id}`)}</loc>${lastmod}
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
      });

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticEntries, ...toyEntries].join("\n")}
</urlset>
`;

      res.set("Content-Type", "application/xml; charset=utf-8");
      // Short cache - toy listings change often (new ones, traded-away ones
      // disappearing), but this doesn't need to be regenerated on literally
      // every crawl hit either.
      res.set("Cache-Control", "public, max-age=3600");
      res.status(200).send(xml);
    } catch (err) {
      logger.error("sitemapXml failed", err);
      res.status(500).set("Content-Type", "text/plain").send("Failed to generate sitemap");
    }
  }
);
