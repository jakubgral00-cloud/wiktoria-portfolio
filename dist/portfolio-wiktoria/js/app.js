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
    const opts = withDay ? { day: "numeric", month: "long", year: "numeric" } : { month: "long", year: "numeric" };
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
  // Small inline icons (stroke = currentColor), as on the Behance profile card.
  const ICONS = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    role: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    company: '<path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
    pin: '<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12Z"/><circle cx="12" cy="9" r="2.5"/>',
    link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  };
  function icon(name) {
    const span = document.createElement("span");
    span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
    return span.firstChild;
  }

  const httpsUrl = (url) => url.replace(/^http:/, "https:");
  const bareUrl = (url) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

  function card(p, i) {
    const count = p.media.length;
    return el("li", { class: "card" },
      el("a", { href: `#/project/${p.slug}` },
        el("div", { class: "card__frame", style: p.dominant_color ? `background-color:${p.dominant_color}` : null },
          img(p.cover, { loading: i < 8 ? "eager" : "lazy" }),
          count > 1 ? el("span", { class: "card__count", "aria-hidden": "true", text: `${count} images` }) : null
        ),
        el("h3", { class: "card__title", text: p.title }),
        el("p", { class: "card__meta" },
          el("time", { datetime: p.published_on, text: formatDate(p.published_on) }))
      )
    );
  }

  function homeView() {
    const { profile, projects } = content;
    // About text verbatim, minus the e-mail line (the e-mail gets its own button).
    const aboutLines = profile.about
      ? profile.about.text.split("\n").map((l) => l.trim()).filter((l) => l && !/^e-mail:/i.test(l))
      : [];
    const instagram = profile.socials.find((s) => s.valid_url && s.service === "Instagram");
    const website = profile.website ? httpsUrl(profile.website) : null;

    const fact = (name, ...children) => el("li", {}, icon(name), el("span", {}, ...children));
    const since = profile.member_since
      ? new Intl.DateTimeFormat("en-GB", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
          .format(new Date(profile.member_since * 1000))
      : null;

    // Profile card, laid out like the Behance one: round photo, name, facts, buttons, About.
    const profileCard = el("aside", { class: "profile", "aria-labelledby": "profile-name" },
      img(profile.avatar, { class: "profile__photo", loading: "eager" }),
      el("h1", { class: "profile__name", id: "profile-name", text: profile.display_name }),
      el("ul", { class: "facts" },
        profile.availability ? el("li", { class: "facts__available" }, icon("check"), el("span", { text: profile.availability.text })) : null,
        fact("role", profile.occupation),
        profile.company ? fact("company", profile.company) : null,
        fact("pin", profile.location),
        website ? fact("link", el("a", { href: website, rel: "noopener", text: bareUrl(website) })) : null
      ),
      el("div", { class: "profile__actions" },
        profile.email ? el("a", { class: "btn btn--solid", href: `mailto:${profile.email}` }, icon("mail"), "E-mail") : null,
        instagram ? el("a", { class: "btn", href: httpsUrl(instagram.url_as_listed), rel: "noopener", text: "Instagram" }) : null
      ),
      aboutLines.length ? el("div", { class: "profile__about" },
        el("h2", { text: profile.about.title }),
        aboutLines.map((line) => el("p", { text: line })),
        since ? el("p", { class: "profile__since", text: `Member since: ${since}` }) : null
      ) : null
    );

    const work = el("section", { class: "work", "aria-labelledby": "work-heading" },
      el("div", { class: "tabs" },
        el("h2", { class: "tabs__item", id: "work-heading" }, "Work",
          el("span", { class: "tabs__count", text: String(projects.length) }))),
      el("ul", { class: "grid", "aria-label": "Projects" }, projects.map(card))
    );

    setPage(`${profile.display_name} — ${profile.occupation}, ${profile.location}`, "#/");
    render(el("div", {}, el("div", { class: "banner", "aria-hidden": "true" }),
      el("div", { class: "home" }, profileCard, work)));
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
      img(profile.avatar, { class: "project__avatar", alt: "" }),
      el("div", {}, title,
        el("p", { class: "project__owner" }, el("a", { href: "#/about", text: profile.display_name }))),
      el("a", { class: "btn project__back", href: "#/", text: "← All work" })
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
        el("p", {}, "Published: ", el("time", { datetime: p.published_on, text: formatDate(p.published_on, true) })),
        p.description ? el("p", { class: "project__desc", text: p.description }) : null,
        p.tags && p.tags.length ? el("ul", { class: "tags", "aria-label": "Tags" }, p.tags.map((t) => el("li", { text: t }))) : null
      ),
      el("a", { class: "btn", href: p.source_url, rel: "noopener", text: "View on Behance" })
    );

    // "More by" strip: the next four projects, wrapping around the list.
    const more = [1, 2, 3, 4].map((k) => projects[(index + k) % projects.length]).filter((q) => q !== p);
    const moreSection = el("section", { class: "more", "aria-labelledby": "more-heading" },
      el("h2", { id: "more-heading", text: `More by ${profile.display_name}` }),
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
