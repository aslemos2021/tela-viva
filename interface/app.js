// Tela Viva — a página: pedir, ler o plano, ver a prévia, aceitar.
var TELA = globalThis.TELA = globalThis.TELA || {};

(function (T) {
  'use strict';

  const D = T.desenho;
  const MODO = (() => { const m = new URLSearchParams(location.search).get('modo'); return ['coletivo', 'projetor'].includes(m) ? m : 'individual'; })();
  const CHAVE = 'tela-viva:v1';
  const CHAVE_DUPLA = 'tela-viva:dupla';
  const PALETA = ['#d64541', '#e5822f', '#d4a514', '#7ba32a', '#2a9d5a', '#17999a', '#2f7ad0', '#4b52c6', '#8a49c3', '#c4489a', '#8b5a3a', '#56687a', '#e0698a', '#3f8f7a', '#b06a2b', '#6b7c2a'];
  const $ = id => document.getElementById(id);
  const esc = s => String(s === undefined || s === null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const A = {
    estado: null,
    vista: null,
    previa: null,          // { estado, relato } da prévia em exibição
    rascunho: null,        // plano em edição: { titulo, pedido, entendi, escolhas, codigo, origem, conversa, alternativas }
    ia: { disponivel: false, modelo: '', ocupado: false, erro: '', verificado: false },
    aba: 'tela',
    cursor: null,
    arrasto: null,
    ajustando: false,
    falas: [],
    modo: MODO,
    eu: null,              // id da própria peça (modo coletivo)
    versao: 0,             // versão da tela coletiva recebida do servidor
    destaque: null,        // { tocadas, passos, ate } da última camada chegada (projetor)
    sincronizando: false
  };
  const coletivo = () => A.modo !== 'individual';

  // ---------------------------------------------------------------
  function salvar() {
    if (coletivo()) return;
    try { localStorage.setItem(CHAVE, JSON.stringify({ estado: A.estado, rascunho: A.rascunho })); } catch (e) { }
  }
  function lerSalvo() {
    try { const s = localStorage.getItem(CHAVE); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  }
  const e = () => A.estado;
  const peca = () => e().pecas[A.eu] || e().pecas[e().ordem[0]] || { nome: '—', x: 0, y: 0, ang: 0, tinta: null, caneta: true, espessura: 1 };

  function realce(codigo) {
    const re = /(\/\/[^\n]*)|('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`)|\b(eu|tela)\.(\w+)|\b(const|let|var|if|else|for|of|in|return|function|while|true|false|null|new|break|continue)\b|\b(\d+(?:\.\d+)?)\b/g;
    let out = '', ult = 0, m;
    while ((m = re.exec(codigo))) {
      out += esc(codigo.slice(ult, m.index));
      if (m[1]) out += `<span class="tk-com">${esc(m[1])}</span>`;
      else if (m[2]) out += `<span class="tk-str">${esc(m[2])}</span>`;
      else if (m[3]) out += `<span class="tk-fw">${m[3]}.<b>${esc(m[4])}</b></span>`;
      else if (m[5]) out += `<span class="tk-kw">${m[5]}</span>`;
      else if (m[6]) out += `<span class="tk-num">${m[6]}</span>`;
      ult = re.lastIndex;
    }
    return out + esc(codigo.slice(ult));
  }

  let avisoTimer = null;
  function aviso(texto) {
    let a = document.querySelector('.aviso-flutuante');
    if (!a) { a = document.createElement('div'); a.className = 'aviso-flutuante'; a.setAttribute('role', 'status'); document.body.appendChild(a); }
    a.textContent = texto; a.classList.add('visivel');
    clearTimeout(avisoTimer); avisoTimer = setTimeout(() => a.classList.remove('visivel'), 2800);
  }

  // ---------------------------------------------------------------
  // Desenho
  // ---------------------------------------------------------------
  function redesenhar() {
    if (A.aba !== 'tela') return;
    const base = A.previa ? A.previa.estado : e();
    A.vista.grade = $('chaveGrade').checked;
    const dest = !A.previa && A.destaque && A.destaque.ate > Date.now() ? A.destaque : null;
    A.vista.desenhar(base, {
      previa: !!A.previa,
      realce: !!dest,
      tocadas: A.previa ? new Set(A.previa.relato.tocadas) : (dest ? dest.tocadas : null),
      passos: A.previa ? A.previa.relato.passos : (dest ? dest.passos : null),
      destacar: A.cursor
    });
    $('seloPrevia').hidden = !A.previa;
    $('zoomValor').textContent = (A.vista.zoom >= 4 ? Math.round(A.vista.zoom) : A.vista.zoom) + '×';
    $('falas').innerHTML = A.falas.map(f => `<span>${esc(f)}</span>`).join('');
  }

  function renderTopo() {
    const p = peca();
    const st = e();
    const quem = A.modo === 'projetor' ? `<b>${st.ordem.length}</b> ${st.ordem.length === 1 ? 'peça' : 'peças'} na tela coletiva` : `${esc(p.nome)} em (${p.x}, ${p.y}), olhando para ${T.nomeAngulo(p.ang)}`;
    $('topoMeio').innerHTML = `
      ${A.modo !== 'individual' ? `<span class="pilula pilula-modo">${A.modo === 'projetor' ? 'Projetor' : 'Tela coletiva'}</span>` : ''}
      <span class="topo-item"><b>${st.camadas.length}</b> ${st.camadas.length === 1 ? 'camada' : 'camadas'}</span>
      <span class="topo-item">${quem}</span>
      <span class="pilula ${A.ia.disponivel ? 'pilula-ok' : 'pilula-neutra'}" title="${esc(A.ia.erro || '')}">${A.ia.disponivel ? 'IA ligada · ' + esc(A.ia.modelo) : (A.ia.verificado ? 'sem IA: código à mão' : 'procurando a IA…')}</span>`;
    for (const b of $('abas').children) {
      if (b.dataset.aba === A.aba) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    }
    $('palcoInfo').innerHTML = `<span class="etiqueta etiqueta-forte">${st.larg} × ${st.alt} células</span>`;
  }

  // ---------------------------------------------------------------
  // Lateral
  // ---------------------------------------------------------------
  function renderLateral() {
    if (A.modo === 'projetor') { renderLateralProjetor(); return; }
    const r = A.rascunho;
    let h = '';
    h += `<section class="cartao cartao-pedido">
      <header class="cartao-cabeca"><h2>O que a peça deve fazer?</h2></header>
      <textarea id="pedido" rows="3" placeholder="Descreva o plano. Ex.: um pentagrama em que cada ponta tenha uma cor diferente">${esc(r && r.origem !== 'exemplo' ? r.pedido : '')}</textarea>
      <div class="fila-botoes">
        <button type="button" class="botao botao-primario" data-acao="pedir" ${A.ia.disponivel && !A.ia.ocupado ? '' : 'disabled'}>${A.ia.ocupado ? 'Traduzindo…' : 'Pedir à IA'}</button>
        <label class="campo-inline">Exemplo
          <select id="exemplo"><option value="">escolher…</option>${T.EXEMPLOS.map((x, i) => `<option value="${i}">${esc(x.titulo)}</option>`).join('')}</select>
        </label>
        <button type="button" class="botao-texto" data-acao="manual">Escrever o código à mão</button>
      </div>
      ${!A.ia.disponivel && A.ia.verificado ? `<p class="cartao-nota">${esc(A.ia.erro || 'A IA só funciona quando a página é servida pelo computador do professor.')}</p>` : ''}
      ${A.ia.ultimoErro ? `<p class="cartao-nota erro">${esc(A.ia.ultimoErro)}</p>` : ''}
    </section>`;

    if (r) {
      const rel = A.previa && A.previa.relato;
      h += `<section class="cartao cartao-plano${rel && !rel.ok ? ' plano-falhou' : ''}">
        <header class="cartao-cabeca">
          <h2>${esc(r.titulo || 'Plano')}</h2>
          <span class="etiqueta">${{ ia: 'traduzido pela IA', manual: 'à mão', exemplo: 'exemplo' }[r.origem] || ''}</span>
        </header>
        ${r.pedido && r.origem === 'exemplo' ? `<blockquote class="pedido">“${esc(r.pedido)}”</blockquote>` : ''}
        ${r.entendi ? `<p class="entendi"><b>${r.origem === 'ia' ? 'A IA entendeu:' : 'Resumo:'}</b> ${esc(r.entendi)}</p>` : ''}
        ${r.escolhas && r.escolhas.length ? `<div class="escolhas"><b>Escolhas feitas onde o pedido não dizia</b><ul>${r.escolhas.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
        ${r.pergunta ? `<p class="pergunta"><b>A IA pergunta:</b> ${esc(r.pergunta)}</p>` : ''}
        ${r.alternativas && r.alternativas.length ? `<div class="alternativas"><b>${r.codigo ? 'Outras leituras possíveis' : 'O pedido não coube como está. Leituras possíveis:'}</b>
          <ul>${r.alternativas.map((x, i) => `<li>${esc(x)} <button type="button" class="botao-texto" data-acao="pedirAssim" data-i="${i}">pedir assim</button></li>`).join('')}</ul></div>` : ''}
        <label class="campo-rotulo" for="codigo">Código do plano <small>(pode editar)</small></label>
        <div class="editor-codigo">
          <pre class="codigo realce" id="realce" aria-hidden="true"><code>${realce(r.codigo || '')}\n</code></pre>
          <textarea id="codigo" class="codigo entrada-codigo" spellcheck="false" rows="${Math.max(4, Math.min(22, (r.codigo || '').split('\n').length + 1))}">${esc(r.codigo || '')}</textarea>
        </div>
        ${rel ? resultadoHtml(rel) : ''}
        <div class="fila-botoes">
          <button type="button" class="botao" data-acao="previa" ${r.codigo ? '' : 'disabled'}>${A.previa ? 'Refazer a prévia' : 'Ver a prévia'}</button>
          ${A.previa ? '<button type="button" class="botao" data-acao="semPrevia">Ver a tela atual</button>' : ''}
          <button type="button" class="botao botao-primario" data-acao="aceitar" ${rel && rel.ok ? '' : 'disabled'} title="${rel && rel.ok ? '' : 'Veja a prévia primeiro'}">${coletivo() ? 'Enviar à tela coletiva' : 'Aceitar e pintar'}</button>
        </div>
        <div class="fila-botoes fila-secundaria">
          ${A.ia.disponivel && r.origem === 'ia' ? '<button type="button" class="botao-texto" data-acao="ajustar">Ajustar o pedido…</button>' : ''}
          <button type="button" class="botao-texto" data-acao="descartar">Descartar</button>
        </div>
        ${r.ajustando ? `<div class="ajuste">
          <label class="campo-rotulo" for="ajuste">O que mudar?</label>
          <textarea id="ajuste" rows="2" placeholder="Ex.: menor, e com as pontas em tons de azul"></textarea>
          <button type="button" class="botao" data-acao="enviarAjuste" ${A.ia.ocupado ? 'disabled' : ''}>${A.ia.ocupado ? 'Traduzindo…' : 'Enviar o ajuste'}</button>
        </div>` : ''}
      </section>`;
    }

    const p = peca();
    h += `<section class="cartao cartao-peca">
      <header class="cartao-cabeca"><h2>A peça</h2></header>
      <dl class="ficha">
        <dt>Nome</dt><dd>${coletivo() ? `<b>${esc(p.nome)}</b> <span class="amostra" style="background:${esc(p.cor)}"></span>` : `<input type="text" id="nomePeca" class="campo-nome" value="${esc(p.nome)}" maxlength="24" aria-label="Nome da peça">`}</dd>
        <dt>Posição</dt><dd>(${p.x}, ${p.y})</dd>
        <dt>Direção</dt><dd>${Math.round(p.ang)}° · ${T.nomeAngulo(p.ang)}</dd>
        <dt>Tinta</dt><dd><span class="amostra" style="background:${esc(p.tinta || 'transparent')}"></span> ${esc(nomeDaCor(p.tinta))}, espessura ${p.espessura}</dd>
        <dt>Caneta</dt><dd>${p.caneta ? 'baixada (pinta)' : 'levantada'}</dd>
      </dl>
      <p class="cartao-nota">Shift + clique numa célula faz a peça saltar até lá (vira uma camada, como tudo).</p>
    </section>`;
    if (coletivo()) h += outrasPecasHtml();
    $('lateral').innerHTML = h;
    const ta = $('codigo');
    if (ta) {
      ta.addEventListener('input', () => {
        A.rascunho.codigo = ta.value;
        $('realce').innerHTML = `<code>${realce(ta.value)}\n</code>`;
        A.previa = null; $('seloPrevia').hidden = true;
        salvar();
      });
      ta.addEventListener('scroll', () => { $('realce').scrollTop = ta.scrollTop; $('realce').scrollLeft = ta.scrollLeft; });
    }
    const np = $('nomePeca');
    if (np) np.addEventListener('change', () => { peca().nome = np.value.trim() || 'Eu'; salvar(); renderTopo(); });
    const ped = $('pedido');
    if (ped) ped.addEventListener('input', () => { if (A.rascunho && A.rascunho.origem !== 'exemplo') { A.rascunho.pedido = ped.value; } });
  }

  function pastilha(p, s) {
    s = s || 22;
    return `<svg class="pastilha" width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="${esc(p.cor)}"/><text x="12" y="12" dy="3.4" text-anchor="middle" font-size="9.5" font-weight="700" fill="${D.corDoTexto(p.cor)}">${esc(String(p.nome).slice(0, 2).toUpperCase())}</text></svg>`;
  }

  function outrasPecasHtml() {
    const st = e();
    const outras = st.ordem.filter(id => id !== A.eu).map(id => st.pecas[id]);
    if (!outras.length) return '';
    return `<section class="cartao"><header class="cartao-cabeca"><h2>As outras peças</h2></header>
      <ul class="lista-pecas">${outras.map(q => `<li>${pastilha(q)}<span>${esc(q.nome)}</span><small>(${q.x}, ${q.y})</small></li>`).join('')}</ul></section>`;
  }

  function cartaoCamadaHtml(c, op) {
    const st = e();
    const p = st.pecas[c.peca] || { nome: c.autor, cor: '#888' };
    return `<section class="cartao cartao-plano cartao-feed${op && op.grande ? ' cartao-grande' : ''}${c.falhou ? ' plano-falhou' : ''}">
      <header class="cartao-cabeca">${pastilha(p, op && op.grande ? 30 : 22)}<h2>${esc(c.titulo || 'Plano')}</h2><span class="etiqueta">camada ${c.n} · ${esc(c.quando || '')}</span></header>
      ${c.pedido && c.pedido !== c.titulo ? `<blockquote class="pedido">“${esc(c.pedido)}”<cite>${esc(c.autor)}</cite></blockquote>` : ''}
      ${c.entendi ? `<p class="entendi"><b>A IA entendeu:</b> ${esc(c.entendi)}</p>` : ''}
      ${c.escolhas && c.escolhas.length ? `<div class="escolhas"><b>Escolhas</b><ul>${c.escolhas.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      ${c.falhou ? `<p class="resultado resultado-falha">Esta camada falha: ${esc(c.explicacao || '')}</p>` : ''}
      <pre class="codigo"><code>${realce(c.codigo || '')}</code></pre>
    </section>`;
  }

  function renderLateralProjetor() {
    const st = e();
    const ultimas = st.camadas.slice(-6).reverse();
    let h = '';
    if (!st.camadas.length) {
      h += `<section class="cartao"><header class="cartao-cabeca"><h2>Tela coletiva</h2></header>
        <p>Nenhuma camada ainda. As equipes entram pelo endereço com <code>?modo=coletivo</code>; cada plano enviado aparece aqui.</p></section>`;
    } else {
      h += cartaoCamadaHtml(ultimas[0], { grande: true });
      if (ultimas.length > 1) {
        h += `<section class="cartao"><header class="cartao-cabeca"><h2>Antes dessa</h2></header><ol class="feed">${ultimas.slice(1).map(c => {
          const p = st.pecas[c.peca] || { nome: c.autor, cor: '#888' };
          return `<li>${pastilha(p)}<span class="feed-n">${c.n}</span><span class="feed-titulo">${esc(c.titulo)}</span><small>${esc(c.autor)}</small></li>`;
        }).join('')}</ol></section>`;
      }
    }
    h += `<section class="cartao"><header class="cartao-cabeca"><h2>Peças</h2><span class="etiqueta">${st.ordem.length}</span></header>
      <ul class="lista-pecas">${st.ordem.map(id => { const q = st.pecas[id]; return `<li>${pastilha(q)}<span>${esc(q.nome)}</span><small>(${q.x}, ${q.y}) · ${st.camadas.filter(c => c.peca === id).length} camadas</small></li>`; }).join('') || '<li><small>ninguém entrou ainda</small></li>'}</ul></section>`;
    $('lateral').innerHTML = h;
  }

  function nomeDaCor(hex) {
    if (!hex) return 'fundo';
    const nome = Object.keys(T.CORES).find(k => T.CORES[k] === hex);
    return nome || hex;
  }

  function resultadoHtml(rel) {
    if (!rel.ok) {
      return `<div class="resultado resultado-falha"><b>O plano falhou:</b> ${esc(rel.explicacao)} Nada foi pintado.<br><code>${esc(rel.falha)}</code></div>`;
    }
    const n = rel.tocadas.length;
    let h = `<div class="resultado resultado-ok"><b>Prévia pronta.</b> ${n} ${n === 1 ? 'célula alterada' : 'células alteradas'}, ${rel.passos.length - 1} ${rel.passos.length === 2 ? 'deslocamento' : 'deslocamentos'} da peça.`;
    if (rel.avisos.length) h += `<ul class="avisos">${rel.avisos.slice(0, 4).map(a => `<li>${esc(a)}</li>`).join('')}${rel.avisos.length > 4 ? `<li>… e mais ${rel.avisos.length - 4}</li>` : ''}</ul>`;
    if (rel.falas.length) h += `<p class="falas-lista">${rel.falas.map(f => `“${esc(f)}”`).join(' ')}</p>`;
    return h + '</div>';
  }

  // ---------------------------------------------------------------
  // Ações
  // ---------------------------------------------------------------
  function novoRascunho(campos) {
    A.rascunho = Object.assign({ titulo: '', pedido: '', entendi: '', escolhas: [], codigo: '', origem: 'manual', conversa: [], alternativas: [], pergunta: '' }, campos);
    A.previa = null;
    A.falas = [];
    salvar();
    renderLateral();
    redesenhar();
  }

  function verPrevia() {
    const r = A.rascunho;
    if (!r || !r.codigo.trim()) return;
    const plano = { codigo: r.codigo, semente: (e().camadas.length + 1) * 7919, peca: A.eu || e().ordem[0] };
    const pv = T.previa(e(), plano);
    A.previa = pv;
    A.falas = pv.relato.falas;
    renderLateral();
    redesenhar();
    if (pv.relato.ok && pv.relato.passos.length > 1) {
      const fim = pv.relato.passos[pv.relato.passos.length - 1];
      const { w, h } = A.vista.tamanho();
      const v = A.vista.paraTela(fim.x, fim.y);
      if (v.x < 0 || v.y < 0 || v.x > w || v.y > h) { A.vista.centralizar(fim.x, fim.y); redesenhar(); }
    }
  }

  async function enviarCamada(campos) {
    const r = await fetch('/coletivo/camada', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ peca: A.eu }, campos)) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) throw new Error(d.erro || ('o servidor respondeu ' + r.status));
    return d;
  }

  function aceitar() {
    const r = A.rascunho;
    if (!r || !A.previa || !A.previa.relato.ok) return;
    if (coletivo()) {
      const campos = { titulo: r.titulo || (r.pedido ? r.pedido.slice(0, 60) : 'Plano à mão'), pedido: r.pedido, entendi: r.entendi, escolhas: r.escolhas, codigo: r.codigo };
      enviarCamada(campos).then(d => {
        A.rascunho = null; A.previa = null;
        aviso(`Camada ${d.n} enviada à tela coletiva.`);
        return sincronizar(true);
      }).catch(erro => aviso(`Não consegui enviar: ${erro.message}`));
      return;
    }
    const rel = T.aceitar(e(), {
      titulo: r.titulo || (r.pedido ? r.pedido.slice(0, 60) : 'Plano à mão'),
      pedido: r.pedido, entendi: r.entendi, escolhas: r.escolhas, codigo: r.codigo,
      autor: peca().nome, semente: (e().camadas.length + 1) * 7919
    });
    registrar({ evento: 'aceito', pedido: r.pedido, codigo: r.codigo, origem: r.origem, ok: rel.ok });
    A.rascunho = null; A.previa = null; A.falas = rel.falas;
    salvar();
    renderTopo(); renderLateral(); redesenhar();
    aviso(rel.ok ? `Camada ${e().camadas.length} pintada.` : 'A camada falhou ao ser pintada.');
  }

  function saltar(x, y) {
    if (!T.existe(e(), x, y)) { aviso('Essa célula está cavada.'); return; }
    if (A.modo === 'projetor') return;
    if (coletivo()) {
      enviarCamada({ titulo: `Salto para (${x}, ${y})`, pedido: '', entendi: 'A peça saltou sem pintar.', escolhas: [], codigo: `eu.irPara(${x}, ${y});` })
        .then(() => sincronizar(true)).catch(erro => aviso(`Não consegui enviar: ${erro.message}`));
      return;
    }
    const rel = T.aceitar(e(), { titulo: `Salto para (${x}, ${y})`, pedido: '', entendi: 'A peça saltou sem pintar.', codigo: `eu.irPara(${x}, ${y});`, autor: peca().nome });
    A.previa = null;
    salvar(); renderTopo(); renderLateral(); redesenhar();
  }

  function carregarExemplo(i) {
    const ex = T.EXEMPLOS[Number(i)];
    if (!ex) return;
    novoRascunho({ titulo: ex.titulo, pedido: ex.pedido, entendi: ex.entendi, escolhas: ex.escolhas.slice(), codigo: ex.codigo, origem: 'exemplo' });
    verPrevia();
  }

  // ---------------------------------------------------------------
  // IA (passa pelo servidor do professor)
  // ---------------------------------------------------------------
  const base = () => (location.protocol === 'file:' ? null : '');

  async function verificarIA() {
    A.ia.verificado = false;
    if (base() === null) { A.ia.disponivel = false; A.ia.erro = 'A página foi aberta como arquivo. A IA só funciona quando ela é servida pelo computador do professor.'; A.ia.verificado = true; renderTopo(); renderLateral(); return; }
    try {
      const r = await fetch('/ia/estado', { cache: 'no-store' });
      if (!r.ok) throw new Error('resposta ' + r.status);
      const d = await r.json();
      A.ia.disponivel = !!d.ligada; A.ia.modelo = d.modelo || ''; A.ia.erro = d.motivo || ''; A.ia.professor = !!d.professor;
    } catch (erro) {
      A.ia.disponivel = false;
      A.ia.erro = 'Não encontrei o servidor do professor nesta página; o código pode ser escrito ou colado à mão.';
    }
    A.ia.verificado = true;
    renderTopo(); renderLateral();
  }

  function contexto() {
    const p = peca(), st = e();
    return {
      largura: st.larg, altura: st.alt,
      peca: { nome: p.nome, x: p.x, y: p.y, angulo: Math.round(p.ang), direcao: T.nomeAngulo(p.ang), tinta: nomeDaCor(p.tinta), caneta: p.caneta ? 'baixada' : 'levantada', espessura: p.espessura },
      camadas: st.camadas.slice(-4).map(c => ({ n: c.n, titulo: c.titulo, pedido: c.pedido, autor: c.autor })),
      modo: A.modo,
      outrasPecas: coletivo() ? st.ordem.filter(id => id !== A.eu).map(id => ({ nome: st.pecas[id].nome, x: st.pecas[id].x, y: st.pecas[id].y })) : undefined
    };
  }

  async function pedir(pedidoTexto, conversa) {
    if (!A.ia.disponivel || A.ia.ocupado) return;
    const texto = (pedidoTexto || '').trim();
    if (!texto) { aviso('Escreva o pedido primeiro.'); return; }
    A.ia.ocupado = true; A.ia.ultimoErro = '';
    renderLateral();
    try {
      const r = await fetch('/ia/traduzir', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido: texto, contexto: contexto(), conversa: conversa || [] })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) throw new Error(d.erro || ('o servidor respondeu ' + r.status));
      const pl = d.plano || {};
      const novaConversa = (conversa || []).concat([{ pedido: texto, codigo: pl.codigo || '', entendi: pl.entendi || '' }]);
      novoRascunho({
        titulo: pl.titulo || texto.slice(0, 60), pedido: texto, entendi: pl.entendi || '', escolhas: Array.isArray(pl.escolhas) ? pl.escolhas : [],
        codigo: pl.codigo || '', origem: 'ia', conversa: novaConversa, alternativas: Array.isArray(pl.alternativas) ? pl.alternativas : [], pergunta: pl.pergunta || ''
      });
      if (A.rascunho.codigo) verPrevia();
    } catch (erro) {
      A.ia.ultimoErro = `A IA não respondeu: ${erro.message}`;
    } finally {
      A.ia.ocupado = false;
      renderLateral();
    }
  }

  function registrar(dados) {
    if (base() === null) return;
    try { fetch('/registro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ peca: peca().nome }, dados)) }).catch(() => { }); } catch (e) { }
  }

  // ---------------------------------------------------------------
  // Camadas
  // ---------------------------------------------------------------
  function renderCamadas() {
    const st = e();
    // uma passada só: reconstrói e tira uma miniatura depois de cada camada
    const copia = T.clonar(st);
    copia.camadas = [];
    const minis = [];
    const limpo = T.clonar(copia);
    T.reconstruir(limpo);
    for (const c of st.camadas) {
      const r = T.executar(limpo, c);
      minis.push({ img: D.miniatura(limpo, 220), ok: r.ok, explicacao: r.explicacao });
    }
    $('vista-camadas').innerHTML = `<div class="folha">
      <header class="folha-cabeca"><div><h1>Camadas</h1>
        <p>Cada plano aceito é uma camada. A tela é sempre o resultado de executar todas as camadas em ordem, a partir do zero; por isso qualquer uma pode ser removida, e as seguintes são refeitas por cima.</p></div>
        <div class="folha-acao">${st.camadas.length ? '<button type="button" class="botao" data-acao="exportar">Copiar a tela (texto)</button>' : ''}
        ${coletivo() ? '' : '<button type="button" class="botao" data-acao="importar">Colar uma tela…</button>'}
        ${!coletivo() || A.ia.professor ? '<button type="button" class="botao botao-perigo" data-acao="zerar">Tela nova</button>' : ''}</div>
      </header>
      ${st.camadas.length ? '' : '<p class="cartao-nota">Ainda não há camadas. Aceite um plano na aba Tela.</p>'}
      <ol class="lista-camadas">${st.camadas.map((c, i) => `
        <li class="cartao camada${c.falhou ? ' camada-falhou' : ''}">
          <img class="camada-mini" src="${minis[i].img}" alt="Tela depois da camada ${c.n}" width="220">
          <div class="camada-corpo">
            <header class="cartao-cabeca"><span class="camada-n">${c.n}</span><h2>${esc(c.titulo || c.pedido || 'Plano')}</h2><span class="etiqueta">${esc(c.autor)}</span></header>
            ${c.pedido && c.pedido !== c.titulo ? `<blockquote class="pedido">“${esc(c.pedido)}”</blockquote>` : ''}
            ${c.entendi ? `<p class="entendi">${esc(c.entendi)}</p>` : ''}
            ${c.falhou ? `<p class="resultado resultado-falha">Esta camada falha agora: ${esc(minis[i].explicacao)} (Pode ser porque uma camada anterior foi removida.)</p>` : ''}
            <details class="detalhe-codigo"><summary>Código</summary><pre class="codigo"><code>${realce(c.codigo)}</code></pre></details>
            <div class="fila-botoes">${A.modo !== 'projetor' ? `<button type="button" class="botao-texto" data-acao="reutilizar" data-n="${c.n}">Reutilizar como rascunho</button>` : ''}
            ${!coletivo() || c.peca === A.eu || A.ia.professor ? `<button type="button" class="botao-texto perigo" data-acao="remover" data-n="${c.n}">Remover esta camada</button>` : ''}</div>
          </div>
        </li>`).join('')}</ol></div>`;
  }

  function renderFirmware() {
    const grupos = T.GRUPOS.map(g => `<section class="bloco"><h2>${esc(g.nome)}</h2><p>${esc(g.descricao)}</p>
      <div class="tabela-rolagem"><table class="tabela-firmware"><tbody>${T.FIRMWARE.filter(f => f.grupo === g.id).map(f => `<tr><th scope="row"><code>${esc(f.assinatura)}</code></th><td>${esc(f.descricao)}<br><code class="exemplo">${esc(f.exemplo)}</code></td></tr>`).join('')}</tbody></table></div></section>`).join('');
    $('vista-firmware').innerHTML = `<div class="folha folha-texto">
      <header class="folha-cabeca"><div><h1>Firmware da Tela</h1>
      <p>É o vocabulário com que todo plano é escrito. Você descreve o que quer em português; a IA traduz para combinações destas operações. Quando um pedido não cabe nelas, a IA diz isso e propõe leituras possíveis.</p></div></header>
      <section class="bloco"><h2>Como um plano é escrito</h2>
        <p>Um plano é um trecho de código que recebe dois objetos: <code>eu</code>, a peça com a sua caneta, e <code>tela</code>, a superfície. A peça começa cada plano onde o anterior a deixou, olhando na mesma direção, com a mesma tinta.</p>
        <pre class="codigo"><code>${realce(T.EXEMPLOS[2].codigo)}</code></pre>
        <p>Os planos são executados num ambiente fechado: se o código der erro no meio, tudo o que ele pintou é desfeito e a falha é explicada. Um plano que repete sem parar é interrompido.</p>
      </section>
      <section class="bloco"><h2>Cores com nome</h2><div class="paleta">${Object.keys(T.CORES).map(k => `<span class="cor-chip"><i style="background:${T.CORES[k]}"></i>${esc(k)}</span>`).join('')}</div>
        <p class="cartao-nota">Qualquer código <code>#rrggbb</code> também vale. "fundo" apaga.</p></section>
      ${grupos}
    </div>`;
  }

  // ---------------------------------------------------------------
  // Navegação e eventos
  // ---------------------------------------------------------------
  function irPara(aba) {
    A.aba = ['tela', 'camadas', 'firmware'].includes(aba) ? aba : 'tela';
    for (const v of ['tela', 'camadas', 'firmware']) $(`vista-${v}`).hidden = v !== A.aba;
    renderTopo();
    if (A.aba === 'tela') { renderLateral(); requestAnimationFrame(redesenhar); }
    else if (A.aba === 'camadas') renderCamadas();
    else renderFirmware();
  }

  // ---------------------------------------------------------------
  // Tela inteira: só a imagem, ocupando a tela toda (projetor)
  // ---------------------------------------------------------------
  function telaCheia(ligar) {
    const caixa = $('telaCaixa');
    const agora = document.body.classList.contains('tela-cheia');
    if (ligar === undefined) ligar = !agora;
    document.body.classList.toggle('tela-cheia', ligar);
    $('zTelaCheia').textContent = ligar ? 'Sair' : 'Tela inteira';
    try {
      if (ligar && !document.fullscreenElement && caixa.requestFullscreen) caixa.requestFullscreen().catch(() => { });
      if (!ligar && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => { });
    } catch (e) { }
    atualizarLegenda();
    requestAnimationFrame(() => { A.vista.ajustar(A.previa ? A.previa.estado : e()); redesenhar(); });
  }

  function atualizarLegenda() {
    const el = $('legenda');
    if (!el) return;
    const st = e();
    const c = st && st.camadas[st.camadas.length - 1];
    if (!document.body.classList.contains('tela-cheia') || !c) { el.hidden = true; return; }
    const p = st.pecas[c.peca] || { nome: c.autor, cor: '#888' };
    el.innerHTML = `${pastilha(p, 26)}<span><b>${esc(c.titulo || 'Plano')}</b><small>camada ${c.n} · ${esc(c.autor)}</small></span>`;
    el.hidden = false;
  }

  function ligarEventos() {
    $('zTelaCheia').addEventListener('click', () => telaCheia());
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && document.body.classList.contains('tela-cheia')) telaCheia(false);
      else requestAnimationFrame(() => { A.vista.ajustar(A.previa ? A.previa.estado : e()); redesenhar(); });
    });
    $('abas').addEventListener('click', ev => { const b = ev.target.closest('[data-aba]'); if (b) irPara(b.dataset.aba); });
    window.addEventListener('resize', () => redesenhar());
    $('chaveGrade').addEventListener('change', redesenhar);
    $('zMais').addEventListener('click', () => { const { w, h } = A.vista.tamanho(); A.vista.zoomEm(1.5, w / 2, h / 2); redesenhar(); });
    $('zMenos').addEventListener('click', () => { const { w, h } = A.vista.tamanho(); A.vista.zoomEm(1 / 1.5, w / 2, h / 2); redesenhar(); });
    $('zAjustar').addEventListener('click', () => { A.vista.ajustar(A.previa ? A.previa.estado : e()); redesenhar(); });
    $('zPeca').addEventListener('click', () => { const p = (A.previa ? A.previa.estado : e()).pecas[e().ordem[0]]; if (A.vista.zoom < 6) A.vista.zoom = 8; A.vista.centralizar(p.x, p.y); redesenhar(); });

    const cv = $('canvas');
    cv.addEventListener('wheel', ev => {
      ev.preventDefault();
      const r = cv.getBoundingClientRect();
      A.vista.zoomEm(ev.deltaY < 0 ? 1.2 : 1 / 1.2, ev.clientX - r.left, ev.clientY - r.top);
      redesenhar();
    }, { passive: false });
    cv.addEventListener('pointerdown', ev => {
      cv.setPointerCapture(ev.pointerId);
      A.arrasto = { x: ev.clientX, y: ev.clientY, ox: A.vista.ox, oy: A.vista.oy, moveu: false };
    });
    cv.addEventListener('pointermove', ev => {
      const r = cv.getBoundingClientRect();
      const c = A.vista.paraCelula(ev.clientX - r.left, ev.clientY - r.top);
      if (A.arrasto) {
        const dx = ev.clientX - A.arrasto.x, dy = ev.clientY - A.arrasto.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) A.arrasto.moveu = true;
        A.vista.ox = A.arrasto.ox - dx / A.vista.zoom;
        A.vista.oy = A.arrasto.oy - dy / A.vista.zoom;
        redesenhar();
        return;
      }
      if (!A.cursor || A.cursor.x !== c.x || A.cursor.y !== c.y) {
        A.cursor = c;
        const st = A.previa ? A.previa.estado : e();
        if (T.dentro(st, c.x, c.y)) {
          const i = T.idx(st, c.x, c.y);
          $('coords').textContent = `(${c.x}, ${c.y}) · ${st.buraco[i] ? 'cavada' : nomeDaCor(st.cel[i])}`;
        } else { $('coords').textContent = ''; }
        redesenhar();
      }
    });
    cv.addEventListener('pointerup', ev => {
      const a = A.arrasto; A.arrasto = null;
      if (!a || a.moveu) return;
      const r = cv.getBoundingClientRect();
      const c = A.vista.paraCelula(ev.clientX - r.left, ev.clientY - r.top);
      if (ev.shiftKey && T.dentro(e(), c.x, c.y)) saltar(c.x, c.y);
    });
    cv.addEventListener('pointerleave', () => { A.cursor = null; $('coords').textContent = ''; redesenhar(); });
    $('minimapa').addEventListener('pointerdown', ev => {
      const r = ev.currentTarget.getBoundingClientRect();
      const st = e();
      A.vista.centralizar((ev.clientX - r.left) / r.width * st.larg, (ev.clientY - r.top) / r.height * st.alt);
      redesenhar();
    });

    $('lateral').addEventListener('click', ev => {
      const b = ev.target.closest('[data-acao]');
      if (!b || b.disabled) return;
      const acao = b.dataset.acao;
      if (acao === 'pedir') pedir($('pedido').value);
      else if (acao === 'manual') novoRascunho({ titulo: 'Plano à mão', pedido: $('pedido') ? $('pedido').value : '', codigo: A.rascunho && A.rascunho.codigo ? A.rascunho.codigo : 'eu.cor("azul");\neu.olharPara("leste");\neu.frente(20);\n', origem: 'manual' });
      else if (acao === 'previa') verPrevia();
      else if (acao === 'semPrevia') { A.previa = null; renderLateral(); redesenhar(); }
      else if (acao === 'aceitar') aceitar();
      else if (acao === 'descartar') { A.rascunho = null; A.previa = null; A.falas = []; salvar(); renderLateral(); redesenhar(); }
      else if (acao === 'ajustar') { A.rascunho.ajustando = true; renderLateral(); $('ajuste').focus(); }
      else if (acao === 'enviarAjuste') pedir($('ajuste').value, A.rascunho.conversa);
      else if (acao === 'pedirAssim') pedir(A.rascunho.alternativas[Number(b.dataset.i)], A.rascunho.conversa);
    });
    $('lateral').addEventListener('change', ev => {
      if (ev.target.id === 'exemplo' && ev.target.value !== '') carregarExemplo(ev.target.value);
    });
    $('lateral').addEventListener('keydown', ev => {
      if (ev.target.id === 'pedido' && ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); pedir(ev.target.value); }
      if (ev.target.id === 'codigo' && ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); verPrevia(); }
      if (ev.target.id === 'codigo' && ev.key === 'Tab') { ev.preventDefault(); const t = ev.target; const s = t.selectionStart; t.setRangeText('  ', s, t.selectionEnd, 'end'); t.dispatchEvent(new Event('input')); }
    });

    $('vista-camadas').addEventListener('click', ev => {
      const b = ev.target.closest('[data-acao]');
      if (!b) return;
      const acao = b.dataset.acao;
      if (acao === 'remover' && coletivo()) {
        fetch('/coletivo/remover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ n: Number(b.dataset.n), peca: A.eu }) })
          .then(r => r.json()).then(d => { if (!d.ok) throw new Error(d.erro); aviso('Camada removida.'); return sincronizar(true); })
          .catch(erro => aviso(`Não deu: ${erro.message}`));
      } else if (acao === 'zerar' && coletivo()) {
        if (b.dataset.certeza) {
          fetch('/coletivo/zerar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
            .then(r => r.json()).then(d => { if (!d.ok) throw new Error(d.erro); aviso('Tela coletiva zerada (as peças ficam).'); return sincronizar(true); })
            .catch(erro => aviso(`Não deu: ${erro.message}`));
        } else { b.dataset.certeza = '1'; b.textContent = 'Apagar todas as camadas mesmo?'; setTimeout(() => { delete b.dataset.certeza; b.textContent = 'Tela nova'; }, 3000); }
      } else if (acao === 'remover') {
        const c = T.desfazer(e(), Number(b.dataset.n));
        registrar({ evento: 'removida', titulo: c && c.titulo });
        salvar(); renderCamadas(); renderTopo();
        aviso(`Camada removida: ${c ? c.titulo : ''}`);
      } else if (acao === 'reutilizar') {
        const c = e().camadas.find(x => x.n === Number(b.dataset.n));
        if (c) { novoRascunho({ titulo: c.titulo, pedido: c.pedido, entendi: c.entendi, escolhas: c.escolhas.slice(), codigo: c.codigo, origem: 'manual' }); irPara('tela'); verPrevia(); }
      } else if (acao === 'zerar') {
        if (b.dataset.certeza) { A.estado = T.criar({ larg: e().larg, alt: e().alt }); A.rascunho = null; A.previa = null; salvar(); renderCamadas(); renderTopo(); aviso('Tela nova.'); }
        else { b.dataset.certeza = '1'; b.textContent = 'Apagar tudo mesmo?'; setTimeout(() => { delete b.dataset.certeza; b.textContent = 'Tela nova'; }, 3000); }
      } else if (acao === 'exportar') {
        const texto = JSON.stringify({ larg: e().larg, alt: e().alt, camadas: e().camadas });
        navigator.clipboard.writeText(texto).then(() => aviso('Camadas copiadas. Cole em "Colar uma tela…" noutro computador.'), () => aviso('Não consegui copiar.'));
      } else if (acao === 'importar') {
        const caixa = document.createElement('div');
        caixa.className = 'dialogo-fundo';
        caixa.innerHTML = `<div class="dialogo-caixa" role="dialog" aria-modal="true"><h2>Colar uma tela</h2><p>Cole o texto copiado com "Copiar a tela". As camadas coladas substituem as atuais.</p><textarea id="textoTela" rows="8"></textarea><div class="fila-botoes"><button type="button" class="botao" data-d="fechar">Cancelar</button><button type="button" class="botao botao-primario" data-d="ok">Carregar</button></div></div>`;
        document.body.appendChild(caixa);
        caixa.addEventListener('click', ev2 => {
          const d = ev2.target.closest('[data-d]');
          if (ev2.target === caixa || (d && d.dataset.d === 'fechar')) { caixa.remove(); return; }
          if (d && d.dataset.d === 'ok') {
            try {
              const j = JSON.parse(caixa.querySelector('#textoTela').value);
              if (!Array.isArray(j.camadas)) throw new Error('x');
              A.estado = T.criar({ larg: j.larg, alt: j.alt });
              A.estado.camadas = j.camadas.map((c, i) => Object.assign({}, c, { n: i + 1 }));
              T.reconstruir(A.estado);
              salvar(); caixa.remove(); renderCamadas(); renderTopo(); aviso('Tela carregada.');
            } catch (erro) { aviso('Esse texto não é uma tela do Tela Viva.'); }
          }
        });
      }
    });

    document.addEventListener('keydown', ev => {
      if (ev.target.closest('input, textarea, select')) return;
      if (A.aba !== 'tela') return;
      if (ev.key === 'f' || ev.key === 'F') { telaCheia(); return; }
      if (ev.key === 'g' || ev.key === 'G') { $('chaveGrade').checked = !$('chaveGrade').checked; redesenhar(); return; }
      if (ev.key === 'Escape' && document.body.classList.contains('tela-cheia')) { telaCheia(false); return; }
      const passo = 40 / A.vista.zoom;
      if (ev.key === 'ArrowLeft') { A.vista.ox -= passo; redesenhar(); }
      else if (ev.key === 'ArrowRight') { A.vista.ox += passo; redesenhar(); }
      else if (ev.key === 'ArrowUp') { A.vista.oy -= passo; redesenhar(); }
      else if (ev.key === 'ArrowDown') { A.vista.oy += passo; redesenhar(); }
      else if (ev.key === '+' || ev.key === '=') $('zMais').click();
      else if (ev.key === '-') $('zMenos').click();
    });
  }

  // ---------------------------------------------------------------
  // Tela coletiva: o servidor guarda peças e camadas; cada página refaz a
  // tela a partir delas e pergunta, de tempos em tempos, se algo mudou.
  // ---------------------------------------------------------------
  function montarDoServidor(d) {
    const st = T.criar({ larg: d.larg, alt: d.alt, pecas: (d.pecas || []).map(p => ({ id: p.id, nome: p.nome, cor: p.cor, x: p.x, y: p.y })) });
    st.camadas = (d.camadas || []).map((c, i) => Object.assign({}, c, { n: i + 1, escolhas: Array.isArray(c.escolhas) ? c.escolhas : [] }));
    const relatos = T.reconstruir(st);
    st.camadas.forEach((c, i) => { c.explicacao = relatos[i].explicacao; });
    return { estado: st, relatos };
  }

  async function sincronizar(forcar) {
    if (A.sincronizando) return;
    A.sincronizando = true;
    try {
      const r = await fetch(`/coletivo/estado?versao=${forcar ? 0 : A.versao}`, { cache: 'no-store' });
      if (!r.ok) throw new Error('resposta ' + r.status);
      const d = await r.json();
      if (d.igual) return;
      const novasCamadas = (d.camadas || []).length;
      const antes = A.estado ? A.estado.camadas.length : 0;
      const { estado, relatos } = montarDoServidor(d);
      const primeira = !A.estado;
      A.estado = estado;
      A.versao = d.versao;
      if (A.modo === 'projetor' && novasCamadas > antes && relatos.length) {
        const rel = relatos[relatos.length - 1];
        A.destaque = { tocadas: new Set(rel.tocadas), passos: rel.passos, ate: Date.now() + 9000 };
        setTimeout(redesenhar, 9200);
      }
      if (A.previa && A.rascunho) {
        const pv = T.previa(A.estado, { codigo: A.rascunho.codigo, semente: (A.estado.camadas.length + 1) * 7919, peca: A.eu });
        A.previa = pv;
      }
      renderTopo();
      atualizarLegenda();
      if (A.aba === 'tela') { renderLateral(); if (primeira || document.body.classList.contains('tela-cheia')) A.vista.ajustar(A.estado); redesenhar(); }
      else if (A.aba === 'camadas') renderCamadas();
      $('ligacao').hidden = true;
    } catch (erro) {
      $('ligacao').hidden = false;
      $('ligacao').textContent = `Sem ligação com o computador do professor (${erro.message}). Tentando de novo…`;
    } finally {
      A.sincronizando = false;
    }
  }

  function pedirNomeDaDupla() {
    return new Promise(resolve => {
      let nome = '';
      try { nome = localStorage.getItem(CHAVE_DUPLA) || ''; } catch (e) { }
      const caixa = document.createElement('div');
      caixa.className = 'dialogo-fundo';
      caixa.innerHTML = `<div class="dialogo-caixa" role="dialog" aria-modal="true"><h2>Qual é o nome da equipe?</h2>
        <p>O nome identifica a peça de vocês na tela coletiva. Se já entraram antes, usem o mesmo nome para recuperar a peça.</p>
        <input type="text" id="nomeDupla" class="campo-nome campo-nome-grande" maxlength="24" value="${esc(nome)}" placeholder="Ex.: Cometa">
        <div class="fila-botoes"><button type="button" class="botao botao-primario" id="entrarBotao">Entrar na tela</button></div></div>`;
      document.body.appendChild(caixa);
      const inp = caixa.querySelector('#nomeDupla');
      const ok = () => {
        const v = inp.value.trim();
        if (!v) { inp.focus(); return; }
        try { localStorage.setItem(CHAVE_DUPLA, v); } catch (e) { }
        caixa.remove(); resolve(v);
      };
      caixa.querySelector('#entrarBotao').addEventListener('click', ok);
      inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') ok(); });
      inp.focus();
    });
  }

  async function iniciarColetivo() {
    if (A.modo === 'coletivo') {
      const nome = await pedirNomeDaDupla();
      try {
        const r = await fetch('/coletivo/entrar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome }) });
        const d = await r.json();
        if (!d.ok) throw new Error(d.erro);
        A.eu = d.peca.id;
      } catch (erro) {
        $('ligacao').hidden = false;
        $('ligacao').textContent = `Não consegui entrar na tela coletiva: ${erro.message}`;
      }
    }
    await sincronizar(true);
    setInterval(() => sincronizar(false), A.modo === 'projetor' ? 1500 : 2500);
  }

  function iniciar(dados) {
    if (coletivo()) {
      A.estado = T.criar({ larg: 200, alt: 120, pecas: [] });
      A.vista = D.criarVista($('canvas'), $('minimapa'));
      ligarEventos();
      document.body.classList.add('modo-' + A.modo);
      renderTopo(); renderLateral();
      requestAnimationFrame(() => { A.vista.ajustar(A.estado); redesenhar(); });
      verificarIA();
      iniciarColetivo();
      return;
    }
    const salvo = dados && dados.estado ? dados : lerSalvo();
    if (salvo && salvo.estado && salvo.estado.versao === 1) {
      A.estado = salvo.estado;
      // garante a consistência: a tela é sempre o replay das camadas
      T.reconstruir(A.estado);
      A.rascunho = salvo.rascunho || null;
      if (A.rascunho) A.rascunho.ajustando = false;
    } else {
      A.estado = T.criar({ larg: 160, alt: 100 });
    }
    A.vista = D.criarVista($('canvas'), $('minimapa'));
    ligarEventos();
    const hot = window.claude && window.claude.hot;
    if (hot && hot.snapshot) hot.snapshot(() => ({ estado: A.estado, rascunho: A.rascunho }));
    renderTopo();
    renderLateral();
    requestAnimationFrame(() => { A.vista.ajustar(A.estado); redesenhar(); });
    verificarIA();
    const inicial = (location.hash || '').replace('#', '');
    if (inicial && inicial !== 'tela') irPara(inicial);
  }

  T.app = A;
  const hot = window.claude && window.claude.hot;
  if (hot && hot.ready) hot.ready(iniciar); else iniciar((hot && hot.data) || null);
})(TELA);
