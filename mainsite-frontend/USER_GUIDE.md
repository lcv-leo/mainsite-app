# 👤 Guia de Uso — Text Zoom Feature

## Para Usuários Finais

### O Que É?

Ferramenta para **aumentar ou diminuir o tamanho do texto** de artigos no mainsite, mantendo toda a formatação e beleza do artigo.

**Importante:** Afeta APENAS o conteúdo do post, não o título principal.

---

### Onde Encontra?

1. Acesse um post qualquer: `https://mainsite.com/post/123`
2. Role para baixo após o **byline** (nome do autor e data)
3. Logo antes da seção de "Resumo por IA"

Você verá um **painel elegante** com:
```
[−] [Slider] [115%] [+] [↻] Tamanho
```

---

### Como Usar

#### Opção 1: Slider (Contínuo)
1. Clique e **arraste o slider** para a esquerda (diminuir) ou direita (aumentar)
2. Veja o **% mudar em tempo real** (80% até 200%)
3. O texto se **redimensiona suavemente** (0.2 segundos)

#### Opção 2: Botões de +/-
- **Botão −** : Diminui 5% por clique
- **Botão +** : Aumenta 5% por clique
- Usa os dois juntos para ajustes rápidos

#### Opção 3: Digitar o % Diretamente
1. Clique no **número percentual** (ex: 115%)
2. Digite o valor desejado
3. Pressione Enter

#### Opção 4: Teclado (Se tem foco no slider)
- **Setas ↑ / →** : Aumenta 5%
- **Setas ↓ / ←** : Diminui 5%
- **Home** : Reset para 100%

---

### Valores & O Que Esperar

| Nível | O Que Significa | Bom Para |
|-------|---|---|
| **80%** | Muito pequeno | Máxima densidade, pouco espaço |
| **100%** | Padrão | Leitura normal, padrão |
| **120%** | Confortável | Leitura prolongada |
| **150%** | Grande | Dificuldade visual, dislexia |
| **200%** | Máximo | Visão muito baixa |

---

### Formatação Preservada

Tudo que você vê in the artigo é **mantido perfeitamente**:

✅ **Títulos** h1, h2, h3 — proporções mantidas  
✅ **Parágrafos** — spacing preservado  
✅ **Listas** — indentação intacta  
✅ **Imagens** — tamanho preservado (não escaladas)  
✅ **Links** — cor e estilo intactos  
✅ **Destaques** — negrito, itálico funcionam  
✅ **Citações** — formatação mantida  
✅ **Código** — espaçamento monoespacial OK  

---

### Sua Preferência é Salva!

Quando você seta o zoom para, digamos, **130%**:

1. ✅ A mudança é **instantânea** (sem delay)
2. ✅ O tamanho é **salvinho automático** no seu navegador
3. ✅ Próxima vez que você voltar → **130% é restaurado**
4. ✅ Funciona em **qualquer artigo** do mainsite
5. ✅ Cada **navegador/dispositivo** tem sua própria preferência

---

### Dicas & Truques

#### 💡 Para Leitura Prolongada
1. Comece com **110-120%** para conforto
2. Se cansar → aumente para **130%**
3. Use **120%** como "sweet spot" padrão

#### 💡 Para Acessibilidade
- Se tem **dislexia** → tente **130-150%**
- Se tem **visão baixa** → tente **160-200%**
- Apple/Android **zoom** + feature **stacks** (multiplicativo)

#### 💡 Em Dispositivos
- **Desktop:** Use slider para ajustes finos
- **Tablet:** Use slider ou botões
- **Mobile:** Botões são mais fáceis (maior alvo)

#### 💡 Resetting
- Quer voltar ao padrão? Clique o **botão ↻** (reset)
- Aparece automaticamente quando zoom ≠ 100%

#### 💡 Impressão
- Imprimir usa **100%** automaticamente (padrão)
- Zoom não afeta a cópia impressa

---

### Compatibilidade

| Navegador | Status |
|-----------|--------|
| Chrome | ✅ 100% |
| Firefox | ✅ 100% |
| Safari | ✅ 100% |
| Edge | ✅ 100% |
| Opera | ✅ 100% |
| Android Chrome | ✅ 100% |
| iOS Safari | ✅ 100% |

---

### Troubleshooting

#### ❓ "O slider não aparece"
- Atualize a página (F5 ou Cmd+R)
- Limpe o cache do navegador
- Tente em outro navegador

#### ❓ "Meu zoom não é lembrado"
- Verifique se localStorage está ativado
  - Chrome: Configurações → Privacidade → Cookies ✅
  - Firefox: about:config → dom.storage.enabled ✅
  - Safari: Desenvolvedor → Desabilitar armazenamento offline ❌

#### ❓ "O texto fica pixelado em zoom alto"
- Isso é normal em **muito alto** (>175%)
- Tente **150-160%** para melhor qualidade

#### ❓ "As imagens não aumentam"
- Imagens têm tamanho fixo (isso é propositai)
- Para ver melhor: zoom do navegador (Ctrl++)

---

### Acessibilidade & Inclusão

Esta ferramenta foi **desenhada para ser acessível**:

✅ **Keyboard:** Funciona totalmente com teclado  
✅ **Screen readers:** Leitores de tela conseguem navegar  
✅ **Alto contraste:** Funciona em modos de alto contraste  
✅ **Movimentos reduzidos:** Respeita preferência do SO  
✅ **Cores:** Funciona em modo claro e escuro  

Se tem alguma dificuldade, [reporte aqui](https://github.com/lcv-leo/mainsite/issues).

---

### Feedback & Sugestões

Quer:
- **Mais opções?** (presets, temas)
- **Outras features?** (voz, shortcuts)
- **Reportar bug?** existente

Abra uma [issue no GitHub](https://github.com/lcv-leo/mainsite/issues) com:
- Seu navegador e versão
- O que esperava vs o que viu
- Screenshots se possível

---

### Para Desenvolvedores

#### Integração em seu site

Veja os arquivos de documentação:
- `TEXT_ZOOM_SUMMARY.md` — Visão geral
- `INTERACTIVE_EXAMPLES.tsx` — 10 exemplos
- `ARCHITECTURE_TEXT_ZOOM.md` — Análise técnica

#### Quick start:
```tsx
import { useTextZoom } from '../hooks/useTextZoom';
import TextZoomControl from '../components/TextZoomControl';

// Use no seu componente
const { zoomLevel, percentage, increase, decrease, reset, setZoomLevel } = useTextZoom();

// Aplique CSS variable
<style>{`--text-zoom-scale: ${zoomLevel}`}</style>

// Renderize o control
<TextZoomControl {...props} />
```

---

### Perguntas Frequentes (FAQ)

**P: Afeta o zoom do meu navegador?**  
R: Não! São independentes. Você pode usar ambos juntos.

**P: Funciona em mobile?**  
R: Sim! Slider tem suporte total para toque.

**P: Meu zoom é sincronizado entre devices?**  
R: Atualmente não. Cada device tem sua própria preferência (future feature).

**P: Posso ter zooms diferentes por post?**  
R: Atualmente não. O zoom é global. (future feature)

**P: Como faço para reverter?**  
R: Clique o botão ↻ (reset) ou limpe localStorage.

**P: Funciona offline?**  
R: Sim! localStorage funciona offline.

**P: Afeta SEO do site?**  
R: Não! É client-side apenas.

**P: Posso usar com leitor de tela?**  
R: Sim! Totalmente acessível (WCAG 2.1 AA).

**P: Qual navegador devo usar?**  
R: Qualquer um (Chrome, Firefox, Safari, Edge). Todos 100%.

---

### Privacidade

✅ **Sem analytics** — Sua preferência não é rastreada remotamente  
✅ **Local storage** — Dados salvos apenas no seu browser  
✅ **Sem cookies** — Não usamos cookies para isso  
✅ **Anonymous** — Ninguém vê seu zoom level  

---

## Aproveite! 📖

Esperamos que a leitura dos artigos fica mais **confortável e acessível** com essa ferramenta.

Se tem dúvidas ou sugestões, abra uma [issue](https://github.com/lcv-leo/mainsite/issues).

**Boas leituras!** ✨
