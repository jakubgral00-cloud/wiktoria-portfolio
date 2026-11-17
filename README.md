# Wiktoria Wolniak-Gral — portfolio

Static portfolio site (HTML, CSS, vanilla JS, no build step) for the freelance
stylist Wiktoria Wolniak-Gral. Content comes from the public Behance profile
https://www.behance.net/wiktoriawolniak. All content is listed in
`content.json`, with source URLs.

## Run locally

```sh
python3 -m http.server 8000
```

Open http://localhost:8000. A server is required: the page loads `content.json`
with `fetch`, so opening `index.html` directly from disk will not work.

## Static export

`dist/portfolio-wiktoria/` is a deployment-ready copy for the base path
`/portfolio-wiktoria/`. Its URLs are all relative and its routing is hash-based.

Regenerate it after any change to the site:

```sh
python3 -I tools/export.py
```

Preview it under its base path:

```sh
cd dist && python3 -m http.server 8000
```

Then open http://localhost:8000/portfolio-wiktoria/.

## Content

All 71 projects from the Behance profile, in Behance order, each with its full
image sequence. See [SOURCE_GAPS.md](SOURCE_GAPS.md) for how they were sourced
and `tools/import_behance.py` to rebuild `content.json`.

## Deploy

Live on Netlify: https://wiktoria-wolniak-gral.netlify.app (project
`wiktoria-wolniak-gral`, ID `d013c29e-ebe1-4800-8439-fbcd30d3a703`), deployed from
this repo's `main` branch (see *Netlify setup* below). A manual deploy also works but
must include the functions, so pushing to `main` is simpler:

```sh
python3 -I tools/export.py
netlify deploy --prod --dir dist/portfolio-wiktoria --functions netlify/functions --site d013c29e-ebe1-4800-8439-fbcd30d3a703
```

Alternative (seohost etc., static only, no admin panel):

`tools/deploy_ftp.sh <ftp-host> <ftp-user> <remote-dir>` uploads the export over
FTPS (e.g. to seohost.pl). It asks for the password and never stores it.

## Admin panel (`/admin`)

Wiktoria edits the site at **https://wiktoria-wolniak-gral.netlify.app/admin** (phone or laptop):
texts, header/footer, links, the About photo and text, projects (add, delete, reorder by
drag and drop, edit title/date/tags/description), each project's photos (upload, reorder,
caption, choose the cover) and fonts for headings and body text (Satoshi + 100 Google Fonts,
list in `js/fonts.js`). Every save keeps a dated backup ("Kopie" tab).

How it works:

| Path | What |
|---|---|
| `admin/` | The panel (login screen + editor), plain HTML/CSS/JS, SortableJS from cdnjs |
| `netlify/functions/login.mjs` | `POST /api/login` — checks `ADMIN_EMAIL` / `ADMIN_PASSWORD`, returns a 30-day signed token |
| `netlify/functions/content.mjs` | `GET/PUT /api/content` — the site content in Netlify Blobs (store `site-content`) + history |
| `netlify/functions/upload.mjs` | `POST /api/upload` — stores photos in Netlify Blobs (store `media`); the panel shrinks them first |
| `netlify/functions/media.mjs` | `GET /media/<key>` — serves uploaded photos |
| `netlify/lib/auth.mjs` | Token signing and credential check |

The site reads `/api/content` first and falls back to the bundled `content.json`
until the first save (and when previewed without Netlify Functions).

### Netlify setup (once)

1. Netlify → the `wiktoria-wolniak-gral` project → *Project configuration → Build & deploy →
   Link repository* → GitHub → `jakubgral00-cloud/wiktoria-portfolio`, branch `main`.
   Build settings come from `netlify.toml` (command `python3 -I tools/export.py`,
   publish `dist/portfolio-wiktoria`, functions `netlify/functions`).
2. *Project configuration → Environment variables* → add
   `ADMIN_EMAIL` (Wiktoria's login e-mail) and `ADMIN_PASSWORD` (a long password).
   Optional: `SESSION_SECRET` (any long random string). Changing the password logs out every device.
3. *Deploys → Trigger deploy* (env changes need a new deploy).

After that every push to `main` deploys automatically. Content edited in the panel is
stored in Netlify Blobs, not in git, so a deploy never overwrites Wiktoria's changes.
