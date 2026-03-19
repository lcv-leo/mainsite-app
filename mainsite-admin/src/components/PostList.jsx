// Módulo: mainsite-admin/src/components/PostList.jsx
// Versão: v1.2.0
// Descrição: Componente refatorado para usar props de tema (activePalette, isDarkBase), garantindo consistência visual com o padrão Glassmorphism/MD3.

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
  styles,
  activePalette,
  isDarkBase
}) => {
  if (!posts || posts.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '2px' }}>
        Nenhum fragmento encontrado.
      </div>
    );
  }

  // Define um fundo sutil para o botão de fixar quando ativo, baseado no tema
  const activePinBg = isDarkBase ? 'rgba(138, 180, 248, 0.2)' : 'rgba(26, 115, 232, 0.15)';

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
          style={{ 
            ...styles.postCard, 
            borderLeft: post.is_pinned ? `4px solid ${activePalette.titleColor}` : `1px solid ${styles.glassBorder}` 
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ cursor: 'grab', opacity: 0.4 }} title="Reordenar">
              <GripVertical size={20} />
            </div>
            <div>
              <div style={styles.cardDate}>
                {new Date(post.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} 
                {post.is_pinned && <span style={styles.pinnedBadge}>FIXADO</span>}
              </div>
              <h2 style={styles.cardTitle}>{post.title}</h2>
            </div>
          </div>
          <div style={styles.actions}>
            <button 
              onClick={() => onPin(post.id)} 
              style={{ 
                ...styles.actionBtnPin, 
                background: post.is_pinned ? activePinBg : 'transparent',
                color: post.is_pinned ? activePalette.titleColor : activePalette.fontColor,
              }} 
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