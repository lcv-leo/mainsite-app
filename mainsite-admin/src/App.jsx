// Módulo: mainsite-admin/src/App.jsx
// Versão: v3.21.0
// Descrição: Monólito purificado. Orquestração central com painel de auditoria unificado e code-splitting.

import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { 
  Database, PlusCircle, Check, AlertCircle, Settings, RefreshCw, Loader2, BarChart2
} from 'lucide-react';

import PostList from './components/PostList'; // O PostList carrega imediatamente (crítico)

// Code Splitting: Componentes pesados carregados apenas sob demanda
const SettingsPanel = lazy(() => import('./components/SettingsPanel'));
const EditorPanel = lazy(() => import('./components/EditorPanel'));
const AnalyticsPanel = lazy(() => import('./components/AnalyticsPanel'));

const API_URL = 'https://mainsite-app.lcv.workers.dev/api';
const APP_VERSION = 'APP v3.21.0';

const DEFAULT_SETTINGS = {
  allowAutoMode: true,
  light: { bgColor: '#ffffff', bgImage: '', fontColor: '#333333', titleColor: '#111111' },
  dark: { bgColor: '#131314', bgImage: '', fontColor: '#E3E3E3', titleColor: '#8AB4F8' },
  shared: { fontSize: '1.15rem', titleFontSize: '1.8rem', fontFamily: 'sans-serif' }
};

const App = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estados de Navegação Purificados
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  
  const [editingPost, setEditingPost] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const [modal, setModal] = useState({ show: false, id: null });
  const [draggedIndex, setDraggedIndex] = useState(null);

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [rotation, setRotation] = useState({ enabled: false, interval: 60, last_rotated_at: 0 });
  const [rateLimit, setRateLimit] = useState({ enabled: false, maxRequests: 5, windowMinutes: 1 });
  const [disclaimers, setDisclaimers] = useState({ enabled: true, items: [] });

  const fileInputBgRef = useRef(null);
  const [uploadTarget, setUploadTarget] = useState(null);
  const [isUploadingBg, setIsUploadingBg] = useState(false);

  const secret = import.meta.env.VITE_API_SECRET;

  const showNotification = useCallback((message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
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
          dark: { bgColor: dataSettings.bgColor || '#131314', bgImage: dataSettings.bgImage || '', fontColor: dataSettings.fontColor || '#E3E3E3', titleColor: dataSettings.titleColor || '#8AB4F8' },
          shared: { fontSize: dataSettings.fontSize || '1.15rem', titleFontSize: dataSettings.titleFontSize || '1.8rem', fontFamily: dataSettings.fontFamily || 'sans-serif' }
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

  const confirmDelete = async () => {
    const id = modal.id; setModal({ show: false, id: null });
    try {
      const res = await fetch(`${API_URL}/posts/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${secret}` } });
      if (res.ok) { showNotification("Removido.", "success"); await fetchData(); }
    } catch (err) { showNotification("Falha.", "error"); }
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

  if (loading) return <div style={styles.center}><Loader2 className="animate-spin" color="#000" /></div>;

  return (
    <div style={styles.adminBody}>
      <style>{`
        .ProseMirror { min-height: 400px; padding: 25px; outline: none; line-height: 1.6; font-size: 15px; }
        .ProseMirror p.is-editor-empty:first-child::before { content: attr(data-placeholder); float: left; color: #adb5bd; pointer-events: none; height: 0; }
        .ProseMirror table { border-collapse: collapse; table-layout: fixed; width: 100%; margin: 0; overflow: hidden; }
        .ProseMirror table td, .ProseMirror table th { min-width: 1em; border: 1px solid #ced4da; padding: 3px 5px; vertical-align: top; box-sizing: border-box; position: relative; }
        .ProseMirror table th { font-weight: bold; text-align: left; background-color: #f1f3f5; }
        ul[data-type="taskList"] { list-style: none; padding: 0; }
        ul[data-type="taskList"] li { display: flex; align-items: center; }
        ul[data-type="taskList"] li label { margin-right: 8px; }
        .log-card { padding: 15px; border-radius: 4px; border: 1px solid #eee; transition: all 0.2s; }
        .log-card:hover { transform: translateX(2px); box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
      `}</style>
      
      <div style={{ ...styles.toast, transform: toast.show ? 'translateY(0)' : 'translateY(-120px)', opacity: toast.show ? 1 : 0, backgroundColor: toast.type === 'error' ? '#000' : '#fff', color: toast.type === 'error' ? '#fff' : '#000' }}>
        {toast.type === 'error' ? <AlertCircle size={16} /> : <Check size={16} />} <span style={{ fontSize: '11px', fontWeight: 'bold' }}>{toast.message}</span>
      </div>

      {modal.show && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <AlertCircle size={36} style={{ marginBottom: '20px' }} />
            <p style={styles.modalText}>Deseja apagar permanentemente?</p>
            <div style={styles.modalActions}>
              <button onClick={() => setModal({ show: false, id: null })} style={styles.modalBtnCancel}>CANCELAR</button>
              <button onClick={confirmDelete} style={styles.modalBtnConfirm}>EXCLUIR</button>
            </div>
          </div>
        </div>
      )}

      <input type="file" accept="image/*" ref={fileInputBgRef} onChange={handleBgImageUpload} style={{ display: 'none' }} />

      <div style={styles.adminContainer}>
        <header style={styles.adminHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Database size={18} />
            <h1 style={styles.adminTitle}>{APP_VERSION.replace('APP', 'Console')}</h1>
            {!isEditorOpen && !isSettingsOpen && !isAnalyticsOpen && (
              <button onClick={() => openEditor()} style={styles.plusButton}><PlusCircle size={16} /> NOVO</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '15px' }}>
            <button onClick={() => fetchData()} style={styles.headerBtn} title="Sincronizar Banco"><RefreshCw size={18} /></button>
            <button onClick={() => setIsAnalyticsOpen(true)} style={styles.headerBtn}><BarChart2 size={18} /> Auditoria</button>
            <button onClick={() => setIsSettingsOpen(true)} style={styles.headerBtn}><Settings size={18} /> Sistema</button>
          </div>
        </header>

        <Suspense fallback={<div style={{ padding: '50px', display: 'flex', justifyContent: 'center' }}><Loader2 className="animate-spin" size={32} /></div>}>
          {isAnalyticsOpen ? (
            <AnalyticsPanel onClose={() => { setIsAnalyticsOpen(false); fetchData(); }} secret={secret} API_URL={API_URL} styles={styles} />
          ) : isSettingsOpen ? (
            <SettingsPanel settings={settings} setSettings={setSettings} rateLimit={rateLimit} setRateLimit={setRateLimit} rotation={rotation} setRotation={setRotation} disclaimers={disclaimers} setDisclaimers={setDisclaimers} isSaving={isSaving} onSave={handleSaveSettings} onClose={() => { setIsSettingsOpen(false); fetchData(); }} triggerBgUpload={triggerBgUpload} isUploadingBg={isUploadingBg} uploadTarget={uploadTarget} styles={styles} />
          ) : isEditorOpen ? (
            <EditorPanel key={editingPost ? editingPost.id : 'new'} post={editingPost} isSaving={isSaving} onSave={handleSavePost} onCancel={() => { setIsEditorOpen(false); fetchData(); }} secret={secret} showNotification={showNotification} styles={styles} API_URL={API_URL} />
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
    </div>
  );
};

const styles = {
  center: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5' },
  adminBody: { backgroundColor: '#f5f5f5', color: '#000', fontFamily: 'monospace', minHeight: '100vh', padding: '40px 20px' },
  toast: { position: 'fixed', top: '30px', left: '50%', marginLeft: '-150px', width: '300px', padding: '15px 20px', display: 'flex', alignItems: 'center', gap: '15px', zIndex: 2000, boxShadow: '10px 10px 0px rgba(0,0,0,0.1)', transition: 'all 0.5s', border: '2px solid #000' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, backdropFilter: 'blur(8px)' },
  modalContent: { backgroundColor: '#fff', padding: '50px', border: '3px solid #000', maxWidth: '450px', width: '90%', textAlign: 'center', boxShadow: '25px 25px 0px #000' },
  modalText: { fontSize: '15px', fontWeight: '900', marginBottom: '35px', letterSpacing: '1px', textTransform: 'uppercase' },
  modalActions: { display: 'flex', flexDirection: 'column', gap: '12px' },
  modalBtnConfirm: { backgroundColor: '#000', color: '#fff', border: 'none', padding: '18px', fontWeight: 'bold', cursor: 'pointer', letterSpacing: '2px' },
  modalBtnCancel: { backgroundColor: '#fff', color: '#000', border: '2px solid #000', padding: '18px', fontWeight: 'bold', cursor: 'pointer', letterSpacing: '2px' },
  adminContainer: { maxWidth: '900px', margin: '0 auto', backgroundColor: '#fff', border: '2px solid #000', padding: '50px', boxShadow: '20px 20px 0px #d0d0d0' },
  adminHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', borderBottom: '3px solid #000', paddingBottom: '20px' },
  adminTitle: { fontSize: '14px', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: '900' },
  plusButton: { backgroundColor: '#000', color: '#fff', border: 'none', padding: '10px 15px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' },
  headerBtn: { backgroundColor: '#fff', color: '#000', border: '2px solid #000', padding: '10px 15px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' },
  settingsBtn: { backgroundColor: '#fff', color: '#000', border: '2px solid #000', padding: '10px 15px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' },
  backButton: { background: 'none', border: 'none', fontSize: '12px', fontWeight: '900', cursor: 'pointer', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '10px', color: '#555' },
  form: { display: 'flex', flexDirection: 'column', gap: '30px' },
  settingsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', background: '#fafafa', padding: '15px', border: '1px solid #ddd', borderRadius: '4px' },
  label: { display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', fontWeight: 'bold' },
  colorInput: { height: '35px', width: '100%', cursor: 'pointer', border: '1px solid #ccc', borderRadius: '4px' },
  textInput: { padding: '8px', border: '1px solid #ccc', outline: 'none', fontSize: '13px', fontFamily: 'monospace', borderRadius: '4px' },
  adminInput: { border: 'none', borderBottom: '3px solid #000', padding: '15px 0', fontSize: '18px', fontWeight: '900', outline: 'none' },
  editorContainer: { border: '2px solid #000', backgroundColor: '#fff', display: 'flex', flexDirection: 'column' },
  toolbar: { display: 'flex', flexWrap: 'wrap', gap: '3px', padding: '10px', borderBottom: '2px solid #000', backgroundColor: '#f4f4f4' },
  toolbarBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px solid #ccc', padding: '6px', cursor: 'pointer', borderRadius: '4px', width: '28px', height: '28px' },
  toolbarDivider: { width: '1px', backgroundColor: '#ccc', margin: '0 8px' },
  tiptapWrapper: { backgroundColor: '#fff', cursor: 'text' },
  statusBar: { padding: '5px 15px', borderTop: '1px solid #eee', fontSize: '10px', color: '#888', textAlign: 'right', background: '#fafafa' },
  adminButton: { backgroundColor: '#000', color: '#fff', border: 'none', padding: '20px', fontSize: '12px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', letterSpacing: '3px', marginTop: '10px' },
  list: { display: 'flex', flexDirection: 'column', gap: '10px' },
  postCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', border: '1px solid #eee', backgroundColor: '#fff', transition: 'all 0.2s' },
  cardDate: { fontSize: '9px', color: '#888', marginBottom: '5px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' },
  pinnedBadge: { backgroundColor: '#000', color: '#fff', padding: '2px 5px', borderRadius: '3px', fontSize: '7px', letterSpacing: '1px' },
  cardTitle: { fontSize: '13px', fontWeight: '900', textTransform: 'uppercase' },
  actions: { display: 'flex', gap: '8px' },
  actionBtnPin: { border: 'none', padding: '10px', cursor: 'pointer', borderRadius: '4px' },
  actionBtnEdit: { background: '#f0f0f0', border: 'none', padding: '10px', cursor: 'pointer', borderRadius: '4px' },
  actionBtnDelete: { background: '#fff', border: '2px solid #eee', padding: '10px', cursor: 'pointer', color: '#d00', borderRadius: '4px' },
  versionFooterAdmin: { marginTop: '50px', textAlign: 'center', fontSize: '10px', color: '#bbb', letterSpacing: '4px', fontWeight: 'bold' }
};

export default App;