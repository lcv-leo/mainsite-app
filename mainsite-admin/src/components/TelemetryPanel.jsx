// Módulo: mainsite-admin/src/components/TelemetryPanel.jsx
// Versão: v1.2.0
// Descrição: Suporte a type='audit' para leitura detalhada de chat_context_audit. Timezone America/Sao_Paulo.

import React from 'react';
import { ArrowLeft, MessageSquare, Share2, RefreshCw, Loader2, BrainCog, Calendar } from 'lucide-react';

const TelemetryPanel = ({
    type,
    logs,
    loading,
    onRefresh,
    onClose,
    styles
}) => {
    const isChat = type === 'chat';
    const isAudit = type === 'audit';
    const Icon = isAudit ? BrainCog : isChat ? MessageSquare : Share2;
    const title = isAudit
        ? 'Auditoria de Contexto do Chatbot — Lista Completa (Últimos 200)'
        : isChat ? 'Telemetria e Auditoria de Chatbot (Últimos 200)' : 'Compartilhamentos e Engajamento (Últimos 200)';
    const emptyMessage = isAudit
        ? 'Nenhum registro de auditoria de contexto ainda.'
        : isChat ? 'Nenhum log registrado na telemetria.' : 'Nenhum compartilhamento registrado na telemetria.';

    const formatDate = (dateString) => {
        try {
            return new Date(dateString.replace(' ', 'T') + 'Z').toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        } catch { return dateString; }
    };

    const parseJsonArray = (raw, fallback = []) => {
        try { const p = JSON.parse(raw || '[]'); return Array.isArray(p) ? p : fallback; } catch { return fallback; }
    };

    const dateBadge = {
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        background: 'rgba(0, 0, 0, 0.15)', padding: '6px 10px', borderRadius: '100px',
        fontSize: '11px', fontWeight: '700', opacity: 0.9, border: '1px solid rgba(128,128,128,0.2)'
    };

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
                ) : isAudit ? (
                    logs.map((log, i) => {
                        const selectedPosts = parseJsonArray(log.selected_posts_json);
                        const termList = parseJsonArray(log.terms_json);
                        return (
                            <div key={log.id || i} style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.25)', borderRadius: '20px', padding: '20px', borderLeft: '4px solid rgba(14,165,233,0.7)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
                                    <div>
                                        <span style={{ fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', background: 'rgba(14,165,233,0.2)', padding: '4px 10px', borderRadius: '100px', display: 'inline-block', marginBottom: '8px' }}>🧠 CONTEXTO IA</span>
                                        <div style={{ opacity: 0.7, fontSize: '11px', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Contexto Ativo: {log.context_title || 'Nenhum / Global'}</div>
                                    </div>
                                    <div style={dateBadge}><Calendar size={12} /> {formatDate(log.created_at)}</div>
                                </div>

                                <div style={{ fontSize: '14px', background: 'rgba(0,0,0,0.08)', padding: '12px 16px', borderRadius: '14px', marginBottom: '12px', whiteSpace: 'pre-wrap' }}>
                                    <strong>Pergunta:</strong> {log.question}
                                </div>

                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                                    <span style={{ ...dateBadge, fontSize: '11px' }}>Acervo: {log.total_posts_scanned}</span>
                                    <span style={{ ...dateBadge, fontSize: '11px' }}>Contexto: {log.context_posts_used}</span>
                                </div>

                                {termList.length > 0 && (
                                    <div style={{ fontSize: '12px', opacity: 0.85, marginBottom: '12px' }}>
                                        <strong>Termos:</strong> {termList.join(', ')}
                                    </div>
                                )}

                                {selectedPosts.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <strong style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px', opacity: 0.8 }}>Publicações selecionadas ({selectedPosts.length})</strong>
                                        {selectedPosts.map((post, idx) => (
                                            <div key={`${log.id}-${post.id || idx}`} style={{ fontSize: '12px', background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(128,128,128,0.15)', borderRadius: '10px', padding: '8px 12px' }}>
                                                <div style={{ fontWeight: '700' }}>#{post.id ?? 'N/A'} — {post.title || 'Sem título'}</div>
                                                <div style={{ opacity: 0.7 }}>Score: {post.score ?? 0}{post.created_at ? ` | ${formatDate(post.created_at)}` : ''}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })
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