/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/**
 * useContentSync — Smart polling hook para sincronização de conteúdo.
 *
 * Faz polling leve em GET /api/content-fingerprint a cada 30s para detectar
 * quando o admin ou cron de rotação alterou a matéria da homepage.
 *
 * Otimizações:
 * - Pausa quando a tab está em background (document.visibilityState)
 * - Ignora a primeira resposta (inicialização) para evitar falsos positivos
 * - Cleanup automático no unmount
 */
import { useCallback, useEffect, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 30_000; // 30 segundos

interface ContentFingerprint {
  version: number;
  updated_at: string;
  headline_post_id: number | null;
}

interface ContentSyncResult {
  /** Há uma atualização de conteúdo disponível */
  hasUpdate: boolean;
  /** ID do novo post da homepage (para navegação) */
  newHeadlineId: number | null;
  /** Título do timestamp da atualização */
  updatedAt: string | null;
  /** Aceita a atualização — reseta o estado para permitir nova detecção */
  refresh: () => void;
  /** Dispensa a notificação */
  dismiss: () => void;
}

export function useContentSync(apiUrl: string, enabled: boolean = true): ContentSyncResult {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [newHeadlineId, setNewHeadlineId] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  // Versão conhecida — null significa "ainda não inicializado"
  const knownVersionRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  const fetchFingerprint = useCallback(async () => {
    // Pula polling quando tab está em background
    if (document.visibilityState === 'hidden') return;

    try {
      const res = await fetch(`${apiUrl}/content-fingerprint`);
      if (!res.ok) return;

      const data: ContentFingerprint = await res.json();

      if (!isMountedRef.current) return;

      // Primeira execução: apenas registra a versão atual sem disparar notificação
      if (knownVersionRef.current === null) {
        knownVersionRef.current = data.version;
        return;
      }

      // Detecta mudança de versão
      if (data.version !== knownVersionRef.current) {
        knownVersionRef.current = data.version;
        setNewHeadlineId(data.headline_post_id);
        setUpdatedAt(data.updated_at);
        setHasUpdate(true);
      }
    } catch {
      // Falha silenciosa — não bloqueia UX do leitor
    }
  }, [apiUrl]);

  // Inicia e gerencia o polling
  useEffect(() => {
    if (!enabled) return;

    isMountedRef.current = true;

    // Inicializa versão via microtask para evitar setState sincronoo no body do effect
    queueMicrotask(() => {
      void fetchFingerprint();
    });

    // Inicia polling periódico
    intervalRef.current = setInterval(fetchFingerprint, POLL_INTERVAL_MS);

    // Listener de visibilidade: poll imediato ao retornar ao tab
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchFingerprint();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled, fetchFingerprint]);

  const refresh = useCallback(() => {
    setHasUpdate(false);
    setNewHeadlineId(null);
    setUpdatedAt(null);
  }, []);

  const dismiss = useCallback(() => {
    setHasUpdate(false);
  }, []);

  return { hasUpdate, newHeadlineId, updatedAt, refresh, dismiss };
}
