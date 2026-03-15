// Módulo: mainsite-admin/src/components/AnalyticsPanel.jsx
// Versão: v1.0.0
// Descrição: Dashboard unificado para Auditoria de Contatos, Engajamento e Telemetria de IA.

import React, { useState, useEffect } from 'react';
import { X, MessageSquare, Share2, Bot, Loader2, Calendar } from 'lucide-react';

const AnalyticsPanel = ({ onClose, secret, API_URL, styles }) => {
  const [data, setData] = useState({ contacts: [], shares: [], chatLogs: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const headers = { 'Authorization': `Bearer ${secret}` };
        const [resContacts, resShares, resChat] = await Promise.all([
          fetch(`${API_URL}/contact-logs`, { headers }),
          fetch(`${API_URL}/shares`, { headers }),
          fetch(`${API_URL}/chat-logs`, { headers })
        ]);

        if (!resContacts.ok || !resShares.ok || !resChat.ok) throw new Error("Falha ao buscar dados de telemetria.");

        setData({
          contacts: await resContacts.json(),
          shares: await resShares.json(),
          chatLogs: await resChat.json()
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [API_URL, secret]);

  const blockStyle = { background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '20px', marginBottom: '30px', display: 'flex', flexDirection: 'column', gap: '15px' };
  const titleStyle = { fontSize: '16px', borderBottom: '2px solid #000', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 10px 0' };
  const cardStyle = { background: '#fff', border: '1px solid #e2e8f0', padding: '15px', borderRadius: '6px', fontSize: '13px', lineHeight: '1.6' };
  const dateBadge = { display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', color: '#64748b', fontWeight: 'bold' };

  return (
    <div style={styles.panelOverlay}>
      <div style={styles.panelContainer}>
        <div style={styles.panelHeader}>
          <h2>Painel de Auditoria & Engajamento</h2>
          <button onClick={onClose} style={styles.closeBtn}><X size={24} /></button>
        </div>
        
        <div style={styles.panelContent}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Loader2 size={32} className="animate-spin text-gray-500" /></div>
          ) : error ? (
            <div style={{ color: '#ef4444', textAlign: 'center', padding: '20px', fontWeight: 'bold' }}>{error}</div>
          ) : (
            <>
              {/* BLOCO 1: FORMULÁRIOS DE CONTATO */}
              <div style={blockStyle}>
                <h2 style={titleStyle}><MessageSquare size={18} /> Formulários de Contato Recebidos</h2>
                {data.contacts.length === 0 ? <div style={{opacity: 0.5}}>Nenhum contato registrado.</div> : 
                  data.contacts.map(item => (
                    <div key={item.id} style={cardStyle}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <strong>{item.name}</strong>
                        <div style={dateBadge}><Calendar size={12}/> {new Date(item.created_at).toLocaleString('pt-BR')}</div>
                      </div>
                      <div style={{ color: '#64748b', marginBottom: '10px' }}>{item.email} {item.phone ? `| ${item.phone}` : ''}</div>
                      <div style={{ background: '#f1f5f9', padding: '10px', borderRadius: '4px', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>"{item.message}"</div>
                    </div>
                  ))
                }
              </div>

              {/* BLOCO 2: COMPARTILHAMENTOS */}
              <div style={blockStyle}>
                <h2 style={titleStyle}><Share2 size={18} /> Métricas de Compartilhamento</h2>
                {data.shares.length === 0 ? <div style={{opacity: 0.5}}>Nenhum compartilhamento registrado.</div> : 
                  data.shares.map(item => (
                    <div key={item.id} style={cardStyle}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong style={{ color: item.platform === 'whatsapp' ? '#25D366' : item.platform === 'email' ? '#0ea5e9' : '#64748b', textTransform: 'uppercase', marginRight: '10px' }}>[{item.platform}]</strong>
                          {item.post_title}
                        </div>
                        <div style={dateBadge}><Calendar size={12}/> {new Date(item.created_at).toLocaleString('pt-BR')}</div>
                      </div>
                      {item.target && <div style={{ color: '#64748b', marginTop: '5px', fontSize: '11px' }}>Destino: {item.target}</div>}
                    </div>
                  ))
                }
              </div>

              {/* BLOCO 3: TELEMETRIA DA IA */}
              <div style={blockStyle}>
                <h2 style={titleStyle}><Bot size={18} /> Logs do Assistente Virtual (IA)</h2>
                {data.chatLogs.length === 0 ? <div style={{opacity: 0.5}}>Nenhum log de IA registrado.</div> : 
                  data.chatLogs.map(item => (
                    <div key={item.id} style={{ ...cardStyle, borderLeft: `4px solid ${item.role === 'user' ? '#94a3b8' : '#3b82f6'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <strong style={{ color: item.role === 'user' ? '#475569' : '#2563eb', textTransform: 'uppercase' }}>{item.role === 'user' ? '👤 Usuário' : '🤖 IA (Gemini)'}</strong>
                        <div style={dateBadge}><Calendar size={12}/> {new Date(item.created_at).toLocaleString('pt-BR')}</div>
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '10px', marginBottom: '8px', textTransform: 'uppercase' }}>Contexto: {item.context_title || 'Nenhum'}</div>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{item.message}</div>
                    </div>
                  ))
                }
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPanel;