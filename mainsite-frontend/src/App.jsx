// Módulo: mainsite-frontend/src/App.jsx
// Versão: v3.6.0
// Descrição: Código COMPLETO. Injeção de lógica de SEO Dinâmico (Vanilla DOM Manipulation). O title e a meta-description agora reagem à mudança do fragmento visualizado, extraindo um extrato limpo do Tiptap HTML.

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Loader2, ChevronUp, ArrowUp, Search, Bot, X, Send, Languages, AlignLeft, Sparkles, AlertTriangle, Sun, Moon, Monitor } from 'lucide-react';

const API_URL = 'https://mainsite-app.lcv.workers.dev/api';
const APP_VERSION = 'APP v3.6.0';

const App = () => {
  const [posts, setPosts] = useState([]);
  const [currentPost, setCurrentPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
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
  const [chatMessages, setChatMessages] = useState([{ role: 'bot', text: 'Olá. Como posso ajudar você a explorar os textos publicados neste site?' }]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef(null);

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

  // --- MOTOR DE SEO DINÂMICO E GERENCIAMENTO DE IA ---
  useEffect(() => {
    setPostSummary(null);
    setTranslatedContent(null);
    setAiError(null);

    // Manipulação nativa do DOM para injeção de SEO em Single Page Applications
    if (currentPost) {
      document.title = `${currentPost.title} | Divagações Filosóficas`;
      
      // Sanitização de Regex para extrair apenas texto limpo do HTML gerado pelo Tiptap
      const cleanText = currentPost.content ? currentPost.content.replace(/<[^>]*>?/gm, '').substring(0, 160) + '...' : '';
      
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute("content", cleanText);
      
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute("content", currentPost.title);
      
      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) ogDesc.setAttribute("content", cleanText);
    } else {
      document.title = "Divagações Filosóficas";
    }
  }, [currentPost]);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const fetchData = async () => {
    try {
      const [resPosts, resSettings] = await Promise.all([ fetch(`${API_URL}/posts`), fetch(`${API_URL}/settings`) ]);
      const dataPosts = await resPosts.json();
      const dataSettings = await resSettings.json();

      if (Array.isArray(dataPosts)) {
        setPosts(dataPosts);
        if (dataPosts.length > 0) setCurrentPost(dataPosts[0]);
      }
      
      if (!dataSettings.error) {
         if (dataSettings.light) {
             setSettings(dataSettings);
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
    if (!settings.allowAutoMode && userTheme === 'auto') return settings.dark;
    let resolved = userTheme;
    if (resolved === 'auto') resolved = systemIsDark ? 'dark' : 'light';
    return resolved === 'dark' ? settings.dark : settings.light;
  }, [settings, userTheme, systemIsDark]);

  const cycleTheme = () => {
    const modes = settings.allowAutoMode ? ['auto', 'light', 'dark'] : ['light', 'dark'];
    const nextIndex = (modes.indexOf(userTheme) + 1) % modes.length;
    const next = modes[nextIndex];
    setUserTheme(next);
    localStorage.setItem('themePref', next);
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

  const handleSendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;
    const userMessage = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setChatInput(''); setIsChatLoading(true);

    try {
      const [res] = await Promise.all([
        fetch(`${API_URL}/ai/public/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: userMessage }) }),
        new Promise(resolve => setTimeout(resolve, 800))
      ]);
      const data = await res.json();
      if (res.ok) setChatMessages(prev => [...prev, { role: 'bot', text: data.reply }]);
      else throw new Error();
    } catch (err) { setChatMessages(prev => [...prev, { role: 'bot', text: "Desculpe, ocorreu um erro de conexão com a IA." }]); } finally { setIsChatLoading(false); }
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const renderContent = (content) => {
    const activeContent = translatedContent || content;
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

  const isDarkBase = activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1');

  if (loading) return <div style={{...styles.center, backgroundColor: activePalette.bgColor }}><Loader2 color={activePalette.fontColor} size={40} className="animate-spin" /></div>;

  const filteredArchive = posts.filter(post => {
    const matchesSearch = searchTerm === '' || post.title.toLowerCase().includes(searchTerm.toLowerCase()) || post.content.toLowerCase().includes(searchTerm.toLowerCase());
    return searchTerm ? matchesSearch : (matchesSearch && post.id !== currentPost?.id);
  });

  const defaultCSSPattern = isDarkBase 
    ? `radial-gradient(circle at 15% 40%, rgba(138, 180, 248, 0.25), transparent 45%), 
       radial-gradient(circle at 85% 60%, rgba(197, 138, 248, 0.25), transparent 45%), 
       linear-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px), 
       linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px)`
    : `radial-gradient(circle at 15% 40%, rgba(26, 115, 232, 0.15), transparent 45%), 
       radial-gradient(circle at 85% 60%, rgba(161, 66, 244, 0.15), transparent 45%), 
       linear-gradient(rgba(0, 0, 0, 0.08) 1px, transparent 1px), 
       linear-gradient(90deg, rgba(0, 0, 0, 0.08) 1px, transparent 1px)`;

  const hasCustomImage = activePalette.bgImage && activePalette.bgImage.trim() !== '';
  
  const bgImageToUse = hasCustomImage
    ? (isDarkBase 
        ? `url("${activePalette.bgImage}")` 
        : `linear-gradient(rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.85)), url("${activePalette.bgImage}")`)
    : defaultCSSPattern;

  const bgSizeToUse = hasCustomImage
    ? 'cover'
    : '100% 100%, 100% 100%, 40px 40px, 40px 40px';

  return (
    <div style={{
      backgroundColor: activePalette.bgColor, 
      backgroundImage: bgImageToUse,
      backgroundSize: bgSizeToUse,
      backgroundAttachment: 'fixed', 
      backgroundPosition: 'center',
      color: activePalette.fontColor, fontFamily: settings.shared.fontFamily,
      minHeight: '100vh', width: '100%', margin: 0, padding: 0, position: 'relative', transition: 'background-color 0.5s ease, color 0.5s ease'
    }}>
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
        
        .app-container { max-width: 1200px; width: 100%; padding: 50px; border: 1px solid rgba(${isDarkBase ? '255,255,255' : '0,0,0'},0.1); background-color: rgba(${isDarkBase ? '15,15,15,0.7' : '255,255,255,0.8'}); backdrop-filter: blur(12px); margin: auto; box-sizing: border-box; border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,0.15); transition: background-color 0.5s ease; }
        
        .h1-title { text-align: center; font-size: ${settings.shared.titleFontSize}; letter-spacing: 0.3em; margin-bottom: 2rem; color: ${activePalette.titleColor}; text-transform: uppercase; font-weight: bold; transition: color 0.5s ease;}
        
        .ai-actions-container { margin-bottom: 3rem; width: 100%; display: flex; flex-direction: column; align-items: center; gap: 15px; }
        .ai-actions-bar { display: flex; justify-content: center; gap: 20px; flex-wrap: wrap; }
        
        .ai-btn { background: linear-gradient(145deg, rgba(${isDarkBase ? '255,255,255' : '0,0,0'},0.08), rgba(${isDarkBase ? '255,255,255' : '0,0,0'},0.02)); border: 1px solid rgba(${isDarkBase ? '255,255,255' : '0,0,0'},0.15); color: ${activePalette.fontColor}; padding: 12px 20px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-family: inherit; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1.5px; transition: all 0.3s ease; border-radius: 6px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); backdrop-filter: blur(5px); font-weight: bold; }
        .ai-btn:hover:not(:disabled) { background: linear-gradient(145deg, rgba(${isDarkBase ? '255,255,255' : '0,0,0'},0.15), rgba(${isDarkBase ? '255,255,255' : '0,0,0'},0.05)); border-color: #4da6ff; transform: translateY(-2px); box-shadow: 0 6px 20px rgba(77, 166, 255, 0.2); }
        .ai-btn:disabled { opacity: 1; cursor: wait; background: rgba(${isDarkBase ? '0,0,0' : '255,255,255'}, 0.8); }
        .ai-btn.revert-btn { border-color: rgba(255, 77, 77, 0.5); color: #ff4d4d; }
        .ai-btn.revert-btn:hover { border-color: #ff4d4d; box-shadow: 0 6px 20px rgba(255, 77, 77, 0.2); }
        
        .ai-select { background: transparent; color: inherit; border: none; outline: none; cursor: pointer; font-family: inherit; appearance: none; padding-right: 15px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
        .ai-select:disabled { cursor: wait; color: inherit; }
        .ai-select option { background: ${activePalette.bgColor}; color: ${activePalette.fontColor}; text-transform: none; }
        
        .ai-error-msg { display: flex; align-items: center; gap: 8px; color: #ff4d4d; font-size: 13px; font-weight: bold; background: rgba(255, 77, 77, 0.1); padding: 8px 16px; border-radius: 4px; border: 1px solid rgba(255, 77, 77, 0.3); animation: fadeIn 0.3s ease-out; }
        
        .ai-summary-box { background: linear-gradient(to right, rgba(0, 150, 255, 0.05), transparent); border-left: 4px solid #4da6ff; padding: 25px; margin-bottom: 3rem; font-style: italic; line-height: 1.6; border-radius: 0 8px 8px 0; }
        
        .p-content, .html-content p, .html-content ul, .html-content ol { font-size: ${settings.shared.fontSize}; color: ${activePalette.fontColor}; transition: color 0.5s ease; }
        .html-content h1 { color: ${activePalette.titleColor}; margin: 2rem 0 1rem 0; font-weight: bold; font-size: ${settings.shared.titleFontSize}; transition: color 0.5s ease; }
        .html-content h2 { color: ${activePalette.titleColor}; margin: 2rem 0 1rem 0; font-weight: bold; font-size: calc(${settings.shared.titleFontSize} * 0.85); transition: color 0.5s ease; }
        .html-content h3 { color: ${activePalette.titleColor}; margin: 2rem 0 1rem 0; font-weight: bold; font-size: calc(${settings.shared.titleFontSize} * 0.70); transition: color 0.5s ease; }
        .p-content { text-align: justify; line-height: 1.9; text-indent: 3.5rem; font-weight: bold; margin: 0 0 1.8rem 0; }
        .html-content p { text-align: justify; line-height: 1.9; text-indent: 3.5rem; font-weight: bold; margin: 0 0 1.8rem 0; }
        .html-content ul, .html-content ol { margin: 0 0 1.8rem 3.5rem; line-height: 1.9; font-weight: bold; }
        .html-content li { margin-bottom: 0.5rem; }
        .html-content a { color: #4da6ff; text-decoration: underline; text-underline-offset: 4px; font-weight: bold; }
        
        .archive-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 20px; padding: 20px; width: 100%; box-sizing: border-box; }
        
        .floating-controls { position: fixed; right: 30px; bottom: 30px; display: flex; flex-direction: column; gap: 15px; z-index: 9999; }
        .fab-btn { background-color: rgba(${isDarkBase ? '15,15,15' : '240,240,240'},0.9); border: 1px solid rgba(${isDarkBase ? '255,255,255' : '0,0,0'},0.15); color: inherit; width: 55px; height: 55px; border-radius: 50%; display: flex; justify-content: center; align-items: center; cursor: pointer; backdrop-filter: blur(8px); transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
        .fab-btn:hover { transform: scale(1.1); border-color: rgba(${isDarkBase ? '255,255,255' : '0,0,0'},0.4); }
        
        .fab-btn.chat-trigger { background: linear-gradient(135deg, #0044cc, #3399ff); border: none; box-shadow: 0 6px 20px rgba(51, 153, 255, 0.4); color: #fff;}
        .fab-btn.chat-trigger:hover { transform: scale(1.15) rotate(5deg); box-shadow: 0 8px 25px rgba(51, 153, 255, 0.6); }
        .fab-btn.chat-active { background: ${isDarkBase ? '#1a1a1a' : '#fff'}; color: #4da6ff; border: 1px solid #4da6ff; }
        
        .chat-window { position: fixed; right: 30px; bottom: 100px; width: 380px; height: 550px; max-height: 80vh; background-color: rgba(${isDarkBase ? '10,10,10' : '255,255,255'},0.95); border: 1px solid rgba(77, 166, 255, 0.3); border-radius: 16px; display: flex; flex-direction: column; z-index: 10000; backdrop-filter: blur(15px); box-shadow: 0 20px 60px rgba(0,0,0,0.3), 0 0 30px rgba(77, 166, 255, 0.1); overflow: hidden; animation: fadeIn 0.3s ease-out; }
        .chat-header { background: linear-gradient(to right, rgba(0, 68, 204, 0.9), rgba(51, 153, 255, 0.8)); padding: 18px; display: flex; justify-content: space-between; align-items: center; font-weight: bold; letter-spacing: 1.5px; font-size: 14px; text-transform: uppercase; box-shadow: 0 2px 10px rgba(0,0,0,0.1); color: #fff; }
        .chat-body { flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 15px; scroll-behavior: smooth; }
        .chat-bubble { padding: 12px 18px; border-radius: 12px; font-size: 14px; line-height: 1.6; max-width: 85%; word-wrap: break-word; font-family: sans-serif; }
        .bubble-user { background: rgba(${isDarkBase ? '255,255,255' : '0,0,0'},0.1); align-self: flex-end; border-bottom-right-radius: 2px; color: ${activePalette.fontColor}; }
        .bubble-bot { background: rgba(51, 153, 255, 0.15); align-self: flex-start; border-bottom-left-radius: 2px; border: 1px solid rgba(51, 153, 255, 0.3); color: ${activePalette.fontColor}; }
        .chat-footer { padding: 15px; background: rgba(${isDarkBase ? '0,0,0' : '245,245,245'},0.6); border-top: 1px solid rgba(${isDarkBase ? '255,255,255' : '0,0,0'},0.05); display: flex; gap: 12px; }
        .chat-input { flex: 1; background: rgba(${isDarkBase ? '255,255,255' : '0,0,0'},0.05); border: 1px solid rgba(${isDarkBase ? '255,255,255' : '0,0,0'},0.1); padding: 12px 15px; border-radius: 8px; color: inherit; font-family: sans-serif; font-size: 14px; outline: none; transition: border-color 0.3s; }
        .chat-input:focus { border-color: #4da6ff; background: rgba(${isDarkBase ? '255,255,255' : '0,0,0'},0.08); }
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

      {isChatOpen && (
        <div className="chat-window">
          <div className="chat-header">
            <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}><Bot size={18} color="#fff"/> Assistente Virtual</div>
            <button onClick={() => setIsChatOpen(false)} style={{background:'rgba(0,0,0,0.2)', border:'none', color:'inherit', cursor:'pointer', padding: '5px', borderRadius: '50%', display: 'flex', transition: 'background 0.2s'}}><X size={16}/></button>
          </div>
          <div className="chat-body">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`chat-bubble ${msg.role === 'user' ? 'bubble-user' : 'bubble-bot'}`}>{msg.text}</div>
            ))}
            {isChatLoading && (
              <div className="chat-bubble bubble-bot processing-active" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Loader2 size={16} className="animate-spin text-blue-400" /> Processando...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={handleSendChatMessage} className="chat-footer">
            <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Digite sua pergunta..." className="chat-input" disabled={isChatLoading} />
            <button type="submit" className="chat-send" disabled={isChatLoading}><Send size={18} /></button>
          </form>
        </div>
      )}

      <div className="floating-controls">
        {showBackToTop && (
          <button onClick={scrollToTop} className="fab-btn" title="Voltar ao Topo">
            <ArrowUp size={20} />
          </button>
        )}
        
        <button onClick={cycleTheme} className="fab-btn" title={`Modo do Tema: ${userTheme.toUpperCase()}`}>
          {userTheme === 'auto' ? <Monitor size={20} /> : userTheme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
        </button>

        <button onClick={() => setIsChatOpen(!isChatOpen)} className={`fab-btn chat-trigger ${isChatOpen ? 'chat-active' : ''}`} title="Busca Semântica / Conversar">
          {isChatOpen ? <X size={24} /> : <Bot size={24} />}
        </button>
      </div>

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

              {renderContent(currentPost.content)}
            </div>
          )}
        </div>

        <footer style={styles.footer}>
          <button onClick={() => setIsHistoryOpen(!isHistoryOpen)} style={styles.archiveToggle} className="archive-btn">
            <span style={{ letterSpacing: '0.5em', color: activePalette.fontColor, transition: 'color 0.5s ease' }}>FRAGMENTOS ANTERIORES</span>
            <ChevronUp size={16} color={activePalette.fontColor} style={{ transform: isHistoryOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.5s' }} />
          </button>
          
          <div style={{ maxHeight: isHistoryOpen ? '2000px' : '0', opacity: isHistoryOpen ? 1 : 0, overflow: 'hidden', transition: 'all 0.8s ease-in-out', width: '100%', maxWidth: '1200px' }}>
            <div style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid rgba(${isDarkBase ? '255,255,255' : '0,0,0'},0.2)`, margin: '20px 20px 0 20px', paddingBottom: '15px' }}>
              <Search size={18} style={{ opacity: 0.6, marginRight: '15px' }} color={activePalette.fontColor} />
              <input type="text" placeholder="BUSCA EXATA POR PALAVRAS-CHAVE..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ background: 'none', border: 'none', color: 'inherit', fontFamily: 'inherit', fontSize: '12px', width: '100%', outline: 'none', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 'bold' }} />
            </div>

            <div className="archive-grid">
              {filteredArchive.length > 0 ? (
                filteredArchive.map(post => (
                  <div key={post.id} onClick={() => { setCurrentPost(post); setIsHistoryOpen(false); window.scrollTo(0,0); setSearchTerm(''); }} style={{...styles.card, backgroundColor: `rgba(${isDarkBase ? '0,0,0' : '255,255,255'},0.5)`, borderColor: `rgba(${isDarkBase ? '255,255,255' : '0,0,0'},0.1)` }}>
                    <div style={styles.cardDate}>{new Date(post.created_at).toLocaleDateString('pt-BR')}</div>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold', color: activePalette.titleColor, transition: 'color 0.5s ease' }}>{post.title}</div>
                  </div>
                ))
              ) : (<div style={{ gridColumn: '1 / -1', textAlign: 'center', opacity: 0.6, fontSize: '12px', padding: '40px 0', textTransform: 'uppercase', letterSpacing: '2px' }}>Nenhum registro encontrado.</div>)}
            </div>
          </div>
          <div style={{ marginTop: '40px', fontSize: '10px', opacity: 0.5, letterSpacing: '4px', textTransform: 'uppercase', fontWeight: 'bold' }}>{APP_VERSION}</div>
        </footer>
      </div>
    </div>
  );
};

const styles = {
  center: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 0.5s ease' },
  footer: { marginTop: '40px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: '40px' },
  archiveToggle: { background: 'none', border: 'none', fontSize: '10px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', opacity: 0.7 },
  card: { padding: '25px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.3s', borderRadius: '4px' },
  cardDate: { fontSize: '9px', opacity: 0.6, marginBottom: '12px' }
};

export default App;