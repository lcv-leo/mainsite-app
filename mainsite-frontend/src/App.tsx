/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
// Módulo: mainsite-frontend/src/App.tsx
// Versão: v03.15.00
// Descrição: TypeScript migration. Frontend Orchestrator — fully typed state, events, refs and component props.

import { useState, useEffect, useMemo, useCallback, Suspense, lazy, useRef, type FormEvent } from 'react';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

import type { Post, SiteSettings, DisclaimersConfig, ShareModalState, ToastState, ActivePalette, ContactFormData } from './types';
import './styles/site-shell.css';

import PostReader from './components/PostReader';
import ArchiveMenu from './components/ArchiveMenu';
import FloatingControls from './components/FloatingControls';
import { ComplianceBanner } from './components/ComplianceBanner';
import ContentUpdateToast from './components/ContentUpdateToast';
import { LicencasModule } from './modules/compliance/LicencasModule';
import { useTextZoom } from './hooks/useTextZoom';
import { useContentSync } from './hooks/useContentSync';

const ShareOverlay = lazy(() => import('./components/ShareOverlay'));
const ContactModal = lazy(() => import('./components/ContactModal'));
const CommentModal = lazy(() => import('./components/CommentModal'));
const DisclaimerModal = lazy(() => import('./components/DisclaimerModal'));
const ChatWidget = lazy(() => import('./components/ChatWidget'));
const DonationModal = lazy(() => import('./components/DonationModal'));

const API_URL = '/api';
const APP_VERSION = 'APP v03.15.03';
const SITE_NAME = 'Reflexos da Alma';
const SITE_URL = 'https://www.reflexosdaalma.blog';
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

const DEFAULT_SETTINGS: SiteSettings = {
  allowAutoMode: true,
  light: { bgColor: '#f8f9fa', bgImage: '', fontColor: '#202124', titleColor: '#4285f4' },
  dark: { bgColor: '#16171d', bgImage: '', fontColor: '#d1d5db', titleColor: '#8ab4f8' },
  shared: {
    fontSize: '1.15rem', titleFontSize: '1.8rem',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    bodyWeight: '500', titleWeight: '700', lineHeight: '1.9',
    textAlign: 'justify', textIndent: '3.5rem',
    paragraphSpacing: '2.2rem', contentMaxWidth: '1126px',
    linkColor: '#4da6ff'
  }
};

type ThemePreference = 'auto' | 'light' | 'dark';

const App = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [currentPost, setCurrentPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [disclaimers, setDisclaimers] = useState<DisclaimersConfig>({ enabled: false, items: [] });
  const [userTheme, setUserTheme] = useState<ThemePreference>((localStorage.getItem('themePref') as ThemePreference) || 'auto');
  const [systemIsDark, setSystemIsDark] = useState(window.matchMedia('(prefers-color-scheme: dark)').matches);

  const [toast, setToast] = useState<ToastState>({ show: false, message: '', type: 'info' });
  const [toastTop, setToastTop] = useState(20);
  const lastPointerYRef = useRef<number | null>(null);

  const [showShareModal, setShowShareModal] = useState<ShareModalState>({ show: false, email: '', turnstileToken: '' });
  const [showContactModal, setShowContactModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [showDonationModal, setShowDonationModal] = useState(false);
  const [donationResumeCheckoutId, setDonationResumeCheckoutId] = useState<string | null>(null);

  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showDisclaimerFlow, setShowDisclaimerFlow] = useState(false);
  const [showLicenses, setShowLicenses] = useState(false);
  const { zoomLevel, increase: increaseZoom, decrease: decreaseZoom, reset: resetZoom } = useTextZoom();

  // --- Content Sync: polling leve para detectar mudanças na homepage ---
  const contentSync = useContentSync(API_URL, !loading);

  const fetchPostDetail = useCallback(async (postId: number | string): Promise<Post | null> => {
    try {
      const res = await fetch(`${API_URL}/posts/${postId}`);
      if (!res.ok) return null;
      return await res.json() as Post;
    } catch {
      return null;
    }
  }, []);

  const openPostById = useCallback(async (postId: number | string, options?: { pushUrl?: string }) => {
    const detailed = await fetchPostDetail(postId);
    if (detailed) {
      setCurrentPost(detailed);
      if (options?.pushUrl) window.history.pushState({}, '', options.pushUrl);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const fallback = posts.find((post) => String(post.id) === String(postId)) || null;
    if (fallback) {
      setCurrentPost(fallback);
      if (options?.pushUrl) window.history.pushState({}, '', options.pushUrl);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [fetchPostDetail, posts]);

  const refreshPosts = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/posts`);
      if (!res.ok) return;
      const freshPosts: Post[] = await res.json();
      setPosts(freshPosts);

      // Navega para a home (primeiro post = headline) — mesma função do botão Home.
      // Usa '/' para que isDeepLinkedPost permaneça false.
      const target = freshPosts.length > 0 ? freshPosts[0] : null;

      if (target) {
        window.history.pushState({}, '', '/');
        const detailed = await fetchPostDetail(target.id);
        setCurrentPost(detailed || target);
      }
    } catch {
      // Falha silenciosa
    } finally {
      contentSync.refresh();
    }
  }, [contentSync, fetchPostDetail]);

  const getUrlPostId = (): string | null => {
    const urlParams = new URLSearchParams(window.location.search);
    const queryId = urlParams.get('p');
    if (queryId) return queryId;
    const pathMatch = window.location.pathname.match(/^\/(?:p|post|materia|m|s)\/(\d+)\/?$/i);
    return pathMatch ? pathMatch[1] : null;
  };

  const isEditableTarget = (target: EventTarget | null): boolean => {
    const el = target as HTMLElement | null;
    const tag = el?.tagName?.toLowerCase();
    return !!(el?.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select');
  };

  const isDeepLinkedPost = !!getUrlPostId();

  const showNotification = (message: string, type: ToastState['type'] = 'info') => {
    const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;
    const pointerY = lastPointerYRef.current;
    const baseY = pointerY != null ? pointerY : (viewportH * 0.5);
    const nextTop = Math.max(16, Math.min(baseY - 36, Math.max(16, viewportH - 90)));
    setToastTop(nextTop);
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
  };

  useEffect(() => {
    const trackPointer = (e: PointerEvent) => {
      if (typeof e?.clientY === 'number') lastPointerYRef.current = e.clientY;
    };
    window.addEventListener('pointerdown', trackPointer, { passive: true });
    return () => window.removeEventListener('pointerdown', trackPointer);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutId = params.get('checkout_id');
    if (!checkoutId) return;

    setDonationResumeCheckoutId(checkoutId);
    setShowDonationModal(true);

    const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;
    const nextTop = Math.max(16, Math.min((viewportH * 0.5) - 36, Math.max(16, viewportH - 90)));
    setToastTop(nextTop);
    setToast({
      show: true,
      message: 'Retomando o pagamento seguro para confirmar o resultado final...',
      type: 'info',
    });
    const toastTimeout = window.setTimeout(() => setToast((prev) => ({ ...prev, show: false })), 4000);

    params.delete('checkout_id');
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', nextUrl);

    return () => window.clearTimeout(toastTimeout);
  }, []);

  useEffect(() => {
    const handleCopy = (event: ClipboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const selection = document.getSelection();
      const selectedText = selection?.toString().trim();
      if (!selectedText || !event.clipboardData) return;

      const readableRoot = document.querySelector<HTMLElement>('[data-readable-content="true"]');
      const anchorNode = selection?.anchorNode;
      const focusNode = selection?.focusNode;
      const anchorEl = anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement;
      const focusEl = focusNode instanceof Element ? focusNode : focusNode?.parentElement;

      if (!readableRoot || !anchorEl || !focusEl || !readableRoot.contains(anchorEl) || !readableRoot.contains(focusEl)) {
        return;
      }

      const canonicalUrl = currentPost ? `${SITE_URL}/p/${currentPost.id}` : `${SITE_URL}/`;
      const attribution = currentPost
        ? `\n\nFonte: "${currentPost.title}" — ${canonicalUrl} — ${SITE_NAME}`
        : `\n\nFonte: ${SITE_NAME} — ${canonicalUrl}`;

      event.preventDefault();
      event.clipboardData.setData('text/plain', `${selectedText}${attribution}`);
      showNotification('Trecho copiado com referência automática da fonte.', 'success');
    };

    document.addEventListener('copy', handleCopy);
    return () => document.removeEventListener('copy', handleCopy);
  }, [currentPost]);

  // Sync theme with OS
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Initial Data Fetch
  useEffect(() => {
    const fetchData = async () => {
      try {
        const resPosts = await fetch(`${API_URL}/posts`);
        if (!resPosts.ok) throw new Error("Failed to fetch posts.");
        const dataPosts: Post[] = await resPosts.json();
        setPosts(dataPosts);

        const postId = getUrlPostId();

        if (postId) {
          const detailed = await fetchPostDetail(postId);
          const found = detailed || dataPosts.find(p => p.id === parseInt(postId)) || null;
          setCurrentPost(found || (dataPosts.length > 0 ? await fetchPostDetail(dataPosts[0].id) || dataPosts[0] : null));
        } else {
          setCurrentPost(dataPosts.length > 0 ? await fetchPostDetail(dataPosts[0].id) || dataPosts[0] : null);
        }

        const resSettings = await fetch(`${API_URL}/settings`);
        if (resSettings.ok) {
          const dataSettings = await resSettings.json();
          if (dataSettings.light) setSettings(dataSettings);
        }

        const resDisc = await fetch(`${API_URL}/settings/disclaimers`);
        if (resDisc.ok) {
          const discData: DisclaimersConfig = await resDisc.json();
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
  }, [fetchPostDetail]);

  useEffect(() => {
    const upsertMeta = (selector: string, attrs: Record<string, string>, content: string) => {
      let el = document.head.querySelector(selector) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    const upsertCanonical = (href: string) => {
      let link = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
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
      upsertMeta('meta[name="description"]', { name: 'description' }, excerpt || 'Leitura filosófica em Reflexos da Alma.');
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
      const defaultDesc = 'Abstrações de uma mente em constante autorreflexão. Textos, ensaios e explorações. By Leonardo Cardozo Vargas';
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

  // Floating scroll controls visibility trigger
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const viewportHeight = window.innerHeight;
      const pageHeight = document.documentElement.scrollHeight;
      const scrollableDistance = Math.max(0, pageHeight - viewportHeight);
      const remainingToBottom = pageHeight - (scrollTop + viewportHeight);
      const hasMeaningfulScroll = scrollableDistance > 650;

      setShowBackToTop(hasMeaningfulScroll && scrollTop > 420);
      setShowScrollToBottom(hasMeaningfulScroll && scrollTop > 120 && remainingToBottom > 420);

      // Reading progress bar
      const progress = scrollableDistance > 0 ? Math.min(100, (scrollTop / scrollableDistance) * 100) : 0;
      setReadingProgress(progress);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  const activePalette = useMemo((): ActivePalette => {
    const safeDark = settings.dark || DEFAULT_SETTINGS.dark;
    const safeLight = settings.light || DEFAULT_SETTINGS.light;
    if (!settings.allowAutoMode && userTheme === 'auto') return safeDark as ActivePalette;
    let resolved: string = userTheme;
    if (resolved === 'auto') resolved = systemIsDark ? 'dark' : 'light';
    return (resolved === 'dark' ? safeDark : safeLight) as ActivePalette;
  }, [settings, userTheme, systemIsDark]);

  const resolvedTheme = useMemo<'light' | 'dark'>(() => {
    if (!settings.allowAutoMode && userTheme === 'auto') return 'dark';
    if (userTheme === 'auto') return systemIsDark ? 'dark' : 'light';
    return userTheme;
  }, [settings.allowAutoMode, systemIsDark, userTheme]);

  const cycleTheme = () => {
    const modes: ThemePreference[] = settings.allowAutoMode ? ['auto', 'light', 'dark'] : ['light', 'dark'];
    const nextIndex = (modes.indexOf(userTheme) + 1) % modes.length;
    const next = modes[nextIndex];
    setUserTheme(next);
    localStorage.setItem('themePref', next);
  };

  const handleShare = (method: string) => {
    if (!currentPost) return;
    const url = `${SITE_URL}/p/${currentPost.id}`;
    if (method === 'whatsapp') {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(url)}`, '_blank');
      fetch(`${API_URL}/shares`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ post_id: currentPost.id, post_title: currentPost.title, platform: 'whatsapp' }) }).catch(() => {});
    } else if (method === 'link') {
      navigator.clipboard.writeText(url).then(() => {
        showNotification("Link copiado para a área de transferência.", "success");
        fetch(`${API_URL}/shares`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ post_id: currentPost.id, post_title: currentPost.title, platform: 'link' }) }).catch(() => {});
      });
    } else if (method === 'email') {
      if (!TURNSTILE_SITE_KEY) {
        showNotification("Compartilhamento por e-mail indisponível no momento.", "error");
        return;
      }
      setShowShareModal({ show: true, email: '', turnstileToken: '' });
    }
  };

  const submitEmailShare = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentPost || !showShareModal.email || !showShareModal.turnstileToken) return;
    setIsSendingEmail(true);
    const url = `${SITE_URL}/p/${currentPost.id}`;
    try {
      const res = await fetch(`${API_URL}/share/email`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: currentPost.id, post_title: currentPost.title, link: url, target_email: showShareModal.email, turnstile_token: showShareModal.turnstileToken })
      });
      if (res.ok) { showNotification("E-mail enviado com sucesso.", "success"); setShowShareModal({ show: false, email: '', turnstileToken: '' }); }
      else throw new Error("Failed to send.");
    } catch { showNotification("Erro ao enviar o e-mail.", "error"); } finally { setIsSendingEmail(false); }
  };

  const submitContact = async (formData: ContactFormData, resetForm: () => void) => {
    setIsSubmittingContact(true);
    try {
      const res = await fetch(`${API_URL}/contact`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
      if (res.ok) { showNotification("Mensagem enviada com sucesso.", "success"); setShowContactModal(false); resetForm(); }
      else throw new Error();
    } catch { showNotification("Falha ao enviar contato.", "error"); } finally { setIsSubmittingContact(false); }
  };

  const submitComment = async (formData: ContactFormData, resetForm: () => void) => {
    setIsSubmittingComment(true);
    try {
      const res = await fetch(`${API_URL}/comment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
      if (res.ok) { showNotification("Comentário recebido com sucesso.", "success"); setShowCommentModal(false); resetForm(); }
      else throw new Error();
    } catch { showNotification("Falha ao enviar comentário.", "error"); } finally { setIsSubmittingComment(false); }
  };

  if (loading) return <div role="status" aria-label="Carregando conteúdo" className="site-loading"><Loader2 size={32} className="animate-spin" /><span className="sr-only">Carregando conteúdo do site…</span></div>;

  return (
    <div className={`site-shell theme-${resolvedTheme}`}>
      {/* Reading Progress Bar */}
      <div
        role="progressbar"
        aria-valuenow={Math.round(readingProgress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progresso de leitura"
        className={`site-progress${readingProgress > 0 ? ' site-progress--visible' : ''}`}
        style={{ width: `${readingProgress}%` }}
      />
      <a href="#conteudo-principal" className="sr-only skip-link">Ir para o conteúdo principal</a>
      <div role="alert" aria-live="assertive" aria-atomic="true" className={`site-toast${toast.show ? ' site-toast--visible' : ''}${toast.type === 'error' ? ' site-toast--error' : ''}`} style={{ top: `${toastTop}px` }}>
        {toast.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle size={18} />} {toast.message}
      </div>

      <main id="conteudo-principal" className="site-main">
        {!showLicenses ? (
          <>
            {error ? (<div className="site-error">{error}</div>) :
              currentPost ? (
                <PostReader
                  post={currentPost}
                  activePalette={activePalette}
                  onShare={handleShare}
                  onContact={() => setShowContactModal(true)}
                  onComment={() => setShowCommentModal(true)}
                  onDonation={() => setShowDonationModal(true)}
                  isSendingEmail={isSendingEmail}
                  isNotHomePage={isDeepLinkedPost}
                  zoomLevel={zoomLevel}
                  apiUrl={API_URL}
                  turnstileSiteKey={TURNSTILE_SITE_KEY}
                />
              ) : (<div className="site-empty">A MENTE ESTÁ EM SILÊNCIO. NENHUM FRAGMENTO ENCONTRADO.</div>)}
          </>
        ) : (
          <div className="site-licenses">
            <div className="site-licenses__panel">
            <LicencasModule />
            <div className="site-licenses__actions">
              <button 
                onClick={() => setShowLicenses(false)} 
                type="button"
                className="site-licenses__back">
                Voltar à Leitura
              </button>
            </div>
          </div>
          </div>
        )}
      </main>

      {!showLicenses && <ArchiveMenu posts={posts} currentPost={currentPost} setCurrentPost={(p: Post) => { void openPostById(p.id, { pushUrl: `/p/${p.id}` }); }} activePalette={activePalette} APP_VERSION={APP_VERSION} />}

      <FloatingControls
        showBackToTop={showBackToTop}
        showScrollToBottom={showScrollToBottom}
        scrollToTop={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        scrollToBottom={() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })}
        userTheme={userTheme}
        cycleTheme={cycleTheme}
        isChatOpen={isChatOpen}
        setIsChatOpen={setIsChatOpen}
        activePalette={activePalette}
        zoomLevel={zoomLevel}
        onZoomIn={increaseZoom}
        onZoomOut={decreaseZoom}
        onZoomReset={resetZoom}
      />

      <Suspense fallback={null}>
        <DisclaimerModal show={showDisclaimerFlow} onClose={() => setShowDisclaimerFlow(false)} activePalette={activePalette} config={disclaimers} onDonationTrigger={() => setShowDonationModal(true)} />
        <ShareOverlay modalState={showShareModal} setModalState={setShowShareModal} onSubmit={submitEmailShare} activePalette={activePalette} turnstileSiteKey={TURNSTILE_SITE_KEY} />
        <ContactModal show={showContactModal} onClose={() => setShowContactModal(false)} onSubmit={submitContact} activePalette={activePalette} isSubmitting={isSubmittingContact} turnstileSiteKey={TURNSTILE_SITE_KEY} />
        <CommentModal show={showCommentModal} onClose={() => setShowCommentModal(false)} onSubmit={submitComment} activePalette={activePalette} isSubmitting={isSubmittingComment} currentPost={currentPost} turnstileSiteKey={TURNSTILE_SITE_KEY} />
        <DonationModal
          show={showDonationModal}
          onClose={() => {
            setShowDonationModal(false);
            setDonationResumeCheckoutId(null);
          }}
          activePalette={activePalette}
          API_URL={API_URL}
          resumeCheckoutId={donationResumeCheckoutId}
        />
        <ChatWidget isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} currentPost={currentPost} activePalette={activePalette} API_URL={API_URL} triggerDonation={() => setShowDonationModal(true)} />
      </Suspense>
      <ContentUpdateToast
        visible={contentSync.hasUpdate}
        onRefresh={refreshPosts}
        onDismiss={contentSync.dismiss}
      />
      <ComplianceBanner onViewLicenses={() => setShowLicenses(true)} />
    </div>
  );
};

export default App;
