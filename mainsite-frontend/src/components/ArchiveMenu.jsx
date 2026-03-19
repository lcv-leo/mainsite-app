// Módulo: mainsite-frontend/src/components/ArchiveMenu.jsx
// Versão: v2.0.0
// Descrição: Componente refatorado para usar o motor de estilos central (Glassmorphism/MD3), com alinhamento visual completo dos cartões de arquivo, busca e rodapé.

import React, { useState } from 'react';
import { ChevronUp, Search } from 'lucide-react';

const ArchiveMenu = ({ posts, currentPost, setCurrentPost, styles, activePalette, APP_VERSION }) => {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  if (!activePalette || !styles) return null;

  const filteredArchive = posts.filter(post => {
    const safeTitle = post.title || '';
    const safeContent = post.content || '';
    const matchesSearch = searchTerm === '' || safeTitle.toLowerCase().includes(searchTerm.toLowerCase()) || safeContent.toLowerCase().includes(searchTerm.toLowerCase());
    return searchTerm ? matchesSearch : (matchesSearch && post.id !== currentPost?.id);
  });

  const handleSelectPost = (post) => {
    setCurrentPost(post);
    setIsHistoryOpen(false);
    setSearchTerm('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const localStyles = {
    footer: { marginTop: '40px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: '40px' },
    archiveToggle: { background: 'none', border: 'none', color: activePalette.fontColor, fontSize: '10px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', opacity: 0.7, transition: 'opacity 0.2s' },
    searchBarContainer: { display: 'flex', alignItems: 'center', borderBottom: `1px solid ${styles.glassBorder}`, margin: '20px 20px 0 20px', paddingBottom: '15px' },
    searchInput: { background: 'none', border: 'none', color: 'inherit', fontFamily: 'inherit', fontSize: '12px', width: '100%', outline: 'none', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 'bold' }
  };

  return (
    <footer style={localStyles.footer}>
      <button 
        onClick={() => setIsHistoryOpen(!isHistoryOpen)} 
        style={localStyles.archiveToggle}
        onMouseOver={(e) => e.currentTarget.style.opacity = 1}
        onMouseOut={(e) => e.currentTarget.style.opacity = 0.7}
      >
        <span style={{ letterSpacing: '0.5em', fontWeight: 'bold' }}>
          ARQUIVO DE FRAGMENTOS
        </span>
        <ChevronUp size={16} style={{ transform: isHistoryOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.5s' }} />
      </button>
      
      <div style={{ maxHeight: isHistoryOpen ? '2000px' : '0', opacity: isHistoryOpen ? 1 : 0, overflow: 'hidden', transition: 'all 0.8s ease-in-out', width: '100%', maxWidth: '1200px' }}>
        <div style={localStyles.searchBarContainer}>
          <Search size={18} style={{ opacity: 0.6, marginRight: '15px' }} color={activePalette.fontColor} />
          <input 
            type="text" 
            placeholder="BUSCA POR PALAVRAS-CHAVE..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            style={localStyles.searchInput} 
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px', padding: '20px', width: '100%', boxSizing: 'border-box' }}>
          {filteredArchive.length > 0 ? (
            filteredArchive.map(post => (
              <div 
                key={post.id} 
                onClick={() => handleSelectPost(post)} 
                style={{ ...styles.postCard, cursor: 'pointer', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '12px' }}
              >
                <div style={{ fontSize: '9px', opacity: 0.7, fontWeight: 'bold' }}>{new Date(post.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</div>
                <div style={{ fontSize: '12px', textTransform: 'uppercase', fontWeight: 'bold', color: activePalette.titleColor }}>{post.title}</div>
              </div>
            ))
          ) : (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', opacity: 0.6, fontSize: '12px', padding: '40px 0', textTransform: 'uppercase', letterSpacing: '2px' }}>
              Nenhum registro encontrado.
            </div>
          )}
        </div>
      </div>
      <div style={{ marginTop: '40px', fontSize: '10px', opacity: 0.5, letterSpacing: '4px', textTransform: 'uppercase', fontWeight: 'bold' }}>{APP_VERSION}</div>
    </footer>
  );
};

export default ArchiveMenu;