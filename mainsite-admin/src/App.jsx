// Módulo: mainsite-admin/src/App.jsx
// Versão: v3.11.0
// Descrição: Injeção de arquitetura de Long Polling (atualização a cada 10s) e botão de sincronização manual na tela de Telemetria da IA.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Save, Loader2, Database, Edit3, Trash2, PlusCircle, ArrowLeft, Check, AlertCircle, Pin, GripVertical,
  Image as ImageIcon, Youtube, Bold, Italic, Strikethrough, Heading1, Heading2, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Link as LinkIcon, Unlink, Underline as UnderlineIcon,
  Highlighter, Subscript as SubIcon, Superscript as SuperIcon, Quote, Minus, Code, Table as TableIcon,
  CheckSquare, Palette, Type, Settings, RefreshCw, WrapText, Upload, Sparkles, MessageSquare
} from 'lucide-react';

import { Extension } from '@tiptap/core';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import YoutubeExtension from '@tiptap/extension-youtube';
import TextAlign from '@tiptap/extension-text-align';
import LinkExtension from '@tiptap/extension-link';
import { Underline } from '@tiptap/extension-underline';
import { Highlight } from '@tiptap/extension-highlight';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { FontFamily } from '@tiptap/extension-font-family';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { CharacterCount } from '@tiptap/extension-character-count';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Dropcursor } from '@tiptap/extension-dropcursor';
import { Typography } from '@tiptap/extension-typography';
import { Markdown } from 'tiptap-markdown';

const API_URL = 'https://mainsite-app.lcv.workers.dev/api';
const APP_VERSION = 'APP v3.11.0';

const DEFAULT_DISCLAIMER = "Atenção: Este texto não busca convencer nem detém a verdade. São apenas abstrações de uma mente em constante autorreflexão. Por ser ensaio pessoal, abdica-se do rigor acadêmico e de referências formais, priorizando-se a livre expressão.\n\n\\*Texto elaborado com auxílio de IA\\*";

// Extensão Customizada: Manipulação de Tamanho de Fonte no DOM
const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return { types: ['textStyle'] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize.replace(/['"]+/g, ''),
            renderHTML: attributes => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize: fontSize => ({ chain }) => chain().setMark('textStyle', { fontSize }).run(),
      unsetFontSize: () => ({ chain }) => chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

const formatImageUrl = (url) => {
  if (!url) return '';
  const driveRegex = /(?:file\/d\/|open\?id=|uc\?id=)([a-zA-Z0-9_-]+)/;
  const match = url.match(driveRegex);
  if (match && match[1]) {
    return `https://drive.google.com/uc?export=view&id=${match[1]}`;
  }
  return url;
};

const MenuBar = ({ editor, secret, showNotification }) => {
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  if (!editor) return null;

  const handleAITransform = async (action) => {
    const { from, to, empty } = editor.state.selection;
    if (empty) {
      showNotification("Por favor, selecione um trecho de texto no editor para aplicar a IA.", "error");
      return;
    }

    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    setIsGeneratingAI(true);
    showNotification("Processando transformação textual no Gemini...", "info");

    try {
      const res = await fetch(`${API_URL}/ai/transform`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${secret}` },
        body: JSON.stringify({ action, text: selectedText })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro na geração por IA.");

      editor.chain().focus().deleteSelection().insertContent(data.text).run();
      showNotification("Transformação aplicada.", "success");
    } catch (err) {
      showNotification(err.message, "error");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);
    showNotification("Enviando arquivo para o Cloudflare R2...", "info");

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${secret}` },
        body: formData
      });
      if (!res.ok) throw new Error("Falha na consolidação do arquivo.");

      const data = await res.json();
      editor.chain().focus().setImage({ src: data.url }).run();
      showNotification("Upload concluído com sucesso.", "success");
    } catch (err) {
      showNotification(err.message, "error");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const addImageUrl = () => { 
    const rawUrl = window.prompt('URL da imagem (Suporta links de compartilhamento do Google Drive):'); 
    if (rawUrl) {
      const url = formatImageUrl(rawUrl);
      editor.chain().focus().setImage({ src: url }).run(); 
    }
  };
  
  const addYoutube = () => { const url = window.prompt('URL do vídeo:'); if (url) editor.chain().focus().setYoutubeVideo({ src: url }).run(); };
  
  const addLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL do link:', previousUrl);
    if (url === null) return;
    if (url === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
    if (editor.state.selection.empty) {
      const text = window.prompt('Texto (deixe em branco para exibir a URL):', url);
      if (text) editor.chain().focus().insertContent(`<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`).run();
    } else { editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run(); }
  };

  return (
    <div style={styles.toolbar}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#f0f9ff', padding: '2px 5px', borderRadius: '4px', border: '1px solid #bae6fd', marginRight: '5px' }} title="Inteligência Artificial (Gemini 2.5 Pro)">
        <Sparkles size={14} color="#0284c7" />
        <select
          onChange={(e) => { if (e.target.value) { handleAITransform(e.target.value); e.target.value = ''; } }}
          style={{ fontSize: '11px', padding: '2px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#0369a1', fontWeight: 'bold', outline: 'none' }}
          disabled={isGeneratingAI}
        >
          <option value="">{isGeneratingAI ? 'Processando...' : 'IA: Aprimorar Texto'}</option>
          <option value="grammar">Corrigir Gramática</option>
          <option value="summarize">Resumir Seleção</option>
          <option value="expand">Expandir Conteúdo</option>
          <option value="formal">Tornar Formal</option>
        </select>
      </div>

      <div style={styles.toolbarDivider}></div>

      <button type="button" title="Negrito" onClick={() => editor.chain().focus().toggleBold().run()} style={{...styles.toolbarBtn, background: editor.isActive('bold') ? '#ddd' : '#fff'}}><Bold size={14} /></button>
      <button type="button" title="Itálico" onClick={() => editor.chain().focus().toggleItalic().run()} style={{...styles.toolbarBtn, background: editor.isActive('italic') ? '#ddd' : '#fff'}}><Italic size={14} /></button>
      <button type="button" title="Sublinhado" onClick={() => editor.chain().focus().toggleUnderline().run()} style={{...styles.toolbarBtn, background: editor.isActive('underline') ? '#ddd' : '#fff'}}><UnderlineIcon size={14} /></button>
      <button type="button" title="Tachado" onClick={() => editor.chain().focus().toggleStrike().run()} style={{...styles.toolbarBtn, background: editor.isActive('strike') ? '#ddd' : '#fff'}}><Strikethrough size={14} /></button>
      <button type="button" title="Marca-texto" onClick={() => editor.chain().focus().toggleHighlight().run()} style={{...styles.toolbarBtn, background: editor.isActive('highlight') ? '#ffcc00' : '#fff'}}><Highlighter size={14} /></button>
      
      <div style={styles.toolbarDivider}></div>
      
      <button type="button" title="Subscrito (H2O)" onClick={() => editor.chain().focus().toggleSubscript().run()} style={{...styles.toolbarBtn, background: editor.isActive('subscript') ? '#ddd' : '#fff'}}><SubIcon size={14} /></button>
      <button type="button" title="Sobrescrito (X2)" onClick={() => editor.chain().focus().toggleSuperscript().run()} style={{...styles.toolbarBtn, background: editor.isActive('superscript') ? '#ddd' : '#fff'}}><SuperIcon size={14} /></button>
      <button type="button" title="Bloco de Código" onClick={() => editor.chain().focus().toggleCodeBlock().run()} style={{...styles.toolbarBtn, background: editor.isActive('codeBlock') ? '#ddd' : '#fff'}}><Code size={14} /></button>
      <button type="button" title="Citação em Bloco" onClick={() => editor.chain().focus().toggleBlockquote().run()} style={{...styles.toolbarBtn, background: editor.isActive('blockquote') ? '#ddd' : '#fff'}}><Quote size={14} /></button>
      
      <div style={styles.toolbarDivider}></div>

      <button type="button" title="Alinhar à Esquerda" onClick={() => editor.chain().focus().setTextAlign('left').run()} style={{...styles.toolbarBtn, background: editor.isActive({ textAlign: 'left' }) ? '#ddd' : '#fff'}}><AlignLeft size={14} /></button>
      <button type="button" title="Centralizar" onClick={() => editor.chain().focus().setTextAlign('center').run()} style={{...styles.toolbarBtn, background: editor.isActive({ textAlign: 'center' }) ? '#ddd' : '#fff'}}><AlignCenter size={14} /></button>
      <button type="button" title="Alinhar à Direita" onClick={() => editor.chain().focus().setTextAlign('right').run()} style={{...styles.toolbarBtn, background: editor.isActive({ textAlign: 'right' }) ? '#ddd' : '#fff'}}><AlignRight size={14} /></button>
      <button type="button" title="Justificar" onClick={() => editor.chain().focus().setTextAlign('justify').run()} style={{...styles.toolbarBtn, background: editor.isActive({ textAlign: 'justify' }) ? '#ddd' : '#fff'}}><AlignJustify size={14} /></button>

      <div style={styles.toolbarDivider}></div>

      <button type="button" title="Título 1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} style={{...styles.toolbarBtn, background: editor.isActive('heading', { level: 1 }) ? '#ddd' : '#fff'}}><Heading1 size={14} /></button>
      <button type="button" title="Título 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} style={{...styles.toolbarBtn, background: editor.isActive('heading', { level: 2 }) ? '#ddd' : '#fff'}}><Heading2 size={14} /></button>
      <button type="button" title="Lista de Marcadores" onClick={() => editor.chain().focus().toggleBulletList().run()} style={{...styles.toolbarBtn, background: editor.isActive('bulletList') ? '#ddd' : '#fff'}}><List size={14} /></button>
      <button type="button" title="Lista Numerada" onClick={() => editor.chain().focus().toggleOrderedList().run()} style={{...styles.toolbarBtn, background: editor.isActive('orderedList') ? '#ddd' : '#fff'}}><ListOrdered size={14} /></button>
      <button type="button" title="Lista de Tarefas" onClick={() => editor.chain().focus().toggleTaskList().run()} style={{...styles.toolbarBtn, background: editor.isActive('taskList') ? '#ddd' : '#fff'}}><CheckSquare size={14} /></button>
      <button type="button" title="Linha Horizontal" onClick={() => editor.chain().focus().setHorizontalRule().run()} style={styles.toolbarBtn}><Minus size={14} /></button>
      <button type="button" title="Inserir Tabela (3x3)" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} style={styles.toolbarBtn}><TableIcon size={14} /></button>
      
      <button type="button" title="Quebra de Linha Simples (Shift+Enter)" onClick={() => editor.chain().focus().setHardBreak().run()} style={styles.toolbarBtn}><WrapText size={14} /></button>

      <div style={styles.toolbarDivider}></div>

      <button type="button" title="Inserir/Editar Link" onClick={addLink} style={{...styles.toolbarBtn, background: editor.isActive('link') ? '#ddd' : '#fff'}}><LinkIcon size={14} /></button>
      <button type="button" title="Remover Link" onClick={() => editor.chain().focus().unsetLink().run()} disabled={!editor.isActive('link')} style={{...styles.toolbarBtn, opacity: editor.isActive('link') ? 1 : 0.5}}><Unlink size={14} /></button>
      
      <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} style={{ display: 'none' }} />
      <button type="button" title="Upload de Imagem Nativo (R2)" onClick={() => fileInputRef.current.click()} disabled={isUploading} style={{...styles.toolbarBtn, opacity: isUploading ? 0.5 : 1}}><Upload size={14} /></button>
      
      <button type="button" title="Inserir Imagem via Link (Drive/Web)" onClick={addImageUrl} style={styles.toolbarBtn}><ImageIcon size={14} /></button>
      <button type="button" title="Inserir YouTube" onClick={addYoutube} style={styles.toolbarBtn}><Youtube size={14} /></button>

      <div style={styles.toolbarDivider}></div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }} title="Cor do Texto">
        <Palette size={14} />
        <input type="color" onInput={event => editor.chain().focus().setColor(event.target.value).run()} value={editor.getAttributes('textStyle').color || '#000000'} style={{ cursor: 'pointer', padding: 0, border: 'none', width: '25px', height: '25px' }}/>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }} title="Família da Fonte">
        <Type size={14} />
        <select onChange={e => editor.chain().focus().setFontFamily(e.target.value).run()} value={editor.getAttributes('textStyle').fontFamily || 'inherit'} style={{ fontSize: '11px', padding: '2px' }}>
          <option value="inherit">Padrão</option>
          <option value="monospace">Monospace</option>
          <option value="Arial">Arial</option>
          <option value="'Times New Roman', Times, serif">Times</option>
        </select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }} title="Tamanho da Fonte">
        <select onChange={e => editor.chain().focus().setFontSize(e.target.value).run()} value={editor.getAttributes('textStyle').fontSize || ''} style={{ fontSize: '11px', padding: '2px' }}>
          <option value="">Tam. Padrão</option>
          <option value="12px">12px</option>
          <option value="14px">14px</option>
          <option value="16px">16px</option>
          <option value="18px">18px</option>
          <option value="20px">20px</option>
          <option value="24px">24px</option>
          <option value="30px">30px</option>
          <option value="36px">36px</option>
        </select>
      </div>
    </div>
  );
};

const DEFAULT_SETTINGS = {
  allowAutoMode: true,
  light: { bgColor: '#ffffff', bgImage: '', fontColor: '#333333', titleColor: '#111111' },
  dark: { bgColor: '#131314', bgImage: '', fontColor: '#E3E3E3', titleColor: '#8AB4F8' },
  shared: { fontSize: '1.15rem', titleFontSize: '1.8rem', fontFamily: 'sans-serif' }
};

const App = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChatLogsOpen, setIsChatLogsOpen] = useState(false);
  
  const [chatLogs, setChatLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const [modal, setModal] = useState({ show: false, id: null });
  const [draggedIndex, setDraggedIndex] = useState(null);

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  
  const [rotation, setRotation] = useState({ enabled: false, interval: 60, last_rotated_at: 0 });

  const secret = import.meta.env.VITE_API_SECRET;

  const editor = useEditor({
    extensions: [
      StarterKit, Markdown, Underline, Highlight, Subscript, Superscript, TextStyle, Color, FontFamily, FontSize, Typography,
      TextAlign.configure({ types: ['heading', 'paragraph'], defaultAlignment: 'justify' }),
      Image.configure({ inline: true }),
      YoutubeExtension.configure({ inline: false, width: 840, height: 472.5 }),
      Table.configure({ resizable: true }), TableRow, TableHeader, TableCell,
      TaskList, TaskItem.configure({ nested: true }),
      Dropcursor.configure({ color: '#ff0000', width: 2 }),
      CharacterCount,
      Placeholder.configure({ placeholder: 'O fluxo da consciência (Aceita Markdown na colagem)...' }),
      LinkExtension.configure({ openOnClick: false, autolink: true, HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' }})
    ],
    content: '',
  });

  const showNotification = useCallback((message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const resPosts = await fetch(`${API_URL}/posts`);
      const dataPosts = await resPosts.json();
      if (Array.isArray(dataPosts)) setPosts(dataPosts);

      const resSettings = await fetch(`${API_URL}/settings`);
      const dataSettings = await resSettings.json();
      
      if (!dataSettings.error) {
        if (dataSettings.light) {
          setSettings(dataSettings);
        } else {
          setSettings({
            ...DEFAULT_SETTINGS,
            dark: { 
              bgColor: dataSettings.bgColor || '#131314', 
              bgImage: dataSettings.bgImage || '', 
              fontColor: dataSettings.fontColor || '#E3E3E3', 
              titleColor: dataSettings.titleColor || '#8AB4F8' 
            },
            shared: { 
              fontSize: dataSettings.fontSize || '1.15rem', 
              titleFontSize: dataSettings.titleFontSize || '1.8rem', 
              fontFamily: dataSettings.fontFamily || 'sans-serif' 
            }
          });
        }
      }

      const resRotation = await fetch(`${API_URL}/settings/rotation`);
      if (resRotation.ok) {
        const dataRotation = await resRotation.json();
        setRotation(dataRotation);
      }

    } catch (err) {
      showNotification("Erro na sincronização.", "error");
    } finally { setLoading(false); }
  }, [showNotification]);

  // INJEÇÃO ARQUITETURAL: Fetch de Logs com flag de background (silencioso)
  const fetchChatLogs = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoadingLogs(true);
    try {
      const res = await fetch(`${API_URL}/chat-logs`, {
        headers: { 'Authorization': `Bearer ${secret}` }
      });
      if (res.ok) setChatLogs(await res.json());
      else throw new Error("Erro de autenticação nos logs.");
    } catch (err) { 
      if (showSpinner) showNotification("Falha ao puxar logs de IA.", "error"); 
    } finally { 
      if (showSpinner) setLoadingLogs(false); 
    }
  }, [secret, showNotification]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // INJEÇÃO ARQUITETURAL: Ciclo de Vida do Long Polling (Atualização a cada 10s)
  useEffect(() => {
    let pollInterval;
    if (isChatLogsOpen) {
      pollInterval = setInterval(() => {
        fetchChatLogs(false); // Chama o fetch no modo background (sem girar loader na tela)
      }, 10000);
    }
    return () => clearInterval(pollInterval);
  }, [isChatLogsOpen, fetchChatLogs]);

  const handleSavePost = async (e) => {
    e.preventDefault();
    if (!editor) return;
    setIsSaving(true);
    const contentHTML = editor.getHTML();
    const method = editingId ? 'PUT' : 'POST';
    const url = editingId ? `${API_URL}/posts/${editingId}` : `${API_URL}/posts`;

    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${secret}` }, body: JSON.stringify({ title, content: contentHTML }) });
      if (res.ok) { showNotification("Fragmento consolidado.", "success"); setIsEditorOpen(false); await fetchData(); } 
      else throw new Error("Falha na autorização.");
    } catch (err) { showNotification(err.message, "error"); } finally { setIsSaving(false); }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    
    const formattedSettings = { 
      ...settings, 
      light: { ...settings.light, bgImage: formatImageUrl(settings.light.bgImage) },
      dark: { ...settings.dark, bgImage: formatImageUrl(settings.dark.bgImage) }
    };
    setSettings(formattedSettings);

    try {
      const resApp = await fetch(`${API_URL}/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${secret}` }, body: JSON.stringify(formattedSettings) });
      const resRot = await fetch(`${API_URL}/settings/rotation`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${secret}` }, body: JSON.stringify(rotation) });

      if (resApp.ok && resRot.ok) { 
        showNotification("Configurações salvas com sucesso.", "success"); 
      } else {
        throw new Error("Erro ao salvar configs.");
      }
    } catch (err) { showNotification(err.message, "error"); } finally { setIsSaving(false); }
  };

  const confirmDelete = async () => {
    const id = modal.id;
    setModal({ show: false, id: null });
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
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;
    const newOrder = [...posts];
    const draggedItem = newOrder[draggedIndex];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(dropIndex, 0, draggedItem);
    setPosts(newOrder);

    const payload = newOrder.map((post, idx) => ({ id: post.id, display_order: idx }));
    try {
      const res = await fetch(`${API_URL}/posts/reorder`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${secret}` }, body: JSON.stringify(payload) });
      if (res.ok) showNotification("Ordem sincronizada.", "success"); else throw new Error();
    } catch (err) { showNotification("Erro de ordem.", "error"); await fetchData(); }
  };

  const openEditor = (post = null) => {
    setIsSettingsOpen(false);
    setIsChatLogsOpen(false);
    if (post) { 
      setEditingId(post.id); 
      setTitle(post.title); 
      editor?.commands.setContent(post.content); 
    } else { 
      setEditingId(null); 
      setTitle(''); 
      editor?.commands.setContent(DEFAULT_DISCLAIMER); 
    }
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

      <div style={styles.adminContainer}>
        <header style={styles.adminHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Database size={18} /><h1 style={styles.adminTitle}>Console v3.11.0</h1></div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {!isEditorOpen && !isSettingsOpen && !isChatLogsOpen && <button onClick={fetchData} style={styles.settingsBtn} title="Sincronizar com Servidor"><RefreshCw size={16} /> Atualizar</button>}
            
            {!isEditorOpen && !isSettingsOpen && !isChatLogsOpen && <button onClick={() => { setIsChatLogsOpen(true); fetchChatLogs(true); }} style={{...styles.settingsBtn, backgroundColor: '#f0f9ff', borderColor: '#bae6fd'}} title="Auditoria de IA"><MessageSquare size={16} color="#0284c7" /> Telemetria IA</button>}
            
            {!isEditorOpen && !isSettingsOpen && !isChatLogsOpen && <button onClick={() => setIsSettingsOpen(true)} style={styles.settingsBtn} title="Configurações e Rotinas"><Settings size={16} /> Sistema</button>}
            {!isEditorOpen && !isSettingsOpen && !isChatLogsOpen && <button onClick={() => openEditor()} style={styles.plusButton}><PlusCircle size={16} /> Novo</button>}
          </div>
        </header>

        {isChatLogsOpen ? (
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
            <button onClick={() => { setIsChatLogsOpen(false); fetchData(); }} style={styles.backButton}><ArrowLeft size={16} /> Voltar aos Registros</button>
            
            {/* INJEÇÃO DE INTERFACE: Cabeçalho reativo da Telemetria */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '16px', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <MessageSquare size={20} /> Telemetria e Auditoria de Chatbot (Últimos 200)
              </h2>
              <button onClick={() => fetchChatLogs(true)} style={{...styles.settingsBtn, padding: '6px 12px'}} title="Forçar sincronização">
                <RefreshCw size={14} className={loadingLogs ? "animate-spin" : ""} /> Atualizar
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {loadingLogs ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Loader2 className="animate-spin" color="#000" /></div>
              ) : chatLogs.length === 0 ? (
                <p style={{fontSize: '12px', opacity: 0.6, textAlign: 'center'}}>Nenhum log registrado na telemetria.</p>
              ) : chatLogs.map((log, i) => (
                <div key={i} className="log-card" style={{ background: log.role === 'user' ? '#f8fafc' : '#f0fdf4', borderLeft: `4px solid ${log.role === 'user' ? '#94a3b8' : '#4ade80'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>
                    <span>{log.role === 'user' ? '👤 Pergunta (Usuário)' : '🤖 Resposta (IA)'}</span>
                    <span>{new Date(log.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                  <div style={{ fontSize: '13px', lineHeight: '1.6', color: '#0f172a', whiteSpace: 'pre-wrap' }}>{log.message}</div>
                  {log.context_title && (
                    <div style={{ marginTop: '12px', fontSize: '9px', background: '#e2e8f0', display: 'inline-block', padding: '4px 8px', borderRadius: '4px', color: '#475569', fontWeight: 'bold' }}>
                      CONTEXTO ATIVO: {log.context_title}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : isSettingsOpen ? (
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
             <button onClick={() => { setIsSettingsOpen(false); fetchData(); }} style={styles.backButton}><ArrowLeft size={16} /> Voltar aos Registros</button>
             
             <form onSubmit={handleSaveSettings} style={styles.form}>
                
                <h2 style={{ fontSize: '16px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>Engenharia de Automação</h2>
                <div style={{ padding: '15px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', color: '#0369a1' }}>
                    <input type="checkbox" checked={rotation.enabled} onChange={e => setRotation({...rotation, enabled: e.target.checked})} style={{ width: '18px', height: '18px' }} />
                    Habilitar Rotação Autônoma da Fila de Textos
                  </label>
                  <p style={{ fontSize: '11px', color: '#0284c7', margin: 0 }}>* A automação move o texto mais recente para o final da fila. Aborta imediatamente se houver um post FIXADO.</p>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                    Intervalo de Rotação (Minutos):
                    <input type="number" min="1" value={rotation.interval} onChange={e => setRotation({...rotation, interval: parseInt(e.target.value) || 60})} style={{ padding: '5px', width: '80px', border: '1px solid #7dd3fc', borderRadius: '4px', outline: 'none' }} disabled={!rotation.enabled} />
                  </label>
                </div>

                <h2 style={{ fontSize: '16px', borderBottom: '2px solid #000', paddingBottom: '10px', marginTop: '20px' }}>Customização Visual: Multi-Tema</h2>
                
                <div style={{ padding: '15px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
                    <input type="checkbox" checked={settings.allowAutoMode} onChange={e => setSettings({...settings, allowAutoMode: e.target.checked})} style={{ width: '18px', height: '18px' }} />
                    Habilitar Modo Automático (Sincroniza com o Sistema Operacional do Leitor)
                  </label>
                </div>

                <h3 style={{ fontSize: '14px', marginTop: '10px', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>Configurações Globais (Ambos os Temas)</h3>
                <div style={styles.settingsGrid}>
                  <label style={styles.label}>Tamanho da Fonte Base (p): <input type="text" placeholder="Ex: 1.15rem" value={settings.shared.fontSize} onChange={e => setSettings({...settings, shared: {...settings.shared, fontSize: e.target.value}})} style={styles.textInput} /></label>
                  <label style={styles.label}>Tamanho da Fonte Títulos (H1): <input type="text" placeholder="Ex: 1.8rem" value={settings.shared.titleFontSize} onChange={e => setSettings({...settings, shared: {...settings.shared, titleFontSize: e.target.value}})} style={styles.textInput} /></label>
                  <label style={styles.label}>Família da Fonte: 
                    <select value={settings.shared.fontFamily} onChange={e => setSettings({...settings, shared: {...settings.shared, fontFamily: e.target.value}})} style={styles.textInput}>
                      <option value="sans-serif">Sans-Serif (Estilo Google)</option>
                      <option value="monospace">Monospace</option>
                      <option value="serif">Serif</option>
                      <option value="'Courier New', Courier, monospace">Courier New</option>
                      <option value="'Times New Roman', Times, serif">Times New Roman</option>
                    </select>
                  </label>
                </div>

                <h3 style={{ fontSize: '14px', marginTop: '10px', borderBottom: '1px solid #eee', paddingBottom: '5px', color: '#334155' }}>Paleta Tema Escuro (Dark Mode)</h3>
                <div style={styles.settingsGrid}>
                  <label style={styles.label}>Cor de Fundo: <input type="color" value={settings.dark.bgColor} onChange={e => setSettings({...settings, dark: {...settings.dark, bgColor: e.target.value}})} style={styles.colorInput} /></label>
                  <label style={styles.label}>Cor do Texto Base: <input type="color" value={settings.dark.fontColor} onChange={e => setSettings({...settings, dark: {...settings.dark, fontColor: e.target.value}})} style={styles.colorInput} /></label>
                  <label style={styles.label}>Cor dos Títulos (H1/H2): <input type="color" value={settings.dark.titleColor} onChange={e => setSettings({...settings, dark: {...settings.dark, titleColor: e.target.value}})} style={styles.colorInput} /></label>
                  <label style={styles.label}>Imagem de Fundo (URL): <input type="text" placeholder="https://..." value={settings.dark.bgImage} onChange={e => setSettings({...settings, dark: {...settings.dark, bgImage: e.target.value}})} style={styles.textInput} /></label>
                </div>

                <h3 style={{ fontSize: '14px', marginTop: '10px', borderBottom: '1px solid #eee', paddingBottom: '5px', color: '#f59e0b' }}>Paleta Tema Claro (Light Mode)</h3>
                <div style={styles.settingsGrid}>
                  <label style={styles.label}>Cor de Fundo: <input type="color" value={settings.light.bgColor} onChange={e => setSettings({...settings, light: {...settings.light, bgColor: e.target.value}})} style={styles.colorInput} /></label>
                  <label style={styles.label}>Cor do Texto Base: <input type="color" value={settings.light.fontColor} onChange={e => setSettings({...settings, light: {...settings.light, fontColor: e.target.value}})} style={styles.colorInput} /></label>
                  <label style={styles.label}>Cor dos Títulos (H1/H2): <input type="color" value={settings.light.titleColor} onChange={e => setSettings({...settings, light: {...settings.light, titleColor: e.target.value}})} style={styles.colorInput} /></label>
                  <label style={styles.label}>Imagem de Fundo (URL): <input type="text" placeholder="https://..." value={settings.light.bgImage} onChange={e => setSettings({...settings, light: {...settings.light, bgImage: e.target.value}})} style={styles.textInput} /></label>
                </div>

                <button type="submit" disabled={isSaving} style={styles.adminButton}>{isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} SALVAR CONFIGURAÇÕES GLOBAIS</button>
             </form>
          </div>
        ) : isEditorOpen ? (
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
            <button onClick={() => { setIsEditorOpen(false); fetchData(); }} style={styles.backButton}><ArrowLeft size={16} /> Cancelar</button>
            <form onSubmit={handleSavePost} style={styles.form}>
              <input style={styles.adminInput} placeholder="TÍTULO" value={title} onChange={e => setTitle(e.target.value)} required />
              <div style={styles.editorContainer}>
                <MenuBar editor={editor} secret={secret} showNotification={showNotification} />
                <div style={styles.tiptapWrapper}><EditorContent editor={editor} /></div>
                <div style={styles.statusBar}>
                  {editor ? `${editor.storage.characterCount.characters()} caracteres | ${editor.storage.characterCount.words()} palavras` : ''}
                </div>
              </div>
              <button type="submit" disabled={isSaving} style={styles.adminButton}>{isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} {editingId ? 'ATUALIZAR' : 'CONSOLIDAR'}</button>
            </form>
          </div>
        ) : (
          <div style={styles.list}>
            {posts.map((post, index) => (
              <div key={post.id} draggable onDragStart={(e) => handleDragStart(e, index)} onDragEnd={handleDragEnd} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, index)} style={{ ...styles.postCard, borderLeft: post.is_pinned ? '4px solid #000' : '1px solid #eee' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ cursor: 'grab', color: '#ccc' }} title="Reordenar"><GripVertical size={20} /></div>
                  <div>
                    <div style={styles.cardDate}>{new Date(post.created_at).toLocaleDateString()} {post.is_pinned && <span style={styles.pinnedBadge}>FIXADO</span>}</div>
                    <h2 style={styles.cardTitle}>{post.title}</h2>
                  </div>
                </div>
                <div style={styles.actions}>
                  <button onClick={() => handlePin(post.id)} style={{ ...styles.actionBtnPin, backgroundColor: post.is_pinned ? '#000' : '#f0f0f0', color: post.is_pinned ? '#fff' : '#333' }} title="Fixar/Desafixar"><Pin size={16} /></button>
                  <button onClick={() => openEditor(post)} style={styles.actionBtnEdit} title="Editar"><Edit3 size={16} /></button>
                  <button onClick={() => setModal({ show: true, id: post.id })} style={styles.actionBtnDelete} title="Excluir"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
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