// Módulo: mainsite-admin/src/App.jsx
// Versão: v03.37.00
// Descrição: Monólito consolidado. Painel Financeiro integrado, exclusão mútua de abas ajustada. Glassmorphism + Material Design 3.

import React, { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import {
  Database, PlusCircle, Check, AlertCircle, Settings, RefreshCw, Loader2, BarChart2, Moon, Sun, DollarSign,
  ArrowUp, ArrowDown
} from 'lucide-react';

import PostList from './components/PostList';
import PopupPortal from './components/PopupPortal';

const SettingsPanel = lazy(() => import('./components/SettingsPanel'));
const EditorPanel = lazy(() => import('./components/EditorPanel'));
const AnalyticsPanel = lazy(() => import('./components/AnalyticsPanel'));
const FinancialPanel = lazy(() => import('./components/FinancialPanel'));

// Rota relativa — admin é servido pelo mesmo worker
const API_URL = '/api';
const APP_VERSION = 'APP v03.45.00';

const DEFAULT_SETTINGS = {
  allowAutoMode: true,
  light: { bgColor: '#f8f9fa', bgImage: '', fontColor: '#202124', titleColor: '#1a73e8' },
  dark: { bgColor: '#131314', bgImage: '', fontColor: '#e3e3e3', titleColor: '#8ab4f8' },
  shared: { fontSize: '1rem', titleFontSize: '1.5rem', fontFamily: 'system-ui, -apple-system, sans-serif' }
};

const DEFAULT_RATE_LIMIT = {
  chatbot: { enabled: false, maxRequests: 5, windowMinutes: 1 },
  email: { enabled: false, maxRequests: 3, windowMinutes: 15 }
};

const normalizeRateLimitConfig = (raw) => {
  if (!raw || typeof raw !== 'object') return DEFAULT_RATE_LIMIT;
  if ('enabled' in raw || 'maxRequests' in raw || 'windowMinutes' in raw) {
    return {
      chatbot: {
        enabled: Boolean(raw.enabled),
        maxRequests: Math.max(1, Number(raw.maxRequests) || DEFAULT_RATE_LIMIT.chatbot.maxRequests),
        windowMinutes: Math.max(1, Number(raw.windowMinutes) || DEFAULT_RATE_LIMIT.chatbot.windowMinutes)
      },
      email: { ...DEFAULT_RATE_LIMIT.email }
    };
  }

  return {
    chatbot: {
      enabled: Boolean(raw.chatbot?.enabled),
      maxRequests: Math.max(1, Number(raw.chatbot?.maxRequests) || DEFAULT_RATE_LIMIT.chatbot.maxRequests),
      windowMinutes: Math.max(1, Number(raw.chatbot?.windowMinutes) || DEFAULT_RATE_LIMIT.chatbot.windowMinutes)
    },
    email: {
      enabled: Boolean(raw.email?.enabled),
      maxRequests: Math.max(1, Number(raw.email?.maxRequests) || DEFAULT_RATE_LIMIT.email.maxRequests),
      windowMinutes: Math.max(1, Number(raw.email?.windowMinutes) || DEFAULT_RATE_LIMIT.email.windowMinutes)
    }
  };
};

const hexToRgb = (hex) => {
  if (!hex || typeof hex !== 'string') return null;
  const normalized = hex.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{3,8}$/.test(normalized)) return null;
  const full = normalized.length === 3
    ? normalized.split('').map((c) => `${c}${c}`).join('')
    : normalized.slice(0, 6);
  const int = Number.parseInt(full, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
};

const getMediaSelectTheme = (titleColor, isDarkBase) => {
  const rgb = hexToRgb(titleColor);
  const luminance = rgb
    ? ((0.299 * rgb.r) + (0.587 * rgb.g) + (0.114 * rgb.b)) / 255
    : (isDarkBase ? 0.2 : 0.8);

  const preferDarkSurface = luminance > 0.62;

  return {
    bg: preferDarkSurface ? 'rgba(17, 20, 27, 0.94)' : 'rgba(255, 255, 255, 0.94)',
    fg: preferDarkSurface ? 'rgba(248, 250, 252, 0.98)' : 'rgba(17, 24, 39, 0.95)',
    border: preferDarkSurface ? 'rgba(255,255,255,0.24)' : 'rgba(17,24,39,0.2)',
  };
};

const getStyles = (activePalette, isDarkBase, glassBg, glassBorder, bgImageToUse) => ({
  center: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: activePalette.bgColor },
  adminBody: {
    backgroundColor: activePalette.bgColor, backgroundImage: bgImageToUse,
    backgroundSize: 'cover', backgroundAttachment: 'fixed', color: activePalette.fontColor, fontFamily: activePalette.fontFamily || 'system-ui, -apple-system, sans-serif', minHeight: '100vh', padding: '40px 20px', transition: 'all 0.4s ease'
  },
  toast: { position: 'fixed', top: '30px', left: '50%', padding: '16px 32px', borderRadius: '100px', zIndex: 10000, boxShadow: '0 12px 36px rgba(0,0,0,0.2)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)', border: `1px solid ${glassBorder}`, display: 'flex', alignItems: 'center', gap: '12px', fontWeight: '600', fontSize: '14px', letterSpacing: '0.5px' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: isDarkBase ? 'rgba(15,15,20,0.85)' : 'rgba(240,240,244,0.56)', backdropFilter: 'blur(var(--glass-blur-subtle))', WebkitBackdropFilter: 'blur(var(--glass-blur-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, opacity: 1, animation: 'fadeIn 0.3s ease' },
  modalContent: { backgroundColor: isDarkBase ? 'rgba(24,24,28,0.9)' : 'rgba(255,255,255,0.88)', padding: '40px', borderRadius: '28px', border: `1px solid ${glassBorder}`, maxWidth: '420px', width: '90%', textAlign: 'center', boxShadow: '0 32px 64px -12px rgba(0,0,0,0.3)', color: activePalette.fontColor, backdropFilter: 'blur(20px)', textShadow: isDarkBase ? '0 1px 3px rgba(0,0,0,0.35)' : 'none' },
  modalText: { fontSize: '16px', fontWeight: '500', marginBottom: '30px', lineHeight: '1.6' },
  modalActions: { display: 'flex', gap: '16px', justifyContent: 'center' },
  modalBtnConfirm: { backgroundColor: 'var(--semantic-error)', color: '#fff', border: 'none', borderRadius: '100px', padding: '14px 28px', fontWeight: '700', cursor: 'pointer', flex: 1, transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(211, 47, 47, 0.3)' },
  modalBtnCancel: { backgroundColor: isDarkBase ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', color: activePalette.fontColor, border: `1px solid ${glassBorder}`, borderRadius: '100px', padding: '14px 28px', fontWeight: '700', cursor: 'pointer', flex: 1, transition: 'all 0.2s' },
  adminContainer: { maxWidth: '1000px', margin: '0 auto', backgroundColor: glassBg, backdropFilter: 'blur(24px) saturate(150%)', WebkitBackdropFilter: 'blur(24px) saturate(150%)', borderRadius: '32px', border: `1px solid ${glassBorder}`, padding: '40px', boxShadow: '0 24px 48px rgba(0,0,0,0.1)' },
  adminHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', borderBottom: `1px solid ${glassBorder}`, paddingBottom: '24px', flexWrap: 'wrap', gap: '15px' },
  adminTitle: { fontSize: '20px', fontWeight: '700', color: activePalette.titleColor, letterSpacing: '-0.5px' },
  plusButton: { backgroundColor: activePalette.titleColor, color: isDarkBase ? '#000' : '#fff', border: 'none', borderRadius: '100px', padding: '12px 24px', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', transition: 'all 0.2s', boxShadow: `0 8px 24px ${activePalette.titleColor}40` },
  headerBtn: { backgroundColor: isDarkBase ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', color: activePalette.fontColor, border: `1px solid ${glassBorder}`, borderRadius: '100px', padding: '10px 20px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', transition: 'all 0.2s' },
  settingsBtn: { backgroundColor: 'transparent', color: activePalette.fontColor, border: `1px solid ${glassBorder}`, borderRadius: '100px', padding: '10px 20px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' },
  backButton: { background: isDarkBase ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', border: `1px solid ${glassBorder}`, borderRadius: '100px', padding: '10px 20px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', marginBottom: '30px', display: 'inline-flex', alignItems: 'center', gap: '10px', color: activePalette.fontColor, transition: 'all 0.2s' },
  form: { display: 'flex', flexDirection: 'column', gap: '24px' },
  settingsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', background: isDarkBase ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)', padding: '24px', border: `1px solid ${glassBorder}`, borderRadius: '24px' },
  label: { display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px', fontWeight: '600', color: activePalette.fontColor },
  colorInput: { height: '44px', width: '100%', cursor: 'pointer', border: 'none', borderRadius: '12px', background: 'transparent' },
  textInput: { padding: '16px', border: `1px solid ${glassBorder}`, backgroundColor: isDarkBase ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)', color: activePalette.fontColor, fontSize: '14px', borderRadius: '16px', transition: 'border 0.2s, box-shadow 0.2s', backdropFilter: 'blur(8px)' },
  adminInput: { border: 'none', borderBottom: `2px solid ${activePalette.titleColor}`, backgroundColor: 'transparent', color: activePalette.titleColor, padding: '15px 0', fontSize: '28px', fontWeight: '800', marginBottom: '10px' },
  editorContainer: { border: `1px solid ${glassBorder}`, backgroundColor: isDarkBase ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)', borderRadius: '24px', overflow: 'hidden', display: 'flex', flexDirection: 'column', backdropFilter: 'blur(12px)' },
  toolbar: { display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '16px', borderBottom: `1px solid ${glassBorder}`, backgroundColor: isDarkBase ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' },
  toolbarBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--tb-idle-bg)', color: activePalette.fontColor, border: '1px solid rgba(128,128,128,0.15)', padding: '7px', cursor: 'pointer', borderRadius: '8px', width: '36px', height: '36px', transition: 'all 0.15s ease', boxShadow: '0 1px 2px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.08)' },
  toolbarDivider: { width: '1px', backgroundColor: glassBorder, margin: '0 8px' },
  tiptapWrapper: { position: 'relative', backgroundColor: 'transparent', color: activePalette.fontColor, cursor: 'text' },
  statusBar: { padding: '12px 20px', borderTop: `1px solid ${glassBorder}`, fontSize: '13px', color: activePalette.fontColor, opacity: 0.6, textAlign: 'right', background: isDarkBase ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)' },
  adminButton: { backgroundColor: activePalette.titleColor, color: isDarkBase ? '#000' : '#fff', border: 'none', borderRadius: '16px', padding: '18px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', letterSpacing: '0.5px', marginTop: '20px', transition: 'all 0.2s', boxShadow: `0 8px 24px ${activePalette.titleColor}40` },
  list: { display: 'flex', flexDirection: 'column', gap: '16px' },
  postCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 28px', border: `1px solid ${glassBorder}`, backgroundColor: isDarkBase ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.6)', borderRadius: '24px', transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)', backdropFilter: 'blur(12px)' },
  cardDate: { fontSize: '12px', color: activePalette.fontColor, opacity: 0.7, marginBottom: '8px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' },
  pinnedBadge: { backgroundColor: activePalette.titleColor, color: isDarkBase ? '#000' : '#fff', padding: '4px 10px', borderRadius: '100px', fontSize: '10px', fontWeight: '800', letterSpacing: '0.5px' },
  cardTitle: { fontSize: '18px', fontWeight: '700', color: activePalette.fontColor },
  actions: { display: 'flex', gap: '10px' },
  actionBtnPin: { background: isDarkBase ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', border: `1px solid ${glassBorder}`, padding: '10px', cursor: 'pointer', color: activePalette.fontColor, borderRadius: '12px', transition: 'all 0.2s' },
  actionBtnEdit: { background: isDarkBase ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', border: `1px solid ${glassBorder}`, padding: '10px', cursor: 'pointer', color: activePalette.fontColor, borderRadius: '12px', transition: 'all 0.2s' },
  actionBtnDelete: { background: 'var(--semantic-error-soft)', border: '1px solid var(--semantic-error-border)', padding: '10px', cursor: 'pointer', color: 'var(--semantic-error)', borderRadius: '12px', transition: 'all 0.2s' },
  versionFooterAdmin: { marginTop: '40px', textAlign: 'center', fontSize: '13px', color: activePalette.fontColor, opacity: 0.5, fontWeight: '600', letterSpacing: '1px' }
});

const App = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [isFinancialOpen, setIsFinancialOpen] = useState(false);

  const [editingPost, setEditingPost] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshingGlobal, setIsRefreshingGlobal] = useState(false); // NOVO ESTADO

  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const [toastTop, setToastTop] = useState(30);
  const lastPointerYRef = useRef(null);
  const [modal, setModal] = useState({ show: false, id: null });
  const [draggedIndex, setDraggedIndex] = useState(null);

  // Scroll-to-top/bottom state
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [rotation, setRotation] = useState({ enabled: false, interval: 60, last_rotated_at: 0 });
  const [rateLimit, setRateLimit] = useState(DEFAULT_RATE_LIMIT);
  const [rateLimitBaseline, setRateLimitBaseline] = useState(DEFAULT_RATE_LIMIT);
  const [disclaimers, setDisclaimers] = useState({ enabled: true, items: [] });

  const [userTheme, setUserTheme] = useState(localStorage.getItem('adminThemePref') || 'auto');
  const [systemIsDark, setSystemIsDark] = useState(window.matchMedia('(prefers-color-scheme: dark)').matches);

  const fileInputBgRef = useRef(null);
  const [uploadTarget, setUploadTarget] = useState(null);
  const [isUploadingBg, setIsUploadingBg] = useState(false);

  const secret = import.meta.env.VITE_API_SECRET;

  const hasUnsavedRateLimit = useMemo(() => {
    const normalize = (cfg) => ({
      chatbot: {
        enabled: Boolean(cfg?.chatbot?.enabled),
        maxRequests: Number(cfg?.chatbot?.maxRequests) || 0,
        windowMinutes: Number(cfg?.chatbot?.windowMinutes) || 0,
      },
      email: {
        enabled: Boolean(cfg?.email?.enabled),
        maxRequests: Number(cfg?.email?.maxRequests) || 0,
        windowMinutes: Number(cfg?.email?.windowMinutes) || 0,
      }
    });

    return JSON.stringify(normalize(rateLimit)) !== JSON.stringify(normalize(rateLimitBaseline));
  }, [rateLimit, rateLimitBaseline]);

  const showNotification = useCallback((message, type = 'info') => {
    const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;
    const pointerY = lastPointerYRef.current;
    const baseY = pointerY != null ? pointerY : (viewportH * 0.5);
    const nextTop = Math.max(16, Math.min(baseY - 36, Math.max(16, viewportH - 90)));
    setToastTop(nextTop);
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
  }, []);

  useEffect(() => {
    const trackPointer = (e) => {
      if (typeof e?.clientY === 'number') lastPointerYRef.current = e.clientY;
    };
    window.addEventListener('pointerdown', trackPointer, { passive: true });
    return () => window.removeEventListener('pointerdown', trackPointer);
  }, []);

  // Scroll tracking para botões ir ao topo / ir ao final
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset;
      const docH = document.documentElement.scrollHeight;
      const winH = window.innerHeight;
      setShowBackToTop(scrollY > 300);
      setShowScrollToBottom(scrollY + winH < docH - 200);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  const scrollToBottom = () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => setSystemIsDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const fetchData = useCallback(async () => {
    setIsRefreshingGlobal(true);
    try {
      const resPosts = await fetch(`${API_URL}/posts`);
      if (resPosts.ok) setPosts(await resPosts.json());

      const resSettings = await fetch(`${API_URL}/settings`);
      const dataSettings = await resSettings.json();
      if (!dataSettings.error) {
        if (dataSettings.light) setSettings(dataSettings);
        else setSettings({
          ...DEFAULT_SETTINGS,
          dark: { bgColor: dataSettings.bgColor || '#131314', bgImage: dataSettings.bgImage || '', fontColor: dataSettings.fontColor || '#e3e3e3', titleColor: dataSettings.titleColor || '#8ab4f8' },
          shared: { fontSize: dataSettings.fontSize || '1rem', titleFontSize: dataSettings.titleFontSize || '1.5rem', fontFamily: dataSettings.fontFamily || DEFAULT_SETTINGS.shared.fontFamily }
        });
      }

      const resRotation = await fetch(`${API_URL}/settings/rotation`);
      if (resRotation.ok) setRotation(await resRotation.json());

      const resRateLimit = await fetch(`${API_URL}/settings/ratelimit`, { headers: { 'Authorization': `Bearer ${secret}` } });
      if (resRateLimit.ok) {
        const rawRateLimit = await resRateLimit.json();
        const normalizedRateLimit = normalizeRateLimitConfig(rawRateLimit);
        setRateLimit(normalizedRateLimit);
        setRateLimitBaseline(normalizedRateLimit);
      }

      const resDisclaimers = await fetch(`${API_URL}/settings/disclaimers`);
      if (resDisclaimers.ok) setDisclaimers(await resDisclaimers.json());

    } catch { showNotification("Erro na sincronização.", "error"); } finally { setLoading(false); setIsRefreshingGlobal(false); }
  }, [showNotification, secret]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!hasUnsavedRateLimit) return;
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedRateLimit]);

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
    localStorage.setItem('adminThemePref', next);
  };

  const triggerBgUpload = (targetTheme) => { setUploadTarget(targetTheme); if (fileInputBgRef.current) fileInputBgRef.current.click(); };

  const handleBgImageUpload = async (event) => {
    const file = event.target.files[0]; if (!file || !uploadTarget) return;
    setIsUploadingBg(true); showNotification(`Enviando fundo para R2 (${uploadTarget})...`, "info");
    const formData = new FormData(); formData.append('file', file);
    try {
      const res = await fetch(`${API_URL}/upload`, { method: 'POST', headers: { 'Authorization': `Bearer ${secret}` }, body: formData });
      if (!res.ok) throw new Error("Falha na consolidação.");
      const data = await res.json();
      setSettings(prev => ({ ...prev, [uploadTarget]: { ...prev[uploadTarget], bgImage: data.url } }));
      showNotification("Upload de fundo concluído.", "success");
    } catch (err) { showNotification(err.message, "error"); } finally { setIsUploadingBg(false); setUploadTarget(null); if (fileInputBgRef.current) fileInputBgRef.current.value = ''; }
  };

  const handleSavePost = async ({ id, title, content }) => {
    setIsSaving(true);
    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/posts/${id}` : `${API_URL}/posts`;
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${secret}` }, body: JSON.stringify({ title, content }) });
      if (res.ok) { showNotification("Fragmento consolidado.", "success"); setIsEditorOpen(false); await fetchData(); }
      else throw new Error("Falha na autorização.");
    } catch (err) { showNotification(err.message, "error"); } finally { setIsSaving(false); }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault(); setIsSaving(true);
    try {
      const resApp = await fetch(`${API_URL}/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${secret}` }, body: JSON.stringify(settings) });
      const resRot = await fetch(`${API_URL}/settings/rotation`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${secret}` }, body: JSON.stringify(rotation) });
      const resRL = await fetch(`${API_URL}/settings/ratelimit`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${secret}` }, body: JSON.stringify(rateLimit) });
      const resDisc = await fetch(`${API_URL}/settings/disclaimers`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${secret}` }, body: JSON.stringify(disclaimers) });
      if (resApp.ok && resRot.ok && resRL.ok && resDisc.ok) {
        setRateLimitBaseline(normalizeRateLimitConfig(rateLimit));
        showNotification("Configurações salvas.", "success");
      } else throw new Error();
    } catch { showNotification("Erro ao salvar configs.", "error"); } finally { setIsSaving(false); }
  };

  const confirmDelete = async () => {
    const id = modal.id; setModal({ show: false, id: null });
    try {
      const res = await fetch(`${API_URL}/posts/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${secret}` } });
      if (res.ok) { showNotification("Removido.", "success"); await fetchData(); }
    } catch { showNotification("Falha.", "error"); }
  };

  const handlePin = async (id) => {
    try {
      const res = await fetch(`${API_URL}/posts/${id}/pin`, { method: 'PUT', headers: { 'Authorization': `Bearer ${secret}` } });
      if (res.ok) { showNotification("Status alterado.", "success"); await fetchData(); }
    } catch { showNotification("Erro.", "error"); }
  };

  const handleDragStart = (e, index) => { setDraggedIndex(index); e.dataTransfer.effectAllowed = "move"; e.target.style.opacity = '0.5'; };
  const handleDragEnd = (e) => { e.target.style.opacity = '1'; setDraggedIndex(null); };
  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault(); if (draggedIndex === null || draggedIndex === dropIndex) return;
    const newOrder = [...posts]; const draggedItem = newOrder[draggedIndex];
    newOrder.splice(draggedIndex, 1); newOrder.splice(dropIndex, 0, draggedItem);
    setPosts(newOrder);
    try {
      const payload = newOrder.map((post, idx) => ({ id: post.id, display_order: idx }));
      const res = await fetch(`${API_URL}/posts/reorder`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${secret}` }, body: JSON.stringify(payload) });
      if (res.ok) showNotification("Ordem sincronizada.", "success"); else throw new Error();
    } catch { showNotification("Erro de ordem.", "error"); await fetchData(); }
  };

  const openEditor = (post = null) => {
    setIsSettingsOpen(false);
    setIsAnalyticsOpen(false);
    setIsFinancialOpen(false);
    setEditingPost(post);
    setIsEditorOpen(true);
  };

  const isDarkBase = activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1');
  const glassBg = isDarkBase ? 'rgba(30, 30, 32, 0.7)' : 'rgba(255, 255, 255, 0.75)';
  const glassBorder = isDarkBase ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
  const mediaSelectTheme = useMemo(
    () => getMediaSelectTheme(activePalette.titleColor, isDarkBase),
    [activePalette.titleColor, isDarkBase]
  );

  const defaultCSSPattern = isDarkBase
    ? `radial-gradient(circle at 15% 40%, rgba(138, 180, 248, 0.15), transparent 45%), radial-gradient(circle at 85% 60%, rgba(197, 138, 248, 0.15), transparent 45%)`
    : `radial-gradient(circle at 15% 40%, rgba(26, 115, 232, 0.08), transparent 45%), radial-gradient(circle at 85% 60%, rgba(161, 66, 244, 0.08), transparent 45%)`;

  const bgImageToUse = (activePalette.bgImage && activePalette.bgImage.trim() !== '')
    ? (isDarkBase ? `url("${activePalette.bgImage}")` : `linear-gradient(rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.85)), url("${activePalette.bgImage}")`)
    : defaultCSSPattern;

  const styles = useMemo(() =>
    getStyles(activePalette, isDarkBase, glassBg, glassBorder, bgImageToUse),
    [activePalette, isDarkBase, glassBg, glassBorder, bgImageToUse]);

  if (loading) return <div role="status" aria-label="Carregando" style={styles.center}><Loader2 className="animate-spin" color={activePalette.fontColor} size={32} /><span className="sr-only">Carregando painel administrativo…</span></div>;

  return (
    <div style={styles.adminBody}>
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes mediaSelectIn {
          from { opacity: 0; transform: translateY(-2px) scale(0.92); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        /* Toolbar 3D button custom properties */
        :root { --tb-idle-bg: ${isDarkBase ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'}; --tb-active-bg: ${isDarkBase ? 'rgba(192,132,252,0.18)' : 'rgba(170,59,255,0.12)'}; --tb-active-fg: ${activePalette.titleColor}; }
        .animate-spin { animation: spin 1s linear infinite; }
        .ProseMirror { min-height: 400px; padding: 30px; outline: none; line-height: 1.6; font-size: 16px; }
        .ProseMirror p.is-editor-empty:first-child::before { content: attr(data-placeholder); float: left; color: ${isDarkBase ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}; pointer-events: none; height: 0; }
        .ProseMirror .resizable-media { position: relative; margin: 18px auto 6px; max-width: 100%; border-radius: 14px; }
        .ProseMirror .resizable-media img { display: block; width: 100%; height: auto; border-radius: 14px; cursor: pointer; box-shadow: 0 8px 28px rgba(0,0,0,0.12); }
        .ProseMirror .resizable-media .media-resize-handle {
          position: absolute;
          right: -10px;
          bottom: -10px;
          width: 20px;
          height: 20px;
          border-radius: 999px;
          border: 2px solid ${isDarkBase ? '#0b0b0c' : '#ffffff'};
          background: ${activePalette.titleColor};
          box-shadow: 0 8px 20px rgba(0,0,0,0.22);
          cursor: nwse-resize;
          opacity: 0;
          transition: opacity 0.18s ease, transform 0.18s ease, background 0.18s ease, border-color 0.18s ease;
          z-index: 5;
        }
        .ProseMirror .resizable-media.media-image.tone-light .media-resize-handle {
          background: rgba(12, 16, 24, 0.94);
          border-color: rgba(255, 255, 255, 0.32);
        }
        .ProseMirror .resizable-media.media-image.tone-dark .media-resize-handle {
          background: rgba(255, 255, 255, 0.94);
          border-color: rgba(17, 24, 39, 0.28);
        }
        .ProseMirror .resizable-media:hover .media-resize-handle,
        .ProseMirror .resizable-media.is-selected .media-resize-handle { opacity: 1; }
        .ProseMirror .resizable-media .media-resize-handle:hover { transform: scale(1.08); }
        .ProseMirror .resizable-media .media-snap-bar {
          position: absolute; top: -42px; left: 50%; transform: translateX(-50%);
          display: flex; gap: 2px; align-items: center;
          background: ${isDarkBase ? 'rgba(18,18,22,0.96)' : 'rgba(255,255,255,0.96)'};
          border-radius: 100px; padding: 4px 8px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.22); border: 1px solid ${glassBorder};
          opacity: 0; pointer-events: none;
          transition: opacity 0.18s ease, background 0.18s ease, border-color 0.18s ease; z-index: 10; white-space: nowrap;
        }
        .ProseMirror .resizable-media.media-image.tone-light .media-snap-bar {
          background: rgba(12, 16, 24, 0.94);
          border-color: rgba(255, 255, 255, 0.2);
        }
        .ProseMirror .resizable-media.media-image.tone-dark .media-snap-bar {
          background: rgba(255, 255, 255, 0.94);
          border-color: rgba(17, 24, 39, 0.18);
        }
        .ProseMirror .resizable-media.is-selected .media-snap-bar { opacity: 1; pointer-events: auto; }
        .ProseMirror .resizable-media .media-snap-bar button {
          background: transparent; border: none; cursor: pointer;
          padding: 3px 9px; border-radius: 100px; font-size: 11px; font-weight: 700;
          color: ${isDarkBase ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.65)'};
          transition: background 0.14s, color 0.14s; line-height: 1.4;
        }
        .ProseMirror .resizable-media.media-image.tone-light .media-snap-bar button {
          color: rgba(248, 250, 252, 0.76);
        }
        .ProseMirror .resizable-media.media-image.tone-dark .media-snap-bar button {
          color: rgba(17, 24, 39, 0.68);
        }
        .ProseMirror .resizable-media .media-snap-bar button:hover {
          background: ${activePalette.titleColor}28; color: ${activePalette.titleColor};
        }
        .ProseMirror .resizable-media .media-select-btn {
          position: absolute;
          top: 8px;
          right: 8px;
          border: 1px solid ${mediaSelectTheme.border};
          background: ${mediaSelectTheme.bg};
          color: ${mediaSelectTheme.fg};
          border-radius: 14px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.2px;
          padding: 6px 10px;
          min-width: 72px;
          min-height: 44px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          line-height: 1;
          cursor: pointer;
          opacity: 0;
          pointer-events: none;
          transform: translateY(-2px) scale(0.92);
          transition: opacity 0.16s ease, transform 0.16s ease, box-shadow 0.16s ease;
          z-index: 9;
        }
        .ProseMirror .resizable-media .media-select-btn .media-select-btn-icon { opacity: 0.95; }
        .ProseMirror .resizable-media .media-select-btn .media-select-btn-label { font-size: 9px; letter-spacing: 0.3px; text-transform: uppercase; }
        .ProseMirror .resizable-media.media-image.tone-light .media-select-btn {
          background: rgba(12, 16, 24, 0.92);
          color: rgba(248, 250, 252, 0.98);
          border-color: rgba(255, 255, 255, 0.28);
        }
        .ProseMirror .resizable-media.media-image.tone-dark .media-select-btn {
          background: rgba(255, 255, 255, 0.94);
          color: rgba(17, 24, 39, 0.95);
          border-color: rgba(17, 24, 39, 0.2);
        }
        .ProseMirror .resizable-media.media-image.tone-neutral .media-select-btn {
          background: ${mediaSelectTheme.bg};
          color: ${mediaSelectTheme.fg};
          border-color: ${mediaSelectTheme.border};
        }
        .ProseMirror .resizable-media:hover .media-select-btn,
        .ProseMirror .resizable-media.is-selected .media-select-btn {
          opacity: 1;
          transform: translateY(0) scale(1);
          animation: mediaSelectIn 0.18s ease;
          pointer-events: auto;
        }
        .ProseMirror .resizable-media .media-select-btn:hover,
        .ProseMirror .resizable-media .media-select-btn:focus-visible {
          box-shadow: 0 6px 18px rgba(0,0,0,0.18);
          border-color: ${activePalette.titleColor};
          color: ${activePalette.titleColor};
          outline: none;
        }
        @media (max-width: 768px) {
          .ProseMirror .resizable-media .media-select-btn {
            top: 6px;
            right: 6px;
            min-width: 54px;
            min-height: 34px;
            padding: 4px 6px;
            gap: 1px;
          }
          .ProseMirror .resizable-media .media-select-btn .media-select-btn-icon {
            width: 11px;
            height: 11px;
          }
          .ProseMirror .resizable-media .media-select-btn .media-select-btn-label {
            font-size: 8px;
            letter-spacing: 0.2px;
          }
        }
        .ProseMirror .resizable-media.media-youtube { width: fit-content; }
        .ProseMirror .resizable-media.media-youtube > div[data-youtube-video] { border-radius: 14px; overflow: hidden; box-shadow: 0 8px 28px rgba(0,0,0,0.12); }
        .ProseMirror .resizable-media.media-youtube iframe { display: block; width: 100%; max-width: 100%; border: 0; cursor: pointer; }
        .ProseMirror .resizable-media.is-selected,
        .ProseMirror .resizable-media.ProseMirror-selectednode,
        .ProseMirror img.ProseMirror-selectednode,
        .ProseMirror [data-youtube-video].ProseMirror-selectednode { outline: 2px solid ${activePalette.titleColor}; outline-offset: 3px; }
        .ProseMirror p[style*="text-align: center"] { text-indent: 0; margin: 2px 0 18px 0; opacity: 0.86; }
        .ProseMirror p[style*="text-align: center"] em { font-size: 0.92em; }
        .ProseMirror table { border-collapse: collapse; table-layout: fixed; width: 100%; margin: 0; overflow: hidden; }
        .ProseMirror table td, .ProseMirror table th { min-width: 1em; border: 1px solid ${glassBorder}; padding: 8px; vertical-align: top; box-sizing: border-box; position: relative; }
        .ProseMirror table th { font-weight: bold; text-align: left; background-color: ${isDarkBase ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'}; }
        ul[data-type="taskList"] { list-style: none; padding: 0; }
        ul[data-type="taskList"] li { display: flex; align-items: center; }
        ul[data-type="taskList"] li label { margin-right: 8px; }

        /* TipTap BubbleMenu — contextual formatting toolbar on text selection */
        .bubble-menu {
          display: flex; align-items: center; gap: 2px;
          background: ${isDarkBase ? 'rgba(18,18,22,0.96)' : 'rgba(255,255,255,0.96)'};
          backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
          border: 1px solid ${glassBorder};
          border-radius: 14px; padding: 4px 6px;
          box-shadow: 0 8px 28px rgba(0,0,0,0.18);
          animation: fadeIn 0.15s ease-out;
        }
        .bubble-menu button {
          background: ${isDarkBase ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'}; border: 1px solid rgba(128,128,128,0.15); cursor: pointer;
          padding: 5px 7px; border-radius: 7px;
          color: ${activePalette.fontColor}; display: flex; align-items: center; justify-content: center;
          transition: all 0.15s ease;
          box-shadow: 0 1px 2px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.08);
        }
        .bubble-menu button:hover { background: ${isDarkBase ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}; box-shadow: 0 2px 4px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1); }
        .bubble-menu button:active { box-shadow: inset 1px 1px 3px rgba(0,0,0,0.28); transform: translateY(0.5px); }
        .bubble-menu button.is-active {
          background: ${isDarkBase ? 'rgba(192,132,252,0.18)' : 'rgba(170,59,255,0.12)'};
          color: ${activePalette.titleColor};
          border-color: rgba(128,128,128,0.35);
          box-shadow: inset 1px 1px 3px rgba(0,0,0,0.28), inset -1px -1px 1px rgba(255,255,255,0.06);
          transform: translateY(0.5px);
        }
        .bubble-divider {
          width: 1px; height: 20px;
          background: ${glassBorder};
          margin: 0 2px;
        }

        /* TipTap FloatingMenu — quick-insert toolbar on empty lines */
        .floating-menu {
          display: flex; align-items: center; gap: 2px;
          background: ${isDarkBase ? 'rgba(18,18,22,0.96)' : 'rgba(255,255,255,0.96)'};
          backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
          border: 1px solid ${glassBorder};
          border-radius: 14px; padding: 4px 6px;
          box-shadow: 0 8px 28px rgba(0,0,0,0.18);
          animation: fadeIn 0.15s ease-out;
        }
        .floating-menu button {
          background: ${isDarkBase ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'}; border: 1px solid rgba(128,128,128,0.15); cursor: pointer;
          padding: 5px 7px; border-radius: 7px;
          color: ${activePalette.fontColor}; opacity: 0.7;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s ease;
          box-shadow: 0 1px 2px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.08);
        }
        .floating-menu button:hover { opacity: 1; background: ${isDarkBase ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}; box-shadow: 0 2px 4px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1); }
        .floating-menu button:active { box-shadow: inset 1px 1px 3px rgba(0,0,0,0.28); transform: translateY(0.5px); }
        .floating-menu button.is-active {
          opacity: 1;
          background: ${isDarkBase ? 'rgba(192,132,252,0.18)' : 'rgba(170,59,255,0.12)'};
          color: ${activePalette.titleColor};
          border-color: rgba(128,128,128,0.35);
          box-shadow: inset 1px 1px 3px rgba(0,0,0,0.28), inset -1px -1px 1px rgba(255,255,255,0.06);
          transform: translateY(0.5px);
        }
        .floating-divider {
          width: 1px; height: 20px;
          background: ${glassBorder};
          margin: 0 2px;
        }

        /* TipTap Focus — visual feedback on currently focused node */
        .ProseMirror .has-focus {
          border-radius: 4px;
          box-shadow: inset 0 0 0 2px ${isDarkBase ? 'rgba(192,132,252,0.15)' : 'rgba(170,59,255,0.08)'};
        }

        .log-card { padding: 24px; border-radius: 20px; border: 1px solid ${glassBorder}; background: ${isDarkBase ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)'}; backdrop-filter: blur(8px); transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        .log-card:hover { transform: translateY(-3px); box-shadow: 0 16px 32px rgba(0,0,0,0.08); }
        button:hover { opacity: 0.9; }
      `}</style>

      <div role="alert" aria-live="assertive" aria-atomic="true" style={{ ...styles.toast, top: `${toastTop}px`, transform: toast.show ? 'translate(-50%, 0)' : 'translate(-50%, -28px)', opacity: toast.show ? 1 : 0, backgroundColor: toast.type === 'error' ? 'var(--semantic-error)' : (isDarkBase ? 'rgba(30,30,30,0.9)' : 'rgba(255,255,255,0.9)'), color: toast.type === 'error' ? '#fff' : activePalette.fontColor }}>
        {toast.type === 'error' ? <AlertCircle size={20} /> : <Check size={20} />} <span>{toast.message}</span>
      </div>

      {modal.show && (
        <div role="dialog" aria-modal="true" aria-labelledby="delete-modal-title" style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <AlertCircle size={56} color="var(--semantic-error)" style={{ marginBottom: '24px' }} aria-hidden="true" />
            <p id="delete-modal-title" style={styles.modalText}>Deseja apagar permanentemente este registro?</p>
            <div style={styles.modalActions}>
              <button onClick={() => setModal({ show: false, id: null })} style={styles.modalBtnCancel}>CANCELAR</button>
              <button onClick={confirmDelete} style={styles.modalBtnConfirm}>EXCLUIR</button>
            </div>
          </div>
        </div>
      )}

      <input id="bg-image-upload" name="bgImageUpload" type="file" accept="image/*" ref={fileInputBgRef} onChange={handleBgImageUpload} style={{ display: 'none' }} />

      <div style={styles.adminContainer}>
        <header style={styles.adminHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Database size={28} color={activePalette.titleColor} />
            <h1 style={styles.adminTitle}>{APP_VERSION.replace('APP', 'ADMIN')}</h1>
            {!isSettingsOpen && !isAnalyticsOpen && !isFinancialOpen && (
              <button onClick={() => openEditor()} style={styles.plusButton}><PlusCircle size={18} /> NOVO</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button onClick={cycleTheme} style={styles.headerBtn} title="Alternar Tema" aria-label={`Alternar tema: modo ${userTheme} ativo`}>
              {userTheme === 'auto' ? <Settings size={16} aria-hidden="true" /> : userTheme === 'dark' ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
            </button>
            <button onClick={() => { setIsAnalyticsOpen(false); setIsSettingsOpen(false); setIsFinancialOpen(false); fetchData(); }} style={styles.headerBtn} title="Sincronizar Banco" aria-label="Sincronizar dados">
              <RefreshCw size={16} className={isRefreshingGlobal ? "animate-spin" : ""} aria-hidden="true" />
            </button>

            <button onClick={() => { setIsAnalyticsOpen(true); setIsSettingsOpen(false); setIsFinancialOpen(false); setIsEditorOpen(false); }} style={styles.headerBtn}><BarChart2 size={16} /> Auditoria</button>
            <button onClick={() => { setIsFinancialOpen(true); setIsAnalyticsOpen(false); setIsSettingsOpen(false); setIsEditorOpen(false); }} style={styles.headerBtn}><DollarSign size={16} /> Financeiro</button>
            <button onClick={() => { setIsSettingsOpen(true); setIsAnalyticsOpen(false); setIsFinancialOpen(false); setIsEditorOpen(false); }} style={styles.headerBtn}><Settings size={16} /> Sistema</button>
          </div>
        </header>

        <Suspense fallback={<div style={{ padding: '50px', display: 'flex', justifyContent: 'center' }}><Loader2 className="animate-spin" color={activePalette.fontColor} size={32} /></div>}>
          {isAnalyticsOpen ? (
            <AnalyticsPanel onClose={() => { setIsAnalyticsOpen(false); fetchData(); }} secret={secret} API_URL={API_URL} styles={styles} />
          ) : isFinancialOpen ? (
            <FinancialPanel onClose={() => { setIsFinancialOpen(false); fetchData(); }} secret={secret} API_URL={API_URL} styles={styles} activePalette={activePalette} isDarkBase={isDarkBase} />
          ) : isSettingsOpen ? (
            <SettingsPanel settings={settings} setSettings={setSettings} rateLimit={rateLimit} setRateLimit={setRateLimit} hasUnsavedRateLimit={hasUnsavedRateLimit} rotation={rotation} setRotation={setRotation} disclaimers={disclaimers} setDisclaimers={setDisclaimers} isSaving={isSaving} onSave={handleSaveSettings} onClose={() => { setIsSettingsOpen(false); fetchData(); }} triggerBgUpload={triggerBgUpload} isUploadingBg={isUploadingBg} uploadTarget={uploadTarget} styles={styles} />
          ) : (
            <PostList
              posts={posts}
              onPin={handlePin}
              onEdit={openEditor}
              onDelete={(id) => setModal({ show: true, id })}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              styles={styles}
            />
          )}
        </Suspense>
        <footer style={styles.versionFooterAdmin}>{APP_VERSION}</footer>
      </div>

      {/* Floating scroll-to-top/bottom buttons */}
      <div style={{ position: 'fixed', right: '30px', bottom: '30px', display: 'flex', flexDirection: 'column', gap: '12px', zIndex: 9999 }}>
        {showBackToTop && (
          <button onClick={scrollToTop} title="Voltar ao Topo" aria-label="Voltar ao topo" style={{ width: '52px', height: '52px', borderRadius: '100px', border: `1px solid ${glassBorder}`, background: glassBg, color: activePalette.fontColor, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <ArrowUp size={22} />
          </button>
        )}
        {showScrollToBottom && (
          <button onClick={scrollToBottom} title="Ir para o Final" aria-label="Ir para o final" style={{ width: '52px', height: '52px', borderRadius: '100px', border: `1px solid ${glassBorder}`, background: glassBg, color: activePalette.fontColor, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <ArrowDown size={22} />
          </button>
        )}
      </div>

      <PopupPortal isOpen={isEditorOpen} onClose={() => { setIsEditorOpen(false); setEditingPost(null); fetchData(); }} title={editingPost ? `Editando: ${editingPost.title}` : 'Novo Fragmento'}>
        <Suspense fallback={<div style={{ padding: '50px', display: 'flex', justifyContent: 'center' }}><Loader2 className="animate-spin" size={32} /></div>}>
          <EditorPanel key={editingPost ? editingPost.id : 'new'} post={editingPost} isSaving={isSaving} onSave={handleSavePost} onCancel={() => { setIsEditorOpen(false); setEditingPost(null); fetchData(); }} secret={secret} showNotification={showNotification} styles={styles} API_URL={API_URL} />
        </Suspense>
      </PopupPortal>
    </div>
  );
};

export default App;