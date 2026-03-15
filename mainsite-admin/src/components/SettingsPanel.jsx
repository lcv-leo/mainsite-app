// Módulo: mainsite-admin/src/components/SettingsPanel.jsx
// Versão: v1.0.0
// Descrição: Componente isolado para gerenciamento de configurações globais (Rate Limit, Rotação, Multi-Tema e Upload R2).

import React from 'react';
import { ArrowLeft, ShieldAlert, Loader2, Upload, Save } from 'lucide-react';

const SettingsPanel = ({
  settings, setSettings,
  rateLimit, setRateLimit,
  rotation, setRotation,
  isSaving, onSave, onClose,
  triggerBgUpload, isUploadingBg, uploadTarget,
  styles
}) => {
  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      <button type="button" onClick={onClose} style={styles.backButton}>
        <ArrowLeft size={16} /> Voltar aos Registros
      </button>
      
      <form onSubmit={onSave} style={styles.form}>
        {/* BLOCO 1: RATE LIMIT */}
        <h2 style={{ fontSize: '16px', borderBottom: '2px solid #000', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldAlert size={18} color="#ef4444" /> Segurança e Custos (Limitação de API)
        </h2>
        <div style={{ padding: '15px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', color: '#b91c1c' }}>
            <input type="checkbox" checked={rateLimit.enabled} onChange={e => setRateLimit({...rateLimit, enabled: e.target.checked})} style={{ width: '18px', height: '18px' }} />
            Habilitar Escudo contra Robôs / Abusos (Rate Limiting)
          </label>
          <p style={{ fontSize: '11px', color: '#dc2626', margin: 0 }}>* Quando ativado, bloqueia temporariamente visitantes (por IP) que dispararem requisições excessivas (Chat, Resumo, Tradução) à Inteligência Artificial.</p>
          <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#b91c1c', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              Máximo de Requisições por IP:
              <input type="number" min="1" value={rateLimit.maxRequests} onChange={e => setRateLimit({...rateLimit, maxRequests: parseInt(e.target.value) || 5})} style={{ padding: '5px', width: '150px', border: '1px solid #fca5a5', borderRadius: '4px', outline: 'none' }} disabled={!rateLimit.enabled} />
            </label>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#b91c1c', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              Na Janela de Tempo (Minutos):
              <input type="number" min="1" value={rateLimit.windowMinutes} onChange={e => setRateLimit({...rateLimit, windowMinutes: parseInt(e.target.value) || 1})} style={{ padding: '5px', width: '150px', border: '1px solid #fca5a5', borderRadius: '4px', outline: 'none' }} disabled={!rateLimit.enabled} />
            </label>
          </div>
        </div>
        
        {/* BLOCO 2: ROTAÇÃO AUTOMÁTICA */}
        <h2 style={{ fontSize: '16px', borderBottom: '2px solid #000', paddingBottom: '10px', marginTop: '20px' }}>Engenharia de Automação</h2>
        <div style={{ padding: '15px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', color: '#0369a1' }}>
            <input type="checkbox" checked={rotation.enabled} onChange={e => setRotation({...rotation, enabled: e.target.checked})} style={{ width: '18px', height: '18px' }} />
            Habilitar Rotação Autônoma da Fila de Textos
          </label>
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
            Intervalo de Rotação (Minutos):
            <input type="number" min="1" value={rotation.interval} onChange={e => setRotation({...rotation, interval: parseInt(e.target.value) || 60})} style={{ padding: '5px', width: '80px', border: '1px solid #7dd3fc', borderRadius: '4px', outline: 'none' }} disabled={!rotation.enabled} />
          </label>
        </div>

        {/* BLOCO 3: CUSTOMIZAÇÃO MULTI-TEMA */}
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
          <label style={styles.label}>Imagem de Fundo (R2 ou URL externa): 
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" placeholder="https://..." value={settings.dark.bgImage} onChange={e => setSettings({...settings, dark: {...settings.dark, bgImage: e.target.value}})} style={{...styles.textInput, flex: 1}} />
              <button type="button" onClick={() => triggerBgUpload('dark')} disabled={isUploadingBg} style={{...styles.toolbarBtn, height: '35px', width: '40px', border: '1px solid #ccc'}} title="Fazer upload para o Storage R2">
                {isUploadingBg && uploadTarget === 'dark' ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              </button>
            </div>
          </label>
        </div>

        <h3 style={{ fontSize: '14px', marginTop: '10px', borderBottom: '1px solid #eee', paddingBottom: '5px', color: '#f59e0b' }}>Paleta Tema Claro (Light Mode)</h3>
        <div style={styles.settingsGrid}>
          <label style={styles.label}>Cor de Fundo: <input type="color" value={settings.light.bgColor} onChange={e => setSettings({...settings, light: {...settings.light, bgColor: e.target.value}})} style={styles.colorInput} /></label>
          <label style={styles.label}>Cor do Texto Base: <input type="color" value={settings.light.fontColor} onChange={e => setSettings({...settings, light: {...settings.light, fontColor: e.target.value}})} style={styles.colorInput} /></label>
          <label style={styles.label}>Cor dos Títulos (H1/H2): <input type="color" value={settings.light.titleColor} onChange={e => setSettings({...settings, light: {...settings.light, titleColor: e.target.value}})} style={styles.colorInput} /></label>
          <label style={styles.label}>Imagem de Fundo (R2 ou URL externa): 
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" placeholder="https://..." value={settings.light.bgImage} onChange={e => setSettings({...settings, light: {...settings.light, bgImage: e.target.value}})} style={{...styles.textInput, flex: 1}} />
              <button type="button" onClick={() => triggerBgUpload('light')} disabled={isUploadingBg} style={{...styles.toolbarBtn, height: '35px', width: '40px', border: '1px solid #ccc'}} title="Fazer upload para o Storage R2">
                {isUploadingBg && uploadTarget === 'light' ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              </button>
            </div>
          </label>
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