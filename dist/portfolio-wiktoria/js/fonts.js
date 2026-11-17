// Fonts Wiktoria can pick in the admin panel for headings and body text.
// "Satoshi" is the site's original font (Fontshare, loaded in index.html);
// the other 100 come from Google Fonts. `w` lists the weights each family
// really has, because Google's CSS API rejects a request for a missing weight.
(() => {
  const B = "400;700";
  const R = "400";
  const list = [
    // Sans serif
    ["Inter", "sans", B], ["Roboto", "sans", B], ["Open Sans", "sans", B], ["Lato", "sans", B],
    ["Montserrat", "sans", B], ["Poppins", "sans", B], ["Raleway", "sans", B], ["Nunito", "sans", B],
    ["Work Sans", "sans", B], ["DM Sans", "sans", B], ["Manrope", "sans", B], ["Plus Jakarta Sans", "sans", B],
    ["Outfit", "sans", B], ["Sora", "sans", B], ["Urbanist", "sans", B], ["Lexend", "sans", B],
    ["Figtree", "sans", B], ["Space Grotesk", "sans", B], ["Archivo", "sans", B], ["Barlow", "sans", B],
    ["Rubik", "sans", B], ["Karla", "sans", B], ["Mulish", "sans", B], ["Jost", "sans", B],
    ["Josefin Sans", "sans", B], ["Quicksand", "sans", B], ["IBM Plex Sans", "sans", B], ["Source Sans 3", "sans", B],
    ["Noto Sans", "sans", B], ["PT Sans", "sans", B], ["Fira Sans", "sans", B], ["Hind", "sans", B],
    ["Kanit", "sans", B], ["Heebo", "sans", B], ["Assistant", "sans", B], ["Red Hat Display", "sans", B],
    ["Albert Sans", "sans", B], ["Epilogue", "sans", B], ["Syne", "sans", B], ["Unbounded", "sans", B],
    ["Familjen Grotesk", "sans", B], ["Schibsted Grotesk", "sans", B], ["Hanken Grotesk", "sans", B], ["Onest", "sans", B],
    ["Instrument Sans", "sans", B], ["Bricolage Grotesque", "sans", B], ["Golos Text", "sans", B], ["Wix Madefor Display", "sans", B],
    ["Be Vietnam Pro", "sans", B], ["Public Sans", "sans", B],
    // Serif
    ["Playfair Display", "serif", B], ["Cormorant Garamond", "serif", B], ["EB Garamond", "serif", B], ["Libre Baskerville", "serif", B],
    ["Lora", "serif", B], ["Merriweather", "serif", B], ["Crimson Text", "serif", B], ["Cormorant", "serif", B],
    ["Bodoni Moda", "serif", B], ["Prata", "serif", R], ["Cinzel", "serif", B], ["DM Serif Display", "serif", R],
    ["Fraunces", "serif", B], ["Libre Caslon Text", "serif", B], ["Spectral", "serif", B], ["Source Serif 4", "serif", B],
    ["Noto Serif", "serif", B], ["PT Serif", "serif", B], ["Instrument Serif", "serif", R], ["Gloock", "serif", R],
    ["Italiana", "serif", R], ["Marcellus", "serif", R], ["Bellefair", "serif", R], ["Gilda Display", "serif", R],
    ["Rozha One", "serif", R], ["Abril Fatface", "serif", R], ["Yeseva One", "serif", R], ["Old Standard TT", "serif", B],
    ["Newsreader", "serif", B], ["Young Serif", "serif", R],
    // Display
    ["Bebas Neue", "display", R], ["Anton", "display", R], ["Oswald", "display", B], ["Archivo Black", "display", R],
    ["Righteous", "display", R], ["Syncopate", "display", B], ["Michroma", "display", R], ["Monoton", "display", R],
    ["Poiret One", "display", R], ["Limelight", "display", R], ["Tenor Sans", "display", R], ["Didact Gothic", "display", R],
    ["Major Mono Display", "display", R], ["Teko", "display", B],
    // Monospace
    ["Space Mono", "mono", B], ["IBM Plex Mono", "mono", B], ["DM Mono", "mono", "400;500"],
    // Script
    ["Great Vibes", "script", R], ["Pinyon Script", "script", R], ["Dancing Script", "script", B],
  ];
  const fallback = { sans: "sans-serif", serif: "serif", display: "sans-serif", mono: "monospace", script: "cursive" };

  const fonts = [{ name: "Satoshi", kind: "sans", weights: "400;500;700;900", google: false }]
    .concat(list.map(([name, kind, weights]) => ({ name, kind, weights, google: true })));

  const byName = (name) => fonts.find((f) => f.name === name) || fonts[0];

  // CSS font-family value for a font name, with a sensible fallback stack.
  const stack = (name) => {
    const f = byName(name);
    return `"${f.name}", ${f.name === "Satoshi" ? '"Helvetica Neue", "Segoe UI", Arial, ' : ""}${fallback[f.kind]}`;
  };

  // Google Fonts stylesheet URL for the given font names (Satoshi is skipped).
  // `text` limits the download to those characters (used for previews).
  const cssUrl = (names, text) => {
    const fams = [...new Set(names)].map(byName).filter((f) => f.google)
      .map((f) => `family=${encodeURIComponent(f.name).replace(/%20/g, "+")}:wght@${f.weights}`);
    if (!fams.length) return null;
    return `https://fonts.googleapis.com/css2?${fams.join("&")}&display=swap${text ? `&text=${encodeURIComponent(text)}` : ""}`;
  };

  window.SITE_FONTS = { fonts, byName, stack, cssUrl };
})();
