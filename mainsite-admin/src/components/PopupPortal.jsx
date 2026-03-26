/**
 * PopupPortal — Renderiza filhos React numa janela popup nativa do SO.
 *
 * Usa window.open() + ReactDOM.createPortal para manter a árvore React,
 * estado, hooks e contexto do pai funcionando dentro da janela separada.
 *
 * Features:
 * - Auto-sizing inteligente (~90% da tela, com teto razoável)
 * - Copia os stylesheets do parent para estilização consistente
 * - Monitora fechamento da popup (via botão X do SO) e chama onClose
 * - Título customizável para a janela
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Referência global da popup (single instance)
let popupWindow = null;

const PopupPortal = ({ isOpen, onClose, title = 'LCV Admin — Editor', children }) => {
  const [containerEl, setContainerEl] = useState(null);
  const lastFocusedRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      if (popupWindow && !popupWindow.closed) popupWindow.close();
      popupWindow = null;
      return;
    }

    // Já aberta — não recriar
    if (popupWindow && !popupWindow.closed && containerEl) return;

    lastFocusedRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    // Dimensões inteligentes (~90% da tela)
    const screenW = window.screen.availWidth || 1920;
    const screenH = window.screen.availHeight || 1080;
    const popupW = Math.min(Math.round(screenW * 0.92), 1600);
    const popupH = Math.min(Math.round(screenH * 0.92), 1060);
    const left = Math.round((screenW - popupW) / 2);
    const top = Math.round((screenH - popupH) / 2);

    const features = [
      `width=${popupW}`, `height=${popupH}`,
      `left=${left}`, `top=${top}`,
      'resizable=yes', 'scrollbars=yes',
      'menubar=no', 'toolbar=no', 'location=no', 'status=no',
    ].join(',');

    const popup = window.open('', '_blank', features);
    if (!popup) {
      onClose();
      return;
    }

    popupWindow = popup;

    // Estrutura HTML base
    popup.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title}</title>
      </head>
      <body>
        <div id="popup-root"></div>
      </body>
      </html>
    `);
    popup.document.close();

    // Copiar todos os stylesheets do parent
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach(node => {
      popup.document.head.appendChild(node.cloneNode(true));
    });

    // Estilos base da popup
    const popupStyle = popup.document.createElement('style');
    popupStyle.textContent = `
      body {
        margin: 0;
        padding: 20px;
        box-sizing: border-box;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        height: 100vh;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
      }
      #popup-root {
        max-width: 1100px;
        margin: 0 auto;
        width: 100%;
        display: flex;
        flex-direction: column;
        flex: 1;
      }
      .popup-portal-dialog {
        outline: none;
        display: flex;
        flex-direction: column;
        flex: 1;
      }
    `;
    popup.document.head.appendChild(popupStyle);

    // Criar container e notificar React
    const root = popup.document.getElementById('popup-root');
    if (root) {
      const div = popup.document.createElement('div');
      div.setAttribute('role', 'dialog');
      div.setAttribute('aria-modal', 'true');
      div.setAttribute('aria-label', title);
      div.className = 'popup-portal-dialog';
      div.tabIndex = -1;
      root.appendChild(div);
      queueMicrotask(() => {
        setContainerEl(div);
        div.focus();
      });
    }

    // Monitorar fechamento via botão X do SO
    const pollTimer = setInterval(() => {
      if (!popup || popup.closed) {
        clearInterval(pollTimer);
        popupWindow = null;
        queueMicrotask(() => setContainerEl(null));
        lastFocusedRef.current?.focus();
        onClose();
      }
    }, 300);

    // Cleanup
    return () => {
      clearInterval(pollTimer);
      if (popupWindow && !popupWindow.closed) popupWindow.close();
      popupWindow = null;
      lastFocusedRef.current?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, title]);

  if (!containerEl) return null;
  return createPortal(children, containerEl);
};

export default PopupPortal;
