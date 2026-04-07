/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
// Module: mainsite-frontend/src/components/PostReader.tsx
// Version: v2.0.0
// Description: Fase 4 visual redesign — editorial title, gradient divider, byline, left accent border, minimal share icons.


import DOMPurify from 'dompurify';
import { Loader2, MessageCircle, Link2, Mail, MessageSquare, Home, Edit3, Heart } from 'lucide-react';
import type { ActivePalette, SiteSettings, Post } from '../types';

interface PostReaderProps {
  post: Post
  activePalette: ActivePalette
  settings: SiteSettings
  onShare: (type: 'whatsapp' | 'link' | 'email') => void
  onContact: () => void
  onComment: () => void
  onDonation: () => void
  isSendingEmail: boolean
  isNotHomePage: boolean
  zoomLevel: number
}

const PostReader = ({ post, activePalette, settings, onShare, onContact, onComment, onDonation, isSendingEmail, isNotHomePage, zoomLevel }: PostReaderProps) => {


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

  const isDarkBase = activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1');

  return (
    <article aria-label={post.title}>
      <style>{`
        :root { --text-zoom-scale: ${zoomLevel}; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-spin { animation: spin 1s linear infinite; }
        
        .h1-title { text-align: center; font-size: calc(${settings.shared.titleFontSize || '1.8rem'} * 1.6 * var(--text-zoom-scale, 1)); letter-spacing: -0.03em; margin-bottom: 0; color: ${activePalette.titleColor}; text-transform: none; font-weight: 800; transition: font-size 0.2s cubic-bezier(0.4, 0, 0.2, 1), color 0.5s ease; line-height: 1.1; }
        
        .post-gradient-divider { width: 80px; height: 3px; background: linear-gradient(90deg, #4285f4, #7c3aed); margin: 1.5rem auto; border-radius: 3px; }
        
        .post-byline { text-align: center; font-size: 11px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.5; margin-bottom: 2.5rem; }
        
        .post-content-area { border-left: 2px solid ${isDarkBase ? 'rgba(138,180,248,0.3)' : 'rgba(66,133,244,0.25)'}; padding-left: 24px; }
        @media (max-width: 768px) { .post-content-area { border-left: none; padding-left: 0; } }
        
        
        .p-content, .html-content p, .html-content ul, .html-content ol, .html-content blockquote, .html-content table { font-size: calc(${settings.shared.fontSize} * var(--text-zoom-scale, 1)); color: ${activePalette.fontColor}; transition: font-size 0.2s cubic-bezier(0.4, 0, 0.2, 1), color 0.5s ease; }
        .html-content h1 { color: ${activePalette.titleColor}; margin: 2.5rem 0 1.2rem 0; font-weight: ${settings.shared.titleWeight || '700'}; font-size: ${settings.shared.titleFontSize || '1.8rem'}; letter-spacing: -0.02em; line-height: 1.2; transition: color 0.5s ease; }
        .html-content h2 { color: ${activePalette.titleColor}; margin: 2.5rem 0 1rem 0; font-weight: ${settings.shared.titleWeight || '700'}; font-size: revert; letter-spacing: -0.01em; line-height: 1.25; transition: color 0.5s ease; }
        .html-content h3 { color: ${activePalette.titleColor}; margin: 2rem 0 0.8rem 0; font-weight: ${Math.max(400, (parseInt(settings.shared.titleWeight) || 700) - 100)}; font-size: revert; letter-spacing: -0.01em; line-height: 1.3; transition: color 0.5s ease; }
        .html-content h4 { color: ${activePalette.titleColor}; margin: 1.8rem 0 0.7rem 0; font-weight: ${Math.max(400, (parseInt(settings.shared.titleWeight) || 700) - 200)}; font-size: revert; line-height: 1.35; transition: color 0.5s ease; }
        .html-content h5 { color: ${activePalette.titleColor}; margin: 1.5rem 0 0.6rem 0; font-weight: ${Math.max(400, (parseInt(settings.shared.titleWeight) || 700) - 200)}; font-size: revert; text-transform: uppercase; letter-spacing: 0.06em; line-height: 1.4; transition: color 0.5s ease; }
        .html-content h6 { color: ${activePalette.fontColor}; margin: 1.2rem 0 0.5rem 0; font-weight: 600; font-size: revert; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.7; line-height: 1.45; transition: color 0.5s ease; }
        .p-content { text-align: ${settings.shared.textAlign || 'justify'}; line-height: ${settings.shared.lineHeight || '1.9'}; text-indent: ${settings.shared.textIndent || '3.5rem'}; font-weight: ${settings.shared.bodyWeight || '500'}; margin: 0 0 ${settings.shared.paragraphSpacing || '2.2rem'} 0; }
        .html-content p { text-align: ${settings.shared.textAlign || 'justify'}; line-height: ${settings.shared.lineHeight || '1.9'}; font-weight: ${settings.shared.bodyWeight || '500'}; margin: 0 0 1.2rem 0; }
        .html-content p[style*="text-align: center"] { margin: 0.35rem 0 1.4rem 0; opacity: 0.86; }
        .html-content p[style*="text-align: center"] em { font-style: italic; font-size: 0.92em; }
        .html-content ul, .html-content ol { margin: 0 0 ${settings.shared.paragraphSpacing || '2.2rem'} ${settings.shared.textIndent || '3.5rem'}; line-height: ${settings.shared.lineHeight || '1.9'}; font-weight: ${settings.shared.bodyWeight || '500'}; }
        .html-content li { margin-bottom: 0.6rem; }
        .html-content a { color: ${settings.shared.linkColor || '#4da6ff'}; text-decoration: underline; text-underline-offset: 4px; font-weight: 600; }
        
        .share-bar { display: flex; justify-content: center; gap: 12px; margin-top: 4rem; padding-top: 2.5rem; border-top: 1px solid rgba(128,128,128, 0.15); flex-wrap: wrap; }
        .share-btn { width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; border-radius: 50%; cursor: pointer; font-family: inherit; font-size: 0; border: none; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); color: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .share-btn:hover { transform: translateY(-3px) scale(1.1); }
        
        .share-whatsapp { background: #25D366; } .share-whatsapp:hover { box-shadow: 0 8px 24px rgba(37, 211, 102, 0.3); }
        .share-link { background: #64748b; } .share-link:hover { box-shadow: 0 8px 24px rgba(100, 116, 139, 0.3); }
        .share-email { background: #0ea5e9; } .share-email:hover:not(:disabled) { box-shadow: 0 8px 24px rgba(14, 165, 233, 0.3); }
        .share-email:disabled { background: #94a3b8; cursor: wait; }
        .share-contact { background: #8b5cf6; } .share-contact:hover { box-shadow: 0 8px 24px rgba(139, 92, 246, 0.3); }
        .share-comment { background: #f59e0b; } .share-comment:hover { box-shadow: 0 8px 24px rgba(245, 158, 11, 0.3); }
        .share-donate { background: #ec4899; } .share-donate:hover { box-shadow: 0 8px 24px rgba(236, 72, 153, 0.3); }
        
        /* ── Highlight / Marca-texto ────────────────────────── */
        .html-content mark { background: ${isDarkBase ? 'rgba(250, 204, 21, 0.25)' : 'rgba(250, 204, 21, 0.4)'}; color: inherit; padding: 2px 4px; border-radius: 3px; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
        
        /* ── Blockquote ───────────────────────────────────────── */
        .html-content blockquote { margin: 1.5rem 0; padding: 1.2rem 1.5rem; border-left: 4px solid ${isDarkBase ? 'rgba(138,180,248,0.5)' : 'rgba(66,133,244,0.4)'}; background: ${isDarkBase ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'}; border-radius: 0 12px 12px 0; font-style: italic; }
        .html-content blockquote p { margin-bottom: 0.6rem; }
        .html-content blockquote p:last-child { margin-bottom: 0; }
        
        /* ── Horizontal Rule ──────────────────────────────────── */
        .html-content hr { border: none; height: 2px; background: linear-gradient(90deg, transparent, ${isDarkBase ? 'rgba(138,180,248,0.3)' : 'rgba(66,133,244,0.2)'}, ${isDarkBase ? 'rgba(197,138,248,0.3)' : 'rgba(124,58,237,0.2)'}, transparent); margin: 2.5rem 0; }
        
        /* ── Tables ───────────────────────────────────────────── */
        .html-content table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; border-radius: 8px; overflow: hidden; border: 1px solid ${isDarkBase ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}; }
        .html-content th { background: ${isDarkBase ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}; font-weight: 700; text-align: left; padding: 10px 14px; border-bottom: 2px solid ${isDarkBase ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}; font-size: calc(${settings.shared.fontSize} * 0.9 * var(--text-zoom-scale, 1)); }
        .html-content td { padding: 10px 14px; border-bottom: 1px solid ${isDarkBase ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}; font-size: calc(${settings.shared.fontSize} * 0.9 * var(--text-zoom-scale, 1)); vertical-align: top; }
        .html-content tr:last-child td { border-bottom: none; }
        @media (max-width: 768px) { .html-content table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; } }
        
        /* ── FigureImageNode (semantic figure/figcaption) ─────── */
        figure.tiptap-figure { margin: 1.5rem auto; text-align: center; display: block; }
        figure.tiptap-figure img { border-radius: 4px; max-width: 100%; height: auto; }
        figcaption { font-size: 0.85em; color: ${isDarkBase ? '#999' : '#888'}; font-style: italic; margin-top: 6px; padding: 2px 4px; }
        
        /* ── Editor mention pills ──────────────────────────────── */
        .editor-mention { background: ${isDarkBase ? 'rgba(138,180,248,0.15)' : '#e8f0fe'}; color: ${isDarkBase ? '#8ab4f8' : '#1a73e8'}; padding: 2px 6px; border-radius: 4px; font-weight: 500; }
        
        /* ── Code blocks ──────────────────────────────────────── */
        pre { background: ${isDarkBase ? 'rgba(255,255,255,0.06)' : '#f5f5f5'}; padding: 1rem; border-radius: 8px; overflow-x: auto; margin: 1rem 0; border: 1px solid ${isDarkBase ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}; }
        pre code { background: none; padding: 0; color: ${isDarkBase ? '#e0e0e0' : '#1a1a1a'}; display: block; font-size: 0.88em; }
        code { background: ${isDarkBase ? 'rgba(255,255,255,0.08)' : '#f5f5f5'}; color: ${isDarkBase ? '#e0e0e0' : '#1a1a1a'}; padding: 2px 6px; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 0.9em; }
        
        /* ── Task list items (Tiptap data-type attributes) ──── */
        .html-content ul[data-type="taskList"] { list-style: none; padding-left: 0; margin-left: 0; }
        .html-content li[data-type="taskItem"] { display: flex; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.5rem; }
        .html-content li[data-type="taskItem"] > label { display: flex; align-items: flex-start; gap: 0.5rem; cursor: pointer; }
        .html-content li[data-type="taskItem"] input[type="checkbox"] { margin-top: 4px; cursor: pointer; accent-color: #4285f4; width: 16px; height: 16px; flex-shrink: 0; }
        .html-content li[data-type="taskItem"][data-checked="true"] > label { text-decoration: line-through; opacity: 0.55; }
        .html-content li[data-type="taskItem"] p { margin: 0; display: inline; }
        
        /* ── Subscript / Superscript ────────────────────────── */
        .html-content sub, .html-content sup { font-size: 0.75em; line-height: 0; position: relative; vertical-align: baseline; }
        .html-content sup { top: -0.5em; }
        .html-content sub { bottom: -0.25em; }
      `}</style>

      {/* UPDATED HOME BUTTON: Size and padding reduced by 30% */}
      {isNotHomePage && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '40px', animation: 'fadeIn 0.5s ease-out' }}>
          <button onClick={() => window.location.href = '/'} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', color: activePalette.titleColor, opacity: 0.7, transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }} onMouseOver={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1.08)'; }} onMouseOut={(e) => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.transform = 'scale(1)'; }} title="Voltar para a postagem principal" >
            <div style={{ padding: '10px', borderRadius: '100px', background: `rgba(${isDarkBase ? '255,255,255' : '0,0,0'}, 0.05)`, border: `1px solid rgba(${isDarkBase ? '255,255,255' : '0,0,0'}, 0.1)`, boxShadow: '0 12px 32px rgba(0,0,0,0.1)', backdropFilter: 'blur(12px)' }}>
           <Home size={16} aria-hidden="true" />
            </div>
            <span style={{ fontSize: '7px', fontWeight: '900', letterSpacing: '1px', textTransform: 'uppercase' }}>Home Page</span>
          </button>
        </div>
      )}

      <h1 className="h1-title">{post.title}</h1>
      <div className="post-gradient-divider" />
      <div className="post-byline">
        Por {postAuthor}{post.created_at && ` · ${new Date(post.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'long', year: 'numeric' })}`}
      </div>


      <div className="post-content-area">
        <div>
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrgJSONLD) }} />
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
          <div style={{ marginTop: '48px', paddingTop: '20px', borderTop: `1px solid rgba(${isDarkBase ? '255,255,255' : '0,0,0'}, 0.06)`, fontSize: '11px', fontWeight: '500', letterSpacing: '0.3px', opacity: 0.45, textAlign: 'center' }}>
            Publicado em {criado}{showUpdated && <> | Atualizado em {atualizado}</>}
          </div>
        );
      })()}

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
