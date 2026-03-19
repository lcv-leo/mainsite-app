// Módulo: mainsite-frontend/src/App.jsx
// Versão: v4.0.1
// Descrição: Hotfix para restaurar a funcionalidade de compartilhamento por e-mail. Implementação de um novo modal genérico e estilizado para substituir o obsoleto ShareOverlay.

import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { Loader2, AlertTriangle, Check, Send, Mail } from 'lucide-react';

// Componentes Principais
import PostReader from './components/PostReader';
import ArchiveMenu from './components/ArchiveMenu';
import FloatingControls from './components/FloatingControls';

// Componentes Lazy-loaded
const DisclaimerModal = lazy(() => import('./components/DisclaimerModal'));
const ChatWidget = lazy(() => import('./components/ChatWidget'));
const ContactModal = lazy(() => import('./components/ContactModal'));
const CommentModal = lazy(() => import('./components/CommentModal'));
const DonationModal = lazy(() => import('./components/DonationModal'));

const API_URL = 'https://mainsite-app.lcv.rio.br/api';
const APP_VERSION = 'APP v4.0.1';

// CORE STYLING ENGINE (Portado do mainsite-admin)
const getStyles = (activePalette, isDarkBase, glassBg, glassBorder, bgImageToUse) => ({
  glassBg,
  glassBorder,
  appBody: { 
    backgroundColor: activePalette.bgColor, 
    backgroundImage: bgImageToUse,
    backgroundSize: 'cover', backgroundAttachment: 'fixed',
    color: activePalette.fontColor, fontFamily: activePalette.fontFamily || 'system-ui, -apple-system, sans-serif', 
    minHeight: '100vh', padding: '40px 20px', transition: 'all 0.4s ease',
    boxSizing: 'border-box',
    display: 'flex', flexDirection: 'column', alignItems: 'center'
  },
  toast: { 
    position: 'fixed', top: '30px', left: '50%', padding: '12px 24px', borderRadius: '12px', 
    zIndex: 10000, boxShadow: '0 10px 30px rgba(0,0,0,0.15)', 
    transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)', 
    border: `1px solid ${glassBorder}`, display: 'flex', alignItems: 'center', 
    gap: '12px', fontWeight: '500', fontSize: '14px', 
    backgroundColor: glassBg, backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' 
  },
  modalOverlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: isDarkBase ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.4)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' },
  modalContent: { backgroundColor: glassBg, backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', padding: '40px', borderRadius: '24px', border: `1px solid ${glassBorder}`, maxWidth: '450px', width: '100%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', color: activePalette.fontColor },
  modalActions: { display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '30px' },
  modalBtnConfirm: { flex: 1, background: activePalette.titleColor, color: isDarkBase ? '#000' : '#fff', border: 'none', borderRadius: '12px', padding: '14px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'opacity 0.2s' },
  modalBtnCancel: { flex: 1, backgroundColor: 'transparent', color: activePalette.fontColor, border: `1px solid ${glassBorder}`, borderRadius: '12px', padding: '14px', fontWeight: '600', cursor: 'pointer', transition: 'background 0.2s' },
  textInput: { padding: '12px 16px', border: `1px solid ${glassBorder}`, backgroundColor: glassBg, backdropFilter: 'blur(5px)', color: activePalette.fontColor, outline: 'none', fontSize: '14px', borderRadius: '8px', transition: 'border 0.2s', width: '100%', boxSizing: 'border-box' },
  adminButton: { backgroundColor: activePalette.titleColor, color: isDarkBase ? '#000' : '#fff', border: 'none', borderRadius: '12px', padding: '16px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', letterSpacing: '0.5px', marginTop: '20px', transition: 'opacity 0.2s' },
  appContainer: {
    maxWidth: '1200px', width: '100%', 
    padding: ' clamp(20px, 5vw, 50px)',
    backgroundColor: glassBg,
    backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
    borderRadius: '24px', border: `1px solid ${glassBorder}`,
    boxShadow: '0 20px 40px rgba(0,0,0,0.08)'
  },
  postCard: { 
    padding: '20px 24px', border: `1px solid ${glassBorder}`, 
    backgroundColor: glassBg, backdropFilter: 'blur(5px)', 
    borderRadius: '16px', transition: 'transform 0.2s, box-shadow 0.2s'
  },
  loaderCenter: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: activePalette.bgColor }
});

const App = () => {
  const [posts, setPosts] = useState([]);
  const [currentPost, setCurrentPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showBackToTop, setShowBackToTop] = useState(false);
  
  const [settings, setSettings] = useState({
    allowAutoMode: true,
    light: { bgColor: '#f8f9fa', bgImage: '', fontColor: '#202124', titleColor: '#1a73e8' },
    dark: { bgColor: '#131314', bgImage: '', fontColor: '#e3e3e3', titleColor: '#8ab4f8' },
    shared: { fontSize: '1.15rem', titleFontSize: '1.8rem', fontFamily: 'system-ui, -apple-system, sans-serif' }
  });

  const [userTheme, setUserTheme] = useState(localStorage.getItem('themePref') || 'auto');
  const [systemIsDark, setSystemIsDark] = useState(window.matchMedia('(prefers-color-scheme: dark)').matches);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [isCommentOpen, setIsCommentOpen] = useState(false);
  const [isDonationOpen, setIsDonationOpen] = useState(false);
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [isSendingContact, setIsSendingContact] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [disclaimersConfig, setDisclaimersConfig] = useState({ enabled: false, items: [] });
  const [filteredDisclaimers, setFilteredDisclaimers] = useState({ enabled: false, items: [] });

  const [emailShareModal, setEmailShareModal] = useState({ show: false, value: '' });

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

  const fetchData = useCallback(async () => {
    try {
      const [resPosts, resSettings, resDisc] = await Promise.all([
        fetch(`${API_URL}/posts`),
        fetch(`${API_URL}/settings`),
        fetch(`${API_URL}/settings/disclaimers`)
      ]);
      
      const dataPosts = await resPosts.json();
      if (Array.isArray(dataPosts) && dataPosts.length > 0) {
        setPosts(dataPosts);
        const params = new URLSearchParams(window.location.search);
        const requestedPostId = params.get('p');
        setCurrentPost(requestedPostId ? (dataPosts.find(p => p.id.toString() === requestedPostId) || dataPosts[0]) : dataPosts[0]);
      }
      
      const dataSettings = await resSettings.json();
      if (!dataSettings.error) {
        if (dataSettings.light) setSettings(dataSettings);
        else setSettings(prev => ({ ...prev, ...dataSettings })); // Fallback
      }

      if (resDisc.ok) setDisclaimersConfig(await resDisc.json());

    } catch (err) { showNotification("Falha de comunicação com a API.", "error"); } 
    finally { setLoading(false); }
  }, [showNotification]);

  useEffect(() => {
    fetchData();
    const handleScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [fetchData]);

  useEffect(() => {
    if (currentPost) {
      if (disclaimersConfig.enabled && disclaimersConfig.items.length > 0) {
        const visibleItems = disclaimersConfig.items.filter(item => localStorage.getItem(`hide_disclaimer_${item.id}`) !== 'true');
        if (visibleItems.length > 0) {
           setFilteredDisclaimers({ enabled: true, items: visibleItems });
           setShowDisclaimer(true);
        }
      }
      document.title = `${currentPost.title} | Divagações Filosóficas`;
      const cleanText = currentPost.content ? currentPost.content.replace(/<[^>]*>?/gm, '').substring(0, 160) + '...' : '';
      document.querySelector('meta[name="description"]')?.setAttribute("content", cleanText);
      document.querySelector('meta[property="og:title"]')?.setAttribute("content", currentPost.title);
      document.querySelector('meta[property="og:description"]')?.setAttribute("content", cleanText);
      window.history.replaceState(null, '', `?p=${currentPost.id}`);
    } else {
      document.title = "Divagações Filosóficas";
    }
  }, [currentPost, disclaimersConfig]);

  const activePalette = useMemo(() => {
    const safeDark = settings.dark || { bgColor: '#131314', bgImage: '', fontColor: '#e3e3e3', titleColor: '#8ab4f8' };
    const safeLight = settings.light || { bgColor: '#f8f9fa', fontColor: '#202124', titleColor: '#1a73e8' };
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
    if (platform === 'link') {
      await navigator.clipboard.writeText(postLink);
      showNotification("Link copiado para a área de transferência!", "success");
      fetch(`${API_URL}/shares`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ post_id: currentPost.id, post_title: currentPost.title, platform: 'link', target: postLink }) });
    }
    else if (platform === 'email') {
      setEmailShareModal({ show: true, value: '' });
    }
  };

  const submitEmailShare = async (e) => {
    e.preventDefault();
    if (!emailShareModal.value || !currentPost) return;
    const postLink = `${window.location.origin}/?p=${currentPost.id}`;
    setIsSendingEmail(true);
    setEmailShareModal({ show: false, value: '' });
    try {
      const res = await fetch(`${API_URL}/share/email`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ post_id: currentPost.id, post_title: currentPost.title, link: postLink, target_email: emailShareModal.value }) });
      if (res.ok) showNotification("E-mail de compartilhamento enviado!", "success");
      else throw new Error((await res.json()).error || "Falha no envio do e-mail.");
    } catch (err) {
      showNotification(err.message, "error");
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleFormSubmit = async (endpoint, formData, resetCb, successMsg, errorMsg) => {
      const stateSetter = endpoint === 'comment' ? setIsSendingComment : setIsSendingContact;
      const modalCloser = endpoint === 'comment' ? setIsCommentOpen : setIsContactOpen;
      stateSetter(true);
      try {
        const res = await fetch(`${API_URL}/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
        if (res.ok) {
          showNotification(successMsg, "success");
          if(resetCb) resetCb();
          modalCloser(false);
        } else throw new Error((await res.json()).error || errorMsg);
      } catch (err) { showNotification(err.message || errorMsg, "error"); } 
      finally { stateSetter(false); }
  };
  
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const isDarkBase = activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1');
  const glassBg = isDarkBase ? 'rgba(30, 30, 32, 0.7)' : 'rgba(255, 255, 255, 0.75)';
  const glassBorder = isDarkBase ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';

  const defaultCSSPattern = isDarkBase 
    ? `radial-gradient(circle at 15% 40%, rgba(138, 180, 248, 0.15), transparent 45%), radial-gradient(circle at 85% 60%, rgba(197, 138, 248, 0.15), transparent 45%)`
    : `radial-gradient(circle at 15% 40%, rgba(26, 115, 232, 0.08), transparent 45%), radial-gradient(circle at 85% 60%, rgba(161, 66, 244, 0.08), transparent 45%)`;

  const bgImageToUse = (activePalette.bgImage && activePalette.bgImage.trim() !== '') 
    ? (isDarkBase ? `url("${activePalette.bgImage}")` : `linear-gradient(rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.85)), url("${activePalette.bgImage}")`) 
    : defaultCSSPattern;

  const styles = useMemo(() => 
    getStyles(activePalette, isDarkBase, glassBg, glassBorder, bgImageToUse), 
  [activePalette, isDarkBase, glassBg, glassBorder, bgImageToUse]);

  if (loading) return <div style={styles.loaderCenter}><Loader2 color={activePalette.fontColor} size={40} className="animate-spin" /></div>;

  return (
    <div style={styles.appBody}>
      
      <div style={{ ...styles.toast, transform: toast.show ? 'translate(-50%, 0)' : 'translate(-50%, -120px)', opacity: toast.show ? 1 : 0, color: toast.type === 'error' ? '#fff' : activePalette.fontColor, ...(toast.type === 'error' && { backgroundColor: '#ea4335', backdropFilter: 'blur(0px)' }) }}>
        {toast.type === 'error' ? <AlertTriangle size={18} /> : <Check size={18} />} <span>{toast.message}</span>
      </div>
      
      {emailShareModal.show && (
        <div style={styles.modalOverlay}>
            <form onSubmit={submitEmailShare} style={{...styles.modalContent, animation: 'fadeIn 0.3s ease-out'}}>
                <div style={{ display: 'flex', justifyContent: 'center', color: activePalette.titleColor, opacity: 0.8, marginBottom: '20px' }}>
                    <Mail size={40} />
                </div>
                <h3 style={{margin: '0 0 10px 0', fontSize: '18px', color: activePalette.titleColor}}>Compartilhar por E-mail</h3>
                <p style={{margin: '0 0 25px 0', fontSize: '14px', lineHeight: '1.6', opacity: 0.85}}>Insira o e-mail do destinatário.</p>
                <input type="email" required autoFocus placeholder="destinatario@email.com" value={emailShareModal.value} onChange={(e) => setEmailShareModal({...emailShareModal, value: e.target.value})} style={styles.textInput} />
                <div style={styles.modalActions}>
                    <button type="button" onClick={() => setEmailShareModal({ show: false, value: '' })} style={styles.modalBtnCancel}>CANCELAR</button>
                    <button type="submit" style={styles.modalBtnConfirm}><Send size={16}/> ENVIAR</button>
                </div>
            </form>
        </div>
      )}

      <Suspense fallback={null}>
        <DisclaimerModal show={showDisclaimer} onClose={() => setShowDisclaimer(false)} onDonationTrigger={() => setIsDonationOpen(true)} config={filteredDisclaimers} styles={styles} activePalette={activePalette} />
        <ContactModal show={isContactOpen} onClose={() => setIsContactOpen(false)} onSubmit={handleFormSubmit} isSubmitting={isSendingContact} styles={styles} activePalette={activePalette} />
        <CommentModal show={isCommentOpen} onClose={() => setIsCommentOpen(false)} onSubmit={handleFormSubmit} isSubmitting={isSendingComment} currentPost={currentPost} styles={styles} activePalette={activePalette} />
        <DonationModal show={isDonationOpen} onClose={() => setIsDonationOpen(false)} API_URL={API_URL} styles={styles} activePalette={activePalette} showNotification={showNotification} />
        <ChatWidget isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} currentPost={currentPost} triggerDonation={() => setIsDonationOpen(true)} API_URL={API_URL} styles={styles} activePalette={activePalette} showNotification={showNotification} />
      </Suspense>

      {/* O ShareOverlay foi substituído pelo modal genérico de e-mail e será removido. */}

      <FloatingControls showBackToTop={showBackToTop} scrollToTop={scrollToTop} userTheme={userTheme} cycleTheme={cycleTheme} isChatOpen={isChatOpen} setIsChatOpen={setIsChatOpen} styles={styles} activePalette={activePalette} />
      
      <div className="fade-in-node" style={styles.appContainer}>
        {currentPost && (
          <PostReader 
            post={currentPost} settings={settings} API_URL={API_URL}
            onShare={handleShare} onContact={() => setIsContactOpen(true)} onComment={() => setIsCommentOpen(true)} onDonation={() => setIsDonationOpen(true)}
            isSendingEmail={isSendingEmail} isNotHomePage={posts.length > 0 && currentPost.id !== posts[0].id}
            styles={styles} activePalette={activePalette}
          />
        )}
      </div>

      <ArchiveMenu posts={posts} currentPost={currentPost} setCurrentPost={setCurrentPost} styles={styles} activePalette={activePalette} APP_VERSION={APP_VERSION} />
    </div>
  );
};

export default App;