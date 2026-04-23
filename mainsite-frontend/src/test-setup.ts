import '@testing-library/jest-dom/vitest';

/**
 * Polyfill defensivo de localStorage/sessionStorage para o ambiente de testes.
 *
 * Contexto: Node.js ≥ 22 expõe um `globalThis.localStorage` nativo via experimental
 * webstorage. Quando o runtime é iniciado sem `--localstorage-file` com path válido
 * (caso do Node 25.x observado em Windows sob Git Bash), o objeto exposto existe mas
 * não implementa `clear`/`setItem`/`getItem`/etc. — só tem keys vazias.
 *
 * Esse global quebrado tem precedência sobre o `window.localStorage` que o happy-dom
 * registra ao criar o ambiente de teste, fazendo com que qualquer `localStorage.clear()`
 * nos testes lance `TypeError: localStorage.clear is not a function`.
 *
 * Fix: se `globalThis.localStorage.clear` não for função, substituímos por uma
 * implementação Map-based in-memory. Idempotente: se já existe um impl válido
 * (happy-dom, jsdom, browser real), não mexemos.
 */
const ensureStorage = (name: 'localStorage' | 'sessionStorage') => {
  const current = (globalThis as unknown as Record<string, unknown>)[name] as Storage | undefined;
  if (current && typeof current.clear === 'function') return;

  const store = new Map<string, string>();
  const impl: Storage = {
    get length() {
      return store.size;
    },
    clear: () => {
      store.clear();
    },
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
  };
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: impl });
};

ensureStorage('localStorage');
ensureStorage('sessionStorage');
