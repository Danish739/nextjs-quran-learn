import React, { Dispatch, SetStateAction } from "react";
import { Track, Reciter, RECITERS, SURAHS_DATA, GRADIENTS } from "@/data/quran-player-data";
import { Icons } from "./PlayerIcons";
import { SurahArt } from "./SurahArt";
import { TRANSLATION_LANGS } from "@/data/translation-audio";

interface SidebarProps {
  mobileView: 'home' | 'search' | 'library';
  setMobileView: (v: 'home' | 'search' | 'library') => void;
  setShowSearchView: Dispatch<SetStateAction<boolean>>;
  selectedReciterPlaylist: Reciter | null;
  setSelectedReciterPlaylist: (r: Reciter | null) => void;
  setSearchQuery: (q: string) => void;
  setShowCreatePlaylist: (v: boolean) => void;
  activeFilter: string;
  setActiveFilter: (f: string) => void;
  currentReciter: Reciter;
  currentTrack: Track | null;
  openReciterPlaylist: (r: Reciter) => void;
  playTrack: (t: Track) => void;
  mainRef: React.RefObject<HTMLDivElement | null>;
  tracks: Track[];
  likedTracksData: Track[];
  translation: { langId: string; mode: 'both' | 'only' } | null;
  pendingMode: 'both' | 'only';
  onSelectTranslation: (langId: string) => void;
  onTranslationMode: (mode: 'both' | 'only') => void;
  onStopTranslation: () => void;
  onPlayTranslationSurah: (t: Track) => void;
}

export function Sidebar({
  mobileView, setMobileView, setShowSearchView,
  selectedReciterPlaylist, setSelectedReciterPlaylist, setSearchQuery,
  setShowCreatePlaylist, activeFilter, setActiveFilter,
  currentReciter, currentTrack, openReciterPlaylist,
  playTrack, mainRef, tracks, likedTracksData,
  translation, pendingMode, onSelectTranslation, onTranslationMode, onStopTranslation, onPlayTranslationSurah
}: SidebarProps) {
  const trMode = translation?.mode ?? pendingMode;

  return (
    <aside className="sp-sidebar">
      {/* Nav */}
      <nav className="sp-sidebar-nav">
        <button
          className={`sp-sidebar-nav-item${!selectedReciterPlaylist && mobileView === 'home' ? ' active' : ''}`}
          onClick={() => { setSelectedReciterPlaylist(null); setMobileView('home'); setSearchQuery(''); }}
          title="Home"
        >
          <Icons.Home />
          <span>Home</span>
        </button>
        <button
          className={`sp-sidebar-nav-item${mobileView === 'search' ? ' active' : ''}`}
          onClick={() => { setMobileView('search'); setShowSearchView(v => !v); }}
          title="Search"
        >
          <Icons.Search />
          <span>Search</span>
        </button>
      </nav>

      {/* Library */}
      <div className="sp-sidebar-library">
        <div className="sp-library-header">
          <div className="sp-library-title">
            <Icons.Library />
            <span>Your Library</span>
          </div>
          <div className="sp-library-actions">
            <button
              className="sp-library-action-btn"
              title="Create playlist"
              aria-label="Create playlist"
              onClick={() => setShowCreatePlaylist(true)}
            >
              <Icons.Plus />
            </button>
          </div>
        </div>

        {/* Filter chips */}
        <div className="sp-library-filters">
          {["All", "Surahs", "Reciters", "Translations"].map(f => (
            <button
              key={f}
              className={`sp-filter-chip${activeFilter === f ? " active" : ""}`}
              onClick={() => setActiveFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Library items */}
        <div className="sp-library-list">

          {/* Translation audio */}
          {activeFilter === "Translations" && (
            <div className="sp-tr">
              <div className="sp-tr-seg" role="group" aria-label="What to play">
                <button className={trMode === 'both' ? 'on' : ''} onClick={() => onTranslationMode('both')}>Arabic + Translation</button>
                <button className={trMode === 'only' ? 'on' : ''} onClick={() => onTranslationMode('only')}>Translation only</button>
              </div>
              <p className="sp-tr-hint">
                {trMode === 'both' ? 'Each ayah in Arabic, then its translation.' : 'Translation only, ayah by ayah.'}{' '}
                When a surah ends, the next one starts on its own.
              </p>

              <div className="sp-tr-label">Language</div>
              {TRANSLATION_LANGS.map(l => {
                const on = translation?.langId === l.id;
                return (
                  <div key={l.id} className={`sp-library-item${on ? " active" : ""}`} onClick={() => onSelectTranslation(l.id)}>
                    <div className="sp-library-item-art sp-tr-art" dir={l.dir}>{l.native.slice(0, 3)}</div>
                    <div className="sp-library-item-info">
                      <div className={`sp-library-item-name${on ? " playing" : ""}`}>{l.name}</div>
                      <div className="sp-library-item-meta">{l.reciter}</div>
                    </div>
                    {on && <span className="sp-tr-badge">On</span>}
                  </div>
                );
              })}
              {translation && (
                <button className="sp-tr-off" onClick={onStopTranslation}>Back to normal recitation</button>
              )}

              <div className="sp-tr-label">Surah</div>
              {tracks.map((t, i) => (
                <div
                  key={t.id}
                  className={`sp-library-item${translation && currentTrack?.id === t.id ? " active" : ""}`}
                  onClick={() => onPlayTranslationSurah(t)}
                >
                  <div className="sp-library-item-art">
                    <SurahArt number={t.id} name={t.englishName} gradient={GRADIENTS[i % GRADIENTS.length]} size="small" />
                  </div>
                  <div className="sp-library-item-info">
                    <div className={`sp-library-item-name${translation && currentTrack?.id === t.id ? " playing" : ""}`}>{t.englishName}</div>
                    <div className="sp-library-item-meta">{t.translation} · {t.ayahs} ayahs</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Liked Tracks Area (if liked tracks exist) */}
          {(activeFilter === "All" || activeFilter === "Surahs") && likedTracksData.length > 0 && (
            <div
              className={`sp-library-item`}
              onClick={() => playTrack(likedTracksData[0])} // Just play first liked for now
            >
              <div className="sp-library-item-art" style={{ background: 'linear-gradient(135deg, #450af5, #c4efd9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icons.HeartFilled />
              </div>
              <div className="sp-library-item-info">
                <div className={`sp-library-item-name`}>Liked Tracks</div>
                <div className="sp-library-item-meta">{likedTracksData.length} saved</div>
              </div>
            </div>
          )}

          {/* Reciter section */}
          {(activeFilter === "All" || activeFilter === "Reciters") && RECITERS.map(r => (
            <div
              key={r.id}
              className={`sp-library-item${currentReciter.id === r.id ? " active" : ""}`}
              onClick={() => openReciterPlaylist(r)}
            >
              <div className="sp-library-item-art circle">
                <img src={r.image} alt={r.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              </div>
              <div className="sp-library-item-info">
                <div className={`sp-library-item-name${currentReciter.id === r.id ? " playing" : ""}`}>{r.name}</div>
                <div className="sp-library-item-meta">Reciter</div>
              </div>
            </div>
          ))}

          {/* Quick Surah section */}
          {(activeFilter === "All" || activeFilter === "Surahs") && SURAHS_DATA.slice(0, 12).map((s, i) => (
            <div
              key={s.number}
              className={`sp-library-item${currentTrack?.id === s.number ? " active" : ""}`}
              onClick={() => playTrack(tracks[i])}
            >
              <div className="sp-library-item-art">
                <SurahArt number={s.number} name={s.name} gradient={GRADIENTS[i % GRADIENTS.length]} size="small" />
              </div>
              <div className="sp-library-item-info">
                <div className={`sp-library-item-name${currentTrack?.id === s.number ? " playing" : ""}`}>{s.name}</div>
                <div className="sp-library-item-meta">{s.translation} · {s.ayahs} ayahs</div>
              </div>
            </div>
          ))}
        </div>


      </div>
    </aside>
  );
}
