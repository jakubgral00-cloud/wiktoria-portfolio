# CLAUDE.md

Guidance for Claude Code working in this repo on Jakub's Mac.

This is a static portfolio for the stylist Wiktoria Wolniak-Gral: plain HTML,
CSS and vanilla JS, with no build step and no dependencies at runtime. All
content comes from the public Behance profile https://www.behance.net/wiktoriawolniak.

## Preview

```sh
python3 -m http.server 8000      # from the repo root → http://localhost:8000
```

To check the export under its base path:

```sh
cd dist && python3 -m http.server 8000   # → http://localhost:8000/portfolio-wiktoria/
```

A server is required: `index.html` fetches `content.json`, so `file://` won't work.

## Layout

| Path | What |
|---|---|
| `index.html` | Page shell, lightbox `<dialog>`, inline trailing-slash guard |
| `css/styles.css` | All styling (paper/ink/rust palette, responsive grid) |
| `js/app.js` | Hash router (`#/`, `#/project/<slug>`, `#/about`), views, keyboard lightbox |
| `content.json` | **The content manifest**: profile, projects in Behance order, every image with local `src`, `source_url`, `width`, `height`, `alt` |
| `assets/` | Downloaded images (`covers/NN-<behanceId>.jpg`, `profile/avatar.jpg`) |
| `source/profile_snapshot.json` | Trimmed data from the public profile page |
| `tools/fetch_profile.py` | Re-fetches the profile page into the snapshot (one plain GET) |
| `tools/build_content.py` | Builds `content.json` from the snapshot and downloads covers |
| `tools/export.py` | Builds `dist/portfolio-wiktoria/` and checks it for root-absolute URLs and missing assets |
| `dist/portfolio-wiktoria/` | Deployment-ready copy for base path `/portfolio-wiktoria/` |
| `tests/site_test.py` | Playwright end-to-end checks and screenshots |
| `SOURCE_GAPS.md`, `REPORT.md` | What could not be sourced; build/test report |

## content.json is the source of truth

The site renders everything from `content.json`. Change content there, not in the
HTML or JS. Project order in the array is the display order, and it matches Behance.

## Adding project media

All projects currently have `media: []`, because the Behance project pages were
blocked (see SOURCE_GAPS.md). While `media` is empty, the detail page shows only
the cover and a "could not be retrieved" notice.

To add a project's real image sequence:

1. Save the images as `assets/projects/<NN>-<behanceId>/<MM>.jpg`, numbered in the original order.
2. Fill that project's `media` array in the same order. Each item uses the same shape as `cover`:
   ```json
   { "src": "assets/projects/02-255162521/01.jpg",
     "source_url": "<where the file came from>",
     "width": 1400, "height": 1750,
     "alt": "<factual description>",
     "caption": "<optional, only if it's in the source>" }
   ```
   - `src` must be relative (no leading `/`).
   - `width` and `height` must be the file's real pixel size, because layout and aspect ratios depend on them.
3. Set `description` to the project text, verbatim from the source. Update `detail_status` and `detail_note`.
4. The detail view and lightbox pick up the new media automatically; the notice disappears once `media` is non-empty.

**Warning:** `tools/build_content.py` regenerates `content.json` from the
snapshot with empty `media` and `description`. Don't re-run it after adding media
by hand, or the media will be erased. If you need to rebuild, change the tool to
keep the existing values first.

## Keep dist in sync

`dist/portfolio-wiktoria/` is a copy, not a build cache. After **any** change to
`index.html`, `css/`, `js/`, `content.json` or `assets/`, run:

```sh
python3 -I tools/export.py
```

Then run the tests if you can:

```sh
pip install playwright && playwright install chromium
python3 tests/site_test.py http://127.0.0.1:8000
python3 tests/site_test.py http://127.0.0.1:8001/portfolio-wiktoria \
  --site-dir dist/portfolio-wiktoria --shot-prefix subpath- --results tests/results-subpath.txt
```

The first test command needs the repo root served on port 8000. The second needs `dist/` served on port 8001.

## Rules

- **No invented content.** Titles, descriptions, credits, contact details and
  artwork must come from Wiktoria's own published material. Never add placeholder
  or stand-in images presented as real work.
  - Record anything missing in SOURCE_GAPS.md, not in made-up copy.
  - Alt text stays factual.
- **Respect access controls.** Don't use Behance private or internal APIs, and
  don't work around bot challenges.
- **Never commit secrets.** Keep credentials, tokens and `.env*` files out of the repo; `.gitignore` already excludes `.env*`.
- **No deploys without Jakub's explicit OK.** That includes uploads, publishing
  `dist/`, and pushing to any remote. Also don't send messages or make purchases on anyone's behalf.
