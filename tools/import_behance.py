"""Build content.json from source/behance_projects.json and download the images.

source/behance_projects.json holds every project on the public Behance profile
(title, URL, publish date, tags, cover and the ordered image sequence), read in
a normal browser session from each project page's embedded page data.

Usage: python3 -I tools/import_behance.py
Images already on disk are not downloaded again.
"""
import json
import re
import subprocess
import sys
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "source" / "behance_projects.json"
CONTENT = ROOT / "content.json"
CDN = "https://mir-s3-cdn-cf.behance.net/"


def slugify(text):
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "project"


def jpeg_size(path):
    """Return (width, height) of a JPEG or PNG file without third-party libraries."""
    data = path.read_bytes()
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return int.from_bytes(data[16:20], "big"), int.from_bytes(data[20:24], "big")
    i = 2
    while i < len(data):
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
            return int.from_bytes(data[i + 7:i + 9], "big"), int.from_bytes(data[i + 5:i + 7], "big")
        i += 2 + int.from_bytes(data[i + 2:i + 4], "big")
    raise ValueError(f"no size marker in {path}")


def download(job):
    url, dest = job
    if dest.exists() and dest.stat().st_size > 0:
        return None
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not url.startswith(CDN):
        return f"skipped non-CDN url {url}"
    r = subprocess.run(["curl", "-sSfL", "--retry", "3", "-o", str(dest), url], capture_output=True, text=True)
    return None if r.returncode == 0 else f"{url}: {r.stderr.strip()}"


def main():
    src = json.loads(SRC.read_text())
    content = json.loads(CONTENT.read_text())
    projects, jobs, used = [], [], set()

    for order, p in enumerate(src["projects"], 1):
        base = slugify(p["title"])
        slug = base if base not in used else f"{base}-{p['id']}"
        used.add(slug)
        key = f"{order:02d}-{p['id']}"
        cover_path = f"assets/covers/{key}.jpg"
        jobs.append((p["cover"], ROOT / cover_path))
        media = []
        for n, m in enumerate(p["modules"], 1):
            ext = ".png" if m["src"].lower().endswith(".png") else ".jpg"
            path = f"assets/projects/{key}/{n:02d}{ext}"
            jobs.append((m["src"], ROOT / path))
            media.append({"src": path, "source_url": m["src"], "alt": f"„{p['title']}” — image {n} of {len(p['modules'])}",
                          **({"caption": m["caption"]} if m.get("caption") else {})})
        published = datetime.fromtimestamp(p["publishedOn"], timezone.utc).date().isoformat()
        projects.append({
            "order": order, "behance_id": p["id"], "title": p["title"], "slug": slug,
            "source_url": p["url"], "published_on": published, "dominant_color": p.get("color"),
            "tags": p.get("tags", []),
            "cover": {"src": cover_path, "source_url": p["cover"], "alt": f"Cover image of the project „{p['title']}”"},
            "description": p.get("description") or None,
            "media": media,
            "detail_status": "complete",
        })

    with ThreadPoolExecutor(8) as pool:
        errors = [e for e in pool.map(download, jobs) if e]
    if errors:
        print("\n".join(errors), file=sys.stderr)
        sys.exit(1)

    for p in projects:
        for img in [p["cover"], *p["media"]]:
            img["width"], img["height"] = jpeg_size(ROOT / img["src"])

    content["generated_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    content["source"]["method"] = (
        "Profile data: plain HTTP GET of the public profile page. Project list and project pages: "
        "read in a normal browser session (embedded page data). Images downloaded from Behance's public CDN."
    )
    content["source"]["profile_list_complete"] = True
    content["source"]["profile_list_note"] = f"All {len(projects)} projects on the public profile, in Behance order ({src['fetched_at'][:10]})."
    content["projects"] = projects
    CONTENT.write_text(json.dumps(content, ensure_ascii=False, indent=2) + "\n")
    print(f"{len(projects)} projects, {sum(len(p['media']) for p in projects)} images → content.json")


if __name__ == "__main__":
    main()
