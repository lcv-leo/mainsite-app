import { fileURLToPath } from 'node:url';

const storageFile = fileURLToPath(new URL('../.vitest-localstorage', import.meta.url));
const nodeOption = `--localstorage-file=${storageFile}`;
const currentOptions = process.env.NODE_OPTIONS?.trim();
process.env.NODE_OPTIONS = currentOptions ? `${currentOptions} ${nodeOption}` : nodeOption;

await import('../node_modules/vitest/vitest.mjs');
