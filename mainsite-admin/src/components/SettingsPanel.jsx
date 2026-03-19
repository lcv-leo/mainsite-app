// Módulo: mainsite-admin/src/components/SettingsPanel.jsx
// Versão: v1.5.0
// Descrição: Painel de Configurações atualizado para o padrão Glassmorphism + Material Design 3 (MD3). Gatilho de doação e Opt-out individual preservados.

import React from 'react';
import { X, Save, Image as ImageIcon, Loader2, Activity, CheckCircle, ArrowLeft, ShieldAlert, Upload } from 'lucide-react';

const SettingsPanel = ({
  settings, setSettings,
  rateLimit, setRateLimit,
  hasUnsavedRateLimit,
  rotation, setRotation,
  disclaimers, setDisclaimers,
  isSaving, onSave, onClose,
  triggerBgUpload, isUploadingBg, uploadTarget,
  styles
}) => {

  const defaultRateLimit = {
    chatbot: { enabled: false, maxRequests: 5, windowMinutes: 1 },
    email: { enabled: false, maxRequests: 3, windowMinutes: 15 }
  };

  const restoreRateLimitSection = (key) => {
    setRateLimit({ ...rateLimit, [key]: { ...defaultRateLimit[key] } });
  };

  const restoreAllRateLimit = () => {
    setRateLimit({ ...defaultRateLimit });
  };

  const glassBlock = {
    padding: 'var(--spacing-xl)',
    background: 'rgba(128, 128, 128, 0.05)',
    backdropFilter: 'blur(var(--glass-blur-standard))',
    WebkitBackdropFilter: 'blur(var(--glass-blur-standard))',
    border: '1px solid rgba(128, 128, 128, 0.15)',
    borderRadius: 'var(--shape-xl)',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    boxShadow: '0 16px 32px rgba(0,0,0,0.05)'
  };

  const sectionTitle = {
    fontSize: 'var(--type-title-md)',
    borderBottom: '1px solid rgba(128, 128, 128, 0.2)',
    paddingBottom: '12px',
    marginTop: '30px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontWeight: '700'
  };

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      <button type="button" onClick={onClose} style={styles.backButton}>
        <ArrowLeft size={16} /> Voltar ao Console
      </button>

      <form onSubmit={onSave} style={styles.form}>
        <div style={{ ...sectionTitle, color: 'var(--semantic-error)', borderColor: 'var(--semantic-error-border)', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}><ShieldAlert size={20} /> Segurança e Custos (Limitação de API)</span>
          {hasUnsavedRateLimit && (
            <span style={{ border: '1px solid #facc15', background: '#fef9c3', color: '#a16207', borderRadius: '999px', padding: '6px 12px', fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Alterações não salvas
            </span>
          )}
          <button
            type="button"
            onClick={restoreAllRateLimit}
            style={{ border: '1px solid var(--semantic-error-border)', background: 'rgba(255,255,255,0.65)', color: 'var(--semantic-error)', borderRadius: '999px', padding: '8px 14px', fontSize: '11px', fontWeight: '800', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.4px' }}
            title="Restaurar padrões para todos os blocos"
          >
            Restaurar padrão (todas)
          </button>
        </div>
        <div style={{ ...glassBlock, border: '1px solid var(--semantic-error-border)', background: 'var(--semantic-error-soft)', gap: '14px' }}>
          {[{
            key: 'chatbot',
            title: 'Uso do Chatbot (IA Pública)',
            help: '* Quando ativado, limita o consumo por IP nas rotas públicas de IA (chat, resumo e tradução).'
          }, {
            key: 'email',
            title: 'Envio de E-mails',
            help: '* Quando ativado, limita por IP os disparos de e-mail no site (contato, comentário e compartilhamento por e-mail).'
          }].map((section) => {
            const cfg = rateLimit[section.key] || { enabled: false, maxRequests: 5, windowMinutes: 1 };
            return (
              <div key={section.key} style={{ border: '1px solid var(--semantic-error-border)', borderRadius: '20px', padding: '16px', background: 'rgba(255,255,255,0.35)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', color: 'var(--semantic-error)' }}>
                    <input
                      type="checkbox"
                      checked={cfg.enabled}
                      onChange={e => setRateLimit({
                        ...rateLimit,
                        [section.key]: { ...cfg, enabled: e.target.checked }
                      })}
                      style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                    />
                    Habilitar Escudo ({section.title})
                  </label>

                  <button
                    type="button"
                    onClick={() => restoreRateLimitSection(section.key)}
                    style={{ border: '1px solid var(--semantic-error-border)', background: '#fff', color: 'var(--semantic-error)', borderRadius: '999px', padding: '7px 12px', fontSize: '10px', fontWeight: '800', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.4px' }}
                    title={`Restaurar padrão para ${section.title}`}
                  >
                    Restaurar padrão
                  </button>
                </div>

                <p style={{ fontSize: '12px', color: 'var(--semantic-error)', opacity: 0.8, margin: 0, lineHeight: '1.6' }}>{section.help}</p>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', alignSelf: 'flex-start', background: 'rgba(255,255,255,0.65)', border: '1px solid var(--semantic-error-border)', borderRadius: '999px', padding: '6px 12px', fontSize: '11px', fontWeight: '800', color: 'var(--semantic-error)', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '999px', background: cfg.enabled ? '#22c55e' : '#94a3b8' }} />
                  {cfg.enabled ? 'Ativo' : 'Inativo'} • {cfg.maxRequests} req / {cfg.windowMinutes} min
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--semantic-error)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    Máximo de Requisições por IP:
                    <input
                      type="number"
                      min="1"
                      value={cfg.maxRequests}
                      onChange={e => setRateLimit({
                        ...rateLimit,
                        [section.key]: { ...cfg, maxRequests: parseInt(e.target.value, 10) || 1 }
                      })}
                      style={{ ...styles.textInput, width: '100%' }}
                      disabled={!cfg.enabled}
                      title={`Máximo de requisições por IP - ${section.title}`}
                    />
                  </label>

                  <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--semantic-error)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    Na Janela de Tempo (Minutos):
                    <input
                      type="number"
                      min="1"
                      value={cfg.windowMinutes}
                      onChange={e => setRateLimit({
                        ...rateLimit,
                        [section.key]: { ...cfg, windowMinutes: parseInt(e.target.value, 10) || 1 }
                      })}
                      style={{ ...styles.textInput, width: '100%' }}
                      disabled={!cfg.enabled}
                      title={`Janela de tempo em minutos - ${section.title}`}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        <h2 style={sectionTitle}>Engenharia de Automação</h2>
        <div style={glassBlock}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
            <input type="checkbox" checked={rotation.enabled} onChange={e => setRotation({ ...rotation, enabled: e.target.checked })} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
            Habilitar Rotação Autônoma da Fila de Textos
          </label>
          <label style={{ fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px' }}>
            Intervalo de Rotação (Minutos):
            <input type="number" min="1" value={rotation.interval} onChange={e => setRotation({ ...rotation, interval: parseInt(e.target.value) || 60 })} style={{ ...styles.textInput, width: '100px' }} disabled={!rotation.enabled} />
          </label>
        </div>

        <h2 style={sectionTitle}>Customização Visual: Multi-Tema</h2>
        <div style={glassBlock}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
            <input type="checkbox" checked={settings.allowAutoMode} onChange={e => setSettings({ ...settings, allowAutoMode: e.target.checked })} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
            Habilitar Modo Automático (Sincroniza com o Sistema Operacional do Leitor)
          </label>
        </div>

        <h3 style={{ fontSize: 'var(--type-label)', marginTop: '10px', borderBottom: '1px solid rgba(128,128,128,0.2)', paddingBottom: '8px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Configurações Globais (Ambos os Temas)</h3>
        <div style={styles.settingsGrid}>
          <label style={styles.label}>Tamanho da Fonte Base (p): <input type="text" placeholder="Ex: 1.15rem" value={settings.shared.fontSize} onChange={e => setSettings({ ...settings, shared: { ...settings.shared, fontSize: e.target.value } })} style={styles.textInput} /></label>
          <label style={styles.label}>Tamanho da Fonte Títulos (H1): <input type="text" placeholder="Ex: 1.8rem" value={settings.shared.titleFontSize} onChange={e => setSettings({ ...settings, shared: { ...settings.shared, titleFontSize: e.target.value } })} style={styles.textInput} /></label>
          <label style={styles.label}>Família da Fonte:
            <select value={settings.shared.fontFamily} onChange={e => setSettings({ ...settings, shared: { ...settings.shared, fontFamily: e.target.value } })} style={styles.textInput}>
              <option value="sans-serif">Sans-Serif (Estilo Google)</option>
              <option value="monospace">Monospace</option>
              <option value="serif">Serif</option>
              <option value="'Courier New', Courier, monospace">Courier New</option>
              <option value="'Times New Roman', Times, serif">Times New Roman</option>
              <option value="system-ui, -apple-system, sans-serif">System UI (Moderno)</option>
            </select>
          </label>
        </div>

        <h3 style={{ fontSize: 'var(--type-label)', marginTop: '10px', borderBottom: '1px solid rgba(128,128,128,0.2)', paddingBottom: '8px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Paleta Tema Escuro (Dark Mode)</h3>
        <div style={styles.settingsGrid}>
          <label style={styles.label}>Cor de Fundo: <input type="color" value={settings.dark.bgColor} onChange={e => setSettings({ ...settings, dark: { ...settings.dark, bgColor: e.target.value } })} style={styles.colorInput} /></label>
          <label style={styles.label}>Cor do Texto Base: <input type="color" value={settings.dark.fontColor} onChange={e => setSettings({ ...settings, dark: { ...settings.dark, fontColor: e.target.value } })} style={styles.colorInput} /></label>
          <label style={styles.label}>Cor dos Títulos (H1/H2): <input type="color" value={settings.dark.titleColor} onChange={e => setSettings({ ...settings, dark: { ...settings.dark, titleColor: e.target.value } })} style={styles.colorInput} /></label>
          <label style={styles.label}>Imagem de Fundo (R2 ou URL externa):
            <div style={{ display: 'flex', gap: '10px' }}>
              <input type="text" placeholder="https://..." value={settings.dark.bgImage} onChange={e => setSettings({ ...settings, dark: { ...settings.dark, bgImage: e.target.value } })} style={{ ...styles.textInput, flex: 1 }} />
              <button type="button" onClick={() => triggerBgUpload('dark')} disabled={isUploadingBg} style={{ ...styles.toolbarBtn, height: '52px', width: '52px', border: '1px solid rgba(128,128,128,0.2)', borderRadius: '16px' }} title="Fazer upload para o Storage R2">
                {isUploadingBg && uploadTarget === 'dark' ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
              </button>
            </div>
          </label>
        </div>

        <h3 style={{ fontSize: 'var(--type-label)', marginTop: '10px', borderBottom: '1px solid rgba(128,128,128,0.2)', paddingBottom: '8px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Paleta Tema Claro (Light Mode)</h3>
        <div style={styles.settingsGrid}>
          <label style={styles.label}>Cor de Fundo: <input type="color" value={settings.light.bgColor} onChange={e => setSettings({ ...settings, light: { ...settings.light, bgColor: e.target.value } })} style={styles.colorInput} /></label>
          <label style={styles.label}>Cor do Texto Base: <input type="color" value={settings.light.fontColor} onChange={e => setSettings({ ...settings, light: { ...settings.light, fontColor: e.target.value } })} style={styles.colorInput} /></label>
          <label style={styles.label}>Cor dos Títulos (H1/H2): <input type="color" value={settings.light.titleColor} onChange={e => setSettings({ ...settings, light: { ...settings.light, titleColor: e.target.value } })} style={styles.colorInput} /></label>
          <label style={styles.label}>Imagem de Fundo (R2 ou URL externa):
            <div style={{ display: 'flex', gap: '10px' }}>
              <input type="text" placeholder="https://..." value={settings.light.bgImage} onChange={e => setSettings({ ...settings, light: { ...settings.light, bgImage: e.target.value } })} style={{ ...styles.textInput, flex: 1 }} />
              <button type="button" onClick={() => triggerBgUpload('light')} disabled={isUploadingBg} style={{ ...styles.toolbarBtn, height: '52px', width: '52px', border: '1px solid rgba(128,128,128,0.2)', borderRadius: '16px' }} title="Fazer upload para o Storage R2">
                {isUploadingBg && uploadTarget === 'light' ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
              </button>
            </div>
          </label>
        </div>

        <h2 style={sectionTitle}>
          <ShieldAlert size={20} /> Janelas de Aviso (Disclaimers Sequenciais)
        </h2>
        <div style={glassBlock}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
            <input type="checkbox" checked={disclaimers.enabled} onChange={e => setDisclaimers({ ...disclaimers, enabled: e.target.checked })} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
            Exibir Janelas de Aviso antes da leitura dos fragmentos
          </label>

          {disclaimers.enabled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '10px' }}>
              {disclaimers.items.map((item, index) => (
                <div key={item.id} style={{ background: 'rgba(128,128,128,0.05)', border: '1px solid rgba(128,128,128,0.2)', padding: '24px', borderRadius: '24px', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '800', opacity: 0.6, letterSpacing: '1px' }}>AVISO {index + 1}</span>
                    <button type="button" onClick={() => { const newItems = [...disclaimers.items]; newItems.splice(index, 1); setDisclaimers({ ...disclaimers, items: newItems }); }} style={{ background: 'var(--semantic-error-soft)', border: '1px solid var(--semantic-error-border)', color: 'var(--semantic-error)', cursor: 'pointer', fontSize: '11px', fontWeight: '800', padding: '6px 12px', borderRadius: '100px', transition: 'all 0.2s' }}>REMOVER</button>
                  </div>
                  <input type="text" placeholder="Título (Ex: Termos de Leitura)" value={item.title} onChange={e => { const newItems = [...disclaimers.items]; newItems[index].title = e.target.value; setDisclaimers({ ...disclaimers, items: newItems }); }} style={{ ...styles.textInput, width: '100%', marginBottom: '15px', boxSizing: 'border-box' }} />
                  <textarea placeholder="Texto do aviso..." value={item.text} onChange={e => { const newItems = [...disclaimers.items]; newItems[index].text = e.target.value; setDisclaimers({ ...disclaimers, items: newItems }); }} style={{ ...styles.textInput, width: '100%', marginBottom: '15px', minHeight: '100px', boxSizing: 'border-box', resize: 'vertical' }} />
                  <input type="text" placeholder="Texto do Botão (Ex: Concordo)" value={item.buttonText} onChange={e => { const newItems = [...disclaimers.items]; newItems[index].buttonText = e.target.value; setDisclaimers({ ...disclaimers, items: newItems }); }} style={{ ...styles.textInput, width: '100%', boxSizing: 'border-box', marginBottom: '20px' }} />

                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#ec4899', fontWeight: '700', cursor: 'pointer', background: 'rgba(236, 72, 153, 0.05)', padding: '12px', borderRadius: '16px', border: '1px solid rgba(236, 72, 153, 0.2)' }}>
                    <input type="checkbox" checked={item.isDonationTrigger || false} onChange={e => { const newItems = [...disclaimers.items]; newItems[index].isDonationTrigger = e.target.checked; setDisclaimers({ ...disclaimers, items: newItems }); }} style={{ cursor: 'pointer', width: '18px', height: '18px' }} />
                    Este aviso funciona como um Gatilho de Doação (Abre o Painel do Mercado Pago)
                  </label>
                </div>
              ))}
              <button type="button" onClick={() => setDisclaimers({ ...disclaimers, items: [...disclaimers.items, { id: crypto.randomUUID(), title: '', text: '', buttonText: 'Concordo', isDonationTrigger: false }] })} style={{ padding: '16px', background: 'transparent', color: 'inherit', border: '2px dashed rgba(128,128,128,0.4)', borderRadius: '100px', cursor: 'pointer', fontWeight: '800', fontSize: '13px', transition: 'all 0.2s', letterSpacing: '1px' }} onMouseOver={(e) => e.currentTarget.style.background = 'rgba(128,128,128,0.1)'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                + ADICIONAR NOVO AVISO
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginTop: '40px', marginBottom: '20px' }}>
          <div style={{ background: 'rgba(128,128,128,0.02)', backdropFilter: 'blur(12px)', border: '1px solid rgba(128,128,128,0.2)', borderRadius: '28px', padding: '30px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', color: '#1a73e8' }}>
              <Activity size={24} /> <h2 style={{ fontSize: '18px', margin: 0, color: 'inherit', fontWeight: '700' }}>Endpoint de Webhook Configurado</h2>
            </div>
            <p style={{ fontSize: '14px', opacity: 0.8, marginBottom: '15px', lineHeight: '1.6' }}>Copie a URL abaixo e cole no painel do Mercado Pago (Aba: Notificações Webhooks) para ativar a sincronização em tempo real:</p>
            <div style={{ background: 'rgba(128,128,128,0.1)', padding: '16px', borderRadius: '16px', fontSize: '13px', fontFamily: 'monospace', wordBreak: 'break-all', border: '1px dashed rgba(128,128,128,0.3)', fontWeight: '600' }}>
              https://mainsite-app.lcv.rio.br/api/webhooks/mercadopago
            </div>
          </div>

          <div style={{ background: 'rgba(128,128,128,0.02)', backdropFilter: 'blur(12px)', border: '1px solid rgba(128,128,128,0.2)', borderRadius: '28px', padding: '30px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', color: '#10b981' }}>
              <CheckCircle size={24} /> <h2 style={{ fontSize: '18px', margin: 0, color: 'inherit', fontWeight: '700' }}>Auditoria de Qualidade (100/100)</h2>
            </div>
            <ul style={{ fontSize: '13px', margin: 0, paddingLeft: '24px', lineHeight: '2', opacity: 0.85, fontWeight: '500' }}>
              <li>✓ <strong>Ação Obrigatória:</strong> Notificações Webhook Ativas</li>
              <li>✓ <strong>Ação Obrigatória:</strong> Referência Externa (UUID) Mapeada</li>
              <li>✓ <strong>Ação Recomendada:</strong> Payer Email, First e Last Name processados</li>
              <li>✓ <strong>Ação Recomendada:</strong> Objeto Items (id, title, price, qty) injetado</li>
              <li>✓ <strong>Boa Prática:</strong> Consulta Reversa Ativa na API de Pagamentos</li>
            </ul>
          </div>
        </div>

        <button type="submit" disabled={isSaving} style={styles.adminButton}>
          {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          SALVAR CONFIGURAÇÕES GLOBAIS
        </button>
      </form>
    </div>
  );
};

export default SettingsPanel;