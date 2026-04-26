/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import DOMPurify from 'dompurify';
import { Home } from 'lucide-react';
import { type CSSProperties, useMemo } from 'react';
import type { AboutContent } from '../types';
import './PostReader.css';

interface AboutPageProps {
  about: AboutContent | null;
  onBack: () => void;
  zoomLevel: number;
}

const INTERNAL_DOMAINS = [
  'reflexosdaalma.blog',
  'lcv.rio.br',
  'lcv.eng.br',
  'lcv.psc.br',
  'cardozovargas.com',
  'cardozovargas.com.br',
  'lcvleo.com',
  'lcvmail.com',
  'lcvmasker.com',
];

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeInternalLinks = (content: string) => {
  const domainPattern = INTERNAL_DOMAINS.map((domain) => `(?:www\\.)?${escapeRegExp(domain)}`).join('|');
  const internalLinkRegex = new RegExp(`https?://(?:${domainPattern})(/[^"'\\s<>]*)`, 'gi');
  return content.replace(internalLinkRegex, '$1');
};

const sanitizeContent = (content: string) => {
  const safeHtml = DOMPurify.sanitize(normalizeInternalLinks(content), {
    USE_PROFILES: { html: true },
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'target', 'rel', 'data-type', 'data-checked', 'style'],
  });
  const container = document.createElement('div');
  container.innerHTML = safeHtml;
  container.querySelectorAll('a[href]').forEach((anchor) => {
    const href = anchor.getAttribute('href') || '';
    if (/^\s*javascript:/i.test(href)) {
      anchor.removeAttribute('href');
      anchor.removeAttribute('target');
      anchor.removeAttribute('rel');
    } else if (href.startsWith('/')) {
      anchor.removeAttribute('target');
    } else if (!/(?:youtube\.com|youtu\.be)\//i.test(href)) {
      anchor.setAttribute('target', '_blank');
      anchor.setAttribute('rel', 'noopener noreferrer');
    }
  });
  return container.innerHTML;
};

const AboutPage = ({ about, onBack, zoomLevel }: AboutPageProps) => {
  const title = about?.title?.trim() || '';
  const content = about?.content?.trim() || '';
  const safeHtml = useMemo(() => sanitizeContent(content), [content]);
  const readerStyle = {
    '--text-zoom-scale': zoomLevel,
  } as CSSProperties;

  return (
    <article
      aria-label={title || 'Sobre Este Site'}
      className="post-reader"
      data-canonical-url="https://www.reflexosdaalma.blog/sobre-este-site"
      data-readable-content="true"
      style={readerStyle}
    >
      <div className="post-reader__home-wrap">
        <button type="button" onClick={onBack} className="post-reader__home-button" title="Voltar para a leitura">
          <div className="post-reader__home-icon-shell">
            <Home size={16} aria-hidden="true" />
          </div>
          <span className="post-reader__home-label">Home Page</span>
        </button>
      </div>

      <h1 className="h1-title">{title}</h1>
      <div className="post-gradient-divider" />
      <div className="post-reader__content-area">
        {safeHtml ? (
          // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML saneado por DOMPurify antes da renderização.
          <div className="html-content" dangerouslySetInnerHTML={{ __html: safeHtml }} />
        ) : (
          <p className="p-content">Ainda não há conteúdo.</p>
        )}
      </div>
    </article>
  );
};

export default AboutPage;
