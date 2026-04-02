/*
 * VISUAL DEMONSTRATION — Text Zoom Feature
 * mainsite-frontend PostReader
 * 
 * Este arquivo documenta como a feature se integra visualmente
 */

// ========================================
// 1. HOOK — useTextZoom.ts
// ========================================

// CustomHook para gerenciar state de zoom com localStorage
const { zoomLevel, percentage, increase, decrease, reset, setZoomLevel } = useTextZoom();

// Exemplo de valor retornado:
// {
//   zoomLevel: 1.15,          // 115% (multiplicador CSS)
//   percentage: 115,           // Display value
//   increase: () => {},        // Aumenta em 5%
//   decrease: () => {},        // Diminui em 5%
//   reset: () => {},           // Volta a 1.0 (100%)
//   setZoomLevel: (n) => {}    // Seta valor direto
// }


// ========================================
// 2. COMPONENTE — TextZoomControl.tsx
// ========================================

// UI Renderizada (Glassmorphism Design)
<div className="text-zoom-control-wrapper" style={{
  background: isDarkMode 
    ? 'rgba(0, 0, 0, 0.25)' 
    : 'rgba(255, 255, 255, 0.4)',
  backdropFilter: 'blur(12px)',
  borderRadius: '16px',
  padding: '16px 24px',
  display: 'flex',
  gap: '14px',
  justifyContent: 'center',
  flexWrap: 'wrap'
}}>
  {/* Botão Diminuir */}
  <button 
    onClick={onDecrease} 
    disabled={isAtMin}
    className="text-zoom-btn"
    aria-label="Diminuir tamanho do texto"
  >
    <ZoomOut size={18} />
  </button>

  {/* Slider Range (80-200%, step 5%) */}
  <input
    type="range"
    min="0.8"
    max="2.0"
    step="0.05"
    value={zoomLevel}
    onChange={(e) => onSliderChange(parseFloat(e.target.value))}
    className="text-zoom-slider"
    aria-label="Slider de tamanho de texto"
    aria-valuemin={80}
    aria-valuemax={200}
    aria-valuenow={percentage}
  />

  {/* Display Percentual */}
  <div className="text-zoom-display" aria-live="polite">
    {percentage}%
  </div>

  {/* Botão Aumentar */}
  <button 
    onClick={onIncrease} 
    disabled={isAtMax}
    className="text-zoom-btn"
    aria-label="Aumentar tamanho do texto"
  >
    <ZoomIn size={18} />
  </button>

  {/* Botão Reset (apenas quando zoom ≠ 100%) */}
  {isZoomed && (
    <button 
      onClick={onReset}
      className="text-zoom-btn reset"
      aria-label="Restaurar tamanho padrão"
    >
      <RotateCcw size={16} />
    </button>
  )}

  <span className="text-zoom-label">Tamanho</span>
</div>


// ========================================
// 3. CSS VARIABLES — Mantém Formatação
// ========================================

// No <style> do PostReader, adicionado:
--text-zoom-scale: ${zoomLevel};  // 0.8 até 2.0

// Aplicado aos font-sizes:
.p-content {
  font-size: calc(18px * var(--text-zoom-scale, 1));  // 14.4px até 36px
  transition: font-size 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.html-content h1 {
  font-size: calc(32px * var(--text-zoom-scale, 1));  // 25.6px até 64px
}

.html-content h2 {
  font-size: calc(32px * 0.85 * var(--text-zoom-scale, 1));  // 21.76px até 54.4px
}

.html-content h3 {
  font-size: calc(32px * 0.70 * var(--text-zoom-scale, 1));  // 17.92px até 44.8px
}

// ⚠️ EXCLUÍDO do zoom (conforme requisito):
.h1-title {
  font-size: clamp(32px, 5vw, 52px);  // Sem modificação!
}


// ========================================
// 4. INTEGRAÇÃO NO POSTREADER.tsx
// ========================================

// Dentro do retorno JSX:
<article aria-label={post.title}>
  <style>{`
    --text-zoom-scale: ${zoomLevel};
    // ... rest of styles ...
  `}</style>

  {/* ...home button, title, byline... */}

  <h1 className="h1-title">{post.title}</h1>  {/* 🚫 NÃO afetado */}
  <div className="post-gradient-divider" />
  <div className="post-byline">Por {postAuthor} · {date}</div>

  {/* ✨ NEW: Text Zoom Control aqui */}
  <TextZoomControl
    zoomLevel={zoomLevel}
    percentage={percentage}
    onIncrease={increase}
    onDecrease={decrease}
    onReset={reset}
    onSliderChange={setZoomLevel}
    textColor={activePalette.fontColor}
    bgColor={activePalette.bgColor}
    isDarkMode={isDarkBase}
  />

  {/* ...AI actions, summary box... */}

  {/* Conteúdo afetado pelo zoom */}
  <div className="post-content-area">
    <div className="protected-content">
      {renderContent(post.content)}  {/* ✅ Todos estes escalados */}
    </div>
  </div>

  {/* ...share bar... */}
</article>


// ========================================
// 5. FLUXO DO USUÁRIO
// ========================================

// 1. Usuário acessa /post/123
//    └─ useTextZoom() lee do localStorage
//       └─ Se existe: restaura valor anterior
//       └─ Se não existe: default 1.0 (100%)

// 2. Usuário clica no slider de 80% até 200%
//    └─ zoomLevel muda dinamicamente
//    └─ CSS variable --text-zoom-scale atualiza
//    └─ Todos calc() recalculam instantaneamente
//    └─ Transições 0.2s smooth
//    └─ localStorage salva novo valor
//
// 3. Usuário clica botão + (aumentar)
//    └─ zoomLevel += 0.05 (5%)
//    └─ Mesmo fluxo acima
//    └─ Button - habilita (se estava desabilitado)
//
// 4. Usuário clica botão reset
//    └─ zoomLevel = 1.0 (100%)
//    └─ Button reset desaparece (isZoomed = false)
//    └─ localStorage atualizado
//
// 5. Usuário navega para /post/456
//    └─ PostReader novo carrega
//    └─ useTextZoom() mantém preferência do localStorage
//    └─ Zoom nível restaurado no novo post


// ========================================
// 6. ACESSIBILIDADE — Keyboard Navigation
// ========================================

// Quando slider tem focus:
ArrowUp    → onIncrease()   [+5%]
ArrowRight → onIncrease()   [+5%]
ArrowDown  → onDecrease()   [-5%]
ArrowLeft  → onDecrease()   [-5%]
Home       → onReset()      [100%]

// Screen reader:
"Slider de tamanho de texto, 115%, de 80 até 200%"
(aria-valuemin=80, aria-valuemax=200, aria-valuenow=115)


// ========================================
// 7. RESPONSIVENESS
// ========================================

// Desktop (≥768px)
// Layout: [- btn] [slider] [% display] [+ btn] [reset btn] [label]
// Direction: row
// Flex-wrap: wrap (quando necessário)

// Tablet / Mobile (<768px)
// Layout: flex-wrap mantém todos componentes visíveis
// Touch support: Range input nativo suporta touch


// ========================================
// 8. PERFORMANCE OPTIMIZATIONS
// ========================================

// ✅ useCallback() em todos handlers
const increase = useCallback(() => {
  setZoomLevel(zoomLevel + STEP);
}, [zoomLevel, setZoomLevel]);

// ✅ CSS transitions em GPU
transition: font-size 0.2s cubic-bezier(0.4, 0, 0.2, 1)

// ✅ localStorage com fall-safe
try {
  localStorage.getItem(STORAGE_KEY)
} catch (e) {
  console.warn('Failed to read zoom')
}

// ✅ Sem inline styles desnecessários
// Todos estilos em <style> tag ou CSS modules


// ========================================
// 9. LOCALSTORAGE PERSISTENCE
// ========================================

// Key: "mainsite:text-zoom-level"
// Value: "1.15" (string, parseFloat na read)
// Scope: Per origin (mainsite domain)
// Duration: Persistent (até user limpar cache)

// Exemplo de arquivo localStorage:
{
  "mainsite:text-zoom-level": "1.15",
  "mainsite:dark-mode": "true",
  "mainsite:palette": "ocean"
}


// ========================================
// 10. VISUAL HIERARCHY PRESERVADA
// ========================================

// Sem zoom:
// Title (h1.html-content): 32px
// Heading 2 (h2): 27.2px (85% de 32px)
// Heading 3 (h3): 22.4px (70% de 32px)
// Paragraph (p): 18px

// Com zoom 150% (1.5x):
// Title (h1.html-content): 48px (32px × 1.5)
// Heading 2 (h2): 40.8px (27.2px × 1.5)
// Heading 3 (h3): 33.6px (22.4px × 1.5)
// Paragraph (p): 27px (18px × 1.5)

// ✅ Proporções mantidas!
// ✅ Formatting intacto!


// ========================================
// 11. LIMITAÇÕES CONHECIDAS
// ========================================

// ⚠️ Imagens:
// Não são escaladas. Recomendação:
// Usar responsive images (srcset) ou CSS max-width

// ⚠️ Código (pre/code blocks):
// Escalados junto, pode quebrar formatação de código
// Solução: Override específico se necessário

// ⚠️ Tabelas (se houver em post.content):
// Escaladas, mas podem não reflow bem em mobile
// Recomendação: overflow-x auto em table containers
