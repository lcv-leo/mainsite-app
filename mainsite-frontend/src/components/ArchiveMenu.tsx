// Módulo: mainsite-frontend/src/components/ArchiveMenu.tsx
// Versão: v2.0.0
// Descrição: Fase 4 visual redesign — 2-column editorial grid, pill year selectors, gradient accents.

import { useMemo, useState } from 'react';
import { ChevronUp, Search, Calendar } from 'lucide-react';
import type { ActivePalette, Post } from '../types';

/** Agrupamento interno por mês. */
interface MonthGroup {
  month: string
  posts: Post[]
}

/** Agrupamento interno por ano. */
interface YearGroup {
  year: string
  months: MonthGroup[]
}

interface ArchiveMenuProps {
  posts: Post[]
  currentPost: Post | null
  setCurrentPost: (post: Post) => void
  activePalette: ActivePalette | null
  APP_VERSION: string
}

const ArchiveMenu = ({ posts, currentPost, setCurrentPost, activePalette, APP_VERSION }: ArchiveMenuProps) => {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showOlderYears, setShowOlderYears] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);

  const parsePostDate = (post: Post): Date => {
    if (!post?.created_at) return new Date(0);
    const parsed = new Date(post.created_at.replace(' ', 'T') + 'Z');
    return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
  };

  const monthFormatter = useMemo(() => new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'America/Sao_Paulo' }), []);

  const filteredArchive = useMemo(() => posts.filter(post => {
    const safeTitle = post.title || '';
    const safeContent = post.content || '';
    const matchesSearch = searchTerm === '' || safeTitle.toLowerCase().includes(searchTerm.toLowerCase()) || safeContent.toLowerCase().includes(searchTerm.toLowerCase());
    return searchTerm ? matchesSearch : (matchesSearch && post.id !== currentPost?.id);
  }), [posts, searchTerm, currentPost?.id]);

  const latestByRotation = filteredArchive.slice(0, 4);
  const historicalArchive = useMemo(() => filteredArchive.slice(4), [filteredArchive]);

  const groupedHistory = useMemo((): YearGroup[] => {
    const years: YearGroup[] = [];
    const yearMap = new Map<string, YearGroup & { monthMap: Map<string, MonthGroup> }>();

    historicalArchive.forEach((post) => {
      const postDate = parsePostDate(post);
      const year = String(postDate.getFullYear());
      const month = monthFormatter.format(postDate).toLocaleUpperCase('pt-BR');

      if (!yearMap.has(year)) {
        const entry = { year, months: [] as MonthGroup[], monthMap: new Map<string, MonthGroup>() };
        yearMap.set(year, entry);
        years.push(entry);
      }

      const yearEntry = yearMap.get(year)!;
      if (!yearEntry.monthMap.has(month)) {
        const monthEntry: MonthGroup = { month, posts: [] };
        yearEntry.monthMap.set(month, monthEntry);
        yearEntry.months.push(monthEntry);
      }

      yearEntry.monthMap.get(month)!.posts.push(post);
    });

    return years.map((entry) => ({
      year: entry.year,
      months: entry.months,
    }));
  }, [historicalArchive, monthFormatter]);

  const latestFourYears = groupedHistory.slice(0, 4);
  const olderYears = groupedHistory.slice(4);
  const hasOlderYears = groupedHistory.length > 4;
  const allYearGroups = groupedHistory;

  const resolvedSelectedYear = useMemo(() => {
    if (selectedYear && allYearGroups.some((group) => group.year === selectedYear)) return selectedYear;
    return allYearGroups[0]?.year || null;
  }, [allYearGroups, selectedYear]);

  const selectedYearGroup = useMemo(() => {
    if (!resolvedSelectedYear) return null;
    return allYearGroups.find((group) => group.year === resolvedSelectedYear) || null;
  }, [allYearGroups, resolvedSelectedYear]);

  // Derived: reset showOlderYears when history closes or no older years exist
  const effectiveShowOlderYears = showOlderYears && isHistoryOpen && hasOlderYears;

  if (!activePalette) return null;

  const isDarkBase = activePalette.bgColor && (activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1'));

  const handleSelectPost = (post: Post) => {
    setCurrentPost(post);
    setIsHistoryOpen(false);
    setSearchTerm('');
    setShowOlderYears(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const fmtDate = (raw: string | undefined | null): string | null => {
    if (!raw) return null;
    const d = new Date(raw.replace(' ', 'T') + (raw.includes('Z') || raw.includes('+') ? '' : 'Z'));
    return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const fmtDateShort = (raw: string | undefined | null): string | null => {
    if (!raw) return null;
    const d = new Date(raw.replace(' ', 'T') + (raw.includes('Z') || raw.includes('+') ? '' : 'Z'));
    return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'short', year: 'numeric' });
  };

  /** 2-column editorial post card */
  const renderEditorialCard = (post: Post) => {
    const dateStr = fmtDateShort(post.created_at) || parsePostDate(post).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    return (
      <div
        key={post.id}
        onClick={() => handleSelectPost(post)}
        className="editorial-card"
      >
        <div className="editorial-card-accent" />
        <div className="editorial-card-body">
          <div className="editorial-card-date">
            <Calendar size={12} style={{ opacity: 0.6 }} />
            {dateStr}
          </div>
          <div className="editorial-card-title">{post.title}</div>
        </div>
      </div>
    );
  };

  /** Square block for latest 4 posts (keeping featured prominence) */
  const renderFeaturedCard = (post: Post) => {
    const criado = fmtDate(post.created_at);
    const atualizado = fmtDate(post.updated_at);
    const showUpdated = atualizado && atualizado !== criado;
    return (
      <div key={post.id} className="featured-card-wrap">
        <div
          onClick={() => handleSelectPost(post)}
          className="featured-card"
        >
          <div className="featured-card-date">
            {criado || parsePostDate(post).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
            {showUpdated && <div style={{ marginTop: '2px', fontSize: '10px', opacity: 0.8 }}>Atualizado em {atualizado}</div>}
          </div>
          <div className="featured-card-title">{post.title}</div>
        </div>
      </div>
    );
  };

  return (
    <footer style={{ marginTop: '60px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: '40px' }}>
      <style>{`
        /* === PILL YEAR SELECTORS === */
        .year-pills-bar {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 8px;
          padding: 6px 24px;
          margin-top: 24px;
        }
        .year-pill {
          padding: 8px 20px;
          border-radius: 100px;
          border: 1.5px solid rgba(${isDarkBase ? '255,255,255' : '0,0,0'}, 0.12);
          background: transparent;
          color: ${activePalette.fontColor};
          font-family: inherit;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.04em;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          outline: none;
        }
        .year-pill:hover {
          border-color: #4285f4;
          color: #4285f4;
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(66, 133, 244, 0.15);
        }
        .year-pill.active {
          background: linear-gradient(135deg, #4285f4, #7c3aed);
          color: #fff;
          border-color: transparent;
          box-shadow: 0 6px 20px rgba(66, 133, 244, 0.25);
        }
        .year-pill.active:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(66, 133, 244, 0.35);
          color: #fff;
        }
        .show-older-pill {
          padding: 8px 20px;
          border-radius: 100px;
          border: 1.5px dashed rgba(${isDarkBase ? '255,255,255' : '0,0,0'}, 0.15);
          background: transparent;
          color: ${activePalette.fontColor};
          font-family: inherit;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.3s ease;
          opacity: 0.6;
        }
        .show-older-pill:hover { opacity: 1; border-color: #4285f4; color: #4285f4; }

        /* === FEATURED CARDS (top 4) === */
        .featured-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          padding: 0 24px;
          margin-top: 20px;
          width: 100%;
          box-sizing: border-box;
        }
        @media (max-width: 480px) { .featured-grid { grid-template-columns: 1fr; } }
        .featured-card-wrap { display: flex; }
        .featured-card {
          flex: 1;
          padding: 20px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          box-sizing: border-box;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          border-radius: 20px;
          background-color: ${isDarkBase ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.5)'};
          border: 1px solid ${isDarkBase ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};
          backdrop-filter: blur(var(--glass-blur-standard));
          -webkit-backdrop-filter: blur(var(--glass-blur-standard));
          box-shadow: 0 8px 24px rgba(0,0,0,0.05);
        }
        .featured-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 16px 32px rgba(0,0,0,0.1) !important;
          border-color: ${activePalette.titleColor}60;
        }
        .featured-card-date {
          font-size: 11px;
          opacity: 0.65;
          margin-bottom: 10px;
          font-weight: 600;
          letter-spacing: 0.3px;
        }
        .featured-card-title {
          font-size: 14px;
          font-weight: 600;
          color: ${activePalette.titleColor};
          transition: color 0.5s ease;
          line-height: 1.35;
        }

        /* === 2-COLUMN EDITORIAL GRID === */
        .editorial-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          padding: 0;
          width: 100%;
          box-sizing: border-box;
        }
        @media (max-width: 600px) { .editorial-grid { grid-template-columns: 1fr; } }

        .editorial-card {
          display: flex;
          align-items: stretch;
          cursor: pointer;
          border-radius: 12px;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          background: ${isDarkBase ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'};
          border: 1px solid transparent;
        }
        .editorial-card:hover {
          background: ${isDarkBase ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'};
          border-color: ${isDarkBase ? 'rgba(138,180,248,0.25)' : 'rgba(66,133,244,0.2)'};
          transform: translateX(4px);
        }
        .editorial-card-accent {
          width: 3px;
          min-height: 100%;
          background: linear-gradient(180deg, #4285f4, #7c3aed);
          border-radius: 3px 0 0 3px;
          flex-shrink: 0;
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .editorial-card:hover .editorial-card-accent { opacity: 1; }

        .editorial-card-body {
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
        }
        .editorial-card-date {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          opacity: 0.5;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .editorial-card-title {
          font-size: 13px;
          font-weight: 600;
          color: ${activePalette.titleColor};
          line-height: 1.4;
          transition: color 0.3s ease;
        }
        .editorial-card:hover .editorial-card-title { color: #4285f4; }

        /* === ARCHIVE SECTIONS === */
        .archive-group {
          margin: 16px 24px 0 24px;
          padding-top: 18px;
          border-top: 1px solid rgba(${isDarkBase ? '255,255,255' : '0,0,0'},0.08);
        }
        .archive-year-title {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.12em;
          margin: 0 0 14px 0;
          opacity: 0.85;
          text-transform: uppercase;
        }
        .archive-month-title {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          margin: 18px 0 8px 0;
          opacity: 0.55;
          text-transform: uppercase;
        }

        /* === OLDER YEARS ACCORDION === */
        .archive-older-years-wrap {
          overflow: hidden;
          transition: max-height 0.45s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s ease;
        }
        .archive-older-years-wrap.closed { max-height: 0; opacity: 0; pointer-events: none; }
        .archive-older-years-wrap.open { max-height: 1200px; opacity: 1; pointer-events: auto; }

        .archive-btn:hover { opacity: 1 !important; transform: translateY(-2px); }
      `}</style>

      <button onClick={() => setIsHistoryOpen(!isHistoryOpen)} style={{ background: 'none', border: 'none', fontSize: '11px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', opacity: 0.8, transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }} className="archive-btn">
        <span style={{ letterSpacing: '0.12em', color: activePalette.fontColor, transition: 'color 0.5s ease', fontWeight: '600' }}>
          FRAGMENTOS ANTERIORES
        </span>
        <ChevronUp size={20} color={activePalette.fontColor} style={{ transform: isHistoryOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }} />
      </button>

      <div style={{ maxHeight: isHistoryOpen ? '3000px' : '0', opacity: isHistoryOpen ? 1 : 0, overflow: 'hidden', transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)', width: '100%', maxWidth: '900px' }}>
        <div style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid rgba(${isDarkBase ? '255,255,255' : '0,0,0'},0.15)`, margin: '30px 24px 0 24px', paddingBottom: '16px' }}>
          <Search size={18} style={{ opacity: 0.4, marginRight: '14px', flexShrink: 0 }} color={activePalette.fontColor} />
          <input
            id="archive-keyword-search"
            name="archiveKeywordSearch"
            type="text"
            autoComplete="off"
            placeholder="Busca por palavras-chave..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ background: 'none', border: 'none', color: 'inherit', fontFamily: 'inherit', fontSize: '13px', width: '100%', letterSpacing: '0.3px', fontWeight: '500', outline: 'none' }}
          />
        </div>

        {filteredArchive.length > 0 ? (
          <>
            {/* Featured Posts — top 4 in 2-col grid */}
            {latestByRotation.length > 0 && (
              <div className="featured-grid">
                {latestByRotation.map(renderFeaturedCard)}
              </div>
            )}

            {/* Year Pills */}
            {allYearGroups.length > 0 && (
              <div className="year-pills-bar">
                {latestFourYears.map((yearGroup) => (
                  <button
                    key={yearGroup.year}
                    type="button"
                    onClick={() => setSelectedYear(yearGroup.year)}
                    className={`year-pill ${resolvedSelectedYear === yearGroup.year ? 'active' : ''}`}
                  >
                    {yearGroup.year}
                  </button>
                ))}

                {hasOlderYears && !effectiveShowOlderYears && (
                  <button
                    type="button"
                    onClick={() => setShowOlderYears(true)}
                    className="show-older-pill"
                  >
                    + Anteriores
                  </button>
                )}

                {/* Older year pills revealed */}
                {hasOlderYears && (
                  <div className={`archive-older-years-wrap ${effectiveShowOlderYears ? 'open' : 'closed'}`} style={{ display: 'contents' }}>
                    {effectiveShowOlderYears && olderYears.map((yearGroup) => (
                      <button
                        key={yearGroup.year}
                        type="button"
                        onClick={() => setSelectedYear(yearGroup.year)}
                        className={`year-pill ${resolvedSelectedYear === yearGroup.year ? 'active' : ''}`}
                      >
                        {yearGroup.year}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Selected Year Content — 2-column editorial grid */}
            {selectedYearGroup && (
              <div className="archive-group">
                <h3 className="archive-year-title" style={{ color: activePalette.fontColor }}>{selectedYearGroup.year}</h3>

                {selectedYearGroup.months.map((monthGroup) => (
                  <div key={`${selectedYearGroup.year}-${monthGroup.month}`}>
                    <h4 className="archive-month-title" style={{ color: activePalette.fontColor }}>{monthGroup.month}</h4>
                    <div className="editorial-grid">
                      {monthGroup.posts.map(renderEditorialCard)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
          ) : (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', opacity: 0.6, fontSize: '13px', padding: '40px 0', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '700' }}>
              Nenhum registro encontrado.
            </div>
          )}

      </div>
      <div style={{ marginTop: '40px', fontSize: '11px', opacity: 0.5, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '600' }}>{APP_VERSION}</div>
    </footer>
  );
};

export default ArchiveMenu;
