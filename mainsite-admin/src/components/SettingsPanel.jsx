// Módulo: mainsite-admin/src/components/SettingsPanel.jsx
// Versão: v1.2.0
// Descrição: Componente isolado. Resolução de quebra visual no Dark Mode com a implementação padronizada da malha de Glassmorphism.

import React from 'react';
import { ArrowLeft, ShieldAlert, Loader2, Upload, Save } from 'lucide-react';

const SettingsPanel = ({
  settings, setSettings,
  rateLimit, setRateLimit,
  rotation, setRotation,
  disclaimers, setDisclaimers,
  isSaving, onSave, onClose,
  triggerBgUpload, isUploadingBg, uploadTarget,
  styles
}) => {
  
  // Classe vídrica neutra unificada para garantir suporte total ao Dark/Light Mode
  const glassBlock = {
    padding: '24px',
    background: 'rgba(128, 128, 128, 0.05)',
    border: '1px solid rgba(128, 128, 128, 0.15)',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '15px'
  };

  const sectionTitle = {
    fontSize: '16px', 
    borderBottom: '1px solid rgba(128, 128, 128, 0.2)', 
    paddingBottom: '10px', 
    marginTop: '20px',
    display: 'flex', 
    alignItems: 'center', 
    gap: '8px'
  };

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      <button type="button" onClick={onClose} style={styles.backButton}>
        <ArrowLeft size={16} /> Voltar aos Registros
      </button>
      
      <form onSubmit={onSave} style={styles.form}>
        {/* BLOCO 1: RATE LIMIT */}
        <h2 style={{ ...sectionTitle, color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
          <ShieldAlert size={18} /> Segurança e Custos (Limitação de API)
        </h2>
        <div style={{...glassBlock, border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)'}}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', color: '#ef4444' }}>
            <input type="checkbox" checked={rateLimit.enabled} onChange={e => setRateLimit({...rateLimit, enabled: e.target.checked})} style={{ width: '18px', height: '18px' }} />
            Habilitar Escudo contra Robôs / Abusos (Rate Limiting)
          </label>
          <p style={{ fontSize: '11px', color: '#ef4444', opacity: 0.8, margin: 0 }}>* Quando ativado, bloqueia temporariamente visitantes (por IP) que dispararem requisições excessivas (Chat, Resumo, Tradução) à Inteligência Artificial.</p>
          <div style={{ display: 'flex', gap: '20px', marginTop: '10px', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#ef4444', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              Máximo de Requisições por IP:
              <input type="number" min="1" value={rateLimit.maxRequests} onChange={e => setRateLimit({...rateLimit, maxRequests: parseInt(e.target.value) || 5})} style={{...styles.textInput, width: '150px'}} disabled={!rateLimit.enabled} />
            </label>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#ef4444', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              Na Janela de Tempo (Minutos):
              <input type="number" min="1" value={rateLimit.windowMinutes} onChange={e => setRateLimit({...rateLimit, windowMinutes: parseInt(e.target.value) || 1})} style={{...styles.textInput, width: '150px'}} disabled={!rateLimit.enabled} />
            </label>
          </div>
        </div>
        
        {/* BLOCO 2: ROTAÇÃO AUTOMÁTICA */}
        <h2 style={sectionTitle}>Engenharia de Automação</h2>
        <div style={glassBlock}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
            <input type="checkbox" checked={rotation.enabled} onChange={e => setRotation({...rotation, enabled: e.target.checked})} style={{ width: '18px', height: '18px' }} />
            Habilitar Rotação Autônoma da Fila de Textos
          </label>
          <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
            Intervalo de Rotação (Minutos):
            <input type="number" min="1" value={rotation.interval} onChange={e => setRotation({...rotation, interval: parseInt(e.target.value) || 60})} style={{...styles.textInput, width: '80px'}} disabled={!rotation.enabled} />
          </label>
        </div>

        {/* BLOCO 3: CUSTOMIZAÇÃO MULTI-TEMA */}
        <h2 style={sectionTitle}>Customização Visual: Multi-Tema</h2>
        <div style={glassBlock}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
            <input type="checkbox" checked={settings.allowAutoMode} onChange={e => setSettings({...settings, allowAutoMode: e.target.checked})} style={{ width: '18px', height: '18px' }} />
            Habilitar Modo Automático (Sincroniza com o Sistema Operacional do Leitor)
          </label>
        </div>

        <h3 style={{ fontSize: '14px', marginTop: '10px', borderBottom: '1px solid rgba(128,128,128,0.2)', paddingBottom: '5px' }}>Configurações Globais (Ambos os Temas)</h3>
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
              <option value="system-ui, -apple-system, sans-serif">System UI (Moderno)</option>
            </select>
          </label>
        </div>

        <h3 style={{ fontSize: '14px', marginTop: '10px', borderBottom: '1px solid rgba(128,128,128,0.2)', paddingBottom: '5px' }}>Paleta Tema Escuro (Dark Mode)</h3>
        <div style={styles.settingsGrid}>
          <label style={styles.label}>Cor de Fundo: <input type="color" value={settings.dark.bgColor} onChange={e => setSettings({...settings, dark: {...settings.dark, bgColor: e.target.value}})} style={styles.colorInput} /></label>
          <label style={styles.label}>Cor do Texto Base: <input type="color" value={settings.dark.fontColor} onChange={e => setSettings({...settings, dark: {...settings.dark, fontColor: e.target.value}})} style={styles.colorInput} /></label>
          <label style={styles.label}>Cor dos Títulos (H1/H2): <input type="color" value={settings.dark.titleColor} onChange={e => setSettings({...settings, dark: {...settings.dark, titleColor: e.target.value}})} style={styles.colorInput} /></label>
          <label style={styles.label}>Imagem de Fundo (R2 ou URL externa): 
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" placeholder="https://..." value={settings.dark.bgImage} onChange={e => setSettings({...settings, dark: {...settings.dark, bgImage: e.target.value}})} style={{...styles.textInput, flex: 1}} />
              <button type="button" onClick={() => triggerBgUpload('dark')} disabled={isUploadingBg} style={{...styles.toolbarBtn, height: '42px', width: '42px', border: '1px solid rgba(128,128,128,0.2)'}} title="Fazer upload para o Storage R2">
                {isUploadingBg && uploadTarget === 'dark' ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              </button>
            </div>
          </label>
        </div>

        <h3 style={{ fontSize: '14px', marginTop: '10px', borderBottom: '1px solid rgba(128,128,128,0.2)', paddingBottom: '5px' }}>Paleta Tema Claro (Light Mode)</h3>
        <div style={styles.settingsGrid}>
          <label style={styles.label}>Cor de Fundo: <input type="color" value={settings.light.bgColor} onChange={e => setSettings({...settings, light: {...settings.light, bgColor: e.target.value}})} style={styles.colorInput} /></label>
          <label style={styles.label}>Cor do Texto Base: <input type="color" value={settings.light.fontColor} onChange={e => setSettings({...settings, light: {...settings.light, fontColor: e.target.value}})} style={styles.colorInput} /></label>
          <label style={styles.label}>Cor dos Títulos (H1/H2): <input type="color" value={settings.light.titleColor} onChange={e => setSettings({...settings, light: {...settings.light, titleColor: e.target.value}})} style={styles.colorInput} /></label>
          <label style={styles.label}>Imagem de Fundo (R2 ou URL externa): 
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" placeholder="https://..." value={settings.light.bgImage} onChange={e => setSettings({...settings, light: {...settings.light, bgImage: e.target.value}})} style={{...styles.textInput, flex: 1}} />
              <button type="button" onClick={() => triggerBgUpload('light')} disabled={isUploadingBg} style={{...styles.toolbarBtn, height: '42px', width: '42px', border: '1px solid rgba(128,128,128,0.2)'}} title="Fazer upload para o Storage R2">
                {isUploadingBg && uploadTarget === 'light' ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              </button>
            </div>
          </label>
        </div>
        
        {/* BLOCO 4: MOTOR DE AVISOS (DISCLAIMERS) */}
        <h2 style={sectionTitle}>
          <ShieldAlert size={18} /> Janelas de Aviso (Disclaimers Sequenciais)
        </h2>
        <div style={glassBlock}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
            <input type="checkbox" checked={disclaimers.enabled} onChange={e => setDisclaimers({...disclaimers, enabled: e.target.checked})} style={{ width: '18px', height: '18px' }} />
            Exibir Janelas de Aviso antes da leitura dos fragmentos
          </label>

          {disclaimers.enabled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '10px' }}>
              {disclaimers.items.map((item, index) => (
                <div key={item.id} style={{ background: 'rgba(128,128,128,0.05)', border: '1px solid rgba(128,128,128,0.2)', padding: '20px', borderRadius: '12px', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', opacity: 0.6 }}>AVISO {index + 1}</span>
                    <button type="button" onClick={() => { const newItems = [...disclaimers.items]; newItems.splice(index, 1); setDisclaimers({...disclaimers, items: newItems}); }} style={{ background: 'none', border: 'none', color: '#ea4335', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>REMOVER</button>
                  </div>
                  <input type="text" placeholder="Título (Ex: Termos de Leitura)" value={item.title} onChange={e => { const newItems = [...disclaimers.items]; newItems[index].title = e.target.value; setDisclaimers({...disclaimers, items: newItems}); }} style={{...styles.textInput, width: '100%', marginBottom: '10px', boxSizing: 'border-box'}} />
                  <textarea placeholder="Texto do aviso..." value={item.text} onChange={e => { const newItems = [...disclaimers.items]; newItems[index].text = e.target.value; setDisclaimers({...disclaimers, items: newItems}); }} style={{...styles.textInput, width: '100%', marginBottom: '10px', minHeight: '80px', boxSizing: 'border-box', resize: 'vertical'}} />
                  <input type="text" placeholder="Texto do Botão (Ex: Concordo)" value={item.buttonText} onChange={e => { const newItems = [...disclaimers.items]; newItems[index].buttonText = e.target.value; setDisclaimers({...disclaimers, items: newItems}); }} style={{...styles.textInput, width: '100%', boxSizing: 'border-box'}} />
                </div>
              ))}
              <button type="button" onClick={() => setDisclaimers({...disclaimers, items: [...disclaimers.items, { id: crypto.randomUUID(), title: '', text: '', buttonText: 'Concordo' }]})} style={{ padding: '12px', background: 'transparent', color: 'inherit', border: '1px dashed rgba(128,128,128,0.5)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', transition: 'background 0.2s' }} onMouseOver={(e) => e.currentTarget.style.background = 'rgba(128,128,128,0.1)'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                + ADICIONAR NOVO AVISO
              </button>
            </div>
          )}
        </div>
        
        <button type="submit" disabled={isSaving} style={styles.adminButton}>
          {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} 
          SALVAR CONFIGURAÇÕES GLOBAIS
        </button>
      </form>
    </div>
  );
};

export default SettingsPanel;