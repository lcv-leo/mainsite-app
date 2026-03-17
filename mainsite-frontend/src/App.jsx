// Módulo: mainsite-frontend/src/App.jsx
// Versão: v3.22.0
// Descrição: Baseline consolidado. Motor de Temas e implementação da trava de Opt-Out (localStorage) para o DisclaimerModal.

import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { Loader2, AlertTriangle, Check } from 'lucide-react';

import PostReader from './components/PostReader';
import ArchiveMenu from './components/ArchiveMenu';
import FloatingControls from './components/FloatingControls';

const DisclaimerModal = lazy(() => import('./components/DisclaimerModal'));
const ShareOverlay = lazy(() => import('./components/ShareOverlay'));
const ChatWidget = lazy(() => import('./components/ChatWidget'));
const ContactModal = lazy(() => import('./components/ContactModal'));
const CommentModal = lazy(() => import('./components/CommentModal'));

const API_URL = 'https://mainsite-app.lcv.rio.br/api';
const APP_VERSION = 'APP v3.22.0';

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

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const [emailModal, setEmailModal] = useState({ show: false, email: '' });
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [isCommentOpen, setIsCommentOpen] = useState(false);
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [isSendingContact, setIsSendingContact] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [disclaimersConfig, setDisclaimersConfig] = useState({ enabled: false, items: [] });

  const submitCommentForm = async (formData, resetFormCb) => {
  setIsSendingComment(true);
  try {
    const res = await fetch(`${API_URL}/comment`, { 
      method: 'POST', headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(formData) 
    });
    if (res.ok) {
      showNotification("Comentário enviado com sucesso para o autor!", "success");
      resetFormCb();
      setIsCommentOpen(false);
    } else throw new Error();
  } catch (err) { 
    showNotification("Falha ao enviar comentário. Tente novamente.", "error"); 
  } finally { 
    setIsSendingComment(false); 
  }
};

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

  // INJEÇÃO DA REGRA DE OPT-OUT NO MOTOR DE ROTEAMENTO/SEO
  useEffect(() => {
    if (currentPost) {
      // Verifica no navegador se o usuário já marcou a opção "Não mostrar novamente"
      const userOptedOut = localStorage.getItem('hide_df_disclaimer');
      
      if (userOptedOut !== 'true') {
        setShowDisclaimer(true);
      }
      
      document.title = `${currentPost.title} | Divagações Filosóficas`;
      const cleanText = currentPost.content ? currentPost.content.replace(/<[^>]*>?/gm, '').substring(0, 160) + '...' : '';
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute("content", cleanText);
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute("content", currentPost.title);
      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) ogDesc.setAttribute("content", cleanText);
      
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
        const params = new URLSearchParams(window.location.search);
        const requestedPostId = params.get('p');
        setCurrentPost(requestedPostId ? (dataPosts.find(p => p.id.toString() === requestedPostId) || dataPosts[0]) : dataPosts[0]);
      }
      
      if (!dataSettings.error) {
        if (dataSettings.light) {
          setSettings({
            allowAutoMode: dataSettings.allowAutoMode ?? true,
            light: dataSettings.light, dark: dataSettings.dark,
            shared: dataSettings.shared || { fontSize: '1.15rem', titleFontSize: '1.8rem', fontFamily: 'sans-serif' }
          });
        } else {
          setSettings(prev => ({ ...prev, dark: { bgColor: dataSettings.bgColor || prev.dark.bgColor, bgImage: dataSettings.bgImage || prev.dark.bgImage, fontColor: dataSettings.fontColor || prev.dark.fontColor, titleColor: dataSettings.titleColor || prev.dark.titleColor }, shared: { fontSize: dataSettings.fontSize || prev.shared.fontSize, titleFontSize: dataSettings.titleFontSize || prev.shared.titleFontSize, fontFamily: dataSettings.fontFamily || prev.shared.fontFamily } }));
        }
      }
      const resDisc = await fetch(`${API_URL}/settings/disclaimers`);
      if (resDisc.ok) setDisclaimersConfig(await resDisc.json());
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
    setIsSendingEmail(true); setEmailModal({ show: false, email: '' });
    try {
      const res = await fetch(`${API_URL}/share/email`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ post_id: currentPost.id, post_title: currentPost.title, link: postLink, target_email: emailModal.email }) });
      if (res.ok) showNotification("E-mail disparado com sucesso!", "success"); else throw new Error();
    } catch (err) { showNotification("Falha ao enviar e-mail. Tente novamente.", "error"); } finally { setIsSendingEmail(false); }
  };

  const submitContactForm = async (formData, resetFormCb) => {
    setIsSendingContact(true);
    try {
      const res = await fetch(`${API_URL}/contact`, { 
        method: 'POST', headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(formData) 
      });
      if (res.ok) {
        showNotification("Mensagem enviada com sucesso! Verifique seu e-mail.", "success");
        resetFormCb();
        setIsContactOpen(false);
      } else throw new Error();
    } catch (err) { 
      showNotification("Falha ao enviar mensagem. Tente novamente.", "error"); 
    } finally { 
      setIsSendingContact(false); 
    }
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const isDarkBase = activePalette && activePalette.bgColor ? (activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1')) : true;
  const hasCustomImage = activePalette.bgImage && activePalette.bgImage.trim() !== '';

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: activePalette.bgColor }}><Loader2 color={activePalette.fontColor} size={40} className="animate-spin" /></div>;

  const defaultCSSPattern = isDarkBase 
    ? `radial-gradient(circle at 15% 40%, rgba(138, 180, 248, 0.25), transparent 45%), radial-gradient(circle at 85% 60%, rgba(197, 138, 248, 0.25), transparent 45%), linear-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px)`
    : `radial-gradient(circle at 15% 40%, rgba(26, 115, 232, 0.15), transparent 45%), radial-gradient(circle at 85% 60%, rgba(161, 66, 244, 0.15), transparent 45%), linear-gradient(rgba(0, 0, 0, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 0, 0, 0.08) 1px, transparent 1px)`;

  const bgImageToUse = hasCustomImage ? (isDarkBase ? `url("${activePalette.bgImage}")` : `linear-gradient(rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.85)), url("${activePalette.bgImage}")`) : defaultCSSPattern;
  const bgSizeToUse = hasCustomImage ? 'cover' : '100% 100%, 100% 100%, 40px 40px, 40px 40px';

  return (
    <div style={{ backgroundColor: activePalette.bgColor, backgroundImage: bgImageToUse, backgroundSize: bgSizeToUse, backgroundAttachment: 'fixed', backgroundPosition: 'center', color: activePalette.fontColor, fontFamily: settings.shared.fontFamily, minHeight: '100vh', width: '100%', margin: 0, padding: 0, position: 'relative', transition: 'background-color 0.5s ease, color 0.5s ease' }}>
      
      <div style={{ position: 'fixed', top: '30px', left: '50%', transform: toast.show ? 'translate(-50%, 0)' : 'translate(-50%, -120px)', opacity: toast.show ? 1 : 0, backgroundColor: toast.type === 'error' ? '#000' : '#fff', color: toast.type === 'error' ? '#fff' : '#000', padding: '15px 25px', borderRadius: '8px', zIndex: 10000, boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)', border: '2px solid #000', fontWeight: 'bold', fontSize: '12px', textTransform: 'uppercase', pointerEvents: 'none' }}>
        {toast.type === 'error' ? <AlertTriangle size={18} /> : <Check size={18} />} {toast.message}
      </div>

      <Suspense fallback={null}>
        <ShareOverlay modalState={emailModal} setModalState={setEmailModal} onSubmit={submitEmailShare} activePalette={activePalette} />
        
        <DisclaimerModal 
          show={showDisclaimer} 
          onClose={() => setShowDisclaimer(false)} 
          activePalette={activePalette} 
          config={disclaimersConfig}
        />

        <ContactModal 
          show={isContactOpen} 
          onClose={() => setIsContactOpen(false)} 
          onSubmit={submitContactForm} 
          activePalette={activePalette} 
          isSubmitting={isSendingContact} 
        />

        <CommentModal 
        show={isCommentOpen} 
        onClose={() => setIsCommentOpen(false)} 
        onSubmit={submitCommentForm} 
        activePalette={activePalette} 
        isSubmitting={isSendingComment}
        currentPost={currentPost} 
       />
        
        <ChatWidget isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} currentPost={currentPost} activePalette={activePalette} API_URL={API_URL} />
      </Suspense>

      <style>{`
        @keyframes fadeIn { to { opacity: 1; transform: translateY(0); } }
        .fade-in-node { opacity: 0; transform: translateY(10px); animation: fadeIn 1.5s forwards; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
        .public-wrapper { padding: 40px 20px; width: 100%; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; }
        .app-container { max-width: 1200px; width: 100%; padding: 50px; border: 1px solid rgba(128,128,128,0.2); background-color: ${activePalette.bgColor}; margin: auto; box-sizing: border-box; border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,0.15); transition: background-color 0.5s ease; }
        .public-wrapper h1, .public-wrapper h2, .public-wrapper h3, .public-wrapper h4 { line-height: 1.5 !important; }
        @media (max-width: 768px) { .public-wrapper { padding: 20px 10px; } .app-container { padding: 30px 20px; border-radius: 0; } }
      `}</style>

      <FloatingControls showBackToTop={showBackToTop} scrollToTop={scrollToTop} userTheme={userTheme} cycleTheme={cycleTheme} isChatOpen={isChatOpen} setIsChatOpen={setIsChatOpen} activePalette={activePalette} />
      
      <div className="public-wrapper">
        <div className="fade-in-node app-container">
          {currentPost && (
            <PostReader 
              post={currentPost} 
              activePalette={activePalette} 
              settings={settings} 
              API_URL={API_URL} 
              onShare={handleShare} 
              onContact={() => setIsContactOpen(true)}
              onComment={() => setIsCommentOpen(true)}
              isSendingEmail={isSendingEmail} 
              isNotHomePage={posts.length > 0 && currentPost.id !== posts[0].id}
            />
          )}
        </div>

        <ArchiveMenu posts={posts} currentPost={currentPost} setCurrentPost={setCurrentPost} activePalette={activePalette} APP_VERSION={APP_VERSION} />
      </div>
    </div>
  );
};

export default App;