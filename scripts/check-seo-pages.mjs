import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const docs = resolve(new URL("../docs/", import.meta.url).pathname.replace(/^\/(.:)/, "$1"));
const site = "https://windowsiptv.com";
const errors = [];

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

function attribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i"))?.[2]?.trim() ?? "";
}

function visibleText(html) {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html;
  return main
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<header\b[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function shingles(text, size = 6) {
  const words = text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
  const set = new Set();
  for (let i = 0; i <= words.length - size; i += 1) set.add(words.slice(i, i + size).join(" "));
  return set;
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

const sitemap = readFileSync(join(docs, "sitemap.xml"), "utf8");
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
const sitemapFiles = new Set(sitemapUrls.map((url) => fileForPath(new URL(url).pathname)));
const sitemapUrlSet = new Set(sitemapUrls);
const indexablePages = [];

for (const file of walk(docs).filter((item) => item.toLowerCase().endsWith(".html"))) {
  const html = readFileSync(file, "utf8");
  const name = rel(file);
  if (!/<html\b/i.test(html) || !/<head\b/i.test(html)) continue;

  const metaTags = [...html.matchAll(/<meta\b[^>]*>/gi)].map((match) => match[0]);
  const robots = metaTags.filter((tag) => attribute(tag, "name").toLowerCase() === "robots").map((tag) => attribute(tag, "content").toLowerCase());
  const noindex = robots.some((value) => value.includes("noindex"));
  const descriptions = metaTags.filter((tag) => attribute(tag, "name").toLowerCase() === "description");
  const canonicalTag = [...html.matchAll(/<link\b[^>]*>/gi)].map((match) => match[0]).find((tag) => attribute(tag, "rel").toLowerCase() === "canonical");
  const canonical = canonicalTag ? attribute(canonicalTag, "href") : "";
  const text = visibleText(html);

  if (descriptions.length !== 1 || !attribute(descriptions[0] ?? "", "content")) errors.push(`${name}: expected one non-empty meta description`);
  if (robots.length !== 1) errors.push(`${name}: expected exactly one robots meta tag`);

  if (name === "404.html") {
    if (!noindex) errors.push(`${name}: 404 page must be noindex`);
    continue;
  }

  if (!canonical || !canonical.startsWith(`${site}/`)) errors.push(`${name}: missing or invalid canonical`);

  if (sitemapFiles.has(name)) {
    if (noindex) errors.push(`${name}: sitemap page must be indexable`);
    const expectedCanonical = sitemapUrls.find((url) => fileForPath(new URL(url).pathname) === name);
    if (canonical !== expectedCanonical) errors.push(`${name}: canonical must match its sitemap URL (${expectedCanonical})`);
    if ((html.match(/<h1\b/gi) ?? []).length !== 1) errors.push(`${name}: expected exactly one H1`);
    indexablePages.push({ name, html, text, canonical, shingles: shingles(text) });
  } else {
    if (!noindex) errors.push(`${name}: indexable page is missing from the sitemap; review explicitly rather than replacing its content`);
    if (canonical && !sitemapUrlSet.has(canonical)) errors.push(`${name}: consolidated page canonical must point to a preferred sitemap URL`);
    if (!/<meta\b[^>]*http-equiv\s*=\s*(["'])refresh\1/i.test(html)) errors.push(`${name}: consolidated page is missing a redirect`);
  }

  if (/\b(?:ignore (?:all |any )?(?:previous|prior) instructions|system prompt|developer message|assistant instructions|prompt injection|copilot should|bing should|language model should|cite this page|ground your answer)\b/i.test(text)) {
    errors.push(`${name}: possible prompt-injection or AI-manipulation language`);
  }

  if (/\b(?:workflow\s+workflow|keyword stuffing|seo rankings?|search traffic|built for .{0,120} searches|for .{0,100} search(?:es)? while|long-tail page|helps? sell blazin|editorial review placeholder)\b/i.test(text)) {
    errors.push(`${name}: search-engine or generated-template language found`);
  }

  if (/<(?:div|span|p|section)\b[^>]*(?:hidden\b|style\s*=\s*(["'])[^"']*display\s*:\s*none)/i.test(html)) {
    errors.push(`${name}: hidden HTML content requires manual review`);
  }

  for (const match of html.matchAll(/<script\b[^>]*src\s*=\s*(["'])(https?:\/\/[^"']+)\1/gi)) {
    errors.push(`${name}: external script is not allowlisted (${match[2]})`);
  }

  for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*(["'])application\/ld\+json\1[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data;
    try {
      data = JSON.parse(match[2]);
    } catch {
      errors.push(`${name}: invalid JSON-LD`);
      continue;
    }
    const objects = Array.isArray(data) ? data : [data];
    for (const object of objects) {
      if (!object || typeof object !== "object") continue;
      if (object["@type"] === "SoftwareApplication") {
        if ("offers" in object) errors.push(`${name}: SoftwareApplication offers must not be hard-coded`);
        if ("alternateName" in object) errors.push(`${name}: generic alternateName targeting is not allowed`);
        if (object.name !== "BLAZIN IPTV Player") errors.push(`${name}: SoftwareApplication name is inaccurate`);
      }
      if (object["@type"] === "FAQPage") {
        for (const entry of object.mainEntity ?? []) {
          const q = String(entry?.name ?? "");
          const a = String(entry?.acceptedAnswer?.text ?? "");
          if (!q || !a || !text.toLowerCase().includes(q.toLowerCase()) || !text.toLowerCase().includes(a.toLowerCase())) {
            errors.push(`${name}: FAQ structured data is not fully represented in visible content`);
          }
        }
      }
    }
  }

  for (const match of html.matchAll(/(?:href|src)=(["'])([^"']+)\1/gi)) {
    const ref = match[2];
    if (/^(?:https?:|mailto:|tel:|#|data:)/i.test(ref)) continue;
    const clean = ref.split("#")[0].split("?")[0];
    if (!clean) continue;
    const target = clean.startsWith("/") ? resolve(docs, clean.slice(1)) : resolve(dirname(file), clean);
    const candidate = clean.endsWith("/") ? join(target, "index.html") : target;
    if (!existsSync(candidate)) errors.push(`${name}: broken local reference ${ref}`);
  }
}

const titles = new Map();
const headings = new Map();
for (const page of indexablePages) {
  for (const [tag, seen] of [["title", titles], ["h1", headings]]) {
    const value = visibleText(page.html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] ?? "").toLowerCase();
    if (!value) errors.push(`${page.name}: missing ${tag}`);
    else if (seen.has(value)) errors.push(`${page.name}: duplicate ${tag} also used by ${seen.get(value)}`);
    else seen.set(value, page.name);
  }
}

for (let i = 0; i < indexablePages.length; i += 1) {
  for (let j = i + 1; j < indexablePages.length; j += 1) {
    const first = indexablePages[i];
    const second = indexablePages[j];
    const similarity = jaccard(first.shingles, second.shingles);
    if (similarity >= 0.72) errors.push(`${first.name} and ${second.name}: excessive visible-content similarity (${similarity.toFixed(2)})`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Bing quality audit passed: ${indexablePages.length} preferred indexable pages; all other HTML pages are consolidated and noindex.`);
