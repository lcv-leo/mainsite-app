// Módulo: mainsite-admin/src/components/FinancialPanel.jsx
// Versão: v1.4.0
// Descrição: UI avançada do Painel Financeiro. Adição do visor de Saldo (Balance), Cancelamento de Pagamentos Pendentes e Estorno Parcial Dinâmico via Modais Customizados.

import React, { useState, useEffect, useCallback } from 'react';
import { X, DollarSign, RefreshCw, Loader2, RotateCcw, AlertCircle, Check, Ban, Wallet } from 'lucide-react';

const FinancialPanel = ({ onClose, secret, API_URL, styles, activePalette, isDarkBase }) => {
  const [logs, setLogs] = useState([]);
  const [balance, setBalance] = useState({ available: 0, unavailable: 0 });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState(null); 
  
  // Modais Avançados
  const [modalType, setModalType] = useState(null); // 'refund' ou 'cancel'
  const [activeTx, setActiveTx] = useState(null); // { id, amount }
  const [refundAmount, setRefundAmount] = useState('');
  
  const [panelToast, setPanelToast] = useState({ show: false, message: '', type: 'info' });

  const showPanelToast = (message, type = 'info') => {
    setPanelToast({ show: true, message, type });
    setTimeout(() => setPanelToast(prev => ({ ...prev, show: false })), 4000);
  };

  const fetchFinanceData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      // Busca Logs
      const resLogs = await fetch(`${API_URL}/financial-logs`, { headers: { 'Authorization': `Bearer ${secret}` } });
      if (resLogs.ok) setLogs(await resLogs.json());

      // Busca Saldo
      const resBalance = await fetch(`${API_URL}/mp-balance`, { headers: { 'Authorization': `Bearer ${secret}` } });
      if (resBalance.ok) {
        const balData = await resBalance.json();
        setBalance({
          available: balData.available_balance || 0,
          unavailable: balData.unavailable_balance || 0
        });
      }
    } catch (err) {
      console.error("Erro ao sincronizar dados financeiros", err);
    } finally {
      setLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  }, [API_URL, secret]);

  useEffect(() => {
    fetchFinanceData();
  }, [fetchFinanceData]);

  useEffect(() => {
    const intervalId = setInterval(() => fetchFinanceData(false), 15000);
    return () => clearInterval(intervalId); 
  }, [fetchFinanceData]);

  // Ação Combinada (Estorno ou Cancelamento)
  const executeAction = async () => {
    const { id, type } = activeTx;
    const isRefund = modalType === 'refund';
    setProcessingId(id);
    setModalType(null); // Fecha o modal
    
    try {
      let url = `${API_URL}/mp-payment/${id}/${isRefund ? 'refund' : 'cancel'}`;
      let options = { method: isRefund ? 'POST' : 'PUT', headers: { 'Authorization': `Bearer ${secret}`, 'Content-Type': 'application/json' } };
      
      // Anexa o valor fracionado se for um estorno parcial
      if (isRefund && refundAmount) {
        const amt = parseFloat(refundAmount.replace(',', '.'));
        if (amt > 0 && amt <= activeTx.amount) {
          options.body = JSON.stringify({ amount: amt });
        }
      }

      const res = await fetch(url, options);
      
      if (res.ok) {
        showPanelToast(`Ação concluída com sucesso no Mercado Pago!`, 'success');
        fetchFinanceData(true);
      } else {
        const errData = await res.json();
        showPanelToast(`Falha: ${errData.error}`, 'error');
      }
    } catch (e) {
      showPanelToast('Ocorreu um erro de rede ao contactar o servidor.', 'error');
    } finally {
      setProcessingId(null);
      setRefundAmount('');
    }
  };

  const glassCard = {
    background: isDarkBase ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)',
    border: `1px solid ${isDarkBase ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
    borderRadius: '16px', padding: '24px', marginBottom: '24px'
  };

  const actionBtnStyle = (colorBase) => ({
    background: isDarkBase ? `rgba(${colorBase}, 0.15)` : `rgba(${colorBase}, 0.1)`,
    color: `rgb(${colorBase})`, border: `1px solid rgba(${colorBase}, 0.3)`,
    borderRadius: '6px', padding: '6px 10px', fontSize: '11px', fontWeight: 'bold',
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s',
  });

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      
      {/* TOAST E MODAIS DE AÇÃO */}
      <div style={{ ...styles.toast, transform: panelToast.show ? 'translate(-50%, 0)' : 'translate(-50%, -120px)', opacity: panelToast.show ? 1 : 0, backgroundColor: panelToast.type === 'error' ? '#ea4335' : (isDarkBase ? '#1e1e1e' : '#fff'), color: panelToast.type === 'error' ? '#fff' : activePalette.fontColor, zIndex: 10005 }}>
        {panelToast.type === 'error' ? <AlertCircle size={18} /> : <Check size={18} />} <span>{panelToast.message}</span>
      </div>

      {modalType && (
        <div style={{ ...styles.modalOverlay, zIndex: 10000 }}>
          <div style={styles.modalContent}>
            <AlertCircle size={48} color={modalType === 'cancel' ? '#f59e0b' : '#ea4335'} style={{ marginBottom: '20px', margin: '0 auto' }} />
            
            {modalType === 'cancel' ? (
              <p style={styles.modalText}>Tem certeza de que deseja <strong>CANCELAR</strong> o pagamento pendente {activeTx.id}? Ele será invalidado no Mercado Pago.</p>
            ) : (
              <div>
                <p style={styles.modalText}>Estorno do pagamento <strong>{activeTx.id}</strong>. Deixe em branco para estornar o valor total (R$ {activeTx.amount.toFixed(2)}).</p>
                <input 
                  type="text" 
                  placeholder={`R$ Máximo: ${activeTx.amount.toFixed(2)}`} 
                  value={refundAmount} 
                  onChange={(e) => setRefundAmount(e.target.value.replace(/[^0-9.,]/g, ''))}
                  style={{ ...styles.textInput, width: '100%', marginBottom: '20px', textAlign: 'center', fontSize: '16px' }} 
                />
              </div>
            )}

            <div style={styles.modalActions}>
              <button onClick={() => { setModalType(null); setRefundAmount(''); }} style={styles.modalBtnCancel}>VOLTAR</button>
              <button onClick={executeAction} style={{...styles.modalBtnConfirm, background: modalType === 'cancel' ? '#f59e0b' : '#ea4335'}}>
                {modalType === 'cancel' ? 'CONFIRMAR CANCELAMENTO' : 'CONFIRMAR ESTORNO'}
              </button>
            </div>
          </div>
        </div>
      )}

      <button onClick={onClose} style={styles.backButton}>
        <X size={18} /> FECHAR PAINEL FINANCEIRO
      </button>

      {/* BLOCO NOVO: SALDO DA CONTA */}
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
          <h2 style={{ fontSize: '16px', margin: 0, color: activePalette.titleColor, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <DollarSign size={20} /> Histórico de Transações e Logs
          </h2>
          
          <button 
            onClick={() => fetchFinanceData(true)} 
            style={{ background: 'transparent', border: `1px solid ${isDarkBase ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, color: activePalette.fontColor, padding: '6px 14px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s', textTransform: 'uppercase' }}
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} /> {isRefreshing ? 'ATUALIZANDO...' : 'ATUALIZAR AGORA'}
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
                {logs.map(log => {
                  const isPending = log.status === 'pending' || log.status === 'in_process';
                  const isApproved = log.status === 'approved';
                  return (
                  <tr key={log.id} style={{ borderBottom: `1px dashed ${isDarkBase ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
                    <td style={{ padding: '12px', opacity: 0.8 }}>{new Date(log.created_at).toLocaleString('pt-BR')}</td>
                    <td style={{ padding: '12px', fontFamily: 'monospace' }}>{log.payment_id}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', background: isApproved ? 'rgba(16, 185, 129, 0.2)' : (log.status.includes('refund') || log.status === 'cancelled' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'), color: isApproved ? '#10b981' : (log.status.includes('refund') || log.status === 'cancelled' ? '#ef4444' : '#f59e0b') }}>
                        {log.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontWeight: 'bold' }}>{log.amount.toFixed(2)}</td>
                    <td style={{ padding: '12px', opacity: 0.8, textTransform: 'capitalize' }}>{log.method}</td>
                    <td style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                      <span style={{ opacity: 0.8 }}>{log.payer_email}</span>
                      
                      {isApproved && (
                        <button onClick={() => { setActiveTx({ id: log.payment_id, amount: log.amount }); setModalType('refund'); }} disabled={processingId === log.payment_id} style={actionBtnStyle('234, 67, 53')}>
                          {processingId === log.payment_id ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />} Estornar
                        </button>
                      )}

                      {isPending && (
                        <button onClick={() => { setActiveTx({ id: log.payment_id, amount: log.amount }); setModalType('cancel'); }} disabled={processingId === log.payment_id} style={actionBtnStyle('245, 158, 11')}>
                          {processingId === log.payment_id ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />} Cancelar
                        </button>
                      )}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinancialPanel;