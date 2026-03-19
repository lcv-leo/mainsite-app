// Módulo: mainsite-frontend/src/components/PostReader.jsx
// Versão: v2.0.0
// Descrição: Componente refatorado para usar o motor de estilos central (Glassmorphism/MD3), alinhando a formatação do post e os controles de IA/compartilhamento.

import React, { useState, useEffect } from 'react';
import { Loader2, AlignLeft, Languages, X, AlertTriangle, Sparkles, MessageCircle, Link2, Mail, MessageSquare, Home, Edit3, Heart } from 'lucide-react';

const PostReader = ({ post, activePalette, settings, API_URL, styles, onShare, onContact, onComment, onDonation, isSendingEmail, isNotHomePage }) => {
  const [postSummary, setPostSummary] = useState(null);
  const [translatedContent, setTranslatedContent] = useState(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [aiError, setAiError] = useState(null);

  const isAILoading = isSummarizing || isTranslating;

  useEffect(() => {
    setPostSummary(null); setTranslatedContent(null); setAiError(null);
  }, [post.id]);

  const callAI = async (endpoint, body, onSuccess, onError) => {
    try {
      const [res] = await Promise.all([
        fetch(`${API_URL}/ai/public/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
        new Promise(resolve => setTimeout(resolve, 800))
      ]);
      const data = await res.json();
      if (res.ok) onSuccess(data);
      else throw new Error(data.error || "Falha na resposta do servidor.");
    } catch (err) { onError(err.message); }
  };

  const handleSummarize = () => {
    if (!post) return;
    setIsSummarizing(true); setAiError(null);
    callAI('summarize', { text: post.content }, (data) => setPostSummary(data.summary), () => setAiError("Não foi possível gerar o resumo no momento."))
      .finally(() => setIsSummarizing(false));
  };

  const handleTranslate = (e) => {
    const lang = e.target.value;
    if (!lang || !post) return;
    setIsTranslating(true); setAiError(null);
    callAI('translate', { text: post.content, lang }, (data) => setTranslatedContent(data.translation), () => setAiError(`Falha ao traduzir para ${lang}.`))
      .finally(() => { setIsTranslating(false); e.target.value = ''; });
  };
  
  const schemaOrgJSONLD = { "@context": "https://schema.org", "@type": "Article", "headline": post.title, "author": { "@type": "Person", "name": "Leonardo Cardozo Vargas", "url": "https://www.lcv.rio.br" }, "datePublished": post.created_at ? new Date(post.created_at.replace(' ', 'T') + 'Z').toISOString() : new Date().toISOString(), "publisher": { "@type": "Organization", "name": "Divagações Filosóficas", "logo": { "@type": "ImageObject", "url": "https://www.lcv.rio.br/favicon.ico" } }, "mainEntityOfPage": { "@type": "WebPage", "@id": `https://www.lcv.rio.br/?p=${post.id}` } };

  // --- LOCAL STYLES DERIVED FROM THEME ---
  const localStyles = {
    h1: { textAlign: 'center', fontSize: settings.shared.titleFontSize, letterSpacing: '0.1em', marginBottom: '2rem', color: activePalette.titleColor, textTransform: 'uppercase', fontWeight: 'bold', transition: 'color 0.5s ease' },
    content: { userSelect: 'none', WebkitUserSelect: 'none', MsUserSelect: 'none', },
    aiActionsContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', marginBottom: '3rem' },
    aiActionsBar: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', flexWrap: 'wrap' },
    aiBtn: { ...styles.headerBtn, justifyContent: 'center', fontWeight: 'bold', letterSpacing: '1px' },
    aiErrorMsg: { ...styles.postCard, display: 'flex', alignItems: 'center', gap: '8px', color: '#ff4d4d', fontSize: '13px', fontWeight: 'bold', background: 'rgba(255, 77, 77, 0.1)', padding: '12px 18px', border: '1px solid rgba(255, 77, 77, 0.3)', animation: 'fadeIn 0.3s ease-out', width: 'auto' },
    aiSummaryBox: { ...styles.postCard, borderLeft: `4px solid ${activePalette.titleColor}`, padding: '25px', margin: '1rem 0 3rem 0', fontStyle: 'italic', lineHeight: '1.7' },
    shareBar: { display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '3rem', paddingTop: '2rem', borderTop: `1px solid ${styles.glassBorder}`, flexWrap: 'wrap' },
    shareBtn: { flex: '1 1 150px', maxWidth: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px 15px', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', border: 'none', transition: 'all 0.2s', color: '#fff' }
  };

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrgJSONLD) }} />
      <style>{`
        .post-content p { font-size: ${settings.shared.fontSize}; color: ${activePalette.fontColor}; text-align: justify; line-height: 1.9; text-indent: 3.5rem; font-weight: 500; margin: 0 0 1.8rem 0; }
        .post-content h1, .post-content h2, .post-content h3 { color: ${activePalette.titleColor}; margin: 2rem 0 1rem 0; font-weight: bold; line-height: 1.5; }
        .post-content h1 { font-size: ${settings.shared.titleFontSize}; }
        .post-content h2 { font-size: calc(${settings.shared.titleFontSize} * 0.85); }
        .post-content h3 { font-size: calc(${settings.shared.titleFontSize} * 0.70); }
        .post-content a { color: ${activePalette.titleColor}; text-decoration: underline; text-underline-offset: 4px; font-weight: bold; }
        .post-content ul, .post-content ol { margin: 0 0 1.8rem 3.5rem; line-height: 1.9; font-weight: 500; }
      `}</style>
      
      {isNotHomePage && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '40px' }}>
          <a
            href="/"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              color: activePalette.titleColor,
              opacity: 0.7,
              transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              textDecoration: 'none'
            }}
            onMouseOver={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1.08)'; }}
            onMouseOut={(e) => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.transform = 'scale(1)'; }}
            title="Voltar para a postagem principal"
          >
            <div style={{
              padding: '18px',
              borderRadius: '50%',
              background: `rgba(${activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1') ? '255,255,255' : '0,0,0'}, 0.05)`,
              border: `1px solid rgba(${activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1') ? '255,255,255' : '0,0,0'}, 0.1)`,
              boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
            }}>
              <Home size={32} />
            </div>
            <span style={{
              fontSize: '11px',
              fontWeight: '900',
              letterSpacing: '3px',
              textTransform: 'uppercase'
            }}>
              Home Page
            </span>
          </a>
        </div>
      )}

      <h1 style={localStyles.h1}>{post.title}</h1>
      
      <div style={localStyles.aiActionsContainer}>
        <div style={localStyles.aiActionsBar}>
          <button onClick={handleSummarize} disabled={isAILoading} style={{...localStyles.aiBtn, ...(isSummarizing && { background: styles.glassBg, color: activePalette.titleColor, borderColor: activePalette.titleColor })}}>
            {isSummarizing ? <Loader2 size={16} className="animate-spin"/> : <AlignLeft size={16}/>} 
            {isSummarizing ? 'GERANDO RESUMO...' : 'RESUMO POR IA'}
          </button>
          
          <div style={{...localStyles.aiBtn, padding: '0 12px 0 20px', ...(isTranslating && { background: styles.glassBg, color: activePalette.titleColor, borderColor: activePalette.titleColor })}}>
            {isTranslating ? <Loader2 size={16} className="animate-spin"/> : <Languages size={16}/>}
            <select onChange={handleTranslate} disabled={isAILoading} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 'bold', textTransform: 'uppercase', outline: 'none', padding: '12px 0 12px 10px' }}>
              <option value="">{isTranslating ? 'TRADUZINDO...' : 'TRADUZIR PARA...'}</option>
              <option value="Inglês">English</option><option value="Espanhol">Español</option><option value="Francês">Français</option><option value="Alemão">Deutsch</option>
            </select>
          </div>
          
          {translatedContent && ( <button onClick={() => setTranslatedContent(null)} style={{...localStyles.aiBtn, color: '#ff4d4d', borderColor: 'rgba(255, 77, 77, 0.5)' }}> <X size={16}/> REVERTER TRADUÇÃO </button> )}
        </div>
        {aiError && ( <div style={localStyles.aiErrorMsg}><AlertTriangle size={16} /> {aiError}</div> )}
      </div>

      {postSummary && (
        <div style={localStyles.aiSummaryBox}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', marginBottom: '12px', color: activePalette.titleColor, textTransform: 'uppercase', letterSpacing: '1px' }}>
            <Sparkles size={18}/> TL;DR (Gerado por IA)
          </div>
          {postSummary}
        </div>
      )}

      <div className="post-content" style={localStyles.content} onCopy={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()} onDragStart={(e) => e.preventDefault()}>
        <div dangerouslySetInnerHTML={{ __html: translatedContent || post.content }} />
      </div>

      <div style={localStyles.shareBar}>
        <button onClick={() => onShare('whatsapp')} style={{...localStyles.shareBtn, background: '#25D366'}} title="Compartilhar no WhatsApp"> <MessageCircle size={16} /> WhatsApp </button>
        <button onClick={() => onShare('link')} style={{...localStyles.shareBtn, background: '#64748b'}} title="Copiar Link Direto"> <Link2 size={16} /> Copiar Link </button>
        <button onClick={() => onShare('email')} disabled={isSendingEmail} style={{...localStyles.shareBtn, background: '#0ea5e9'}}> {isSendingEmail ? <Loader2 className="animate-spin" size={16} /> : <Mail size={16} />} E-Mail </button>
        <button onClick={onContact} style={{...localStyles.shareBtn, background: '#8b5cf6'}} title="Falar com o Autor"> <MessageSquare size={16} /> Contato </button>
        <button onClick={onComment} style={{...localStyles.shareBtn, background: '#f59e0b'}} title="Deixar um Comentário"> <Edit3 size={16} /> Comentários </button>
        <button onClick={onDonation} style={{...localStyles.shareBtn, background: '#ec4899'}} title="Apoiar este Espaço"> <Heart size={16} /> Doação </button>
      </div>

    </div>
  );
};

export default PostReader;