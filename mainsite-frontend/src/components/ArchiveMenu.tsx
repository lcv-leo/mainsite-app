/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
// Módulo: mainsite-frontend/src/components/ArchiveMenu.tsx
// Versão: v2.0.0
// Descrição: Fase 4 visual redesign — 2-column editorial grid, pill year selectors, gradient accents.

import { Calendar, ChevronUp, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ActivePalette, Post } from '../types';
import './ArchiveMenu.css';

/** Agrupamento interno por mês. */
interface MonthGroup {
  month: string;
  posts: Post[];
}

/** Agrupamento interno por ano. */
interface YearGroup {
  year: string;
  months: MonthGroup[];
}

interface ArchiveMenuProps {
  posts: Post[];
  currentPost: Post | null;
  setCurrentPost: (post: Post) => void;
  activePalette: ActivePalette | null;
  APP_VERSION: string;
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

  const monthFormatter = useMemo(
    () => new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'America/Sao_Paulo' }),
    [],
  );

  const filteredArchive = useMemo(
    () =>
      posts.filter((post) => {
        const safeTitle = post.title || '';
        const safeContent = post.content || '';
        const matchesSearch =
          searchTerm === '' ||
          safeTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
          safeContent.toLowerCase().includes(searchTerm.toLowerCase());
        return searchTerm ? matchesSearch : matchesSearch && post.id !== currentPost?.id;
      }),
    [posts, searchTerm, currentPost?.id],
  );

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
    return d.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const fmtDateShort = (raw: string | undefined | null): string | null => {
    if (!raw) return null;
    const d = new Date(raw.replace(' ', 'T') + (raw.includes('Z') || raw.includes('+') ? '' : 'Z'));
    return d.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  /** 2-column editorial post card */
  const renderEditorialCard = (post: Post) => {
    const dateStr =
      fmtDateShort(post.created_at) ||
      parsePostDate(post).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    return (
      <div key={post.id} onClick={() => handleSelectPost(post)} className="editorial-card">
        <div className="editorial-card-accent" />
        <div className="editorial-card-body">
          <div className="editorial-card-date">
            <Calendar size={12} className="editorial-card-date-icon" />
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
        <div onClick={() => handleSelectPost(post)} className="featured-card">
          <div className="featured-card-date">
            {criado || parsePostDate(post).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
            {showUpdated && <div className="featured-card-updated">Atualizado em {atualizado}</div>}
          </div>
          <div className="featured-card-title">{post.title}</div>
        </div>
      </div>
    );
  };

  return (
    <footer className="archive-menu">
      <button onClick={() => setIsHistoryOpen(!isHistoryOpen)} className="archive-menu__toggle">
        <span className="archive-menu__label">FRAGMENTOS ANTERIORES</span>
        <span className="archive-menu__sublabel">Arquivo completo de posts</span>
        <ChevronUp
          size={20}
          className={`archive-menu__chevron${isHistoryOpen ? ' archive-menu__chevron--open' : ''}`}
        />
      </button>

      <div className={`archive-menu__panel${isHistoryOpen ? ' archive-menu__panel--open' : ''}`}>
        <div className="archive-menu__search">
          <Search size={18} className="archive-menu__search-icon" />
          <input
            id="archive-keyword-search"
            name="archiveKeywordSearch"
            type="text"
            autoComplete="off"
            placeholder="Busca por palavras-chave..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="archive-menu__search-input"
          />
        </div>

        {filteredArchive.length > 0 ? (
          <>
            {/* Featured Posts — top 4 in 2-col grid */}
            {latestByRotation.length > 0 && (
              <div className="featured-grid">{latestByRotation.map(renderFeaturedCard)}</div>
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
                  <button type="button" onClick={() => setShowOlderYears(true)} className="show-older-pill">
                    + Anteriores
                  </button>
                )}

                {/* Older year pills revealed */}
                {hasOlderYears && (
                  <div className={`archive-older-years-wrap ${effectiveShowOlderYears ? 'open' : 'closed'}`}>
                    {effectiveShowOlderYears &&
                      olderYears.map((yearGroup) => (
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
                <h3 className="archive-year-title">{selectedYearGroup.year}</h3>

                {selectedYearGroup.months.map((monthGroup) => (
                  <div key={`${selectedYearGroup.year}-${monthGroup.month}`}>
                    <h4 className="archive-month-title">{monthGroup.month}</h4>
                    <div className="editorial-grid">{monthGroup.posts.map(renderEditorialCard)}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="archive-empty">Nenhum registro encontrado.</div>
        )}
      </div>
      <div className="archive-version">{APP_VERSION}</div>
    </footer>
  );
};

export default ArchiveMenu;
