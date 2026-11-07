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

`tools/deploy_ftp.sh <ftp-host> <ftp-user> <remote-dir>` uploads the export over
FTPS (e.g. to seohost.pl). It asks for the password and never stores it.
