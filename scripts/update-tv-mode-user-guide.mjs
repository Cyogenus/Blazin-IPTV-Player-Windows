import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const docs = resolve(new URL("../docs/", import.meta.url).pathname.replace(/^\/(.:)/, "$1"));
const guidePath = resolve(docs, "user-guide.html");

const startMarker = "<!-- TV MODE USER GUIDE START -->";
const endMarker = "<!-- TV MODE USER GUIDE END -->";

const tvModeGuide = `${startMarker}
<section class="section">
<div class="container content-narrow">
<p class="kicker">TV Mode</p>
<h2>How to Use BLAZIN TV Mode</h2>
<p class="lead">TV Mode gives BLAZIN IPTV Player a large-screen interface for Live TV, Movies, and Series. It is designed for TVs, large monitors, mini PCs, and couch-style keyboard or remote navigation while continuing to use the profiles and legal sources you add to the desktop app.</p>

<div class="screenshot-card" style="margin:24px auto;max-width:900px;">
<img loading="lazy" decoding="async" src="screenshots/tv-mode-live-tv-epg-v3.jpg?v=1170-tv6" alt="BLAZIN IPTV Player TV Mode showing Live TV and EPG" style="display:block;width:100%;height:auto;object-fit:contain;"/>
<div class="caption"><h3>TV Mode — Live TV + EPG</h3><p>Browse categories and channels on the left, view the selected channel and program information, and use the EPG timeline when guide data is supplied by your source.</p></div>
</div>

<h3>Opening TV Mode</h3>
<ol class="steps">
<li>Load your playlist, portal, or saved profile in BLAZIN IPTV Player.</li>
<li>Open the <strong>View</strong> menu and choose <strong>Open Browser TV Mode</strong>.</li>
<li>TV Mode opens using the source or saved profile available from the desktop app.</li>
<li>Choose <strong>Live TV</strong>, <strong>Movies</strong>, or <strong>Series</strong> from the left navigation rail.</li>
<li>Select a category, then select the channel, movie, series, season, or episode you want.</li>
<li>Press <strong>Enter</strong> or use the on-screen Play control to start playback.</li>
</ol>

<h3>Browsing Live TV</h3>
<p>Choose a Live TV category and move through the channel list. When your source supplies EPG information, TV Mode can show the current program, upcoming programs, description, timing, and EPG timeline. Selecting another channel updates the program information for that channel.</p>

<h3>Browsing Movies and Series</h3>
<p>Movies and Series use a poster-focused large-screen layout. Choose a category, move through the artwork, and select an item to view available details. For Series, select the series first, then choose a season and episode when those details are supplied by your source.</p>

<h3>Search and Favorites</h3>
<p>Use Search to quickly filter the current TV Mode section. Favorites let you return to channels, movies, or series you use often without browsing the full source again.</p>

<h3>TV Mode Keyboard Controls</h3>
<div class="card">
<ul>
<li><strong><code>F</code></strong> — enter or leave fullscreen TV Mode.</li>
<li><strong><code>G</code></strong> — open the Guide / EPG view for Live TV.</li>
<li><strong><code>↑</code> / <code>↓</code></strong> — move to the previous or next item. During supported fullscreen Live TV playback, use Up/Down to change channels.</li>
<li><strong><code>←</code> / <code>→</code></strong> — move across TV Mode rows and grids.</li>
<li><strong><code>Enter</code></strong> — open or play the currently selected item.</li>
<li><strong><code>/</code></strong> — open Search in Browser TV Mode.</li>
<li><strong><code>Esc</code></strong> — close Search or the playback view, or leave fullscreen where applicable.</li>
</ul>
</div>

<h3>Fullscreen Live TV Channel Switching</h3>
<p>When Live TV is playing in the BLAZIN internal player, press <strong><code>F</code></strong> for fullscreen. While remaining fullscreen, press <strong><code>↑</code></strong> for the previous channel or <strong><code>↓</code></strong> for the next channel. The channel-name marquee appears briefly after the channel changes so you can confirm what is playing without leaving fullscreen. Press <strong><code>Esc</code></strong> to exit fullscreen.</p>

<p class="small">TV Mode displays information supplied by your own compatible source. BLAZIN IPTV Player does not provide channels, playlists, streams, subscriptions, provider accounts, or copyrighted content.</p>
</div>
</section>
${endMarker}`;

let html = readFileSync(guidePath, "utf8");

const existingPattern = new RegExp(`${startMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${endMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
html = html.replace(existingPattern, "");
// Remove the insertion newline as well so maintenance does not grow the page.
html = html.replace(/\s*(?=<section class="section"><div class="container"><p class="kicker">Source setup shortcuts<\/p>)/, "");

const relatedMarker = '<section class="section"><div class="container"><p class="kicker">Source setup shortcuts</p>';
if (!html.includes(relatedMarker)) {
  throw new Error("Could not find the Source setup shortcuts insertion point in docs/user-guide.html");
}

html = html.replace(relatedMarker, `${tvModeGuide}\n${relatedMarker}`);
writeFileSync(guidePath, html, "utf8");
console.log("Updated docs/user-guide.html with the TV Mode guide and keyboard controls.");
