// Módulo: mainsite-frontend/src/components/ArchiveMenu.jsx
// Versão: v1.2.0
// Descrição: Componente isolado para a listagem e busca. Atualizado 100% para métricas Glassmorphism + MD3 e Timezone America/Sao_Paulo cravado.

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronUp, Search } from 'lucide-react';

const ArchiveMenu = ({ posts, currentPost, setCurrentPost, activePalette, APP_VERSION }) => {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showOlderYears, setShowOlderYears] = useState(false);
  const [selectedYear, setSelectedYear] = useState(null);

  if (!activePalette) return null;

  const isDarkBase = activePalette.bgColor && (activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1'));

  const parsePostDate = (post) => {
    if (!post?.created_at) return new Date(0);
    const parsed = new Date(post.created_at.replace(' ', 'T') + 'Z');
    return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
  };

  const monthFormatter = useMemo(() => new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'America/Sao_Paulo' }), []);

  const filteredArchive = posts.filter(post => {
    const safeTitle = post.title || '';
    const safeContent = post.content || '';
    const matchesSearch = searchTerm === '' || safeTitle.toLowerCase().includes(searchTerm.toLowerCase()) || safeContent.toLowerCase().includes(searchTerm.toLowerCase());
    return searchTerm ? matchesSearch : (matchesSearch && post.id !== currentPost?.id);
  });

  const latestByRotation = filteredArchive.slice(0, 4);
  const historicalArchive = filteredArchive.slice(4);

  const groupedHistory = useMemo(() => {
    const years = [];
    const yearMap = new Map();

    historicalArchive.forEach((post) => {
      const postDate = parsePostDate(post);
      const year = String(postDate.getFullYear());
      const month = monthFormatter.format(postDate).toLocaleUpperCase('pt-BR');

      if (!yearMap.has(year)) {
        yearMap.set(year, { year, months: [], monthMap: new Map() });
        years.push(yearMap.get(year));
      }

      const yearEntry = yearMap.get(year);
      if (!yearEntry.monthMap.has(month)) {
        yearEntry.monthMap.set(month, { month, posts: [] });
        yearEntry.months.push(yearEntry.monthMap.get(month));
      }

      yearEntry.monthMap.get(month).posts.push(post);
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

  useEffect(() => {
    if (!isHistoryOpen) setShowOlderYears(false);
  }, [isHistoryOpen]);

  useEffect(() => {
    if (!hasOlderYears) setShowOlderYears(false);
  }, [hasOlderYears]);

  const handleSelectPost = (post) => {
    setCurrentPost(post);
    setIsHistoryOpen(false);
    setSearchTerm('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const styles = {
    footer: { marginTop: '60px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: '40px' },
    archiveToggle: { background: 'none', border: 'none', fontSize: '11px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', opacity: 0.8, transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)' },
    card: { padding: '24px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)', borderRadius: '24px' },
    cardDate: { fontSize: '10px', opacity: 0.7, marginBottom: '16px', fontWeight: '800', letterSpacing: '0.5px' },
    squareBlock: { width: 'min(100%, 220px)', aspectRatio: '1 / 1', borderRadius: '24px', padding: '18px', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', boxSizing: 'border-box', transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)' },
    expandBar: { width: '100%', minHeight: '92px', borderRadius: '20px', cursor: 'pointer', marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '0.2em', fontSize: '12px', fontWeight: '900', textTransform: 'uppercase', transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)', background: 'none', color: activePalette.fontColor }
  };

  const renderPostCard = (post) => (
    <div
      key={post.id}
      onClick={() => handleSelectPost(post)}
      className="glass-card-md3"
      style={styles.card}
    >
      <div style={styles.cardDate}>{parsePostDate(post).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</div>
      <div style={{ fontSize: '13px', textTransform: 'uppercase', fontWeight: '800', color: activePalette.titleColor, transition: 'color 0.5s ease', lineHeight: '1.4' }}>{post.title}</div>
    </div>
  );

  return (
    <footer style={styles.footer}>
      <style>{`
        .archive-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 24px; padding: 0; width: 100%; box-sizing: border-box; }
        .archive-group { margin: 12px 24px 0 24px; padding-top: 18px; border-top: 1px solid rgba(${isDarkBase ? '255,255,255' : '0,0,0'},0.08); }
        .archive-year-title { font-size: 12px; font-weight: 900; letter-spacing: 0.22em; margin: 0 0 14px 0; opacity: 0.85; text-transform: uppercase; }
        .archive-month-title { font-size: 11px; font-weight: 800; letter-spacing: 0.18em; margin: 0 0 10px 0; opacity: 0.7; }
        .archive-month-block + .archive-month-block { margin-top: 20px; }
        .archive-square-row {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 18px;
          width: 100%;
          padding: 0;
        }
        .archive-square-item {
          width: min(100%, 220px);
        }
        .archive-row-container {
          margin: 14px 24px 0 24px;
        }
        .archive-older-years-wrap {
          overflow: hidden;
          transition: max-height 0.45s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s ease, transform 0.35s ease;
          transform-origin: top center;
        }
        .archive-older-years-wrap.closed {
          max-height: 0;
          opacity: 0;
          transform: translateY(-10px);
          pointer-events: none;
        }
        .archive-older-years-wrap.open {
          max-height: 1200px;
          opacity: 1;
          transform: translateY(0);
          pointer-events: auto;
        }
        .archive-square-hover:hover {
          transform: translateY(-4px);
          box-shadow: 0 16px 32px rgba(0,0,0,0.1) !important;
          border-color: ${activePalette.titleColor}60;
        }
        .archive-btn:hover { opacity: 1 !important; transform: translateY(-2px); }
        .glass-card-md3 {
           background-color: ${isDarkBase ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.5)'};
           border: 1px solid ${isDarkBase ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};
           backdrop-filter: blur(var(--glass-blur-standard));
           -webkit-backdrop-filter: blur(var(--glass-blur-standard));
           box-shadow: 0 8px 24px rgba(0,0,0,0.05);
        }
        .glass-card-md3:hover { transform: translateY(-4px); box-shadow: 0 16px 32px rgba(0,0,0,0.1) !important; border-color: ${activePalette.titleColor}40; }
      `}</style>

      <button onClick={() => setIsHistoryOpen(!isHistoryOpen)} style={styles.archiveToggle} className="archive-btn">
        <span style={{ letterSpacing: '0.28em', color: activePalette.fontColor, transition: 'color 0.5s ease', fontWeight: '800' }}>
          FRAGMENTOS ANTERIORES
        </span>
        <ChevronUp size={20} color={activePalette.fontColor} style={{ transform: isHistoryOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }} />
      </button>

      <div style={{ maxHeight: isHistoryOpen ? '2000px' : '0', opacity: isHistoryOpen ? 1 : 0, overflow: 'hidden', transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)', width: '100%', maxWidth: '1200px' }}>
        <div style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid rgba(${isDarkBase ? '255,255,255' : '0,0,0'},0.2)`, margin: '30px 24px 0 24px', paddingBottom: '16px' }}>
          <Search size={20} style={{ opacity: 0.6, marginRight: '16px' }} color={activePalette.fontColor} />
          <input
            id="archive-keyword-search"
            name="archiveKeywordSearch"
            type="text"
            autoComplete="off"
            placeholder="BUSCA EXATA POR PALAVRAS-CHAVE..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ background: 'none', border: 'none', color: 'inherit', fontFamily: 'inherit', fontSize: '13px', width: '100%', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '700' }}
          />
        </div>

        {filteredArchive.length > 0 ? (
          <>
            {latestByRotation.length > 0 && (
              <div className="archive-row-container">
                <div className="archive-square-row">
                  {latestByRotation.map((post) => (
                    <div key={post.id} className="archive-square-item">
                      <div
                        onClick={() => handleSelectPost(post)}
                        className="glass-card-md3 archive-square-hover"
                        style={styles.squareBlock}
                      >
                        <div style={{ ...styles.cardDate, marginBottom: '12px' }}>
                          {parsePostDate(post).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                        </div>
                        <div style={{ fontSize: '13px', textTransform: 'uppercase', fontWeight: '800', color: activePalette.titleColor, lineHeight: '1.35' }}>{post.title}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {latestFourYears.length > 0 && (
              <div className="archive-row-container">
                <div className="archive-square-row">
                  {latestFourYears.map((yearGroup) => (
                    <div key={yearGroup.year} className="archive-square-item">
                      <div
                        onClick={() => setSelectedYear(yearGroup.year)}
                        className="glass-card-md3 archive-square-hover"
                        style={{
                          ...styles.squareBlock,
                          borderColor: resolvedSelectedYear === yearGroup.year ? `${activePalette.titleColor}90` : undefined,
                          boxShadow: resolvedSelectedYear === yearGroup.year ? `0 0 0 2px ${activePalette.titleColor}35 inset` : undefined,
                        }}
                      >
                        <div style={{ fontSize: '34px', lineHeight: 1, fontWeight: '900', color: activePalette.titleColor, letterSpacing: '0.06em' }}>
                          {yearGroup.year}
                        </div>
                        <div style={{ marginTop: '14px', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', opacity: 0.72, fontWeight: '800' }}>
                          {yearGroup.months.length} MESES
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {hasOlderYears && (
                  <div style={{ marginTop: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setShowOlderYears((prev) => !prev)}
                      aria-expanded={showOlderYears}
                      aria-controls="archive-older-years"
                      className="glass-card-md3 archive-square-hover"
                      style={styles.expandBar}
                    >
                      ANOS ANTERIORES {showOlderYears ? '▲' : '▼'}
                    </button>
                  </div>
                )}

                {hasOlderYears && (
                  <div
                    id="archive-older-years"
                    className={`archive-older-years-wrap ${showOlderYears ? 'open' : 'closed'}`}
                    aria-hidden={!showOlderYears}
                  >
                    <div className="archive-square-row" style={{ marginTop: '16px' }}>
                      {olderYears.map((yearGroup, index) => (
                        <div key={yearGroup.year} className="archive-square-item">
                          <div
                            onClick={() => setSelectedYear(yearGroup.year)}
                            className="glass-card-md3 archive-square-hover"
                            style={{
                              ...styles.squareBlock,
                              borderColor: resolvedSelectedYear === yearGroup.year ? `${activePalette.titleColor}90` : undefined,
                              boxShadow: resolvedSelectedYear === yearGroup.year ? `0 0 0 2px ${activePalette.titleColor}35 inset` : undefined,
                              opacity: showOlderYears ? 1 : 0,
                              transform: showOlderYears ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.985)',
                              transition: `opacity 0.3s ease ${60 + (index * 45)}ms, transform 0.36s cubic-bezier(0.16, 1, 0.3, 1) ${60 + (index * 45)}ms`,
                            }}
                          >
                            <div style={{ fontSize: '34px', lineHeight: 1, fontWeight: '900', color: activePalette.titleColor, letterSpacing: '0.06em' }}>
                              {yearGroup.year}
                            </div>
                            <div style={{ marginTop: '14px', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', opacity: 0.72, fontWeight: '800' }}>
                              {yearGroup.months.length} MESES
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedYearGroup && (
              <div key={selectedYearGroup.year} className="archive-group">
                <h3 className="archive-year-title" style={{ color: activePalette.fontColor }}>{selectedYearGroup.year}</h3>

                {selectedYearGroup.months.map((monthGroup) => (
                  <div key={`${selectedYearGroup.year}-${monthGroup.month}`} className="archive-month-block">
                    <h4 className="archive-month-title" style={{ color: activePalette.fontColor }}>{monthGroup.month}</h4>
                    <div className="archive-grid" style={{ padding: '0 0 8px 0' }}>
                      {monthGroup.posts.map(renderPostCard)}
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
      <div style={{ marginTop: '40px', fontSize: '11px', opacity: 0.5, letterSpacing: '3px', textTransform: 'uppercase', fontWeight: '800' }}>{APP_VERSION}</div>
    </footer>
  );
};

export default ArchiveMenu;