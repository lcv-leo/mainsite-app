// Módulo: mainsite-admin/src/components/AnalyticsPanel.jsx
// Versão: v1.3.1
// Descrição: Corrigido layout para evitar sobreposição de data/ícone. Unificado e limpo o design dos cards e seções de log, removendo fundos e padronizando bordas para um visual mais coeso e alinhado ao Glassmorphism.

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, MessageSquare, Share2, Bot, Loader2, Calendar, RefreshCw, Trash2, AlertCircle } from 'lucide-react';

const AnalyticsPanel = ({ onClose, secret, API_URL, styles }) => {
  const [data, setData] = useState({ contacts: [], shares: [], chatLogs: [] });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState({ show: false, id: null, type: null });

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
      setError(null);
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

  const handleDelete = (id, type) => {
    const endpointMap = {
      contact: 'contact-logs',
      share: 'shares',
      chat: 'chat-logs'
    };
    setModal({ show: true, id, type: endpointMap[type] });
  };

  const confirmDelete = async () => {
    const { id, type } = modal;
    if (!id || !type) return;

    try {
      const res = await fetch(`${API_URL}/${type}/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${secret}` }
      });
      if (!res.ok) throw new Error(`Falha ao excluir o registro de ${type}.`);
      
      setModal({ show: false, id: null, type: null });
      fetchAnalytics(true);

    } catch (err) {
      setError(err.message);
      setModal({ show: false, id: null, type: null });
    }
  };

  const consistentBorder = '1px solid rgba(128, 128, 128, 0.2)';

  const blockStyle = { 
    background: 'transparent', 
    border: consistentBorder, 
    borderRadius: '16px', 
    padding: '24px', 
    marginBottom: '30px', 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '15px' 
  };
  
  const titleStyle = { 
    fontSize: '16px', 
    borderBottom: consistentBorder, 
    paddingBottom: '12px', 
    display: 'flex', 
    alignItems: 'center', 
    gap: '8px', 
    margin: '0 0 10px 0',
    fontWeight: '600'
  };
  
  const cardStyle = { 
    background: 'rgba(255, 255, 255, 0.03)', 
    border: consistentBorder,
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
    opacity: 0.9,
    flexShrink: 0
  };

  const deleteBtnStyle = {
    background: 'rgba(234, 67, 53, 0.1)',
    color: '#f5c2c2',
    border: '1px solid rgba(234, 67, 53, 0.2)',
    borderRadius: '6px',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'background 0.2s ease',
    flexShrink: 0
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString.replace(' ', 'T') + 'Z').toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    } catch (e) {
      return dateString;
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      {modal.show && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <AlertCircle size={48} color="#ea4335" style={{ marginBottom: '20px' }} />
            <p style={styles.modalText}>Deseja excluir este registro permanentemente? A ação não pode ser desfeita.</p>
            <div style={styles.modalActions}>
              <button onClick={() => setModal({ show: false, id: null, type: null })} style={styles.modalBtnCancel}>CANCELAR</button>
              <button onClick={confirmDelete} style={styles.modalBtnConfirm}>EXCLUIR</button>
            </div>
          </div>
        </div>
      )}

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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', gap: '15px' }}>
                    <strong style={{ fontSize: '15px' }}>{item.name}</strong>
                    <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                      <div style={dateBadge}><Calendar size={12}/> {formatDate(item.created_at)}</div>
                      <button onClick={() => handleDelete(item.id, 'contact')} style={deleteBtnStyle} title="Excluir este registro" onMouseOver={(e) => e.currentTarget.style.background = 'rgba(234, 67, 53, 0.2)'} onMouseOut={(e) => e.currentTarget.style.background = 'rgba(234, 67, 53, 0.1)'}>
                        <Trash2 size={16} />
                      </button>
                    </div>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px' }}>
                    <div>
                      <strong style={{ color: item.platform === 'whatsapp' ? '#25D366' : item.platform === 'email' ? '#0ea5e9' : '#a3a3a3', textTransform: 'uppercase', marginRight: '10px' }}>
                        [{item.platform}]
                      </strong>
                      {item.post_title}
                    </div>
                    <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                      <div style={dateBadge}><Calendar size={12}/> {formatDate(item.created_at)}</div>
                      <button onClick={() => handleDelete(item.id, 'share')} style={deleteBtnStyle} title="Excluir este registro" onMouseOver={(e) => e.currentTarget.style.background = 'rgba(234, 67, 53, 0.2)'} onMouseOut={(e) => e.currentTarget.style.background = 'rgba(234, 67, 53, 0.1)'}>
                        <Trash2 size={16} />
                      </button>
                    </div>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '15px' }}>
                    <strong style={{ opacity: 0.9, textTransform: 'uppercase', fontSize: '12px' }}>
                      {item.role === 'user' ? '👤 Usuário' : '🤖 Consciência Auxiliar'}
                    </strong>
                    <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                      <div style={dateBadge}><Calendar size={12}/> {formatDate(item.created_at)}</div>
                      <button onClick={() => handleDelete(item.id, 'chat')} style={deleteBtnStyle} title="Excluir este registro" onMouseOver={(e) => e.currentTarget.style.background = 'rgba(234, 67, 53, 0.2)'} onMouseOut={(e) => e.currentTarget.style.background = 'rgba(234, 67, 53, 0.1)'}>
                        <Trash2 size={16} />
                      </button>
                    </div>
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