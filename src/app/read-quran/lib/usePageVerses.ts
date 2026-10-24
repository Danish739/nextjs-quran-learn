'use client';

import { useEffect, useState } from 'react';
import type { VerseWithTranslation } from './api';
import { qcfPageFontReady } from './qcf';

const API = 'https://api.quran.com/api/v4';

// One request per Mushaf page, cached for the session
const cache = new Map<string, Promise<VerseWithTranslation[]>>();

function fetchPage(surah: number, page: number, translationId: string): Promise<VerseWithTranslation[]> {
  const key = `${surah}:${page}:${translationId}`;
  let p = cache.get(key);
  if (!p) {
    const url =
      `${API}/verses/by_page/${page}?language=en&words=true&translations=${translationId}` +
      `&fields=text_uthmani,code_v2` +
      `&word_fields=text_uthmani,code_v2,line_number,page_number,char_type_name,translation,transliteration` +
      `&translation_fields=text,resource_name&per_page=50`;
    p = fetch(url)
      .then(r => {
        if (!r.ok) throw new Error('Could not load this page');
        return r.json();
      })
      .then(data =>
        (data.verses || [])
          .filter((v: any) => String(v.verse_key).startsWith(`${surah}:`))
          .map((v: any) => ({
            id: v.id,
            verse_key: v.verse_key,
            verse_number: v.verse_number,
            hizb_number: v.hizb_number || 1,
            rub_el_hizb_number: v.rub_el_hizb_number || 1,
            ruku_number: v.ruku_number || 1,
            manzil_number: v.manzil_number || 1,
            sajdah_number: v.sajdah_number || null,
            page_number: v.page_number || page,
            juz_number: v.juz_number || 1,
            text_uthmani: v.text_uthmani,
            translations: v.translations || [],
            words: (v.words || []).map((w: any) => ({
              id: w.id,
              position: w.position,
              char_type_name: w.char_type_name,
              text_uthmani: w.text_uthmani,
              code_v2: w.code_v2,
              line_number: w.line_number,
              page_number: w.page_number || page,
              translation: w.translation || { text: '', language_name: 'english' },
              transliteration: w.transliteration || { text: '', language_name: 'english' },
              audio_url: w.audio_url || null,
            })),
          })) as VerseWithTranslation[]
      );
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

/** Ayahs of `surah` on one Mushaf page (with words + translation); prefetches the next page. */
export function usePageVerses(surah: number, page: number | null, lastPage: number, translationId: string, retry = 0) {
  const [verses, setVerses] = useState<VerseWithTranslation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (page == null) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    // show the page only once its Mushaf font is in, so glyphs never flash blank
    Promise.all([fetchPage(surah, page, translationId), qcfPageFontReady(page)])
      .then(([vs]) => {
        if (cancelled) return;
        setVerses(vs);
        setLoading(false);
        if (page + 1 <= lastPage) {
          fetchPage(surah, page + 1, translationId).catch(() => undefined);
          qcfPageFontReady(page + 1);
        }
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load this page');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [surah, page, lastPage, translationId, retry]);

  return { verses, loading, error };
}
