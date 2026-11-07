# Report — Wiktoria Wolniak-Gral portfolio

A static portfolio (HTML + CSS + vanilla JS, no build step) built from the public
Behance profile https://www.behance.net/wiktoriawolniak. Built on 2026-11-07.

## Summary: read this first

- **Built from source data:** the 12 projects listed on the public profile, in
  Behance order, with their real titles, publish dates and cover artwork. Also
  the About text, e-mail and Instagram link, copied verbatim from the profile.
- **Not available:** every individual project page returned HTTP 403 with a
  JavaScript bot challenge. This happened with curl, WebFetch and headless
  Chrome. It was **not** bypassed. So **no project descriptions and no project
  image sequences** are on the site. Each detail page shows the profile cover
  only, labelled "Project cover, as shown on the Behance profile.", with a
  notice and a link to the original project.
- **Incomplete list:** the profile reports more projects beyond these 12. They
  load only through Behance's internal API, which was not used.
- Details and how to fill the gaps: [SOURCE_GAPS.md](SOURCE_GAPS.md).

## How to preview

The site loads `content.json` with `fetch`, so it needs a local HTTP server
(opening `index.html` via `file://` will show an error message).

```sh
cd /workspace/wiktoria-portfolio
python3 -m http.server 8000
# open http://localhost:8000
```

Routes: `#/` (work grid), `#/project/<slug>` (detail), `#/about`.

## Deployment-ready export (`dist/portfolio-wiktoria/`)

`dist/portfolio-wiktoria/` is a static folder intended for the base path
`/portfolio-wiktoria/`. It has not been deployed.

- **Contents:** 17 files, 1.9 MB: `index.html`, `content.json`, `css/`, `js/`, `assets/`. It is byte-identical to the source files and contains no tests, tools or reports.
- **Why it works in a subdirectory:**
  - Every URL is relative: stylesheet, script, `fetch("content.json")`, and image paths in the manifest.
  - Routing is hash-based (`#/project/<slug>`), so deep links and reloads need no server rewrite rules.
- **Fallback for hosts that don't add a trailing slash:** a small inline script in `<head>` redirects `/portfolio-wiktoria` to `/portfolio-wiktoria/`. Without the slash, relative URLs would resolve against `/`. If the host enforces a strict Content-Security-Policy, this inline script needs a hash allowance.
- **Rebuild:** `python3 -I tools/export.py`. It copies only runtime files, then fails on any root-absolute URL or missing manifest asset.

To preview it the way it would be hosted:

```sh
cd /workspace/wiktoria-portfolio/dist
python3 -m http.server 8000
# open http://localhost:8000/portfolio-wiktoria/
```

**Subpath test:** `dist/` was served on `127.0.0.1:8766` and the full suite was
run against `/portfolio-wiktoria/` at 1440 and 390 px. **98 / 98 checks passed**
(`tests/results-subpath.txt`). Besides all the standard checks, it verifies:

- Every local request stays under `/portfolio-wiktoria/`. The server root has no `content.json`, so any escaped request would 404.
- In-app navigation keeps the base path.
- Reloading a deep link renders the same project.
- A URL without the trailing slash, served by a host that doesn't redirect (simulated), ends up at `/portfolio-wiktoria/`.

Screenshots: `screenshots/subpath-{desktop-1440,mobile-390}-{home,home-full,project,lightbox,about}.png`.

## Files

| Path | Purpose |
|---|---|
| `index.html` | Page shell: header, nav, footer, lightbox `<dialog>` |
| `css/styles.css` | Visual identity and responsive layout (3 → 2 → 1 columns) |
| `js/app.js` | Hash router, views (home / project / about / not found), keyboard lightbox |
| `content.json` | Content manifest: profile, the 12 projects in order, the source URL of every page and image, local paths, image sizes, alt text, gap status |
| `assets/covers/NN-<behanceId>.jpg` | 12 project covers (808×632), downloaded from the Behance CDN |
| `assets/profile/avatar.jpg` | Profile photo (276×276) |
| `source/profile_snapshot.json` | Trimmed copy of the profile data embedded in the public profile page (profile + project list only) |
| `tools/fetch_profile.py` | Re-fetches the public profile page (single plain GET) and writes the snapshot |
| `tools/build_content.py` | Builds `content.json` and downloads assets from the snapshot |
| `tools/export.py` | Builds and verifies `dist/portfolio-wiktoria/` |
| `dist/portfolio-wiktoria/` | Deployment-ready static export (see above) |
| `tests/site_test.py` | Playwright end-to-end checks; also takes the screenshots. Options `--site-dir`, `--shot-prefix`, `--results` for the subpath run |
| `tests/results.txt`, `tests/results-subpath.txt` | Output of the last root and subpath test runs |
| `screenshots/` | Desktop (1440 px) and mobile (390 px) captures |
| `SOURCE_GAPS.md` | What could not be read, and why |

To rebuild: `python3 -I tools/fetch_profile.py source/profile_snapshot.json && python3 -I tools/build_content.py source/profile_snapshot.json .`

## Design

- Warm paper background, near-black ink, a single rust accent.
- Serif wordmark and titles; small-caps sans for metadata.
- Numbered project index.
- No Behance platform UI: no login, likes, view counts or follow buttons.
- No external requests at runtime: no web fonts, CDNs or analytics. The favicon is inline SVG.

## Accessibility

- Images keep their aspect ratio: real `width`/`height` attributes, `height: auto`, no cropping.
- Every image has alt text from `content.json`.
- Skip link. Focus moves to the page heading on in-app navigation, but not on first load.
- `aria-current` marks the active nav item. The detail view has previous/next project navigation.
- Lightbox uses a native modal `<dialog>`, opened with Enter/Space or click:
  - Focus moves to Close and stays inside while open (Tab wraps).
  - ←/→ go to the previous/next image; Home/End jump to the first/last.
  - Esc, the Close button, or clicking the backdrop closes it, and focus returns to the image that opened it.
  - Prev/next buttons are hidden when there is only one image.
- `prefers-reduced-motion` turns off transitions.

## Test results

Run with the site served on `http://127.0.0.1:8765`:
`python3 tests/site_test.py http://127.0.0.1:8765` (uses `/usr/bin/google-chrome`
because Playwright's bundled browser isn't installed).

**96 / 96 checks passed** (48 at 1440×900, 48 at 390×844 mobile emulation). This
re-run includes the new navigation, deep-link reload and request-path checks. Full
list in `tests/results.txt`. They cover:

- **Home:** shows all 12 manifest projects in Behance order; links point to the right detail routes. The grid is 3 columns on desktop and 1 on mobile.
- **Images:** on home, detail and about, every image has alt text, none are broken, and the rendered aspect ratio matches the source file (±1%).
- **Layout:** no horizontal overflow at either width.
- **Content:** no Behance UI text (appreciate / log in / sign up / follow / likes / views).
- **Keyboard:**
  - First Tab reaches the skip link.
  - Enter on a card opens the project and focuses its heading.
- **Detail pages (all 12):** correct title, media in manifest order, correct link to the original project. Prev/next follow manifest order.
- **Lightbox:**
  - Opens as a modal with Enter, moves focus to Close, keeps Tab inside, and has alt text.
  - Esc closes it and returns focus.
  - Arrow and Home keys step through media in order. Tested with a 3-image test manifest injected at request time and never written to disk, because no real project has a multi-image sequence yet.
- **About:** verbatim profile text, the profile e-mail as a mailto link, and no broken Facebook link.
- **Not found:** unknown project slugs show a "Not found" page.
- **Network:** no console errors, no failed requests, no external network requests.

Two bugs found by the tests and fixed:

- Focus was moved to `<main>` on first load, so the first Tab skipped the skip link.
- A missing favicon caused a 404 console error.

### Screenshots

| | Desktop 1440 px | Mobile 390 px |
|---|---|---|
| Home (viewport) | `screenshots/desktop-1440-home.png` | `screenshots/mobile-390-home.png` |
| Home (full page) | `screenshots/desktop-1440-home-full.png` | `screenshots/mobile-390-home-full.png` |
| Project detail | `screenshots/desktop-1440-project.png` | `screenshots/mobile-390-project.png` |
| Lightbox | `screenshots/desktop-1440-lightbox.png` | `screenshots/mobile-390-lightbox.png` |
| About | `screenshots/desktop-1440-about.png` | `screenshots/mobile-390-about.png` |

## Gaps (short version: full detail in SOURCE_GAPS.md)

1. **Project pages:** all 12 were unreadable (403 JS challenge), so descriptions, image sequences and credits are missing.
2. **Older projects:** projects after the first 12 are not listed (`hasMore: true`; only reachable via Behance's internal API).
3. **Facebook link:** the profile's link is malformed, so it is not rendered.
4. **Images:** covers are 808×632 Behance crops, and alt text is factual rather than descriptive.
5. **Name:** the site uses the Behance display name "Wiktoria Wolniak-Gral" (the brief said "Wiktoria Wolniak").

## Not done (per instructions)

- No deployment, no git operations or push, no messages, no purchases.
- No private APIs, and no attempt to get around the bot challenge.
