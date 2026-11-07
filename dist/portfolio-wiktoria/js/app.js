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

  function formatDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
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
  function homeView() {
    const { profile, projects, source } = content;
    const aboutLines = profile.about ? profile.about.text.split("\n").filter(Boolean) : [];

    const intro = el("section", { class: "intro", "aria-labelledby": "intro-heading" },
      el("div", {},
        el("h1", { class: "eyebrow", id: "intro-heading", text: `${profile.occupation} — Selected work` }),
        aboutLines[0] ? el("p", { class: "intro__lead", text: aboutLines[0] }) : null
      ),
      el("p", { class: "intro__meta", text: profile.location })
    );

    const grid = el("ul", { class: "grid", "aria-label": "Projects" },
      projects.map((p, i) =>
        el("li", { class: "card" },
          el("a", { href: `#/project/${p.slug}` },
            el("div", { class: "card__frame" },
              img(p.cover, { loading: i < 3 ? "eager" : "lazy" })
            ),
            el("div", { class: "card__body" },
              el("span", { class: "card__num", "aria-hidden": "true", text: pad(p.order) }),
              el("h2", { class: "card__title", text: p.title }),
              el("p", { class: "card__date" },
                el("time", { datetime: p.published_on, text: formatDate(p.published_on) }))
            )
          )
        )
      )
    );

    const note = source.profile_list_complete ? null : el("p", { class: "archive-note" },
      `These are the ${projects.length} most recent projects listed on the public profile. Older projects can be found on `,
      el("a", { href: source.profile_url, rel: "noopener", text: "Behance" }),
      "."
    );

    setPage(`${profile.display_name} — ${profile.occupation}, ${profile.location}`, "#/");
    render(el("div", {}, intro, grid, note));
  }

  function projectView(slug) {
    const { projects, profile } = content;
    const index = projects.findIndex((p) => p.slug === slug);
    if (index === -1) return notFoundView();
    const p = projects[index];
    const prev = projects[index - 1];
    const next = projects[index + 1];

    // Media sequence in source order; when the project page could not be read,
    // the only verified artwork is the profile cover.
    const usingCover = p.media.length === 0;
    const items = usingCover
      ? [{ ...p.cover, caption: "Project cover, as shown on the Behance profile." }]
      : p.media;

    const title = el("h1", { class: "project__title", id: "project-title", tabindex: "-1", text: p.title });

    const media = el("ol", { class: "media", "aria-label": `Images from ${p.title}` },
      items.map((item, i) =>
        el("li", {},
          el("figure", {},
            el("button", {
              class: "media__btn",
              type: "button",
              "aria-label": `View image ${i + 1} of ${items.length} full screen: ${item.alt}`,
              onclick: (e) => lightbox.open(items, i, e.currentTarget),
            }, img(item, { loading: i < 2 ? "eager" : "lazy" })),
            item.caption ? el("figcaption", { text: item.caption }) : null
          )
        )
      )
    );

    const aside = el("div", { class: "project__aside" },
      p.description ? el("p", { text: p.description }) : null,
      usingCover ? el("p", { class: "notice" },
        "The full image sequence and description of this project could not be retrieved for this site. They are available on the original project page."
      ) : null,
      el("a", { class: "source-link", href: p.source_url, rel: "noopener", text: "View the original project →" })
    );

    const pager = el("nav", { class: "pager", "aria-label": "More projects" },
      prev ? el("a", { class: "pager__prev", href: `#/project/${prev.slug}`, rel: "prev" },
        el("span", { text: "← Previous" }), el("span", { text: prev.title })) : null,
      next ? el("a", { class: "pager__next", href: `#/project/${next.slug}`, rel: "next" },
        el("span", { text: "Next →" }), el("span", { text: next.title })) : null
    );

    const article = el("article", { class: "project", "aria-labelledby": "project-title" },
      el("a", { class: "project__back", href: "#/", text: "← All work" }),
      el("header", { class: "project__head" },
        el("div", {},
          el("p", { class: "eyebrow", text: `Project ${pad(p.order)} / ${pad(projects.length)}` }),
          title
        ),
        el("dl", { class: "project__meta" },
          el("dt", { text: "Published" }),
          el("dd", {}, el("time", { datetime: p.published_on, text: formatDate(p.published_on) }))
        )
      ),
      el("div", { class: "project__layout" }, media, aside),
      pager
    );

    setPage(`${p.title} — ${profile.display_name}`, null);
    render(article, title);
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
      caption.textContent = items.length > 1
        ? `${index + 1} / ${items.length} — ${item.alt}`
        : item.alt;
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
