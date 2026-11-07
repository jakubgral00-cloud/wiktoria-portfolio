"""End-to-end checks + screenshots for the portfolio.

Usage (with the site served at BASE, default http://127.0.0.1:8765):
    python3 tests/site_test.py [BASE]
Subpath export (serve dist/ and test the site under /portfolio-wiktoria/):
    python3 tests/site_test.py http://127.0.0.1:8766/portfolio-wiktoria \
        --site-dir dist/portfolio-wiktoria --shot-prefix subpath- --results tests/results-subpath.txt
Requires the `playwright` Python package; uses /usr/bin/google-chrome if the
bundled Playwright browser is not installed.
"""
import argparse
import json
import os
import sys
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser()
ap.add_argument("base", nargs="?", default="http://127.0.0.1:8765")
ap.add_argument("--site-dir", default=ROOT, help="folder whose content.json is being served")
ap.add_argument("--shot-prefix", default="", help="prefix for screenshot file names")
ap.add_argument("--results", default=os.path.join(ROOT, "tests", "results.txt"))
args = ap.parse_args()
BASE = args.base.rstrip("/")
BASE_PATH = urlparse(BASE).path  # "" when served at the server root
PREFIX = args.shot_prefix
SHOTS = os.path.join(ROOT, "screenshots")
os.makedirs(SHOTS, exist_ok=True)
content = json.load(open(os.path.join(args.site_dir, "content.json"), encoding="utf-8"))
projects = content["projects"]

results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail else ""))


def launch(p):
    try:
        return p.chromium.launch()
    except Exception:
        return p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])


def wait_images(page, sel="main img"):
    page.wait_for_function(
        f"() => [...document.querySelectorAll('{sel}')].filter(i => i.loading !== 'lazy' || i.getBoundingClientRect().top < innerHeight)"
        ".every(i => i.complete && i.naturalWidth > 0)", timeout=15000)


def load_all_images(page):
    page.evaluate("() => document.querySelectorAll('img[loading=lazy]').forEach(i => i.loading = 'eager')")
    page.wait_for_function("() => [...document.querySelectorAll('main img')].every(i => i.complete && i.naturalWidth > 0)", timeout=20000)


def image_audit(page, label):
    data = page.evaluate("""() => [...document.querySelectorAll('main img')].map(i => {
        const r = i.getBoundingClientRect();
        return {src: i.getAttribute('src'), alt: i.getAttribute('alt'), nw: i.naturalWidth, nh: i.naturalHeight, w: r.width, h: r.height};
    })""")
    missing_alt = [d["src"] for d in data if not (d["alt"] or "").strip()]
    check(f"{label}: all images have alt text", not missing_alt, ", ".join(missing_alt))
    bad_ratio = [d["src"] for d in data
                 if d["nw"] and d["w"] and abs(d["w"] / d["h"] - d["nw"] / d["nh"]) > 0.01]
    check(f"{label}: rendered aspect ratios match source files", not bad_ratio and data, ", ".join(bad_ratio))
    broken = [d["src"] for d in data if not d["nw"]]
    check(f"{label}: no broken images", not broken, ", ".join(broken))


def no_overflow(page, label):
    sw, cw = page.evaluate("() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]")
    check(f"{label}: no horizontal overflow", sw <= cw, f"scrollWidth={sw} clientWidth={cw}")


def run(viewport_name, viewport):
    with sync_playwright() as p:
        browser = launch(p)
        ctx = browser.new_context(viewport=viewport, device_scale_factor=1,
                                  is_mobile=viewport["width"] < 600, has_touch=viewport["width"] < 600)
        page = ctx.new_page()
        errors, failed, external = [], [], []
        page.on("console", lambda m: m.type == "error" and errors.append(m.text))
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("requestfailed", lambda r: failed.append(r.url))
        page.on("response", lambda r: r.status >= 400 and failed.append(f"{r.status} {r.url}"))
        page.on("request", lambda r: urlparse(r.url).hostname not in ("127.0.0.1", "localhost") and external.append(r.url))
        outside = []  # local requests that escaped the base path
        page.on("request", lambda r: urlparse(r.url).hostname in ("127.0.0.1", "localhost")
                and not urlparse(r.url).path.startswith(BASE_PATH + "/") and outside.append(r.url))
        v = viewport_name

        if BASE_PATH:
            # Simulate a host that serves the directory index without adding the
            # trailing slash: the page's inline guard must redirect to BASE/.
            index_html = open(os.path.join(args.site_dir, "index.html"), encoding="utf-8").read()
            page.route(BASE, lambda r: r.fulfill(status=200, content_type="text/html", body=index_html))
            page.goto(BASE, wait_until="domcontentloaded")
            page.wait_for_url(BASE + "/", timeout=10000)
            page.unroute(BASE)
            check(f"[{v}] URL without trailing slash is redirected into the base path", page.url == BASE + "/", page.url)
            # Before the guard redirects, the no-slash load may request /css or /js at the
            # server root; those are expected here, so reset the trackers.
            for lst in (outside, failed, errors):
                lst.clear()

        # Home
        page.goto(BASE + "/", wait_until="networkidle")
        page.wait_for_selector(".card")
        wait_images(page)
        titles = page.locator(".card__title").all_inner_texts()
        check(f"[{v}] home lists all manifest projects in Behance order",
              titles == [x["title"] for x in projects], f"{len(titles)} cards")
        hrefs = page.eval_on_selector_all(".card a", "els => els.map(e => e.getAttribute('href'))")
        check(f"[{v}] home cards link to detail routes",
              hrefs == [f"#/project/{x['slug']}" for x in projects])
        cols = page.evaluate("() => getComputedStyle(document.querySelector('.grid')).gridTemplateColumns.split(' ').length")
        check(f"[{v}] grid columns", cols == (3 if viewport['width'] >= 1000 else 1), f"{cols} columns")
        page.screenshot(path=os.path.join(SHOTS, f"{PREFIX}{v}-home.png"))
        load_all_images(page)
        image_audit(page, f"[{v}] home")
        no_overflow(page, f"[{v}] home")
        page.screenshot(path=os.path.join(SHOTS, f"{PREFIX}{v}-home-full.png"), full_page=True)
        body = page.inner_text("body").lower()
        platform_ui = [w for w in ("appreciate", "log in", "sign up", "follow", "likes", "views") if w in body]
        check(f"[{v}] no Behance platform UI text", not platform_ui, ", ".join(platform_ui))

        # Keyboard: Tab to first card and open it with Enter
        page.keyboard.press("Tab")  # skip link
        focused = page.evaluate("() => document.activeElement.className")
        check(f"[{v}] first Tab lands on skip link", "skip-link" in focused, focused)
        page.locator(".card a").first.focus()
        page.keyboard.press("Enter")
        page.wait_for_selector(".project__title")
        check(f"[{v}] Enter on card opens project detail",
              page.inner_text(".project__title") == projects[0]["title"])
        check(f"[{v}] in-app navigation stays under the base path",
              page.url == f"{BASE}/#/project/{projects[0]['slug']}", page.url)
        check(f"[{v}] focus moves to project heading on navigation",
              page.evaluate("() => document.activeElement.id") == "project-title")
        page.reload(wait_until="networkidle")
        page.wait_for_selector(".project__title")
        check(f"[{v}] reloading a deep link renders the same project",
              page.inner_text(".project__title") == projects[0]["title"])

        # Every project detail
        for i, proj in enumerate(projects):
            page.goto(f"{BASE}/#/project/{proj['slug']}", wait_until="networkidle")
            page.wait_for_selector(".project__title")
            wait_images(page)
            ok_title = page.inner_text(".project__title") == proj["title"]
            srcs = page.eval_on_selector_all(".media img", "els => els.map(e => e.getAttribute('src'))")
            expected = [m["src"] for m in proj["media"]] or [proj["cover"]["src"]]
            ok_link = page.get_attribute(".source-link", "href") == proj["source_url"]
            check(f"[{v}] detail {i + 1:02d} {proj['slug']}: title, media order, source link",
                  ok_title and srcs == expected and ok_link)
            if i == 0:
                image_audit(page, f"[{v}] detail")
                no_overflow(page, f"[{v}] detail")
                page.screenshot(path=os.path.join(SHOTS, f"{PREFIX}{v}-project.png"), full_page=True)

        # Pager order
        page.goto(f"{BASE}/#/project/{projects[1]['slug']}", wait_until="networkidle")
        page.wait_for_selector(".pager")
        check(f"[{v}] pager prev/next follow manifest order",
              page.get_attribute(".pager__prev", "href") == f"#/project/{projects[0]['slug']}"
              and page.get_attribute(".pager__next", "href") == f"#/project/{projects[2]['slug']}")

        # Lightbox via keyboard
        btn = page.locator(".media__btn").first
        btn.focus()
        page.keyboard.press("Enter")
        page.wait_for_selector("dialog.lightbox[open]")
        wait_images(page, ".lightbox__img")
        check(f"[{v}] lightbox opens with Enter and is modal",
              page.evaluate("() => document.querySelector('dialog.lightbox').matches(':modal')"))
        check(f"[{v}] lightbox moves focus to Close button",
              page.evaluate("() => document.activeElement.classList.contains('lightbox__close')"))
        alt = page.get_attribute(".lightbox__img", "alt")
        check(f"[{v}] lightbox image has alt text", bool(alt and alt.strip()), alt)
        page.screenshot(path=os.path.join(SHOTS, f"{PREFIX}{v}-lightbox.png"))
        page.keyboard.press("Tab")
        still_inside = page.evaluate("() => document.querySelector('dialog.lightbox').contains(document.activeElement)")
        check(f"[{v}] focus stays inside lightbox on Tab", still_inside)
        page.keyboard.press("Escape")
        page.wait_for_selector("dialog.lightbox:not([open])", state="attached")
        check(f"[{v}] Escape closes lightbox and returns focus to trigger",
              page.evaluate("() => document.activeElement.classList.contains('media__btn')"))

        # Multi-image lightbox navigation. No project currently has a retrieved media
        # sequence, so a test-only manifest (served via request interception, never
        # written to disk) gives project 1 three images to exercise arrow keys.
        fake = json.loads(json.dumps(content))
        c0 = fake["projects"][0]["cover"]
        fake["projects"][0]["media"] = [
            {**c0, "alt": "test image A"}, {**c0, "alt": "test image B"}, {**c0, "alt": "test image C"}]
        page.route("**/content.json", lambda r: r.fulfill(
            status=200, content_type="application/json", body=json.dumps(fake)))
        page.goto(f"{BASE}/?lbtest#/project/{projects[0]['slug']}", wait_until="networkidle")
        page.wait_for_selector(".media__btn")
        page.locator(".media__btn").nth(1).focus()
        page.keyboard.press("Enter")
        page.wait_for_selector("dialog.lightbox[open]")
        seq = [page.get_attribute(".lightbox__img", "alt")]
        page.keyboard.press("ArrowRight"); seq.append(page.get_attribute(".lightbox__img", "alt"))
        page.keyboard.press("ArrowRight"); seq.append(page.get_attribute(".lightbox__img", "alt"))
        page.keyboard.press("Home"); seq.append(page.get_attribute(".lightbox__img", "alt"))
        page.keyboard.press("ArrowLeft"); seq.append(page.get_attribute(".lightbox__img", "alt"))
        check(f"[{v}] lightbox arrow/Home keys step through media in order",
              seq == ["test image B", "test image C", "test image C", "test image A", "test image A"], str(seq))
        page.keyboard.press("Escape")
        page.unroute("**/content.json")

        # About
        page.goto(f"{BASE}/#/about", wait_until="networkidle")
        page.wait_for_selector(".about")
        wait_images(page)
        about = page.inner_text(".about")
        check(f"[{v}] about shows verbatim profile text",
              content["profile"]["about"]["text"].split("\n")[0] in about)
        mail = page.get_attribute(".contact a[href^='mailto:']", "href")
        check(f"[{v}] about shows public e-mail from profile", mail == f"mailto:{content['profile']['email']}")
        links = page.eval_on_selector_all(".contact a", "els => els.map(e => e.href)")
        check(f"[{v}] no broken Facebook link rendered", not any("facebook" in l for l in links))
        image_audit(page, f"[{v}] about")
        no_overflow(page, f"[{v}] about")
        page.screenshot(path=os.path.join(SHOTS, f"{PREFIX}{v}-about.png"), full_page=True)

        # 404
        page.goto(f"{BASE}/#/project/does-not-exist", wait_until="networkidle")
        check(f"[{v}] unknown project shows Not found", page.inner_text("h1") == "Not found")

        check(f"[{v}] no console/page errors", not errors, "; ".join(errors))
        check(f"[{v}] no failed requests", not failed, "; ".join(failed))
        check(f"[{v}] no external network requests", not external, "; ".join(external))
        check(f"[{v}] all local requests stay under {BASE_PATH or '/'}", not outside, "; ".join(outside))
        browser.close()


run("desktop-1440", {"width": 1440, "height": 900})
run("mobile-390", {"width": 390, "height": 844})

passed = sum(1 for r in results if r[1])
print(f"\n{passed}/{len(results)} checks passed")
with open(args.results, "w", encoding="utf-8") as f:
    for name, ok, detail in results:
        f.write(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail else "") + "\n")
    f.write(f"\n{passed}/{len(results)} checks passed\n")
sys.exit(0 if passed == len(results) else 1)
