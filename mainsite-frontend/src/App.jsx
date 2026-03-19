// Module: mainsite-frontend/src/App.jsx
// Version: v2.8.0
// Description: Frontend Orchestrator. Expanded reading frame to 960px for widescreen displays and reduced lateral padding. English comments enabled for Copilot Plus+.

import React, { useState, useEffect, useMemo, Suspense, lazy, useRef } from 'react';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

import PostReader from './components/PostReader';
import ArchiveMenu from './components/ArchiveMenu';
import FloatingControls from './components/FloatingControls';
import DonationModal from './components/DonationModal';

const ShareOverlay = lazy(() => import('./components/ShareOverlay'));
const ContactModal = lazy(() => import('./components/ContactModal'));
const CommentModal = lazy(() => import('./components/CommentModal'));
const DisclaimerModal = lazy(() => import('./components/DisclaimerModal'));
const ChatWidget = lazy(() => import('./components/ChatWidget'));

const API_URL = 'https://mainsite-app.lcv.rio.br/api';
const APP_VERSION = 'FRONTEND v2.8.0';
const SITE_NAME = 'Divagações Filosóficas';
const SITE_URL = 'https://www.lcv.rio.br';

const DEFAULT_SETTINGS = {
  allowAutoMode: true,
  light: { bgColor: '#f8f9fa', bgImage: '', fontColor: '#202124', titleColor: '#1a73e8' },
  dark: { bgColor: '#131314', bgImage: '', fontColor: '#e3e3e3', titleColor: '#8ab4f8' },
  shared: { fontSize: '1.15rem', titleFontSize: '1.8rem', fontFamily: 'system-ui, -apple-system, sans-serif' }
};

const App = () => {
  const [posts, setPosts] = useState([]);
  const [currentPost, setCurrentPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [disclaimers, setDisclaimers] = useState({ enabled: false, items: [] });
  const [userTheme, setUserTheme] = useState(localStorage.getItem('themePref') || 'auto');
  const [systemIsDark, setSystemIsDark] = useState(window.matchMedia('(prefers-color-scheme: dark)').matches);

  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const [toastTop, setToastTop] = useState(20);
  const lastPointerYRef = useRef(null);

  const [showShareModal, setShowShareModal] = useState({ show: false, email: '' });
  const [showContactModal, setShowContactModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [showDonationModal, setShowDonationModal] = useState(false);

  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showDisclaimerFlow, setShowDisclaimerFlow] = useState(false);

  const getUrlPostId = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const queryId = urlParams.get('p');
    if (queryId) return queryId;
    const pathMatch = window.location.pathname.match(/^\/(?:p|post|materia|m|s)\/(\d+)\/?$/i);
    return pathMatch ? pathMatch[1] : null;
  };

  const isEditableTarget = (target) => {
    const tag = target?.tagName?.toLowerCase();
    return !!(target?.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select');
  };

  const isDeepLinkedPost = !!getUrlPostId();

  const showNotification = (message, type = 'info') => {
    const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;
    const pointerY = lastPointerYRef.current;
    const baseY = pointerY != null ? pointerY : (viewportH * 0.5);
    const nextTop = Math.max(16, Math.min(baseY - 36, Math.max(16, viewportH - 90)));
    setToastTop(nextTop);
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
  };

  useEffect(() => {
    const trackPointer = (e) => {
      if (typeof e?.clientY === 'number') lastPointerYRef.current = e.clientY;
    };
    window.addEventListener('pointerdown', trackPointer, { passive: true });
    return () => window.removeEventListener('pointerdown', trackPointer);
  }, []);

  useEffect(() => {
    const handleKeydown = (e) => {
      const isMeta = e.ctrlKey || e.metaKey;
      const key = (e.key || '').toLowerCase();

      if (e.key === 'PrintScreen') {
        e.preventDefault();
        showNotification('Capturas de tela não são permitidas neste conteúdo.', 'error');
        return;
      }

      if (isMeta && key === 'p') {
        e.preventDefault();
        showNotification('Impressão desabilitada para proteção do conteúdo.', 'error');
        return;
      }

      if (isMeta && key === 'c' && !isEditableTarget(e.target)) {
        e.preventDefault();
        showNotification('Cópia de conteúdo desabilitada.', 'error');
      }
    };

    const style = document.createElement('style');
    style.setAttribute('data-print-protection', 'true');
    style.textContent = `
      @media print {
        body * {
          visibility: hidden !important;
        }
        body::before {
          content: "Impressão desabilitada para proteção de conteúdo.";
          visibility: visible !important;
          position: fixed;
          top: 45%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 18px;
          font-weight: 700;
          color: #111;
          background: #fff;
          padding: 16px 24px;
          border: 1px solid #ddd;
          border-radius: 12px;
          z-index: 999999;
        }
      }
    `;

    document.head.appendChild(style);
    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
      document.head.removeChild(style);
    };
  }, []);

  // Sync theme with OS
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => setSystemIsDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Initial Data Fetch
  useEffect(() => {
    const fetchData = async () => {
      try {
        const resPosts = await fetch(`${API_URL}/posts`);
        if (!resPosts.ok) throw new Error("Failed to fetch posts.");
        const dataPosts = await resPosts.json();
        setPosts(dataPosts);

        const postId = getUrlPostId();

        if (postId) {
          const found = dataPosts.find(p => p.id === parseInt(postId));
          setCurrentPost(found || (dataPosts.length > 0 ? dataPosts[0] : null));
        } else {
          setCurrentPost(dataPosts.length > 0 ? dataPosts[0] : null);
        }

        const resSettings = await fetch(`${API_URL}/settings`);
        if (resSettings.ok) {
          const dataSettings = await resSettings.json();
          if (dataSettings.light) setSettings(dataSettings);
        }

        const resDisc = await fetch(`${API_URL}/settings/disclaimers`);
        if (resDisc.ok) {
          const discData = await resDisc.json();
          if (discData.enabled && discData.items && discData.items.length > 0) {
            const visibleDisclaimers = discData.items.filter(item => localStorage.getItem(`hide_disclaimer_${item.id}`) !== 'true');
            if (visibleDisclaimers.length > 0) {
              setDisclaimers({ enabled: true, items: visibleDisclaimers });
              setShowDisclaimerFlow(true);
            }
          }
        }
      } catch { setError("Signal lost. Server connection interrupted."); }
      finally { setLoading(false); }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const upsertMeta = (selector, attrs, content) => {
      let el = document.head.querySelector(selector);
      if (!el) {
        el = document.createElement('meta');
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    const upsertCanonical = (href) => {
      let link = document.head.querySelector('link[rel="canonical"]');
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        document.head.appendChild(link);
      }
      link.setAttribute('href', href);
    };

    if (currentPost) {
      const cleanText = (currentPost.content || '').replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
      const excerpt = `${cleanText.substring(0, 155)}${cleanText.length > 155 ? '...' : ''}`;
      const canonicalUrl = `${SITE_URL}/p/${currentPost.id}`;
      const fullTitle = `${currentPost.title} | ${SITE_NAME}`;

      document.title = fullTitle;
      upsertMeta('meta[name="description"]', { name: 'description' }, excerpt || 'Leitura filosófica em Divagações Filosóficas.');
      upsertMeta('meta[property="og:type"]', { property: 'og:type' }, 'article');
      upsertMeta('meta[property="og:title"]', { property: 'og:title' }, fullTitle);
      upsertMeta('meta[property="og:description"]', { property: 'og:description' }, excerpt || currentPost.title);
      upsertMeta('meta[property="og:url"]', { property: 'og:url' }, canonicalUrl);
      upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name' }, SITE_NAME);
      upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card' }, 'summary_large_image');
      upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title' }, fullTitle);
      upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description' }, excerpt || currentPost.title);
      upsertCanonical(canonicalUrl);
    } else {
      const defaultTitle = SITE_NAME;
      const defaultDesc = 'Abstrações de uma mente em constante autorreflexão. Textos, ensaios e explorações.';
      document.title = defaultTitle;
      upsertMeta('meta[name="description"]', { name: 'description' }, defaultDesc);
      upsertMeta('meta[property="og:type"]', { property: 'og:type' }, 'website');
      upsertMeta('meta[property="og:title"]', { property: 'og:title' }, defaultTitle);
      upsertMeta('meta[property="og:description"]', { property: 'og:description' }, defaultDesc);
      upsertMeta('meta[property="og:url"]', { property: 'og:url' }, `${SITE_URL}/`);
      upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name' }, SITE_NAME);
      upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card' }, 'summary_large_image');
      upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title' }, defaultTitle);
      upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description' }, defaultDesc);
      upsertCanonical(`${SITE_URL}/`);
    }
  }, [currentPost]);

  // Back to top visibility trigger
  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const activePalette = useMemo(() => {
    const safeDark = settings.dark || DEFAULT_SETTINGS.dark;
    const safeLight = settings.light || DEFAULT_SETTINGS.light;
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

  const isDarkBase = activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1');

  const defaultCSSPattern = isDarkBase
    ? `radial-gradient(circle at 15% 40%, rgba(138, 180, 248, 0.15), transparent 45%), radial-gradient(circle at 85% 60%, rgba(197, 138, 248, 0.15), transparent 45%)`
    : `radial-gradient(circle at 15% 40%, rgba(26, 115, 232, 0.08), transparent 45%), radial-gradient(circle at 85% 60%, rgba(161, 66, 244, 0.08), transparent 45%)`;

  const appStyle = {
    backgroundColor: activePalette.bgColor,
    backgroundImage: (activePalette.bgImage && activePalette.bgImage.trim() !== '') ? `url("${activePalette.bgImage}")` : defaultCSSPattern,
    backgroundSize: 'cover',
    backgroundAttachment: 'fixed',
    color: activePalette.fontColor,
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    fontFamily: settings.shared.fontFamily,
    transition: 'background-color 0.5s ease, color 0.5s ease',
    paddingTop: '60px'
  };

  // STRUCTURAL BUMP: Increased to 1024px breakpoint with fluid lateral clamping
  const containerStyle = {
    width: '100%',
    maxWidth: '1024px', 
    padding: '0 clamp(12px, 3vw, 24px)', // Responsive padding: tight on mobile, max 24px on desktop
    flex: 1,
    boxSizing: 'border-box'
  };

  const handleShare = (method) => {
    if (!currentPost) return;
    const url = `${SITE_URL}/p/${currentPost.id}`;
    if (method === 'whatsapp') {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(url)}`, '_blank');
      fetch(`${API_URL}/shares`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ post_id: currentPost.id, post_title: currentPost.title, platform: 'whatsapp' }) }).catch(e => e);
    } else if (method === 'link') {
      navigator.clipboard.writeText(url).then(() => {
        showNotification("Link copiado para a área de transferência.", "success");
        fetch(`${API_URL}/shares`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ post_id: currentPost.id, post_title: currentPost.title, platform: 'link' }) }).catch(e => e);
      });
    } else if (method === 'email') {
      setShowShareModal({ show: true, email: '' });
    }
  };

  const submitEmailShare = async (e) => {
    e.preventDefault();
    if (!currentPost || !showShareModal.email) return;
    setIsSendingEmail(true);
    const url = `${SITE_URL}/p/${currentPost.id}`;
    try {
      const res = await fetch(`${API_URL}/share/email`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: currentPost.id, post_title: currentPost.title, link: url, target_email: showShareModal.email })
      });
      if (res.ok) { showNotification("E-mail enviado com sucesso.", "success"); setShowShareModal({ show: false, email: '' }); }
      else throw new Error("Failed to send.");
    } catch { showNotification("Erro ao enviar o e-mail.", "error"); } finally { setIsSendingEmail(false); }
  };

  const submitContact = async (formData, resetForm) => {
    setIsSubmittingContact(true);
    try {
      const res = await fetch(`${API_URL}/contact`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
      if (res.ok) { showNotification("Mensagem enviada com sucesso.", "success"); setShowContactModal(false); resetForm(); }
      else throw new Error();
    } catch { showNotification("Falha ao enviar contato.", "error"); } finally { setIsSubmittingContact(false); }
  };

  const submitComment = async (formData, resetForm) => {
    setIsSubmittingComment(true);
    try {
      const res = await fetch(`${API_URL}/comment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
      if (res.ok) { showNotification("Comentário recebido com sucesso.", "success"); setShowCommentModal(false); resetForm(); }
      else throw new Error();
    } catch { showNotification("Falha ao enviar comentário.", "error"); } finally { setIsSubmittingComment(false); }
  };

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#131314', color: '#fff' }}><Loader2 size={32} className="animate-spin" /></div>;

  return (
    <div style={appStyle}>
      <div style={{ position: 'fixed', top: `${toastTop}px`, left: '50%', transform: toast.show ? 'translate(-50%, 0)' : 'translate(-50%, -28px)', opacity: toast.show ? 1 : 0, backgroundColor: toast.type === 'error' ? 'var(--semantic-error)' : (isDarkBase ? 'rgba(30,30,30,0.95)' : 'rgba(255,255,255,0.95)'), color: toast.type === 'error' ? '#fff' : activePalette.fontColor, padding: '16px 32px', borderRadius: '100px', zIndex: 11005, boxShadow: '0 12px 36px rgba(0,0,0,0.2)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: `1px solid ${isDarkBase ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)', fontWeight: '700', fontSize: '14px' }}>
        {toast.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle size={18} />} {toast.message}
      </div>

      <main style={containerStyle}>
        {error ? (<div style={{ textAlign: 'center', color: 'var(--semantic-error)', padding: '40px', fontWeight: 'bold' }}>{error}</div>) :
          currentPost ? (
            <PostReader
              post={currentPost}
              activePalette={activePalette}
              settings={settings}
              API_URL={API_URL}
              onShare={handleShare}
              onContact={() => setShowContactModal(true)}
              onComment={() => setShowCommentModal(true)}
              onDonation={() => setShowDonationModal(true)}
              isSendingEmail={isSendingEmail}
              isNotHomePage={isDeepLinkedPost}
            />
          ) : (<div style={{ textAlign: 'center', padding: '60px', opacity: 0.5, fontWeight: '700', letterSpacing: '2px' }}>A MENTE ESTÁ EM SILÊNCIO. NENHUM FRAGMENTO ENCONTRADO.</div>)}
      </main>

      <ArchiveMenu posts={posts} currentPost={currentPost} setCurrentPost={(p) => { window.history.pushState({}, '', `/p/${p.id}`); setCurrentPost(p); }} activePalette={activePalette} APP_VERSION={APP_VERSION} />

      <FloatingControls showBackToTop={showBackToTop} scrollToTop={() => window.scrollTo({ top: 0, behavior: 'smooth' })} userTheme={userTheme} cycleTheme={cycleTheme} isChatOpen={isChatOpen} setIsChatOpen={setIsChatOpen} activePalette={activePalette} />

      <Suspense fallback={null}>
        <DisclaimerModal show={showDisclaimerFlow} onClose={() => setShowDisclaimerFlow(false)} activePalette={activePalette} config={disclaimers} onDonationTrigger={() => setShowDonationModal(true)} />
        <ShareOverlay modalState={showShareModal} setModalState={setShowShareModal} onSubmit={submitEmailShare} activePalette={activePalette} />
        <ContactModal show={showContactModal} onClose={() => setShowContactModal(false)} onSubmit={submitContact} activePalette={activePalette} isSubmitting={isSubmittingContact} />
        <CommentModal show={showCommentModal} onClose={() => setShowCommentModal(false)} onSubmit={submitComment} activePalette={activePalette} isSubmitting={isSubmittingComment} currentPost={currentPost} />
        <DonationModal show={showDonationModal} onClose={() => setShowDonationModal(false)} activePalette={activePalette} API_URL={API_URL} />
        <ChatWidget isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} currentPost={currentPost} activePalette={activePalette} API_URL={API_URL} triggerDonation={() => setShowDonationModal(true)} />
      </Suspense>
    </div>
  );
};

export default App;