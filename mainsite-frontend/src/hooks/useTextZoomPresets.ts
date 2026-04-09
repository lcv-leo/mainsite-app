/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
// Hook: useTextZoomPresets
// Purpose: Preset configurations for accessibility (dyslexia, low vision, etc)
// Features: one-click presets, custom configs

import { useCallback } from 'react';

export interface ZoomPreset {
  name: string;
  label: string;
  zoomLevel: number;
  description: string;
  icon?: string;
}

export const TEXT_ZOOM_PRESETS: Record<string, ZoomPreset> = {
  normal: {
    name: 'normal',
    label: 'Normal',
    zoomLevel: 1.0,
    description: 'Tamanho padrão',
  },
  dyslexia: {
    name: 'dyslexia',
    label: 'Dislexia',
    zoomLevel: 1.35,
    description: 'Otimizado para dislexia com espaçamento aumentado',
  },
  lowvision: {
    name: 'lowvision',
    label: 'Baixa Visão',
    zoomLevel: 1.8,
    description: 'Grande para facilitar leitura',
  },
  accessibility: {
    name: 'accessibility',
    label: 'Acessibilidade',
    zoomLevel: 1.5,
    description: 'Equilíbrio entre legibilidade e espaço',
  },
  compact: {
    name: 'compact',
    label: 'Compacto',
    zoomLevel: 0.9,
    description: 'Mais compacto, mostra mais conteúdo',
  },
};

export const useTextZoomPresets = (onZoomChange: (level: number) => void) => {
  const applyPreset = useCallback(
    (presetName: string) => {
      const preset = TEXT_ZOOM_PRESETS[presetName];
      if (preset) {
        onZoomChange(preset.zoomLevel);
        // Save active preset to localStorage
        try {
          localStorage.setItem('mainsite:text-zoom-preset', presetName);
        } catch (e) {
          console.warn('Failed to save preset preference:', e);
        }
      }
    },
    [onZoomChange]
  );

  const getActivePreset = useCallback(() => {
    try {
      const saved = localStorage.getItem('mainsite:text-zoom-preset');
      return saved || 'normal';
    } catch {
      return 'normal';
    }
  }, []);

  const getPresetByZoomLevel = useCallback((zoomLevel: number): string => {
    // Find matching preset by zoom level
    for (const [key, preset] of Object.entries(TEXT_ZOOM_PRESETS)) {
      if (Math.abs(preset.zoomLevel - zoomLevel) < 0.01) {
        return key;
      }
    }
    return 'normal';
  }, []);

  return {
    presets: TEXT_ZOOM_PRESETS,
    applyPreset,
    getActivePreset,
    getPresetByZoomLevel,
  };
};
