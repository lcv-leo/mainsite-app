// Módulo: mainsite-frontend/src/components/ArchiveMenu.jsx
// Versão: v1.0.1
// Descrição: Componente isolado para a listagem, busca e navegação no histórico de fragmentos.

import React, { useState } from 'react';
import { ChevronUp, Search } from 'lucide-react';

const ArchiveMenu = ({ posts, currentPost, setCurrentPost, activePalette, APP_VERSION }) => {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  if (!activePalette) return null;

  // Cálculo de contraste isolado para manter a estética
  const isDarkBase = activePalette.bgColor && (activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1'));

  // Motor de Busca Semântica Simples isolado do App principal
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

  const styles = {
    footer: { marginTop: '40px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: '40px' },
    archiveToggle: { background: 'none', border: 'none', fontSize: '10px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', opacity: 0.7 },
    card: { padding: '25px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.3s', borderRadius: '4px' },
    cardDate: { fontSize: '9px', opacity: 0.6, marginBottom: '12px', fontWeight: 'bold' }
  };

  return (
    <footer style={styles.footer}>
      <style>{`
        .archive-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 20px; padding: 20px; width: 100%; box-sizing: border-box; }
        .archive-btn:hover { opacity: 1 !important; }
      `}</style>

      <button onClick={() => setIsHistoryOpen(!isHistoryOpen)} style={styles.archiveToggle} className="archive-btn">
        <span style={{ letterSpacing: '0.5em', color: activePalette.fontColor, transition: 'color 0.5s ease', fontWeight: 'bold' }}>
          FRAGMENTOS ANTERIORES
        </span>
        <ChevronUp size={16} color={activePalette.fontColor} style={{ transform: isHistoryOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.5s' }} />
      </button>
      
      <div style={{ maxHeight: isHistoryOpen ? '2000px' : '0', opacity: isHistoryOpen ? 1 : 0, overflow: 'hidden', transition: 'all 0.8s ease-in-out', width: '100%', maxWidth: '1200px' }}>
        <div style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid rgba(${isDarkBase ? '255,255,255' : '0,0,0'},0.2)`, margin: '20px 20px 0 20px', paddingBottom: '15px' }}>
          <Search size={18} style={{ opacity: 0.6, marginRight: '15px' }} color={activePalette.fontColor} />
          <input 
            type="text" 
            placeholder="BUSCA EXATA POR PALAVRAS-CHAVE..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            style={{ background: 'none', border: 'none', color: 'inherit', fontFamily: 'inherit', fontSize: '12px', width: '100%', outline: 'none', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 'bold' }} 
          />
        </div>

        <div className="archive-grid">
          {filteredArchive.length > 0 ? (
            filteredArchive.map(post => (
              <div key={post.id} onClick={() => handleSelectPost(post)} style={{...styles.card, backgroundColor: `rgba(${isDarkBase ? '0,0,0' : '255,255,255'},0.5)`, borderColor: `rgba(${isDarkBase ? '255,255,255' : '0,0,0'},0.1)` }}>
                <div style={styles.cardDate}>{new Date(post.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('pt-BR')}</div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold', color: activePalette.titleColor, transition: 'color 0.5s ease' }}>{post.title}</div>
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