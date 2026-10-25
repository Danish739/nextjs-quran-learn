import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// fawazahmed0 Hadith API hosted on jsDelivr CDN — completely free, no API key
const CDN = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions';

const BOOKS = ['bukhari', 'muslim', 'abudawud', 'tirmidhi', 'nasai', 'ibnmajah'] as const;
const VALID_COLLECTIONS = new Set<string>([...BOOKS, 'all']);

/** Strips Arabic diacritics and tatweel so plain-letter queries match fully-vowelled hadith text */
const normAr = (t: string) => t.replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '').replace(/[أإآٱ]/g, 'ا');
const HAS_ARABIC = /[؀-ۿ]/;

/**
 * The source edition drops each narration's final punctuation, so most end mid-quote:
 * `…a sign of hypocrisy` instead of `…a sign of hypocrisy."`. Restore the full stop and
 * close a double quote left open. Single quotes are left alone: the translation also uses
 * ' for the letter ʿayn in names ('Umar, 'Aisha), so they can't be counted reliably.
 */
function tidyEnglish(raw: string) {
  const t = raw.replace(/\s+/g, ' ').trim();
  if (!t) return t;
  // already finished (possibly followed by closing quotes/brackets): don't add another stop
  let end = /[.!?…]['"’”)\]]*$/.test(t) ? '' : '.';
  if ((t.match(/"/g) ?? []).length % 2 === 1) end += '"';
  return t + end;
}

const cache = new Map<string, { 
  metadata: any;
  hadiths: { number: number; english: string; arabic: string; chapter: string; sectionId: string }[] 
}>();

async function loadBook(book: string) {
  if (cache.has(book)) return cache.get(book)!;

  const [engRes, araRes] = await Promise.all([
    fetch(`${CDN}/eng-${book}.min.json`, { next: { revalidate: 86400 } }),
    fetch(`${CDN}/ara-${book}.min.json`, { next: { revalidate: 86400 } }),
  ]);

  if (!engRes.ok) throw new Error(`Failed to load English edition: ${engRes.status}`);

  const engData = await engRes.json();
  const araData = araRes.ok ? await araRes.json() : null;

  // Build Arabic lookup map
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const araMap = new Map<number, string>();
  if (araData?.hadiths) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const h of araData.hadiths as any[]) {
      araMap.set(Number(h.hadithnumber), String(h.text ?? '').trim());
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const merged = (engData.hadiths as any[]).map((h: any) => ({
    number:  Number(h.hadithnumber),
    english: tidyEnglish(String(h.text ?? '')),
    arabic:  araMap.get(Number(h.hadithnumber)) ?? '',
    chapter: String(h.reference?.book ?? '').trim(),
    sectionId: String(h.reference?.book ?? '0'),
  })).filter(h => h.english.length > 0);

  const result = { metadata: engData.metadata, hadiths: merged };
  cache.set(book, result);
  return result;
}

/** Search every collection at once; results keep collection order and carry their collection id. */
async function searchAll(query: string, page: number, limit: number, only: string | null) {
  const q = query.toLowerCase();
  const arabic = HAS_ARABIC.test(query);
  const nq = arabic ? normAr(query) : '';

  const loaded = await Promise.allSettled(BOOKS.map(b => loadBook(b)));
  const counts: Record<string, number> = {};
  const unavailable: string[] = [];
  const matches: { collection: string; number: string; english: string; arabic: string; chapter: string }[] = [];

  loaded.forEach((r, i) => {
    const book = BOOKS[i];
    if (r.status !== 'fulfilled') { unavailable.push(book); return; }
    const { metadata, hadiths } = r.value;
    let n = 0;
    for (const h of hadiths) {
      const hit = h.english.toLowerCase().includes(q) || (arabic && normAr(h.arabic).includes(nq));
      if (!hit) continue;
      n++;
      if (!only || only === book) {
        matches.push({
          collection: book,
          number: String(h.number),
          english: h.english,
          arabic: h.arabic,
          chapter: h.chapter ? (metadata.sections[h.chapter] || `Book ${h.chapter}`) : '',
        });
      }
    }
    counts[book] = n;
  });

  if (unavailable.length === BOOKS.length) {
    return NextResponse.json({ error: 'Failed to load hadith collections.' }, { status: 502 });
  }

  const total = matches.length;
  const start = (page - 1) * limit;
  return NextResponse.json({
    hadiths: matches.slice(start, start + limit),
    counts,
    unavailable,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const collection = searchParams.get('collection') ?? 'bukhari';
  const page       = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit      = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? 20)));
  const query      = searchParams.get('search')?.trim() ?? '';

  if (!VALID_COLLECTIONS.has(collection)) {
    return NextResponse.json({ error: 'Invalid collection name.' }, { status: 400 });
  }

  try {
    if (collection === 'all') {
      if (!query) return NextResponse.json({ error: 'A search term is required to search all collections.' }, { status: 400 });
      return await searchAll(query, page, limit, searchParams.get('only'));
    }
    const { metadata, hadiths: allHadiths } = await loadBook(collection);
    let hadiths = allHadiths;

    const section = searchParams.get('section');
    if (section) {
      hadiths = hadiths.filter(h => h.sectionId === section);
    }

    // Search filter
    if (query) {
      const q = query.toLowerCase();
      hadiths = hadiths.filter(h =>
        h.english.toLowerCase().includes(q) ||
        (HAS_ARABIC.test(query) && normAr(h.arabic).includes(normAr(query))) ||
        String(h.number) === query
      );
    }

    const total      = hadiths.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start      = (page - 1) * limit;
    const slice      = hadiths.slice(start, start + limit);

    return NextResponse.json({
      hadiths: slice.map(h => ({
        number:  String(h.number),
        english: h.english,
        arabic:  h.arabic,
        grade:   '',
        chapter: h.chapter ? (metadata.sections[h.chapter] || `Book ${h.chapter}`) : '',
      })),
      metadata: {
        name: metadata.name,
        sections: metadata.sections,
        section_details: metadata.section_details
      },
      total,
      page,
      limit,
      totalPages,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to load hadith collection: ${msg}` }, { status: 502 });
  }
}

