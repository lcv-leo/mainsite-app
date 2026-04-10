/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/**
 * Tipos compartilhados do mainsite-frontend.
 * Definições centralizadas usadas por múltiplos componentes.
 */

/** Paleta de cores ativa (light ou dark). */
export interface ActivePalette {
  bgColor: string
  bgImage: string
  fontColor: string
  titleColor: string
}

/** Configuração compartilhada de aparência. */
export interface SharedSettings {
  fontSize: string
  titleFontSize: string
  fontFamily: string
  bodyWeight: string
  titleWeight: string
  lineHeight: string
  textAlign: string
  textIndent: string
  paragraphSpacing: string
  contentMaxWidth: string
  linkColor: string
}

/** Configurações completas do site. */
export interface SiteSettings {
  allowAutoMode: boolean
  light: Omit<ActivePalette, 'bgImage'> & { bgImage?: string }
  dark: Omit<ActivePalette, 'bgImage'> & { bgImage?: string }
  shared: SharedSettings
}

/** Post do mainsite. */
export interface Post {
  id: number
  title: string
  content: string
  author?: string
  created_at: string
  updated_at?: string
  is_pinned: number | boolean
  display_order?: number
  slug?: string
}

/** Item de disclaimer configurável. */
export interface DisclaimerItem {
  id: string
  title: string
  text: string
  buttonText: string
  isDonationTrigger: boolean
}

/** Configuração de disclaimers. */
export interface DisclaimersConfig {
  enabled: boolean
  items: DisclaimerItem[]
}

/** Estado do modal de compartilhamento por e-mail. */
export interface ShareModalState {
  show: boolean
  email: string
}

/** Dados do formulário de contato/comentário. */
export interface ContactFormData {
  name: string
  phone: string
  email: string
  message: string
  turnstile_token?: string
}

/** Toast de notificação. */
export interface ToastState {
  show: boolean
  message: string
  type: 'info' | 'success' | 'error'
}

/** Helper: verifica se a paleta é de tema escuro. */
export const isDarkPalette = (palette: ActivePalette): boolean =>
  palette.bgColor.startsWith('#0') || palette.bgColor.startsWith('#1')
