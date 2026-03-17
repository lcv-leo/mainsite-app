// Módulo: mainsite-admin/src/components/FinancialPanel.jsx
// Versão: v1.3.0
// Descrição: Remoção das APIs nativas do navegador (confirm/alert). Implementação de Modal de Confirmação e Toast de notificação 100% customizados, herdando o Glassmorphism do objeto styles.

import React, { useState, useEffect, useCallback } from 'react';
import { X, DollarSign, RefreshCw, Loader2, RotateCcw, AlertCircle, Check } from 'lucide-react';

const FinancialPanel = ({ onClose, secret, API_URL, styles, activePalette, isDarkBase }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refundingId, setRefundingId] = useState(null); 
  
  // Estados para UI Customizada (Substituindo confirm e alert do navegador)
  const [confirmModal, setConfirmModal] = useState({ show: false, paymentId: null });
  const [panelToast, setPanelToast] = useState({ show: false, message: '', type: 'info' });

  const showPanelToast = (message, type = 'info') => {
    setPanelToast({ show: true, message, type });
    setTimeout(() => setPanelToast(prev => ({ ...prev, show: false })), 4000);
  };

  const fetchLogs = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const res = await fetch(`${API_URL}/financial-logs`, {
        headers: { 'Authorization': `Bearer ${secret}` }
      });
      if (res.ok) setLogs(await res.json());
    } catch (err) {
      console.error("Erro ao buscar logs financeiros", err);
    } finally {
      setLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  }, [API_URL, secret]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchLogs(false); 
    }, 15000);
    return () => clearInterval(intervalId); 
  }, [fetchLogs]);

  // Função que executa o estorno de fato após a confirmação no Modal
  const executeRefund = async () => {
    const paymentId = confirmModal.paymentId;
    setConfirmModal({ show: false, paymentId: null });
    setRefundingId(paymentId);
    
    try {
      const res = await fetch(`${API_URL}/mp-payment/${paymentId}/refund`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${secret}` }
      });
      
      if (res.ok) {
        showPanelToast(`Estorno do pagamento ${paymentId} realizado com sucesso!`, 'success');
        fetchLogs(true);
      } else {
        const errData = await res.json();
        showPanelToast(`Falha ao estornar: ${errData.error}`, 'error');
      }
    } catch (e) {
      showPanelToast('Ocorreu um erro de rede ao tentar processar o estorno.', 'error');
    } finally {
      setRefundingId(null);
    }
  };

  const glassCard = {
    background: isDarkBase ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)',
    border: `1px solid ${isDarkBase ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '24px'
  };

  const refreshBtnStyle = {
    background: 'transparent',
    border: `1px solid ${isDarkBase ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
    color: activePalette.fontColor,
    padding: '6px 14px',
    borderRadius: '8px',
    fontSize: '11px',
    fontWeight: 'bold',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s',
    textTransform: 'uppercase'
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      
      {/* TOAST CUSTOMIZADO DO PAINEL */}
      <div style={{ ...styles.toast, transform: panelToast.show ? 'translate(-50%, 0)' : 'translate(-50%, -120px)', opacity: panelToast.show ? 1 : 0, backgroundColor: panelToast.type === 'error' ? '#ea4335' : (isDarkBase ? '#1e1e1e' : '#fff'), color: panelToast.type === 'error' ? '#fff' : activePalette.fontColor, zIndex: 10005 }}>
        {panelToast.type === 'error' ? <AlertCircle size={18} /> : <Check size={18} />} <span>{panelToast.message}</span>
      </div>

      {/* MODAL CUSTOMIZADO DE CONFIRMAÇÃO DE ESTORNO */}
      {confirmModal.show && (
        <div style={{ ...styles.modalOverlay, zIndex: 10000 }}>
          <div style={styles.modalContent}>
            <AlertCircle size={48} color="#ea4335" style={{ marginBottom: '20px', margin: '0 auto' }} />
            <p style={styles.modalText}>Tem certeza de que deseja DEVOLVER integralmente o pagamento <strong>{confirmModal.paymentId}</strong>? O dinheiro retornará para o doador e a ação é irreversível.</p>
            <div style={styles.modalActions}>
              <button onClick={() => setConfirmModal({ show: false, paymentId: null })} style={styles.modalBtnCancel}>CANCELAR</button>
              <button onClick={executeRefund} style={styles.modalBtnConfirm}>ESTORNAR</button>
            </div>
          </div>
        </div>
      )}

      <button onClick={onClose} style={styles.backButton}>
        <X size={18} /> FECHAR PAINEL FINANCEIRO
      </button>

      <div style={glassCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
          <h2 style={{ fontSize: '16px', margin: 0, color: activePalette.titleColor, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <DollarSign size={20} /> Histórico de Transações e Logs (D1)
          </h2>
          
          <button 
            onClick={() => fetchLogs(true)} 
            style={refreshBtnStyle}
            onMouseOver={(e) => e.currentTarget.style.background = isDarkBase ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} /> 
            {isRefreshing ? 'ATUALIZANDO...' : 'ATUALIZAR AGORA'}
          </button>
        </div>
        
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '30px' }}><Loader2 className="animate-spin" size={24} /></div>
        ) : logs.length === 0 ? (
          <p style={{ fontSize: '13px', opacity: 0.6, textAlign: 'center' }}>Nenhum log financeiro registrado ainda.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${isDarkBase ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }}>
                  <th style={{ padding: '12px' }}>Data</th>
                  <th style={{ padding: '12px' }}>ID MP</th>
                  <th style={{ padding: '12px' }}>Status</th>
                  <th style={{ padding: '12px' }}>Valor (R$)</th>
                  <th style={{ padding: '12px' }}>Método</th>
                  <th style={{ padding: '12px' }}>E-mail / Ação</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} style={{ borderBottom: `1px dashed ${isDarkBase ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
                    <td style={{ padding: '12px', opacity: 0.8 }}>{new Date(log.created_at).toLocaleString('pt-BR')}</td>
                    <td style={{ padding: '12px', fontFamily: 'monospace' }}>{log.payment_id}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', background: log.status === 'approved' ? 'rgba(16, 185, 129, 0.2)' : (log.status === 'refunded' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'), color: log.status === 'approved' ? '#10b981' : (log.status === 'refunded' ? '#ef4444' : '#f59e0b') }}>
                        {log.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontWeight: 'bold' }}>{log.amount.toFixed(2)}</td>
                    <td style={{ padding: '12px', opacity: 0.8, textTransform: 'capitalize' }}>{log.method}</td>
                    <td style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                      <span style={{ opacity: 0.8 }}>{log.payer_email}</span>
                      
                      {log.status === 'approved' && (
                        <button
                          onClick={() => setConfirmModal({ show: true, paymentId: log.payment_id })}
                          disabled={refundingId === log.payment_id}
                          title="Devolver / Estornar Pagamento"
                          style={{
                            background: isDarkBase ? 'rgba(234, 67, 53, 0.15)' : 'rgba(234, 67, 53, 0.1)',
                            color: '#ea4335',
                            border: '1px solid rgba(234, 67, 53, 0.3)',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: refundingId === log.payment_id ? 'wait' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s',
                          }}
                          onMouseOver={(e) => { if (refundingId !== log.payment_id) { e.currentTarget.style.background = '#ea4335'; e.currentTarget.style.color = '#fff'; } }}
                          onMouseOut={(e) => { if (refundingId !== log.payment_id) { e.currentTarget.style.background = isDarkBase ? 'rgba(234, 67, 53, 0.15)' : 'rgba(234, 67, 53, 0.1)'; e.currentTarget.style.color = '#ea4335'; } }}
                        >
                          {refundingId === log.payment_id ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                          Estornar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinancialPanel;