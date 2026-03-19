// Module: mainsite-admin/src/components/FinancialPanel.jsx
// Version: v1.11.0
// Description: Dynamic Y-axis positioning for all modals (Refund, Cancel, Delete) based on mouse click coordinates (e.clientY). Status colors swapped as requested (Refunded = Red, Cancelled/Rejected = Orange). Blood-red trash icon preserved.

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom'; // ADDED REACT PORTAL
import { X, DollarSign, RefreshCw, Loader2, RotateCcw, AlertCircle, Check, Ban, Wallet, Trash2, ArrowLeft } from 'lucide-react';

const FinancialPanel = ({ onClose, secret, API_URL, styles, activePalette, isDarkBase }) => {
  const [logs, setLogs] = useState([]);
  const [balance, setBalance] = useState({ available: 0, unavailable: 0 });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  const [modalType, setModalType] = useState(null);
  const [activeTx, setActiveTx] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [panelToast, setPanelToast] = useState({ show: false, message: '', type: 'info' });
  const [logCount, setLogCount] = useState(0);
  const [paymentProvider, setPaymentProvider] = useState('mercadopago');
  const [expandedRow, setExpandedRow] = useState(null);

  const showPanelToast = (message, type = 'info') => {
    setPanelToast({ show: true, message, type });
    setTimeout(() => setPanelToast(prev => ({ ...prev, show: false })), 4000);
  };

  const fetchFinanceData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const logsEndpoint = paymentProvider === 'sumup' ? '/sumup-financial-logs' : '/financial-logs';
      const balanceEndpoint = paymentProvider === 'sumup' ? '/sumup-balance' : '/mp-balance';

      const resLogs = await fetch(`${API_URL}${logsEndpoint}`, { headers: { 'Authorization': `Bearer ${secret}` } });
      if (resLogs.ok) {
        const data = await resLogs.json();
        setLogs(data);
        setLogCount(data.length);
      }

      const resBalance = await fetch(`${API_URL}${balanceEndpoint}`, { headers: { 'Authorization': `Bearer ${secret}` } });
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
  }, [API_URL, secret, paymentProvider]);

  useEffect(() => { fetchFinanceData(); }, [fetchFinanceData]);

  useEffect(() => {
    const intervalId = setInterval(() => fetchFinanceData(false), 600000);
    return () => clearInterval(intervalId);
  }, [fetchFinanceData]);

  useEffect(() => {
    const checkWebhook = async () => {
      try {
        const checkEndpoint = paymentProvider === 'sumup' ? '/sumup-financial-logs/check' : '/financial-logs/check';
        const res = await fetch(`${API_URL}${checkEndpoint}`, { headers: { 'Authorization': `Bearer ${secret}` } });
        if (res.ok) {
          const data = await res.json();
          if (logCount !== 0 && data.count > logCount) {
            showPanelToast(`Novo registro processado via ${paymentProvider === 'sumup' ? 'SumUp' : 'Mercado Pago'}! Atualizando...`, "success");
            fetchFinanceData(true);
          }
          setLogCount(data.count);
        }
      } catch { 
          /* silent fail for background ping */ 
       }
    };
    const pingId = setInterval(checkWebhook, 15000);
    return () => clearInterval(pingId);
  }, [API_URL, secret, logCount, fetchFinanceData, paymentProvider]);

  const executeAction = async () => {
    const { id, dbId } = activeTx;
    const isRefund = modalType === 'refund';
    const isDelete = modalType === 'delete';

    setProcessingId(id);

    // Reset modal states
    setModalType(null);

    try {
      let url;
      let options;

      if (isDelete) {
        const deleteEndpoint = paymentProvider === 'sumup' ? '/sumup-financial-logs' : '/financial-logs';
        url = `${API_URL}${deleteEndpoint}/${dbId}`;
        options = { method: 'DELETE', headers: { 'Authorization': `Bearer ${secret}` } };
      } else {
        const actionBase = paymentProvider === 'sumup' ? '/sumup-payment' : '/mp-payment';
        url = `${API_URL}${actionBase}/${id}/${isRefund ? 'refund' : 'cancel'}`;
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
    } catch { 
      showPanelToast('Ocorreu um erro de rede.', 'error'); 
    } finally { 
      setProcessingId(null); setRefundAmount(''); 
    }
  };

  const closeAndResetModal = () => {
    setModalType(null);
    setRefundAmount('');
  };

  // Extrai campos relevantes do raw_payload da SumUp
  const parseSumupPayload = (rawPayload) => {
    if (!rawPayload) return {};
    try {
      const p = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;
      const tx = p.transactions?.[0] || {};
      return {
        checkoutStatus: p.status,
        checkoutRef: p.checkout_reference,
        transactionCode: tx.transaction_code || p.transaction_code || '—',
        transactionUUID: tx.id || '—',
        paymentType: tx.payment_type || '—',
        authCode: tx.auth_code || '—',
        entryMode: tx.entry_mode || '—',
        currency: tx.currency || p.currency || 'BRL',
        txTimestamp: tx.timestamp,
        internalId: tx.internal_id || '—',
        txStatus: tx.status || '—',
      };
    } catch { return {}; }
  };

  // Config de status para todos os estados SumUp conhecidos
  const getSumupStatusConfig = (status) => {
    const s = (status || '').toLowerCase();
    if (['paid', 'successful', 'approved'].includes(s))
      return { color: '#10b981', bg: 'rgba(16,185,129,0.15)', label: status.toUpperCase(), canRefund: true, canCancel: false };
    if (['pending', 'in_process', 'processing'].includes(s))
      return { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', label: status.toUpperCase(), canRefund: false, canCancel: true };
    if (['failed', 'failure'].includes(s))
      return { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', label: 'FALHOU', canRefund: false, canCancel: false };
    if (s === 'expired')
      return { color: '#6b7280', bg: 'rgba(107,114,128,0.15)', label: 'EXPIRADO', canRefund: false, canCancel: false };
    if (s === 'refunded')
      return { color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)', label: 'ESTORNADO', canRefund: false, canCancel: false };
    if (s === 'partially_refunded')
      return { color: '#a78bfa', bg: 'rgba(167,139,250,0.15)', label: 'EST. PARCIAL', canRefund: true, canCancel: false };
    if (['cancelled', 'cancel', 'canceled'].includes(s))
      return { color: '#f97316', bg: 'rgba(249,115,22,0.15)', label: 'CANCELADO', canRefund: false, canCancel: false };
    if (s.includes('chargeback') || s.includes('charge_back'))
      return { color: '#dc2626', bg: 'rgba(220,38,38,0.15)', label: 'CHARGEBACK', canRefund: false, canCancel: false };
    return { color: '#6b7280', bg: 'rgba(107,114,128,0.15)', label: status?.toUpperCase() || '?', canRefund: false, canCancel: false };
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

      {/* DYNAMIC MODAL USING REACT PORTALS FOR PERFECT VIEWPORT CENTERING */}
      {modalType && createPortal(
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalContent, margin: 0 }}>
            <AlertCircle size={48} color={modalType === 'delete' ? '#b30000' : (modalType === 'cancel' ? '#f59e0b' : '#ea4335')} style={{ marginBottom: '20px', margin: '0 auto' }} />
            
            {modalType === 'delete' ? ( 
              <p style={styles.modalText}>Tem certeza de que deseja <strong>EXCLUIR</strong> este registro de log permanentemente do banco de dados?</p> 
            ) : modalType === 'cancel' ? ( 
              <p style={styles.modalText}>Tem certeza de que deseja <strong>CANCELAR</strong> o pagamento pendente {activeTx.id} no {paymentProvider === 'sumup' ? 'SumUp' : 'Mercado Pago'}?</p> 
            ) : (
              <div>
                <p style={styles.modalText}>Estorno do pagamento <strong>{activeTx.id}</strong> ({paymentProvider === 'sumup' ? 'SumUp' : 'Mercado Pago'}).</p>
                <input type="text" placeholder={`R$ Máximo: ${activeTx.amount.toFixed(2)}`} value={refundAmount} onChange={(e) => setRefundAmount(e.target.value.replace(/[^0-9.,]/g, ''))} style={{ ...styles.textInput, width: '100%', marginBottom: '20px', textAlign: 'center', fontSize: '16px' }} />
              </div>
            )}

            <div style={styles.modalActions}>
              <button onClick={closeAndResetModal} style={styles.modalBtnCancel}>VOLTAR</button>
              <button onClick={executeAction} style={{...styles.modalBtnConfirm, background: modalType === 'delete' ? '#b30000' : (modalType === 'cancel' ? '#f59e0b' : '#ea4335')}}>
                {modalType === 'delete' ? 'EXCLUIR REGISTRO' : (modalType === 'cancel' ? 'CONFIRMAR CANCELAMENTO' : 'CONFIRMAR ESTORNO')}
              </button>
            </div>
          </div>
        </div>,
        document.body // Prevents Glassmorphism CSS from trapping the modal
      )}

      {/* Standardized Back Button */}
      <button onClick={onClose} style={styles.backButton}>
        <ArrowLeft size={16} /> Voltar ao Console
      </button>

      <div style={{ ...glassCard, marginBottom: '20px', padding: '14px 16px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => setPaymentProvider('mercadopago')}
            style={{
              ...actionBtnStyle('14, 165, 233'),
              background: paymentProvider === 'mercadopago' ? 'rgba(14, 165, 233, 0.22)' : (isDarkBase ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
              borderColor: paymentProvider === 'mercadopago' ? 'rgba(14, 165, 233, 0.55)' : (isDarkBase ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'),
              color: paymentProvider === 'mercadopago' ? '#0ea5e9' : activePalette.fontColor,
            }}
          >
            Mercado Pago
          </button>
          <button
            onClick={() => setPaymentProvider('sumup')}
            style={{
              ...actionBtnStyle('79, 70, 229'),
              background: paymentProvider === 'sumup' ? 'rgba(79, 70, 229, 0.22)' : (isDarkBase ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
              borderColor: paymentProvider === 'sumup' ? 'rgba(79, 70, 229, 0.55)' : (isDarkBase ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'),
              color: paymentProvider === 'sumup' ? '#4f46e5' : activePalette.fontColor,
            }}
          >
            SumUp
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <div style={{ ...glassCard, marginBottom: 0, borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '13px', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}><Wallet size={16} /> Saldo Disponível ({paymentProvider === 'sumup' ? 'SumUp' : 'MP'})</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: activePalette.titleColor }}>R$ {balance.available.toFixed(2)}</div>
        </div>
        <div style={{ ...glassCard, marginBottom: 0, borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '13px', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}><RefreshCw size={16} /> Saldo a Liberar ({paymentProvider === 'sumup' ? 'SumUp' : 'MP'})</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: activePalette.titleColor }}>R$ {balance.unavailable.toFixed(2)}</div>
        </div>
      </div>

      <div style={glassCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
          <h2 style={{ fontSize: '16px', margin: 0, color: activePalette.titleColor, display: 'flex', alignItems: 'center', gap: '10px' }}><DollarSign size={20} /> Histórico de Transações e Logs ({paymentProvider === 'sumup' ? 'SumUp' : 'Mercado Pago'})</h2>
          <button onClick={() => fetchFinanceData(true)} style={{ background: 'transparent', border: `1px solid ${isDarkBase ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, color: activePalette.fontColor, padding: '6px 14px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase' }}>
            <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} /> {isRefreshing ? 'ATUALIZANDO...' : 'ATUALIZAR AGORA'}
          </button>
        </div>

        {/* Legenda de status para SumUp */}
        {paymentProvider === 'sumup' && !loading && logs.length > 0 && (() => {
          const counts = {};
          logs.forEach(log => {
            const cfg = getSumupStatusConfig(log.status);
            counts[cfg.label] = (counts[cfg.label] || { color: cfg.color, bg: cfg.bg, n: 0, sum: 0 });
            counts[cfg.label].n++;
            counts[cfg.label].sum += Number(log.amount || 0);
          });
          return (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '18px' }}>
              {Object.entries(counts).map(([label, { color, bg, n, sum }]) => (
                <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: bg, color, border: `1px solid ${color}40` }}>
                  {label} <span style={{ opacity: 0.75 }}>× {n}</span> <span style={{ opacity: 0.6 }}>R$ {sum.toFixed(2)}</span>
                </span>
              ))}
            </div>
          );
        })()}

        {loading ? (<div style={{ display: 'flex', justifyContent: 'center', padding: '30px' }}><Loader2 className="animate-spin" size={24} /></div>
        ) : logs.length === 0 ? (<p style={{ fontSize: '13px', opacity: 0.6, textAlign: 'center' }}>Nenhum log financeiro registrado ainda.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${isDarkBase ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }}>
                  <th style={{ padding: '12px' }}>Data</th>
                  <th style={{ padding: '12px' }}>ID</th>
                  {paymentProvider === 'sumup' && <th style={{ padding: '12px' }}>Código TX</th>}
                  {paymentProvider === 'sumup' && <th style={{ padding: '12px' }}>Tipo</th>}
                  <th style={{ padding: '12px' }}>Status</th>
                  <th style={{ padding: '12px' }}>Valor (R$)</th>
                  <th style={{ padding: '12px' }}>E-mail / Ações</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => {
                  const txId = log.payment_id || log.id;
                  const amount = Number(log.amount || 0);
                  const isExpanded = expandedRow === log.id;

                  // SumUp: usa config completa; MP: compatibilidade
                  let statusCfg, isApproved, isPending;
                  if (paymentProvider === 'sumup') {
                    statusCfg = getSumupStatusConfig(log.status);
                    isApproved = statusCfg.canRefund;
                    isPending = statusCfg.canCancel;
                  } else {
                    const sl = (log.status || '').toLowerCase();
                    isApproved = ['approved', 'successful', 'paid'].includes(sl);
                    isPending = ['pending', 'in_process', 'processing'].includes(sl);
                    const isRefunded = sl.includes('refund');
                    statusCfg = {
                      color: isApproved ? '#10b981' : (isRefunded ? '#ef4444' : '#f59e0b'),
                      bg: isApproved ? 'rgba(16,185,129,0.2)' : (isRefunded ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'),
                      label: (log.status || '').toUpperCase(),
                    };
                  }

                  const sumupInfo = paymentProvider === 'sumup' ? parseSumupPayload(log.raw_payload) : {};

                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        style={{ borderBottom: isExpanded ? 'none' : `1px dashed ${isDarkBase ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`, cursor: paymentProvider === 'sumup' ? 'pointer' : 'default', background: isExpanded ? (isDarkBase ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)') : 'transparent' }}
                        onClick={paymentProvider === 'sumup' ? () => setExpandedRow(isExpanded ? null : log.id) : undefined}
                      >
                        <td style={{ padding: '12px', opacity: 0.8, whiteSpace: 'nowrap' }}>
                          {new Date(log.created_at.replace(' ', 'T') + 'Z').toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                        </td>
                        <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: '11px', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={txId}>
                          {txId}
                        </td>
                        {paymentProvider === 'sumup' && (
                          <td style={{ padding: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: activePalette.titleColor }}>
                            {sumupInfo.transactionCode}
                          </td>
                        )}
                        {paymentProvider === 'sumup' && (
                          <td style={{ padding: '12px', fontSize: '11px', opacity: 0.8 }}>
                            {sumupInfo.paymentType}
                          </td>
                        )}
                        <td style={{ padding: '12px' }}>
                          <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', background: statusCfg.bg, color: statusCfg.color, whiteSpace: 'nowrap' }}>
                            {statusCfg.label}
                          </span>
                        </td>
                        <td style={{ padding: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                          {amount.toFixed(2)}
                        </td>
                        <td style={{ padding: '12px' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                            <span style={{ opacity: 0.7, fontSize: '12px' }}>{log.payer_email !== 'N/A' ? log.payer_email : '—'}</span>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {isApproved && (
                                <button onClick={() => { setActiveTx({ id: txId, dbId: log.id, amount }); setModalType('refund'); }} disabled={processingId === txId} style={actionBtnStyle('245, 158, 11')} title={paymentProvider === 'sumup' ? 'Pode levar até 24h para estar disponível após a liquidação' : ''}>
                                  <RotateCcw size={14} /> Estornar
                                </button>
                              )}
                              {isPending && (
                                <button onClick={() => { setActiveTx({ id: txId, dbId: log.id, amount }); setModalType('cancel'); }} disabled={processingId === txId} style={actionBtnStyle('239, 68, 68')}>
                                  <Ban size={14} /> Cancelar
                                </button>
                              )}
                              <button onClick={() => { setActiveTx({ id: txId, dbId: log.id, amount }); setModalType('delete'); }} disabled={processingId === txId} style={actionBtnStyle('179, 0, 0')} title="Excluir registro">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* Painel de detalhes expansível (apenas SumUp) */}
                      {paymentProvider === 'sumup' && isExpanded && (
                        <tr>
                          <td colSpan={7} style={{ padding: '0', borderBottom: `1px dashed ${isDarkBase ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
                            <div style={{ padding: '16px 20px', background: isDarkBase ? 'rgba(79,70,229,0.08)' : 'rgba(79,70,229,0.04)', borderLeft: '3px solid #4f46e5', margin: '0 12px 12px 12px', borderRadius: '0 8px 8px 0', fontSize: '12px' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                                {[
                                  ['Checkout UUID', txId],
                                  ['Transação UUID', sumupInfo.transactionUUID],
                                  ['Código TX', sumupInfo.transactionCode],
                                  ['Auth Code', sumupInfo.authCode],
                                  ['Tipo de Pagamento', sumupInfo.paymentType],
                                  ['Entry Mode', sumupInfo.entryMode],
                                  ['Status Checkout', sumupInfo.checkoutStatus],
                                  ['Status Transação', sumupInfo.txStatus],
                                  ['Moeda', sumupInfo.currency],
                                  ['ID Interno', String(sumupInfo.internalId)],
                                  ['Checkout Ref', sumupInfo.checkoutRef],
                                  ['Data TX (UTC)', sumupInfo.txTimestamp ? new Date(sumupInfo.txTimestamp).toLocaleString('pt-BR') : '—'],
                                ].map(([label, value]) => (
                                  <div key={label}>
                                    <div style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.5, letterSpacing: '0.5px', marginBottom: '2px' }}>{label}</div>
                                    <div style={{ fontFamily: 'monospace', fontWeight: '600', wordBreak: 'break-all', color: activePalette.titleColor }}>{value || '—'}</div>
                                  </div>
                                ))}
                              </div>
                              {statusCfg.canRefund && (
                                <div style={{ marginTop: '12px', padding: '8px 12px', borderRadius: '6px', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <AlertCircle size={13} /> Estornos SumUp só ficam disponíveis após a liquidação da transação (geralmente em até 24h).
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            {paymentProvider === 'sumup' && <p style={{ fontSize: '11px', opacity: 0.45, textAlign: 'center', marginTop: '12px' }}>Clique em uma linha para ver os detalhes completos da transação.</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default FinancialPanel;