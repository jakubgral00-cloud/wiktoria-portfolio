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

  // ---------- intro animation ----------
  // First visit to the home page: the texts fly in from different sides of the
  // screen, then every photo flies in "from the front" in random order and
  // settles into the gallery. Skipped with prefers-reduced-motion.
  const motionOK = "animate" in Element.prototype &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let introPending = motionOK && document.documentElement.classList.contains("intro");
  const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
  const rand = (min, max) => min + Math.random() * (max - min);
  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  function flyText(node, delay) {
    const w = window.innerWidth, h = window.innerHeight;
    const from = {
      left: [-0.7 * w, 0], right: [0.7 * w, 0], top: [0, -0.6 * h], bottom: [0, 0.6 * h],
    }[node.dataset.fly] || [0, 0.6 * h];
    node.animate([
      { transform: `translate(${from[0]}px, ${from[1]}px)`, opacity: 0 },
      { transform: "none", opacity: 1 },
    ], { duration: rand(1100, 1500), delay, easing: EASE, fill: "backwards" });
  }

  function flyPhoto(cardNode, delay) {
    cardNode.classList.add("is-flying");
    cardNode.style.opacity = "";
    const anim = cardNode.animate([
      { transform: `translate3d(${rand(-30, 30)}vw, ${rand(-25, 15)}vh, 900px) rotate(${rand(-8, 8)}deg)`, opacity: 0, filter: "blur(8px)" },
      { opacity: 1, offset: 0.35 },
      { transform: "translate3d(0, 0, 0) rotate(0deg)", opacity: 1, filter: "blur(0)" },
    ], { duration: rand(1500, 2100), delay, easing: EASE, fill: "backwards" });
    anim.onfinish = anim.oncancel = () => cardNode.classList.remove("is-flying");
  }

  function playIntro(view) {
    introPending = false;
    const texts = [...document.querySelectorAll(".site-header [data-fly]"), ...view.querySelectorAll(".hero [data-fly]")];
    const cards = [...view.querySelectorAll(".card")];
    for (const c of cards) c.style.opacity = "0";
    document.documentElement.classList.remove("intro");

    // Texts: shuffled order, staggered.
    shuffle(texts.slice()).forEach((node, i) => flyText(node, 120 + i * 140));
    const textDone = 120 + texts.length * 140 + 500;

    // Photos already on screen fly in after the texts, in random order;
    // the rest fly in as they scroll into view.
    const onScreen = cards.filter((c) => c.getBoundingClientRect().top < window.innerHeight);
    const below = cards.filter((c) => !onScreen.includes(c));
    const ready = Promise.race([
      Promise.all(onScreen.map((c) => c.querySelector("img").decode().catch(() => {}))),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
    ready.then(() => shuffle(onScreen).forEach((c, i) => flyPhoto(c, textDone + i * 130)));

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        const target = e.target;
        target.querySelector("img").decode().catch(() => {}).then(() => flyPhoto(target, rand(0, 450)));
      }
    }, { rootMargin: "0px 0px -8% 0px" });
    below.forEach((c) => io.observe(c));
  }

  function homeView() {
    const { profile, projects } = content;
    const letters = ["top", "bottom", "left", "right"];
    shuffle(letters);

    const hero = el("section", { class: "hero", "aria-labelledby": "hero-title" },
      el("h1", { class: "hero__title", id: "hero-title", "aria-label": "Work" },
        [..."Work"].map((ch, i) => el("span", { "aria-hidden": "true", "data-fly": letters[i], text: ch }))),
      el("p", { class: "hero__name", "data-fly": Math.random() < 0.5 ? "left" : "right", text: profile.display_name.replace("-", " - ") })
    );

    const grid = el("ul", { class: "grid", "aria-label": "Projects" }, projects.map(card));
    const view = el("div", {}, hero, grid);

    setPage(`${profile.display_name} — ${profile.occupation}, ${profile.location}`, "#/");
    render(view);
    if (introPending) playIntro(view);
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
      document.documentElement.classList.remove("intro");
      main.replaceChildren(el("p", { class: "notice",
        text: `Could not load content (${err.message}). Serve this folder over HTTP, e.g. "python3 -m http.server".` }));
    });
})();
