// Módulo: mainsite-admin/src/components/EditorPanel.jsx
// Versão: v1.2.0
// Descrição: Editor Tiptap integrado às classes globais de UI (modalOverlay/modalContent) e estética MD3.

import React, { useState, useRef } from 'react';
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

import {
  Save, Loader2, ArrowLeft, Bold, Italic, Strikethrough, Heading1, Heading2, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Link as LinkIcon, Unlink, Underline as UnderlineIcon,
  Highlighter, Subscript as SubIcon, Superscript as SuperIcon, Quote, Minus, Code, Table as TableIcon,
  CheckSquare, Palette, Type, WrapText, Upload, Sparkles, Image as ImageIcon, Youtube
} from 'lucide-react';

const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() { return { types: ['textStyle'] }; },
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
  if (match && match[1]) return `https://drive.google.com/uc?export=view&id=${match[1]}`;
  return url;
};

const MenuBar = ({ editor, secret, showNotification, API_URL, styles }) => {
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [promptModal, setPromptModal] = useState({ show: false, title: '', value: '', callback: null, isLink: false, linkText: '' });

  if (!editor) return null;

  const handleAITransform = async (action) => {
    const { from, to, empty } = editor.state.selection;
    if (empty) { showNotification("Por favor, selecione um trecho de texto no editor para aplicar a IA.", "error"); return; }

    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    setIsGeneratingAI(true);
    showNotification("Processando transformação textual no Gemini...", "info");

    try {
      const res = await fetch(`${API_URL}/ai/transform`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${secret}` },
        body: JSON.stringify({ action, text: selectedText })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro na geração por IA.");
      editor.chain().focus().deleteSelection().insertContent(data.text).run();
      showNotification("Transformação aplicada.", "success");
    } catch (err) { showNotification(err.message, "error"); }
    finally { setIsGeneratingAI(false); }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setIsUploading(true); showNotification("Enviando arquivo para o Cloudflare R2...", "info");
    const formData = new FormData(); formData.append('file', file);
    try {
      const res = await fetch(`${API_URL}/upload`, { method: 'POST', headers: { 'Authorization': `Bearer ${secret}` }, body: formData });
      if (!res.ok) throw new Error("Falha na consolidação do arquivo.");
      const data = await res.json();
      editor.chain().focus().setImage({ src: data.url }).run();
      showNotification("Upload concluído com sucesso.", "success");
    } catch (err) { showNotification(err.message, "error"); }
    finally { setIsUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const addImageUrl = () => { setPromptModal({ show: true, title: 'URL da Imagem (Drive/Externa):', value: '', callback: (url) => { if (url) editor.chain().focus().setImage({ src: formatImageUrl(url) }).run(); } }); };
  const addYoutube = () => { setPromptModal({ show: true, title: 'URL do vídeo (YouTube):', value: '', callback: (url) => { if (url) editor.chain().focus().setYoutubeVideo({ src: url }).run(); } }); };
  const addLink = () => {
    const prev = editor.getAttributes('link').href || '';
    setPromptModal({
      show: true, title: 'Inserir Link de Hipertexto:', value: prev, isLink: true, linkText: '', callback: (url, text) => {
        if (url === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
        if (editor.state.selection.empty && text) { editor.chain().focus().insertContent(`<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`).run(); }
        else { editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run(); }
      }
    });
  };

  const getActiveStyle = (isActive) => ({
    ...styles.toolbarBtn,
    background: isActive ? 'rgba(128, 128, 128, 0.3)' : 'transparent',
    borderRadius: '12px'
  });

  return (
    <div style={styles.toolbar}>
      {promptModal.show && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={{ margin: '0 0 24px 0', fontSize: '16px', fontWeight: '700', textTransform: 'uppercase', borderBottom: '1px solid rgba(128,128,128,0.2)', paddingBottom: '12px', letterSpacing: '0.5px' }}>{promptModal.title}</h3>
            <input autoFocus type="text" placeholder="https://..." value={promptModal.value} onChange={e => setPromptModal({ ...promptModal, value: e.target.value })} style={styles.textInput} />
            {promptModal.isLink && editor.state.selection.empty && (
              <input type="text" placeholder="Texto de exibição (opcional)" value={promptModal.linkText} onChange={e => setPromptModal({ ...promptModal, linkText: e.target.value })} style={{ ...styles.textInput, marginTop: '16px' }} />
            )}
            <div style={{ ...styles.modalActions, marginTop: '24px' }}>
              <button type="button" onClick={() => setPromptModal({ show: false })} style={styles.modalBtnCancel}>CANCELAR</button>
              <button type="button" onClick={() => { promptModal.callback(promptModal.value, promptModal.linkText); setPromptModal({ show: false }); }} style={styles.modalBtnConfirm}>INSERIR</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(2, 132, 199, 0.1)', padding: '6px 12px', borderRadius: '100px', border: '1px solid rgba(2, 132, 199, 0.3)', marginRight: '10px' }} title="Inteligência Artificial (Gemini 2.5 Pro)">
        <Sparkles size={16} color="#0284c7" />
        <select onChange={(e) => { if (e.target.value) { handleAITransform(e.target.value); e.target.value = ''; } }} style={{ fontSize: '12px', padding: '2px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#0284c7', fontWeight: '800', outline: 'none' }} disabled={isGeneratingAI}>
          <option value="">{isGeneratingAI ? 'Processando...' : 'IA: Aprimorar Texto'}</option><option value="grammar">Corrigir Gramática</option><option value="summarize">Resumir Seleção</option><option value="expand">Expandir Conteúdo</option><option value="formal">Tornar Formal</option>
        </select>
      </div>

      <div style={styles.toolbarDivider}></div>
      <button type="button" title="Negrito" onClick={() => editor.chain().focus().toggleBold().run()} style={getActiveStyle(editor.isActive('bold'))}><Bold size={16} /></button>
      <button type="button" title="Itálico" onClick={() => editor.chain().focus().toggleItalic().run()} style={getActiveStyle(editor.isActive('italic'))}><Italic size={16} /></button>
      <button type="button" title="Sublinhado" onClick={() => editor.chain().focus().toggleUnderline().run()} style={getActiveStyle(editor.isActive('underline'))}><UnderlineIcon size={16} /></button>
      <button type="button" title="Tachado" onClick={() => editor.chain().focus().toggleStrike().run()} style={getActiveStyle(editor.isActive('strike'))}><Strikethrough size={16} /></button>
      <button type="button" title="Marca-texto" onClick={() => editor.chain().focus().toggleHighlight().run()} style={{ ...styles.toolbarBtn, borderRadius: '12px', background: editor.isActive('highlight') ? 'rgba(255, 204, 0, 0.5)' : 'transparent' }}><Highlighter size={16} /></button>

      <div style={styles.toolbarDivider}></div>
      <button type="button" title="Subscrito" onClick={() => editor.chain().focus().toggleSubscript().run()} style={getActiveStyle(editor.isActive('subscript'))}><SubIcon size={16} /></button>
      <button type="button" title="Sobrescrito" onClick={() => editor.chain().focus().toggleSuperscript().run()} style={getActiveStyle(editor.isActive('superscript'))}><SuperIcon size={16} /></button>
      <button type="button" title="Bloco de Código" onClick={() => editor.chain().focus().toggleCodeBlock().run()} style={getActiveStyle(editor.isActive('codeBlock'))}><Code size={16} /></button>
      <button type="button" title="Citação em Bloco" onClick={() => editor.chain().focus().toggleBlockquote().run()} style={getActiveStyle(editor.isActive('blockquote'))}><Quote size={16} /></button>

      <div style={styles.toolbarDivider}></div>
      <button type="button" title="Esquerda" onClick={() => editor.chain().focus().setTextAlign('left').run()} style={getActiveStyle(editor.isActive({ textAlign: 'left' }))}><AlignLeft size={16} /></button>
      <button type="button" title="Centralizar" onClick={() => editor.chain().focus().setTextAlign('center').run()} style={getActiveStyle(editor.isActive({ textAlign: 'center' }))}><AlignCenter size={16} /></button>
      <button type="button" title="Direita" onClick={() => editor.chain().focus().setTextAlign('right').run()} style={getActiveStyle(editor.isActive({ textAlign: 'right' }))}><AlignRight size={16} /></button>
      <button type="button" title="Justificar" onClick={() => editor.chain().focus().setTextAlign('justify').run()} style={getActiveStyle(editor.isActive({ textAlign: 'justify' }))}><AlignJustify size={16} /></button>

      <div style={styles.toolbarDivider}></div>
      <button type="button" title="Título 1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} style={getActiveStyle(editor.isActive('heading', { level: 1 }))}><Heading1 size={16} /></button>
      <button type="button" title="Título 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} style={getActiveStyle(editor.isActive('heading', { level: 2 }))}><Heading2 size={16} /></button>
      <button type="button" title="Marcadores" onClick={() => editor.chain().focus().toggleBulletList().run()} style={getActiveStyle(editor.isActive('bulletList'))}><List size={16} /></button>
      <button type="button" title="Numeração" onClick={() => editor.chain().focus().toggleOrderedList().run()} style={getActiveStyle(editor.isActive('orderedList'))}><ListOrdered size={16} /></button>
      <button type="button" title="Tarefas" onClick={() => editor.chain().focus().toggleTaskList().run()} style={getActiveStyle(editor.isActive('taskList'))}><CheckSquare size={16} /></button>
      <button type="button" title="Linha" onClick={() => editor.chain().focus().setHorizontalRule().run()} style={styles.toolbarBtn}><Minus size={16} /></button>
      <button type="button" title="Tabela" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} style={styles.toolbarBtn}><TableIcon size={16} /></button>
      <button type="button" title="Quebra" onClick={() => editor.chain().focus().setHardBreak().run()} style={styles.toolbarBtn}><WrapText size={16} /></button>

      <div style={styles.toolbarDivider}></div>
      <button type="button" title="Link" onClick={addLink} style={getActiveStyle(editor.isActive('link'))}><LinkIcon size={16} /></button>
      <button type="button" title="Remover Link" onClick={() => editor.chain().focus().unsetLink().run()} disabled={!editor.isActive('link')} style={{ ...styles.toolbarBtn, opacity: editor.isActive('link') ? 1 : 0.5 }}><Unlink size={16} /></button>

      <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} style={{ display: 'none' }} />
      <button type="button" title="Upload" onClick={() => fileInputRef.current.click()} disabled={isUploading} style={{ ...styles.toolbarBtn, opacity: isUploading ? 0.5 : 1 }}><Upload size={16} /></button>
      <button type="button" title="Img URL" onClick={addImageUrl} style={styles.toolbarBtn}><ImageIcon size={16} /></button>
      <button type="button" title="YouTube" onClick={addYoutube} style={styles.toolbarBtn}><Youtube size={16} /></button>

      <div style={styles.toolbarDivider}></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 8px' }}>
        <Palette size={16} /><input type="color" onInput={event => editor.chain().focus().setColor(event.target.value).run()} value={editor.getAttributes('textStyle').color || '#000000'} style={{ cursor: 'pointer', padding: 0, border: 'none', width: '28px', height: '28px', background: 'transparent' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 8px' }}>
        <Type size={16} /><select onChange={e => editor.chain().focus().setFontFamily(e.target.value).run()} value={editor.getAttributes('textStyle').fontFamily || 'inherit'} style={{ fontSize: '13px', padding: '4px', background: 'transparent', color: 'inherit', border: 'none', outline: 'none', fontWeight: '600' }}><option value="inherit">Padrão</option><option value="monospace">Monospace</option><option value="Arial">Arial</option><option value="'Times New Roman', Times, serif">Times</option></select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 8px' }}>
        <select onChange={e => editor.chain().focus().setFontSize(e.target.value).run()} value={editor.getAttributes('textStyle').fontSize || ''} style={{ fontSize: '13px', padding: '4px', background: 'transparent', color: 'inherit', border: 'none', outline: 'none', fontWeight: '600' }}><option value="">Tam.</option><option value="12px">12px</option><option value="14px">14px</option><option value="16px">16px</option><option value="18px">18px</option><option value="20px">20px</option><option value="24px">24px</option><option value="30px">30px</option></select>
      </div>
    </div>
  );
};

const STATIC_EXTENSIONS = [
  StarterKit.configure({ dropcursor: false }), Markdown, Underline, Highlight, Subscript, Superscript, TextStyle, Color, FontFamily, FontSize, Typography,
  TextAlign.configure({ types: ['heading', 'paragraph'], defaultAlignment: 'justify' }),
  Image.configure({ inline: true }),
  YoutubeExtension.configure({ inline: false, width: 840, height: 472.5 }),
  Table.configure({ resizable: true }), TableRow, TableHeader, TableCell,
  TaskList, TaskItem.configure({ nested: true }),
  Dropcursor.configure({ color: '#ff0000', width: 2 }),
  CharacterCount,
  Placeholder.configure({ placeholder: 'O fluxo da consciência (Aceita Markdown na colagem)...' }),
  LinkExtension.configure({ openOnClick: false, autolink: true, HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' } })
];

const EditorPanel = ({ post, isSaving, onSave, onCancel, secret, showNotification, styles, API_URL }) => {
  const [title, setTitle] = useState(post ? post.title : '');

  React.useEffect(() => {
    const originalWarn = console.warn;
    console.warn = (...args) => {
      if (typeof args[0] === 'string' && args[0].includes('Duplicate extension names found')) return;
      originalWarn(...args);
    };
    return () => { console.warn = originalWarn; };
  }, []);

  const editor = useEditor({
    extensions: STATIC_EXTENSIONS,
    content: post ? post.content : '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!editor) return;
    onSave({ id: post ? post.id : null, title, content: editor.getHTML() });
  };

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      <button onClick={onCancel} style={styles.backButton}><ArrowLeft size={16} /> Cancelar Edição</button>
      <form onSubmit={handleSubmit} style={styles.form}>
        <input style={styles.adminInput} placeholder="TÍTULO DO FRAGMENTO" value={title} onChange={e => setTitle(e.target.value)} required />
        <div style={styles.editorContainer}>
          <MenuBar editor={editor} secret={secret} showNotification={showNotification} API_URL={API_URL} styles={styles} />
          <div style={styles.tiptapWrapper}><EditorContent editor={editor} /></div>
          <div style={styles.statusBar}>
            {editor ? `${editor.storage.characterCount.characters()} caracteres | ${editor.storage.characterCount.words()} palavras` : ''}
          </div>
        </div>
        <button type="submit" disabled={isSaving} style={styles.adminButton}>
          {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          {post ? 'ATUALIZAR FRAGMENTO' : 'CONSOLIDAR FRAGMENTO'}
        </button>
      </form>
    </div>
  );
};

export default EditorPanel;