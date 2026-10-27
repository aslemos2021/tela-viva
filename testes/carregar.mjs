import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function carregar() {
  const ctx = vm.createContext({ console });
  for (const f of ['motor/tela.js', 'motor/caneta.js', 'motor/exemplos.js']) {
    vm.runInContext(fs.readFileSync(path.join(raiz, f), 'utf8'), ctx, { filename: f });
  }
  return ctx.TELA;
}
