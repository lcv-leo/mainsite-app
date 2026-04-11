/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/**
 * Logging estruturado para Cloudflare Workers.
 * Envia logs formatados ao sistema de observabilidade nativo do Cloudflare.
 */
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const TAG = '[mainsite-motor]';

export const structuredLog = (
  level: LogLevel,
  message: string,
  data?: Record<string, unknown>
): void => {
  const entry = {
    level,
    message: `${TAG} ${message}`,
    timestamp: new Date().toISOString(),
    ...data,
  };

  switch (level) {
    case 'error':
      console.error(JSON.stringify(entry));
      break;
    case 'warn':
      console.warn(JSON.stringify(entry));
      break;
    case 'debug':
      console.debug(JSON.stringify(entry));
      break;
    default:
      console.log(JSON.stringify(entry));
  }
};
