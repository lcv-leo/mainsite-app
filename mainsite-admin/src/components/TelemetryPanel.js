// Módulo: mainsite-admin/src/components/TelemetryPanel.jsx
// Versão: v1.1.0
// Descrição: Componente legível (utilizado pontualmente). Renderização de auditoria com MD3 e Timezone America/Sao_Paulo cravado.

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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(128,128,128,0.2)', paddingBottom: '15px', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '18px', margin: 0, display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '700' }}>
                    <Icon size={20} /> {title}
                </h2>
                <button onClick={() => onRefresh(true)} style={styles.headerBtn} title="Forçar sincronização">
                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Atualizar
                </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                        <Loader2 className="animate-spin" size={32} style={{ opacity: 0.5 }} />
                    </div>
                ) : logs.length === 0 ? (
                    <p style={{ fontSize: '13px', opacity: 0.6, textAlign: 'center', fontWeight: '600' }}>{emptyMessage}</p>
                ) : logs.map((log, i) => (
                    <div key={i} className="log-card" style={{ background: 'rgba(128,128,128,0.05)', border: '1px solid rgba(128,128,128,0.15)', borderRadius: '20px', padding: '20px', borderLeft: `4px solid ${isChat ? (log.role === 'user' ? '#94a3b8' : '#4ade80') : (log.platform === 'whatsapp' ? '#22c55e' : log.platform === 'email' ? '#38bdf8' : '#94a3b8')}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '11px', opacity: 0.8, fontWeight: '700', textTransform: 'uppercase' }}>
                            <span>{isChat ? (log.role === 'user' ? '👤 Pergunta (Usuário)' : '🤖 Resposta (IA)') : `Plataforma: ${log.platform}`}</span>
                            <span style={{ background: 'rgba(0,0,0,0.1)', padding: '4px 10px', borderRadius: '100px' }}>
                                {new Date(log.created_at.replace(' ', 'T') + 'Z').toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                            </span>
                        </div>

                        <div style={{ fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap', fontWeight: isChat ? 'normal' : '600' }}>
                            {isChat ? log.message : log.post_title}
                        </div>

                        {isChat && log.context_title && (
                            <div style={{ marginTop: '16px', fontSize: '10px', background: 'rgba(128,128,128,0.15)', display: 'inline-block', padding: '6px 12px', borderRadius: '8px', fontWeight: '700' }}>
                                CONTEXTO ATIVO: {log.context_title}
                            </div>
                        )}

                        {!isChat && log.target && (
                            <div style={{ marginTop: '16px', fontSize: '11px', background: 'rgba(128,128,128,0.15)', display: 'inline-block', padding: '8px 14px', borderRadius: '8px', fontWeight: '700', wordBreak: 'break-all' }}>
                                Destino: {(log.platform === 'link' || log.platform === 'whatsapp') ? (
                                    <a href={log.target} target="_blank" rel="noopener noreferrer" style={{ color: '#0ea5e9', textDecoration: 'underline', marginLeft: '5px' }}>{log.target}</a>
                                ) : log.platform === 'email' ? (
                                    <a href={`mailto:${log.target}`} style={{ color: '#0ea5e9', textDecoration: 'underline', marginLeft: '5px' }}>{log.target}</a>
                                ) : (
                                    <span style={{ marginLeft: '5px' }}>{log.target}</span>
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