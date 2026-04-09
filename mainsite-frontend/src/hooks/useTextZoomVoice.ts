/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
// Hook: useTextZoomVoice
// Purpose: Voice control for text zoom (Web Speech API)
// Features: voice commands, accessibility

import { useState, useCallback } from 'react';

interface VoiceCommand {
  command: RegExp;
  action: 'increase' | 'decrease' | 'reset' | 'preset';
  preset?: string;
}

export const useTextZoomVoice = (
  onIncrease: () => void,
  onDecrease: () => void,
  onReset: () => void,
  onPreset?: (preset: string) => void
) => {
  const [isListening, setIsListening] = useState(false);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const SpeechRecognition =
    typeof window !== 'undefined'
      ? (window as Window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition || (window as Window & { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
      : null;

  const startVoiceControl = useCallback(() => {
    if (!SpeechRecognition) {
      setError('Web Speech API não suportado neste navegador');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: Event & { results: SpeechRecognitionResultList }) => {
      const transcript = Array.from(event.results)
        .map((result: SpeechRecognitionResult) => result[0].transcript)
        .join('')
        .toLowerCase();

      setLastCommand(transcript);

      // Voice commands
      const commands: VoiceCommand[] = [
        { command: /aumentar|zoom in|maior|grande/i, action: 'increase' },
        { command: /diminuir|zoom out|menor|pequeno/i, action: 'decrease' },
        { command: /reset|voltar|normal|padrão/i, action: 'reset' },
        { command: /dislexia|dyslexia/i, action: 'preset', preset: 'dyslexia' },
        { command: /baixa visão|low vision/i, action: 'preset', preset: 'lowvision' },
      ];

      for (const cmd of commands) {
        if (cmd.command.test(transcript)) {
          if (cmd.action === 'increase') onIncrease();
          else if (cmd.action === 'decrease') onDecrease();
          else if (cmd.action === 'reset') onReset();
          else if (cmd.action === 'preset' && onPreset) onPreset(cmd.preset || '');
          break;
        }
      }
    };

    recognition.onerror = (event: Event & { error: string }) => {
      setError(`Erro de voz: ${event.error}`);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  }, [SpeechRecognition, onIncrease, onDecrease, onReset, onPreset]);

  const stopVoiceControl = useCallback(() => {
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.abort();
    setIsListening(false);
  }, [SpeechRecognition]);

  const isSupported = !!SpeechRecognition;

  return {
    isListening,
    isSupported,
    lastCommand,
    error,
    startVoiceControl,
    stopVoiceControl,
  };
};
