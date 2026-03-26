// Módulo: mainsite-admin/src/components/PostList.jsx
// Versão: v1.2.0
// Descrição: Lógica de Drag and Drop com refatoração visual MD3 (Glassmorphism integrado via styles) e correção de timezone UTC-3 (America/Sao_Paulo).

import React from 'react';
import { Pin, Edit3, Trash2, GripVertical } from 'lucide-react';

const PostList = ({
  posts,
  onPin,
  onEdit,
  onDelete,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  styles
}) => {
  if (!posts || posts.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 'bold' }}>
        Nenhum fragmento encontrado.
      </div>
    );
  }

  return (
    <div style={styles.list}>
      {posts.map((post, index) => (
        <div
          key={post.id}
          draggable
          onDragStart={(e) => onDragStart(e, index)}
          onDragEnd={onDragEnd}
          onDragOver={onDragOver}
          onDrop={(e) => onDrop(e, index)}
          aria-roledescription="item arrastável"
          style={{ ...styles.postCard, borderLeft: post.is_pinned ? `4px solid ${styles.pinnedBadge.backgroundColor}` : `1px solid rgba(128,128,128,0.1)` }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ cursor: 'grab', opacity: 0.4 }} title="Reordenar" aria-hidden="true">
              <GripVertical size={24} />
            </div>
            <div>
              <div style={styles.cardDate}>
                {(() => {
                  // Formata data+hora em pt-BR (dd/mm/aaaa, hh:mm:ss)
                  const fmt = (raw) => {
                    if (!raw) return null;
                    const d = new Date(raw.replace(' ', 'T') + (raw.includes('Z') || raw.includes('+') ? '' : 'Z'));
                    return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  };
                  const criado = fmt(post.created_at);
                  const atualizado = fmt(post.updated_at);
                  // Exibe "Atualizado em" apenas quando diferente de created_at
                  const showUpdated = atualizado && atualizado !== criado;
                  return (
                    <span>
                      Publicação: {criado || '—'}
                      {showUpdated && <> | Atualizado em {atualizado}</>}
                    </span>
                  );
                })()}
                {post.is_pinned && <span style={styles.pinnedBadge}>FIXADO</span>}
              </div>
              <h2 style={styles.cardTitle}>{post.title}</h2>
            </div>
          </div>
          <div style={styles.actions}>
            <button
              onClick={() => onPin(post.id)}
              style={{ ...styles.actionBtnPin, background: post.is_pinned ? `${styles.pinnedBadge.backgroundColor}22` : 'transparent', borderColor: post.is_pinned ? `${styles.pinnedBadge.backgroundColor}55` : styles.actionBtnPin.border }}
              title="Fixar/Desafixar"
              aria-label={post.is_pinned ? `Desafixar "${post.title}"` : `Fixar "${post.title}"`}
            >
              <Pin size={18} />
            </button>
            <button onClick={() => onEdit(post)} style={styles.actionBtnEdit} title="Editar" aria-label={`Editar "${post.title}"`}>
              <Edit3 size={18} />
            </button>
            <button onClick={() => onDelete(post.id)} style={styles.actionBtnDelete} title="Excluir" aria-label={`Excluir "${post.title}"`}>
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PostList;