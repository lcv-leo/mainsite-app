// Módulo: mainsite-admin/src/components/SettingsPanel.jsx
// Versão: v2.0.1
// Descrição: Refatoração completa para integração com o sistema de design (Glassmorphism/MD3) do App.jsx. Estilos locais foram removidos e o componente agora é totalmente dependente das props de tema.

import React from 'react';
import { X, Save, Image as ImageIcon, Loader2, Activity, CheckCircle, ArrowLeft, ShieldAlert, Upload } from 'lucide-react';

const SettingsPanel = ({
  settings, setSettings,
  rateLimit, setRateLimit,
  rotation, setRotation,
  disclaimers, setDisclaimers,
  isSaving, onSave, onClose,
  triggerBgUpload, isUploadingBg, uploadTarget,
  styles,
  activePalette,
  isDarkBase,
  showBackButton = true
}) => {

  const sectionTitle = {
    fontSize: '16px', 
    fontWeight: '600',
    borderBottom: `1px solid ${styles.glassBorder}`, 
    paddingBottom: '12px', 
    marginTop: '25px',
    marginBottom: '15px',
    display: 'flex', 
    alignItems: 'center', 
    gap: '10px',
    color: activePalette.titleColor
  };

  const subSectionTitle = {
    fontSize: '14px', 
    fontWeight: '600',
    marginTop: '15px', 
    borderBottom: `1px solid ${styles.glassBorder}`, 
    paddingBottom: '8px',
    marginBottom: '15px',
    color: activePalette.fontColor,
    opacity: 0.9
  };

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      {showBackButton && (
        <button type="button" onClick={onClose} style={styles.backButton}>
          <ArrowLeft size={16} /> Voltar ao Console
        </button>
      )}
      
      <form onSubmit={onSave} style={styles.form}>
        {/* BLOCO 1: RATE LIMIT */}
        <h2 style={{ ...sectionTitle, color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
          <ShieldAlert size={18} /> Segurança e Custos (Rate Limiting)
        </h2>
        <div style={{...styles.postCard, padding: '24px', border: '1px solid rgba(239, 68, 68, 0.3)', background: isDarkBase ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)'}}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', color: '#ef4444' }}>
            <input type="checkbox" checked={rateLimit.enabled} onChange={e => setRateLimit({...rateLimit, enabled: e.target.checked})} style={{ width: '18px', height: '18px', accentColor: '#ef4444' }} />
            Habilitar Escudo contra Robôs / Abusos
          </label>
          <p style={{ fontSize: '11px', color: '#ef4444', opacity: 0.8, margin: '10px 0 0 0' }}>* Quando ativado, bloqueia temporariamente visitantes (por IP) que dispararem requisições excessivas (Chat, Resumo, Tradução) à Inteligência Artificial.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '15px' }}>
            <label style={{ ...styles.label, color: '#ef4444' }}>
              Máximo de Requisições por IP:
              <input type="number" min="1" value={rateLimit.maxRequests} onChange={e => setRateLimit({...rateLimit, maxRequests: parseInt(e.target.value) || 5})} style={{...styles.textInput, width: '100%'}} disabled={!rateLimit.enabled} />
            </label>
            <label style={{ ...styles.label, color: '#ef4444' }}>
              Na Janela de Tempo (Minutos):
              <input type="number" min="1" value={rateLimit.windowMinutes} onChange={e => setRateLimit({...rateLimit, windowMinutes: parseInt(e.target.value) || 1})} style={{...styles.textInput, width: '100%'}} disabled={!rateLimit.enabled} />
            </label>
          </div>
        </div>
        
        {/* BLOCO 2: AUTOMAÇÃO & CUSTOMIZAÇÃO */}
        <h2 style={sectionTitle}>Automação e Customização</h2>
        <div style={{...styles.postCard, padding: '24px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
            <input type="checkbox" checked={rotation.enabled} onChange={e => setRotation({...rotation, enabled: e.target.checked})} style={{ width: '18px', height: '18px', accentColor: activePalette.titleColor }} />
            Habilitar Rotação Autônoma da Fila de Textos
          </label>
          <label style={{...styles.label, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px', marginTop: '15px' }}>
            Intervalo de Rotação (Minutos):
            <input type="number" min="1" value={rotation.interval} onChange={e => setRotation({...rotation, interval: parseInt(e.target.value) || 60})} style={{...styles.textInput, width: '80px'}} disabled={!rotation.enabled} />
          </label>
           <hr style={{border: 'none', height: '1px', backgroundColor: styles.glassBorder, margin: '20px 0'}} />
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
            <input type="checkbox" checked={settings.allowAutoMode} onChange={e => setSettings({...settings, allowAutoMode: e.target.checked})} style={{ width: '18px', height: '18px', accentColor: activePalette.titleColor }} />
            Habilitar Modo Automático (Sincroniza com o Sistema Operacional do Leitor)
          </label>
        </div>

        <h2 style={sectionTitle}>Customização Visual: Multi-Tema</h2>
        <h3 style={subSectionTitle}>Configurações Globais (Ambos os Temas)</h3>
        <div style={styles.settingsGrid}>
          <label style={styles.label}>Tamanho da Fonte Base (p): <input type="text" placeholder="Ex: 1.15rem" value={settings.shared.fontSize} onChange={e => setSettings({...settings, shared: {...settings.shared, fontSize: e.target.value}})} style={styles.textInput} /></label>
          <label style={styles.label}>Tamanho da Fonte Títulos (H1): <input type="text" placeholder="Ex: 1.8rem" value={settings.shared.titleFontSize} onChange={e => setSettings({...settings, shared: {...settings.shared, titleFontSize: e.target.value}})} style={styles.textInput} /></label>
          <label style={styles.label}>Família da Fonte: 
            <select value={settings.shared.fontFamily} onChange={e => setSettings({...settings, shared: {...settings.shared, fontFamily: e.target.value}})} style={styles.textInput}>
              <option value="system-ui, -apple-system, sans-serif">Padrão do Sistema (Recomendado)</option>
              <option value="sans-serif">Sans-Serif (Google)</option>
              <option value="monospace">Monospace</option>
              <option value="serif">Serif</option>
              <option value="'Courier New', Courier, monospace">Courier New</option>
              <option value="'Times New Roman', Times, serif">Times New Roman</option>
            </select>
          </label>
        </div>

        <h3 style={subSectionTitle}>Paleta Tema Escuro (Dark Mode)</h3>
        <div style={styles.settingsGrid}>
          <label style={styles.label}>Cor de Fundo: <input type="color" value={settings.dark.bgColor} onChange={e => setSettings({...settings, dark: {...settings.dark, bgColor: e.target.value}})} style={styles.colorInput} /></label>
          <label style={styles.label}>Cor do Texto Base: <input type="color" value={settings.dark.fontColor} onChange={e => setSettings({...settings, dark: {...settings.dark, fontColor: e.target.value}})} style={styles.colorInput} /></label>
          <label style={styles.label}>Cor dos Títulos (H1/H2): <input type="color" value={settings.dark.titleColor} onChange={e => setSettings({...settings, dark: {...settings.dark, titleColor: e.target.value}})} style={styles.colorInput} /></label>
          <label style={styles.label}>Imagem de Fundo (URL): 
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" placeholder="https://..." value={settings.dark.bgImage} onChange={e => setSettings({...settings, dark: {...settings.dark, bgImage: e.target.value}})} style={{...styles.textInput, flex: 1}} />
              <button type="button" onClick={() => triggerBgUpload('dark')} disabled={isUploadingBg} style={styles.headerBtn} title="Fazer upload para o Storage R2">
                {isUploadingBg && uploadTarget === 'dark' ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              </button>
            </div>
          </label>
        </div>

        <h3 style={subSectionTitle}>Paleta Tema Claro (Light Mode)</h3>
        <div style={styles.settingsGrid}>
          <label style={styles.label}>Cor de Fundo: <input type="color" value={settings.light.bgColor} onChange={e => setSettings({...settings, light: {...settings.light, bgColor: e.target.value}})} style={styles.colorInput} /></label>
          <label style={styles.label}>Cor do Texto Base: <input type="color" value={settings.light.fontColor} onChange={e => setSettings({...settings, light: {...settings.light, fontColor: e.target.value}})} style={styles.colorInput} /></label>
          <label style={styles.label}>Cor dos Títulos (H1/H2): <input type="color" value={settings.light.titleColor} onChange={e => setSettings({...settings, light: {...settings.light, titleColor: e.target.value}})} style={styles.colorInput} /></label>
          <label style={styles.label}>Imagem de Fundo (URL):
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" placeholder="https://..." value={settings.light.bgImage} onChange={e => setSettings({...settings, light: {...settings.light, bgImage: e.target.value}})} style={{...styles.textInput, flex: 1}} />
              <button type="button" onClick={() => triggerBgUpload('light')} disabled={isUploadingBg} style={styles.headerBtn} title="Fazer upload para o Storage R2">
                {isUploadingBg && uploadTarget === 'light' ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              </button>
            </div>
          </label>
        </div>
        
        {/* BLOCO 4: MOTOR DE AVISOS (DISCLAIMERS) */}
        <h2 style={sectionTitle}>
          <ShieldAlert size={18} /> Motor de Avisos (Disclaimers)
        </h2>
        <div style={{...styles.postCard, padding: '24px'}}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
            <input type="checkbox" checked={disclaimers.enabled} onChange={e => setDisclaimers({...disclaimers, enabled: e.target.checked})} style={{ width: '18px', height: '18px', accentColor: activePalette.titleColor }} />
            Exibir Janelas de Aviso antes da leitura dos fragmentos
          </label>

          {disclaimers.enabled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
              {disclaimers.items.map((item, index) => (
                <div key={item.id} style={{...styles.postCard, background: styles.glassBg, padding: '20px', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', opacity: 0.6 }}>AVISO {index + 1}</span>
                    <button type="button" onClick={() => { const newItems = [...disclaimers.items]; newItems.splice(index, 1); setDisclaimers({...disclaimers, items: newItems}); }} style={{ background: 'none', border: 'none', color: '#ea4335', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>REMOVER</button>
                  </div>
                  <input type="text" placeholder="Título (Ex: Termos de Leitura)" value={item.title} onChange={e => { const newItems = [...disclaimers.items]; newItems[index].title = e.target.value; setDisclaimers({...disclaimers, items: newItems}); }} style={{...styles.textInput, width: '100%', marginBottom: '10px', boxSizing: 'border-box'}} />
                  <textarea placeholder="Texto do aviso..." value={item.text} onChange={e => { const newItems = [...disclaimers.items]; newItems[index].text = e.target.value; setDisclaimers({...disclaimers, items: newItems}); }} style={{...styles.textInput, width: '100%', marginBottom: '10px', minHeight: '80px', boxSizing: 'border-box', resize: 'vertical'}} />
                  <input type="text" placeholder="Texto do Botão (Ex: Concordo)" value={item.buttonText} onChange={e => { const newItems = [...disclaimers.items]; newItems[index].buttonText = e.target.value; setDisclaimers({...disclaimers, items: newItems}); }} style={{...styles.textInput, width: '100%', boxSizing: 'border-box', marginBottom: '15px'}} />
                  
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#ec4899', fontWeight: 'bold', cursor: 'pointer' }}>
                     <input type="checkbox" checked={item.isDonationTrigger || false} onChange={e => { const newItems = [...disclaimers.items]; newItems[index].isDonationTrigger = e.target.checked; setDisclaimers({...disclaimers, items: newItems}); }} style={{ cursor: 'pointer', accentColor: '#ec4899' }} />
                     Este aviso funciona como um Gatilho de Doação (Abre o Painel do Mercado Pago)
                  </label>
                </div>
              ))}
              <button type="button" onClick={() => setDisclaimers({...disclaimers, items: [...disclaimers.items, { id: crypto.randomUUID(), title: '', text: '', buttonText: 'Concordo', isDonationTrigger: false }]})} style={{...styles.headerBtn, justifyContent: 'center'}}>
                + ADICIONAR NOVO AVISO
              </button>
            </div>
          )}
        </div>

        {/* BLOCO Endpoint & Auditoria */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '25px', marginBottom: '20px' }}>
          
          <div style={{...styles.postCard, padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', color: activePalette.titleColor }}>
              <Activity size={20} /> <h2 style={{ fontSize: '16px', margin: 0, color: 'inherit' }}>Endpoint de Webhook</h2>
            </div>
            <p style={{ fontSize: '13px', opacity: 0.8, marginBottom: '10px' }}>Copie e cole no painel do Mercado Pago (Notificações Webhooks) para ativar a sincronização em tempo real:</p>
            <div style={{ background: styles.glassBg, padding: '12px', borderRadius: '8px', fontSize: '12px', fontFamily: 'monospace', wordBreak: 'break-all', border: `1px dashed ${styles.glassBorder}` }}>
              https://mainsite-app.lcv.rio.br/api/webhooks/mercadopago
            </div>
          </div>

          <div style={{ ...styles.postCard, padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', color: '#10b981' }}>
              <CheckCircle size={20} /> <h2 style={{ fontSize: '16px', margin: 0, color: 'inherit' }}>Auditoria de Qualidade (100/100)</h2>
            </div>
            <ul style={{ fontSize: '12px', margin: 0, paddingLeft: '20px', lineHeight: '1.8', opacity: 0.8 }}>
              <li>✓ <strong>Obrigatória:</strong> Notificações Webhook Ativas</li>
              <li>✓ <strong>Obrigatória:</strong> Referência Externa (UUID) Mapeada</li>
              <li>✓ <strong>Recomendada:</strong> Payer Email, First/Last Name processados</li>
              <li>✓ <strong>Recomendada:</strong> Objeto Items (id, title, price, qty) injetado</li>
              <li>✓ <strong>Boa Prática:</strong> Consulta Reversa na API de Pagamentos</li>
            </ul>
          </div>

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