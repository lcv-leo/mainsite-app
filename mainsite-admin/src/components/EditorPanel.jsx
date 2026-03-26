// Módulo: mainsite-admin/src/components/EditorPanel.jsx
// Versão: v1.2.0
// Descrição: Editor Tiptap integrado às classes globais de UI (modalOverlay/modalContent) e estética MD3.

import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Extension } from '@tiptap/core';
import { useEditor, EditorContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { NodeSelection } from 'prosemirror-state';
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
import { Focus } from '@tiptap/extension-focus';
import { Markdown } from 'tiptap-markdown';

import {
  Save, Loader2, ArrowLeft, Bold, Italic, Strikethrough, Heading1, Heading2, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Link as LinkIcon, Unlink, Underline as UnderlineIcon,
  Highlighter, Subscript as SubIcon, Superscript as SuperIcon, Quote, Minus, Code, Table as TableIcon,
  CheckSquare, Palette, Type, WrapText, Upload, Sparkles, Image as ImageIcon, Youtube, ZoomIn, ZoomOut,
  MessageSquare, MousePointer2, Heading1 as H1Icon, Heading2 as H2Icon, Heading3, ListChecks, LayoutGrid,
  PilcrowSquare, CornerDownLeft, Indent, Outdent, X, Eraser, Wand2, Send
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

// Extensão customizada: recuo de primeira linha (text-indent) como atributo de parágrafo
const INDENT_LEVELS = ['0', '1.5rem', '2.5rem', '3.5rem'];
const TextIndent = Extension.create({
  name: 'textIndent',
  addGlobalAttributes() {
    return [{
      types: ['paragraph'],
      attributes: {
        textIndent: {
          default: null,
          parseHTML: element => {
            const val = element.style.textIndent;
            return val && val !== '0px' && val !== '0' ? val : null;
          },
          renderHTML: attributes => {
            if (!attributes.textIndent) return {};
            return { style: `text-indent: ${attributes.textIndent}` };
          },
        },
      },
    }];
  },
  addCommands() {
    return {
      // Avança para o próximo nível de recuo
      increaseIndent: () => ({ tr, state, dispatch }) => {
        const { from, to } = state.selection;
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (node.type.name === 'paragraph') {
            const current = node.attrs.textIndent || '0';
            const idx = INDENT_LEVELS.indexOf(current);
            const next = INDENT_LEVELS[Math.min(idx + 1, INDENT_LEVELS.length - 1)];
            if (dispatch) tr.setNodeMarkup(pos, undefined, { ...node.attrs, textIndent: next === '0' ? null : next });
          }
        });
        return true;
      },
      // Recua para o nível anterior de recuo
      decreaseIndent: () => ({ tr, state, dispatch }) => {
        const { from, to } = state.selection;
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (node.type.name === 'paragraph') {
            const current = node.attrs.textIndent || '0';
            const idx = INDENT_LEVELS.indexOf(current);
            const next = idx <= 0 ? '0' : INDENT_LEVELS[idx - 1];
            if (dispatch) tr.setNodeMarkup(pos, undefined, { ...node.attrs, textIndent: next === '0' ? null : next });
          }
        });
        return true;
      },
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

const ResizableMediaHandle = ({ onStartResize, tone = 'neutral' }) => (
  <button
    type="button"
    className={`media-resize-handle tone-${tone}`}
    contentEditable={false}
    onMouseDown={onStartResize}
    onPointerDown={onStartResize}
    title="Arraste para redimensionar"
    aria-label="Arraste para redimensionar"
  />
);

const SelectMediaButton = ({ onSelect }) => (
  <button
    type="button"
    className="media-select-btn"
    contentEditable={false}
    onMouseDown={(e) => {
      e.preventDefault();
      e.stopPropagation();
      onSelect();
    }}
    onPointerDown={(e) => {
      e.preventDefault();
      e.stopPropagation();
      onSelect();
    }}
    title="Selecionar mídia"
    aria-label="Selecionar mídia"
  >
    <MousePointer2 size={13} className="media-select-btn-icon" />
    <span className="media-select-btn-label">Selecionar</span>
  </button>
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

const ResizableImageNodeView = ({ node, updateAttributes, selected, editor, getPos }) => {
  const startXRef = useRef(0);
  const startWidthRef = useRef(100);
  const imageRef = useRef(null);
  const [localTone, setLocalTone] = useState('neutral');

  useEffect(() => {
    const img = imageRef.current;
    if (!img) return;

    const analyzeTone = () => {
      try {
        const sample = 24;
        const canvas = document.createElement('canvas');
        canvas.width = sample;
        canvas.height = sample;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          setLocalTone('neutral');
          return;
        }

        ctx.drawImage(img, 0, 0, sample, sample);
        const { data } = ctx.getImageData(0, 0, sample, sample);
        let total = 0;
        let count = 0;

        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 32) continue;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          total += (0.299 * r) + (0.587 * g) + (0.114 * b);
          count += 1;
        }

        if (!count) {
          setLocalTone('neutral');
          return;
        }

        const luma = (total / count) / 255;
        setLocalTone(luma >= 0.56 ? 'light' : 'dark');
      } catch {
        // Fallback para imagens sem CORS permitido (canvas tainted)
        setLocalTone('neutral');
      }
    };

    if (img.complete) analyzeTone();
    img.addEventListener('load', analyzeTone);
    return () => img.removeEventListener('load', analyzeTone);
  }, [node.attrs.src]);

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

  const selectCurrentNode = () => {
    const pos = getPos?.();
    if (typeof pos !== 'number') return;
    const tr = editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos));
    editor.view.dispatch(tr);
    editor.commands.focus();
  };

  return (
    <NodeViewWrapper
      className={`resizable-media media-image tone-${localTone} ${selected ? 'is-selected' : ''}`}
      contentEditable={false}
      style={{ width: node.attrs.width || '100%' }}
    >
      <MediaSnapBar onSnap={(size) => updateAttributes({ width: size })} />
      <SelectMediaButton onSelect={selectCurrentNode} />
      <img ref={imageRef} crossOrigin="anonymous" src={node.attrs.src} alt={node.attrs.alt || ''} title={node.attrs.title || ''} draggable="false" />
      <ResizableMediaHandle onStartResize={onStartResize} tone={localTone} />
    </NodeViewWrapper>
  );
};

const ResizableYoutubeNodeView = ({ node, updateAttributes, selected, editor, getPos }) => {
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

  const selectCurrentNode = () => {
    const pos = getPos?.();
    if (typeof pos !== 'number') return;
    const tr = editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos));
    editor.view.dispatch(tr);
    editor.commands.focus();
  };

  return (
    <NodeViewWrapper className={`resizable-media media-youtube ${selected ? 'is-selected' : ''}`} contentEditable={false} style={{ width: `${currentW}px`, maxWidth: '100%' }}>
      <YoutubeSnapBar onSnap={(w, h) => updateAttributes({ width: w, height: h })} />
      <SelectMediaButton onSelect={selectCurrentNode} />
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
      <ResizableMediaHandle onStartResize={onStartResize} tone="neutral" />
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

const MenuBar = ({ editor, editorReady, secret, showNotification, API_URL, styles, isDarkBase, activePalette }) => {
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  // Force re-render on every editor transaction so getActiveStyle() reads fresh isActive() values
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const onTransaction = () => { try { if (editor.view?.dom) setTick(t => t + 1); } catch { /* view not ready */ } };
    editor.on('transaction', onTransaction);
    return () => editor.off('transaction', onTransaction);
  }, [editor]);
  const [promptModal, setPromptModal] = useState({ show: false, title: '', placeholder: 'https://...', value: '', callback: null, isLink: false, linkText: '', showCaption: false, caption: '' });
  // AI Freeform Command
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [aiChatInput, setAiChatInput] = useState('');
  const aiChatBtnRef = useRef(null);

  if (!editor || !editorReady) return null;

  const handleAIFreeform = async () => {
    const instruction = aiChatInput.trim();
    if (!instruction) return;
    const { from, to, empty } = editor.state.selection;
    const text = empty ? editor.getHTML() : editor.state.doc.textBetween(from, to, ' ');
    if (!text) { showNotification('O editor está vazio.', 'error'); return; }
    setIsGeneratingAI(true);
    setAiChatOpen(false);
    showNotification('Gemini está processando sua instrução...', 'info');
    try {
      const res = await fetch(`${API_URL}/ai/transform`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${secret}` },
        body: JSON.stringify({ action: 'freeform', text, instruction })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro na geração por IA.');
      if (empty) {
        editor.commands.setContent(data.text);
      } else {
        editor.chain().focus().deleteSelection().insertContent(data.text).run();
      }
      showNotification('Instrução aplicada com sucesso.', 'success');
      setAiChatInput('');
    } catch (err) { showNotification(err.message, 'error'); }
    finally { setIsGeneratingAI(false); }
  };

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

  const tbIdleBg = isDarkBase ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)';
  const tbActiveFg = activePalette?.titleColor || '#aa3bff';

  const getActiveStyle = (isActive) => ({
    ...styles.toolbarBtn,
    borderRadius: '8px',
    border: isActive ? `1px solid ${tbActiveFg}66` : '1px solid rgba(128,128,128,0.15)',
    background: isActive ? (isDarkBase ? 'rgba(192,132,252,0.22)' : 'rgba(170,59,255,0.16)') : tbIdleBg,
    boxShadow: isActive
      ? `inset 0 -2px 0 ${tbActiveFg}, inset 1px 1px 3px rgba(0,0,0,0.18)`
      : '0 1px 2px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.08)',
    color: isActive ? tbActiveFg : styles.toolbarBtn.color,
    transform: isActive ? 'translateY(0.5px)' : 'none',
  });

  return (
    <div style={{ ...styles.toolbar, flexShrink: 0 }}>
      {promptModal.show && ReactDOM.createPortal(
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={{ margin: '0 0 24px 0', fontSize: 'var(--type-label)', fontWeight: '700', textTransform: 'uppercase', borderBottom: '1px solid rgba(128,128,128,0.2)', paddingBottom: '12px', letterSpacing: '0.5px' }}>{promptModal.title}</h3>
            <input id="prompt-modal-url" name="promptModalUrl" autoFocus autoComplete="url" type="text" placeholder={promptModal.placeholder || 'https://...'} value={promptModal.value} onChange={e => setPromptModal({ ...promptModal, value: e.target.value })} style={styles.textInput} />
            {promptModal.isLink && editor.state.selection.empty && (
              <input id="prompt-modal-link-text" name="promptModalLinkText" type="text" autoComplete="off" placeholder="Texto de exibição (opcional)" value={promptModal.linkText} onChange={e => setPromptModal({ ...promptModal, linkText: e.target.value })} style={{ ...styles.textInput, marginTop: '16px' }} />
            )}
            {promptModal.showCaption && (
              <input id="prompt-modal-caption" name="promptModalCaption" type="text" autoComplete="off" placeholder="Legenda (opcional)" value={promptModal.caption} onChange={e => setPromptModal({ ...promptModal, caption: e.target.value })} style={{ ...styles.textInput, marginTop: '16px' }} />
            )}
            <div style={{ ...styles.modalActions, marginTop: '24px' }}>
              <button type="button" onClick={() => setPromptModal({ show: false })} style={styles.modalBtnCancel}>CANCELAR</button>
              <button type="button" onClick={() => { promptModal.callback(promptModal.value, promptModal.linkText, promptModal.caption); setPromptModal({ show: false }); }} style={styles.modalBtnConfirm}>INSERIR</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(2, 132, 199, 0.1)', padding: '6px 12px', borderRadius: '100px', border: '1px solid rgba(2, 132, 199, 0.3)', marginRight: '10px' }} title="Inteligência Artificial (Gemini 2.5 Pro)">
        <Sparkles size={16} color="#0284c7" />
        <select id="ai-action" name="aiAction" autoComplete="off" onChange={(e) => { if (e.target.value) { handleAITransform(e.target.value); e.target.value = ''; } }} style={{ fontSize: '12px', padding: '2px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#0284c7', fontWeight: '800' }} disabled={isGeneratingAI}>
          <option value="">{isGeneratingAI ? 'Processando...' : 'IA: Aprimorar Texto'}</option><option value="grammar">Corrigir Gramática</option><option value="summarize">Resumir Seleção</option><option value="expand">Expandir Conteúdo</option><option value="formal">Tornar Formal</option>
        </select>
      </div>

      <div style={styles.toolbarDivider}></div>
      <button type="button" title="Negrito" onClick={() => editor.chain().focus().toggleBold().run()} style={getActiveStyle(editor.isActive('bold'))}><Bold size={16} /></button>
      <button type="button" title="Itálico" onClick={() => editor.chain().focus().toggleItalic().run()} style={getActiveStyle(editor.isActive('italic'))}><Italic size={16} /></button>
      <button type="button" title="Sublinhado" onClick={() => editor.chain().focus().toggleUnderline().run()} style={getActiveStyle(editor.isActive('underline'))}><UnderlineIcon size={16} /></button>
      <button type="button" title="Tachado" onClick={() => editor.chain().focus().toggleStrike().run()} style={getActiveStyle(editor.isActive('strike'))}><Strikethrough size={16} /></button>
      <button type="button" title="Marca-texto" onClick={() => editor.chain().focus().toggleHighlight().run()} style={{ ...getActiveStyle(editor.isActive('highlight')), ...(editor.isActive('highlight') ? { background: 'rgba(255, 204, 0, 0.35)', color: '#b8860b' } : {}) }}><Highlighter size={16} /></button>

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
      <button type="button" title="Aumentar recuo da primeira linha" onClick={() => editor.chain().focus().increaseIndent().run()} style={styles.toolbarBtn}><Indent size={16} /></button>
      <button type="button" title="Diminuir recuo da primeira linha" onClick={() => editor.chain().focus().decreaseIndent().run()} style={styles.toolbarBtn}><Outdent size={16} /></button>

      <div style={styles.toolbarDivider}></div>
      <button type="button" title="Link" onClick={addLink} style={getActiveStyle(editor.isActive('link'))}><LinkIcon size={16} /></button>
      <button type="button" title="Remover Link" onClick={() => editor.chain().focus().unsetLink().run()} disabled={!editor.isActive('link')} style={{ ...styles.toolbarBtn, opacity: editor.isActive('link') ? 1 : 0.5 }}><Unlink size={16} /></button>

      <input id="editor-image-upload" name="editorImageUpload" type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} style={{ display: 'none' }} />
      <button type="button" title="Upload" onClick={() => fileInputRef.current.click()} disabled={isUploading} style={{ ...styles.toolbarBtn, opacity: isUploading ? 0.5 : 1 }}><Upload size={16} /></button>
      <button type="button" title="Img URL" onClick={addImageUrl} style={styles.toolbarBtn}><ImageIcon size={16} /></button>
      <button type="button" title="YouTube" onClick={addYoutube} style={styles.toolbarBtn}><Youtube size={16} /></button>
      <button type="button" title="Reduzir mídia selecionada" onClick={() => adjustSelectedMediaSize(-1)} style={styles.toolbarBtn}><ZoomOut size={16} /></button>
      <button type="button" title="Aumentar mídia selecionada" onClick={() => adjustSelectedMediaSize(1)} style={styles.toolbarBtn}><ZoomIn size={16} /></button>
      <button type="button" title="Adicionar/editar legenda da mídia selecionada" onClick={editCaption} style={{ ...styles.toolbarBtn, opacity: (editor.isActive('image') || editor.isActive('youtube')) ? 1 : 0.4 }}><MessageSquare size={16} /></button>

      <div style={styles.toolbarDivider}></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 8px' }}>
        <Palette size={16} /><input id="editor-text-color" name="textColor" type="color" autoComplete="off" onInput={event => editor.chain().focus().setColor(event.target.value).run()} value={editor.getAttributes('textStyle').color || '#000000'} style={{ cursor: 'pointer', padding: 0, border: 'none', width: '28px', height: '28px', background: 'transparent', borderRadius: '10px' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 8px' }}>
        <Type size={16} /><select id="editor-font-family" name="fontFamily" autoComplete="off" onChange={e => editor.chain().focus().setFontFamily(e.target.value).run()} value={editor.getAttributes('textStyle').fontFamily || 'inherit'} style={{ fontSize: '13px', padding: '4px', background: 'transparent', color: 'inherit', border: 'none', fontWeight: '600' }}><option value="inherit">Padrão</option><option value="monospace">Monospace</option><option value="Arial">Arial</option><option value="'Times New Roman', Times, serif">Times</option></select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 8px' }}>
        <select id="editor-font-size" name="fontSize" autoComplete="off" onChange={e => editor.chain().focus().setFontSize(e.target.value).run()} value={editor.getAttributes('textStyle').fontSize || ''} style={{ fontSize: '13px', padding: '4px', background: 'transparent', color: 'inherit', border: 'none', fontWeight: '600' }}><option value="">Tam.</option><option value="12px">12px</option><option value="14px">14px</option><option value="16px">16px</option><option value="18px">18px</option><option value="20px">20px</option><option value="24px">24px</option><option value="30px">30px</option></select>
      </div>

      <div style={styles.toolbarDivider}></div>
      <div style={{ position: 'relative' }}>
        <button ref={aiChatBtnRef} type="button" title="IA: Instrução Livre (Gemini)" onClick={() => setAiChatOpen(!aiChatOpen)} style={{ ...styles.toolbarBtn, background: aiChatOpen ? 'rgba(2,132,199,0.15)' : styles.toolbarBtn.background, color: aiChatOpen ? '#0284c7' : styles.toolbarBtn.color }} disabled={isGeneratingAI}>
          {isGeneratingAI ? <Loader2 className="animate-spin" size={16} /> : <Wand2 size={16} />}
        </button>
        {aiChatOpen && (() => {
          const btnRect = aiChatBtnRef.current?.getBoundingClientRect();
          const popupWin = aiChatBtnRef.current?.ownerDocument?.defaultView;
          const vpW = popupWin?.innerWidth || 800;
          let popLeft = btnRect ? btnRect.left : 0;
          const popW = 340;
          if (popLeft + popW > vpW - 8) popLeft = vpW - popW - 8;
          if (popLeft < 8) popLeft = 8;
          return ReactDOM.createPortal(
            <div style={{ position: 'fixed', top: btnRect ? btnRect.bottom + 6 : 100, left: popLeft, width: `${popW}px`, zIndex: 99999, background: isDarkBase ? 'rgba(18,18,22,0.96)' : 'rgba(255,255,255,0.97)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: `1px solid ${isDarkBase ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'}`, borderRadius: '16px', padding: '14px', boxShadow: '0 12px 40px rgba(0,0,0,0.25)', animation: 'fadeIn 0.15s ease-out' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <Wand2 size={14} color="#0284c7" />
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.5px' }}>IA: Instrução Livre</span>
                <span style={{ fontSize: '10px', opacity: 0.5, marginLeft: 'auto' }}>{editor.state.selection.empty ? 'Texto inteiro' : 'Seleção'}</span>
              </div>
              <textarea
                autoFocus
                rows={3}
                placeholder="Ex: Traduza para inglês, resuma em 3 bullets, torne poético..."
                value={aiChatInput}
                onChange={e => setAiChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAIFreeform(); } if (e.key === 'Escape') setAiChatOpen(false); }}
                style={{ width: '100%', resize: 'vertical', padding: '10px 12px', fontSize: '13px', lineHeight: '1.5', border: `1px solid ${isDarkBase ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, borderRadius: '10px', background: isDarkBase ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', color: 'inherit', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px', gap: '8px' }}>
                <button type="button" onClick={() => setAiChatOpen(false)} style={{ padding: '6px 14px', fontSize: '12px', fontWeight: '600', border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'transparent', color: 'inherit', opacity: 0.6 }}>Cancelar</button>
                <button type="button" onClick={handleAIFreeform} disabled={!aiChatInput.trim()} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 16px', fontSize: '12px', fontWeight: '700', border: 'none', borderRadius: '8px', cursor: 'pointer', background: '#0284c7', color: '#fff', opacity: aiChatInput.trim() ? 1 : 0.5, transition: 'opacity 0.15s' }}>
                  <Send size={12} /> Enviar
                </button>
              </div>
            </div>,
            aiChatBtnRef.current?.ownerDocument?.body || document.body
          );
        })()}
      </div>
    </div>
  );
};

const STATIC_EXTENSIONS = [
  StarterKit.configure({
    dropcursor: false,
    link: false,
    underline: false,
  }),
  Markdown,
  Underline,
  Highlight,
  Subscript,
  Superscript,
  TextStyle,
  Color,
  FontFamily,
  FontSize,
  TextIndent,
  Typography,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  ResizableImage.configure({ inline: false }),
  ResizableYoutube.configure({ inline: false, width: 840, height: 472.5 }),
  Table.configure({ resizable: true }), TableRow, TableHeader, TableCell,
  TaskList, TaskItem.configure({ nested: true }),
  Dropcursor.configure({ color: '#ff0000', width: 2 }),
  CharacterCount,
  Focus.configure({ className: 'has-focus', mode: 'deepest' }),
  Placeholder.configure({ placeholder: 'O fluxo da consciência (Aceita Markdown na colagem)...' }),
  LinkExtension.configure({ openOnClick: false, autolink: true, HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' } })
];

// BubbleMenu — contextual formatting toolbar on text selection
const EditorBubbleMenu = ({ editor }) => {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  useEffect(() => {
    if (!editor) return;
    const update = () => {
      const { from, to, empty } = editor.state.selection;
      if (empty || editor.state.selection instanceof NodeSelection) { setPos(null); return; }
      try {
        const domRange = editor.view.domAtPos(from);
        const ownerDoc = editor.view.dom.ownerDocument;
        const popupWin = ownerDoc.defaultView;
        const range = ownerDoc.createRange();
        range.setStart(domRange.node, domRange.offset);
        const endDom = editor.view.domAtPos(to);
        range.setEnd(endDom.node, endDom.offset);
        const rect = range.getBoundingClientRect();
        if (rect.width === 0) { setPos(null); return; }
        const menuH = 44;
        const menuW = 340;
        const vpWidth = popupWin?.innerWidth || 800;
        let top = rect.top - menuH - 8;
        let left = rect.left + rect.width / 2;
        if (top < 4) top = rect.bottom + 8;
        left = Math.max(menuW / 2 + 4, Math.min(left, vpWidth - menuW / 2 - 4));
        setPos({ top, left });
      } catch { setPos(null); }
    };
    editor.on('selectionUpdate', update);
    editor.on('blur', () => setPos(null));
    return () => { editor.off('selectionUpdate', update); editor.off('blur', () => setPos(null)); };
  }, [editor]);

  if (!pos || !editor) return null;
  const portalTarget = editor.view?.dom?.ownerDocument?.body || document.body;
  return ReactDOM.createPortal(
    <div ref={ref} className="bubble-menu" style={{ position: 'fixed', top: `${pos.top}px`, left: `${pos.left}px`, transform: 'translateX(-50%)', zIndex: 99999 }}>
      <button type="button" onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }} className={editor.isActive('bold') ? 'is-active' : ''} title="Negrito"><Bold size={14} /></button>
      <button type="button" onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }} className={editor.isActive('italic') ? 'is-active' : ''} title="It\u00e1lico"><Italic size={14} /></button>
      <button type="button" onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }} className={editor.isActive('underline') ? 'is-active' : ''} title="Sublinhado"><UnderlineIcon size={14} /></button>
      <button type="button" onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleStrike().run(); }} className={editor.isActive('strike') ? 'is-active' : ''} title="Tachado"><Strikethrough size={14} /></button>
      <span className="bubble-divider" />
      <button type="button" onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHighlight().run(); }} className={editor.isActive('highlight') ? 'is-active' : ''} title="Marca-texto"><Highlighter size={14} /></button>
      <button type="button" onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleSubscript().run(); }} className={editor.isActive('subscript') ? 'is-active' : ''} title="Subscrito"><SubIcon size={14} /></button>
      <button type="button" onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleSuperscript().run(); }} className={editor.isActive('superscript') ? 'is-active' : ''} title="Sobrescrito"><SuperIcon size={14} /></button>
      <span className="bubble-divider" />
      <button type="button" onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleCode().run(); }} className={editor.isActive('code') ? 'is-active' : ''} title="C\u00f3digo inline"><Code size={14} /></button>
      <button type="button" onMouseDown={e => { e.preventDefault(); if (editor.isActive('link')) { editor.chain().focus().unsetLink().run(); } else { const url = window.prompt('URL do link:'); if (url) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run(); } }} className={editor.isActive('link') ? 'is-active' : ''} title="Link"><LinkIcon size={14} /></button>
    </div>,
    portalTarget
  );
};

// FloatingMenu — quick-insert toolbar on empty paragraph lines
const EditorFloatingMenu = ({ editor }) => {
  const [pos, setPos] = useState(null);

  useEffect(() => {
    if (!editor) return;
    const update = () => {
      const { $anchor } = editor.state.selection;
      const isEmptyTextBlock = $anchor.parent.isTextblock && $anchor.parent.content.size === 0;
      if (!isEmptyTextBlock || !editor.state.selection.empty) { setPos(null); return; }
      try {
        const coords = editor.view.coordsAtPos($anchor.pos);
        setPos({ top: coords.top - 4, left: coords.left - 16 });
      } catch { setPos(null); }
    };
    // Hide floating menu during scroll to prevent stale position
    let wrapper = null;
    try { wrapper = editor.view?.dom?.closest('.tiptap-wrapper'); } catch { /* view not mounted yet */ }
    const hideOnScroll = () => setPos(null);
    editor.on('selectionUpdate', update);
    editor.on('focus', update);
    wrapper?.addEventListener('scroll', hideOnScroll);
    return () => { editor.off('selectionUpdate', update); editor.off('focus', update); wrapper?.removeEventListener('scroll', hideOnScroll); };
  }, [editor]);

  if (!pos || !editor) return null;
  const portalTarget = editor.view?.dom?.ownerDocument?.body || document.body;
  return ReactDOM.createPortal(
    <div className="floating-menu" style={{ position: 'fixed', top: `${pos.top}px`, left: `${pos.left}px`, transform: 'translateX(-100%)', zIndex: 99999 }}>
      <button type="button" onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 1 }).run(); }} className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''} title="T\u00edtulo 1"><H1Icon size={16} /></button>
      <button type="button" onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run(); }} className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''} title="T\u00edtulo 2"><H2Icon size={16} /></button>
      <button type="button" onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 3 }).run(); }} className={editor.isActive('heading', { level: 3 }) ? 'is-active' : ''} title="T\u00edtulo 3"><Heading3 size={16} /></button>
      <span className="floating-divider" />
      <button type="button" onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }} title="Marcadores"><List size={16} /></button>
      <button type="button" onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run(); }} title="Numera\u00e7\u00e3o"><ListOrdered size={16} /></button>
      <button type="button" onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleTaskList().run(); }} title="Tarefas"><ListChecks size={16} /></button>
      <span className="floating-divider" />
      <button type="button" onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBlockquote().run(); }} title="Cita\u00e7\u00e3o"><Quote size={16} /></button>
      <button type="button" onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleCodeBlock().run(); }} title="Bloco de C\u00f3digo"><Code size={16} /></button>
      <button type="button" onMouseDown={e => { e.preventDefault(); editor.chain().focus().setHorizontalRule().run(); }} title="Linha Horizontal"><Minus size={16} /></button>
      <button type="button" onMouseDown={e => { e.preventDefault(); editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); }} title="Tabela"><LayoutGrid size={16} /></button>
    </div>,
    portalTarget
  );
};

const EditorPanel = ({ post, isSaving, onSave, onCancel, secret, showNotification, styles, API_URL, isDarkBase, activePalette }) => {
  const [title, setTitle] = useState(post ? post.title : '');
  const [editorReady, setEditorReady] = useState(false);

  const editor = useEditor({
    extensions: STATIC_EXTENSIONS,
    content: post ? post.content : '',
    onCreate: () => setEditorReady(true),
    onDestroy: () => setEditorReady(false),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!editor) return;
    onSave({ id: post ? post.id : null, title, content: editor.getHTML() });
  };

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* Barra de controle do popup */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" onClick={onCancel} style={{ ...styles.backButton, marginBottom: 0, background: 'var(--semantic-error-soft, rgba(211,47,47,0.1))', border: '1px solid var(--semantic-error-border, rgba(211,47,47,0.3))', color: 'var(--semantic-error, #d32f2f)' }} title="Fechar popup"><X size={16} /> Fechar</button>
          <button type="button" onClick={() => { if (editor) { editor.commands.clearContent(); setTitle(''); } }} style={{ ...styles.backButton, marginBottom: 0 }} title="Limpar área de edição"><Eraser size={16} /> Limpar</button>
        </div>
        <button type="button" disabled={isSaving} onClick={handleSubmit} style={styles.adminButton}>
          {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          SALVAR
        </button>
      </div>
      <form onSubmit={handleSubmit} style={{ ...styles.form, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <input id="post-title" name="postTitle" autoComplete="off" style={{ ...styles.adminInput, flexShrink: 0 }} placeholder="TÍTULO DO FRAGMENTO" value={title} onChange={e => setTitle(e.target.value)} required />
        <div style={{ ...styles.editorContainer, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <MenuBar editor={editor} editorReady={editorReady} secret={secret} showNotification={showNotification} API_URL={API_URL} styles={styles} isDarkBase={isDarkBase} activePalette={activePalette} />
          <div className="tiptap-wrapper" style={{ ...styles.tiptapWrapper, flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <EditorBubbleMenu editor={editor} />
            <EditorFloatingMenu editor={editor} />
            <EditorContent editor={editor} />
          </div>
          <div style={{ ...styles.statusBar, flexShrink: 0 }}>
            {editor ? `${editor.storage.characterCount.characters()} caracteres | ${editor.storage.characterCount.words()} palavras` : ''}
          </div>
        </div>
      </form>
    </div>
  );
};

export default EditorPanel;