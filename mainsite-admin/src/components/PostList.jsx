// Módulo: mainsite-admin/src/components/PostList.jsx
// Versão: v1.1.1
// Descrição: Componente isolado. Lógica de Drag and Drop preservada, com refatoração visual e correção de timezone para renderização de datas em formato pt-BR (America/Sao_Paulo).

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
      <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '2px' }}>
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
          style={{ ...styles.postCard, borderLeft: post.is_pinned ? '4px solid #4da6ff' : `1px solid rgba(128,128,128,0.1)` }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ cursor: 'grab', opacity: 0.4 }} title="Reordenar">
              <GripVertical size={20} />
            </div>
            <div>
              <div style={styles.cardDate}>
                {/* CORREÇÃO DE TIMEZONE APLICADA */}
                {new Date(post.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} 
                {post.is_pinned && <span style={styles.pinnedBadge}>FIXADO</span>}
              </div>
              <h2 style={styles.cardTitle}>{post.title}</h2>
            </div>
          </div>
          <div style={styles.actions}>
            <button 
              onClick={() => onPin(post.id)} 
              style={{ ...styles.actionBtnPin, background: post.is_pinned ? 'rgba(128,128,128,0.3)' : 'transparent' }} 
              title="Fixar/Desafixar"
            >
              <Pin size={16} />
            </button>
            <button onClick={() => onEdit(post)} style={styles.actionBtnEdit} title="Editar">
              <Edit3 size={16} />
            </button>
            <button onClick={() => onDelete(post.id)} style={styles.actionBtnDelete} title="Excluir">
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PostList;