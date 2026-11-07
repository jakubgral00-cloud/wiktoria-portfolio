# Source gaps

**Update 2026-11-07 (later the same day):** the gaps below are closed. The
profile and all 71 project pages were opened in a normal (non-headless) browser
session, which loads them like any visitor. The project list, tags, publish dates
and full image sequences (369 images) were read from each page's embedded data
into `source/behance_projects.json`, and `tools/import_behance.py` built
`content.json` from it.

Still not available, because Behance has none for these projects: project
descriptions, image captions and credits. Behance stats (views, appreciations,
followers) are left out on purpose.

The original notes follow for reference.

---


Source: https://www.behance.net/wiktoriawolniak (public profile), inspected 2026-11-07.

What **was** readable: the public profile page (HTTP 200). Its embedded JSON
(`script#beconfig-store_state`) gave the profile name, occupation, location,
"ABOUT ME" text, social links, avatar, and the first 12 projects (titles, order,
URLs, publish dates, cover images). The cover images and avatar were downloaded
from Behance's public CDN (`mir-s3-cdn-cf.behance.net`, `pps.services.adobe.com`).

## 1. Project pages: not readable (all 12)

Every project page (`https://www.behance.net/gallery/<id>/<slug>`) returned
**HTTP 403 with a JavaScript bot challenge** (a page that sets a
`js_challenge_value` cookie and reloads). The same happened with:

- `curl` (plain GET, browser user agent), tried on several projects at different times
- WebFetch → HTTP 403
- Headless Chrome (Playwright) → `net::ERR_HTTP_RESPONSE_CODE_FAILURE`

The challenge was **not** bypassed: no cookie replay, no stealth browser, no
private API. As a result, these are **missing for every project**:

| Missing | Effect on the site |
|---|---|
| Project description / text blocks | Not shown. `description: null` in `content.json`. |
| Media sequence (images, videos, embeds, in order) | Not shown. `media: []`. The detail page shows only the profile cover image, labelled as such, plus a notice and a link to the original project. |
| Credits, tools, tags, creative fields | Not shown. |

Affected projects (Behance profile order):

1. BohaterON — https://www.behance.net/gallery/257199233/BohaterON
2. Magdalena Lamparska — https://www.behance.net/gallery/255162521/Magdalena-Lamparska
3. Empik Go - „Ania z Zielonego Wzgórza” — https://www.behance.net/gallery/252142005/Empik-Go-Ania-z-Zielonego-Wzgorza
4. Xiaomi — https://www.behance.net/gallery/252141819/Xiaomi
5. Neboa — https://www.behance.net/gallery/250195061/Neboa
6. Kampania społeczna "Crystal Palace" x A.M.Wesołowska — https://www.behance.net/gallery/249801397/Kampania-spoleczna-Crystal-Palace-x-AMWesolowska
7. Kampania społeczna "Crystal Palace" x J. Błaszczykowski — https://www.behance.net/gallery/249800959/Kampania-spoleczna-Crystal-Palace-x-J-Blaszczykowski
8. Empik Go — https://www.behance.net/gallery/248962659/Empik-Go
9. Blu x Warner Music — https://www.behance.net/gallery/246087983/Blu-x-Warner-Music
10. Sanprobi Premium — https://www.behance.net/gallery/246087827/Sanprobi-Premium
11. SONBIRD - stylizacje do klipów — https://www.behance.net/gallery/246087497/SONBIRD-stylizacje-do-klipow
12. Przemek Kucyk - „Kucyk” — https://www.behance.net/gallery/246087249/Przemek-Kucyk-Kucyk

**How to fill this gap:** fill in each project's `media` array (and `description`)
in `content.json`, using material from the artist or from the project pages in a
normal browser. Media items use the same shape as `cover`
(`src`, `source_url`, `width`, `height`, `alt`, optional `caption`). The detail
view and lightbox will show them in array order, and the "not retrieved" notice
disappears on its own.

## 2. Project list: incomplete

The profile data reports `hasMore: true` after the 12 listed projects. Behance
loads the rest on scroll through its internal API, which was not used.

- `?page=2` returned the same 12 projects.
- `https://www.behance.net/wiktoriawolniak/projects` → HTTP 403 (same challenge).

The number and titles of older projects are therefore **unknown**. The home page
says it shows the 12 most recent projects and links to Behance for the rest.

## 3. Other notes

- **Facebook link malformed.** The profile lists
  `http://facebook.com/Wiktoria Wolniak-Czupajło` (contains a space, not a valid
  URL). It is recorded in `content.json` (`valid_url: false`) but not rendered.
- **Name.** The brief says "Wiktoria Wolniak". The Behance display name is
  **"Wiktoria Wolniak-Gral"**, and the site uses it.
- **About text** is used verbatim, including the `I` separators
  (`FASHION I COMMERCIAL I …`). The e-mail line is shown as a mailto link instead
  of plain text.
- **Cover images** are Behance's cover crops at 808×632, the largest size the CDN
  offers for covers (`/projects/original/` is also 808×632). They may be crops of
  larger project images that could not be reached (see 1).
- **Alt text** is factual ("Cover image of the project “…”") and does not
  describe what is in each image. No source text was available, and describing
  people or brands would risk inventing content.
- **No banner image**: the profile's `bannerImageUrl` is empty.
- **Avatar** is available only up to 276×276 px.
- **Dates** come from each project's `publishedOn` timestamp, converted to a UTC date.
