// Tela Viva — o firmware da caneta e da superfície.
// É o vocabulário com que todo plano é escrito. Um plano recebe dois
// objetos: "eu" (a peça, com a sua caneta) e "tela" (a superfície). Nada
// fora deles chega ao desenho.
var TELA = globalThis.TELA = globalThis.TELA || {};

(function (T) {
  'use strict';

  const LIMITE_PINTURAS = 400000;
  const LIMITE_CHAMADAS = 200000;
  const LIMITE_MS = 2500;
  const LIMITE_PASSOS = 20000;

  // ---------------------------------------------------------------
  // Documentação (aba Firmware e FIRMWARE.md)
  // ---------------------------------------------------------------
  T.GRUPOS = [
    { id: 'mover', nome: 'Mover a peça', descricao: 'A peça anda a partir de onde está, na direção em que olha. Com a caneta baixada, pinta por onde passa.' },
    { id: 'caneta', nome: 'Caneta', descricao: 'O que a peça deixa na tela ao se mover.' },
    { id: 'formas', nome: 'Formas prontas', descricao: 'Atalhos para o que seria longo de desenhar passo a passo.' },
    { id: 'superficie', nome: 'Superfície', descricao: 'A tela também se altera: células podem ser cavadas (deixam de existir) e aterradas de volta. A peça não entra numa célula cavada.' },
    { id: 'olhar', nome: 'Olhar', descricao: 'Perguntas sobre a tela. Não mudam nada.' },
    { id: 'memoria', nome: 'Memória e acaso', descricao: 'Guardar lugares para voltar a eles, e sortear.' }
  ];
  T.FIRMWARE = [];
  const doc = (grupo, assinatura, descricao, exemplo) => T.FIRMWARE.push({ grupo, assinatura, descricao, exemplo });

  doc('mover', 'eu.frente(n)', 'Anda n células na direção em que olha. Para na borda ou diante de uma célula cavada.', 'eu.frente(20)');
  doc('mover', 'eu.tras(n)', 'Anda n células para trás, sem virar.', 'eu.tras(5)');
  doc('mover', 'eu.direita(graus)', 'Vira para a direita (sentido horário).', 'eu.direita(90)');
  doc('mover', 'eu.esquerda(graus)', 'Vira para a esquerda.', 'eu.esquerda(144)');
  doc('mover', 'eu.olharPara(direcao)', 'Vira para uma direção: "norte", "leste"… ou graus (0 = norte, 90 = leste).', 'eu.olharPara("sul")');
  doc('mover', 'eu.mirar(x, y)', 'Vira para o ponto (x, y).', 'eu.mirar(tela.centro().x, tela.centro().y)');
  doc('mover', 'eu.irPara(x, y)', 'Salta para a célula (x, y) sem pintar o caminho.', 'eu.irPara(10, 10)');
  doc('mover', 'eu.linhaAte(x, y)', 'Anda em linha reta até (x, y), pintando se a caneta estiver baixada.', 'eu.linhaAte(80, 50)');
  doc('caneta', 'eu.levantar()', 'Levanta a caneta: a peça passa a andar sem pintar.', 'eu.levantar()');
  doc('caneta', 'eu.baixar()', 'Baixa a caneta: a peça volta a pintar por onde passa.', 'eu.baixar()');
  doc('caneta', 'eu.cor(cor)', 'Troca a tinta. Nome ("azul", "verde escuro"…) ou código #rrggbb. "fundo" apaga.', 'eu.cor("laranja")');
  doc('caneta', 'eu.espessura(n)', 'Grossura do traço, de 1 a 7 células.', 'eu.espessura(3)');
  doc('caneta', 'eu.ponto()', 'Pinta só a célula onde está (com a espessura atual).', 'eu.ponto()');
  doc('formas', 'eu.circulo(raio, cheio?)', 'Círculo com centro na peça. Com cheio = true, pinta por dentro.', 'eu.circulo(12, true)');
  doc('formas', 'eu.retangulo(largura, altura, cheio?)', 'Retângulo com o canto superior esquerdo na peça.', 'eu.retangulo(30, 10)');
  doc('formas', 'eu.poligono(lados, tamanho)', 'Polígono regular, começando na peça e na direção em que ela olha. A peça termina onde começou.', 'eu.poligono(6, 15)');
  doc('formas', 'eu.preencher(cor?)', 'Balde de tinta: pinta a região contínua onde a peça está (da mesma cor que a célula dela).', 'eu.preencher("ceu")');
  doc('superficie', 'eu.cavar(n)', 'Cava as n células à frente da peça: elas deixam de existir. A peça não se move.', 'eu.cavar(10)');
  doc('superficie', 'eu.aterrar(n)', 'Aterra as n células à frente: voltam a existir, vazias.', 'eu.aterrar(10)');
  doc('superficie', 'tela.cavar(x, y)', 'Cava uma célula qualquer (fora da tela, não faz nada).', 'tela.cavar(5, 5)');
  doc('superficie', 'tela.aterrar(x, y)', 'Aterra uma célula qualquer.', 'tela.aterrar(5, 5)');
  doc('superficie', 'tela.pintar(x, y, cor)', 'Pinta uma célula qualquer, sem mover a peça.', 'tela.pintar(0, 0, "vermelho")');
  doc('olhar', 'eu.x, eu.y, eu.angulo', 'Onde a peça está e para onde olha (só leitura).', 'if (eu.x > 100) eu.olharPara("oeste")');
  doc('olhar', 'tela.largura, tela.altura', 'Tamanho da tela em células. As coordenadas vão de 0 a largura−1 e de 0 a altura−1; y cresce para baixo.', 'eu.irPara(tela.largura - 1, 0)');
  doc('olhar', 'tela.centro()', 'A célula do meio: { x, y }.', 'const c = tela.centro()');
  doc('olhar', 'tela.corEm(x, y)', 'A cor da célula (null se está no fundo; undefined se está fora da tela).', 'tela.corEm(eu.x, eu.y + 1)');
  doc('olhar', 'tela.existe(x, y)', 'Verdadeiro se a célula existe (está na tela e não foi cavada).', 'if (tela.existe(eu.x + 1, eu.y)) eu.frente(1)');
  doc('olhar', 'tela.distancia(x1, y1, x2, y2)', 'Distância em linha reta entre dois pontos.', 'tela.distancia(eu.x, eu.y, 0, 0)');
  doc('olhar', 'tela.cores', 'A lista de nomes de cor que a tela conhece.', 'tela.sortear(tela.cores)');
  doc('memoria', 'eu.marcar(nome)', 'Guarda onde a peça está e para onde olha, com um nome.', 'eu.marcar("inicio")');
  doc('memoria', 'eu.voltar(nome)', 'Volta a um lugar marcado, sem pintar o caminho.', 'eu.voltar("inicio")');
  doc('memoria', 'tela.sortear(lista)', 'Um item da lista, ao acaso.', 'eu.cor(tela.sortear(["azul", "verde"]))');
  doc('memoria', 'tela.aleatorio(min, max)', 'Um número inteiro ao acaso, entre min e max.', 'eu.frente(tela.aleatorio(3, 9))');
  doc('memoria', 'eu.dizer(texto)', 'Escreve uma frase ao lado da tela.', 'eu.dizer("pronto")');

  // ---------------------------------------------------------------
  function descrever(x) {
    if (x === null) return 'nada (null)';
    if (x === undefined) return 'nada (undefined)';
    if (typeof x === 'string') return `"${x}"`;
    if (typeof x === 'number') return String(x);
    if (Array.isArray(x)) return 'uma lista';
    return 'um objeto';
  }

  T.criarFirmware = function (ctx) {
    const e = ctx.estado, p = ctx.peca, rel = ctx.relato;
    const sortear = ctx.sorteador || Math.random;
    const lim = Object.assign({ pinturas: LIMITE_PINTURAS, chamadas: LIMITE_CHAMADAS, ms: LIMITE_MS }, ctx.limites || {});
    const tocadas = new Set();
    let pinturas = 0, chamadas = 0;
    const comeco = Date.now();
    if (p.px === undefined) { p.px = p.x; p.py = p.y; }

    function chamada() {
      if (++chamadas > lim.chamadas) throw new T.ErroDePlano(`o plano fez chamadas demais ao firmware (mais de ${lim.chamadas}); talvez esteja repetindo sem parar.`);
      if (chamadas % 500 === 0 && Date.now() - comeco > lim.ms) throw new T.ErroDePlano(`o plano demorou demais (mais de ${lim.ms / 1000} segundos); talvez esteja repetindo sem parar.`);
    }
    function numero(x, min, max, nome) {
      if (typeof x !== 'number' || !Number.isFinite(x)) throw new T.ErroDePlano(`${nome} esperava um número, mas recebeu ${descrever(x)}.`);
      return Math.max(min, Math.min(max, x));
    }
    function inteiro(x, min, max, nome) { return Math.round(numero(x, min, max, nome)); }
    // uma célula qualquer da tela; fora dela, devolve null (a operação é ignorada)
    function coord(x, y, nome) {
      x = Math.round(numero(x, -1e6, 1e6, nome)); y = Math.round(numero(y, -1e6, 1e6, nome));
      return T.dentro(e, x, y) ? { x, y } : null;
    }

    function pintarCel(x, y, cor) {
      if (!T.dentro(e, x, y)) return;
      const i = T.idx(e, x, y);
      if (e.buraco[i]) return;
      if (++pinturas > lim.pinturas) throw new T.ErroDePlano(`o plano pintou células demais (mais de ${lim.pinturas}).`);
      e.cel[i] = cor;
      tocadas.add(i);
    }
    // pinta com a espessura da caneta (um disco em volta da célula)
    function carimbar(x, y, cor, esp) {
      esp = esp || p.espessura;
      if (esp <= 1) { pintarCel(x, y, cor); return; }
      const r = (esp - 1) / 2, r2 = (r + 0.4) * (r + 0.4);
      const lo = Math.floor(-r), hi = Math.ceil(r);
      for (let dy = lo; dy <= hi; dy++) for (let dx = lo; dx <= hi; dx++) if (dx * dx + dy * dy <= r2) pintarCel(x + dx, y + dy, cor);
    }
    function registrarPasso() {
      if (rel.passos.length < LIMITE_PASSOS) rel.passos.push({ x: p.x, y: p.y, ang: p.ang });
    }
    function por(px, py) {
      p.px = px; p.py = py; p.x = Math.round(px); p.y = Math.round(py);
    }

    // Anda célula a célula (Bresenham) de onde está até (tx, ty). Para
    // diante de célula inexistente. Devolve o motivo da parada ou null.
    function andarAte(tx, ty, pintando) {
      let x0 = p.x, y0 = p.y;
      const x1 = Math.round(tx), y1 = Math.round(ty);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy, parada = null;
      if (pintando) carimbar(x0, y0, p.tinta);
      while (x0 !== x1 || y0 !== y1) {
        const e2 = 2 * err;
        let nx = x0, ny = y0;
        if (e2 >= dy) { err += dy; nx += sx; }
        if (e2 <= dx) { err += dx; ny += sy; }
        if (!T.existe(e, nx, ny)) { parada = T.dentro(e, nx, ny) ? `célula cavada em (${nx}, ${ny})` : 'borda da tela'; break; }
        x0 = nx; y0 = ny;
        if (pintando) carimbar(x0, y0, p.tinta);
        chamada();
      }
      if (parada) por(x0, y0); else por(tx, ty);
      registrarPasso();
      return parada;
    }

    function andar(n, sinal) {
      chamada();
      n = numero(n, 0, 1000, 'eu.frente/eu.tras');
      const rad = p.ang * Math.PI / 180;
      const tx = p.px + Math.sin(rad) * n * sinal, ty = p.py - Math.cos(rad) * n * sinal;
      const parada = andarAte(tx, ty, p.caneta);
      if (parada) rel.avisos.push(`${p.nome} parou antes do fim: ${parada}.`);
      return !parada;
    }

    function preencher(x, y, cor) {
      if (!T.existe(e, x, y)) return 0;
      const alvo = e.cel[T.idx(e, x, y)];
      if (alvo === cor) return 0;
      const fila = [[x, y]];
      let n = 0;
      while (fila.length) {
        const [cx, cy] = fila.pop();
        if (!T.existe(e, cx, cy) || e.cel[T.idx(e, cx, cy)] !== alvo) continue;
        pintarCel(cx, cy, cor);
        n++;
        fila.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
        if (n % 1000 === 0) chamada();
      }
      return n;
    }

    function cavarOuAterrar(x, y, cavar) {
      if (!T.dentro(e, x, y)) return false;
      const i = T.idx(e, x, y);
      if (cavar) {
        for (const id of e.ordem) {
          const q = e.pecas[id];
          if (q.x === x && q.y === y) throw new T.ErroDePlano(`não dá para cavar (${x}, ${y}): ${q.nome} está em cima.`);
        }
        e.buraco[i] = 1; e.cel[i] = null;
      } else {
        e.buraco[i] = 0;
      }
      tocadas.add(i);
      if (++pinturas > lim.pinturas) throw new T.ErroDePlano(`o plano alterou células demais (mais de ${lim.pinturas}).`);
      return true;
    }

    function aFrente(n) {
      const cels = [];
      const rad = p.ang * Math.PI / 180;
      let x0 = p.x, y0 = p.y;
      const x1 = Math.round(p.px + Math.sin(rad) * n), y1 = Math.round(p.py - Math.cos(rad) * n);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      while (x0 !== x1 || y0 !== y1) {
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
        cels.push([x0, y0]);
      }
      return cels;
    }

    const eu = {
      get x() { return p.x; }, get y() { return p.y; }, get angulo() { return p.ang; },
      get tinta() { return p.tinta; }, get nome() { return p.nome; }, get canetaBaixada() { return p.caneta; },
      frente(n) { return andar(n, 1); },
      tras(n) { return andar(n, -1); },
      direita(g) { chamada(); p.ang = (((p.ang + numero(g, -3600, 3600, 'eu.direita')) % 360) + 360) % 360; return p.ang; },
      esquerda(g) { chamada(); p.ang = (((p.ang - numero(g, -3600, 3600, 'eu.esquerda')) % 360) + 360) % 360; return p.ang; },
      olharPara(d) { chamada(); p.ang = T.angulo(d); return p.ang; },
      mirar(x, y) {
        chamada();
        x = numero(x, -1e6, 1e6, 'eu.mirar'); y = numero(y, -1e6, 1e6, 'eu.mirar');
        if (x === p.px && y === p.py) return p.ang;
        p.ang = ((Math.atan2(x - p.px, -(y - p.py)) * 180 / Math.PI) + 360) % 360;
        return p.ang;
      },
      irPara(x, y) {
        chamada();
        x = inteiro(x, 0, e.larg - 1, 'eu.irPara'); y = inteiro(y, 0, e.alt - 1, 'eu.irPara');
        if (!T.existe(e, x, y)) { rel.avisos.push(`${p.nome} não pôde ir para (${x}, ${y}): a célula está cavada.`); return false; }
        por(x, y); registrarPasso(); return true;
      },
      linhaAte(x, y) {
        chamada();
        x = numero(x, 0, e.larg - 1, 'eu.linhaAte'); y = numero(y, 0, e.alt - 1, 'eu.linhaAte');
        eu.mirar(x, y);
        const parada = andarAte(x, y, p.caneta);
        if (parada) rel.avisos.push(`${p.nome} parou antes de (${Math.round(x)}, ${Math.round(y)}): ${parada}.`);
        return !parada;
      },
      levantar() { chamada(); p.caneta = false; },
      baixar() { chamada(); p.caneta = true; },
      cor(c) { chamada(); p.tinta = T.cor(c); return p.tinta; },
      espessura(n) { chamada(); p.espessura = inteiro(n, 1, 7, 'eu.espessura'); return p.espessura; },
      ponto() { chamada(); carimbar(p.x, p.y, p.tinta); },
      circulo(raio, cheio) {
        chamada();
        raio = numero(raio, 0, 300, 'eu.circulo');
        const cx = p.x, cy = p.y, r2 = raio * raio;
        if (cheio) {
          for (let y = -Math.ceil(raio); y <= Math.ceil(raio); y++) for (let x = -Math.ceil(raio); x <= Math.ceil(raio); x++) if (x * x + y * y <= r2 + raio * 0.5) pintarCel(cx + x, cy + y, p.tinta);
        } else {
          const passos = Math.max(16, Math.ceil(raio * 8));
          for (let k = 0; k <= passos; k++) {
            const a = k / passos * Math.PI * 2;
            carimbar(Math.round(cx + Math.cos(a) * raio), Math.round(cy + Math.sin(a) * raio), p.tinta);
          }
        }
      },
      retangulo(l, a, cheio) {
        chamada();
        l = inteiro(l, 1, 1000, 'eu.retangulo'); a = inteiro(a, 1, 1000, 'eu.retangulo');
        for (let y = 0; y < a; y++) for (let x = 0; x < l; x++) {
          if (cheio || x === 0 || y === 0 || x === l - 1 || y === a - 1) carimbar(p.x + x, p.y + y, p.tinta);
        }
      },
      poligono(lados, tam) {
        chamada();
        lados = inteiro(lados, 3, 36, 'eu.poligono'); tam = numero(tam, 1, 1000, 'eu.poligono');
        for (let k = 0; k < lados; k++) { andar(tam, 1); eu.direita(360 / lados); }
      },
      preencher(c) {
        chamada();
        const cor = c === undefined ? p.tinta : T.cor(c);
        return preencher(p.x, p.y, cor);
      },
      cavar(n) { chamada(); let k = 0; for (const [x, y] of aFrente(inteiro(n, 1, 1000, 'eu.cavar'))) if (cavarOuAterrar(x, y, true)) k++; return k; },
      aterrar(n) { chamada(); let k = 0; for (const [x, y] of aFrente(inteiro(n, 1, 1000, 'eu.aterrar'))) if (cavarOuAterrar(x, y, false)) k++; return k; },
      marcar(nome) { chamada(); e.marcas[String(nome)] = { x: p.px, y: p.py, ang: p.ang }; },
      voltar(nome) {
        chamada();
        const m = e.marcas[String(nome)];
        if (!m) throw new T.ErroDePlano(`não há lugar marcado com o nome "${nome}".`);
        por(m.x, m.y); p.ang = m.ang; registrarPasso();
      },
      dizer(t) { chamada(); rel.falas.push(String(t).slice(0, 160)); }
    };

    const tela = {
      get largura() { return e.larg; }, get altura() { return e.alt; },
      get cores() { return Object.keys(T.CORES); },
      centro() { return { x: Math.floor(e.larg / 2), y: Math.floor(e.alt / 2) }; },
      corEm(x, y) { chamada(); return T.corEm(e, Math.round(x), Math.round(y)); },
      existe(x, y) { chamada(); return T.existe(e, Math.round(x), Math.round(y)); },
      distancia(x1, y1, x2, y2) { chamada(); return Math.hypot(x2 - x1, y2 - y1); },
      pintar(x, y, c) { chamada(); const q = coord(x, y, 'tela.pintar'); if (q) carimbar(q.x, q.y, T.cor(c), 1); return !!q; },
      apagar(x, y) { chamada(); const q = coord(x, y, 'tela.apagar'); if (q) carimbar(q.x, q.y, null, 1); return !!q; },
      preencher(x, y, c) { chamada(); const q = coord(x, y, 'tela.preencher'); return q ? preencher(q.x, q.y, T.cor(c)) : 0; },
      cavar(x, y) { chamada(); const q = coord(x, y, 'tela.cavar'); return q ? cavarOuAterrar(q.x, q.y, true) : false; },
      aterrar(x, y) { chamada(); const q = coord(x, y, 'tela.aterrar'); return q ? cavarOuAterrar(q.x, q.y, false) : false; },
      sortear(lista) {
        chamada();
        if (!Array.isArray(lista)) throw new T.ErroDePlano(`tela.sortear esperava uma lista, mas recebeu ${descrever(lista)}.`);
        return lista.length ? lista[Math.floor(sortear() * lista.length)] : null;
      },
      aleatorio(min, max) {
        chamada();
        min = numero(min, -1e6, 1e6, 'tela.aleatorio'); max = numero(max, -1e6, 1e6, 'tela.aleatorio');
        return Math.floor(min + sortear() * (max - min + 1));
      }
    };

    // o relato recebe as células tocadas só no fim (o Set é mais barato)
    Object.defineProperty(rel, 'tocadas', { get: () => [...tocadas], enumerable: true, configurable: true });
    return { eu: Object.freeze(eu), tela: Object.freeze(tela) };
  };
})(TELA);
