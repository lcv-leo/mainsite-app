// Module: mainsite-admin/src/components/FinancialPanel.jsx
// Version: v1.11.0
// Description: Dynamic Y-axis positioning for all modals (Refund, Cancel, Delete) based on mouse click coordinates (e.clientY). Status colors swapped as requested (Refunded = Red, Cancelled/Rejected = Orange). Blood-red trash icon preserved.

import React, { useState, useEffect, useCallback } from 'react';
import { X, DollarSign, RefreshCw, Loader2, RotateCcw, AlertCircle, Check, Ban, Wallet, Trash2, ArrowLeft } from 'lucide-react';

const FinancialPanel = ({ onClose, secret, API_URL, styles, activePalette, isDarkBase }) => {
  const [logs, setLogs] = useState([]);
  const [balance, setBalance] = useState({ available: 0, unavailable: 0 });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  const [modalType, setModalType] = useState(null);
  const [activeTx, setActiveTx] = useState(null);
  // New state to hold the Y coordinate of the mouse click
  const [modalPos, setModalPos] = useState(0);

  const [refundAmount, setRefundAmount] = useState('');
  const [panelToast, setPanelToast] = useState({ show: false, message: '', type: 'info' });
  const [logCount, setLogCount] = useState(0);

  const showPanelToast = (message, type = 'info') => {
    setPanelToast({ show: true, message, type });
    setTimeout(() => setPanelToast(prev => ({ ...prev, show: false })), 4000);
  };

  const fetchFinanceData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const resLogs = await fetch(`${API_URL}/financial-logs`, { headers: { 'Authorization': `Bearer ${secret}` } });
      if (resLogs.ok) {
        const data = await resLogs.json();
        setLogs(data);
        setLogCount(data.length);
      }

      const resBalance = await fetch(`${API_URL}/mp-balance`, { headers: { 'Authorization': `Bearer ${secret}` } });
      if (resBalance.ok) {
        const balData = await resBalance.json();
        setBalance({ available: balData.available_balance || 0, unavailable: balData.unavailable_balance || 0 });
      }
    } catch (err) {
      console.error("Erro ao sincronizar dados financeiros", err);
    } finally {
      setLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  }, [API_URL, secret]);

  useEffect(() => { fetchFinanceData(); }, [fetchFinanceData]);

  useEffect(() => {
    const intervalId = setInterval(() => fetchFinanceData(false), 600000);
    return () => clearInterval(intervalId);
  }, [fetchFinanceData]);

  useEffect(() => {
    const checkWebhook = async () => {
      try {
        const res = await fetch(`${API_URL}/financial-logs/check`, { headers: { 'Authorization': `Bearer ${secret}` } });
        if (res.ok) {
          const data = await res.json();
          if (logCount !== 0 && data.count > logCount) {
            showPanelToast("Novo registro processado via Webhook! Atualizando...", "success");
            fetchFinanceData(true);
          }
          setLogCount(data.count);
        }
      } catch (e) { }
    };
    const pingId = setInterval(checkWebhook, 15000);
    return () => clearInterval(pingId);
  }, [API_URL, secret, logCount, fetchFinanceData]);

  const executeAction = async () => {
    const { id, dbId } = activeTx;
    const isRefund = modalType === 'refund';
    const isDelete = modalType === 'delete';

    setProcessingId(id);

    // Reset modal states
    setModalType(null);
    setModalPos(0);

    try {
      let url;
      let options;

      if (isDelete) {
        url = `${API_URL}/financial-logs/${dbId}`;
        options = { method: 'DELETE', headers: { 'Authorization': `Bearer ${secret}` } };
      } else {
        url = `${API_URL}/mp-payment/${id}/${isRefund ? 'refund' : 'cancel'}`;
        options = { method: isRefund ? 'POST' : 'PUT', headers: { 'Authorization': `Bearer ${secret}`, 'Content-Type': 'application/json' } };

        if (isRefund && refundAmount) {
          const amt = parseFloat(refundAmount.replace(',', '.'));
          if (amt > 0 && amt <= activeTx.amount) options.body = JSON.stringify({ amount: amt });
        }
      }

      const res = await fetch(url, options);
      if (res.ok) {
        showPanelToast(isDelete ? 'Registro excluído do banco com sucesso!' : 'Ação concluída com sucesso!', 'success');
        fetchFinanceData(true);
      } else {
        const errData = await res.json();
        showPanelToast(`Falha: ${errData.error}`, 'error');
      }
    } catch (e) { showPanelToast('Ocorreu um erro de rede.', 'error'); }
    finally { setProcessingId(null); setRefundAmount(''); }
  };

  const closeAndResetModal = () => {
    setModalType(null);
    setRefundAmount('');
    setModalPos(0);
  };

  // Glassmorphism local styles
  const glassCard = { background: isDarkBase ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)', border: `1px solid ${isDarkBase ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, borderRadius: '24px', padding: '30px', marginBottom: '24px', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' };
  const actionBtnStyle = (colorBase) => ({ background: isDarkBase ? `rgba(${colorBase}, 0.15)` : `rgba(${colorBase}, 0.1)`, color: `rgb(${colorBase})`, border: `1px solid rgba(${colorBase}, 0.3)`, borderRadius: '12px', padding: '8px 12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', boxShadow: `0 4px 12px rgba(${colorBase}, 0.15)` });

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>

      {/* Toast Notification */}
      <div style={{ ...styles.toast, transform: panelToast.show ? 'translate(-50%, 0)' : 'translate(-50%, -120px)', opacity: panelToast.show ? 1 : 0, backgroundColor: panelToast.type === 'error' ? '#ea4335' : (isDarkBase ? '#1e1e1e' : '#fff'), color: panelToast.type === 'error' ? '#fff' : activePalette.fontColor, zIndex: 10005 }}>
        {panelToast.type === 'error' ? <AlertCircle size={18} /> : <Check size={18} />} <span>{panelToast.message}</span>
      </div>

      {/* Dynamic Modal tied to Mouse Y Coordinate */}
      {modalType && (
        <div style={styles.modalOverlay}>
          <div style={{
            ...styles.modalContent,
            position: 'fixed',
            // Mathematical clamp: prevents modal from clipping off screen bounds
            top: `${Math.min(Math.max(modalPos, 220), window.innerHeight - 220)}px`,
            left: '50%',
            transform: 'translate(-50%, -50%)',
            margin: 0,
            zIndex: 100000
          }}>
            <AlertCircle size={48} color={modalType === 'delete' ? '#b30000' : (modalType === 'cancel' ? '#f59e0b' : '#ea4335')} style={{ marginBottom: '20px', margin: '0 auto' }} />

            {modalType === 'delete' ? (
              <p style={styles.modalText}>Tem certeza de que deseja <strong>EXCLUIR</strong> este registro de log permanentemente do banco de dados?</p>
            ) : modalType === 'cancel' ? (
              <p style={styles.modalText}>Tem certeza de que deseja <strong>CANCELAR</strong> o pagamento pendente {activeTx.id} no Mercado Pago?</p>
            ) : (
              <div>
                <p style={styles.modalText}>Estorno do pagamento <strong>{activeTx.id}</strong>.</p>
                <input type="text" placeholder={`R$ Máximo: ${activeTx.amount.toFixed(2)}`} value={refundAmount} onChange={(e) => setRefundAmount(e.target.value.replace(/[^0-9.,]/g, ''))} style={{ ...styles.textInput, width: '100%', marginBottom: '20px', textAlign: 'center', fontSize: '16px' }} />
              </div>
            )}

            <div style={styles.modalActions}>
              <button onClick={closeAndResetModal} style={styles.modalBtnCancel}>VOLTAR</button>
              <button onClick={executeAction} style={{ ...styles.modalBtnConfirm, background: modalType === 'delete' ? '#b30000' : (modalType === 'cancel' ? '#f59e0b' : '#ea4335') }}>
                {modalType === 'delete' ? 'EXCLUIR REGISTRO' : (modalType === 'cancel' ? 'CONFIRMAR CANCELAMENTO' : 'CONFIRMAR ESTORNO')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standardized Back Button */}
      <button onClick={onClose} style={styles.backButton}>
        <ArrowLeft size={16} /> Voltar ao Console
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <div style={{ ...glassCard, marginBottom: 0, borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '13px', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}><Wallet size={16} /> Saldo Disponível</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: activePalette.titleColor }}>R$ {balance.available.toFixed(2)}</div>
        </div>
        <div style={{ ...glassCard, marginBottom: 0, borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '13px', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}><RefreshCw size={16} /> Saldo a Liberar (Prazos)</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: activePalette.titleColor }}>R$ {balance.unavailable.toFixed(2)}</div>
        </div>
      </div>

      <div style={glassCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
          <h2 style={{ fontSize: '16px', margin: 0, color: activePalette.titleColor, display: 'flex', alignItems: 'center', gap: '10px' }}><DollarSign size={20} /> Histórico de Transações e Logs</h2>
          <button onClick={() => fetchFinanceData(true)} style={{ background: 'transparent', border: `1px solid ${isDarkBase ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, color: activePalette.fontColor, padding: '6px 14px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase' }}>
            <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} /> {isRefreshing ? 'ATUALIZANDO...' : 'ATUALIZAR AGORA'}
          </button>
        </div>

        {loading ? (<div style={{ display: 'flex', justifyContent: 'center', padding: '30px' }}><Loader2 className="animate-spin" size={24} /></div>
        ) : logs.length === 0 ? (<p style={{ fontSize: '13px', opacity: 0.6, textAlign: 'center' }}>Nenhum log financeiro registrado ainda.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${isDarkBase ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }}>
                  <th style={{ padding: '12px' }}>Data</th><th style={{ padding: '12px' }}>ID MP</th><th style={{ padding: '12px' }}>Status</th><th style={{ padding: '12px' }}>Valor (R$)</th><th style={{ padding: '12px' }}>E-mail / Ações</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => {
                  const isPending = log.status === 'pending' || log.status === 'in_process';
                  const isApproved = log.status === 'approved';
                  // Swapped Status Colors: Refunded = Red, Cancelled/Rejected = Orange
                  const isRefunded = log.status.includes('refund');
                  const isCancelled = log.status === 'cancelled' || log.status === 'rejected';

                  const statusBg = isApproved ? 'rgba(16, 185, 129, 0.2)' : (isRefunded ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)');
                  const statusColor = isApproved ? '#10b981' : (isRefunded ? '#ef4444' : '#f59e0b');

                  return (
                    <tr key={log.id} style={{ borderBottom: `1px dashed ${isDarkBase ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>

                      <td style={{ padding: '12px', opacity: 0.8 }}>
                        {new Date(log.created_at.replace(' ', 'T') + 'Z').toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                      </td>

                      <td style={{ padding: '12px', fontFamily: 'monospace' }}>{log.payment_id}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', background: statusBg, color: statusColor }}>
                          {log.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>{log.amount.toFixed(2)}</td>
                      <td style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                        <span style={{ opacity: 0.8 }}>{log.payer_email}</span>

                        <div style={{ display: 'flex', gap: '6px' }}>
                          {/* Capturing e.clientY on click for dynamic modal positioning */}
                          {isApproved && (<button onClick={(e) => { setActiveTx({ id: log.payment_id, dbId: log.id, amount: log.amount }); setModalType('refund'); setModalPos(e.clientY); }} disabled={processingId === log.payment_id} style={actionBtnStyle('245, 158, 11')}> <RotateCcw size={14} /> Estornar</button>)}
                          {isPending && (<button onClick={(e) => { setActiveTx({ id: log.payment_id, dbId: log.id, amount: log.amount }); setModalType('cancel'); setModalPos(e.clientY); }} disabled={processingId === log.payment_id} style={actionBtnStyle('239, 68, 68')}> <Ban size={14} /> Cancelar</button>)}

                          {/* Blood Red Trash Icon (#b30000) */}
                          <button onClick={(e) => { setActiveTx({ id: log.payment_id, dbId: log.id, amount: log.amount }); setModalType('delete'); setModalPos(e.clientY); }} disabled={processingId === log.payment_id} style={actionBtnStyle('179, 0, 0')} title="Excluir este registro">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinancialPanel;