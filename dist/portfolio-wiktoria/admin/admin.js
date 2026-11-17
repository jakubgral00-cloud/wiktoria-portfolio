// Admin panel for the portfolio. Works on phones and laptops.
// Content is the same object the site reads (content.json shape); it is loaded
// from /api/content (or /content.json before the first save), edited here in
// memory and saved back in one go with "Zapisz zmiany".
(() => {
  "use strict";

  const TOKEN_KEY = "wwg-admin-session";
  const $ = (sel) => document.querySelector(sel);
  const F = window.SITE_FONTS;

  // ---------- tiny DOM helper ----------
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value === null || value === undefined || value === false) continue;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key === "value") node.value = value;
      else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value === true ? "" : value);
    }
    for (const child of children.flat()) {
      if (child === null || child === undefined || child === false) continue;
      node.append(child instanceof Node ? child : document.createTextNode(child));
    }
    return node;
  }

  // Images are stored with paths relative to the site root; the panel lives in /admin/.
  const srcUrl = (src) => (/^(https?:|data:|blob:|\/)/.test(src) ? src : `/${src}`);

  // ---------- session ----------
  function session() {
    try {
      const s = JSON.parse(localStorage.getItem(TOKEN_KEY) || "null");
      return s && s.expires > Date.now() ? s : null;
    } catch { return null; }
  }
  function setSession(s) { try { localStorage.setItem(TOKEN_KEY, JSON.stringify(s)); } catch { /* private mode */ } }
  function clearSession() { try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } }

  async function api(path, opts = {}) {
    const s = session();
    const headers = { ...(opts.headers || {}) };
    if (s) headers.authorization = `Bearer ${s.token}`;
    const res = await fetch(path, { cache: "no-store", ...opts, headers });
    if (res.status === 401 && path !== "/api/login") {
      clearSession();
      showLogin("Sesja wygasła — zaloguj się ponownie. Niezapisane zmiany zostały na tej stronie.");
      throw new Error("unauthorized");
    }
    let body = null;
    try { body = await res.json(); } catch { /* not JSON */ }
    if (!res.ok) throw Object.assign(new Error((body && body.error) || `Błąd ${res.status}`), { status: res.status });
    return body;
  }

  // ---------- state ----------
  let data = null;          // the content being edited
  let dirty = false;
  let tab = "texts";
  let openProject = null;   // slug of the project being edited
  let fontTarget = "heading";
  let pendingUploads = 0;

  function markDirty() {
    dirty = true;
    setStatus("Masz niezapisane zmiany", "is-dirty");
    $("#save").disabled = pendingUploads > 0;
  }
  function setStatus(text, cls = "") {
    const s = $("#status");
    s.textContent = text;
    s.className = `savebar__status ${cls}`;
  }
  let toastTimer = null;
  function toast(text) {
    const t = $("#toast");
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  // ---------- login ----------
  function showLogin(message) {
    $("#app").hidden = true;
    $("#login").hidden = false;
    const err = $("#login-error");
    err.hidden = !message;
    err.textContent = message || "";
    setTimeout(() => $("#login-form").email.focus(), 50);
  }

  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const button = form.querySelector("[type=submit]");
    const err = $("#login-error");
    err.hidden = true;
    if (!form.email.value.trim() || !form.password.value) {
      err.textContent = "Wpisz e-mail i hasło.";
      err.hidden = false;
      return;
    }
    button.disabled = true;
    button.textContent = "Logowanie…";
    try {
      const s = await api("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: form.email.value.trim(), password: form.password.value }),
      });
      setSession(s);
      form.password.value = "";
      await start();
    } catch (error) {
      err.textContent = error.status === 404
        ? "Panel nie działa w tym podglądzie (brak funkcji Netlify)."
        : error.message;
      err.hidden = false;
    } finally {
      button.disabled = false;
      button.textContent = "Zaloguj się";
    }
  });

  document.querySelector(".password__toggle").addEventListener("click", (e) => {
    const input = $("#login-form").password;
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    e.currentTarget.textContent = show ? "Ukryj" : "Pokaż";
    e.currentTarget.setAttribute("aria-label", show ? "Ukryj hasło" : "Pokaż hasło");
  });

  $("#logout").addEventListener("click", () => {
    if (dirty && !confirm("Masz niezapisane zmiany. Wylogować mimo to?")) return;
    clearSession();
    dirty = false;
    data = null;
    showLogin();
  });

  // ---------- load & save ----------
  async function loadContent() {
    try {
      return await api("/api/content");
    } catch (error) {
      if (error.status !== 404) throw error;
      const res = await fetch("/content.json", { cache: "no-store" });
      if (!res.ok) throw new Error("Nie udało się wczytać treści strony.");
      return res.json();
    }
  }

  function normalize(content) {
    content.site = content.site || {};
    content.site.fonts = content.site.fonts || { heading: "Satoshi", body: "Satoshi" };
    const p = content.profile;
    p.about = p.about || { title: "About", text: "" };
    if (!Array.isArray(p.links)) {
      p.links = (p.socials || []).filter((s) => s.valid_url)
        .map((s) => ({ label: s.service, url: s.url_as_listed.replace(/^http:/, "https:") }));
    }
    content.projects.forEach((proj) => {
      proj.media = proj.media || [];
      proj.tags = proj.tags || [];
    });
    return content;
  }

  // Keep order numbers and alt texts in step with the edited order and titles.
  function prepareForSave() {
    const out = JSON.parse(JSON.stringify(data));
    out.projects.forEach((proj, i) => {
      proj.order = i + 1;
      const n = proj.media.length;
      proj.media.forEach((m, k) => { m.alt = `„${proj.title}” — image ${k + 1} of ${n}`; });
      if (!proj.cover && n) proj.cover = { ...proj.media[0] };
      if (proj.cover) {
        proj.cover = { src: proj.cover.src, width: proj.cover.width, height: proj.cover.height,
          ...(proj.cover.source_url ? { source_url: proj.cover.source_url } : {}),
          alt: `Cover image of the project „${proj.title}”` };
      }
    });
    if (out.profile.avatar) out.profile.avatar.alt = `Portrait of ${out.profile.display_name}`;
    out.profile.links = out.profile.links.filter((l) => l.label.trim() && l.url.trim());
    return out;
  }

  async function save() {
    if (pendingUploads) { toast("Poczekaj, aż zdjęcia się wyślą."); return; }
    const button = $("#save");
    button.disabled = true;
    setStatus("Zapisywanie…");
    try {
      const out = prepareForSave();
      const res = await api("/api/content", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(out),
      });
      data.saved_at = res.saved_at;
      dirty = false;
      setStatus("Zapisano ✓ — zmiany są już na stronie", "is-ok");
      toast("Zapisano. Odśwież stronę, żeby zobaczyć zmiany.");
    } catch (error) {
      if (error.message !== "unauthorized") setStatus(`Nie zapisano: ${error.message}`, "is-error");
      button.disabled = false;
    }
  }
  $("#save").addEventListener("click", save);
  window.addEventListener("beforeunload", (e) => {
    if (dirty) { e.preventDefault(); e.returnValue = ""; }
  });
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && data) { e.preventDefault(); if (dirty) save(); }
  });

  // ---------- image upload (shrunk in the browser first) ----------
  async function decode(file) {
    if ("createImageBitmap" in window) {
      try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch { /* fall back */ }
    }
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      return image;
    } finally { URL.revokeObjectURL(url); }
  }

  async function shrink(file, maxSide = 2200) {
    if (file.type === "image/gif" && file.size < 5 * 1024 * 1024) {
      const bmp = await decode(file);
      return { blob: file, type: "image/gif", width: bmp.width, height: bmp.height };
    }
    const bmp = await decode(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const width = Math.round(bmp.width * scale);
    const height = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bmp, 0, 0, width, height);
    let quality = 0.86;
    let blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", quality));
    while (blob && blob.size > 4.5 * 1024 * 1024 && quality > 0.5) {
      quality -= 0.12;
      blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", quality));
    }
    if (!blob) throw new Error("Nie udało się przygotować zdjęcia.");
    return { blob, type: "image/jpeg", width, height };
  }

  async function uploadFiles(files, onEach) {
    const list = [...files].filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name));
    if (!list.length) { toast("Wybierz pliki ze zdjęciami."); return; }
    pendingUploads += list.length;
    $("#save").disabled = true;
    let done = 0;
    let failed = 0;
    setStatus(`Wysyłanie zdjęć 0/${list.length}…`);
    for (const file of list) {
      try {
        const img = await shrink(file);
        const res = await api("/api/upload", { method: "POST", headers: { "content-type": img.type }, body: img.blob });
        onEach({ src: res.src, width: img.width, height: img.height, alt: "" });
      } catch (error) {
        if (error.message === "unauthorized") { pendingUploads = 0; return; }
        failed++;
        console.error(error);
      }
      done++;
      pendingUploads--;
      setStatus(`Wysyłanie zdjęć ${done}/${list.length}…`);
    }
    markDirty();
    if (failed) toast(`${failed} z ${list.length} zdjęć nie udało się wysłać (format HEIC? spróbuj JPG).`);
    else toast(list.length === 1 ? "Zdjęcie dodane." : `Dodano ${list.length} zdjęć.`);
    if (failed) setStatus("Część zdjęć się nie wysłała", "is-error");
  }

  function uploadButton(label, multiple, onFiles) {
    const input = el("input", { type: "file", accept: "image/*", multiple: multiple || null, "aria-label": label });
    input.addEventListener("change", () => {
      if (input.files.length) onFiles(input.files);
      input.value = "";
    });
    return el("label", { class: "btn upload" }, label, input);
  }

  // ---------- form helpers ----------
  function field(label, get, set, opts = {}) {
    const attrs = { value: get() ?? "", placeholder: opts.placeholder || null, type: opts.type || "text",
      oninput: (e) => { set(e.target.value); markDirty(); if (opts.after) opts.after(); } };
    const control = opts.multiline ? el("textarea", { ...attrs, type: null, rows: opts.rows || 6 }) : el("input", attrs);
    return el("label", { class: "field" },
      el("span", { class: "field__label", text: label }),
      control,
      opts.hint ? el("span", { class: "field__hint", text: opts.hint }) : null);
  }

  function sortable(list, items, onEnd, extra = {}) {
    if (!window.Sortable) return;
    window.Sortable.create(list, {
      animation: 160,
      delay: 180,
      delayOnTouchOnly: true,
      touchStartThreshold: 6,
      ghostClass: "sortable-ghost",
      chosenClass: "sortable-chosen",
      ...extra,
      onEnd: (e) => {
        if (e.oldIndex === e.newIndex) return;
        const [moved] = items.splice(e.oldIndex, 1);
        items.splice(e.newIndex, 0, moved);
        markDirty();
        onEnd();
      },
    });
  }

  // ---------- tabs ----------
  const TABS = [
    ["texts", "Teksty"],
    ["portfolio", "Portfolio"],
    ["about", "O mnie"],
    ["fonts", "Czcionki"],
    ["versions", "Kopie"],
  ];

  function renderTabs() {
    $("#tabs").replaceChildren(...TABS.map(([id, label]) =>
      el("button", { class: "tab", type: "button", role: "tab", "aria-selected": String(tab === id),
        onclick: () => { tab = id; openProject = null; renderTabs(); renderPanel(true); } }, label)));
  }

  function renderPanel(top) {
    const views = { texts: textsView, portfolio: openProject ? projectView : portfolioView, about: aboutView, fonts: fontsView, versions: versionsView };
    $("#panel").replaceChildren(views[tab]());
    if (top) window.scrollTo(0, 0);
  }

  // ---------- Teksty ----------
  function textsView() {
    const p = data.profile;
    const s = data.site;
    const linksBox = el("div");
    const drawLinks = () => {
      linksBox.replaceChildren(
        ...p.links.map((l, i) => el("div", { class: "linkrow" },
          el("input", { class: "input", value: l.label, placeholder: "Nazwa, np. Instagram", "aria-label": "Nazwa linku",
            oninput: (e) => { l.label = e.target.value; markDirty(); } }),
          el("input", { class: "input input--url", type: "url", value: l.url, placeholder: "https://…", "aria-label": "Adres linku",
            oninput: (e) => { l.url = e.target.value; markDirty(); } }),
          el("button", { class: "btn btn--small btn--danger", type: "button", text: "Usuń",
            onclick: () => { p.links.splice(i, 1); markDirty(); drawLinks(); } }))),
        el("button", { class: "btn btn--small", type: "button", text: "+ Dodaj link",
          onclick: () => { p.links.push({ label: "", url: "" }); markDirty(); drawLinks(); } }));
    };
    drawLinks();

    return el("section", {},
      el("h2", { text: "Teksty" }),
      el("p", { class: "panel__lead", text: "Napisy widoczne na stronie. Po zmianach naciśnij „Zapisz zmiany” na dole." }),
      el("div", { class: "box" },
        el("h3", { text: "Strona główna" }),
        field("Duży napis", () => p.hero_title, (v) => { p.hero_title = v; }, { hint: "Wyświetla się wielkimi literami, np. FASHION STYLIST." }),
        field("Imię i nazwisko", () => p.display_name, (v) => { p.display_name = v; }, { hint: "Pod dużym napisem i w lewym górnym rogu strony." })),
      el("div", { class: "box" },
        el("h3", { text: "Nagłówek, kontakt i stopka" }),
        el("div", { class: "grid2" },
          field("Zawód", () => p.occupation, (v) => { p.occupation = v; }),
          field("Miasto", () => p.location, (v) => { p.location = v; }),
          field("E-mail", () => p.email, (v) => { p.email = v; }, { type: "email" }),
          field("Dostępność (prawy górny róg)", () => s.availability, (v) => { s.availability = v; }),
          field("Tekst linku do zapytania", () => s.inquiry_label, (v) => { s.inquiry_label = v; })),
        field("Stopka", () => s.footer, (v) => { s.footer = v; })),
      el("div", { class: "box" },
        el("h3", { text: "Linki (Instagram, Behance…)" }),
        linksBox));
  }

  // ---------- Portfolio ----------
  const slugify = (text) => text.toLowerCase().replace(/ł/g, "l").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "projekt";
  const coverOf = (proj) => proj.cover || proj.media[0] || null;
  const today = () => new Date().toISOString().slice(0, 10);

  function portfolioView() {
    const list = el("ul", { class: "plist" },
      data.projects.map((proj) => {
        const cover = coverOf(proj);
        return el("li", { class: "pitem" },
          el("button", { class: "drag", type: "button", "aria-label": `Przeciągnij, aby zmienić kolejność: ${proj.title}`, text: "⋮⋮" }),
          cover ? el("img", { class: "pitem__thumb", src: srcUrl(cover.src), alt: "", loading: "lazy" }) : el("span", { class: "pitem__thumb" }),
          el("button", { class: "pitem__text", type: "button", onclick: () => { openProject = proj.slug; renderPanel(true); } },
            el("span", { class: "pitem__title", text: proj.title || "(bez tytułu)" }),
            el("span", { class: "pitem__meta", text: `${proj.media.length} zdj.${proj.published_on ? " · " + proj.published_on : ""}` })),
          el("span", { "aria-hidden": "true", text: "›" }));
      }));
    sortable(list, data.projects, () => {}, { handle: ".drag" });

    return el("section", {},
      el("div", { class: "row row--between" },
        el("h2", { text: `Portfolio (${data.projects.length})` }),
        el("button", { class: "btn btn--primary", type: "button", text: "+ Dodaj projekt", onclick: addProject })),
      el("p", { class: "panel__lead", text: "Przeciągnij ⋮⋮, żeby zmienić kolejność na stronie (na telefonie: przytrzymaj i przesuń). Dotknij projektu, żeby go edytować." }),
      list);
  }

  function addProject() {
    const title = prompt("Tytuł nowego projektu:", "");
    if (title === null) return;
    const base = slugify(title || "projekt");
    let slug = base;
    for (let i = 2; data.projects.some((p) => p.slug === slug); i++) slug = `${base}-${i}`;
    data.projects.unshift({ order: 1, title: title.trim() || "Nowy projekt", slug, published_on: today(),
      tags: [], cover: null, description: null, media: [], source_url: null });
    openProject = slug;
    markDirty();
    renderPanel(true);
  }

  function projectView() {
    const index = data.projects.findIndex((p) => p.slug === openProject);
    if (index === -1) { openProject = null; return portfolioView(); }
    const proj = data.projects[index];

    const coverBox = el("div", { class: "cover" });
    const drawCover = () => {
      const c = coverOf(proj);
      coverBox.replaceChildren(
        c ? el("img", { src: srcUrl(c.src), alt: "Okładka" }) : el("div", { class: "cover__empty", text: "Brak okładki" }),
        el("div", {},
          el("p", { class: "field__label", text: "Okładka (zdjęcie w siatce na stronie głównej)" }),
          el("p", { class: "field__hint", text: proj.cover ? "Wybierz „Okładka” pod zdjęciem albo wgraj inne." : "Domyślnie pierwsze zdjęcie. Możesz wybrać inne." }),
          uploadButton("Wgraj okładkę", false, (files) => uploadFiles(files, (img) => { proj.cover = img; drawCover(); drawPhotos(); }))));
    };

    const photos = el("ul", { class: "photos", "aria-label": "Zdjęcia projektu" });
    const photosTitle = el("h3", { text: `Zdjęcia (${proj.media.length})` });
    const isCover = (m) => proj.cover && proj.cover.src === m.src;
    const drawPhotos = () => {
      photos.replaceChildren(...proj.media.map((m, i) => el("li", { class: "photo" },
        el("img", { src: srcUrl(m.src), alt: "", loading: "lazy", draggable: "false" }),
        el("span", { class: "photo__num", text: String(i + 1) }),
        isCover(m) ? el("span", { class: "photo__badge", text: "Okładka" }) : null,
        m.caption ? el("div", { class: "photo__caption", text: m.caption }) : null,
        el("div", { class: "photo__bar" },
          el("button", { type: "button", class: "no-drag", text: "Okładka", "aria-label": `Ustaw zdjęcie ${i + 1} jako okładkę`,
            onclick: () => { proj.cover = { ...m }; markDirty(); drawCover(); drawPhotos(); } }),
          el("button", { type: "button", class: "no-drag", text: "Opis", "aria-label": `Opis zdjęcia ${i + 1}`,
            onclick: () => {
              const v = prompt("Opis pod zdjęciem (może być pusty):", m.caption || "");
              if (v === null) return;
              if (v.trim()) m.caption = v.trim(); else delete m.caption;
              markDirty(); drawPhotos();
            } }),
          el("button", { type: "button", class: "no-drag is-danger", text: "Usuń", "aria-label": `Usuń zdjęcie ${i + 1}`,
            onclick: () => {
              if (!confirm("Usunąć to zdjęcie z projektu?")) return;
              proj.media.splice(i, 1);
              if (isCover(m)) proj.cover = null;
              markDirty(); drawCover(); drawPhotos();
            } })))));
    };
    drawCover();
    drawPhotos();
    sortable(photos, proj.media, drawPhotos, { filter: ".no-drag", preventOnFilter: false });

    const move = (delta) => {
      const j = index + delta;
      if (j < 0 || j >= data.projects.length) return;
      data.projects.splice(index, 1);
      data.projects.splice(j, 0, proj);
      markDirty();
      renderPanel();
      toast(`Projekt jest teraz na pozycji ${j + 1}.`);
    };

    return el("section", {},
      el("button", { class: "btn btn--ghost", type: "button", text: "← Wszystkie projekty", style: "margin:-0.5rem 0 0.75rem -0.6rem",
        onclick: () => { openProject = null; renderPanel(true); } }),
      el("h2", { text: proj.title || "(bez tytułu)" }),
      el("p", { class: "panel__lead" }, `Pozycja ${index + 1} z ${data.projects.length} · `,
        el("a", { href: `/#/project/${proj.slug}`, target: "_blank", rel: "noopener", text: "zobacz na stronie ↗" })),
      el("div", { class: "box" },
        field("Tytuł", () => proj.title, (v) => { proj.title = v; }, { after: () => { $("#panel h2").textContent = proj.title || "(bez tytułu)"; } }),
        el("div", { class: "grid2" },
          field("Data publikacji", () => proj.published_on, (v) => { proj.published_on = v || null; }, { type: "date" }),
          field("Tagi", () => proj.tags.join(", "), (v) => { proj.tags = v.split(",").map((t) => t.trim()).filter(Boolean); }, { hint: "Oddziel przecinkami." })),
        field("Opis projektu", () => proj.description, (v) => { proj.description = v.trim() ? v : null; }, { multiline: true, rows: 5 }),
        field("Link do Behance (opcjonalnie)", () => proj.source_url, (v) => { proj.source_url = v.trim() || null; }, { type: "url", placeholder: "https://www.behance.net/gallery/…" })),
      el("div", { class: "box" },
        photosTitle,
        coverBox,
        el("p", { class: "field__hint", text: "Przeciągnij zdjęcie, żeby zmienić kolejność (na telefonie: przytrzymaj chwilę i przesuń)." }),
        photos,
        uploadButton("+ Dodaj zdjęcia", true, (files) => uploadFiles(files, (img) => {
          proj.media.push(img);
          drawPhotos();
          photosTitle.textContent = `Zdjęcia (${proj.media.length})`;
        }))),
      el("div", { class: "box" },
        el("h3", { text: "Kolejność i usuwanie" }),
        el("div", { class: "row" },
          el("button", { class: "btn btn--small", type: "button", text: "↑ Wyżej", disabled: index === 0 || null, onclick: () => move(-1) }),
          el("button", { class: "btn btn--small", type: "button", text: "↓ Niżej", disabled: index === data.projects.length - 1 || null, onclick: () => move(1) }),
          el("button", { class: "btn btn--small", type: "button", text: "Na początek", disabled: index === 0 || null, onclick: () => move(-index) }),
          el("button", { class: "btn btn--small btn--danger", type: "button", text: "Usuń projekt", style: "margin-left:auto",
            onclick: () => {
              if (!confirm(`Usunąć projekt „${proj.title}” ze strony? Zadziała po zapisaniu.`)) return;
              data.projects.splice(index, 1);
              openProject = null;
              markDirty();
              renderPanel(true);
            } }))));
  }

  // ---------- O mnie ----------
  function aboutView() {
    const p = data.profile;
    const photo = el("div", { class: "about-photo" });
    const draw = () => photo.replaceChildren(
      p.avatar && p.avatar.src ? el("img", { src: srcUrl(p.avatar.src), alt: "Twoje zdjęcie" }) : el("div", { class: "cover__empty", text: "Brak zdjęcia" }),
      el("div", { class: "row" },
        uploadButton("Zmień zdjęcie", false, (files) => uploadFiles(files, (img) => { p.avatar = img; draw(); })),
        p.avatar && p.avatar.src ? el("button", { class: "btn btn--danger", type: "button", text: "Usuń",
          onclick: () => { if (confirm("Usunąć zdjęcie z sekcji O mnie?")) { p.avatar = null; markDirty(); draw(); } } }) : null));
    draw();
    return el("section", {},
      el("h2", { text: "O mnie" }),
      el("p", { class: "panel__lead" }, "Sekcja ", el("a", { href: "/#/about", target: "_blank", rel: "noopener", text: "About ↗" }), " na stronie."),
      el("div", { class: "box" },
        el("h3", { text: "Zdjęcie" }),
        photo,
        field("Mały tytuł nad imieniem", () => p.about.title, (v) => { p.about.title = v; }),
        field("Tekst o mnie", () => p.about.text, (v) => { p.about.text = v; },
          { multiline: true, rows: 9, hint: "Nowa linia = nowy wiersz na stronie. Linia zaczynająca się od „e-mail:” jest pomijana (e-mail pokazuje się w kontakcie)." })));
  }

  // ---------- Czcionki ----------
  const loadedCss = new Set();
  function loadFontCss(url) {
    if (!url || loadedCss.has(url)) return;
    loadedCss.add(url);
    document.head.append(el("link", { rel: "stylesheet", href: url }));
  }
  const KIND = { sans: "Bezszeryfowa", serif: "Szeryfowa", display: "Ozdobna", mono: "Maszynowa", script: "Odręczna" };

  function fontsView() {
    const fonts = data.site.fonts;
    loadFontCss(F.cssUrl([fonts.heading, fonts.body]));

    const preview = el("div", { class: "fontpreview" });
    const drawPreview = () => {
      loadFontCss(F.cssUrl([fonts.heading, fonts.body]));
      preview.replaceChildren(
        el("p", { class: "fontpreview__h", style: `font-family:${F.stack(fonts.heading)}`, text: (data.profile.hero_title || "Fashion Stylist").toUpperCase() }),
        el("p", { class: "fontpreview__p", style: `font-family:${F.stack(fonts.body)}`,
          text: `${data.profile.display_name} — ${data.profile.occupation}. Zażółć gęślą jaźń. Fashion, commercial, music video.` }),
        el("p", { class: "fontpreview__meta", text: `Nagłówki: ${fonts.heading} · Teksty: ${fonts.body}` }));
    };

    const seg = el("div", { class: "segmented", role: "group", "aria-label": "Co zmieniasz" });
    const drawSeg = () => seg.replaceChildren(
      ...[["heading", "Nagłówki"], ["body", "Teksty"]].map(([id, label]) =>
        el("button", { type: "button", "aria-pressed": String(fontTarget === id),
          onclick: () => { fontTarget = id; drawSeg(); drawGrid(); } }, label)));

    const search = el("input", { class: "input", type: "search", placeholder: "Szukaj czcionki…", "aria-label": "Szukaj czcionki",
      oninput: () => drawGrid() });
    const grid = el("div", { class: "fontgrid" });

    const io = "IntersectionObserver" in window ? new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const name = entry.target.dataset.font;
        loadFontCss(F.cssUrl([name], `${name}AaZżółćĘ`));
        io.unobserve(entry.target);
      }
    }, { rootMargin: "200px" }) : null;

    const drawGrid = () => {
      const q = search.value.trim().toLowerCase();
      const list = F.fonts.filter((f) => !q || f.name.toLowerCase().includes(q) || KIND[f.kind].toLowerCase().includes(q));
      grid.replaceChildren(...list.map((f) => {
        const tags = [fonts.heading === f.name ? "Nagłówki ✓" : null, fonts.body === f.name ? "Teksty ✓" : null].filter(Boolean).join(" · ");
        const card = el("button", { class: `fontcard${fonts[fontTarget] === f.name ? " is-current" : ""}`, type: "button", "data-font": f.name,
          "aria-pressed": String(fonts[fontTarget] === f.name),
          onclick: () => { fonts[fontTarget] = f.name; markDirty(); drawPreview(); drawGrid(); } },
          el("span", { class: "fontcard__sample", style: `font-family:${F.stack(f.name)}`, text: f.name }),
          el("span", { class: "fontcard__meta", text: f.name === "Satoshi" ? "Obecna czcionka strony" : KIND[f.kind] }),
          tags ? el("span", { class: "fontcard__tags", text: tags }) : null);
        if (f.google) { if (io) io.observe(card); else loadFontCss(F.cssUrl([f.name], `${f.name}AaZżółćĘ`)); }
        return card;
      }));
    };
    drawPreview();
    drawSeg();
    drawGrid();

    return el("section", {},
      el("h2", { text: "Czcionki" }),
      el("p", { class: "panel__lead", text: `${F.fonts.length - 1} czcionek do wyboru + obecna (Satoshi). Wybierz osobno dla nagłówków i dla tekstów — zmiana obejmuje całą stronę.` }),
      preview,
      el("div", { class: "row row--between" }, seg,
        el("button", { class: "btn btn--small", type: "button", text: "Przywróć Satoshi",
          onclick: () => { fonts.heading = "Satoshi"; fonts.body = "Satoshi"; markDirty(); drawPreview(); drawGrid(); } })),
      search,
      grid);
  }

  // ---------- Kopie (saved versions) ----------
  function versionsView() {
    const list = el("ul", { class: "versions" }, el("li", { text: "Wczytywanie…" }));
    api("/api/content?history=1").then(({ versions }) => {
      if (!versions.length) { list.replaceChildren(el("li", { text: "Nie ma jeszcze zapisanych wersji." })); return; }
      list.replaceChildren(...versions.map((key) => {
        const iso = key.replace("history/", "").replace(/^(\d{4}-\d\d-\d\d)T(\d\d)-(\d\d)-(\d\d)-(\d+)Z$/, "$1T$2:$3:$4.$5Z");
        const date = new Date(iso);
        const label = isNaN(date) ? key : date.toLocaleString("pl-PL", { dateStyle: "medium", timeStyle: "short" });
        return el("li", {}, el("span", { text: label }),
          el("button", { class: "btn btn--small", type: "button", text: "Przywróć",
            onclick: async () => {
              if (!confirm(`Wczytać wersję z ${label}? Potem naciśnij „Zapisz zmiany”, żeby pojawiła się na stronie.`)) return;
              try {
                data = normalize(await api(`/api/content?version=${encodeURIComponent(key)}`));
                markDirty();
                toast("Wczytano starszą wersję. Zapisz, żeby ją opublikować.");
              } catch (error) { if (error.message !== "unauthorized") toast(error.message); }
            } }));
      }));
    }).catch((error) => {
      if (error.message !== "unauthorized") list.replaceChildren(el("li", { text: `Nie udało się wczytać listy: ${error.message}` }));
    });
    return el("section", {},
      el("h2", { text: "Kopie zapasowe" }),
      el("p", { class: "panel__lead", text: "Każde zapisanie tworzy kopię. Jeśli coś pójdzie nie tak, możesz wrócić do wcześniejszej wersji." }),
      list);
  }

  // ---------- start ----------
  async function start() {
    $("#login").hidden = true;
    $("#app").hidden = false;
    setStatus("Wczytywanie…");
    try {
      if (!data) data = normalize(await loadContent());
      renderTabs();
      renderPanel(true);
      setStatus(dirty ? "Masz niezapisane zmiany" : "Wszystko zapisane", dirty ? "is-dirty" : "");
      $("#save").disabled = !dirty;
    } catch (error) {
      if (error.message !== "unauthorized") setStatus(error.message, "is-error");
    }
  }

  if (session()) start(); else showLogin();
})();
