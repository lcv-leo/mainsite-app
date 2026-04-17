/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
// Module: mainsite-frontend/src/components/PostReader.tsx
// Version: v2.0.0
// Description: Fase 4 visual redesign — editorial title, gradient divider, byline, left accent border, minimal share icons.
import DOMPurify from 'dompurify';
import type { CSSProperties } from 'react';
import { Loader2, MessageCircle, Link2, Mail, MessageSquare, Home, Edit3, Heart } from 'lucide-react';
import type { ActivePalette, Post } from '../types';
import RatingWidget from './RatingWidget';
import CommentsSection from './CommentsSection';
import { serializeJsonLd } from '../lib/structuredData';
import './PostReader.css';

interface PostReaderProps {
  post: Post
  activePalette: ActivePalette
  onShare: (type: 'whatsapp' | 'link' | 'email') => void
  onContact: () => void
  onComment: () => void
  onDonation: () => void
  isSendingEmail: boolean
  isNotHomePage: boolean
  zoomLevel: number
  apiUrl: string
  turnstileSiteKey?: string
}

const PostReader = ({ post, activePalette, onShare, onContact, onComment, onDonation, isSendingEmail, isNotHomePage, zoomLevel, apiUrl, turnstileSiteKey }: PostReaderProps) => {
  const canonicalUrl = `https://www.reflexosdaalma.blog/p/${post.id}`;


  const renderContent = (content: string) => {
    // Normaliza links internos para paths relativos — funciona em qualquer domínio.
    // Converte ex.: https://www.lcv.rio.br/p/42 → /p/42
    const INTERNAL_DOMAINS = [
      'reflexosdaalma.blog', 'lcv.rio.br', 'lcv.eng.br', 'lcv.psc.br',
      'cardozovargas.com', 'cardozovargas.com.br', 'lcvleo.com', 'lcvmail.com', 'lcvmasker.com',
    ];
    const domainPattern = INTERNAL_DOMAINS.map(d => `(?:www\\.)?${d.replace(/\./g, '\\.')}`).join('|');
    const internalLinkRegex = new RegExp(`https?://(?:${domainPattern})(/[^"'\\s<>]*)`, 'gi');
    const activeContent = (content || '').replace(internalLinkRegex, '$1');
    const isHtml = /<\/?[a-z][\s\S]*>/i.test(activeContent);
    if (isHtml) {
      const safeHtml = DOMPurify.sanitize(activeContent, {
        USE_PROFILES: { html: true },
        ADD_TAGS: ['iframe'],
        ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'target', 'rel', 'data-type', 'data-checked', 'style']
      });
      // Post-process: DOMPurify strips target="_blank" as anti-tab-nabbing measure.
      // Force it back on all non-YouTube links after sanitization.
      const container = document.createElement('div');
      container.innerHTML = safeHtml;
      container.querySelectorAll('a[href]').forEach(a => {
        const href = a.getAttribute('href') || '';
        // Links internos (relativos) abrem na mesma aba; externos em nova aba
        if (href.startsWith('/')) {
          a.removeAttribute('target');
        } else if (!/(?:youtube\.com|youtu\.be)\//i.test(href)) {
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener noreferrer');
        }
      });
      return <div className="html-content" dangerouslySetInnerHTML={{ __html: container.innerHTML }} />;
    }

    return activeContent.split('\n').filter(p => p.trim() !== '').map((text, index) => {
      const ytMatch = text.match(/^\[YT:(.+?)(\|(.*?))?\]$/);
      if (ytMatch) return (
        <div key={index} className="media-container">
          <iframe className="media-iframe" src={`https://www.youtube-nocookie.com/embed/${ytMatch[1].trim()}`} title={ytMatch[3] ? ytMatch[3].trim() : `Vídeo incorporado ${index + 1}`} frameBorder="0" allowFullScreen></iframe>
          {ytMatch[3] && <div className="media-caption">{ytMatch[3].trim()}</div>}
        </div>
      );
      const imgMatch = text.match(/^\[IMG:(.+?)(\|(.*?))?\]$/);
      if (imgMatch) return (
        <div key={index} className="media-container">
          <img src={imgMatch[1].trim()} alt={imgMatch[3] ? imgMatch[3].trim() : `Ilustração do artigo`} className="media-image" loading="lazy" />
          {imgMatch[3] && <div className="media-caption">{imgMatch[3].trim()}</div>}
        </div>
      );
      return <p key={index} className="p-content">{text}</p>;
    });
  };

  // Schema.org — Expanded for AI-era visibility (GEO/AEO)
  const cleanExcerpt = (post.content || '').replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
  const descriptionExcerpt = cleanExcerpt.substring(0, 200) + (cleanExcerpt.length > 200 ? '...' : '');
  const wordCount = cleanExcerpt.split(/\s+/).filter(Boolean).length;

  const postAuthor = post.author || 'Leonardo Cardozo Vargas';

  const schemaOrgJSONLD = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": post.title,
    "description": descriptionExcerpt,
    "author": {
      "@type": "Person",
      "name": postAuthor,
      "url": "https://www.reflexosdaalma.blog",
      "sameAs": [
        "https://github.com/lcv-leo",
        "https://www.linkedin.com/in/lcv-leo"
      ]
    },
    "datePublished": post.created_at ? new Date(post.created_at.replace(' ', 'T') + 'Z').toISOString() : new Date().toISOString(),
    "dateModified": post.updated_at
      ? new Date(post.updated_at.replace(' ', 'T') + (post.updated_at.includes('Z') || post.updated_at.includes('+') ? '' : 'Z')).toISOString()
      : (post.created_at ? new Date(post.created_at.replace(' ', 'T') + 'Z').toISOString() : new Date().toISOString()),
    "publisher": {
      "@type": "Organization",
      "name": "Reflexos da Alma",
      "url": "https://www.reflexosdaalma.blog",
      "logo": { "@type": "ImageObject", "url": "https://www.reflexosdaalma.blog/favicon.svg" }
    },
    "mainEntityOfPage": { "@type": "WebPage", "@id": `https://www.reflexosdaalma.blog/p/${post.id}` },
    "inLanguage": "pt-BR",
    "articleSection": "Filosofia",
    "wordCount": wordCount,
    "speakable": {
      "@type": "SpeakableSpecification",
      "cssSelector": [".h1-title", ".p-content"]
    }
  };
  const schemaOrgJSONLDText = serializeJsonLd(schemaOrgJSONLD);

  const readerStyle = {
    '--text-zoom-scale': zoomLevel,
  } as CSSProperties;

  return (
    <article aria-label={post.title} data-readable-content="true" data-canonical-url={canonicalUrl} className="post-reader" style={readerStyle}>

      {/* UPDATED HOME BUTTON: Size and padding reduced by 30% */}
      {isNotHomePage && (
        <div className="post-reader__home-wrap">
          <button onClick={() => window.location.href = '/'} className="post-reader__home-button" title="Voltar para a postagem principal" >
            <div className="post-reader__home-icon-shell">
           <Home size={16} aria-hidden="true" />
            </div>
            <span className="post-reader__home-label">Home Page</span>
          </button>
        </div>
      )}

      <h1 className="h1-title">{post.title}</h1>
      <div className="post-gradient-divider" />
      <div className="post-byline">
        Por {postAuthor}{post.created_at && ` · ${new Date(post.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'long', year: 'numeric' })}`}
      </div>


      <div className="post-reader__content-area">
        <div>
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: schemaOrgJSONLDText }} />
          {renderContent(post.content)}
        </div>
      </div>

      {/* Rodapé de metadados com datas de publicação/atualização */}
      {post.created_at && (() => {
        const fmt = (raw: string | undefined | null): string | null => {
          if (!raw) return null;
          const d = new Date(raw.replace(' ', 'T') + (raw.includes('Z') || raw.includes('+') ? '' : 'Z'));
          return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        };
        const criado = fmt(post.created_at);
        const atualizado = fmt(post.updated_at);
        const showUpdated = atualizado && atualizado !== criado;
        return (
          <div className="post-reader__meta-footer">
            Publicado em {criado}{showUpdated && <> | Atualizado em {atualizado}</>}
          </div>
        );
      })()}

      <div className="post-reader__citation">
        Citação recomendada: mantenha o título original e a URL canônica deste texto.
        {' '}
        <a href={canonicalUrl} className="post-reader__citation-link">
          {canonicalUrl}
        </a>
      </div>

      {/* Rating Widget — avaliação por estrelas + reações */}
      <RatingWidget postId={post.id} activePalette={activePalette} apiUrl={apiUrl} />

      {/* Seção pública de comentários (threading 2 níveis) */}
      <CommentsSection postId={post.id} activePalette={activePalette} apiUrl={apiUrl} turnstileSiteKey={turnstileSiteKey} />

      <nav aria-label="Compartilhamento e interação" className="share-bar">
        <button onClick={() => onShare('whatsapp')} className="share-btn share-whatsapp" title="Compartilhar no WhatsApp">
          <MessageCircle size={20} />
        </button>
        <button onClick={() => onShare('link')} className="share-btn share-link" title="Copiar Link Direto">
          <Link2 size={20} />
        </button>
        <button onClick={() => onShare('email')} disabled={isSendingEmail} className="share-btn share-email" title="Enviar por E-mail">
          {isSendingEmail ? <Loader2 className="animate-spin" size={20} /> : <Mail size={20} />}
        </button>
        <button onClick={onContact} className="share-btn share-contact" title="Falar com o Autor">
          <MessageSquare size={20} />
        </button>
        <button onClick={onComment} className="share-btn share-comment" title="Deixar um Comentário">
          <Edit3 size={20} />
        </button>
        <button onClick={onDonation} className="share-btn share-donate" title="Apoiar este Espaço">
          <Heart size={20} />
        </button>
      </nav>
    </article>
  );
};

export default PostReader;
