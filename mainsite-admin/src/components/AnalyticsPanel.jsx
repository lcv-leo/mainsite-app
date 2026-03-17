// Módulo: mainsite-admin/src/components/AnalyticsPanel.jsx
// Versão: v1.2.1
// Descrição: Dashboard consolidado. Envelopamento Glassmorphism, motor de Long Polling (10s) e formatação nativa de datas SQLite forçada para o fuso oficial de Brasília (America/Sao_Paulo).

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, MessageSquare, Share2, Bot, Loader2, Calendar, RefreshCw } from 'lucide-react';

const AnalyticsPanel = ({ onClose, secret, API_URL, styles }) => {
  const [data, setData] = useState({ contacts: [], shares: [], chatLogs: [] });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchAnalytics = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setIsRefreshing(true);

    try {
      const headers = { 'Authorization': `Bearer ${secret}` };
      const [resContacts, resShares, resChat] = await Promise.all([
        fetch(`${API_URL}/contact-logs`, { headers }),
        fetch(`${API_URL}/shares`, { headers }),
        fetch(`${API_URL}/chat-logs`, { headers })
      ]);

      if (!resContacts.ok || !resShares.ok || !resChat.ok) {
        throw new Error("Falha ao buscar dados de telemetria na API.");
      }

      setData({
        contacts: await resContacts.json(),
        shares: await resShares.json(),
        chatLogs: await resChat.json()
      });
    } catch (err) {
      setError(err.message);
    } finally {
      if (!isSilent) setLoading(false);
      else setIsRefreshing(false);
    }
  }, [API_URL, secret]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    const pollInterval = setInterval(() => {
      fetchAnalytics(true);
    }, 10000);
    return () => clearInterval(pollInterval);
  }, [fetchAnalytics]);

  const blockStyle = { 
    background: 'rgba(0, 0, 0, 0.15)', 
    border: '1px solid rgba(128, 128, 128, 0.15)', 
    borderRadius: '16px', 
    padding: '24px', 
    marginBottom: '30px', 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '15px' 
  };
  
  const titleStyle = { 
    fontSize: '16px', 
    borderBottom: '1px solid rgba(128, 128, 128, 0.2)', 
    paddingBottom: '12px', 
    display: 'flex', 
    alignItems: 'center', 
    gap: '8px', 
    margin: '0 0 10px 0',
    fontWeight: '600'
  };
  
  const cardStyle = { 
    background: 'rgba(255, 255, 255, 0.05)', 
    border: '1px solid rgba(128, 128, 128, 0.1)', 
    padding: '20px', 
    borderRadius: '12px', 
    fontSize: '13px', 
    lineHeight: '1.6',
    transition: 'transform 0.2s, box-shadow 0.2s'
  };
  
  const dateBadge = { 
    display: 'inline-flex', 
    alignItems: 'center', 
    gap: '6px', 
    background: 'rgba(0, 0, 0, 0.25)', 
    padding: '6px 10px', 
    borderRadius: '6px', 
    fontSize: '11px', 
    fontWeight: 'bold',
    opacity: 0.9
  };

  // CORREÇÃO: Fuso horário de Brasília forçado
  const formatDate = (dateString) => {
    try {
      return new Date(dateString.replace(' ', 'T') + 'Z').toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    } catch (e) {
      return dateString;
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <button onClick={onClose} style={styles.backButton}>
          <ArrowLeft size={16} /> Voltar ao Console
        </button>
        
        <button onClick={() => fetchAnalytics(true)} style={{...styles.headerBtn, borderColor: 'rgba(128,128,128,0.3)', opacity: isRefreshing ? 0.6 : 1}}>
          <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} /> 
          {isRefreshing ? 'Sincronizando...' : 'Sincronizar Telemetria'}
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <Loader2 size={32} className="animate-spin" style={{ opacity: 0.5 }} />
        </div>
      ) : error ? (
        <div style={{ color: '#ea4335', textAlign: 'center', padding: '20px', fontWeight: 'bold', background: 'rgba(234, 67, 53, 0.1)', borderRadius: '8px' }}>
          {error}
        </div>
      ) : (
        <>
          <div style={blockStyle}>
            <h2 style={titleStyle}><MessageSquare size={18} /> Formulários de Contato Recebidos</h2>
            {data.contacts.length === 0 ? <div style={{opacity: 0.5, fontSize: '13px'}}>Nenhum contato registrado.</div> : 
              data.contacts.map(item => (
                <div key={item.id} style={cardStyle} onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <strong style={{ fontSize: '15px' }}>{item.name}</strong>
                    <div style={dateBadge}><Calendar size={12}/> {formatDate(item.created_at)}</div>
                  </div>
                  <div style={{ opacity: 0.7, marginBottom: '12px' }}>{item.email} {item.phone ? `| ${item.phone}` : ''}</div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>"{item.message}"</div>
                </div>
              ))
            }
          </div>

          <div style={blockStyle}>
            <h2 style={titleStyle}><Share2 size={18} /> Métricas de Compartilhamento</h2>
            {data.shares.length === 0 ? <div style={{opacity: 0.5, fontSize: '13px'}}>Nenhum compartilhamento registrado.</div> : 
              data.shares.map(item => (
                <div key={item.id} style={cardStyle} onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ color: item.platform === 'whatsapp' ? '#25D366' : item.platform === 'email' ? '#0ea5e9' : '#a3a3a3', textTransform: 'uppercase', marginRight: '10px' }}>
                        [{item.platform}]
                      </strong>
                      {item.post_title}
                    </div>
                    <div style={dateBadge}><Calendar size={12}/> {formatDate(item.created_at)}</div>
                  </div>
                  {item.target && <div style={{ opacity: 0.6, marginTop: '8px', fontSize: '12px' }}>Destino: {item.target}</div>}
                </div>
              ))
            }
          </div>

          <div style={blockStyle}>
            <h2 style={titleStyle}><Bot size={18} /> Logs da Consciência Auxiliar (IA)</h2>
            {data.chatLogs.length === 0 ? <div style={{opacity: 0.5, fontSize: '13px'}}>Nenhum log de IA registrado.</div> : 
              data.chatLogs.map(item => (
                <div key={item.id} style={{ ...cardStyle, borderLeft: `4px solid ${item.role === 'user' ? 'rgba(255,255,255,0.3)' : '#3b82f6'}` }} onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <strong style={{ opacity: 0.9, textTransform: 'uppercase', fontSize: '12px' }}>
                      {item.role === 'user' ? '👤 Usuário' : '🤖 Consciência Auxiliar'}
                    </strong>
                    <div style={dateBadge}><Calendar size={12}/> {formatDate(item.created_at)}</div>
                  </div>
                  <div style={{ opacity: 0.5, fontSize: '10px', marginBottom: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}>Contexto Ativo: {item.context_title || 'Nenhum / Global'}</div>
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: '14px' }}>{item.message}</div>
                </div>
              ))
            }
          </div>
        </>
      )}
    </div>
  );
};

export default AnalyticsPanel;