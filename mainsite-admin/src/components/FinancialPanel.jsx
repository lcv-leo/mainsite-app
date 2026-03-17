// Módulo: mainsite-admin/src/components/FinancialPanel.jsx
// Versão: v1.0.0
// Descrição: Painel de gestão financeira e logs de Webhooks do Mercado Pago.

import React, { useState, useEffect, useCallback } from 'react';
import { X, DollarSign, Activity, CheckCircle, Loader2 } from 'lucide-react';

const FinancialPanel = ({ onClose, secret, API_URL, styles, activePalette, isDarkBase }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/financial-logs`, {
        headers: { 'Authorization': `Bearer ${secret}` }
      });
      if (res.ok) setLogs(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [API_URL, secret]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const glassCard = {
    background: isDarkBase ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)',
    border: `1px solid ${isDarkBase ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '24px'
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <button onClick={onClose} style={styles.backButton}>
        <X size={18} /> FECHAR PAINEL FINANCEIRO
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        
        <div style={glassCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', color: activePalette.titleColor }}>
            <Activity size={20} /> <h2 style={{ fontSize: '16px', margin: 0 }}>Endpoint de Webhook Configurado</h2>
          </div>
          <p style={{ fontSize: '13px', opacity: 0.8, marginBottom: '10px' }}>Copie a URL abaixo e cole no painel do Mercado Pago (Aba: Notificações Webhooks) para ativar a sincronização em tempo real:</p>
          <div style={{ background: isDarkBase ? 'rgba(0,0,0,0.4)' : '#fff', padding: '12px', borderRadius: '8px', fontSize: '12px', fontFamily: 'monospace', wordBreak: 'break-all', border: '1px dashed rgba(128,128,128,0.3)' }}>
            https://mainsite-app.lcv.rio.br/api/webhooks/mercadopago
          </div>
        </div>

        <div style={glassCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', color: '#10b981' }}>
            <CheckCircle size={20} /> <h2 style={{ fontSize: '16px', margin: 0, color: activePalette.titleColor }}>Auditoria de Qualidade (100/100)</h2>
          </div>
          <ul style={{ fontSize: '12px', margin: 0, paddingLeft: '20px', lineHeight: '1.8', opacity: 0.8 }}>
            <li>✓ <strong>Ação Obrigatória:</strong> Notificações Webhook Ativas</li>
            <li>✓ <strong>Ação Obrigatória:</strong> Referência Externa (UUID) Mapeada</li>
            <li>✓ <strong>Ação Recomendada:</strong> Payer Email, First Name e Last Name processados</li>
            <li>✓ <strong>Ação Recomendada:</strong> Objeto Items (id, title, price, qty) injetado</li>
            <li>✓ <strong>Boa Prática:</strong> Consulta Reversa Ativa na API de Pagamentos</li>
          </ul>
        </div>

      </div>

      <div style={glassCard}>
        <h2 style={{ fontSize: '16px', margin: '0 0 20px 0', color: activePalette.titleColor, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <DollarSign size={20} /> Histórico de Transações e Logs (D1)
        </h2>
        
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
                  <th style={{ padding: '12px' }}>E-mail</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} style={{ borderBottom: `1px dashed ${isDarkBase ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
                    <td style={{ padding: '12px', opacity: 0.8 }}>{new Date(log.created_at).toLocaleString('pt-BR')}</td>
                    <td style={{ padding: '12px', fontFamily: 'monospace' }}>{log.payment_id}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', background: log.status === 'approved' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)', color: log.status === 'approved' ? '#10b981' : '#f59e0b' }}>
                        {log.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontWeight: 'bold' }}>{log.amount.toFixed(2)}</td>
                    <td style={{ padding: '12px', opacity: 0.8, textTransform: 'capitalize' }}>{log.method}</td>
                    <td style={{ padding: '12px', opacity: 0.8 }}>{log.payer_email}</td>
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