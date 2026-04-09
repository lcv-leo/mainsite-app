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

  // Web Speech API — tipagem local (tipos globais não disponíveis neste target TS)
  interface SpeechRecognitionLike {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;
    onstart: (() => void) | null;
    onresult: ((event: Event & { results: { length: number; [index: number]: { [index: number]: { transcript: string } } } }) => void) | null;
    onerror: ((event: Event & { error: string }) => void) | null;
    onend: (() => void) | null;
    start(): void;
    abort(): void;
  }
  type SpeechRecognitionCtor = new () => SpeechRecognitionLike;
  const SpeechRecognitionImpl: SpeechRecognitionCtor | undefined =
    typeof window !== 'undefined'
      ? (window as unknown as Record<string, SpeechRecognitionCtor | undefined>).SpeechRecognition ??
        (window as unknown as Record<string, SpeechRecognitionCtor | undefined>).webkitSpeechRecognition
      : undefined;

  const startVoiceControl = useCallback(() => {
    if (!SpeechRecognitionImpl) {
      setError('Web Speech API não suportado neste navegador');
      return;
    }

    const recognition = new SpeechRecognitionImpl();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event) => {
      const results = event.results;
      const transcript = Array.from({ length: results.length }, (_, i) => results[i][0].transcript)
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

    recognition.onerror = (event) => {
      setError(`Erro de voz: ${event.error}`);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  }, [SpeechRecognitionImpl, onIncrease, onDecrease, onReset, onPreset]);

  const stopVoiceControl = useCallback(() => {
    if (!SpeechRecognitionImpl) return;

    const recognition = new SpeechRecognitionImpl();
    recognition.abort();
    setIsListening(false);
  }, [SpeechRecognitionImpl]);

  const isSupported = !!SpeechRecognitionImpl;

  return {
    isListening,
    isSupported,
    lastCommand,
    error,
    startVoiceControl,
    stopVoiceControl,
  };
};
