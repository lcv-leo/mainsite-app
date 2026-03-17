// Módulo: mainsite-admin/src/components/TelemetryPanel.jsx
// Versão: v1.0.1
// Descrição: Componente isolado para renderização de auditoria de IA (Chat) e Engajamento (Shares). Inclui correção de fuso horário (America/Sao_Paulo).

import React from 'react';
import { ArrowLeft, MessageSquare, Share2, RefreshCw, Loader2 } from 'lucide-react';

const TelemetryPanel = ({ 
  type, 
  logs, 
  loading, 
  onRefresh, 
  onClose, 
  styles 
}) => {
  const isChat = type === 'chat';
  const Icon = isChat ? MessageSquare : Share2;
  const title = isChat ? 'Telemetria e Auditoria de Chatbot (Últimos 200)' : 'Compartilhamentos e Engajamento (Últimos 200)';
  const emptyMessage = isChat ? 'Nenhum log registrado na telemetria.' : 'Nenhum compartilhamento registrado na telemetria.';

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      <button onClick={onClose} style={styles.backButton}>
        <ArrowLeft size={16} /> Voltar aos Registros
      </button>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '16px', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Icon size={20} /> {title}
        </h2>
        <button onClick={() => onRefresh(true)} style={{...styles.settingsBtn, padding: '6px 12px'}} title="Forçar sincronização">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Atualizar
        </button>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {loading ? ( 
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <Loader2 className="animate-spin" color="#000" />
          </div> 
        ) : logs.length === 0 ? ( 
          <p style={{fontSize: '12px', opacity: 0.6, textAlign: 'center'}}>{emptyMessage}</p> 
        ) : logs.map((log, i) => (
          <div key={i} className="log-card" style={{ background: '#f8fafc', borderLeft: `4px solid ${isChat ? (log.role === 'user' ? '#94a3b8' : '#4ade80') : (log.platform === 'whatsapp' ? '#22c55e' : log.platform === 'email' ? '#38bdf8' : '#94a3b8')}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>
              <span>{isChat ? (log.role === 'user' ? '👤 Pergunta (Usuário)' : '🤖 Resposta (IA)') : `Plataforma: ${log.platform}`}</span>
              
              {/* CORREÇÃO DE TIMEZONE APLICADA */}
              <span>{new Date(log.created_at.replace(' ', 'T') + 'Z').toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</span>
            </div>
            
            <div style={{ fontSize: '13px', lineHeight: '1.6', color: '#0f172a', whiteSpace: 'pre-wrap', fontWeight: isChat ? 'normal' : 'bold' }}>
              {isChat ? log.message : log.post_title}
            </div>
            
            {isChat && log.context_title && (
              <div style={{ marginTop: '12px', fontSize: '9px', background: '#e2e8f0', display: 'inline-block', padding: '4px 8px', borderRadius: '4px', color: '#475569', fontWeight: 'bold' }}>
                CONTEXTO ATIVO: {log.context_title}
              </div>
            )}

            {!isChat && log.target && (
              <div style={{ marginTop: '12px', fontSize: '10px', background: '#e2e8f0', display: 'inline-block', padding: '6px 10px', borderRadius: '4px', color: '#334155', fontWeight: 'bold', wordBreak: 'break-all' }}>
                Destino: {(log.platform === 'link' || log.platform === 'whatsapp') ? (
                  <a href={log.target} target="_blank" rel="noopener noreferrer" style={{color: '#0ea5e9', textDecoration: 'underline', marginLeft: '5px'}}>{log.target}</a>
                ) : log.platform === 'email' ? (
                  <a href={`mailto:${log.target}`} style={{color: '#0ea5e9', textDecoration: 'underline', marginLeft: '5px'}}>{log.target}</a>
                ) : (
                  <span style={{marginLeft: '5px'}}>{log.target}</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TelemetryPanel;