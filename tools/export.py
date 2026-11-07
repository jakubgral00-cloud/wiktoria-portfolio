"""Copy the deployable site into dist/portfolio-wiktoria/ and verify it is base-path safe.

Usage: python3 -I tools/export.py [out_dir]   (default: dist/portfolio-wiktoria)

Only runtime files are copied (no tests, tools, source snapshot, screenshots or
reports). The site uses relative URLs only, so the folder works under any base
path. This script fails if it finds a root-absolute URL or a missing asset.
"""
import json
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "dist", "portfolio-wiktoria"))
FILES = ["index.html", "content.json"]
DIRS = ["css", "js", "assets"]

dist_root = os.path.join(ROOT, "dist")
if os.path.commonpath([OUT, dist_root]) != dist_root:
    sys.exit(f"refusing to write outside {dist_root}: {OUT}")
if os.path.exists(OUT):
    shutil.rmtree(OUT)
os.makedirs(OUT)

for f in FILES:
    shutil.copy2(os.path.join(ROOT, f), os.path.join(OUT, f))
for d in DIRS:
    shutil.copytree(os.path.join(ROOT, d), os.path.join(OUT, d))

problems = []

# Root-absolute or protocol-relative references in HTML/CSS/JS would break under a base path.
absolute = re.compile(r"""(?:href|src)\s*=\s*["']/|url\(\s*["']?/|fetch\(\s*["']/""")
for rel in ["index.html", "css/styles.css", "js/app.js"]:
    text = open(os.path.join(OUT, rel), encoding="utf-8").read()
    for m in absolute.finditer(text):
        line = text.count("\n", 0, m.start()) + 1
        problems.append(f"{rel}:{line}: root-absolute URL")

# Every local path in the manifest must be relative and exist in the export.
content = json.load(open(os.path.join(OUT, "content.json"), encoding="utf-8"))
images = [content["profile"]["avatar"]]
for p in content["projects"]:
    images.append(p["cover"])
    images.extend(p["media"])
for img in images:
    src = img["src"]
    if src.startswith("/") or "://" in src:
        problems.append(f"content.json: non-relative src {src}")
    elif not os.path.isfile(os.path.join(OUT, src)):
        problems.append(f"content.json: missing file {src}")

if problems:
    print("\n".join(problems))
    sys.exit(1)

count = sum(len(files) for _, _, files in os.walk(OUT))
size = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, files in os.walk(OUT) for f in files)
print(f"exported {count} files ({size / 1024 / 1024:.1f} MB) to {os.path.relpath(OUT, ROOT)}; {len(images)} image refs verified")
