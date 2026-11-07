"""Build content.json + download public assets from the saved Behance profile state.

Usage: python3 -I tools/build_content.py source/profile_snapshot.json .
"""
import datetime as dt
import json
import os
import re
import sys
import unicodedata
import urllib.request

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
PROFILE_URL = "https://www.behance.net/wiktoriawolniak"

state_path, site = sys.argv[1], sys.argv[2]
state = json.load(open(state_path, encoding="utf-8"))
user = state["profile"]["user"]
work = state["profile"]["activeSection"]["work"]


def slugify(s):
    s = s.replace("ł", "l").replace("Ł", "L")
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def jpeg_size(path):
    with open(path, "rb") as f:
        data = f.read()
    i = 2
    while i < len(data):
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        if marker in (0xC0, 0xC1, 0xC2):
            h = int.from_bytes(data[i + 5:i + 7], "big")
            w = int.from_bytes(data[i + 7:i + 9], "big")
            return w, h
        seg = int.from_bytes(data[i + 2:i + 4], "big")
        i += 2 + seg
    raise ValueError("no SOF in " + path)


def download(url, dest):
    if not os.path.exists(dest):
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=60) as r:
            if r.status != 200:
                raise RuntimeError(f"{url} -> {r.status}")
            open(dest, "wb").write(r.read())
    return dest


os.makedirs(os.path.join(site, "assets", "covers"), exist_ok=True)
os.makedirs(os.path.join(site, "assets", "profile"), exist_ok=True)

# Avatar (largest public size listed in the profile state)
avatar_src = max(user["images"]["allAvailable"], key=lambda a: a["width"] or 0)
avatar_rel = "assets/profile/avatar.jpg"
download(avatar_src["url"], os.path.join(site, avatar_rel))
aw, ah = jpeg_size(os.path.join(site, avatar_rel))

about = next((c for c in user.get("customSections", []) if c["title"] == "ABOUT ME"), None)
about_text = about["value"].strip() if about else None
email = None
if about_text:
    m = re.search(r"[\w.+-]+@[\w-]+\.[\w.]+", about_text)
    email = m.group(0) if m else None

socials = []
for s in user.get("socialReferences", []):
    socials.append({
        "service": s["socialService"],
        "url_as_listed": s["url"],
        "valid_url": " " not in s["url"],
    })

projects = []
for order, p in enumerate(work["profileProjects"], start=1):
    cover = next(a for a in p["covers"]["allAvailable"] if a["type"] == "JPG" and "/projects/original/" in a["url"])
    rel = f"assets/covers/{order:02d}-{p['id']}.jpg"
    download(cover["url"], os.path.join(site, rel))
    w, h = jpeg_size(os.path.join(site, rel))
    projects.append({
        "order": order,
        "behance_id": p["id"],
        "title": p["name"],
        "slug": slugify(p["name"]) or str(p["id"]),
        "source_url": p["url"],
        "published_on": dt.datetime.fromtimestamp(p["publishedOn"], dt.timezone.utc).date().isoformat(),
        "dominant_color": "#{r:02x}{g:02x}{b:02x}".format(**p["colors"]),
        "cover": {
            "src": rel,
            "source_url": cover["url"],
            "width": w,
            "height": h,
            "alt": f"Cover image of the project “{p['name']}”",
            "role": "profile grid cover (as shown on the Behance profile)",
        },
        "description": None,
        "media": [],
        "detail_status": "unavailable",
        "detail_note": "Project page returned HTTP 403 with a JavaScript bot challenge; description and media sequence not retrieved. See SOURCE_GAPS.md.",
    })

# Guard against duplicate slugs
seen = {}
for p in projects:
    if p["slug"] in seen:
        p["slug"] = f"{p['slug']}-{p['behance_id']}"
    seen[p["slug"]] = True

content = {
    "generated_at": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
    "source": {
        "profile_url": PROFILE_URL,
        "method": "Plain HTTP GET of the public profile page; data read from its embedded JSON (script#beconfig-store_state). Images downloaded from the public CDN URLs listed there.",
        "profile_list_complete": not work["hasMore"],
        "profile_list_note": "The public profile page lists the first 12 projects and reports more exist (hasMore=true). The remaining ones load through Behance's internal API, which was not used." if work["hasMore"] else None,
    },
    "profile": {
        "display_name": user["displayName"],
        "first_name": user.get("firstName"),
        "occupation": user.get("occupation"),
        "company": user.get("company"),
        "location": user.get("location"),
        "website": user.get("website"),
        "about": {"title": about["title"], "text": about_text} if about else None,
        "email": email,
        "socials": socials,
        "avatar": {
            "src": avatar_rel,
            "source_url": avatar_src["url"],
            "width": aw,
            "height": ah,
            "alt": f"Profile photo of {user['displayName']}",
        },
    },
    "projects": projects,
}

with open(os.path.join(site, "content.json"), "w", encoding="utf-8") as f:
    json.dump(content, f, ensure_ascii=False, indent=2)
print(f"{len(projects)} projects, avatar {aw}x{ah}")
for p in projects:
    print(p["order"], p["slug"], p["cover"]["width"], p["cover"]["height"], p["published_on"])
