/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
// Module: mainsite-frontend/src/components/PostReader.tsx
// Version: v2.0.0
// Description: Fase 4 visual redesign — editorial title, gradient divider, byline, left accent border, minimal share icons.
import DOMPurify from 'dompurify';
import { Edit3, Heart, Home, Link2, Loader2, Mail, MessageCircle, MessageSquare } from 'lucide-react';
import type { CSSProperties } from 'react';
import { serializeJsonLd } from '../lib/structuredData';
import type { ActivePalette, Post, SiteStatus } from '../types';
import CommentsSection from './CommentsSection';
import RatingWidget from './RatingWidget';
import './PostReader.css';

interface PostReaderProps {
  /**
   * Post a renderizar. Em modo manutenção (maintenance != null) este prop é ignorado:
   * a estrutura do PostReader é preservada mas com conteúdo vazio ou o aviso configurado
   * pelo admin — a "folha" nunca some, só muda o que está escrito nela.
   */
  post: Post | null;
  activePalette: ActivePalette;
  onShare: (type: 'whatsapp' | 'link' | 'email') => void;
  onContact: () => void;
  onComment: () => void;
  onDonation: () => void;
  isSendingEmail: boolean;
  isNotHomePage: boolean;
  zoomLevel: number;
  apiUrl: string;
  turnstileSiteKey?: string;
  /**
   * Kill switch global recebido de /api/site-status. Quando presente com mode='hidden',
   * RatingWidget e CommentsSection são omitidos (dependem de postId real) e a área de
   * conteúdo exibe notice_title/notice_message em texto plano; campos vazios deixam a
   * folha em branco.
   */
  maintenance?: SiteStatus | null;
}

const PostReader = ({
  post,
  activePalette,
  onShare,
  onContact,
  onComment,
  onDonation,
  isSendingEmail,
  isNotHomePage,
  zoomLevel,
  apiUrl,
  turnstileSiteKey,
  maintenance = null,
}: PostReaderProps) => {
  const isMaintenance = maintenance?.mode === 'hidden';
  const canonicalUrl = post ? `https://www.reflexosdaalma.blog/p/${post.id}` : 'https://www.reflexosdaalma.blog/';

  const renderContent = (content: string) => {
    // Normaliza links internos para paths relativos — funciona em qualquer domínio.
    // Converte ex.: https://www.lcv.rio.br/p/42 → /p/42
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
    const domainPattern = INTERNAL_DOMAINS.map((d) => `(?:www\\.)?${escapeRegExp(d)}`).join('|');
    const internalLinkRegex = new RegExp(`https?://(?:${domainPattern})(/[^"'\\s<>]*)`, 'gi');
    const activeContent = (content || '').replace(internalLinkRegex, '$1');
    const isHtml = /<\/?[a-z][\s\S]*>/i.test(activeContent);
    if (isHtml) {
      const safeHtml = DOMPurify.sanitize(activeContent, {
        USE_PROFILES: { html: true },
        ADD_TAGS: ['iframe'],
        ADD_ATTR: [
          'allow',
          'allowfullscreen',
          'frameborder',
          'scrolling',
          'target',
          'rel',
          'data-type',
          'data-checked',
          // v03.22.00 / TipTap parity: CustomResizableImage stores the user's
          // chosen width in `data-width` (the visible width is also mirrored to
          // inline `style="width: X%"`, but preserving the raw attribute keeps
          // the editor↔reader round-trip faithful for future hydration).
          'data-width',
          'style',
        ],
      });
      // Post-process: DOMPurify strips target="_blank" as anti-tab-nabbing measure.
      // Force it back on all non-YouTube links after sanitization.
      const container = document.createElement('div');
      container.innerHTML = safeHtml;
      container.querySelectorAll('a[href]').forEach((a) => {
        const href = a.getAttribute('href') || '';
        // Links internos (relativos) abrem na mesma aba; externos em nova aba
        if (href.startsWith('/')) {
          a.removeAttribute('target');
        } else if (!/(?:youtube\.com|youtu\.be)\//i.test(href)) {
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener noreferrer');
        }
      });
      return (
        // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML passou por DOMPurify (USE_PROFILES: html) + post-process de links; conteúdo é autorado por admin autenticado
        <div className="html-content" dangerouslySetInnerHTML={{ __html: container.innerHTML }} />
      );
    }

    return activeContent
      .split('\n')
      .filter((p) => p.trim() !== '')
      .map((text, index) => {
        const ytMatch = text.match(/^\[YT:(.+?)(\|(.*?))?\]$/);
        if (ytMatch)
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: parágrafos do post divididos por \n, ordem imutável em render único
            <div key={index} className="media-container">
              <iframe
                className="media-iframe"
                src={`https://www.youtube-nocookie.com/embed/${ytMatch[1].trim()}`}
                title={ytMatch[3] ? ytMatch[3].trim() : `Vídeo incorporado ${index + 1}`}
                frameBorder="0"
                allowFullScreen
              ></iframe>
              {ytMatch[3] && <div className="media-caption">{ytMatch[3].trim()}</div>}
            </div>
          );
        const imgMatch = text.match(/^\[IMG:(.+?)(\|(.*?))?\]$/);
        if (imgMatch)
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: parágrafos do post divididos por \n, ordem imutável em render único
            <div key={index} className="media-container">
              <img
                src={imgMatch[1].trim()}
                alt={imgMatch[3] ? imgMatch[3].trim() : `Ilustração do artigo`}
                className="media-image"
                loading="lazy"
              />
              {imgMatch[3] && <div className="media-caption">{imgMatch[3].trim()}</div>}
            </div>
          );
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: parágrafos do post divididos por \n, ordem imutável em render único
          <p key={index} className="p-content">
            {text}
          </p>
        );
      });
  };

  // Schema.org — Expanded for AI-era visibility (GEO/AEO).
  // Em manutenção (isMaintenance) ou sem post, JSON-LD é omitido: não há
  // artigo a declarar e publicar metadata de um post vazio confunde crawlers.
  const cleanExcerpt = (post?.content || '')
    .replace(/<[^>]*>?/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const descriptionExcerpt = cleanExcerpt.substring(0, 200) + (cleanExcerpt.length > 200 ? '...' : '');
  const wordCount = cleanExcerpt.split(/\s+/).filter(Boolean).length;

  const postAuthor = post?.author || 'Leonardo Cardozo Vargas';

  const schemaOrgJSONLDText = post
    ? serializeJsonLd({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: post.title,
        description: descriptionExcerpt,
        author: {
          '@type': 'Person',
          name: postAuthor,
          url: 'https://www.reflexosdaalma.blog',
          sameAs: ['https://github.com/lcv-leo', 'https://www.linkedin.com/in/lcv-leo'],
        },
        datePublished: post.created_at
          ? new Date(`${post.created_at.replace(' ', 'T')}Z`).toISOString()
          : new Date().toISOString(),
        dateModified: post.updated_at
          ? new Date(
              post.updated_at.replace(' ', 'T') +
                (post.updated_at.includes('Z') || post.updated_at.includes('+') ? '' : 'Z'),
            ).toISOString()
          : post.created_at
            ? new Date(`${post.created_at.replace(' ', 'T')}Z`).toISOString()
            : new Date().toISOString(),
        publisher: {
          '@type': 'Organization',
          name: 'Reflexos da Alma',
          url: 'https://www.reflexosdaalma.blog',
          logo: { '@type': 'ImageObject', url: 'https://www.reflexosdaalma.blog/favicon.svg' },
        },
        mainEntityOfPage: { '@type': 'WebPage', '@id': `https://www.reflexosdaalma.blog/p/${post.id}` },
        inLanguage: 'pt-BR',
        articleSection: 'Filosofia',
        wordCount: wordCount,
        speakable: {
          '@type': 'SpeakableSpecification',
          cssSelector: ['.h1-title', '.p-content'],
        },
      })
    : '';

  const readerStyle = {
    '--text-zoom-scale': zoomLevel,
  } as CSSProperties;

  // Conteúdo da "folha":
  //  - Com post: renderiza normalmente (fluxo existente).
  //  - Sem post / em manutenção: renderiza notice_title no h1 e notice_message na área
  //    de conteúdo, ambos em texto plano com quebras de linha preservadas. Campos vazios
  //    deixam a seção visualmente em branco mas a estrutura do <article> permanece.
  const displayTitle = isMaintenance ? (maintenance?.notice_title ?? '') : (post?.title ?? '');
  const displayAriaLabel = displayTitle || 'Área de leitura';
  const maintenanceParagraphs = isMaintenance
    ? (maintenance?.notice_message ?? '')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
    : [];

  return (
    <article
      aria-label={displayAriaLabel}
      data-readable-content="true"
      data-canonical-url={canonicalUrl}
      className="post-reader"
      style={readerStyle}
    >
      {/* UPDATED HOME BUTTON: Size and padding reduced by 30% */}
      {isNotHomePage && !isMaintenance && (
        <div className="post-reader__home-wrap">
          <button
            type="button"
            onClick={() => (window.location.href = '/')}
            className="post-reader__home-button"
            title="Voltar para a postagem principal"
          >
            <div className="post-reader__home-icon-shell">
              <Home size={16} aria-hidden="true" />
            </div>
            <span className="post-reader__home-label">Home Page</span>
          </button>
        </div>
      )}

      <h1 className="h1-title">{displayTitle}</h1>
      <div className="post-gradient-divider" />
      {post && !isMaintenance && (
        <div className="post-byline">
          Por {postAuthor}
          {post.created_at &&
            ` · ${new Date(`${post.created_at.replace(' ', 'T')}Z`).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'long', year: 'numeric' })}`}
        </div>
      )}

      <div className="post-reader__content-area">
        <div>
          {post && !isMaintenance && schemaOrgJSONLDText && (
            // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD serializer escapa <, >, &, U+2028, U+2029 — previne injection de </script> e quebra de string
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: schemaOrgJSONLDText }} />
          )}
          {isMaintenance
            ? maintenanceParagraphs.map((line, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: mensagem de manutenção é estática neste render
                <p key={index} className="p-content">
                  {line}
                </p>
              ))
            : post
              ? renderContent(post.content)
              : null}
        </div>
      </div>

      {/* Rodapé de metadados com datas de publicação/atualização */}
      {post &&
        !isMaintenance &&
        post.created_at &&
        (() => {
          const fmt = (raw: string | undefined | null): string | null => {
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
          const criado = fmt(post.created_at);
          const atualizado = fmt(post.updated_at);
          const showUpdated = atualizado && atualizado !== criado;
          return (
            <div className="post-reader__meta-footer">
              Publicado em {criado}
              {showUpdated && <> | Atualizado em {atualizado}</>}
            </div>
          );
        })()}

      {post && !isMaintenance && (
        <div className="post-reader__citation">
          Citação recomendada: mantenha o título original e a URL canônica deste texto.{' '}
          <a href={canonicalUrl} className="post-reader__citation-link">
            {canonicalUrl}
          </a>
        </div>
      )}

      {/* Rating Widget e Comments dependem de um postId real — omitidos em manutenção */}
      {post && !isMaintenance && (
        <>
          <RatingWidget postId={post.id} activePalette={activePalette} apiUrl={apiUrl} />
          <CommentsSection
            postId={post.id}
            activePalette={activePalette}
            apiUrl={apiUrl}
            turnstileSiteKey={turnstileSiteKey}
          />
        </>
      )}

      <nav aria-label="Compartilhamento e interação" className="share-bar">
        <div className="share-item">
          <button
            type="button"
            onClick={() => onShare('whatsapp')}
            className="share-btn share-whatsapp"
            title="Compartilhar no WhatsApp"
          >
            <MessageCircle size={20} />
          </button>
          <span className="share-caption">WhatsApp</span>
        </div>
        <div className="share-item">
          <button
            type="button"
            onClick={() => onShare('link')}
            className="share-btn share-link"
            title="Copiar Link Direto"
          >
            <Link2 size={20} />
          </button>
          <span className="share-caption">Copiar</span>
        </div>
        <div className="share-item">
          <button
            type="button"
            onClick={() => onShare('email')}
            disabled={isSendingEmail}
            className="share-btn share-email"
            title="Enviar por E-mail"
          >
            {isSendingEmail ? <Loader2 className="animate-spin" size={20} /> : <Mail size={20} />}
          </button>
          <span className="share-caption">E-mail</span>
        </div>
        <div className="share-item">
          <button type="button" onClick={onContact} className="share-btn share-contact" title="Falar com o Autor">
            <MessageSquare size={20} />
          </button>
          <span className="share-caption">Contato</span>
        </div>
        <div className="share-item">
          <button type="button" onClick={onComment} className="share-btn share-comment" title="Deixar um Comentário">
            <Edit3 size={20} />
          </button>
          <span className="share-caption">Comentar</span>
        </div>
        <div className="share-item">
          <button type="button" onClick={onDonation} className="share-btn share-donate" title="Apoiar este Espaço">
            <Heart size={20} />
          </button>
          <span className="share-caption">Apoiar</span>
        </div>
      </nav>
    </article>
  );
};

export default PostReader;
