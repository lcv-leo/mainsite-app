import { describe, expect, it } from 'vitest';
import type { Env } from '../env.ts';
import settings from './settings.ts';

/**
 * Factory de mock D1 que retorna um payload arbitrário para a chave
 * `mainsite/disclaimers` e ignora demais chaves.
 */
const mockEnvWithDisclaimersPayload = (payload: string | null) => {
  const firstImpl = async () => (payload === null ? null : { payload });
  const prepareImpl = () => ({
    bind: () => ({ first: firstImpl, run: async () => ({}) }),
    first: firstImpl,
    run: async () => ({}),
  });
  return { DB: { prepare: prepareImpl } } as unknown as Env;
};

describe('GET /api/settings/disclaimers — filtro server-side de soft-disable', () => {
  it('filtra itens com enabled: false e mantém itens sem a flag (ativos por default)', async () => {
    const payload = JSON.stringify({
      enabled: true,
      items: [
        { id: 'a', title: 'Ativo explícito', text: 't', buttonText: 'ok', enabled: true },
        { id: 'b', title: 'Ativo por ausência', text: 't', buttonText: 'ok' },
        { id: 'c', title: 'Inativo', text: 't', buttonText: 'ok', enabled: false },
      ],
    });
    const res = await settings.request('/api/settings/disclaimers', {}, mockEnvWithDisclaimersPayload(payload));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      enabled: boolean;
      items: Array<{ id: string }>;
    };
    expect(body.enabled).toBe(true);
    expect(body.items.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('preserva config.enabled === false (kill switch global) e ainda filtra itens', async () => {
    const payload = JSON.stringify({
      enabled: false,
      items: [{ id: 'a', title: 't', text: 't', buttonText: 'ok' }],
    });
    const res = await settings.request('/api/settings/disclaimers', {}, mockEnvWithDisclaimersPayload(payload));
    const body = (await res.json()) as { enabled: boolean; items: unknown[] };
    expect(body.enabled).toBe(false);
    expect(body.items).toEqual([{ id: 'a', title: 't', text: 't', buttonText: 'ok' }]);
  });

  it('retorna seed default quando registro não existe no D1', async () => {
    const res = await settings.request('/api/settings/disclaimers', {}, mockEnvWithDisclaimersPayload(null));
    const body = (await res.json()) as { enabled: boolean; items: Array<{ enabled?: boolean }> };
    expect(body.enabled).toBe(true);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].enabled).toBe(true);
  });

  it('trata payload corrompido (null, primitivo, array) como lista vazia — fail-safe', async () => {
    for (const broken of ['null', '"string"', '42', '[]']) {
      const res = await settings.request('/api/settings/disclaimers', {}, mockEnvWithDisclaimersPayload(broken));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { enabled: boolean; items: unknown[] };
      expect(body.enabled).toBe(true);
      expect(body.items).toEqual([]);
    }
  });

  it('descarta itens que não são objetos com id string válido', async () => {
    const payload = JSON.stringify({
      items: [
        null,
        'not-an-object',
        42,
        { id: '', title: 'empty id', text: 't', buttonText: 'ok' },
        { title: 'no id', text: 't', buttonText: 'ok' },
        { id: 'valid', title: 'ok', text: 't', buttonText: 'ok' },
      ],
    });
    const res = await settings.request('/api/settings/disclaimers', {}, mockEnvWithDisclaimersPayload(payload));
    const body = (await res.json()) as { items: Array<{ id: string }> };
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe('valid');
  });

  it('descarta itens com shape parcialmente corrompido (sem text/title/buttonText)', async () => {
    // DisclaimerModal renderiza item.text.split(...), item.title, item.buttonText —
    // um item que passa com qualquer um desses ausente crasharia o frontend.
    // Filter do worker deve ser fail-safe para esses casos também.
    const payload = JSON.stringify({
      items: [
        { id: 'a', title: 'ok', text: 't', buttonText: 'ok' }, // completo — passa
        { id: 'b', title: 'sem text', buttonText: 'ok' }, // text ausente — descarta
        { id: 'c', text: 'sem title', buttonText: 'ok' }, // title ausente — descarta
        { id: 'd', title: 'sem buttonText', text: 't' }, // buttonText ausente — descarta
        { id: 'e', title: 'tipo errado', text: 42, buttonText: 'ok' }, // text não-string — descarta
        { id: 'f', title: 'tipo errado', text: 't', buttonText: null }, // buttonText null — descarta
      ],
    });
    const res = await settings.request('/api/settings/disclaimers', {}, mockEnvWithDisclaimersPayload(payload));
    const body = (await res.json()) as { items: Array<{ id: string }> };
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe('a');
  });
});
