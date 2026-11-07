"""Fetch the public Behance profile page and save the embedded profile data.

Usage: python3 -I tools/fetch_profile.py source/profile_snapshot.json

Does a single plain GET of the public profile page and reads the JSON that the
page embeds (script#beconfig-store_state). Only the profile + project-list
parts are kept. It does not call Behance APIs or answer bot challenges; if the
page is not served normally, it stops with an error.
"""
import datetime as dt
import html
import json
import re
import sys
import urllib.request

URL = "https://www.behance.net/wiktoriawolniak"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"

req = urllib.request.Request(URL, headers={"User-Agent": UA})
with urllib.request.urlopen(req, timeout=60) as r:
    page = r.read().decode("utf-8")

m = re.search(r'<script type="application/json" id="beconfig-store_state"[^>]*>(.*?)</script>', page, re.S)
if not m:
    sys.exit("Embedded profile data not found (page may be a challenge/error page).")
raw = m.group(1)
state = json.loads(html.unescape(raw) if raw.lstrip().startswith("&") else raw)

snapshot = {
    "fetched_at": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
    "url": URL,
    "profile": {
        "user": state["profile"]["user"],
        "activeSection": {"work": {k: state["profile"]["activeSection"]["work"][k]
                                   for k in ("profileProjects", "hasMore", "cursor", "profileSections")}},
    },
}
with open(sys.argv[1], "w", encoding="utf-8") as f:
    json.dump(snapshot, f, ensure_ascii=False, indent=1)
print(f"saved {len(snapshot['profile']['activeSection']['work']['profileProjects'])} projects")
