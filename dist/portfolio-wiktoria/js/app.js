(() => {
  "use strict";

  const main = document.getElementById("main");
  const nav = document.querySelector(".site-nav");
  let content = null;

  // ---------- helpers ----------
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value === null || value === undefined || value === false) continue;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value === true ? "" : value);
    }
    for (const child of children.flat()) {
      if (child === null || child === undefined || child === false) continue;
      node.append(child instanceof Node ? child : document.createTextNode(child));
    }
    return node;
  }

  function img(image, extra = {}) {
    return el("img", {
      src: image.src,
      alt: image.alt,
      width: image.width,
      height: image.height,
      decoding: "async",
      ...extra,
    });
  }

  const pad = (n) => String(n).padStart(2, "0");

  function formatDate(iso, withDay = false) {
    const [y, m, d] = iso.split("-").map(Number);
    const opts = withDay ? { day: "numeric", month: "long", year: "numeric" } : { month: "short", year: "numeric" };
    return new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "UTC" })
      .format(new Date(Date.UTC(y, m - 1, d)));
  }

  function setPage(title, current) {
    document.title = title;
    for (const a of nav.querySelectorAll("a")) {
      if (a.getAttribute("href") === current) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    }
  }

  // Focus moves to the new view's heading on in-app navigation only, so that on
  // first load the first Tab still reaches the skip link.
  let firstRender = true;
  function render(node, focusTarget) {
    if (scrollFx) { scrollFx(); scrollFx = null; }
    document.body.classList.toggle("is-home", node.classList.contains("home"));
    main.replaceChildren(node);
    window.scrollTo(0, 0);
    if (!firstRender) (focusTarget || main).focus({ preventScroll: true });
    firstRender = false;
  }

  // ---------- views ----------
  const httpsUrl = (url) => url.replace(/^http:/, "https:");

  function card(p, i) {
    return el("li", { class: "card" },
      el("a", { href: `#/project/${p.slug}`, "aria-label": `${p.title}, ${formatDate(p.published_on)}` },
        el("div", { class: "card__frame", style: p.dominant_color ? `background-color:${p.dominant_color}` : null },
          img(p.cover, { alt: "", loading: i < 12 ? "eager" : "lazy" })),
        el("div", { class: "card__caption", "aria-hidden": "true" },
          el("h3", { class: "card__title", text: p.title }),
          el("p", { class: "card__meta", text: formatDate(p.published_on) }))
      )
    );
  }

  // ---------- home: hero + gallery motion ----------
  const motionOK = "animate" in Element.prototype &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let introPlayed = false;
  let scrollFx = null;          // the active scroll handler (home page only)
  const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
  const rand = (min, max) => min + Math.random() * (max - min);
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  // Load: photos fly in in 3D from different sides in random order, "Portfolio [→]"
  // is typed like on a keyboard, then the name fades in.
  function playHeroIntro(hero) {
    const photos = [...hero.querySelectorAll(".hero__photo > img")];
    const sides = shuffle(["left", "right", "top", "bottom"]);
    shuffle(photos.map((p, i) => i)).forEach((photoIndex, order) => {
      const side = sides[photoIndex % sides.length];
      const [x, y, rx, ry] = {
        left: ["-80vw", "10vh", 20, -70], right: ["80vw", "-10vh", -20, 70],
        top: ["10vw", "-90vh", 70, 15], bottom: ["-10vw", "90vh", -70, -15],
      }[side];
      photos[photoIndex].animate([
        { transform: `translate3d(${x}, ${y}, 400px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rand(-25, 25)}deg)`, opacity: 0 },
        { opacity: 1, offset: 0.3 },
        { transform: "translate3d(0, 0, 0) rotateX(0) rotateY(0) rotateZ(0)", opacity: 1 },
      ], { duration: rand(1500, 1900), delay: 150 + order * rand(220, 320), easing: EASE, fill: "backwards" });
    });

    hero.querySelectorAll(".hero__label > span, .hero__scroll > span").forEach((node, i) => {
      node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 900, delay: 400 + i * 120, fill: "backwards" });
    });

    const typed = hero.querySelector(".hero__typed");
    const arrow = hero.querySelector(".hero__arrow");
    const caret = hero.querySelector(".hero__caret");
    const name = hero.querySelector(".hero__name > span");
    const word = "Portfolio";
    const arrowText = "[→]";
    typed.textContent = "";
    arrow.textContent = "";
    name.style.opacity = "0";
    let t = 650;
    [...word].forEach((ch, i) => {
      t += rand(85, 175);
      setTimeout(() => { typed.textContent = word.slice(0, i + 1); }, t);
    });
    t += 320;
    [...arrowText].forEach((ch, i) => {
      t += rand(110, 190);
      setTimeout(() => { arrow.textContent = arrowText.slice(0, i + 1); }, t);
    });
    setTimeout(() => {
      name.style.opacity = "";
      name.animate([{ opacity: 0, filter: "blur(6px)" }, { opacity: 1, filter: "blur(0)" }], { duration: 1400, easing: "ease-out" });
    }, t + 250);
    setTimeout(() => caret.classList.add("is-done"), t + 1300);
  }

  // One scroll gesture plays a slow, smooth, timed transition (it does not
  // follow the scroll position): the page glides down from the hero to the
  // gallery below it while the hero elements drift and fly up in random order
  // and the gallery photos fly in from the front, all at once. A fresh upward
  // gesture at the top of the gallery glides back and the hero elements return.
  // Past the top of the gallery the page scrolls normally.
  function setupHeroSwitch(hero, grid, startInGallery) {
    const SWAY = "cubic-bezier(0.65, 0, 0.35, 1)";
    const GLIDE_MS = 1700;
    const items = [...hero.querySelectorAll(".hero__item")];
    const cards = [...grid.querySelectorAll(".card")];
    const work = grid.closest(".work");
    let heroAnims = [];
    let busy = false;
    let gliding = false;
    let away = false;                 // hero elements have flown off
    let quietUntil = 0;
    let lastMoved = 0;

    const galleryTop = () => {
      let y = 0;
      for (let n = work; n; n = n.offsetParent) y += n.offsetTop;
      return y;
    };
    const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    function glideTo(target, ms) {
      return new Promise((resolve) => {
        const from = window.scrollY;
        const start = performance.now();
        gliding = true;
        function step(now) {
          const t = Math.min(1, (now - start) / ms);
          window.scrollTo(0, from + (target - from) * easeInOut(t));
          if (t < 1) requestAnimationFrame(step);
          else { gliding = false; resolve(); }
        }
        requestAnimationFrame(step);
      });
    }

    function flyHero(out, instant) {
      const previous = heroAnims;
      heroAnims = [];
      shuffle(items.map((_, i) => i)).forEach((idx, k) => {
        const dx = rand(-14, 14), rot = rand(-16, 16), drift = rand(3, 9);
        const a = items[idx].animate([
          { transform: "translate3d(0, 0, 0) rotate(0deg)" },
          { transform: `translate3d(${(dx * 0.15).toFixed(2)}vw, ${(-drift).toFixed(2)}vh, 0) rotate(${(rot * 0.2).toFixed(2)}deg)`, offset: 0.3 },
          { transform: `translate3d(${dx.toFixed(2)}vw, -110vh, 0) rotate(${rot.toFixed(2)}deg)` },
        ], { duration: rand(1300, 1600), delay: k * rand(35, 60), easing: SWAY, fill: "both", direction: out ? "normal" : "reverse" });
        if (instant) a.finish();
        heroAnims.push(a);
      });
      previous.forEach((a) => a.cancel());
      away = out;
      return Promise.all(heroAnims.map((a) => a.finished.catch(() => {})));
    }

    function flyCards() {
      const top = galleryTop();
      const vh = window.innerHeight;
      const shown = cards.filter((c) => {
        let y = 0;
        for (let n = c; n; n = n.offsetParent) y += n.offsetTop;
        return y < top + vh * 1.1;
      });
      return Promise.all(shown.map((c) => {
        c.classList.add("is-flying");
        const a = c.animate([
          { transform: `translate3d(${rand(-30, 30).toFixed(2)}vw, ${rand(-22, 14).toFixed(2)}vh, ${rand(650, 950).toFixed(0)}px) rotate(${rand(-12, 12).toFixed(2)}deg)`, opacity: 0 },
          { opacity: 1, offset: 0.35 },
          { transform: "translate3d(0, 0, 0) rotate(0deg)", opacity: 1 },
        ], { duration: rand(1700, 2100), delay: 250 + rand(0, 200), easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "backwards" });
        return a.finished.catch(() => {}).then(() => c.classList.remove("is-flying"));
      }));
    }

    async function goDown() {
      if (busy) return;
      busy = true;
      flyHero(true);
      flyCards();
      await glideTo(galleryTop(), GLIDE_MS);
      busy = false;
      quietUntil = performance.now() + 700;
    }
    async function goUp() {
      if (busy) return;
      busy = true;
      setTimeout(() => flyHero(false), 200);
      await glideTo(0, GLIDE_MS);
      busy = false;
      quietUntil = performance.now() + 700;
    }

    const canAct = () => !busy && performance.now() > quietUntil;
    const inHero = () => window.scrollY < galleryTop() - 4;
    // Only a fresh upward gesture at the gallery top goes back, not momentum.
    const atGalleryTop = () => Math.abs(window.scrollY - galleryTop()) <= 4 && performance.now() - lastMoved > 400;

    function onScroll() {
      if (gliding) return;
      lastMoved = performance.now();
      // Scrollbar drags and similar: keep the hero consistent with where the page is.
      if (!busy && inHero() && away && window.scrollY < galleryTop() * 0.5) flyHero(false);
      else if (!busy && !away && window.scrollY > galleryTop() * 0.5) flyHero(true, true);
    }
    function onWheel(e) {
      if (busy) { e.preventDefault(); return; }
      if (inHero()) {
        e.preventDefault();
        if (canAct() && e.deltaY > 4) goDown();
        else if (canAct() && e.deltaY < -4 && window.scrollY > 4) goUp();
      } else if (e.deltaY < -4 && atGalleryTop()) {
        e.preventDefault();
        if (canAct()) goUp();
      }
    }
    let touchY = null;
    const onTouchStart = (e) => { touchY = e.touches[0].clientY; };
    function onTouchMove(e) {
      if (touchY === null) return;
      if (busy) { e.preventDefault(); return; }
      const dy = e.touches[0].clientY - touchY;
      if (inHero()) {
        e.preventDefault();
        if (dy < -30 && canAct()) { touchY = null; goDown(); }
      } else if (dy > 40 && atGalleryTop() && canAct()) {
        e.preventDefault();
        touchY = null;
        goUp();
      }
    }
    function onKey(e) {
      if (e.target.closest && e.target.closest("input, textarea, dialog")) return;
      const down = ["ArrowDown", "PageDown", " ", "Spacebar"].includes(e.key);
      const up = ["ArrowUp", "PageUp", "Home"].includes(e.key);
      if (busy && (down || up)) { e.preventDefault(); return; }
      if (inHero() && down) { e.preventDefault(); if (canAct()) goDown(); }
      else if (up && atGalleryTop()) { e.preventDefault(); if (canAct()) goUp(); }
    }
    const button = hero.querySelector(".hero__scroll-btn");
    const onButton = () => { if (inHero() && canAct()) goDown(); };

    if (startInGallery) {
      flyHero(true, true);
      window.scrollTo(0, galleryTop());
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKey);
    button.addEventListener("click", onButton);
    return () => {
      heroAnims.forEach((a) => a.cancel());
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKey);
    };
  }

  function homeView() {
    const { profile, projects } = content;
    const photos = profile.hero_photos || [];
    const item = (cls, child) => el("div", { class: `hero__item ${cls}` }, child);
    const label = (cls, ...lines) => item(`hero__label ${cls}`,
      el("span", {}, ...lines.flatMap((l, i) => (i ? [el("br"), l] : [l]))));

    const hero = el("section", { class: "hero", "aria-labelledby": "hero-title" },
      el("div", { class: "hero__stage" },
        el("div", { class: "hero__lines", "aria-hidden": "true" }),
        photos.map((ph, i) => item(`hero__photo hero__photo--${i + 1}`,
          img(ph, { loading: "eager", fetchpriority: i < 2 ? "high" : null }))),
        item("hero__title-wrap",
          el("h1", { class: "hero__title", id: "hero-title", "aria-label": "Portfolio" },
            el("span", { class: "hero__typed", "aria-hidden": "true", text: "Portfolio" }),
            el("span", { class: "hero__arrow", "aria-hidden": "true", text: "[→]" }),
            el("span", { class: "hero__caret is-done", "aria-hidden": "true" }))),
        item("hero__name", el("span", { text: `( ${profile.display_name.replace("-", " - ")} )` })),
        label("hero__label--int", "Int."),
        label("hero__label--hash", "#"),
        label("hero__label--bl", profile.occupation, profile.location.split(",")[0]),
        label("hero__label--bc", "Fashion, commercial,", "music video"),
        label("hero__label--br", `01–${pad(projects.length)}.`),
        item("hero__scroll hero__label",
          el("span", {}, el("button", { class: "hero__scroll-btn", type: "button", "aria-label": "Show work", text: "( ↓ )" })))
      )
    );

    const grid = el("ul", { class: "grid", "aria-label": "Projects" }, projects.map(card));
    const view = el("div", { class: "home" }, hero, el("section", { class: "work", "aria-label": "Work" }, grid));

    setPage(`${profile.display_name} — ${profile.occupation}, ${profile.location}`, "#/");
    render(view);
    if (!motionOK) { hero.classList.add("hero--static"); return; }
    const returning = introPlayed;
    if (!introPlayed) {
      introPlayed = true;
      hero.querySelector(".hero__caret").classList.remove("is-done");
      playHeroIntro(hero);
    }
    // Coming back from a project page lands on the gallery, not the hero.
    scrollFx = setupHeroSwitch(hero, grid, returning);
  }

  function projectView(slug) {
    const { projects, profile } = content;
    const index = projects.findIndex((p) => p.slug === slug);
    if (index === -1) return notFoundView();
    const p = projects[index];

    // Image sequence in Behance order; fall back to the cover if none was imported.
    const items = p.media.length ? p.media : [p.cover];

    const title = el("h1", { class: "project__title", id: "project-title", tabindex: "-1", text: p.title });

    const head = el("header", { class: "project__head" },
      el("a", { class: "project__back", href: "#/", text: "← All work" }),
      title,
      el("p", { class: "project__owner" }, el("a", { href: "#/about", text: profile.display_name.replace("-", " - ") }))
    );

    const media = el("ol", { class: "media", "aria-label": `Images from ${p.title}` },
      items.map((item, i) =>
        el("li", {},
          el("figure", {},
            el("button", {
              class: "media__btn",
              type: "button",
              "aria-label": `View image ${i + 1} of ${items.length} full screen`,
              onclick: (e) => lightbox.open(items, i, e.currentTarget),
            }, img(item, { loading: i < 2 ? "eager" : "lazy" })),
            item.caption ? el("figcaption", { text: item.caption }) : null
          )
        )
      )
    );

    const info = el("section", { class: "project__info", "aria-label": "Project details" },
      el("div", {},
        el("h2", { text: p.title }),
        el("p", {}, "Published ", el("time", { datetime: p.published_on, text: formatDate(p.published_on, true) })),
        p.description ? el("p", { class: "project__desc", text: p.description }) : null,
        p.tags && p.tags.length ? el("ul", { class: "tags", "aria-label": "Tags" }, p.tags.map((t) => el("li", { text: t }))) : null
      ),
      el("a", { class: "source-link", href: p.source_url, rel: "noopener", text: "View on Behance ↗" })
    );

    // "More work": the next four projects, wrapping around the list.
    const more = [1, 2, 3, 4].map((k) => projects[(index + k) % projects.length]).filter((q) => q !== p);
    const moreSection = el("section", { class: "more", "aria-labelledby": "more-heading" },
      el("h2", { id: "more-heading", text: "More work" }),
      el("ul", { class: "grid" }, more.map((q) => card(q, 99)))
    );

    setPage(`${p.title} — ${profile.display_name}`, null);
    render(el("article", { class: "project", "aria-labelledby": "project-title" }, head, media, info, moreSection), title);
  }

  function aboutView() {
    const { profile } = content;
    const heading = el("h1", { tabindex: "-1", text: profile.display_name });

    const contacts = [];
    if (profile.email) {
      contacts.push(el("li", {}, el("span", { text: "E-mail" }),
        el("a", { href: `mailto:${profile.email}`, text: profile.email })));
    }
    for (const s of profile.socials) {
      if (!s.valid_url) continue;
      const url = s.url_as_listed.replace(/^http:/, "https:");
      contacts.push(el("li", {}, el("span", { text: s.service }),
        el("a", { href: url, rel: "noopener", text: url.replace(/^https?:\/\/(www\.)?/, "") })));
    }
    contacts.push(el("li", {}, el("span", { text: "Based in" }), el("span", { text: profile.location })));

    // The About text is shown verbatim, minus the e-mail line which is linked below.
    const aboutText = profile.about
      ? profile.about.text.split("\n").filter((l) => !/^e-mail:/i.test(l.trim())).join("\n").trim()
      : "";

    const section = el("section", { class: "about", "aria-labelledby": "about-heading" },
      el("div", {}, img(profile.avatar, { class: "about__photo" })),
      el("div", {},
        el("p", { class: "eyebrow", id: "about-heading", text: profile.about ? profile.about.title : "About" }),
        heading,
        aboutText ? el("p", { class: "about__text", text: aboutText }) : null,
        el("ul", { class: "contact", "aria-label": "Contact" }, contacts)
      )
    );

    setPage(`About — ${profile.display_name}`, "#/about");
    render(section, heading);
  }

  function notFoundView() {
    const heading = el("h1", { class: "project__title", tabindex: "-1", text: "Not found" });
    setPage(`Not found — ${content.profile.display_name}`, null);
    render(el("div", { class: "project" }, heading,
      el("p", {}, el("a", { href: "#/", text: "Back to all work" }))), heading);
  }

  function route() {
    const hash = location.hash.replace(/^#/, "") || "/";
    const match = hash.match(/^\/project\/([^/]+)\/?$/);
    if (match) projectView(decodeURIComponent(match[1]));
    else if (hash === "/about") aboutView();
    else if (hash === "/" || hash === "") homeView();
    else notFoundView();
  }

  // ---------- lightbox ----------
  const lightbox = (() => {
    const dialog = document.querySelector(".lightbox");
    const image = dialog.querySelector(".lightbox__img");
    const caption = dialog.querySelector(".lightbox__caption");
    const closeBtn = dialog.querySelector(".lightbox__close");
    const prevBtn = dialog.querySelector(".lightbox__prev");
    const nextBtn = dialog.querySelector(".lightbox__next");
    let items = [];
    let index = 0;
    let returnFocus = null;

    function show(i) {
      index = Math.max(0, Math.min(items.length - 1, i));
      const item = items[index];
      image.src = item.src;
      image.alt = item.alt;
      image.width = item.width;
      image.height = item.height;
      const text = item.caption || "";
      caption.textContent = items.length > 1 ? `${index + 1} / ${items.length}${text ? " — " + text : ""}` : text;
      const single = items.length < 2;
      prevBtn.hidden = nextBtn.hidden = single;
      prevBtn.disabled = index === 0;
      nextBtn.disabled = index === items.length - 1;
    }

    function open(list, i, trigger) {
      items = list;
      returnFocus = trigger || document.activeElement;
      show(i);
      dialog.showModal();
      closeBtn.focus();
    }

    function close() { dialog.close(); }

    dialog.addEventListener("close", () => {
      image.removeAttribute("src");
      if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
    });
    dialog.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); show(index - 1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); show(index + 1); }
      else if (e.key === "Home") { e.preventDefault(); show(0); }
      else if (e.key === "End") { e.preventDefault(); show(items.length - 1); }
      else if (e.key === "Tab") {
        // Keep keyboard focus cycling within the viewer's visible, enabled buttons.
        const focusable = [...dialog.querySelectorAll("button")].filter((b) => !b.hidden && !b.disabled);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    // Clicking the dark area outside the image closes the viewer.
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog || e.target.classList.contains("lightbox__inner")) close();
    });
    closeBtn.addEventListener("click", close);
    prevBtn.addEventListener("click", () => show(index - 1));
    nextBtn.addEventListener("click", () => show(index + 1));

    return { open, close };
  })();

  // ---------- boot ----------
  fetch("content.json")
    .then((r) => {
      if (!r.ok) throw new Error(`content.json: HTTP ${r.status}`);
      return r.json();
    })
    .then((data) => {
      content = data;
      window.addEventListener("hashchange", route);
      route();
    })
    .catch((err) => {
      main.replaceChildren(el("p", { class: "notice",
        text: `Could not load content (${err.message}). Serve this folder over HTTP, e.g. "python3 -m http.server".` }));
    });
})();
