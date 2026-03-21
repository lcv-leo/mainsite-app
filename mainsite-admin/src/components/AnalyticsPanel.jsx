// Module: mainsite-admin/src/components/AnalyticsPanel.jsx
// Version: v1.5.0
// Description: Dynamic Y-axis positioning for the deletion modal based on mouse click coordinates (e.clientY). Horizontal centering preserved. 

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom'; // ADDED REACT PORTAL
import { ArrowLeft, MessageSquare, Share2, Bot, Loader2, Calendar, RefreshCw, Trash2, AlertCircle, BrainCog } from 'lucide-react';
import TelemetryPanel from './TelemetryPanel';

const AnalyticsPanel = ({ onClose, secret, API_URL, styles }) => {
  const [data, setData] = useState({ contacts: [], shares: [], chatLogs: [], chatContextAudit: [] });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [subview, setSubview] = useState(null);

  // State for the MD3 Confirmation Modal with dynamic Y positioning
  const [deleteModal, setDeleteModal] = useState({ show: false, type: '', id: null, posY: 0 });
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchAnalytics = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setIsRefreshing(true);

    try {
      const headers = { 'Authorization': `Bearer ${secret}` };
      const [resContacts, resShares, resChat, resChatAudit] = await Promise.all([
        fetch(`${API_URL}/contact-logs`, { headers }),
        fetch(`${API_URL}/shares`, { headers }),
        fetch(`${API_URL}/chat-logs`, { headers }),
        fetch(`${API_URL}/chat-context-audit`, { headers })
      ]);

      if (!resContacts.ok || !resShares.ok || !resChat.ok || !resChatAudit.ok) throw new Error("Falha ao buscar dados de telemetria na API.");

      setData({
        contacts: await resContacts.json(),
        shares: await resShares.json(),
        chatLogs: await resChat.json(),
        chatContextAudit: await resChatAudit.json()
      });
    } catch (err) { setError(err.message); }
    finally { if (!isSilent) setLoading(false); else setIsRefreshing(false); }
  }, [API_URL, secret]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  useEffect(() => {
    const pollInterval = setInterval(() => fetchAnalytics(true), 15000);
    return () => clearInterval(pollInterval);
  }, [fetchAnalytics]);

  const confirmDelete = async () => {
    setIsDeleting(true);
    const { type, id } = deleteModal;
    let endpoint = '';

    if (type === 'contact') endpoint = `/contact-logs/${id}`;
    if (type === 'share') endpoint = `/shares/${id}`;
    if (type === 'chat') endpoint = `/chat-logs/${id}`;
    if (type === 'audit') endpoint = `/chat-context-audit/${id}`;

    try {
      const res = await fetch(`${API_URL}${endpoint}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${secret}` } });
      if (res.ok) {
        await fetchAnalytics(true);
        // Reset state and clear Y coordinate
        setDeleteModal({ show: false, type: '', id: null, posY: 0 });
      } else {
        throw new Error("Falha ao excluir o registro.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Local MD3 styles
  const blockStyle = {
    background: 'rgba(0, 0, 0, 0.1)', backdropFilter: 'blur(var(--glass-blur-standard))', WebkitBackdropFilter: 'blur(var(--glass-blur-standard))',
    border: '1px solid rgba(128, 128, 128, 0.15)', borderRadius: '24px', padding: '30px', marginBottom: '30px',
    display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)'
  };

  const titleStyle = {
    fontSize: '18px', borderBottom: '1px solid rgba(128, 128, 128, 0.2)', paddingBottom: '15px',
    display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 10px 0', fontWeight: '700'
  };

  const cardStyle = {
    background: 'rgba(242, 242, 242, 0.95)', border: '1px solid rgba(128, 128, 128, 0.2)', padding: '24px',
    borderRadius: '20px', fontSize: '14px', lineHeight: '1.6', transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    backdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column', gap: '12px'
  };

  const dateBadge = {
    display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(0, 0, 0, 0.15)',
    padding: '8px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: '700', opacity: 0.9,
    border: '1px solid rgba(128,128,128,0.2)'
  };

  const actionContainerStyle = { display: 'flex', alignItems: 'center', gap: '15px' };

  const trashBtnStyle = {
    background: 'var(--semantic-error-soft)', border: '1px solid var(--semantic-error-border)', padding: '10px',
    borderRadius: '12px', color: 'var(--semantic-error)', cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(211,47,47,0.15)'
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString.replace(' ', 'T') + 'Z').toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    } catch {
      return dateString;
    }
  };

  const parseJsonArray = (raw, fallback = []) => {
    try {
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>

      {/* SUB-VIEW: TelemetryPanel drill-down para Auditoria de Contexto */}
      {subview === 'audit' && (
        <TelemetryPanel
          type="audit"
          logs={data.chatContextAudit}
          loading={isRefreshing}
          onRefresh={fetchAnalytics}
          onClose={() => setSubview(null)}
          styles={styles}
        />
      )}

      {/* MD3 CONFIRMATION MODAL USING REACT PORTALS (ESCAPES PARENT DOM) */}
      {!subview && deleteModal.show && createPortal(
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalContent, margin: 0 }}>
            <AlertCircle size={56} color="var(--semantic-error)" style={{ margin: '0 auto 20px auto' }} />
            <p style={styles.modalText}>Tem certeza de que deseja <strong>EXCLUIR</strong> este registro de auditoria? Esta ação é irreversível.</p>
            <div style={styles.modalActions}>
              <button onClick={() => setDeleteModal({ show: false, type: '', id: null })} disabled={isDeleting} style={styles.modalBtnCancel}>CANCELAR</button>
              <button onClick={confirmDelete} disabled={isDeleting} style={{...styles.modalBtnConfirm, backgroundColor: 'var(--semantic-error)', boxShadow: '0 4px 12px rgba(211,47,47,0.3)'}}>
                {isDeleting ? <Loader2 size={18} className="animate-spin" /> : 'EXCLUIR'}
              </button>
            </div>
          </div>
        </div>,
        document.body // Injects directly into the root HTML body
      )}

      {!subview && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <button onClick={onClose} style={styles.backButton}>
          <ArrowLeft size={16} /> Voltar ao Console
        </button>
        <button onClick={() => fetchAnalytics(true)} style={{ ...styles.headerBtn, opacity: isRefreshing ? 0.6 : 1 }}>
          <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
          {isRefreshing ? 'Sincronizando...' : 'Sincronizar Auditoria'}
        </button>
      </div>

      {loading ? (<div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Loader2 size={32} className="animate-spin" style={{ opacity: 0.5 }} /></div>
      ) : error ? (<div style={{ color: 'var(--semantic-error)', textAlign: 'center', padding: '20px', fontWeight: 'bold', background: 'var(--semantic-error-soft)', border: '1px solid var(--semantic-error-border)', borderRadius: '16px' }}>{error}</div>
      ) : (
        <>
          <div style={blockStyle}>
            <h2 style={titleStyle}><MessageSquare size={20} /> Formulários de Contato Recebidos</h2>
            {data.contacts.length === 0 ? <div style={{ opacity: 0.5, fontSize: '13px' }}>Nenhum contato registrado.</div> :
              data.contacts.map(item => (
                <div key={item.id} style={cardStyle} onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.01)'} onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <strong style={{ fontSize: '16px' }}>{item.name}</strong>
                      <div style={{ opacity: 0.7, marginTop: '4px', fontSize: '13px' }}>{item.email} {item.phone ? `| ${item.phone}` : ''}</div>
                    </div>
                    <div style={actionContainerStyle}>
                      <div style={dateBadge}><Calendar size={14} /> {formatDate(item.created_at)}</div>
                      {/* Capture e.clientY on click */}
                      <button onClick={(e) => setDeleteModal({ show: true, type: 'contact', id: item.id, posY: e.clientY })} style={trashBtnStyle} title="Excluir Registro"><Trash2 size={16} /></button>
                    </div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.15)', padding: '16px', borderRadius: '16px', fontStyle: 'italic', whiteSpace: 'pre-wrap', border: '1px solid rgba(128,128,128,0.1)' }}>"{item.message}"</div>
                </div>
              ))
            }
          </div>

          <div style={blockStyle}>
            <h2 style={titleStyle}><Share2 size={20} /> Métricas de Compartilhamento</h2>
            {data.shares.length === 0 ? <div style={{ opacity: 0.5, fontSize: '13px' }}>Nenhum compartilhamento registrado.</div> :
              data.shares.map(item => (
                <div key={item.id} style={cardStyle} onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.01)'} onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <strong style={{ color: item.platform === 'whatsapp' ? '#25D366' : item.platform === 'email' ? '#0ea5e9' : '#a3a3a3', textTransform: 'uppercase', marginRight: '10px', fontSize: '12px', background: 'rgba(0,0,0,0.2)', padding: '4px 8px', borderRadius: '8px' }}>
                        {item.platform}
                      </strong>
                      <span style={{ fontWeight: '600', fontSize: '15px' }}>{item.post_title}</span>
                      {item.target && <div style={{ opacity: 0.6, marginTop: '8px', fontSize: '13px', fontWeight: '500' }}>Destino: {item.target}</div>}
                    </div>
                    <div style={actionContainerStyle}>
                      <div style={dateBadge}><Calendar size={14} /> {formatDate(item.created_at)}</div>
                      {/* Capture e.clientY on click */}
                      <button onClick={(e) => setDeleteModal({ show: true, type: 'share', id: item.id, posY: e.clientY })} style={trashBtnStyle} title="Excluir Registro"><Trash2 size={16} /></button>
                    </div>
                  </div>
                </div>
              ))
            }
          </div>

          <div style={blockStyle}>
            <h2 style={titleStyle}><Bot size={20} /> Logs da Consciência Auxiliar (IA)</h2>
            {data.chatLogs.length === 0 ? <div style={{ opacity: 0.5, fontSize: '13px' }}>Nenhum log de IA registrado.</div> :
              data.chatLogs.map(item => (
                <div key={item.id} style={{ ...cardStyle, borderLeft: `4px solid ${item.role === 'user' ? 'rgba(255,255,255,0.3)' : '#3b82f6'}` }} onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.01)'} onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <strong style={{ opacity: 0.9, textTransform: 'uppercase', fontSize: '13px', background: item.role === 'user' ? 'rgba(128,128,128,0.2)' : 'rgba(59, 130, 246, 0.2)', padding: '6px 12px', borderRadius: '100px', display: 'inline-block', marginBottom: '10px' }}>
                        {item.role === 'user' ? '👤 Usuário' : '🤖 Consciência Auxiliar'}
                      </strong>
                      <div style={{ opacity: 0.6, fontSize: '11px', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.5px' }}>Contexto Ativo: {item.context_title || 'Nenhum / Global'}</div>
                    </div>
                    <div style={actionContainerStyle}>
                      <div style={dateBadge}><Calendar size={14} /> {formatDate(item.created_at)}</div>
                      {/* Capture e.clientY on click */}
                      <button onClick={(e) => setDeleteModal({ show: true, type: 'chat', id: item.id, posY: e.clientY })} style={trashBtnStyle} title="Excluir Registro"><Trash2 size={16} /></button>
                    </div>
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: '15px', background: 'rgba(0,0,0,0.1)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(128,128,128,0.05)' }}>{item.message}</div>
                </div>
              ))
            }
          </div>

          <div style={blockStyle}>
            <h2 style={titleStyle}><MessageSquare size={20} /> Auditoria de Contexto do Chatbot
              <button onClick={() => setSubview('audit')} style={{ ...styles.headerBtn, marginLeft: 'auto', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }} title="Ver lista completa no painel detalhado">
                <BrainCog size={14} /> Ver Lista Completa
              </button>
            </h2>
            {data.chatContextAudit.length === 0 ? <div style={{ opacity: 0.5, fontSize: '13px' }}>Nenhum registro de auditoria de contexto ainda.</div> :
              data.chatContextAudit.map((item) => {
                const selectedPosts = parseJsonArray(item.selected_posts_json);
                const termList = parseJsonArray(item.terms_json);
                return (
                  <div key={item.id} style={{ ...cardStyle, borderLeft: '4px solid rgba(14,165,233,0.75)' }} onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.01)'} onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <strong style={{ opacity: 0.9, textTransform: 'uppercase', fontSize: '13px', background: 'rgba(14,165,233,0.2)', padding: '6px 12px', borderRadius: '100px', display: 'inline-block', marginBottom: '10px' }}>
                          🧠 CONTEXTO IA
                        </strong>
                        <div style={{ opacity: 0.72, fontSize: '11px', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.5px' }}>
                          Contexto Ativo: {item.context_title || 'Nenhum / Global'}
                        </div>
                      </div>
                      <div style={actionContainerStyle}>
                        <div style={dateBadge}><Calendar size={14} /> {formatDate(item.created_at)}</div>
                        <button onClick={(e) => setDeleteModal({ show: true, type: 'audit', id: item.id, posY: e.clientY })} style={trashBtnStyle} title="Excluir Registro"><Trash2 size={16} /></button>
                      </div>
                    </div>

                    {termList.length > 0 && (
                      <div style={{ fontSize: '12px', opacity: 0.9 }}>
                        <strong>Termos relevantes:</strong> {termList.join(', ')}
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                      <strong style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px', opacity: 0.85 }}>Publicações selecionadas para contexto</strong>
                      {selectedPosts.length === 0 ? (
                        <div style={{ opacity: 0.6, fontSize: '12px' }}>Sem publicações selecionadas neste ciclo.</div>
                      ) : selectedPosts.slice(0, 10).map((post, idx) => (
                        <div key={`${item.id}-${post.id || idx}`} style={{ fontSize: '12px', lineHeight: '1.5', background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(128,128,128,0.12)', borderRadius: '12px', padding: '10px 12px' }}>
                          <div style={{ fontWeight: '700' }}>#{post.id ?? 'N/A'} — {post.title || 'Sem título'}</div>
                          <div style={{ opacity: 0.72 }}>Score: {post.score ?? 0} {post.created_at ? `| ${formatDate(post.created_at)}` : ''}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            }
          </div>
        </>
      )}
      </>
    )}
    </div>
  );
};

export default AnalyticsPanel;