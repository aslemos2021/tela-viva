// Tela Viva — o motor da tela.
// A tela é uma grade grande de células. Cada aluno tem uma peça, que fica
// numa célula e olha numa direção. Um plano é um pedaço de código que move
// a peça e pinta a tela por meio do firmware (caneta.js). Os planos aceitos
// viram camadas; a tela é sempre o resultado de executar as camadas em
// ordem, a partir do zero, o que permite desfazer qualquer uma delas.
var TELA = globalThis.TELA = globalThis.TELA || {};

(function (T) {
  'use strict';

  T.VERSAO = '0.1';

  T.clonar = o => JSON.parse(JSON.stringify(o));

  // Sorteio com semente (mulberry32), para que o replay seja igual ao original.
  T.criarSorteador = function (semente) {
    let s = semente | 0;
    return function () {
      let t = (s = (s + 0x6D2B79F5) | 0);
      let r = Math.imul(t ^ (t >>> 15), t | 1);
      r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  };

  T.normalizar = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

  class ErroDePlano extends Error {
    constructor(m) { super(m); this.name = 'ErroDePlano'; this.dePlano = true; }
  }
  T.ErroDePlano = ErroDePlano;

  T.explicarErro = function (erro) {
    if (!erro) return 'erro desconhecido';
    if (erro.dePlano) return erro.message;
    const m = String(erro.message || erro);
    let r;
    if ((r = m.match(/Cannot read propert(?:y|ies) of (null|undefined)(?: \(reading '([^']*)'\))?/))) return `o plano tentou ler ${r[2] ? `"${r[2]}" ` : ''}de algo que não existe (${r[1]}).`;
    if ((r = m.match(/(?:tela\.|eu\.)?(\w+) is not a function/))) return `o plano chamou "${r[1]}", que não existe no firmware.`;
    if ((r = m.match(/(\w+) is not defined/))) return `o plano usou "${r[1]}", que não foi definido em lugar nenhum.`;
    if (/Maximum call stack/.test(m)) return 'o plano chamou a si mesmo sem parar.';
    if (/Unexpected|Unterminated|Invalid or unexpected token|missing \)/.test(m)) return `o código não está bem formado (${m}).`;
    return `erro no código: ${m}`;
  };

  // ---------------------------------------------------------------
  // Cores com nome. A IA pode usar também hex (#rrggbb).
  // ---------------------------------------------------------------
  T.CORES = {
    preto: '#1b1f24', branco: '#ffffff', cinza: '#8a94a0', 'cinza claro': '#c9d1d9', 'cinza escuro': '#4b5563',
    vermelho: '#d64541', laranja: '#e5822f', amarelo: '#e9c228', verde: '#2a9d5a', 'verde claro': '#7ed48a',
    'verde escuro': '#1c6b3c', azul: '#2f7ad0', 'azul claro': '#8ec5ff', 'azul escuro': '#1f3f8a', marinho: '#1f3f8a',
    roxo: '#8a49c3', lilas: '#c9a7f0', rosa: '#e0698a', 'rosa claro': '#f7b6c8', marrom: '#8b5a3a', bege: '#e8d6b8',
    areia: '#e8d6b8', dourado: '#d4a514', turquesa: '#17999a', ciano: '#3cc3d9', magenta: '#c4489a', vinho: '#7a1f3d',
    oliva: '#7ba32a', salmao: '#f0a07a', creme: '#f6efd8', pele: '#f1c9a5', ceu: '#9fd3f5', mar: '#2c6fb0', terra: '#9c6b3c'
  };

  T.cor = function (x) {
    if (x === null || x === undefined) return null;
    if (typeof x !== 'string') throw new ErroDePlano(`esperava uma cor (nome ou #rrggbb), mas recebeu ${typeof x}.`);
    const s = x.trim();
    if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(s)) return '#' + s.slice(1).split('').map(c => c + c).join('').toLowerCase();
    const n = T.normalizar(s).replace(/[-_]/g, ' ');
    if (n === 'nenhuma' || n === 'fundo' || n === 'apagar' || n === 'transparente') return null;
    if (T.CORES[n]) return T.CORES[n];
    const semAcento = Object.keys(T.CORES).find(k => T.normalizar(k) === n);
    if (semAcento) return T.CORES[semAcento];
    throw new ErroDePlano(`não conheço a cor "${x}". Use um nome da lista do firmware ou um código #rrggbb.`);
  };

  // ---------------------------------------------------------------
  // Direções: 0 = norte, 90 = leste, 180 = sul, 270 = oeste (sentido horário)
  // ---------------------------------------------------------------
  const NOMES_DIR = { norte: 0, nordeste: 45, leste: 90, sudeste: 135, sul: 180, sudoeste: 225, oeste: 270, noroeste: 315,
    n: 0, ne: 45, l: 90, e: 90, se: 135, s: 180, so: 225, sw: 225, o: 270, w: 270, no: 315, nw: 315, cima: 0, direita: 90, baixo: 180, esquerda: 270 };

  T.angulo = function (x) {
    if (typeof x === 'number' && Number.isFinite(x)) return ((x % 360) + 360) % 360;
    if (typeof x === 'string') {
      const n = T.normalizar(x);
      if (NOMES_DIR[n] !== undefined) return NOMES_DIR[n];
      const num = Number(n);
      if (Number.isFinite(num)) return ((num % 360) + 360) % 360;
    }
    throw new ErroDePlano(`esperava uma direção (graus ou um nome como "norte"), mas recebeu ${JSON.stringify(x)}.`);
  };

  T.nomeAngulo = function (a) {
    const nomes = ['norte', 'nordeste', 'leste', 'sudeste', 'sul', 'sudoeste', 'oeste', 'noroeste'];
    return nomes[Math.round((((a % 360) + 360) % 360) / 45) % 8];
  };

  // ---------------------------------------------------------------
  // Estado da tela
  // ---------------------------------------------------------------
  T.criar = function (cfg) {
    cfg = cfg || {};
    const larg = Math.max(20, Math.min(400, Math.round(cfg.larg || 160)));
    const alt = Math.max(20, Math.min(300, Math.round(cfg.alt || 100)));
    const e = {
      versao: 1, larg, alt,
      fundo: cfg.fundo || '#f4f1ea',
      cel: new Array(larg * alt).fill(null),     // cor de cada célula (null = fundo)
      buraco: new Array(larg * alt).fill(0),     // 1 = célula cavada (não existe)
      pecas: {}, ordem: [],
      camadas: [],
      marcas: {}
    };
    for (const p of cfg.pecas || [{ id: 'p1', nome: 'Eu' }]) T.novaPeca(e, p);
    return e;
  };

  T.novaPeca = function (e, p) {
    const id = p.id || 'p' + (e.ordem.length + 1);
    e.pecas[id] = {
      id, nome: p.nome || id, cor: p.cor || '#2350c8',
      x: p.x !== undefined ? p.x : Math.floor(e.larg / 2),
      y: p.y !== undefined ? p.y : Math.floor(e.alt / 2),
      ang: p.ang || 0, px: 0, py: 0,
      caneta: true, tinta: p.tinta || '#1b1f24', espessura: 1,
      ativa: p.ativa !== false,   // false: a equipe saiu da tela; as camadas dela continuam
      inicio: null
    };
    const q = e.pecas[id];
    q.px = q.x; q.py = q.y;
    q.inicio = { x: q.x, y: q.y, ang: q.ang, tinta: q.tinta };
    e.ordem.push(id);
    return q;
  };

  T.idx = (e, x, y) => y * e.larg + x;
  T.dentro = (e, x, y) => x >= 0 && y >= 0 && x < e.larg && y < e.alt;
  T.existe = (e, x, y) => T.dentro(e, x, y) && !e.buraco[T.idx(e, x, y)];
  T.corEm = (e, x, y) => (T.dentro(e, x, y) ? e.cel[T.idx(e, x, y)] : undefined);

  // ---------------------------------------------------------------
  // Camadas: cada plano aceito é uma camada. A tela é o replay de todas.
  // ---------------------------------------------------------------
  function zerar(e) {
    e.cel.fill(null);
    e.buraco.fill(0);
    e.marcas = {};
    for (const id of e.ordem) {
      const p = e.pecas[id];
      Object.assign(p, { x: p.inicio.x, y: p.inicio.y, px: p.inicio.x, py: p.inicio.y, ang: p.inicio.ang, caneta: true, tinta: p.inicio.tinta, espessura: 1 });
    }
  }

  // Executa um plano sobre o estado dado (que é modificado). Devolve o
  // relato: células tocadas, passos da peça, falha (se houver).
  T.executar = function (e, plano, op) {
    op = op || {};
    const peca = e.pecas[plano.peca || e.ordem[0]];
    if (!peca) return { ok: false, falha: 'a peça não existe', explicacao: 'a peça não existe', tocadas: [], passos: [] };
    const antes = T.clonar({ cel: null, buraco: null, marcas: e.marcas, peca });
    const copiaCel = e.cel.slice(), copiaBuraco = e.buraco.slice();
    const relato = { ok: true, tocadas: [], passos: [{ x: peca.x, y: peca.y, ang: peca.ang }], falas: [], falha: null, explicacao: null, avisos: [] };
    let fn;
    try {
      fn = new Function('eu', 'tela', '"use strict";\n' + String(plano.codigo || ''));
    } catch (erro) {
      relato.ok = false; relato.falha = String(erro.message); relato.explicacao = T.explicarErro(erro);
      return relato;
    }
    const fw = T.criarFirmware({ estado: e, peca, relato, sorteador: T.criarSorteador(plano.semente || 1), limites: op.limites });
    try {
      fn(fw.eu, fw.tela);
    } catch (erro) {
      // desfaz tudo o que o plano fez
      e.cel = copiaCel; e.buraco = copiaBuraco; e.marcas = antes.marcas;
      Object.assign(peca, antes.peca);
      relato.ok = false;
      relato.falha = String((erro && erro.message) || erro);
      relato.explicacao = T.explicarErro(erro);
      Object.defineProperty(relato, 'tocadas', { value: [], enumerable: true, configurable: true, writable: true });
      relato.passos = relato.passos.slice(0, 1);
    }
    return relato;
  };

  // Reconstrói a tela a partir das camadas (todas, ou até a camada n).
  T.reconstruir = function (e, ate) {
    zerar(e);
    const n = ate === undefined ? e.camadas.length : ate;
    const relatos = [];
    for (let i = 0; i < n; i++) {
      const c = e.camadas[i];
      const r = T.executar(e, c);
      c.falhou = !r.ok;
      relatos.push(r);
    }
    return relatos;
  };

  // Tenta um plano numa cópia: para a prévia.
  T.previa = function (e, plano) {
    const copia = T.clonar(e);
    const r = T.executar(copia, plano);
    return { estado: copia, relato: r };
  };

  T.aceitar = function (e, plano) {
    const camada = {
      n: e.camadas.length + 1,
      autor: plano.autor || e.pecas[plano.peca || e.ordem[0]].nome,
      peca: plano.peca || e.ordem[0],
      titulo: plano.titulo || '',
      pedido: plano.pedido || '',
      entendi: plano.entendi || '',
      escolhas: plano.escolhas || [],
      codigo: plano.codigo || '',
      semente: plano.semente || (e.camadas.length + 1) * 7919,
      quando: plano.quando || new Date().toISOString()
    };
    const r = T.executar(e, camada);
    camada.falhou = !r.ok;
    e.camadas.push(camada);
    return r;
  };

  T.desfazer = function (e, n) {
    // remove a camada n (1-based); sem n, remove a última
    const i = n === undefined ? e.camadas.length - 1 : n - 1;
    if (i < 0 || i >= e.camadas.length) return null;
    const [removida] = e.camadas.splice(i, 1);
    e.camadas.forEach((c, k) => { c.n = k + 1; });
    T.reconstruir(e);
    return removida;
  };

  // Mostra o código de uma função com o recuo arrumado.
  T.codigoDe = function (fn) {
    const linhas = String(fn).split('\n');
    if (linhas.length < 2) return linhas[0];
    const recuos = linhas.slice(1).filter(l => l.trim()).map(l => l.match(/^\s*/)[0].length);
    const corte = Math.min(...recuos, linhas[linhas.length - 1].match(/^\s*/)[0].length);
    return [linhas[0]].concat(linhas.slice(1).map(l => l.slice(corte))).join('\n');
  };
})(TELA);
