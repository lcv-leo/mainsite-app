// Módulo: mainsite-admin/src/components/EditorPanel.jsx
// Versão: v1.2.0
// Descrição: Editor Tiptap integrado às classes globais de UI (modalOverlay/modalContent) e estética MD3.

import React, { useState, useRef } from 'react';
import { Extension } from '@tiptap/core';
import { useEditor, EditorContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
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
  CheckSquare, Palette, Type, WrapText, Upload, Sparkles, Image as ImageIcon, Youtube, ZoomIn, ZoomOut,
  MessageSquare
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

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const ResizableMediaHandle = ({ onStartResize }) => (
  <button
    type="button"
    className="media-resize-handle"
    contentEditable={false}
    onMouseDown={onStartResize}
    onPointerDown={onStartResize}
    title="Arraste para redimensionar"
    aria-label="Arraste para redimensionar"
  />
);

const IMAGE_SNAPS = [
  { label: '25%', v: '25%' },
  { label: '50%', v: '50%' },
  { label: '75%', v: '75%' },
  { label: '100%', v: '100%' },
];

const MediaSnapBar = ({ onSnap }) => (
  <div className="media-snap-bar" contentEditable={false} onMouseDown={e => e.preventDefault()}>
    {IMAGE_SNAPS.map(({ label, v }) => (
      <button key={v} type="button" onClick={() => onSnap(v)} title={v}>{label}</button>
    ))}
  </div>
);

const VIDEO_SNAPS = [
  { label: '480p', w: 853, h: 480 },
  { label: '720p', w: 1280, h: 720 },
  { label: '840px', w: 840, h: 472 },
];

const YoutubeSnapBar = ({ onSnap }) => (
  <div className="media-snap-bar" contentEditable={false} onMouseDown={e => e.preventDefault()}>
    {VIDEO_SNAPS.map(({ label, w, h }) => (
      <button key={label} type="button" onClick={() => onSnap(w, h)} title={`${w}×${h}`}>{label}</button>
    ))}
  </div>
);

const ResizableImageNodeView = ({ node, updateAttributes, selected }) => {
  const startXRef = useRef(0);
  const startWidthRef = useRef(100);

  const onStartResize = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const point = event.touches?.[0] || event;
    startXRef.current = point.clientX;
    startWidthRef.current = Number(String(node.attrs.width || '100').replace('%', '')) || 100;

    const onMove = (moveEvent) => {
      const p = moveEvent.touches?.[0] || moveEvent;
      const deltaX = p.clientX - startXRef.current;
      const next = clamp(Math.round(startWidthRef.current + (deltaX * 0.22)), 20, 100);
      updateAttributes({ width: `${next}%` });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);
  };

  return (
    <NodeViewWrapper
      className={`resizable-media media-image ${selected ? 'is-selected' : ''}`}
      contentEditable={false}
      style={{ width: node.attrs.width || '100%' }}
    >
      <MediaSnapBar onSnap={(size) => updateAttributes({ width: size })} />
      <img src={node.attrs.src} alt={node.attrs.alt || ''} title={node.attrs.title || ''} draggable="false" />
      <ResizableMediaHandle onStartResize={onStartResize} />
    </NodeViewWrapper>
  );
};

const ResizableYoutubeNodeView = ({ node, updateAttributes, selected }) => {
  const startXRef = useRef(0);
  const startWidthRef = useRef(840);
  const currentW = Number(node.attrs.width) || 840;
  const currentH = Number(node.attrs.height) || Math.round((currentW * 9) / 16);

  const onStartResize = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const point = event.touches?.[0] || event;
    startXRef.current = point.clientX;
    startWidthRef.current = currentW;

    const onMove = (moveEvent) => {
      const p = moveEvent.touches?.[0] || moveEvent;
      const deltaX = p.clientX - startXRef.current;
      const nextW = clamp(Math.round(startWidthRef.current + (deltaX * 1.2)), 320, 1200);
      const nextH = Math.round((nextW * 9) / 16);
      updateAttributes({ width: nextW, height: nextH });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);
  };

  return (
    <NodeViewWrapper className={`resizable-media media-youtube ${selected ? 'is-selected' : ''}`} contentEditable={false} style={{ width: `${currentW}px`, maxWidth: '100%' }}>
      <YoutubeSnapBar onSnap={(w, h) => updateAttributes({ width: w, height: h })} />
      <div data-youtube-video>
        <iframe
          src={node.attrs.src}
          width={currentW}
          height={currentH}
          title="YouTube video"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <ResizableMediaHandle onStartResize={onStartResize} />
    </NodeViewWrapper>
  );
};

const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: '100%',
        parseHTML: (element) => element.getAttribute('data-width') || element.style.width || element.getAttribute('width') || '100%',
        renderHTML: (attributes) => {
          if (!attributes.width) return {};
          const normalized = String(attributes.width).endsWith('%') ? attributes.width : `${attributes.width}`;
          return {
            'data-width': normalized,
            style: `width: ${normalized}; height: auto;`,
          };
        },
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageNodeView);
  },
});

const ResizableYoutube = YoutubeExtension.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ResizableYoutubeNodeView);
  },
});

const MenuBar = ({ editor, secret, showNotification, API_URL, styles }) => {
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [promptModal, setPromptModal] = useState({ show: false, title: '', placeholder: 'https://...', value: '', callback: null, isLink: false, linkText: '', showCaption: false, caption: '' });

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

  const insertCaptionBlock = (caption) => {
    const safeCaption = (caption || '').trim();
    if (!safeCaption) return;
    editor.chain().focus().insertContent({
      type: 'paragraph',
      attrs: { textAlign: 'center' },
      content: [{ type: 'text', text: safeCaption, marks: [{ type: 'italic' }] }],
    }).run();
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
      editor.chain().focus().setImage({ src: data.url, width: '100%' }).run();
      showNotification("Upload concluído com sucesso.", "success");
      setPromptModal({
        show: true,
        title: 'Legenda da imagem (opcional):',
        placeholder: 'Ex.: Foto tirada em março de 2026',
        value: '',
        isLink: false,
        linkText: '',
        showCaption: false,
        caption: '',
        callback: (captionText) => insertCaptionBlock(captionText),
      });
    } catch (err) { showNotification(err.message, "error"); }
    finally { setIsUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const addImageUrl = () => {
    setPromptModal({
      show: true,
      title: 'URL da Imagem (Drive/Externa):',
      value: '',
      showCaption: true,
      caption: '',
      callback: (url, _text, caption) => {
        if (!url) return;
        editor.chain().focus().setImage({ src: formatImageUrl(url), width: '100%' }).run();
        insertCaptionBlock(caption);
      }
    });
  };

  const addYoutube = () => {
    setPromptModal({
      show: true,
      title: 'URL do vídeo (YouTube):',
      value: '',
      showCaption: true,
      caption: '',
      callback: (url, _text, caption) => {
        if (!url) return;
        editor.chain().focus().setYoutubeVideo({ src: url, width: 840, height: 472 }).run();
        insertCaptionBlock(caption);
      }
    });
  };

  const addLink = () => {
    const prev = editor.getAttributes('link').href || '';
    setPromptModal({
      show: true, title: 'Inserir Link de Hipertexto:', value: prev, isLink: true, linkText: '', showCaption: false, caption: '', callback: (url, text) => {
        if (url === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
        if (editor.state.selection.empty && text) { editor.chain().focus().insertContent(`<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`).run(); }
        else { editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run(); }
      }
    });
  };

  const adjustSelectedMediaSize = (direction) => {
    if (editor.isActive('image')) {
      const attrs = editor.getAttributes('image');
      const current = Number(String(attrs.width || '100').replace('%', '')) || 100;
      const next = clamp(current + (direction * 10), 20, 100);
      editor.chain().focus().updateAttributes('image', { width: `${next}%` }).run();
      showNotification(`Imagem redimensionada para ${next}%`, 'success');
      return;
    }

    if (editor.isActive('youtube')) {
      const attrs = editor.getAttributes('youtube');
      const currentW = Number(attrs.width) || 840;
      const nextW = clamp(currentW + (direction * 80), 320, 1200);
      const nextH = Math.round((nextW * 9) / 16);
      editor.chain().focus().updateAttributes('youtube', { width: nextW, height: nextH }).run();
      showNotification(`Vídeo redimensionado para ${nextW}x${nextH}`, 'success');
      return;
    }

    showNotification('Selecione uma imagem ou vídeo para redimensionar.', 'info');
  };

  const editCaption = () => {
    const isImg = editor.isActive('image');
    const isVid = editor.isActive('youtube');
    if (!isImg && !isVid) {
      showNotification('Selecione uma imagem ou vídeo para adicionar/editar a legenda.', 'info');
      return;
    }

    const { selection, doc } = editor.state;
    const nodeSize = selection.node?.nodeSize || 1;
    const nodeEnd = selection.from + nodeSize;

    // Detecta se já existe uma legenda imediatamente após a mídia
    let existingCaption = '';
    let captionFrom = null;
    let captionTo = null;
    const nextNode = doc.nodeAt(nodeEnd);
    if (nextNode && nextNode.type.name === 'paragraph' && nextNode.attrs?.textAlign === 'center' && nextNode.textContent) {
      let hasItalic = false;
      nextNode.forEach(child => {
        if (child.isText && child.marks.some(m => m.type.name === 'italic')) hasItalic = true;
      });
      if (hasItalic) {
        existingCaption = nextNode.textContent;
        captionFrom = nodeEnd;
        captionTo = nodeEnd + nextNode.nodeSize;
      }
    }

    setPromptModal({
      show: true,
      title: existingCaption ? 'Editar legenda da mídia:' : 'Adicionar legenda à mídia:',
      placeholder: 'Texto da legenda...',
      value: existingCaption,
      isLink: false,
      linkText: '',
      showCaption: false,
      caption: '',
      callback: (text) => {
        const trimmed = (text || '').trim();
        if (captionFrom !== null) {
          // Substitui legenda existente
          const tr = editor.state.tr.delete(captionFrom, captionTo);
          editor.view.dispatch(tr);
          if (trimmed) {
            editor.commands.insertContentAt(captionFrom, {
              type: 'paragraph',
              attrs: { textAlign: 'center' },
              content: [{ type: 'text', text: trimmed, marks: [{ type: 'italic' }] }],
            });
          }
        } else if (trimmed) {
          editor.commands.setTextSelection(nodeEnd);
          insertCaptionBlock(trimmed);
        }
      },
    });
  };

  const getActiveStyle = (isActive) => ({
    ...styles.toolbarBtn,
    background: isActive ? 'rgba(128, 128, 128, 0.22)' : 'transparent',
    borderRadius: '12px'
  });

  return (
    <div style={styles.toolbar}>
      {promptModal.show && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={{ margin: '0 0 24px 0', fontSize: 'var(--type-label)', fontWeight: '700', textTransform: 'uppercase', borderBottom: '1px solid rgba(128,128,128,0.2)', paddingBottom: '12px', letterSpacing: '0.5px' }}>{promptModal.title}</h3>
            <input autoFocus type="text" placeholder={promptModal.placeholder || 'https://...'} value={promptModal.value} onChange={e => setPromptModal({ ...promptModal, value: e.target.value })} style={styles.textInput} />
            {promptModal.isLink && editor.state.selection.empty && (
              <input type="text" placeholder="Texto de exibição (opcional)" value={promptModal.linkText} onChange={e => setPromptModal({ ...promptModal, linkText: e.target.value })} style={{ ...styles.textInput, marginTop: '16px' }} />
            )}
            {promptModal.showCaption && (
              <input type="text" placeholder="Legenda (opcional)" value={promptModal.caption} onChange={e => setPromptModal({ ...promptModal, caption: e.target.value })} style={{ ...styles.textInput, marginTop: '16px' }} />
            )}
            <div style={{ ...styles.modalActions, marginTop: '24px' }}>
              <button type="button" onClick={() => setPromptModal({ show: false })} style={styles.modalBtnCancel}>CANCELAR</button>
              <button type="button" onClick={() => { promptModal.callback(promptModal.value, promptModal.linkText, promptModal.caption); setPromptModal({ show: false }); }} style={styles.modalBtnConfirm}>INSERIR</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(2, 132, 199, 0.1)', padding: '6px 12px', borderRadius: '100px', border: '1px solid rgba(2, 132, 199, 0.3)', marginRight: '10px' }} title="Inteligência Artificial (Gemini 2.5 Pro)">
        <Sparkles size={16} color="#0284c7" />
        <select name="ai-action" onChange={(e) => { if (e.target.value) { handleAITransform(e.target.value); e.target.value = ''; } }} style={{ fontSize: '12px', padding: '2px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#0284c7', fontWeight: '800' }} disabled={isGeneratingAI}>
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
      <button type="button" title="Reduzir mídia selecionada" onClick={() => adjustSelectedMediaSize(-1)} style={styles.toolbarBtn}><ZoomOut size={16} /></button>
      <button type="button" title="Aumentar mídia selecionada" onClick={() => adjustSelectedMediaSize(1)} style={styles.toolbarBtn}><ZoomIn size={16} /></button>
      <button type="button" title="Adicionar/editar legenda da mídia selecionada" onClick={editCaption} style={{ ...styles.toolbarBtn, opacity: (editor.isActive('image') || editor.isActive('youtube')) ? 1 : 0.4 }}><MessageSquare size={16} /></button>

      <div style={styles.toolbarDivider}></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 8px' }}>
        <Palette size={16} /><input name="text-color" type="color" onInput={event => editor.chain().focus().setColor(event.target.value).run()} value={editor.getAttributes('textStyle').color || '#000000'} style={{ cursor: 'pointer', padding: 0, border: 'none', width: '28px', height: '28px', background: 'transparent', borderRadius: '10px' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 8px' }}>
        <Type size={16} /><select name="font-family" onChange={e => editor.chain().focus().setFontFamily(e.target.value).run()} value={editor.getAttributes('textStyle').fontFamily || 'inherit'} style={{ fontSize: '13px', padding: '4px', background: 'transparent', color: 'inherit', border: 'none', fontWeight: '600' }}><option value="inherit">Padrão</option><option value="monospace">Monospace</option><option value="Arial">Arial</option><option value="'Times New Roman', Times, serif">Times</option></select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 8px' }}>
        <select name="font-size" onChange={e => editor.chain().focus().setFontSize(e.target.value).run()} value={editor.getAttributes('textStyle').fontSize || ''} style={{ fontSize: '13px', padding: '4px', background: 'transparent', color: 'inherit', border: 'none', fontWeight: '600' }}><option value="">Tam.</option><option value="12px">12px</option><option value="14px">14px</option><option value="16px">16px</option><option value="18px">18px</option><option value="20px">20px</option><option value="24px">24px</option><option value="30px">30px</option></select>
      </div>
    </div>
  );
};

const STATIC_EXTENSIONS = [
  StarterKit.configure({ dropcursor: false }), Markdown, Underline, Highlight, Subscript, Superscript, TextStyle, Color, FontFamily, FontSize, Typography,
  TextAlign.configure({ types: ['heading', 'paragraph'], defaultAlignment: 'justify' }),
  ResizableImage.configure({ inline: false }),
  ResizableYoutube.configure({ inline: false, width: 840, height: 472.5 }),
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