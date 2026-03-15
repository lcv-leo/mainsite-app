// Módulo: mainsite-frontend/src/App.jsx
// Versão: v3.12.0
// Descrição: Código integral restaurado. Injeção de Proteção Anti-Cópia, Botões de Engajamento e Roteamento via parâmetro de URL (?p=).

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Loader2, ChevronUp, ArrowUp, Search, Bot, X, Send, Languages, AlignLeft, Sparkles, 
  AlertTriangle, Sun, Moon, Monitor, Share2, Link2, MessageCircle, Mail, Check
} from 'lucide-react';

import DisclaimerModal from './components/DisclaimerModal';
import ShareOverlay from './components/ShareOverlay';
import ChatWidget from './components/ChatWidget';
import FloatingControls from './components/FloatingControls';
import ArchiveMenu from './components/ArchiveMenu';

const API_URL = 'https://mainsite-app.lcv.workers.dev/api';
const APP_VERSION = 'APP v3.13.0';

const App = () => {
  const [posts, setPosts] = useState([]);
  const [currentPost, setCurrentPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showBackToTop, setShowBackToTop] = useState(false);
  
  const [settings, setSettings] = useState({
    allowAutoMode: true,
    light: { bgColor: '#ffffff', bgImage: '', fontColor: '#333333', titleColor: '#111111' },
    dark: { bgColor: '#131314', bgImage: '', fontColor: '#E3E3E3', titleColor: '#8AB4F8' },
    shared: { fontSize: '1.15rem', titleFontSize: '1.8rem', fontFamily: 'sans-serif' }
  });

  const [userTheme, setUserTheme] = useState(localStorage.getItem('themePref') || 'auto');
  const [systemIsDark, setSystemIsDark] = useState(window.matchMedia('(prefers-color-scheme: dark)').matches);

  const [postSummary, setPostSummary] = useState(null);
  const [translatedContent, setTranslatedContent] = useState(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [aiError, setAiError] = useState(null);
  const isAILoading = isSummarizing || isTranslating;

  const [isChatOpen, setIsChatOpen] = useState(false);

  // INJEÇÃO ARQUITETURAL: Interface Dinâmica e Modais
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const [emailModal, setEmailModal] = useState({ show: false, email: '' });

  const showNotification = useCallback((message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => setSystemIsDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    fetchData();
    const handleScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

 // --- MOTOR DE SEO DINÂMICO E ROTEAMENTO ---
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  useEffect(() => {
    setPostSummary(null);
    setTranslatedContent(null);
    setAiError(null);

    if (currentPost) {
      setShowDisclaimer(true);
      document.title = `${currentPost.title} | Divagações Filosóficas`;
      
      const cleanText = currentPost.content ? currentPost.content.replace(/<[^>]*>?/gm, '').substring(0, 160) + '...' : '';
      
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute("content", cleanText);
      
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute("content", currentPost.title);
      
      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) ogDesc.setAttribute("content", cleanText);

      // Atualiza a URL de forma silenciosa para permitir compartilhamento do link exato
      window.history.replaceState(null, '', `?p=${currentPost.id}`);
    } else {
      document.title = "Divagações Filosóficas";
    }
  }, [currentPost]);

    const fetchData = async () => {
    try {
      const [resPosts, resSettings] = await Promise.all([ fetch(`${API_URL}/posts`), fetch(`${API_URL}/settings`) ]);
      const dataPosts = await resPosts.json();
      const dataSettings = await resSettings.json();

      if (Array.isArray(dataPosts) && dataPosts.length > 0) {
        setPosts(dataPosts);
        
        // Validação de Roteamento Direto (Direct Link Access)
        const params = new URLSearchParams(window.location.search);
        const requestedPostId = params.get('p');
        
        if (requestedPostId) {
          const targetPost = dataPosts.find(p => p.id.toString() === requestedPostId);
          setCurrentPost(targetPost || dataPosts[0]);
        } else {
          setCurrentPost(dataPosts[0]);
        }
      }
      
       if (!dataSettings.error) {
         if (dataSettings.light) {
             // Injeção de Segurança: Garante que as chaves existam mesmo se o banco de dados antigo entregar um JSON incompleto.
             setSettings({
                 allowAutoMode: dataSettings.allowAutoMode ?? true,
                 light: dataSettings.light,
                 dark: dataSettings.dark,
                 shared: dataSettings.shared || { fontSize: '1.15rem', titleFontSize: '1.8rem', fontFamily: 'sans-serif' }
             });
         } else {
             setSettings(prev => ({
                 ...prev,
                 dark: { 
                   bgColor: dataSettings.bgColor || prev.dark.bgColor, 
                   bgImage: dataSettings.bgImage || prev.dark.bgImage, 
                   fontColor: dataSettings.fontColor || prev.dark.fontColor, 
                   titleColor: dataSettings.titleColor || prev.dark.titleColor 
                 },
                 shared: {
                   fontSize: dataSettings.fontSize || prev.shared.fontSize,
                   titleFontSize: dataSettings.titleFontSize || prev.shared.titleFontSize,
                   fontFamily: dataSettings.fontFamily || prev.shared.fontFamily
                 }
             }));
         }
      }
    } catch (err) { console.error("Falha na API."); } finally { setLoading(false); }
  };

  const activePalette = useMemo(() => {
    const safeDark = settings.dark || { bgColor: '#131314', bgImage: '', fontColor: '#E3E3E3', titleColor: '#8AB4F8' };
    const safeLight = settings.light || { bgColor: '#ffffff', bgImage: '', fontColor: '#333333', titleColor: '#111111' };
    if (!settings.allowAutoMode && userTheme === 'auto') return safeDark;
    let resolved = userTheme;
    if (resolved === 'auto') resolved = systemIsDark ? 'dark' : 'light';
    return resolved === 'dark' ? safeDark : safeLight;
  }, [settings, userTheme, systemIsDark]);

  const cycleTheme = () => {
    const modes = settings.allowAutoMode ? ['auto', 'light', 'dark'] : ['light', 'dark'];
    const nextIndex = (modes.indexOf(userTheme) + 1) % modes.length;
    const next = modes[nextIndex];
    setUserTheme(next);
    localStorage.setItem('themePref', next);
  };

// --- MOTOR DE COMPARTILHAMENTO ---
  const handleShare = async (platform) => {
    if (!currentPost) return;
    const postLink = `${window.location.origin}/?p=${currentPost.id}`;
    const shareText = `Recomendo esta leitura: "${currentPost.title}"`;

    try {
      if (platform === 'whatsapp') {
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} - ${postLink}`)}`, '_blank');
        fetch(`${API_URL}/shares`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ post_id: currentPost.id, post_title: currentPost.title, platform: 'whatsapp', target: postLink }) });
      } 
      else if (platform === 'link') {
        await navigator.clipboard.writeText(postLink);
        showNotification("Link copiado para a área de transferência!", "success");
        fetch(`${API_URL}/shares`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ post_id: currentPost.id, post_title: currentPost.title, platform: 'link', target: postLink }) });
      }
      else if (platform === 'email') {
        setEmailModal({ show: true, email: '' });
      }
    } catch (e) { showNotification("Falha no compartilhamento. Verifique permissões do navegador.", "error"); }
  };

  const submitEmailShare = async (e) => {
    e.preventDefault();
    if (!emailModal.email || !currentPost) return;
    const postLink = `${window.location.origin}/?p=${currentPost.id}`;
    
    setIsSendingEmail(true);
    setEmailModal({ show: false, email: '' });
    
    try {
      const res = await fetch(`${API_URL}/share/email`, { 
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: currentPost.id, post_title: currentPost.title, link: postLink, target_email: emailModal.email })
      });
      if (res.ok) showNotification("E-mail disparado com sucesso!", "success");
      else throw new Error();
    } catch (err) {
      showNotification("Falha ao enviar e-mail. Tente novamente.", "error");
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleSummarize = async () => {
    if (!currentPost) return;
    setIsSummarizing(true); setAiError(null);
    try {
      const [res] = await Promise.all([
        fetch(`${API_URL}/ai/public/summarize`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: currentPost.content }) }),
        new Promise(resolve => setTimeout(resolve, 800)) 
      ]);
      const data = await res.json();
      if (res.ok) setPostSummary(data.summary);
      else throw new Error(data.error || "Falha na resposta do servidor.");
    } catch (err) { setAiError("Não foi possível gerar o resumo no momento."); } finally { setIsSummarizing(false); }
  };

  const handleTranslate = async (e) => {
    const lang = e.target.value;
    if (!lang || !currentPost) return;
    setIsTranslating(true); setAiError(null);
    try {
      const [res] = await Promise.all([
        fetch(`${API_URL}/ai/public/translate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: currentPost.content, lang }) }),
        new Promise(resolve => setTimeout(resolve, 800))
      ]);
      const data = await res.json();
      if (res.ok) setTranslatedContent(data.translation);
      else throw new Error(data.error || "Falha na resposta do servidor.");
    } catch (err) { setAiError(`Falha ao traduzir para ${lang}.`); } finally { setIsTranslating(false); e.target.value = ''; }
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

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

  const isDarkBase = activePalette && activePalette.bgColor ? (activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1')) : true;

  if (loading) return <div style={{...styles.center, backgroundColor: activePalette.bgColor }}><Loader2 color={activePalette.fontColor} size={40} className="animate-spin" /></div>;

  const defaultCSSPattern = isDarkBase 
    ? `radial-gradient(circle at 15% 40%, rgba(138, 180, 248, 0.25), transparent 45%), 
       radial-gradient(circle at 85% 60%, rgba(197, 138, 248, 0.25), transparent 45%), 
       linear-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px), 
       linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px)`
    : `radial-gradient(circle at 15% 40%, rgba(26, 115, 232, 0.15), transparent 45%), 
       radial-gradient(circle at 85% 60%, rgba(161, 66, 244, 0.15), transparent 45%), 
       linear-gradient(rgba(0, 0, 0, 0.08) 1px, transparent 1px), 
       linear-gradient(90deg, rgba(0, 0, 0, 0.08) 1px, transparent 1px)`;

  const bgImageToUse = hasCustomImage
    ? (isDarkBase 
        ? `url("${activePalette.bgImage}")` 
        : `linear-gradient(rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.85)), url("${activePalette.bgImage}")`)
    : defaultCSSPattern;

  const bgSizeToUse = hasCustomImage
    ? 'cover'
    : '100% 100%, 100% 100%, 40px 40px, 40px 40px';

    <div style={{
      backgroundColor: activePalette.bgColor, 
      backgroundImage: bgImageToUse,
      backgroundSize: bgSizeToUse,
      backgroundAttachment: 'fixed', 
      backgroundPosition: 'center',
      color: activePalette.fontColor, fontFamily: settings.shared.fontFamily,
      minHeight: '100vh', width: '100%', margin: 0, padding: 0, position: 'relative', transition: 'background-color 0.5s ease, color 0.5s ease'
    }}>
      
      {/* Componente Toast Nativo */}
      <div style={{ position: 'fixed', top: '30px', left: '50%', transform: toast.show ? 'translate(-50%, 0)' : 'translate(-50%, -120px)', opacity: toast.show ? 1 : 0, backgroundColor: toast.type === 'error' ? '#000' : '#fff', color: toast.type === 'error' ? '#fff' : '#000', padding: '15px 25px', borderRadius: '8px', zIndex: 10000, boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)', border: '2px solid #000', fontWeight: 'bold', fontSize: '12px', textTransform: 'uppercase', pointerEvents: 'none' }}>
        {toast.type === 'error' ? <AlertTriangle size={18} /> : <Check size={18} />} {toast.message}
      </div>

      {/* Componentes Modais Isolados */}
      <ShareOverlay 
        modalState={emailModal} 
        setModalState={setEmailModal} 
        onSubmit={submitEmailShare} 
        activePalette={activePalette} 
      />
      
      <DisclaimerModal 
        show={showDisclaimer} 
        onClose={() => setShowDisclaimer(false)} 
        activePalette={activePalette} 
      />

      <style>{`
        @keyframes fadeIn { to { opacity: 1; transform: translateY(0); } }
        .fade-in-node { opacity: 0; transform: translateY(10px); animation: fadeIn 1.5s forwards; }

        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
        
        @keyframes pulseGlow { 
          0% { box-shadow: 0 0 5px rgba(77, 166, 255, 0.2); border-color: rgba(77, 166, 255, 0.4); } 
          50% { box-shadow: 0 0 20px rgba(77, 166, 255, 0.8); border-color: rgba(77, 166, 255, 1); } 
          100% { box-shadow: 0 0 5px rgba(77, 166, 255, 0.2); border-color: rgba(77, 166, 255, 0.4); } 
        }
        .processing-active { animation: pulseGlow 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite !important; color: #4da6ff !important; }
        
        .public-wrapper { padding: 40px 20px; width: 100%; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; }
        
        .app-container { max-width: 1200px; width: 100%; padding: 50px; border: 1px solid rgba(128,128,128,0.2); background-color: ${activePalette.bgColor}; margin: auto; box-sizing: border-box; border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,0.15); transition: background-color 0.5s ease; }
        
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
        
        /* INJEÇÃO ARQUITETURAL: Classes de Proteção Anti-Cópia */
        .protected-content { 
          user-select: none; 
          -webkit-user-select: none; 
          -ms-user-select: none; 
        }

        .p-content, .html-content p, .html-content ul, .html-content ol { font-size: ${settings.shared.fontSize}; color: ${activePalette.fontColor}; transition: color 0.5s ease; }
        .html-content h1 { color: ${activePalette.titleColor}; margin: 2rem 0 1rem 0; font-weight: bold; font-size: ${settings.shared.titleFontSize}; transition: color 0.5s ease; }
        .html-content h2 { color: ${activePalette.titleColor}; margin: 2rem 0 1rem 0; font-weight: bold; font-size: calc(${settings.shared.titleFontSize} * 0.85); transition: color 0.5s ease; }
        .html-content h3 { color: ${activePalette.titleColor}; margin: 2rem 0 1rem 0; font-weight: bold; font-size: calc(${settings.shared.titleFontSize} * 0.70); transition: color 0.5s ease; }
        .p-content { text-align: justify; line-height: 1.9; text-indent: 3.5rem; font-weight: bold; margin: 0 0 1.8rem 0; }
        .html-content p { text-align: justify; line-height: 1.9; text-indent: 3.5rem; font-weight: bold; margin: 0 0 1.8rem 0; }
        .html-content ul, .html-content ol { margin: 0 0 1.8rem 3.5rem; line-height: 1.9; font-weight: bold; }
        .html-content li { margin-bottom: 0.5rem; }
        .html-content a { color: #4da6ff; text-decoration: underline; text-underline-offset: 4px; font-weight: bold; }
        
        /* INJEÇÃO ARQUITETURAL: Estilos do Painel de Compartilhamento */
        .share-bar { 
          display: flex; 
          justify-content: center; 
          gap: 15px; 
          margin-top: 3rem; 
          padding-top: 2rem; 
          border-top: 1px solid rgba(128,128,128, 0.2); 
        }
        .share-btn { 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          gap: 8px; 
          padding: 10px 15px; 
          border-radius: 6px; 
          cursor: pointer; 
          font-family: inherit;
          font-size: 11px; 
          font-weight: bold; 
          letter-spacing: 1px; 
          text-transform: uppercase; 
          border: none; 
          transition: all 0.2s; 
          color: #fff; 
        }
        .share-whatsapp { background: #25D366; } 
        .share-whatsapp:hover { background: #128C7E; transform: translateY(-2px); }
        .share-link { background: #64748b; } 
        .share-link:hover { background: #475569; transform: translateY(-2px); }
        .share-email { background: #0ea5e9; } 
        .share-email:hover:not(:disabled) { background: #0284c7; transform: translateY(-2px); }
        .share-email:disabled { background: #94a3b8; cursor: wait; }

        .floating-controls { position: fixed; right: 30px; bottom: 30px; display: flex; flex-direction: column; gap: 15px; z-index: 9999; }
        .fab-btn { background-color: ${activePalette.bgColor}; border: 1px solid rgba(128,128,128,0.3); color: ${activePalette.fontColor}; width: 55px; height: 55px; border-radius: 50%; display: flex; justify-content: center; align-items: center; cursor: pointer; backdrop-filter: blur(8px); transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
        .fab-btn:hover { transform: scale(1.1); border-color: ${activePalette.fontColor}; }
        
        .fab-btn.chat-trigger { background: linear-gradient(135deg, #0044cc, #3399ff); border: none; box-shadow: 0 6px 20px rgba(51, 153, 255, 0.4); color: #fff;}
        .fab-btn.chat-trigger:hover { transform: scale(1.15) rotate(5deg); box-shadow: 0 8px 25px rgba(51, 153, 255, 0.6); }
        .fab-btn.chat-active { background: ${activePalette.bgColor}; color: #4da6ff; border: 1px solid #4da6ff; }
        
        .chat-window { position: fixed; right: 30px; bottom: 100px; width: 380px; height: 550px; max-height: 80vh; background-color: ${activePalette.bgColor}; border: 1px solid rgba(77, 166, 255, 0.3); border-radius: 16px; display: flex; flex-direction: column; z-index: 10000; box-shadow: 0 20px 60px rgba(0,0,0,0.3), 0 0 30px rgba(77, 166, 255, 0.1); overflow: hidden; animation: fadeIn 0.3s ease-out; }
        .chat-header { background: linear-gradient(to right, rgba(0, 68, 204, 0.9), rgba(51, 153, 255, 0.8)); padding: 18px; display: flex; justify-content: space-between; align-items: center; font-weight: bold; letter-spacing: 1.5px; font-size: 14px; text-transform: uppercase; box-shadow: 0 2px 10px rgba(0,0,0,0.1); color: #fff; }
        .chat-body { flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 15px; scroll-behavior: smooth; }
        .chat-bubble { padding: 12px 18px; border-radius: 12px; font-size: 14px; line-height: 1.6; max-width: 85%; word-wrap: break-word; font-family: sans-serif; }
        .bubble-user { background: rgba(128,128,128,0.1); align-self: flex-end; border-bottom-right-radius: 2px; color: ${activePalette.fontColor}; }
        .bubble-bot { background: rgba(51, 153, 255, 0.15); align-self: flex-start; border-bottom-left-radius: 2px; border: 1px solid rgba(51, 153, 255, 0.3); color: ${activePalette.fontColor}; }
        .chat-footer { padding: 15px; background: ${activePalette.bgColor}; border-top: 1px solid rgba(128,128,128,0.2); display: flex; gap: 12px; }
        .chat-input { flex: 1; background: rgba(128,128,128,0.05); border: 1px solid rgba(128,128,128,0.2); padding: 12px 15px; border-radius: 8px; color: inherit; font-family: sans-serif; font-size: 14px; outline: none; transition: border-color 0.3s; }
        .chat-input:focus { border-color: #4da6ff; background: rgba(128,128,128,0.1); }
        .chat-send { background: #4da6ff; color: #000; border: none; cursor: pointer; padding: 10px; border-radius: 8px; display: flex; justify-content: center; align-items: center; transition: all 0.2s; }
        .chat-send:hover:not(:disabled) { background: #66b3ff; transform: translateY(-2px); }
        .chat-send:disabled { opacity: 0.5; cursor: not-allowed; background: rgba(128,128,128,0.2); color: ${activePalette.fontColor}; }

        @media (max-width: 768px) {
          .public-wrapper { padding: 20px 10px; }
          .app-container { padding: 30px 20px; border-radius: 0; }
          .floating-controls { right: 15px; bottom: 15px; }
          .chat-window { right: 10px; bottom: 85px; width: calc(100vw - 20px); height: 65vh; }
        }
      `}</style>

      {/* Componentes Flutuantes Isolados */}
      <FloatingControls 
        showBackToTop={showBackToTop} 
        scrollToTop={scrollToTop} 
        userTheme={userTheme} 
        cycleTheme={cycleTheme} 
        isChatOpen={isChatOpen} 
        setIsChatOpen={setIsChatOpen} 
        activePalette={activePalette} 
      />

      <ChatWidget 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)} 
        currentPost={currentPost} 
        activePalette={activePalette} 
        API_URL={API_URL} 
      />

      <div className="public-wrapper">
        <div className="fade-in-node app-container">
          {currentPost && (
            <div>
              <h1 className="h1-title">{currentPost.title}</h1>
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
                  <div className="ai-error-msg">
                    <AlertTriangle size={16} /> {aiError}
                  </div>
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

              {/* INJEÇÃO ARQUITETURAL: Aplicação de Muralha Anti-Cópia via Eventos DOM */}
              <div 
                className="protected-content" 
                onCopy={(e) => { e.preventDefault(); return false; }} 
                onContextMenu={(e) => { e.preventDefault(); return false; }} 
                onDragStart={(e) => { e.preventDefault(); return false; }}
              >
                {renderContent(currentPost.content)}
              </div>

              {/* INJEÇÃO ARQUITETURAL: Painel de Compartilhamento */}
              <div className="share-bar">
                <button onClick={() => handleShare('whatsapp')} className="share-btn share-whatsapp" title="Compartilhar no WhatsApp">
                  <MessageCircle size={16} /> WhatsApp
                </button>
                <button onClick={() => handleShare('link')} className="share-btn share-link" title="Copiar Link Direto">
                  <Link2 size={16} /> Copiar Link
                </button>
                <button onClick={() => handleShare('email')} disabled={isSendingEmail} className="share-btn share-email" title="Enviar por E-mail">
                  {isSendingEmail ? <Loader2 className="animate-spin" size={16} /> : <Mail size={16} />} E-Mail
                </button>
              </div>

            </div>
          )}
        </div>

        {/* Componente Modular do Rodapé de Arquivos */}
        <ArchiveMenu 
          posts={posts} 
          currentPost={currentPost} 
          setCurrentPost={setCurrentPost} 
          activePalette={activePalette} 
          APP_VERSION={APP_VERSION} 
        />
        
      </div>
    </div>
  );
};

const styles = {
  center: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 0.5s ease' }
};

export default App;