// QCF v2 page fonts — the same Mushaf glyph fonts used by the Reading (Uthmani) view.
// Each Madani page has its own font; words are rendered from their `code_v2` glyph.

const registered = new Set<number>();
const ready = new Map<number, Promise<void>>();

export function qcfFontFamily(page: number) {
  return `p${page}-v2`;
}

function fontUrl(page: number) {
  return `https://verses.quran.foundation/fonts/quran/hafs/v2/woff2/p${page}.woff2`;
}

/** Registers the @font-face for a page once; the browser fetches it on first use. */
export function loadQcfPageFont(page: number) {
  if (registered.has(page) || typeof document === 'undefined') return;
  registered.add(page);
  const family = qcfFontFamily(page);
  const id = `qcf-${family}`;
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `@font-face{font-family:'${family}';src:url('${fontUrl(page)}') format('woff2');font-display:block;}`;
  document.head.appendChild(style);
}

export function loadQcfFontsForPages(pages: Iterable<number>) {
  for (const p of pages) loadQcfPageFont(p);
}

/** Resolves once the page font has actually downloaded (never rejects). */
export function qcfPageFontReady(page: number): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  loadQcfPageFont(page);
  let p = ready.get(page);
  if (!p) {
    const face = new FontFace(qcfFontFamily(page), `url('${fontUrl(page)}')`);
    p = face.load().then(f => { document.fonts.add(f); }).catch(() => undefined);
    ready.set(page, p);
  }
  return p;
}
