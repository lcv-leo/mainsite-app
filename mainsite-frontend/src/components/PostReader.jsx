// Módulo: mainsite-frontend/src/components/PostReader.jsx
// Versão: v1.0.6
// Descrição: Componente isolado para renderização do fragmento, muralha anti-cópia e requisições de Inteligência Artificial.

import React, { useState, useEffect } from 'react';
import { Loader2, AlignLeft, Languages, X, AlertTriangle, Sparkles, MessageCircle, Link2, Mail, MessageSquare, Home, Edit3 } from 'lucide-react';

const PostReader = ({ post, activePalette, settings, API_URL, onShare, onContact, onComment, isSendingEmail, isNotHomePage }) => {
  const [postSummary, setPostSummary] = useState(null);
  const [translatedContent, setTranslatedContent] = useState(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [aiError, setAiError] = useState(null);

  const isAILoading = isSummarizing || isTranslating;

  // Reseta os estados da IA quando o leitor muda de texto
  useEffect(() => {
    setPostSummary(null);
    setTranslatedContent(null);
    setAiError(null);
  }, [post.id]);

  const handleSummarize = async () => {
    if (!post) return;
    setIsSummarizing(true); setAiError(null);
    try {
      const [res] = await Promise.all([
        fetch(`${API_URL}/ai/public/summarize`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: post.content }) }),
        new Promise(resolve => setTimeout(resolve, 800)) 
      ]);
      const data = await res.json();
      if (res.ok) setPostSummary(data.summary);
      else throw new Error(data.error || "Falha na resposta do servidor.");
    } catch (err) { setAiError("Não foi possível gerar o resumo no momento."); } finally { setIsSummarizing(false); }
  };

  const handleTranslate = async (e) => {
    const lang = e.target.value;
    if (!lang || !post) return;
    setIsTranslating(true); setAiError(null);
    try {
      const [res] = await Promise.all([
        fetch(`${API_URL}/ai/public/translate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: post.content, lang }) }),
        new Promise(resolve => setTimeout(resolve, 800))
      ]);
      const data = await res.json();
      if (res.ok) setTranslatedContent(data.translation);
      else throw new Error(data.error || "Falha na resposta do servidor.");
    } catch (err) { setAiError(`Falha ao traduzir para ${lang}.`); } finally { setIsTranslating(false); e.target.value = ''; }
  };

  const renderContent = (content) => {
    const activeContent = translatedContent || content || '';
    const isHtml = /<\/?[a-z][\s\S]*>/i.test(activeContent);
    if (isHtml) return <div className="html-content" dangerouslySetInnerHTML={{ __html: activeContent }} />;

    return activeContent.split('\n').filter(p => p.trim() !== '').map((text, index) => {
      const ytMatch = text.match(/^\[YT:(.+?)(\|(.*?))?\]$/);
      if (ytMatch) return (
        <div key={index} className="media-container">
          <iframe className="media-iframe" src={`https://www.youtube-nocookie.com/embed/${ytMatch[1].trim()}`} frameBorder="0" allowFullScreen></iframe>
          {ytMatch[3] && <div className="media-caption">{ytMatch[3].trim()}</div>}
        </div>
      );
      const imgMatch = text.match(/^\[IMG:(.+?)(\|(.*?))?\]$/);
      if (imgMatch) return (
        <div key={index} className="media-container">
          <img src={imgMatch[1].trim()} alt="Visual" className="media-image" loading="lazy" />
          {imgMatch[3] && <div className="media-caption">{imgMatch[3].trim()}</div>}
        </div>
      );
      return <p key={index} className="p-content">{text}</p>;
    });
  };

  // Schema de SEO Dinâmico (JSON-LD) para o Google Indexer
  const schemaOrgJSONLD = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": post.title,
    "author": { "@type": "Person", "name": "Leonardo Cardozo Vargas", "url": "https://www.lcv.rio.br" },
    "datePublished": post.created_at ? new Date(post.created_at.replace(' ', 'T') + 'Z').toISOString() : new Date().toISOString(),
    "publisher": { "@type": "Organization", "name": "Divagações Filosóficas", "logo": { "@type": "ImageObject", "url": "https://www.lcv.rio.br/favicon.ico" } },
    "mainEntityOfPage": { "@type": "WebPage", "@id": `https://www.lcv.rio.br/?p=${post.id}` }
  };

  return (
    <div>
      <style>{`
        @keyframes pulseGlow { 
          0% { box-shadow: 0 0 5px rgba(77, 166, 255, 0.2); border-color: rgba(77, 166, 255, 0.4); } 
          50% { box-shadow: 0 0 20px rgba(77, 166, 255, 0.8); border-color: rgba(77, 166, 255, 1); } 
          100% { box-shadow: 0 0 5px rgba(77, 166, 255, 0.2); border-color: rgba(77, 166, 255, 0.4); } 
        }
        .processing-active { animation: pulseGlow 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite !important; color: #4da6ff !important; }
        
        .h1-title { text-align: center; font-size: ${settings.shared.titleFontSize}; letter-spacing: 0.3em; margin-bottom: 2rem; color: ${activePalette.titleColor}; text-transform: uppercase; font-weight: bold; transition: color 0.5s ease;}
        
        .ai-actions-container { margin-bottom: 3rem; width: 100%; display: flex; flex-direction: column; align-items: center; gap: 15px; }
        .ai-actions-bar { display: flex; justify-content: center; gap: 20px; flex-wrap: wrap; }
        
        .ai-btn { background: rgba(128,128,128,0.05); border: 1px solid rgba(128,128,128,0.2); color: ${activePalette.fontColor}; padding: 12px 20px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-family: inherit; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1.5px; transition: all 0.3s ease; border-radius: 6px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); font-weight: bold; }
        .ai-btn:hover:not(:disabled) { background: rgba(128,128,128,0.1); border-color: #4da6ff; transform: translateY(-2px); box-shadow: 0 6px 20px rgba(77, 166, 255, 0.2); }
        .ai-btn:disabled { opacity: 1; cursor: wait; background: ${activePalette.bgColor}; }
        .ai-btn.revert-btn { border-color: rgba(255, 77, 77, 0.5); color: #ff4d4d; }
        .ai-btn.revert-btn:hover { border-color: #ff4d4d; box-shadow: 0 6px 20px rgba(255, 77, 77, 0.2); }
        
        .ai-select { background: transparent; color: inherit; border: none; outline: none; cursor: pointer; font-family: inherit; appearance: none; padding-right: 15px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
        .ai-select:disabled { cursor: wait; color: inherit; }
        .ai-select option { background: ${activePalette.bgColor}; color: ${activePalette.fontColor}; text-transform: none; }
        
        .ai-error-msg { display: flex; align-items: center; gap: 8px; color: #ff4d4d; font-size: 13px; font-weight: bold; background: rgba(255, 77, 77, 0.1); padding: 8px 16px; border-radius: 4px; border: 1px solid rgba(255, 77, 77, 0.3); animation: fadeIn 0.3s ease-out; }
        
        .ai-summary-box { background: linear-gradient(to right, rgba(0, 150, 255, 0.05), transparent); border-left: 4px solid #4da6ff; padding: 25px; margin-bottom: 3rem; font-style: italic; line-height: 1.6; border-radius: 0 8px 8px 0; }
        
        /* Muralha Anti-Cópia */
        .protected-content { user-select: none; -webkit-user-select: none; -ms-user-select: none; }

        /* Tipografia Dinâmica */
        .p-content, .html-content p, .html-content ul, .html-content ol { font-size: ${settings.shared.fontSize}; color: ${activePalette.fontColor}; transition: color 0.5s ease; }
        .html-content h1 { color: ${activePalette.titleColor}; margin: 2rem 0 1rem 0; font-weight: bold; font-size: ${settings.shared.titleFontSize}; transition: color 0.5s ease; }
        .html-content h2 { color: ${activePalette.titleColor}; margin: 2rem 0 1rem 0; font-weight: bold; font-size: calc(${settings.shared.titleFontSize} * 0.85); transition: color 0.5s ease; }
        .html-content h3 { color: ${activePalette.titleColor}; margin: 2rem 0 1rem 0; font-weight: bold; font-size: calc(${settings.shared.titleFontSize} * 0.70); transition: color 0.5s ease; }
        .p-content { text-align: justify; line-height: 1.9; text-indent: 3.5rem; font-weight: bold; margin: 0 0 1.8rem 0; }
        .html-content p { text-align: justify; line-height: 1.9; text-indent: 3.5rem; font-weight: bold; margin: 0 0 1.8rem 0; }
        .html-content ul, .html-content ol { margin: 0 0 1.8rem 3.5rem; line-height: 1.9; font-weight: bold; }
        .html-content li { margin-bottom: 0.5rem; }
        .html-content a { color: #4da6ff; text-decoration: underline; text-underline-offset: 4px; font-weight: bold; }
        
        /* Painel de Compartilhamento */
        .share-comment { background: #f59e0b; } .share-comment:hover { background: #d97706; transform: translateY(-2px); }
        .share-bar { display: flex; justify-content: center; gap: 15px; margin-top: 3rem; padding-top: 2rem; border-top: 1px solid rgba(128,128,128, 0.2); }
        .share-btn { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 15px; border-radius: 6px; cursor: pointer; font-family: inherit; font-size: 11px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; border: none; transition: all 0.2s; color: #fff; }
        .share-whatsapp { background: #25D366; } .share-whatsapp:hover { background: #128C7E; transform: translateY(-2px); }
        .share-link { background: #64748b; } .share-link:hover { background: #475569; transform: translateY(-2px); }
        .share-email { background: #0ea5e9; } .share-email:hover:not(:disabled) { background: #0284c7; transform: translateY(-2px); }
        .share-email:disabled { background: #94a3b8; cursor: wait; }
        .share-contact { background: #8b5cf6; } .share-contact:hover { background: #7c3aed; transform: translateY(-2px); }
      `}</style>

      {/* Botão Dinâmico de Retorno à Home Page (Só aparece em textos antigos) */}
      {isNotHomePage && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '40px', animation: 'fadeIn 0.5s ease-out' }}>
          <button
            onClick={() => window.location.href = '/'}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: '12px', color: activePalette.titleColor, opacity: 0.7, transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }}
            onMouseOver={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1.08)'; }}
            onMouseOut={(e) => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.transform = 'scale(1)'; }}
            title="Voltar para a postagem principal"
          >
            <div style={{ 
              padding: '18px', borderRadius: '50%', 
              background: `rgba(${activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1') ? '255,255,255' : '0,0,0'}, 0.05)`, 
              border: `1px solid rgba(${activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1') ? '255,255,255' : '0,0,0'}, 0.1)`,
              boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
            }}>
              <Home size={32} />
            </div>
            <span style={{ fontSize: '11px', fontWeight: '900', letterSpacing: '3px', textTransform: 'uppercase' }}>Home Page</span>
          </button>
        </div>
      )}

      <h1 className="h1-title">{post.title}</h1>
      
      <div className="ai-actions-container">
        <div className="ai-actions-bar">
          <button onClick={handleSummarize} disabled={isAILoading} className={`ai-btn ${isSummarizing ? 'processing-active' : ''}`}>
            {isSummarizing ? <Loader2 size={16} className="animate-spin"/> : <AlignLeft size={16}/>} 
            {isSummarizing ? 'GERANDO RESUMO...' : 'RESUMO POR IA'}
          </button>
          
          <div className={`ai-btn ${isTranslating ? 'processing-active' : ''}`} style={{ padding: '0', background: isTranslating ? `rgba(${isDarkBase ? '255,255,255' : '0,0,0'},0.2)` : '' }}>
            <div style={{ padding: '12px 0 12px 20px', display: 'flex', alignItems: 'center' }}>
              {isTranslating ? <Loader2 size={16} className="animate-spin"/> : <Languages size={16}/>}
            </div>
            <select onChange={handleTranslate} className="ai-select" disabled={isAILoading} style={{ padding: '12px 20px' }}>
              <option value="">{isTranslating ? 'TRADUZINDO...' : 'TRADUZIR PARA...'}</option>
              <option value="Inglês">English</option>
              <option value="Espanhol">Español</option>
              <option value="Francês">Français</option>
              <option value="Alemão">Deutsch</option>
            </select>
          </div>
          
          {translatedContent && (
            <button onClick={() => setTranslatedContent(null)} className="ai-btn revert-btn"><X size={16}/> REVERTER TRADUÇÃO</button>
          )}
        </div>
        {aiError && (
          <div className="ai-error-msg"><AlertTriangle size={16} /> {aiError}</div>
        )}
      </div>

      {postSummary && (
        <div className="ai-summary-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', marginBottom: '12px', color: '#4da6ff', textTransform: 'uppercase', letterSpacing: '1px' }}>
            <Sparkles size={18}/> TL;DR (Gerado por IA)
          </div>
          {postSummary}
        </div>
      )}

      {/* Muralha Anti-Cópia Ativa */}
      <div 
        className="protected-content" 
        onCopy={(e) => { e.preventDefault(); return false; }} 
        onContextMenu={(e) => { e.preventDefault(); return false; }} 
        onDragStart={(e) => { e.preventDefault(); return false; }}
      >
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrgJSONLD) }} />
        {renderContent(post.content)}
      </div>

      {/* Painel de Compartilhamento Integrado */}
      <button onClick={onComment} className="share-btn share-comment" title="Deixar um Comentário">
          <Edit3 size={16} /> Comentários
      </button>
      <div className="share-bar">
        <button onClick={() => onShare('whatsapp')} className="share-btn share-whatsapp" title="Compartilhar no WhatsApp">
          <MessageCircle size={16} /> WhatsApp
        </button>
        <button onClick={() => onShare('link')} className="share-btn share-link" title="Copiar Link Direto">
          <Link2 size={16} /> Copiar Link
        </button>
        <button onClick={() => onShare('email')} disabled={isSendingEmail} className="share-btn share-email" title="Enviar por E-mail">
          {isSendingEmail ? <Loader2 className="animate-spin" size={16} /> : <Mail size={16} />} E-Mail
        </button>
        <button onClick={onContact} className="share-btn share-contact" title="Falar com o Autor">
          <MessageSquare size={16} /> Contato
        </button>
      </div>

    </div>
  );
};

export default PostReader;