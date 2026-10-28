// Tela Viva — desenho da tela num canvas, com zoom e deslocamento.
var TELA = globalThis.TELA = globalThis.TELA || {};

(function (T) {
  'use strict';

  const D = T.desenho = {};

  function corDoTexto(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return '#fff';
    const v = parseInt(m[1], 16);
    const lum = (0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) / 255;
    return lum > 0.62 ? '#17202b' : '#fff';
  }
  D.corDoTexto = corDoTexto;

  // Uma "vista": o canvas, o zoom e o deslocamento.
  D.criarVista = function (canvas, minimapa) {
    const v = {
      canvas, minimapa,
      zoom: 6,            // pixels por célula
      ox: 0, oy: 0,       // célula que aparece no canto superior esquerdo (pode ser fracionária)
      grade: true,
      base: document.createElement('canvas'),   // 1 px por célula, cores da tela
      cache: null
    };

    v.tamanho = function () {
      const r = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      return { w: r.width, h: r.height, dpr };
    };

    // célula -> pixel (em CSS px)
    v.paraTela = (cx, cy) => ({ x: (cx - v.ox) * v.zoom, y: (cy - v.oy) * v.zoom });
    v.paraCelula = (px, py) => ({ x: Math.floor(px / v.zoom + v.ox), y: Math.floor(py / v.zoom + v.oy) });

    v.ajustar = function (e) {
      const { w, h } = v.tamanho();
      v.zoom = Math.max(1, Math.floor(Math.min(w / e.larg, h / e.alt) * 0.96 * 2) / 2);
      v.ox = (e.larg - w / v.zoom) / 2;
      v.oy = (e.alt - h / v.zoom) / 2;
    };

    v.centralizar = function (cx, cy) {
      const { w, h } = v.tamanho();
      v.ox = cx + 0.5 - w / v.zoom / 2;
      v.oy = cy + 0.5 - h / v.zoom / 2;
    };

    v.zoomEm = function (fator, px, py) {
      const antes = v.paraCelulaExata(px, py);
      v.zoom = Math.max(1, Math.min(48, v.zoom * fator));
      v.zoom = v.zoom >= 4 ? Math.round(v.zoom) : Math.round(v.zoom * 4) / 4;
      v.ox = antes.x - px / v.zoom;
      v.oy = antes.y - py / v.zoom;
    };
    v.paraCelulaExata = (px, py) => ({ x: px / v.zoom + v.ox, y: py / v.zoom + v.oy });

    v.limitar = function (e) {
      const { w, h } = v.tamanho();
      const vw = w / v.zoom, vh = h / v.zoom;
      const folga = 0.35;
      if (vw >= e.larg) v.ox = (e.larg - vw) / 2;
      else v.ox = Math.max(-vw * folga, Math.min(e.larg - vw * (1 - folga), v.ox));
      if (vh >= e.alt) v.oy = (e.alt - vh) / 2;
      else v.oy = Math.max(-vh * folga, Math.min(e.alt - vh * (1 - folga), v.oy));
    };

    // Pinta a imagem base (1 px por célula) a partir do estado.
    function montarBase(e, op) {
      const b = v.base;
      if (b.width !== e.larg || b.height !== e.alt) { b.width = e.larg; b.height = e.alt; }
      const ctx = b.getContext('2d');
      const img = ctx.createImageData(e.larg, e.alt);
      const d = img.data;
      const fundo = hex(e.fundo);
      const cache = {};
      const realce = op && op.realce;
      for (let i = 0; i < e.cel.length; i++) {
        const k = i * 4;
        if (e.buraco[i]) { d[k] = 0; d[k + 1] = 0; d[k + 2] = 0; d[k + 3] = 0; continue; }
        const c = e.cel[i];
        let rgb = fundo;
        if (c) { rgb = cache[c] || (cache[c] = hex(c)); }
        d[k] = rgb[0]; d[k + 1] = rgb[1]; d[k + 2] = rgb[2]; d[k + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    }

    function hex(c) {
      const m = /^#([0-9a-f]{6})$/i.exec(c || '');
      if (!m) return [244, 241, 234];
      const n = parseInt(m[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    // op: { pecas (desenhar?), passos (caminho a destacar), tocadas (Set de índices), previa (bool), destacar (célula) }
    v.desenhar = function (e, op) {
      op = op || {};
      const { w, h, dpr } = v.tamanho();
      v.limitar(e);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const estilo = getComputedStyle(document.documentElement);
      const mesa = estilo.getPropertyValue('--mesa').trim() || '#f7f9fb';
      const buracoCor = estilo.getPropertyValue('--buraco').trim() || '#2a2f36';
      ctx.fillStyle = mesa;
      ctx.fillRect(0, 0, w, h);

      montarBase(e, op);
      const o = v.paraTela(0, 0);
      const W = e.larg * v.zoom, H = e.alt * v.zoom;
      // sombra da tela
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      ctx.fillRect(o.x + 3, o.y + 3, W, H);
      // buracos: o "nada" por baixo
      ctx.fillStyle = buracoCor;
      ctx.fillRect(o.x, o.y, W, H);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(v.base, 0, 0, e.larg, e.alt, o.x, o.y, W, H);

      // textura dos buracos (só quando o zoom permite)
      if (v.zoom >= 4) {
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 1;
        const c0 = v.paraCelula(0, 0), c1 = v.paraCelula(w, h);
        for (let y = Math.max(0, c0.y); y <= Math.min(e.alt - 1, c1.y); y++) {
          for (let x = Math.max(0, c0.x); x <= Math.min(e.larg - 1, c1.x); x++) {
            if (!e.buraco[y * e.larg + x]) continue;
            const p = v.paraTela(x, y);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y + v.zoom);
            ctx.lineTo(p.x + v.zoom, p.y);
            ctx.stroke();
          }
        }
      }

      // grade
      if (v.grade && v.zoom >= 5) {
        ctx.strokeStyle = v.zoom >= 10 ? 'rgba(0,0,0,0.13)' : 'rgba(0,0,0,0.07)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        const c0 = v.paraCelula(0, 0), c1 = v.paraCelula(w, h);
        for (let x = Math.max(0, c0.x); x <= Math.min(e.larg, c1.x + 1); x++) {
          const px = Math.round(o.x + x * v.zoom) + 0.5;
          ctx.moveTo(px, Math.max(0, o.y)); ctx.lineTo(px, Math.min(h, o.y + H));
        }
        for (let y = Math.max(0, c0.y); y <= Math.min(e.alt, c1.y + 1); y++) {
          const py = Math.round(o.y + y * v.zoom) + 0.5;
          ctx.moveTo(Math.max(0, o.x), py); ctx.lineTo(Math.min(w, o.x + W), py);
        }
        ctx.stroke();
      }

      // células tocadas pela prévia: um véu claro e borda
      if (op.tocadas && op.tocadas.size && (op.previa || op.realce)) {
        ctx.fillStyle = 'rgba(255,255,255,0.0)';
        ctx.strokeStyle = op.realce ? 'rgba(214,69,65,0.9)' : 'rgba(35,80,200,0.55)';
        ctx.lineWidth = op.realce ? 2 : 1;
        if (v.zoom >= 3) {
          const c0 = v.paraCelula(0, 0), c1 = v.paraCelula(w, h);
          for (let y = Math.max(0, c0.y); y <= Math.min(e.alt - 1, c1.y); y++) {
            for (let x = Math.max(0, c0.x); x <= Math.min(e.larg - 1, c1.x); x++) {
              const i = y * e.larg + x;
              if (!op.tocadas.has(i)) continue;
              // só a borda externa da região: vizinho não tocado
              const p = v.paraTela(x, y);
              ctx.beginPath();
              if (x === 0 || !op.tocadas.has(i - 1)) { ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y + v.zoom); }
              if (x === e.larg - 1 || !op.tocadas.has(i + 1)) { ctx.moveTo(p.x + v.zoom, p.y); ctx.lineTo(p.x + v.zoom, p.y + v.zoom); }
              if (y === 0 || !op.tocadas.has(i - e.larg)) { ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + v.zoom, p.y); }
              if (y === e.alt - 1 || !op.tocadas.has(i + e.larg)) { ctx.moveTo(p.x, p.y + v.zoom); ctx.lineTo(p.x + v.zoom, p.y + v.zoom); }
              ctx.stroke();
            }
          }
        }
      }

      // caminho da peça (passos)
      if (op.passos && op.passos.length > 1) {
        ctx.strokeStyle = 'rgba(35,80,200,0.9)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        op.passos.forEach((s, k) => {
          const p = v.paraTela(s.x + 0.5, s.y + 0.5);
          if (k === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // peças
      for (const id of e.ordem) {
        const p = e.pecas[id];
        if (p.ativa === false) continue;
        const c = v.paraTela(p.x + 0.5, p.y + 0.5);
        const r = Math.max(9, Math.min(16, v.zoom * 0.9));
        const a = (p.ang - 90) * Math.PI / 180;
        ctx.save();
        ctx.translate(c.x, c.y);
        // halo
        ctx.beginPath(); ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fill();
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(r * 1.15, 0);
        ctx.lineTo(-r * 0.75, r * 0.8);
        ctx.lineTo(-r * 0.35, 0);
        ctx.lineTo(-r * 0.75, -r * 0.8);
        ctx.closePath();
        ctx.fillStyle = p.cor; ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = '#17202b'; ctx.stroke();
        ctx.restore();
        // a tinta atual, como um pingo ao lado
        ctx.beginPath(); ctx.arc(c.x + r + 6, c.y - r - 2, 5, 0, Math.PI * 2);
        ctx.fillStyle = p.tinta || '#000'; ctx.fill();
        ctx.lineWidth = 1; ctx.strokeStyle = p.caneta ? '#17202b' : 'rgba(23,32,43,0.4)'; ctx.stroke();
        if (!p.caneta) { ctx.beginPath(); ctx.moveTo(c.x + r + 2, c.y - r + 2); ctx.lineTo(c.x + r + 10, c.y - r - 6); ctx.strokeStyle = '#c42727'; ctx.lineWidth = 1.5; ctx.stroke(); }
      }

      // célula sob o cursor
      if (op.destacar && T.dentro(e, op.destacar.x, op.destacar.y)) {
        const p = v.paraTela(op.destacar.x, op.destacar.y);
        ctx.strokeStyle = 'rgba(35,80,200,0.9)';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x, p.y, v.zoom, v.zoom);
      }

      // moldura da tela
      ctx.strokeStyle = op.previa ? 'rgba(35,80,200,0.9)' : 'rgba(23,32,43,0.35)';
      ctx.lineWidth = op.previa ? 3 : 1;
      if (op.previa) ctx.setLineDash([10, 6]);
      ctx.strokeRect(o.x - 0.5, o.y - 0.5, W + 1, H + 1);
      ctx.setLineDash([]);

      v.desenharMinimapa(e, w, h);
    };

    v.desenharMinimapa = function (e, w, h) {
      if (!minimapa) return;
      const mw = 160, mh = Math.round(mw * e.alt / e.larg);
      const dpr = window.devicePixelRatio || 1;
      minimapa.style.width = mw + 'px'; minimapa.style.height = mh + 'px';
      if (minimapa.width !== mw * dpr) { minimapa.width = mw * dpr; minimapa.height = mh * dpr; }
      const ctx = minimapa.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#2a2f36';
      ctx.fillRect(0, 0, mw, mh);
      ctx.drawImage(v.base, 0, 0, e.larg, e.alt, 0, 0, mw, mh);
      const esc = mw / e.larg;
      ctx.strokeStyle = '#2350c8'; ctx.lineWidth = 2;
      ctx.strokeRect(v.ox * esc, v.oy * esc, (w / v.zoom) * esc, (h / v.zoom) * esc);
      for (const id of e.ordem) {
        const p = e.pecas[id];
        if (p.ativa === false) continue;
        ctx.beginPath(); ctx.arc((p.x + 0.5) * esc, (p.y + 0.5) * esc, 3, 0, Math.PI * 2);
        ctx.fillStyle = p.cor; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
      }
      // a visão inteira está toda dentro?
      minimapa.hidden = (w / v.zoom >= e.larg && h / v.zoom >= e.alt);
    };

    return v;
  };

  // Uma miniatura estática (para a lista de camadas).
  D.miniatura = function (e, larguraPx) {
    const c = document.createElement('canvas');
    const esc = larguraPx / e.larg;
    c.width = larguraPx; c.height = Math.round(e.alt * esc);
    const ctx = c.getContext('2d');
    const b = document.createElement('canvas');
    b.width = e.larg; b.height = e.alt;
    const bctx = b.getContext('2d');
    const img = bctx.createImageData(e.larg, e.alt);
    const d = img.data;
    for (let i = 0; i < e.cel.length; i++) {
      const k = i * 4;
      if (e.buraco[i]) { d[k + 3] = 0; continue; }
      const m = /^#([0-9a-f]{6})$/i.exec(e.cel[i] || e.fundo);
      const n = m ? parseInt(m[1], 16) : 0xf4f1ea;
      d[k] = (n >> 16) & 255; d[k + 1] = (n >> 8) & 255; d[k + 2] = n & 255; d[k + 3] = 255;
    }
    bctx.putImageData(img, 0, 0);
    ctx.fillStyle = '#2a2f36'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(b, 0, 0, c.width, c.height);
    return c.toDataURL();
  };
})(TELA);
