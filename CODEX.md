\## Product source of truth



Before writing or editing public website pages, read:



\- PRODUCT\_BRIEF.md

\- README.md

\- USER\_GUIDE.md if present

\- Existing website pages in /docs

\- Screenshots in /docs/screenshots if present



Use PRODUCT\_BRIEF.md as the main source of truth for BLAZIN IPTV Player features.



Do not invent features.

Do not claim the app provides IPTV channels, playlists, subscriptions, or provider accounts.

Do not claim EPG, posters, logos, or categories are guaranteed for every playlist.

Say these features depend on the user’s IPTV source.


## Website maintenance

- Keep the homepage brand-focused; use `/windows-iptv-player/` for broad Windows player intent and the existing source guides for their specific tasks.
- Add new indexable pages to `docs/sitemap.xml` deliberately. Sitemap omission must never trigger content deletion.
- Legacy migrations are listed explicitly in `scripts/fix-bing-quality-issues.mjs`; review the destination against the old page intent.
- Update sitemap `lastmod` only after a significant page change. Maintenance runs preserve these dates.
- Comparisons must identify BLAZIN as the publisher, cite official sources and distinguish documentation review from hands-on tests.
- Do not invent prices, ratings or review markup to obtain rich results.
- Run the existing SEO, metadata, copy and favicon checks before publishing.
