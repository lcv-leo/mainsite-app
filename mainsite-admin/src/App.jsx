// Módulo: mainsite-admin/src/App.jsx
// Versão: v3.31.0
// Descrição: Refatoração visual completa para Glassmorphism/MD3. Lógica de estilos centralizada e modal de exclusão genérico.

import React, { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import { 
  Database, PlusCircle, Check, AlertCircle, Settings, RefreshCw, Loader2, BarChart2, Moon, Sun, DollarSign
} from 'lucide-react';

import PostList from './components/PostList';

const SettingsPanel = lazy(() => import('./components/SettingsPanel'));
const EditorPanel = lazy(() => import('./components/EditorPanel'));
const AnalyticsPanel = lazy(() => import('./components/AnalyticsPanel'));
const FinancialPanel = lazy(() => import('./components/FinancialPanel'));

// URL Oficial da API
const API_URL = 'https://mainsite-app.lcv.rio.br/api';
const APP_VERSION = 'APP v3.31.0';

const DEFAULT_SETTINGS = {
  allowAutoMode: true,
  light: { bgColor: '#f8f9fa', bgImage: '', fontColor: '#202124', titleColor: '#1a73e8' },
  dark: { bgColor: '#131314', bgImage: '', fontColor: '#e3e3e3', titleColor: '#8ab4f8' },
  shared: { fontSize: '1rem', titleFontSize: '1.5rem', fontFamily: 'system-ui, -apple-system, sans-serif' }
};

const getStyles = (activePalette, isDarkBase, glassBg, glassBorder, bgImageToUse) => ({
  glassBg,
  glassBorder,
  center: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: activePalette.bgColor },
  adminBody: { 
    backgroundColor: activePalette.bgColor, 
    backgroundImage: bgImageToUse,
    backgroundSize: 'cover', backgroundAttachment: 'fixed',
    color: activePalette.fontColor, fontFamily: activePalette.fontFamily || 'system-ui, -apple-system, sans-serif', minHeight: '100vh', padding: '40px 20px', transition: 'all 0.4s ease' 
  },
  toast: { position: 'fixed', top: '30px', left: '50%', padding: '12px 24px', borderRadius: '12px', zIndex: 10000, boxShadow: '0 10px 30px rgba(0,0,0,0.15)', transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)', border: `1px solid ${glassBorder}`, display: 'flex', alignItems: 'center', gap: '12px', fontWeight: '500', fontSize: '14px', backgroundColor: glassBg, backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: isDarkBase ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.4)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 },
  modalContent: { animation: 'fadeIn 0.3s ease-out forwards', backgroundColor: glassBg, backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', padding: '40px', borderRadius: '24px', border: `1px solid ${glassBorder}`, maxWidth: '400px', width: '90%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', color: activePalette.fontColor },
  modalText: { fontSize: '16px', fontWeight: '500', marginBottom: '30px' },
  modalActions: { display: 'flex', gap: '12px', justifyContent: 'center' },
  modalBtnConfirm: { backgroundColor: 'rgba(234, 67, 53, 0.4)', backdropFilter: 'blur(10px)', color: '#fff', border: '1px solid rgba(234, 67, 53, 0.5)', borderRadius: '8px', padding: '12px 24px', fontWeight: '600', cursor: 'pointer', flex: 1, transition: 'background 0.2s' },
  modalBtnCancel: { backgroundColor: 'transparent', color: activePalette.fontColor, border: `1px solid ${glassBorder}`, borderRadius: '8px', padding: '12px 24px', fontWeight: '600', cursor: 'pointer', flex: 1, transition: 'background 0.2s' },
  adminContainer: { maxWidth: '1000px', margin: '0 auto', backgroundColor: glassBg, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: '24px', border: `1px solid ${glassBorder}`, padding: '40px', boxShadow: '0 20px 40px rgba(0,0,0,0.08)' },
  adminHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', borderBottom: `1px solid ${glassBorder}`, paddingBottom: '24px', flexWrap: 'wrap', gap: '15px' },
  adminTitle: { fontSize: '18px', fontWeight: '600', color: activePalette.titleColor, letterSpacing: '-0.5px' },
  plusButton: { backgroundColor: activePalette.titleColor, color: isDarkBase ? '#000' : '#fff', border: 'none', borderRadius: '20px', padding: '10px 20px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', transition: 'opacity 0.2s' },
  headerBtn: { backgroundColor: 'transparent', color: activePalette.fontColor, border: `1px solid ${glassBorder}`, borderRadius: '20px', padding: '10px 20px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500', transition: 'background 0.2s' },
  settingsBtn: { backgroundColor: 'transparent', color: activePalette.fontColor, border: `1px solid ${glassBorder}`, borderRadius: '20px', padding: '10px 20px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' },
  backButton: { background: 'none', border: 'none', fontSize: '14px', fontWeight: '500', cursor: 'pointer', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '10px', color: activePalette.fontColor, opacity: 0.8 },
  form: { display: 'flex', flexDirection: 'column', gap: '24px' },
  settingsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', background: 'rgba(0,0,0,0.02)', padding: '20px', border: `1px solid ${glassBorder}`, borderRadius: '16px', backdropFilter: 'blur(5px)' },
  settingsPageGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' },
  label: { display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', fontWeight: '600', color: activePalette.fontColor },
  colorInput: { height: '40px', width: '100%', cursor: 'pointer', border: 'none', borderRadius: '8px', background: 'transparent' },
  textInput: { padding: '12px', border: `1px solid ${glassBorder}`, backgroundColor: glassBg, backdropFilter: 'blur(5px)', color: activePalette.fontColor, outline: 'none', fontSize: '14px', borderRadius: '8px', transition: 'border 0.2s' },
  adminInput: { border: 'none', borderBottom: `2px solid ${activePalette.titleColor}`, backgroundColor: 'transparent', color: activePalette.titleColor, padding: '15px 0', fontSize: '24px', fontWeight: '600', outline: 'none', marginBottom: '10px' },
  editorContainer: { border: `1px solid ${glassBorder}`, backgroundColor: glassBg, backdropFilter: 'blur(5px)', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  toolbar: { display: 'flex', flexWrap: 'wrap', gap: '4px', padding: '12px', borderBottom: `1px solid ${glassBorder}`, backgroundColor: isDarkBase ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' },
  toolbarBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: activePalette.fontColor, border: 'none', padding: '6px', cursor: 'pointer', borderRadius: '6px', width: '32px', height: '32px', transition: 'background 0.2s' },
  toolbarDivider: { width: '1px', backgroundColor: glassBorder, margin: '0 8px' },
  tiptapWrapper: { backgroundColor: 'transparent', color: activePalette.fontColor, cursor: 'text' },
  statusBar: { padding: '8px 16px', borderTop: `1px solid ${glassBorder}`, fontSize: '12px', color: activePalette.fontColor, opacity: 0.6, textAlign: 'right', background: isDarkBase ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)' },
  adminButton: { backgroundColor: activePalette.titleColor, color: isDarkBase ? '#000' : '#fff', border: 'none', borderRadius: '12px', padding: '16px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', letterSpacing: '0.5px', marginTop: '20px', transition: 'opacity 0.2s' },
  list: { display: 'flex', flexDirection: 'column', gap: '12px' },
  postCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', border: `1px solid ${glassBorder}`, backgroundColor: glassBg, backdropFilter: 'blur(5px)', borderRadius: '16px', transition: 'transform 0.2s, box-shadow 0.2s' },
  cardDate: { fontSize: '12px', color: activePalette.fontColor, opacity: 0.6, marginBottom: '6px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px' },
  pinnedBadge: { backgroundColor: activePalette.titleColor, color: isDarkBase ? '#000' : '#fff', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold' },
  cardTitle: { fontSize: '16px', fontWeight: '600', color: activePalette.fontColor },
  actions: { display: 'flex', gap: '8px' },
  actionBtnPin: { background: 'transparent', border: 'none', padding: '8px', cursor: 'pointer', color: activePalette.fontColor, opacity: 0.8, borderRadius: '8px', transition: 'background 0.2s' },
  actionBtnEdit: { background: isDarkBase ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', border: 'none', padding: '8px', cursor: 'pointer', color: activePalette.fontColor, borderRadius: '8px', transition: 'background 0.2s' },
  actionBtnDelete: { background: 'transparent', border: 'none', padding: '8px', cursor: 'pointer', color: '#ea4335', borderRadius: '8px', transition: 'background 0.2s' },
  versionFooterAdmin: { marginTop: '40px', textAlign: 'center', fontSize: '12px', color: activePalette.fontColor, opacity: 0.4, fontWeight: '500' }
});

const App = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  
  const [editingPost, setEditingPost] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const [modal, setModal] = useState({ show: false, id: null, type: null, onComplete: null });
  const [draggedIndex, setDraggedIndex] = useState(null);

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [rotation, setRotation] = useState({ enabled: false, interval: 60, last_rotated_at: 0 });
  const [rateLimit, setRateLimit] = useState({ enabled: false, maxRequests: 5, windowMinutes: 1 });
  const [disclaimers, setDisclaimers] = useState({ enabled: true, items: [] });

  const [userTheme, setUserTheme] = useState(localStorage.getItem('adminThemePref') || 'auto');
  const [systemIsDark, setSystemIsDark] = useState(window.matchMedia('(prefers-color-scheme: dark)').matches);

  const fileInputBgRef = useRef(null);
  const [uploadTarget, setUploadTarget] = useState(null);
  const [isUploadingBg, setIsUploadingBg] = useState(false);

  const secret = import.meta.env.VITE_API_SECRET;

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
      if (resRateLimit.ok) setRateLimit(await resRateLimit.json());
      
      const resDisclaimers = await fetch(`${API_URL}/settings/disclaimers`);
      if (resDisclaimers.ok) setDisclaimers(await resDisclaimers.json());

    } catch (err) { showNotification("Erro na sincronização.", "error"); } finally { setLoading(false); }
  }, [showNotification, secret]);

  useEffect(() => { fetchData(); }, [fetchData]);

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
      if (resApp.ok && resRot.ok && resRL.ok && resDisc.ok) showNotification("Configurações salvas.", "success"); else throw new Error();
    } catch (err) { showNotification("Erro ao salvar configs.", "error"); } finally { setIsSaving(false); }
  };

  const openDeleteModal = (id, type, onComplete, customMessage) => {
    setModal({ show: true, id, type, onComplete, message: customMessage || `Deseja apagar permanentemente?` });
  };

  const confirmDelete = async () => {
    const { id, type, onComplete } = modal;
    setModal({ show: false, id: null, type: null, onComplete: null }); // Fechar modal imediatamente
    if (!id || !type) return;

    try {
      const res = await fetch(`${API_URL}/${type}/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${secret}` }
      });
      if (res.ok) {
        showNotification("Registro removido.", "success");
        if (onComplete) onComplete();
      } else {
        throw new Error("Falha ao remover o registro.");
      }
    } catch (err) {
      showNotification(err.message, "error");
    }
  };

  const handlePin = async (id) => {
    try {
      const res = await fetch(`${API_URL}/posts/${id}/pin`, { method: 'PUT', headers: { 'Authorization': `Bearer ${secret}` } });
      if (res.ok) { showNotification("Status alterado.", "success"); await fetchData(); }
    } catch (err) { showNotification("Erro.", "error"); }
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
    } catch (err) { showNotification("Erro de ordem.", "error"); await fetchData(); }
  };

  const openEditor = (post = null) => {
    setIsSettingsOpen(false); 
    setIsAnalyticsOpen(false);
    setEditingPost(post);
    setIsEditorOpen(true);
  };

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

  if (loading) return <div style={styles.center}><Loader2 className="animate-spin" color={activePalette.fontColor} size={32} /></div>;

  return (
    <div style={styles.adminBody}>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .ProseMirror { min-height: 400px; padding: 30px; outline: none; line-height: 1.6; font-size: 16px; }
        .ProseMirror p.is-editor-empty:first-child::before { content: attr(data-placeholder); float: left; color: ${isDarkBase ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}; pointer-events: none; height: 0; }
        .ProseMirror table { border-collapse: collapse; table-layout: fixed; width: 100%; margin: 0; overflow: hidden; }
        .ProseMirror table td, .ProseMirror table th { min-width: 1em; border: 1px solid ${glassBorder}; padding: 8px; vertical-align: top; box-sizing: border-box; position: relative; }
        .ProseMirror table th { font-weight: bold; text-align: left; background-color: ${isDarkBase ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'}; }
        ul[data-type="taskList"] { list-style: none; padding: 0; }
        ul[data-type="taskList"] li { display: flex; align-items: center; }
        ul[data-type="taskList"] li label { margin-right: 8px; }
        .log-card { padding: 20px; border-radius: 16px; border: 1px solid ${glassBorder}; background: ${isDarkBase ? 'rgba(0,0,0,0.2)' : '#fff'}; transition: all 0.2s; }
        .log-card:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(0,0,0,0.05); }
        button:hover { opacity: 0.9; }
      `}</style>
      
      <div style={{ ...styles.toast, transform: toast.show ? 'translate(-50%, 0)' : 'translate(-50%, -120px)', opacity: toast.show ? 1 : 0, color: toast.type === 'error' ? '#fff' : activePalette.fontColor, ...(toast.type === 'error' && { backgroundColor: '#ea4335', backdropFilter: 'blur(0px)' }) }}>
        {toast.type === 'error' ? <AlertCircle size={18} /> : <Check size={18} />} <span>{toast.message}</span>
      </div>

      {modal.show && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <AlertCircle size={48} color="#ea4335" style={{ marginBottom: '20px' }} />
            <p style={styles.modalText}>{modal.message}</p>
            <div style={styles.modalActions}>
              <button onClick={() => setModal({ show: false, id: null, type: null, onComplete: null })} style={styles.modalBtnCancel}>CANCELAR</button>
              <button onClick={confirmDelete} style={styles.modalBtnConfirm}>EXCLUIR</button>
            </div>
          </div>
        </div>
      )}

      <input type="file" accept="image/*" ref={fileInputBgRef} onChange={handleBgImageUpload} style={{ display: 'none' }} />

      <div style={styles.adminContainer}>
        <header style={styles.adminHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Database size={24} color={activePalette.titleColor} />
            <h1 style={styles.adminTitle}>{APP_VERSION.replace('APP', 'Console')}</h1>
            {!isEditorOpen && !isSettingsOpen && !isAnalyticsOpen && (
              <button onClick={() => openEditor()} style={styles.plusButton}><PlusCircle size={18} /> NOVO</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button onClick={cycleTheme} style={styles.headerBtn} title="Alternar Tema">
              {userTheme === 'auto' ? <Settings size={16}/> : userTheme === 'dark' ? <Moon size={16}/> : <Sun size={16}/>}
            </button>
            <button onClick={() => { setIsAnalyticsOpen(false); setIsSettingsOpen(false); fetchData(); }} style={styles.headerBtn} title="Sincronizar Banco"><RefreshCw size={16} /></button>
            
            <button onClick={() => { setIsAnalyticsOpen(true); setIsSettingsOpen(false); setIsEditorOpen(false); }} style={styles.headerBtn}><BarChart2 size={16} /> Auditoria</button>
            <button onClick={() => { setIsSettingsOpen(true); setIsAnalyticsOpen(false); setIsEditorOpen(false); }} style={styles.headerBtn}><Settings size={16} /> Sistema</button>
          </div>
        </header>

        <Suspense fallback={<div style={{ padding: '50px', display: 'flex', justifyContent: 'center' }}><Loader2 className="animate-spin" color={activePalette.fontColor} size={32} /></div>}>
          {isAnalyticsOpen ? (
            <AnalyticsPanel 
              onClose={() => { setIsAnalyticsOpen(false); fetchData(); }} 
              secret={secret} 
              API_URL={API_URL} 
              styles={styles}
              openDeleteModal={openDeleteModal}
            />
          ) : isSettingsOpen ? (
            <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
              <button onClick={() => { setIsSettingsOpen(false); fetchData(); }} style={{...styles.backButton, marginBottom: '20px'}}>
                <ArrowLeft size={16} /> Voltar ao Console
              </button>
              <div style={styles.settingsPageGrid}>
                <FinancialPanel 
                  showBackButton={false}
                  onClose={() => { setIsSettingsOpen(false); fetchData(); }} 
                  secret={secret} 
                  API_URL={API_URL} 
                  styles={styles}
                  activePalette={activePalette}
                  isDarkBase={isDarkBase}
                  showNotification={showNotification}
                />
                <SettingsPanel 
                  showBackButton={false}
                  settings={settings} setSettings={setSettings} 
                  rateLimit={rateLimit} setRateLimit={setRateLimit} 
                  rotation={rotation} setRotation={setRotation} 
                  disclaimers={disclaimers} setDisclaimers={setDisclaimers} 
                  isSaving={isSaving} onSave={handleSaveSettings} 
                  onClose={() => { setIsSettingsOpen(false); fetchData(); }} 
                  triggerBgUpload={triggerBgUpload} 
                  isUploadingBg={isUploadingBg} uploadTarget={uploadTarget} 
                  styles={styles}
                  activePalette={activePalette}
                  isDarkBase={isDarkBase}
                />
              </div>
            </div>
          ) : isEditorOpen ? (
            <EditorPanel key={editingPost ? editingPost.id : 'new'} post={editingPost} isSaving={isSaving} onSave={handleSavePost} onCancel={() => { setIsEditorOpen(false); fetchData(); }} secret={secret} showNotification={showNotification} styles={styles} API_URL={API_URL} />
          ) : (
            <PostList 
              posts={posts} 
              onPin={handlePin} 
              onEdit={openEditor} 
              onDelete={(id) => openDeleteModal(id, 'posts', fetchData, 'Deseja apagar este post permanentemente?')} 
              onDragStart={handleDragStart} 
              onDragEnd={handleDragEnd} 
              onDragOver={handleDragOver} 
              onDrop={handleDrop} 
              styles={styles}
              activePalette={activePalette}
              isDarkBase={isDarkBase}
            />
          )}
        </Suspense>
        <footer style={styles.versionFooterAdmin}>{APP_VERSION}</footer>
      </div>
    </div>
  );
};

export default App;