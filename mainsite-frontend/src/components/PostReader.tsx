// Module: mainsite-frontend/src/components/PostReader.tsx
// Version: v2.0.0
// Description: Fase 4 visual redesign — editorial title, gradient divider, byline, left accent border, minimal share icons.

import { type ChangeEvent, useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { Loader2, AlignLeft, Languages, X, AlertTriangle, Sparkles, MessageCircle, Link2, Mail, MessageSquare, Home, Edit3, Heart } from 'lucide-react';
import type { ActivePalette, SiteSettings, Post } from '../types';

interface PostReaderProps {
  post: Post
  activePalette: ActivePalette
  settings: SiteSettings
  API_URL: string
  onShare: (type: 'whatsapp' | 'link' | 'email') => void
  onContact: () => void
  onComment: () => void
  onDonation: () => void
  isSendingEmail: boolean
  isNotHomePage: boolean
}

const PostReader = ({ post, activePalette, settings, API_URL, onShare, onContact, onComment, onDonation, isSendingEmail, isNotHomePage }: PostReaderProps) => {
  const [postSummary, setPostSummary] = useState<string | null>(null);
  const [translatedContent, setTranslatedContent] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const isAILoading = isSummarizing || isTranslating;

  useEffect(() => {
    setPostSummary(null); setTranslatedContent(null); setAiError(null);
  }, [post.id]);

  const handleSummarize = async () => {
    if (!post) return;
    setIsSummarizing(true); setAiError(null);
    try {
      const [res] = await Promise.all([
        fetch(`${API_URL}/ai/public/summarize`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: post.content }) }),
        new Promise<void>(resolve => setTimeout(resolve, 800))
      ]);
      const data = await res.json();
      if (res.ok) setPostSummary(data.summary);
      else throw new Error(data.error || "Server response failed.");
    } catch { setAiError("Não foi possível gerar o resumo no momento."); } finally { setIsSummarizing(false); }
  };

  const handleTranslate = async (e: ChangeEvent<HTMLSelectElement>) => {
    const lang = e.target.value;
    if (!lang || !post) return;
    setIsTranslating(true); setAiError(null);
    try {
      const [res] = await Promise.all([
        fetch(`${API_URL}/ai/public/translate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: post.content, lang }) }),
        new Promise<void>(resolve => setTimeout(resolve, 800))
      ]);
      const data = await res.json();
      if (res.ok) setTranslatedContent(data.translation);
      else throw new Error(data.error || "Server response failed.");
    } catch { setAiError(`Falha ao traduzir para ${lang}.`); } finally { setIsTranslating(false); e.target.value = ''; }
  };

  const renderContent = (content: string) => {
    const activeContent = translatedContent || content || '';
    const isHtml = /<\/?[a-z][\s\S]*>/i.test(activeContent);
    if (isHtml) {
      const safeHtml = DOMPurify.sanitize(activeContent, {
        USE_PROFILES: { html: true },
        ADD_TAGS: ['iframe'],
        ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'target', 'rel']
      });
      // Post-process: DOMPurify strips target="_blank" as anti-tab-nabbing measure.
      // Force it back on all non-YouTube links after sanitization.
      const container = document.createElement('div');
      container.innerHTML = safeHtml;
      container.querySelectorAll('a[href]').forEach(a => {
        const href = a.getAttribute('href') || '';
        if (!/(?:youtube\.com|youtu\.be)\//i.test(href)) {
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
      "url": "https://www.lcv.rio.br",
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
      "name": "Divagações Filosóficas",
      "url": "https://www.lcv.rio.br",
      "logo": { "@type": "ImageObject", "url": "https://www.lcv.rio.br/favicon.svg" }
    },
    "mainEntityOfPage": { "@type": "WebPage", "@id": `https://www.lcv.rio.br/p/${post.id}` },
    "inLanguage": "pt-BR",
    "articleSection": "Filosofia",
    "wordCount": wordCount,
    "speakable": {
      "@type": "SpeakableSpecification",
      "cssSelector": [".h1-title", ".ai-summary-box", ".p-content"]
    }
  };

  const isDarkBase = activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1');

  return (
    <article aria-label={post.title}>
      <style>{`
        @keyframes pulseGlow { 0% { box-shadow: 0 0 5px rgba(77, 166, 255, 0.2); border-color: rgba(77, 166, 255, 0.4); } 50% { box-shadow: 0 0 20px rgba(77, 166, 255, 0.8); border-color: rgba(77, 166, 255, 1); } 100% { box-shadow: 0 0 5px rgba(77, 166, 255, 0.2); border-color: rgba(77, 166, 255, 0.4); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
        .processing-active { animation: pulseGlow 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite !important; color: #4da6ff !important; }
        
        .h1-title { text-align: center; font-size: clamp(32px, 5vw, 52px); letter-spacing: -0.03em; margin-bottom: 0; color: ${activePalette.titleColor}; text-transform: none; font-weight: 800; transition: color 0.5s ease; line-height: 1.1; }
        
        .post-gradient-divider { width: 80px; height: 3px; background: linear-gradient(90deg, #4285f4, #7c3aed); margin: 1.5rem auto; border-radius: 3px; }
        
        .post-byline { text-align: center; font-size: 11px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.5; margin-bottom: 2.5rem; }
        
        .ai-actions-container { margin-bottom: 3rem; width: 100%; display: flex; flex-direction: column; align-items: center; gap: 15px; }
        .ai-actions-bar { display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; width: 100%; }
        
        .ai-btn { max-width: 240px; box-sizing: border-box; background: rgba(128,128,128,0.04); border: 1px solid rgba(128,128,128,0.15); color: ${activePalette.fontColor}; padding: 10px 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-family: inherit; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.8px; transition: all 0.3s ease; border-radius: 100px; box-shadow: none; font-weight: 600; }
        .ai-btn:hover:not(:disabled) { background: rgba(128,128,128,0.08); border-color: #4285f4; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(66, 133, 244, 0.15); }
        .ai-btn:disabled { opacity: 1; cursor: wait; background: ${activePalette.bgColor}; }
        .ai-btn.revert-btn { border-color: var(--semantic-error-border); color: var(--semantic-error); }
        .ai-btn.revert-btn:hover { border-color: var(--semantic-error); box-shadow: 0 8px 24px rgba(211, 47, 47, 0.15); }
        
        .ai-select { width: 100%; text-align: center; text-align-last: center; background: transparent; color: inherit; border: none; outline: none; cursor: pointer; font-family: inherit; appearance: none; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; }
        .ai-select:disabled { cursor: wait; color: inherit; }
        .ai-select option { background: ${activePalette.bgColor}; color: ${activePalette.fontColor}; text-transform: none; text-align: left; }
        
        .ai-error-msg { display: flex; align-items: center; gap: 8px; color: var(--semantic-error); font-size: 13px; font-weight: 600; background: var(--semantic-error-soft); padding: 10px 20px; border-radius: 100px; border: 1px solid var(--semantic-error-border); animation: fadeIn 0.3s ease-out; }
        
        .ai-summary-box { background: ${isDarkBase ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.4)'}; border-left: 4px solid #4da6ff; padding: 30px; margin-bottom: 3.5rem; font-style: italic; line-height: 1.8; border-radius: 24px; backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); box-shadow: 0 16px 32px rgba(0,0,0,0.05); border: 1px solid rgba(128,128,128,0.1); border-left-width: 4px; }
        
        .post-content-area { border-left: 2px solid ${isDarkBase ? 'rgba(138,180,248,0.3)' : 'rgba(66,133,244,0.25)'}; padding-left: 24px; }
        @media (max-width: 768px) { .post-content-area { border-left: none; padding-left: 0; } }
        
        .protected-content { user-select: none; -webkit-user-select: none; -ms-user-select: none; }
        .p-content, .html-content p, .html-content ul, .html-content ol { font-size: ${settings.shared.fontSize}; color: ${activePalette.fontColor}; transition: color 0.5s ease; }
        .html-content h1 { color: ${activePalette.titleColor}; margin: 2.5rem 0 1.2rem 0; font-weight: ${settings.shared.titleWeight || '700'}; font-size: ${settings.shared.titleFontSize}; letter-spacing: -0.02em; line-height: 1.2; transition: color 0.5s ease; }
        .html-content h2 { color: ${activePalette.titleColor}; margin: 2.5rem 0 1rem 0; font-weight: ${settings.shared.titleWeight || '700'}; font-size: calc(${settings.shared.titleFontSize} * 0.85); letter-spacing: -0.01em; line-height: 1.25; transition: color 0.5s ease; }
        .html-content h3 { color: ${activePalette.titleColor}; margin: 2rem 0 0.8rem 0; font-weight: ${Math.max(400, (parseInt(settings.shared.titleWeight) || 700) - 100)}; font-size: calc(${settings.shared.titleFontSize} * 0.70); letter-spacing: -0.01em; line-height: 1.3; transition: color 0.5s ease; }
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

      <div className="ai-actions-container">
        <div className="ai-actions-bar">
          <button onClick={handleSummarize} disabled={isAILoading} className={`ai-btn ${isSummarizing ? 'processing-active' : ''}`}>
            {isSummarizing ? <Loader2 size={18} className="animate-spin" /> : <AlignLeft size={18} />}
            {isSummarizing ? 'GERANDO RESUMO...' : 'RESUMO POR IA'}
          </button>

          <div className={`ai-btn ${isTranslating ? 'processing-active' : ''}`} role="group" aria-label="Traduzir artigo" style={{ padding: '0', background: isTranslating ? `rgba(${isDarkBase ? '255,255,255' : '0,0,0'},0.2)` : '' }}>
            <div style={{ padding: '14px 0 14px 20px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {isTranslating ? <Loader2 size={18} className="animate-spin" /> : <Languages size={18} />}
            </div>
            <select id="post-translate-language" name="postTranslateLanguage" autoComplete="off" onChange={handleTranslate} className="ai-select" disabled={isAILoading} aria-label="Selecionar idioma de tradução" style={{ padding: '14px 14px 14px 6px' }}>
              <option value="">{isTranslating ? 'TRADUZINDO...' : 'TRADUZIR PARA...'}</option>
              <option value="Inglês">English</option>
              <option value="Espanhol">Español</option>
              <option value="Francês">Français</option>
              <option value="Alemão">Deutsch</option>
            </select>
          </div>

          {translatedContent && (
            <button onClick={() => setTranslatedContent(null)} className="ai-btn revert-btn">
              <X size={18} /> REVERTER TRADUÇÃO
            </button>
          )}
        </div>
        {aiError && (
          <div className="ai-error-msg" role="alert"><AlertTriangle size={16} /> {aiError}</div>
        )}
      </div>

      {postSummary && (
        <div className="ai-summary-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', marginBottom: '16px', color: '#4da6ff', textTransform: 'uppercase', letterSpacing: '1px' }}>
            <Sparkles size={20} /> TL;DR (Gerado por IA)
          </div>
          <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(postSummary) }} />
        </div>
      )}

      <div className="post-content-area">
        <div className="protected-content" onCopy={(e) => { e.preventDefault(); return false; }} onContextMenu={(e) => { e.preventDefault(); return false; }} onDragStart={(e) => { e.preventDefault(); return false; }} onCut={(e) => { e.preventDefault(); return false; }}>
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
