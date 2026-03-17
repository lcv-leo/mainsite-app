// Módulo: mainsite-admin/src/components/FinancialPanel.jsx
// Versão: v1.2.0
// Descrição: Painel financeiro com auto-refresh (polling de 15s) e injeção do botão nativo de Devolução (Estorno/Refund) restrito a transações aprovadas.

import React, { useState, useEffect, useCallback } from 'react';
import { X, DollarSign, RefreshCw, Loader2, RotateCcw } from 'lucide-react';

const FinancialPanel = ({ onClose, secret, API_URL, styles, activePalette, isDarkBase }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refundingId, setRefundingId] = useState(null); // Controle de estado do botão individual de estorno

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

  // Função disparadora de estorno
  const handleRefund = async (paymentId) => {
    // Blindagem JS de segurança (confirmação da devolução)
    if (!window.confirm(`Tem certeza absoluta de que deseja DEVOLVER integralmente o pagamento ${paymentId}? O dinheiro retornará para a conta/cartão do doador e a ação é irreversível.`)) return;
    
    setRefundingId(paymentId);
    try {
      const res = await fetch(`${API_URL}/mp-payment/${paymentId}/refund`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${secret}` }
      });
      
      if (res.ok) {
        alert(`Estorno do pagamento ${paymentId} realizado com sucesso! O sistema foi atualizado.`);
        fetchLogs(true); // Atualiza a tabela imediatamente após o sucesso
      } else {
        const errData = await res.json();
        alert(`Falha ao tentar estornar: ${errData.error}`);
      }
    } catch (e) {
      alert('Ocorreu um erro de rede ao tentar processar o estorno.');
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
                      
                      {/* O Botão Mágico de Estorno: Só aparece se a transação estiver limpa e aprovada */}
                      {log.status === 'approved' && (
                        <button
                          onClick={() => handleRefund(log.payment_id)}
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