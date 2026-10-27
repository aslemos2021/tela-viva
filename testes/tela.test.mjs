import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregar } from './carregar.mjs';
const T = carregar();

function nova() { return T.criar({ larg: 120, alt: 80 }); }
const pintadas = e => e.cel.filter(c => c).length;

test('frente pinta, levantar não pinta, borda para', () => {
  const e = nova();
  let r = T.executar(e, { codigo: 'eu.olharPara("leste"); eu.frente(10);' });
  assert.ok(r.ok, r.explicacao);
  assert.equal(pintadas(e), 11);
  assert.equal(e.pecas.p1.x, 70);
  r = T.executar(e, { codigo: 'eu.levantar(); eu.frente(10);' });
  assert.equal(pintadas(e), 11);
  r = T.executar(e, { codigo: 'eu.olharPara("leste"); eu.frente(1000);' });
  assert.ok(r.ok);
  assert.equal(e.pecas.p1.x, 119);
  assert.ok(r.avisos.some(a => /borda/.test(a)));
});

test('ângulos quaisquer: um pentagrama fecha', () => {
  const e = nova();
  const r = T.executar(e, { codigo: 'eu.olharPara("leste"); for (let i=0;i<5;i++){ eu.frente(40); eu.direita(144); }' });
  assert.ok(r.ok, r.explicacao);
  assert.ok(Math.abs(e.pecas.p1.x - 60) <= 1 && Math.abs(e.pecas.p1.y - 40) <= 1, `${e.pecas.p1.x},${e.pecas.p1.y}`);
});

test('cavar bloqueia a peça; aterrar libera', () => {
  const e = nova();
  T.executar(e, { codigo: 'eu.olharPara("leste"); eu.levantar(); eu.frente(3); eu.cavar(2);' });
  const x = e.pecas.p1.x;
  const r = T.executar(e, { codigo: 'eu.frente(10);' });
  assert.equal(e.pecas.p1.x, x);
  assert.ok(r.avisos.some(a => /cavada/.test(a)));
  T.executar(e, { codigo: 'eu.aterrar(2); eu.frente(10);' });
  assert.equal(e.pecas.p1.x, x + 10);
  const r2 = T.executar(e, { codigo: 'tela.cavar(eu.x, eu.y);' });
  assert.equal(r2.ok, false);
  assert.match(r2.explicacao, /em cima/);
});

test('falha desfaz tudo o que o plano fez', () => {
  const e = nova();
  const r = T.executar(e, { codigo: 'eu.circulo(10, true); eu.cavar(5); const n = null; n.x;' });
  assert.equal(r.ok, false);
  assert.equal(pintadas(e), 0);
  assert.equal(e.buraco.filter(b => b).length, 0);
  assert.match(r.explicacao, /não existe/);
  assert.equal(e.pecas.p1.x, 60);
});

test('laço infinito é interrompido', () => {
  const e = nova();
  const r = T.executar(e, { codigo: 'while (true) { eu.direita(1); }' });
  assert.equal(r.ok, false);
  assert.match(r.explicacao, /repetindo sem parar/);
});

test('preencher respeita fronteiras e buracos', () => {
  const e = nova();
  const r = T.executar(e, { codigo: 'eu.cor("preto"); eu.irPara(10,10); eu.retangulo(20, 10); eu.irPara(15, 15); eu.preencher("vermelho");' });
  assert.ok(r.ok, r.explicacao);
  assert.equal(T.corEm(e, 15, 15), T.CORES.vermelho);
  assert.equal(T.corEm(e, 5, 5), null);
  assert.equal(pintadas(e), 20 * 10);
});

test('camadas: aceitar, desfazer e reconstruir dão o mesmo resultado', () => {
  const e = nova();
  for (const ex of T.EXEMPLOS) {
    const r = T.aceitar(e, ex);
    assert.ok(r.ok, `${ex.titulo}: ${r.explicacao}`);
  }
  const antes = e.cel.join(',') + '|' + e.buraco.join(',');
  const copia = T.clonar(e);
  T.reconstruir(copia);
  assert.equal(copia.cel.join(',') + '|' + copia.buraco.join(','), antes);
  T.desfazer(e, 2);
  assert.equal(e.camadas.length, T.EXEMPLOS.length - 1);
  assert.equal(e.camadas[1].titulo, T.EXEMPLOS[2].titulo);
  const so13 = nova();
  for (const i of [0, 2, 3]) T.aceitar(so13, T.EXEMPLOS[i]);
  assert.equal(e.cel.join(','), so13.cel.join(','));
});

test('prévia não altera a tela', () => {
  const e = nova();
  const { relato } = T.previa(e, T.EXEMPLOS[1]);
  assert.ok(relato.ok);
  assert.ok(relato.tocadas.length > 1000);
  assert.equal(pintadas(e), 0);
});

test('cores por nome, hex e erro claro', () => {
  const e = nova();
  assert.ok(T.executar(e, { codigo: 'eu.cor("Verde Escuro"); eu.cor("#abc"); eu.cor("fundo");' }).ok);
  const r = T.executar(e, { codigo: 'eu.cor("azulzinho");' });
  assert.match(r.explicacao, /não conheço a cor/);
});
