/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/**
 * RatingWidget — Widget de avaliação por estrelas e reações emoji.
 * Renderizado inline no PostReader, entre conteúdo e share-bar.
 * Cookie-free: dedup via voter_hash server-side (SHA-256).
 */
import { useState, useEffect, useCallback } from 'react';
import { Star } from 'lucide-react';
import type { ActivePalette } from '../types';

interface RatingStats {
  avgRating: number;
  totalVotes: number;
  distribution: Record<number, number>;
  reactions: Record<string, number>;
  userRating: number | null;
  userReaction: string | null;
}

interface RatingWidgetProps {
  postId: number;
  activePalette: ActivePalette;
  apiUrl: string;
}

const REACTIONS = [
  { type: 'love', emoji: '❤️', label: 'Amei' },
  { type: 'insightful', emoji: '💡', label: 'Inspirador' },
  { type: 'thought-provoking', emoji: '🤔', label: 'Reflexivo' },
  { type: 'inspiring', emoji: '✨', label: 'Lindo' },
  { type: 'beautiful', emoji: '📚', label: 'Instrutivo' },
] as const;

const RatingWidget = ({ postId, activePalette, apiUrl }: RatingWidgetProps) => {
  const [stats, setStats] = useState<RatingStats>({
    avgRating: 0, totalVotes: 0, distribution: {}, reactions: {},
    userRating: null, userReaction: null,
  });
  const [hoveredStar, setHoveredStar] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);

  const isDark = activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1');

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/ratings/${postId}`);
      if (res.ok) {
        const data: RatingStats = await res.json();
        setStats(data);
      }
    } catch { /* silêncio */ }
  }, [apiUrl, postId]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const submitRating = async (rating: number, reactionType?: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${apiUrl}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_id: postId,
          rating,
          reaction_type: reactionType || stats.userReaction || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setStats(prev => ({ ...prev, ...data, userRating: rating, userReaction: reactionType || prev.userReaction }));
        setShowThankYou(true);
        setTimeout(() => setShowThankYou(false), 2500);
      }
    } catch { /* silêncio */ }
    finally { setIsSubmitting(false); }
  };

  const submitReaction = async (reactionType: string) => {
    const rating = stats.userRating || 5; // Reação implica aprovação
    await submitRating(rating, reactionType);
  };

  const displayRating = hoveredStar > 0 ? hoveredStar : (stats.userRating || 0);

  return (
    <div style={{
      margin: '3rem 0 0 0',
      padding: '1.5rem',
      borderRadius: '16px',
      background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
      textAlign: 'center',
    }}>
      {/* Label */}
      <div style={{
        fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em',
        textTransform: 'uppercase' as const, opacity: 0.5, marginBottom: '12px',
      }}>
        Avalie esta leitura
      </div>

      {/* Stars */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginBottom: '8px' }}>
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            disabled={isSubmitting}
            onClick={() => submitRating(star)}
            onMouseEnter={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(0)}
            style={{
              background: 'none', border: 'none', cursor: isSubmitting ? 'wait' : 'pointer',
              padding: '4px', transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
              transform: hoveredStar === star ? 'scale(1.3)' : 'scale(1)',
            }}
            title={`${star} estrela${star > 1 ? 's' : ''}`}
          >
            <Star
              size={28}
              fill={star <= displayRating ? '#facc15' : 'none'}
              stroke={star <= displayRating ? '#facc15' : (isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)')}
              strokeWidth={1.5}
            />
          </button>
        ))}
      </div>

      {/* Aggregate display */}
      {stats.totalVotes > 0 && (
        <div style={{
          fontSize: '13px', fontWeight: 600, opacity: 0.7, marginBottom: '16px',
          transition: 'all 0.3s ease',
        }}>
          {stats.avgRating.toFixed(1)} ★ · {stats.totalVotes} {stats.totalVotes === 1 ? 'voto' : 'votos'}
        </div>
      )}

      {/* Reactions */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
        {REACTIONS.map(reaction => {
          const count = stats.reactions[reaction.type] || 0;
          const isActive = stats.userReaction === reaction.type;
          return (
            <button
              key={reaction.type}
              type="button"
              disabled={isSubmitting}
              onClick={() => submitReaction(reaction.type)}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '6px 12px', borderRadius: '100px',
                background: isActive
                  ? (isDark ? 'rgba(138,180,248,0.15)' : 'rgba(66,133,244,0.1)')
                  : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
                border: `1px solid ${isActive
                  ? (isDark ? 'rgba(138,180,248,0.3)' : 'rgba(66,133,244,0.25)')
                  : 'transparent'}`,
                cursor: isSubmitting ? 'wait' : 'pointer',
                fontSize: '13px', fontFamily: 'inherit', fontWeight: isActive ? 700 : 500,
                color: activePalette.fontColor,
                transition: 'all 0.2s ease',
              }}
              title={reaction.label}
            >
              <span style={{ fontSize: '16px' }}>{reaction.emoji}</span>
              {count > 0 && <span style={{ fontSize: '11px', opacity: 0.7 }}>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Thank you animation */}
      <div style={{
        overflow: 'hidden', maxHeight: showThankYou ? '40px' : '0',
        opacity: showThankYou ? 1 : 0, transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        fontSize: '12px', fontWeight: 600, color: '#10b981', marginTop: '8px',
      }}>
        Obrigado pela sua avaliação! ✨
      </div>
    </div>
  );
};

export default RatingWidget;
