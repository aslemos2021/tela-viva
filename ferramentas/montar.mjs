// Gera dist/tela-viva.html (arquivo único), dist/artefato.html e FIRMWARE.md.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { carregar } from '../testes/carregar.mjs';
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ler = f => fs.readFileSync(path.join(raiz, f), 'utf8');
const html = ler('index.html');
const blindar = s => s.replace(/<\/script/gi, '<\\/script');
const unico = html
  .replace('<link rel="stylesheet" href="estilo.css">', () => `<style>\n${ler('estilo.css')}\n</style>`)
  .replace(/<script src="([^"]+)"><\/script>/g, (_, f) => `<script>/* ${f} */\n${blindar(ler(f))}\n</script>`);
fs.mkdirSync(path.join(raiz, 'dist'), { recursive: true });
fs.writeFileSync(path.join(raiz, 'dist/tela-viva.html'), unico);
const artefato = unico.replace(/<!doctype html>\s*/i, '').replace(/<html[^>]*>\s*/i, '').replace(/<\/html>\s*/i, '')
  .replace(/<head>\s*/i, '').replace(/<\/head>\s*/i, '').replace(/<body>\s*/i, '').replace(/<\/body>\s*/i, '')
  .replace(/<meta charset="utf-8">\s*/i, '').replace(/<meta name="viewport"[^>]*>\s*/i, '');
fs.writeFileSync(path.join(raiz, 'dist/artefato.html'), artefato);
const T = carregar();
let md = '# Firmware da Tela Viva\n\nVocabulário com que todo plano é escrito. Um plano recebe `eu` (a peça, com a caneta) e `tela` (a superfície).\n\n';
md += 'Coordenadas: x de 0 a largura−1 (da esquerda para a direita), y de 0 a altura−1 (de cima para baixo). Direções em graus no sentido horário: 0 = norte, 90 = leste, 180 = sul, 270 = oeste.\n\n';
md += '_Gerado por `ferramentas/montar.mjs` a partir de `motor/caneta.js`. Não edite à mão._\n';
for (const g of T.GRUPOS) {
  md += `\n## ${g.nome}\n\n${g.descricao}\n\n| Operação | O que faz | Exemplo |\n|---|---|---|\n`;
  for (const f of T.FIRMWARE.filter(x => x.grupo === g.id)) md += `| \`${f.assinatura}\` | ${f.descricao} | \`${f.exemplo.replace(/\|/g, '\\|')}\` |\n`;
}
md += `\n## Cores com nome\n\n${Object.keys(T.CORES).join(', ')}. Qualquer código \`#rrggbb\` também vale; "fundo" apaga.\n`;
fs.writeFileSync(path.join(raiz, 'FIRMWARE.md'), md);
console.log('dist ok', (unico.length / 1024).toFixed(0), 'KB;', T.FIRMWARE.length, 'operações');
