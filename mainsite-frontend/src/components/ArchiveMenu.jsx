// Módulo: mainsite-frontend/src/components/ArchiveMenu.jsx
// Versão: v1.2.0
// Descrição: Componente isolado para a listagem e busca. Atualizado 100% para métricas Glassmorphism + MD3 e Timezone America/Sao_Paulo cravado.

import React, { useState } from 'react';
import { ChevronUp, Search } from 'lucide-react';

const ArchiveMenu = ({ posts, currentPost, setCurrentPost, activePalette, APP_VERSION }) => {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  if (!activePalette) return null;

  const isDarkBase = activePalette.bgColor && (activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1'));

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
    footer: { marginTop: '60px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: '40px' },
    archiveToggle: { background: 'none', border: 'none', fontSize: '11px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', opacity: 0.8, transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)' },
    card: { padding: '24px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)', borderRadius: '24px' },
    cardDate: { fontSize: '10px', opacity: 0.7, marginBottom: '16px', fontWeight: '800', letterSpacing: '0.5px' }
  };

  return (
    <footer style={styles.footer}>
      <style>{`
        .archive-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 24px; padding: 24px; width: 100%; box-sizing: border-box; }
        .archive-btn:hover { opacity: 1 !important; transform: translateY(-2px); }
        .glass-card-md3 {
           background-color: ${isDarkBase ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.5)'};
           border: 1px solid ${isDarkBase ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};
           backdrop-filter: blur(var(--glass-blur-standard));
           -webkit-backdrop-filter: blur(var(--glass-blur-standard));
           box-shadow: 0 8px 24px rgba(0,0,0,0.05);
        }
        .glass-card-md3:hover { transform: translateY(-4px); box-shadow: 0 16px 32px rgba(0,0,0,0.1) !important; border-color: ${activePalette.titleColor}40; }
      `}</style>

      <button onClick={() => setIsHistoryOpen(!isHistoryOpen)} style={styles.archiveToggle} className="archive-btn">
        <span style={{ letterSpacing: '0.28em', color: activePalette.fontColor, transition: 'color 0.5s ease', fontWeight: '800' }}>
          FRAGMENTOS ANTERIORES
        </span>
        <ChevronUp size={20} color={activePalette.fontColor} style={{ transform: isHistoryOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }} />
      </button>

      <div style={{ maxHeight: isHistoryOpen ? '2000px' : '0', opacity: isHistoryOpen ? 1 : 0, overflow: 'hidden', transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)', width: '100%', maxWidth: '1200px' }}>
        <div style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid rgba(${isDarkBase ? '255,255,255' : '0,0,0'},0.2)`, margin: '30px 24px 0 24px', paddingBottom: '16px' }}>
          <Search size={20} style={{ opacity: 0.6, marginRight: '16px' }} color={activePalette.fontColor} />
          <input
            type="text"
            placeholder="BUSCA EXATA POR PALAVRAS-CHAVE..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ background: 'none', border: 'none', color: 'inherit', fontFamily: 'inherit', fontSize: '13px', width: '100%', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '700' }}
          />
        </div>

        <div className="archive-grid">
          {filteredArchive.length > 0 ? (
            filteredArchive.map(post => (
              <div
                key={post.id}
                onClick={() => handleSelectPost(post)}
                className="glass-card-md3"
                style={styles.card}
              >
                <div style={styles.cardDate}>{new Date(post.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</div>
                <div style={{ fontSize: '13px', textTransform: 'uppercase', fontWeight: '800', color: activePalette.titleColor, transition: 'color 0.5s ease', lineHeight: '1.4' }}>{post.title}</div>
              </div>
            ))
          ) : (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', opacity: 0.6, fontSize: '13px', padding: '40px 0', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '700' }}>
              Nenhum registro encontrado.
            </div>
          )}
        </div>
      </div>
      <div style={{ marginTop: '40px', fontSize: '11px', opacity: 0.5, letterSpacing: '3px', textTransform: 'uppercase', fontWeight: '800' }}>{APP_VERSION}</div>
    </footer>
  );
};

export default ArchiveMenu;