import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const docs = resolve(new URL("../docs/", import.meta.url).pathname.replace(/^\/(.:)/, "$1"));
const site = "https://windowsiptv.com";
const store = "https://apps.microsoft.com/detail/9NQ5S0FFCN8T?cid=Blazin_website";

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function rel(file) {
  return relative(docs, file).replaceAll("\\", "/");
}

function fileForPath(pathname) {
  const clean = pathname.replace(/^\/+/, "");
  if (!clean) return "index.html";
  if (clean.endsWith("/")) return `${clean}index.html`;
  return clean;
}

function pathForFile(name) {
  if (name === "index.html") return "/";
  if (name.endsWith("/index.html")) return `/${name.slice(0, -"index.html".length)}`;
  return `/${name}`;
}

function readSitemap() {
  const path = join(docs, "sitemap.xml");
  const xml = readFileSync(path, "utf8");
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
  return { path, xml, urls };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textContent(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function getMeta(html, name) {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const nameMatch = tag.match(/\bname\s*=\s*(["'])(.*?)\1/i);
    if (nameMatch?.[2]?.toLowerCase() !== name.toLowerCase()) continue;
    return tag.match(/\bcontent\s*=\s*(["'])(.*?)\1/i)?.[2]?.trim() ?? "";
  }
  return "";
}

function setMeta(html, name, content) {
  const tag = `<meta name="${name}" content="${escapeHtml(content)}">`;
  const matcher = new RegExp(`<meta\\b(?=[^>]*\\bname\\s*=\\s*(["'])${name}\\1)[^>]*>`, "gi");
  let removed = html.replace(matcher, "");
  const title = /<title\b[^>]*>[\s\S]*?<\/title>/i;
  if (title.test(removed)) return removed.replace(title, (value) => `${value}${tag}`);
  return removed.replace(/<head\b[^>]*>/i, (value) => `${value}${tag}`);
}

function setCanonical(html, canonical) {
  const tag = `<link rel="canonical" href="${canonical}">`;
  let cleaned = html.replace(/<link\b(?=[^>]*\brel\s*=\s*(["'])canonical\1)[^>]*>/gi, "");
  return cleaned.replace(/<\/head>/i, `${tag}</head>`);
}

// Reviewed legacy URL migrations. Sitemap omission must never delete page content.
const redirects = {
  "best-iptv-player-for-pc.html": "/best-iptv-player-for-windows/",
  "best-iptv-player-windows-11.html": "/best-iptv-player-for-windows/",
  "free-iptv-player-windows.html": "/download.html",
  "how-to-add-m3u-playlist-windows.html": "/m3u-player-windows/",
  "how-to-choose-iptv-player-windows.html": "/windows-iptv-player/",
  "how-to-load-epg-guide.html": "/epg-iptv-player-windows/",
  "how-to-use-stalker-portal.html": "/stalker-portal-player-windows/",
  "iplayer-vs-iptv-player.html": "/windows-iptv-player/",
  "iptv-app-for-pc.html": "/windows-iptv-player/",
  "iptv-download-windows.html": "/download.html",
  "iptv-para-pc.html": "/windows-iptv-player/",
  "iptv-player-for-laptop.html": "/windows-iptv-player/",
  "iptv-player-for-large-playlists.html": "/features.html",
  "iptv-player-for-pc-without-emulator/index.html": "/windows-iptv-player/",
  "iptv-player-for-small-screen-laptop.html": "/windows-iptv-player/",
  "iptv-player-for-windows-10.html": "/windows-iptv-player/",
  "iptv-player-with-epg.html": "/epg-iptv-player-windows/",
  "iptv-player-with-external-player.html": "/features.html",
  "iptv-player-with-themes-windows.html": "/features.html",
  "iptv-player-zero-alternative-windows.html": "/windows-iptv-player/",
  "iptv-smarters-alternative-windows/index.html": "/windows-iptv-player/",
  "iptv-smarters-alternative-windows.html": "/windows-iptv-player/",
  "iptv-stream-player-windows.html": "/windows-iptv-player/",
  "iptvnator-alternative/index.html": "/windows-iptv-player/",
  "kodi-iptv-setup-vs-blazin.html": "/windows-iptv-player/",
  "legal-iptv-player-windows.html": "/legal-disclaimer.html",
  "lightweight-iptv-player-windows.html": "/windows-iptv-player/",
  "m3u-m3u8-player-windows.html": "/m3u-player-windows/",
  "m3u-player-windows.html": "/m3u-player-windows/",
  "m3u-plus-player-windows.html": "/m3u-player-windows/",
  "microsoft-store-iptv-player-windows.html": "/download.html",
  "smart-iptv-player-pc.html": "/windows-iptv-player/",
  "ssiptv-alternative-windows.html": "/windows-iptv-player/",
  "stalker-portal-player-windows.html": "/stalker-portal-player-windows/",
  "stb-mac-player-windows.html": "/stb-mac-player-windows/",
  "stb-mac-vs-stalker-portal.html": "/stalker-portal-player-windows/",
  "tivimate-alternative-windows.html": "/windows-iptv-player/",
  "vlc-alternative-iptv-player/index.html": "/windows-iptv-player/",
  "vlc-iptv-player-windows.html": "/windows-iptv-player/",
  "windows-iptv-app.html": "/windows-iptv-player/",
  "windows-iptv-player-no-subscription.html": "/windows-iptv-player/",
  "windows-iptv-player.html": "/windows-iptv-player/",
  "windows-iptv-terms.html": "/windows-iptv-player/",
  "xtream-codes-epg-windows.html": "/xtream-codes-player-windows/",
  "xtream-codes-player-windows.html": "/xtream-codes-player-windows/",
  "xtream-codes-vs-m3u.html": "/m3u-player-windows/",
  "yandex_bc47c9641353f551.html": "/windows-iptv-player/"
};

function targetFor(name) {
  return redirects[name];
}

function redirectPage(targetPath) {
  const target = `${site}${targetPath}`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Page moved | BLAZIN IPTV Player</title>
  <meta name="description" content="This older page has been consolidated into the current BLAZIN IPTV Player guide to keep product information accurate and avoid duplicate pages.">
  <meta name="robots" content="noindex, follow">
  <meta http-equiv="refresh" content="0; url=${escapeHtml(targetPath)}">
  <link rel="canonical" href="${escapeHtml(target)}">
  <link rel="stylesheet" href="/assets/style.css">
</head>
<body>
  <main class="section">
    <div class="container content-narrow">
      <h1>This page has moved</h1>
      <p class="lead">The older page was consolidated so visitors and search engines use one current, reviewed source.</p>
      <div class="actions"><a class="btn primary" href="${escapeHtml(targetPath)}">Open the current guide</a><a class="btn" href="/guides.html">Browse all guides</a></div>
    </div>
  </main>
</body>
</html>
`;
}

function sanitizeJsonLd(html, canonical, description, addSoftware, modified) {
  const visible = textContent(html).toLowerCase();
  const kept = [];

  html = html.replace(/<script\b[^>]*type\s*=\s*(["'])application\/ld\+json\1[^>]*>[\s\S]*?<\/script>/gi, (block) => {
    const raw = block.replace(/^<script\b[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    let value;
    try {
      value = JSON.parse(raw);
    } catch {
      return "";
    }

    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (!item || typeof item !== "object") continue;
      const type = item["@type"];
      if (type === "Article") {
        item.image ??= `${site}/screenshots/live-tv-playlist.png`;
        for (const key of ["author", "publisher"]) {
          const org = item[key];
          if (org && typeof org === "object" && org["@type"] === "Organization") {
            org.url ??= `${site}/`;
            org.logo ??= `${site}/assets/app-icon.png`;
          }
        }
      }
      if (type === "SoftwareApplication") continue;
      if (type === "FAQPage") {
        const entities = Array.isArray(item.mainEntity) ? item.mainEntity : [];
        const accurate = entities.length > 0 && entities.every((entry) => {
          const question = String(entry?.name ?? "").toLowerCase();
          const answer = String(entry?.acceptedAnswer?.text ?? "").toLowerCase();
          return question && answer && visible.includes(question) && visible.includes(answer);
        });
        if (!accurate) continue;
      }
      kept.push(item);
    }
    return "";
  });

  if (addSoftware) {
    kept.unshift({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "BLAZIN IPTV Player",
      url: `${site}/`,
      mainEntityOfPage: canonical,
      downloadUrl: store,
      operatingSystem: "Windows 10, Windows 11",
      applicationCategory: "MultimediaApplication",
      softwareVersion: "1.1.21.0",
      ...(modified ? { dateModified: modified } : {}),
      "@id": `${site}/#software`,
      image: `${site}/assets/app-icon.png`,
      description,
      publisher: {
        "@type": "Organization",
        "@id": `${site}/#organization`,
        name: "BLAZIN IPTV Player",
        url: site,
        logo: `${site}/assets/app-icon.png`
      }
    });
  }

  const scripts = kept.map((item) => `<script type="application/ld+json">${JSON.stringify(item).replace(/</g, "\\u003c")}</script>`).join("");
  return html.replace(/<\/head>/i, `${scripts}</head>`);
}

const { xml: sitemapXml, urls: sitemapUrls } = readSitemap();
const modifiedForUrl = new Map([...sitemapXml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>([\s\S]*?)<\/url>/g)].map((match) => [match[1], match[2].match(/<lastmod>([^<]+)<\/lastmod>/)?.[1]]));
const preferred = new Set(sitemapUrls.map((url) => fileForPath(new URL(url).pathname)));
const locForFile = new Map(sitemapUrls.map((url) => [fileForPath(new URL(url).pathname), url]));
const softwareFiles = new Set([
  "index.html",
  "download.html",
  "features.html",
  "windows-iptv-player/index.html",
  "iptv-player-windows-11/index.html",
  "m3u-player-windows/index.html",
  "xtream-codes-player-windows/index.html",
  "stb-mac-player-windows/index.html",
  "stalker-portal-player-windows/index.html",
  "epg-iptv-player-windows/index.html"
]);

const footer = `<div class="footer-links"><a href="/">Home</a><a href="/download.html">7-Day Trial</a><a href="/features.html">Features</a><a href="/guides.html">Guides</a><a href="/screenshots.html">Screenshots</a><a href="/user-guide.html">User Guide</a><a href="/faq.html">FAQ</a><a href="/legal-disclaimer.html">Legal Disclaimer</a><a href="/windows-iptv-player/">Windows IPTV Player</a><a href="/best-iptv-player-for-windows/">Compare Players</a><a href="/iptv-player-windows-11/">Windows 11 Setup</a><a href="/m3u-player-windows/">M3U</a><a href="/xtream-codes-player-windows/">Xtream Codes</a><a href="/stb-mac-player-windows/">STB MAC</a><a href="/stalker-portal-player-windows/">Stalker Portal</a><a href="/epg-iptv-player-windows/">EPG</a></div>`;

let changed = 0;
let consolidated = 0;
let reviewed = 0;
let skipped = 0;

for (const file of walk(docs).filter((item) => item.toLowerCase().endsWith(".html"))) {
  const name = rel(file);
  let html = readFileSync(file, "utf8");

  if (!/<html\b/i.test(html) || !/<head\b/i.test(html)) {
    skipped += 1;
    continue;
  }

  if (name === "404.html") {
    let next = setMeta(html, "robots", "noindex");
    next = setMeta(next, "description", "The requested WindowsIPTV.com page could not be found. Return to the current BLAZIN IPTV Player guides and product information.");
    if (next !== html) {
      writeFileSync(file, next, "utf8");
      changed += 1;
    }
    continue;
  }

  if (!preferred.has(name)) {
    const target = targetFor(name);
    if (!target) {
      console.warn(`Unlisted page preserved: ${name}. Review its sitemap entry before publishing.`);
      skipped += 1;
      continue;
    }
    if (!sitemapUrls.includes(`${site}${target}`)) throw new Error(`Redirect destination is not a preferred URL: ${name} -> ${target}`);
    const next = redirectPage(target);
    if (next !== html) {
      writeFileSync(file, next, "utf8");
      changed += 1;
    }
    consolidated += 1;
    continue;
  }

  const canonical = locForFile.get(name) ?? `${site}${pathForFile(name)}`;
  let next = html;

  next = next
    .replace(/BLAZIN IPTV Player is a player-only Windows IPTV app for people who bring their own legal streaming source\. It is built for IPTV player, IPTV app, IPTV stream player, IPTV for PC, IPTV PC, IPTV Windows and IPTV player Windows searches while staying accurate to the real desktop app\./i,
      "BLAZIN IPTV Player is Windows software for people who bring their own legal streaming source. The interface keeps profiles, browsing tools, guide data, and playback settings together on the desktop.")
    .replace(/These are feature areas reflected in the current Windows desktop build, focused on the current Windows desktop build\./i,
      "These capabilities are available in the current Windows desktop build and can be tested with your own compatible source.")
    .replace(/IPTV download and IPTV player download for Windows/gi,
      "Install BLAZIN IPTV Player from Microsoft Store")
    .replace(/Download BLAZIN IPTV Player from the Microsoft Store when you need a Windows IPTV player, IPTV app for PC, IPTV stream player, or IPTV player download for your own legal playlist or portal source\./i,
      "Install BLAZIN IPTV Player from the Microsoft Store, then test the Windows app with the legal playlist or portal details you already use.")
    .replace(/workflow\s+workflow/gi, "workflow");

  next = setMeta(next, "robots", "index, follow, max-image-preview:large");
  next = setCanonical(next, canonical);

  next = next.replace(/<div\s+class=(["'])footer-links\1>[\s\S]*?<\/div>/gi, footer);

  next = next.replace(/href=(["'])([^"']+)\1/gi, (full, quote, href) => {
    if (/^(?:mailto:|tel:|#|javascript:|data:)/i.test(href)) return full;
    let parsed;
    try {
      parsed = new URL(href, canonical);
    } catch {
      return full;
    }
    if (parsed.origin !== site) return full;
    if (parsed.pathname === "/index.html") return `href=${quote}/${parsed.hash}${quote}`;
    const targetFile = fileForPath(parsed.pathname);
    if (preferred.has(targetFile) || targetFile.startsWith("assets/") || targetFile.startsWith("screenshots/")) return full;
    if (!existsSync(join(docs, targetFile))) return full;
    const targetPath = targetFor(targetFile);
    if (!targetPath) return full;
    return `href=${quote}${targetPath}${quote}`;
  });

  const description = getMeta(next, "description") || "BLAZIN IPTV Player information for Windows users with legal user-provided playlists and portal sources.";
  next = sanitizeJsonLd(next, canonical, description, softwareFiles.has(name), modifiedForUrl.get(canonical));

  if (next !== html) {
    writeFileSync(file, next, "utf8");
    changed += 1;
  }
  reviewed += 1;
}

// Preserve editorial lastmod dates; maintenance alone is not a substantive update.

console.log(`Bing quality cleanup complete: ${reviewed} preferred pages reviewed, ${consolidated} non-preferred pages consolidated, ${changed} files changed, ${skipped} verification files skipped.`);
