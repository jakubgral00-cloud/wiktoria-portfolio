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

  // Scroll (both directions): hero elements drift, then fly up and away in a
  // random order; gallery photos fly in from the front as they come into view.
  function setupScrollFx(hero, grid) {
    const items = [...hero.querySelectorAll(".hero__item")].map((node) => ({
      node,
      delay: rand(0, 0.4),
      driftX: rand(-12, 12),
      rot: rand(-14, 14),
      depth: rand(0.4, 1.4),
    }));
    const cards = [...grid.querySelectorAll(".card")].map((node) => ({
      node, top: 0, last: -1,
      dx: rand(-28, 28), dy: rand(-20, 10), z: rand(600, 950), rot: rand(-10, 10), lag: rand(0, 0.12),
    }));
    const docTop = (el) => { let y = 0; for (; el; el = el.offsetParent) y += el.offsetTop; return y; };
    let heroRange = 1;
    function measure() {
      heroRange = Math.max(1, hero.offsetHeight - window.innerHeight);
      for (const c of cards) c.top = docTop(c.node);
    }

    let queued = false;
    function update() {
      queued = false;
      const sy = window.scrollY;
      const vh = window.innerHeight;
      const p = clamp01(sy / heroRange);
      for (const it of items) {
        const l = clamp01((p - it.delay) / 0.6);
        const e = l * l;
        const drift = -p * 7 * it.depth;
        it.node.style.transform = p === 0 ? "" :
          `translate3d(${(it.driftX * e).toFixed(2)}vw, ${(drift - e * 125).toFixed(2)}vh, 0) rotate(${(it.rot * e).toFixed(2)}deg)`;
      }
      for (const c of cards) {
        const top = c.top - sy;
        if (top > vh * 1.2 && c.last === 0) continue;             // far below, already hidden
        const r = clamp01(((vh - top) / (vh * 0.5)) - c.lag);
        const rounded = Math.round(r * 1000) / 1000;
        if (rounded === c.last) continue;
        c.last = rounded;
        if (rounded >= 1) {
          c.node.style.transform = "";
          c.node.style.opacity = "";
          c.node.classList.remove("is-flying");
          continue;
        }
        const k = 1 - Math.pow(1 - rounded, 3);
        const inv = 1 - k;
        c.node.classList.add("is-flying");
        c.node.style.opacity = clamp01(rounded * 2.2).toFixed(3);
        c.node.style.transform =
          `translate3d(${(c.dx * inv).toFixed(2)}vw, ${(c.dy * inv).toFixed(2)}vh, ${(c.z * inv).toFixed(1)}px) rotate(${(c.rot * inv).toFixed(2)}deg)`;
      }
    }
    const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
    const onResize = () => { measure(); onScroll(); };

    measure();
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    // Images and fonts can shift layout after the first measure.
    window.addEventListener("load", onResize, { once: true });
    if (document.fonts) document.fonts.ready.then(onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
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
        item("hero__scroll hero__label", el("span", { text: "( ↓ )" }))
      )
    );

    const grid = el("ul", { class: "grid", "aria-label": "Projects" }, projects.map(card));
    const view = el("div", { class: "home" }, hero, el("section", { class: "work", "aria-label": "Work" }, grid));

    setPage(`${profile.display_name} — ${profile.occupation}, ${profile.location}`, "#/");
    render(view);
    if (!motionOK) return;
    if (!introPlayed) {
      introPlayed = true;
      hero.querySelector(".hero__caret").classList.remove("is-done");
      playHeroIntro(hero);
    }
    scrollFx = setupScrollFx(hero, grid);
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
