/* ===========================================================
   casa.js — a casa do Gabriel, no mesmo estilo isométrico do escritório

   Na ficha do Gabriel, "🏠 Ir para casa": ele desce pelo elevador da
   torre e aparece aqui, chegando pela garagem. A casa tem:
     • garagem: a BMW 335i E90 preta num elevador de dois postes (dá para
       subir e descer), bancada, painel de ferramentas, carrinho de
       ferramentas, compressor, rack de rodas, macaco e as faixas da M;
     • sala integrada com a garagem por um vidro (as poltronas olham para
       o carro), TV na parede ripada, cozinha com ilha e mesa de jantar;
     • deck com piscina na frente.
   Ele anda sozinho entre os cantos da casa, como no escritório.

   É uma tela à parte, com canvas próprio: usa as mesmas peças do motor
   (ISO, AVATAR, PATH e alguns móveis do FURN), mas não mexe no andar.
   =========================================================== */
const CASA = (() => {

  const S = ISO.toScreen, HW = ISO.HW, HH = ISO.HH, TW = ISO.TW;
  const box = (...a) => ISO.box(ctx, ...a), plane = (...a) => ISO.plane(ctx, ...a);
  const W = 30, H = 25;          // o lote: casa em y 0..18, deck e piscina na frente
  const PE = 124;                // pé-direito
  const shade = ISO.shade, rgba = ISO.rgba;

  let el = null, cv = null, ctx = null, cw = 0, ch = 0, dpr = 1, raf = 0, t = 0, T0 = 0;
  let aberta = false, opts = {};
  const cam = { x: 0, y: 0, z: .5, tz: .5 };

  /* ---------------- planta: o que bloqueia o caminho ---------------- */
  const bloq = new Uint8Array(W * H);
  const bloqueia = (x, y, w, d) => {
    for (let i = Math.floor(x); i < Math.ceil(x + w); i++)
      for (let j = Math.floor(y); j < Math.ceil(y + d); j++)
        if (i >= 0 && j >= 0 && i < W && j < H) bloq[j * W + i] = 1;
  };
  const pisavel = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !bloq[y * W + x];

  /* ===========================================================
     A BMW 335i E90 LCI M Sport (o modelo 3D fica em e90.js), de frente
     para a sala, num elevador pantográfico (tesoura): sem colunas, nada
     tapa o carro, e as poltronas do outro lado do vidro olham para ela
     =========================================================== */
  const CARRO = (() => {
    const cx = 6.0, cy = 8.6, t = E90.tiles;
    return { cx, cy, xa: cx - t.comp / 2, xb: cx + t.comp / 2, ya: cy - t.larg / 2, yb: cy + t.larg / 2 };
  })();
  const PISTA = { esp: 5, larg: .56 };      // as duas pistas do elevador: espessura (px) e largura (tile)
  let lift = 0, liftAlvo = 0;               // altura do elevador em px
  let caixaCarro = null;                    // contorno na tela, para o toque

  function poli(pts, fill, stroke, lw) {
    ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }
  function linha(pts, cor, lw) {
    ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.strokeStyle = cor; ctx.lineWidth = lw || 1; ctx.stroke();
  }
  /** elipse vertical num plano x = X (as rodas do rack) */
  function elipseX(X, y, z, ry, rz, n = 28) {
    const p = [];
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; p.push(S(X, y + Math.cos(a) * ry, z + Math.sin(a) * rz)); }
    return p;
  }
  /** retângulo de cantos redondos deitado no chão (a sombra do carro) */
  function rretChao(x0, y0, x1, y1, r) {
    const p = [], arco = (cx, cy, a0) => { for (let i = 0; i <= 5; i++) { const a = a0 + i / 5 * Math.PI / 2; p.push(S(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0)); } };
    arco(x1 - r, y1 - r, 0); arco(x0 + r, y1 - r, Math.PI / 2); arco(x0 + r, y0 + r, Math.PI); arco(x1 - r, y0 + r, Math.PI * 1.5);
    return p;
  }

  /* ---------------- o elevador tesoura ---------------- */
  const pistaX = () => [CARRO.xa - .25, CARRO.xb + .25];
  const pistaY = s => CARRO.cy + s * E90.tiles.bitola - PISTA.larg / 2;
  function elevador() {
    const { xa, xb, ya, yb } = CARRO, sobe = lift / 46, [x0, x1] = pistaX();
    // sombra no chão: firme embaixo do carro; com ele no alto, mais aberta e mais clara
    for (let i = 0; i < 4; i++) {
      const e = .05 + i * .16 + sobe * .45;
      poli(rretChao(xa + .15 - e, ya + .1 - e, xb - .15 + e, yb - .1 + e, .5 + e * .6), `rgba(0,0,0,${((.16 - sobe * .07) * (1 - i * .2)).toFixed(3)})`);
    }
    for (const s of [-1, 1]) {                          // a pista de lá primeiro
      const y = pistaY(s), w = PISTA.larg;
      // a base no chão e a tesoura: um X comprido de cada lado da pista, com o pistão no meio
      box(x0 + .2, y + .08, x1 - x0 - .4, w - .16, 3, 0, '#2b2e34', { top: '#3a3e45' });
      if (lift > 1.5) {
        const xa0 = x0 + .35, xb0 = x1 - .35, gros = 4.5;
        const barra = (yy, ax, bx, cor) => {
          poli([S(ax, yy, 2), S(bx, yy, lift - 1), S(bx, yy, lift - 1 + gros), S(ax, yy, 2 + gros)], cor, 'rgba(0,0,0,.35)', .6);
        };
        for (const yy of [y + .1, y + w - .1]) {
          const perto = yy > y + w / 2;
          barra(yy, xa0, xb0, perto ? '#4a4f57' : '#33373e');
          barra(yy, xb0, xa0, perto ? '#565c65' : '#3a3e45');
          const m = S((xa0 + xb0) / 2, yy, lift / 2 + 2); ctx.fillStyle = '#9aa1ab'; ctx.beginPath(); ctx.arc(m.x, m.y, 1.8, 0, 7); ctx.fill();
        }
        // pistão hidráulico: o cilindro escuro e a haste cromada
        const pa = S(xa0 + .5, y + w / 2, 3), pm = S(xa0 + .5 + (xb0 - xa0) * .28, y + w / 2, 3 + lift * .32), pb = S(xa0 + .5 + (xb0 - xa0) * .5, y + w / 2, lift * .55);
        linha([pa, pm], '#1d2025', 4); linha([pm, pb], '#c3c9d1', 1.8);
      }
      // a pista: chapa de aço com a faixa de segurança nas bordas
      box(x0, y, x1 - x0, w, PISTA.esp, lift, '#5b616b', { top: '#737a84' });
      for (let x = x0 + .1; x < x1 - .2; x += .42) poli([S(x, y + w, lift + 1), S(x + .18, y + w, lift + 1), S(x + .26, y + w, lift + PISTA.esp - 1), S(x + .08, y + w, lift + PISTA.esp - 1)], '#e2b31c');
      for (let x = x0 + .25; x < x1 - .2; x += .5) linha([S(x, y + .06, lift + PISTA.esp + .2), S(x, y + w - .06, lift + PISTA.esp + .2)], 'rgba(0,0,0,.25)', .8);
      // rampas nas pontas, quando o elevador está embaixo
      if (lift < 2) {
        for (const [xa0, xa1, zA, zB] of [[x0 - .5, x0, 0, PISTA.esp], [x1, x1 + .5, PISTA.esp, 0]]) {
          poli([S(xa0, y, zA), S(xa1, y, zB), S(xa1, y + w, zB), S(xa0, y + w, zA)], '#6b727c');
          poli([S(xa0, y + w, zA), S(xa1, y + w, zB), S(xa1, y + w, 0), S(xa0, y + w, 0)], '#454a52');
        }
      }
    }
    // a central hidráulica, no chão ao lado do elevador
    box(2.3, 10.9, .6, .5, 40, 0, '#22252b', { top: '#33373f' });
    const lz = S(2.9, 11.15, 32); ctx.fillStyle = '#2fd07a'; ctx.fillRect(lz.x - 1.2, lz.y - 1, 2.4, 2);
    const lr = S(2.9, 11.25, 26); ctx.fillStyle = '#e33'; ctx.fillRect(lr.x - 1.2, lr.y - 1, 2.4, 2);
    linha([S(2.9, 11.0, 4), S(x0 + .3, pistaY(1) + PISTA.larg / 2, 0)], '#111', 1.4);   // a mangueira
  }

  function bmw() {
    const { cx, cy } = CARRO, n = NASSA.noite();
    const c0 = S(cx, cy, lift + PISTA.esp);
    caixaCarro = E90.desenhar(ctx, c0.x, c0.y, n);
    if (n > .2) {                           // os angel eyes acesos
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const p of E90.farois()) ISO.glow(ctx, c0.x + p.x, c0.y + p.y, 9, '#d6ebff', .32 * n);
      ctx.restore();
    }
  }

  /* ===========================================================
     Paredes: norte (y = 0) e oeste (x = 0), com o que vai pendurado
     =========================================================== */
  function faceN(x0, Y, len, zTop, fn) {
    const o = S(x0, Y, zTop);
    ctx.save(); ctx.transform(HW / TW, HH / TW, 0, 1, o.x, o.y); fn(len * TW); ctx.restore();
  }
  function faceW(X, y0, len, zTop, fn) {
    const o = S(X, y0 + len, zTop);
    ctx.save(); ctx.transform(HW / TW, -HH / TW, 0, 1, o.x, o.y); fn(len * TW); ctx.restore();
  }

  function paredes() {
    const n = NASSA.noite(), C = NASSA.ceu(n);
    // espessura e tampa
    box(-.3, -.3, W + .3, .3, PE, 0, '#2b2f36', { top: '#3b4049' });
    box(-.3, 0, .3, 18, PE, 0, '#2b2f36', { top: '#3b4049' });

    // ---- garagem, parede norte: painel de ferramentas
    faceN(0, 0, 13, PE, (L) => {
      ctx.fillStyle = '#3c4048'; ctx.fillRect(0, 0, L, PE);
      ctx.fillStyle = '#33373e'; ctx.fillRect(0, PE - 10, L, 10);           // rodapé
      // fita de LED fria no alto
      ctx.fillStyle = 'rgba(230,240,255,.85)'; ctx.fillRect(0, 4, L, 1.4);
      // painel perfurado
      ctx.fillStyle = '#2a2e35'; ISO.rrect(ctx, 26, 16, 360, 64, 3); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      for (let u = 32; u < 384; u += 6) for (let v = 22; v < 78; v += 6) ctx.fillRect(u, v, 1.2, 1.2);
      // jogo de chaves combinadas, da maior para a menor
      for (let i = 0; i < 10; i++) {
        const u = 42 + i * 9, h = 40 - i * 2.2;
        ctx.fillStyle = '#c9ced6'; ctx.fillRect(u, 24, 2.4, h);
        ctx.beginPath(); ctx.arc(u + 1.2, 24, 2.6, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(u + 1.2, 24 + h, 2.2, 0, 7); ctx.fill();
      }
      // chaves de fenda com cabo colorido
      ['#e1262e', '#e1262e', '#f1c40f', '#1f6fd0', '#1f6fd0', '#1b1d22'].forEach((c, i) => {
        const u = 150 + i * 10;
        ctx.fillStyle = c; ISO.rrect(ctx, u - 2, 24, 5, 13, 2); ctx.fill();
        ctx.fillStyle = '#c9ced6'; ctx.fillRect(u - .4, 37, 1.6, 18 + (i % 3) * 4);
      });
      // martelo, alicates e a chave de roda
      ctx.fillStyle = '#9b6a3c'; ctx.fillRect(232, 30, 3, 34);
      ctx.fillStyle = '#5c6470'; ctx.fillRect(224, 26, 19, 7);
      for (let i = 0; i < 3; i++) {
        const u = 262 + i * 16;
        ctx.strokeStyle = '#c9ced6'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(u, 26); ctx.lineTo(u + 3, 44); ctx.moveTo(u + 6, 26); ctx.lineTo(u + 3, 44); ctx.stroke();
        ctx.fillStyle = i === 1 ? '#e1262e' : '#1f6fd0'; ctx.fillRect(u + 1.2, 44, 1.8, 16); ctx.fillRect(u + 3.4, 44, 1.8, 16);
      }
      ctx.strokeStyle = '#aab0b9'; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(320, 30); ctx.lineTo(370, 66); ctx.moveTo(370, 30); ctx.lineTo(320, 66); ctx.stroke();
      // soquetes numa régua
      ctx.fillStyle = '#e1262e'; ctx.fillRect(40, 70, 120, 4);
      for (let i = 0; i < 12; i++) { ctx.fillStyle = '#c9ced6'; ctx.fillRect(43 + i * 9.6, 64 - (i % 4), 6, 6 + (i % 4)); }
      // relógio de oficina e o logo da BMW pintado
      ctx.fillStyle = '#f2f2f2'; ctx.beginPath(); ctx.arc(640, 34, 12, 0, 7); ctx.fill();
      ctx.strokeStyle = '#111'; ctx.lineWidth = 1.4; ctx.beginPath();
      const d = new Date(), hh = (d.getHours() % 12 + d.getMinutes() / 60) / 12 * Math.PI * 2, mm = d.getMinutes() / 60 * Math.PI * 2;
      ctx.moveTo(640, 34); ctx.lineTo(640 + Math.sin(hh) * 6, 34 - Math.cos(hh) * 6);
      ctx.moveTo(640, 34); ctx.lineTo(640 + Math.sin(mm) * 9, 34 - Math.cos(mm) * 9); ctx.stroke();
      const lx = 760, ly = 40;
      ctx.fillStyle = '#16181c'; ctx.beginPath(); ctx.arc(lx, ly, 22, 0, 7); ctx.fill();
      ctx.strokeStyle = '#c9ced6'; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.fillStyle = '#f4f6f8'; ctx.beginPath(); ctx.arc(lx, ly, 14, 0, 7); ctx.fill();
      ctx.fillStyle = '#2a7fd4';
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.arc(lx, ly, 14, Math.PI, Math.PI * 1.5); ctx.fill();
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.arc(lx, ly, 14, 0, Math.PI / 2); ctx.fill();
      ctx.fillStyle = '#f4f6f8'; ctx.font = "700 6px 'Barlow', sans-serif"; ctx.textAlign = 'center';
      ctx.fillText('B M W', lx, ly - 15.5);
    });

    // ---- garagem, parede oeste: faixas da M, mapa do Nürburgring, prateleira
    faceW(0, 0, 18, PE, (L) => {
      ctx.fillStyle = '#3c4048'; ctx.fillRect(0, 0, L, PE);
      ctx.fillStyle = '#33373e'; ctx.fillRect(0, PE - 10, L, 10);
      ctx.fillStyle = 'rgba(230,240,255,.85)'; ctx.fillRect(0, 4, L, 1.4);
      // faixas M em neon (u: 0 = frente da garagem, L = fundo)
      ['#7fc3ff', '#1f4f9e', '#e1262e'].forEach((c, i) => {
        const u = 70 + i * 34;
        ctx.save(); ctx.shadowColor = c; ctx.shadowBlur = 14;
        ctx.fillStyle = c; ctx.beginPath();
        ctx.moveTo(u, 70); ctx.lineTo(u + 24, 70); ctx.lineTo(u + 52, 26); ctx.lineTo(u + 28, 26); ctx.closePath(); ctx.fill();
        ctx.restore();
      });
      ctx.fillStyle = '#e8eaee'; ctx.font = "800 italic 26px 'Barlow', sans-serif"; ctx.textAlign = 'left';
      ctx.fillText('M', 186, 70);
      // quadro com o traçado do Nürburgring
      ctx.fillStyle = '#15171b'; ctx.fillRect(300, 20, 150, 66);
      ctx.strokeStyle = '#c9a85c'; ctx.lineWidth = 1; ctx.strokeRect(303, 23, 144, 60);
      ctx.strokeStyle = '#f2f2f2'; ctx.lineWidth = 1.6; ctx.beginPath();
      const tr = [[318, 64], [330, 44], [352, 38], [366, 50], [384, 34], [408, 40], [430, 30], [436, 46], [420, 58], [398, 54], [384, 70], [356, 66], [340, 74], [318, 64]];
      tr.forEach(([u, v], i) => i ? ctx.lineTo(u, v) : ctx.moveTo(u, v)); ctx.stroke();
      ctx.fillStyle = '#c9a85c'; ctx.font = "700 6px 'Barlow Semi Condensed', sans-serif"; ctx.textAlign = 'center';
      ctx.fillText('NÜRBURGRING · NORDSCHLEIFE', 375, 80);
      // prateleira com óleo, aditivo e caixas
      for (const v of [40, 66, 92]) {
        ctx.fillStyle = '#6b717b'; ctx.fillRect(958, v, 186, 3);
        for (let i = 0; i < 6; i++) {
          const u = 964 + i * 30, c = ['#1f6fd0', '#e1262e', '#f1c40f', '#d9dde2', '#2c9c5a'][(i + v) % 5];
          ctx.fillStyle = c; ctx.fillRect(u, v - 14, 12, 14);
          ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(u + 9, v - 14, 3, 14);
          if (i % 3 === 0) { ctx.fillStyle = '#9b7a55'; ctx.fillRect(u + 14, v - 11, 14, 11); }
        }
      }
      ctx.fillStyle = '#e8eaee'; ctx.font = "700 9px 'Barlow Semi Condensed', sans-serif"; ctx.textAlign = 'center';
      ctx.fillText('GARAGEM DO GABRIEL', 128, 92);
    });

    // ---- casa, parede norte: janela, painel ripado com a TV, cozinha
    faceN(13, 0, 17, PE, (L) => {
      ctx.fillStyle = '#e9e4db'; ctx.fillRect(0, 0, L, PE);
      ctx.fillStyle = '#d8d2c6'; ctx.fillRect(0, PE - 8, L, 8);
      // janela para o jardim (x 14..17.4)
      const j0 = 64, j1 = 282;
      const g = ctx.createLinearGradient(0, 12, 0, 104);
      g.addColorStop(0, C.topo); g.addColorStop(.6, C.meio); g.addColorStop(1, C.base);
      ctx.fillStyle = g; ctx.fillRect(j0, 12, j1 - j0, 92);
      ctx.fillStyle = shade('#3f7a3a', -.35 * n);
      for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(j0 + 14 + i * 25, 92 - (i % 3) * 7, 18 + (i % 2) * 6, 0, 7); ctx.fill(); }
      ctx.fillStyle = shade('#2e5a2b', -.4 * n); ctx.fillRect(j0, 96, j1 - j0, 8);
      ctx.fillStyle = '#2b2e33';
      for (const u of [j0, (j0 + j1) / 2, j1]) ctx.fillRect(u - 2, 12, 4, 92);
      ctx.fillRect(j0, 10, j1 - j0, 4); ctx.fillRect(j0, 102, j1 - j0, 4);
      // painel ripado de madeira com a TV (x 17.6..23)
      const p0 = 294, p1 = 640;
      ctx.fillStyle = '#6b4a31'; ctx.fillRect(p0, 0, p1 - p0, PE - 8);
      for (let u = p0 + 3; u < p1; u += 7) { ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(u, 0, 2, PE - 8); }
      ctx.fillStyle = 'rgba(255,214,150,.12)'; ctx.fillRect(p0, 0, p1 - p0, 6);
      const tv0 = 352, tv1 = 584, tvy = 26, tvh = 62;
      ctx.fillStyle = '#060709'; ISO.rrect(ctx, tv0, tvy, tv1 - tv0, tvh, 3); ctx.fill();
      // o jogo do Palmeiras na TV
      const gr = ctx.createLinearGradient(0, tvy + 3, 0, tvy + tvh - 3);
      gr.addColorStop(0, '#2f7a36'); gr.addColorStop(1, '#215a28');
      ctx.fillStyle = gr; ctx.fillRect(tv0 + 3, tvy + 3, tv1 - tv0 - 6, tvh - 6);
      ctx.fillStyle = 'rgba(255,255,255,.07)';
      for (let i = 0; i < 8; i += 2) ctx.fillRect(tv0 + 3 + i * (tv1 - tv0 - 6) / 8, tvy + 3, (tv1 - tv0 - 6) / 8, tvh - 6);
      ctx.strokeStyle = 'rgba(255,255,255,.65)'; ctx.lineWidth = 1;
      ctx.strokeRect(tv0 + 10, tvy + 9, tv1 - tv0 - 20, tvh - 18);
      ctx.beginPath(); ctx.moveTo((tv0 + tv1) / 2, tvy + 9); ctx.lineTo((tv0 + tv1) / 2, tvy + tvh - 9); ctx.stroke();
      ctx.beginPath(); ctx.arc((tv0 + tv1) / 2, tvy + tvh / 2, 9, 0, 7); ctx.stroke();
      const bx = (tv0 + tv1) / 2 + Math.sin(t * .6) * 70, by = tvy + tvh / 2 + Math.sin(t * 1.4) * 14;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by, 1.8, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(tv0 + 8, tvy + 7, 62, 10);
      ctx.fillStyle = '#fff'; ctx.font = "700 7px 'Barlow Semi Condensed', sans-serif"; ctx.textAlign = 'left';
      ctx.fillText('PAL 2 x 0 COR', tv0 + 12, tvy + 14.5);
      // cozinha: armários de cima, revestimento e coifa (x 24..30)
      const k0 = 704;
      ctx.fillStyle = '#d9d4cc'; ctx.fillRect(k0, 60, L - k0, 26);
      for (let u = k0; u < L; u += 12) for (let v = 60; v < 86; v += 6) { ctx.fillStyle = 'rgba(0,0,0,.05)'; ctx.fillRect(u + (v % 12 ? 6 : 0), v, 11, .8); }
      ctx.fillStyle = '#2d3138'; ctx.fillRect(k0 + 80, 8, L - k0 - 80, 46);
      for (let u = k0 + 80; u < L - 1; u += 46) { ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(u, 8, 1, 46); ctx.fillStyle = '#b39a5c'; ctx.fillRect(u + 20, 46, 8, 1.6); }
      ctx.fillStyle = 'rgba(255,220,160,.7)'; ctx.fillRect(k0 + 80, 54, L - k0 - 80, 1.4);  // LED sob o armário
      ctx.fillStyle = '#b7bcc4'; ctx.beginPath();
      ctx.moveTo(L - 128, 54); ctx.lineTo(L - 52, 54); ctx.lineTo(L - 64, 30); ctx.lineTo(L - 116, 30); ctx.closePath(); ctx.fill();
      ctx.fillRect(L - 100, 8, 20, 22);
    });
  }

  /* ===========================================================
     Piso e terreno
     =========================================================== */
  let pisoCache = null;
  function piso() {
    // garagem: epóxi grafite com a área do elevador demarcada
    plane(0, 0, 13, 18, 0, '#585d64');
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1;
    for (let x = 0; x <= 13; x += 2) linha([S(x, 0), S(x, 18)], 'rgba(0,0,0,.14)', 1);
    for (let y = 0; y <= 18; y += 2) linha([S(0, y), S(13, y)], 'rgba(0,0,0,.14)', 1);
    // pontinhos do epóxi (sempre os mesmos)
    if (!pisoCache) {
      pisoCache = [];
      let s = 7;
      const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 900; i++) pisoCache.push([r() * 13, r() * 18, r() < .5]);
    }
    for (const [x, y, c] of pisoCache) { const p = S(x, y); ctx.fillStyle = c ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.12)'; ctx.fillRect(p.x, p.y, 1.2, .8); }
    ctx.restore();
    // faixa amarela e preta em volta do elevador
    const fx0 = CARRO.xa - 1.0, fy0 = CARRO.ya - .55, fx1 = CARRO.xb + 1.0, fy1 = CARRO.yb + .55;
    for (const [a, b] of [[[fx0, fy0], [fx1, fy0]], [[fx1, fy0], [fx1, fy1]], [[fx1, fy1], [fx0, fy1]], [[fx0, fy1], [fx0, fy0]]])
      linha([S(a[0], a[1]), S(b[0], b[1])], '#e2b31c', 2.2);
    // casa: porcelanato claro
    plane(13, 0, 17, 18, 0, '#cfc7ba');
    for (let x = 13; x <= 30; x += 1.5) linha([S(x, 0), S(x, 18)], 'rgba(0,0,0,.07)', 1);
    for (let y = 0; y <= 18; y += 1.5) linha([S(13, y), S(30, y)], 'rgba(0,0,0,.07)', 1);
    // frente: entrada de carro em piso drenante, gramado, deck e piscina
    plane(0, 18, 13, 7, 0, '#9b958b');
    for (let y = 18; y <= 25; y += .5) linha([S(0, y), S(13, y)], 'rgba(0,0,0,.08)', 1);
    const n = NASSA.noite();
    plane(13, 18, 17, 7, 0, shade('#4f8a42', -.3 * n));
    plane(13, 18, 17, 1.6, .5, '#8a6142');
    for (let x = 13; x <= 30; x += .35) linha([S(x, 18), S(x, 19.6)], 'rgba(0,0,0,.18)', .8);
    // piscina com borda de pedra
    plane(15.4, 19.9, 11.4, 3.8, .6, '#d9d2c4');
    const p0 = S(15.7, 20.2, -2), p2 = S(26.5, 23.4, -2);
    const ga = ctx.createLinearGradient(p0.x, p0.y, p2.x, p2.y);
    ga.addColorStop(0, n > .4 ? '#0b6b8a' : '#2fb3d6'); ga.addColorStop(1, n > .4 ? '#08415a' : '#1688b5');
    plane(15.7, 20.2, 10.8, 3.2, -2, ga);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) {
      const y = 20.5 + i * .33, fase = t * 1.3 + i;
      const pts = [];
      for (let x = 15.9; x <= 26.3; x += .4) pts.push(S(x, y + Math.sin(x * 1.7 + fase) * .06, -1.5));
      linha(pts, 'rgba(255,255,255,.10)', 1);
    }
    ctx.restore();
    // borda do terreno (diorama)
    ISO.quad(ctx, [S(0, 25, 0), S(30, 25, 0), S(30, 25, -22), S(0, 25, -22)], '#5b4a3a');
    ISO.quad(ctx, [S(30, 0, 0), S(30, 25, 0), S(30, 25, -22), S(30, 0, -22)], '#4a3c2f');
    plane(0, 24.8, 30, .2, 0, shade('#3f7a3a', -.2));
  }

  /* ===========================================================
     Móveis (lista ordenada por profundidade, como no escritório)
     =========================================================== */
  const itens = [];
  const add = (k, fn) => itens.push({ k, fn });
  const peca = o => (ctx2, tt) => FURN.drawItem(ctx2, o, tt);
  const kc = (x, y, w, d) => x + w / 2 + y + d / 2;

  function montar() {
    if (itens.length) return;
    // ---- garagem
    add(kc(1, .15, 6, 1.1), () => {                         // bancada com morsa
      box(1, .15, 6, 1.1, 34, 0, '#3a3e45');
      ISO.plane(ctx, 1, 1.25, 6, .01, 34, '#2a2d33');
      for (let i = 0; i < 4; i++) {
        const fx = 1.2 + i * 1.45;
        const a = S(fx, 1.26, 30), b = S(fx + 1.2, 1.26, 30), c = S(fx + 1.2, 1.26, 6), d = S(fx, 1.26, 6);
        poli([a, b, c, d], '#4a4f57', 'rgba(0,0,0,.4)', .8);
        linha([S(fx + .45, 1.27, 19), S(fx + .75, 1.27, 19)], '#c9ced6', 1.4);
      }
      box(.95, .1, 6.1, 1.2, 4, 34, '#a07d55', { top: '#b88f62' });       // tampo de madeira
      box(1.5, .35, .5, .5, 8, 38, '#2a5fa8');                             // morsa
      box(1.6, .45, .3, .3, 4, 46, '#c9ced6');
      box(3.2, .3, 1.1, .6, 10, 38, '#c1272d');                            // maleta
      ISO.cyl(ctx, 5.6, .6, .14, 14, 38, '#2c6fd1');                       // lata de óleo
      ISO.cyl(ctx, 6.1, .6, .12, 11, 38, '#e1262e');
    });
    add(kc(7.6, .2, 2.4, 1.1), () => {                       // carrinho de ferramentas vermelho
      ISO.shadow(ctx, 8.8, .8, 1.1, .3);
      box(7.6, .2, 2.4, 1.1, 46, 3, '#b3262a', { top: '#cf3a3e' });
      for (let i = 0; i < 7; i++) {
        const z = 8 + i * 5.6;
        linha([S(7.65, 1.31, z), S(9.95, 1.31, z)], 'rgba(0,0,0,.45)', .8);
        linha([S(8.4, 1.32, z + 2.6), S(9.2, 1.32, z + 2.6)], '#d7dbe1', 1.3);
      }
      box(7.7, .25, 2.2, .9, 18, 49, '#a52227', { top: '#c33236' });      // gaveteiro de cima
      box(7.6, .2, 2.4, 1.1, 2, 67, '#22252b');
      for (const [x, y] of [[7.75, .35], [9.85, .35], [7.75, 1.15], [9.85, 1.15]]) ISO.cyl(ctx, x, y, .07, 3, 0, '#222');
      const lg = S(8.9, 1.33, 60);
      ctx.fillStyle = '#f2f2f2'; ctx.font = "700 4.5px 'Barlow Semi Condensed', sans-serif"; ctx.textAlign = 'center';
      ctx.fillText('NASSA · TOOLS', lg.x, lg.y + 2);
    });
    add(kc(10.7, .3, .9, .9), () => {                        // compressor de ar
      ISO.shadow(ctx, 11.15, .75, .5, .3);
      ISO.cyl(ctx, 11.15, .75, .36, 52, 0, '#c1272d');
      ISO.cyl(ctx, 11.15, .75, .24, 10, 52, '#2b2e34');
      box(11.3, .5, .3, .3, 6, 58, '#9aa1ab');
    });
    add(kc(.2, 3.2, .9, 4.6), () => {                        // estante de aço com caixas
      for (const z of [0, 30, 60, 90]) box(.2, 3.2, .9, 4.6, 3, z, '#6b717b');
      for (const [x, y] of [[.2, 3.2], [.2, 7.7], [1.0, 3.2], [1.0, 7.7]]) box(x, y, .1, .1, 96, 0, '#5b616b');
      const cx = ['#9b7a55', '#1f6fd0', '#e1262e', '#d9dde2', '#2c9c5a'];
      for (let z = 0; z < 3; z++) for (let i = 0; i < 4; i++) box(.3, 3.4 + i * 1.08, .7, .8, 18 + (i % 2) * 6, z * 30 + 3, cx[(i + z) % 5]);
    });
    add(kc(.25, 10, .8, 3.6), () => {                        // rack com as rodas de pista
      box(.25, 10, .8, 3.6, 3, 0, '#4a4f57');
      for (let i = 0; i < 4; i++) {
        const y = 10.45 + i * .9;
        poli(elipseX(.85, y, 18, .42, 16), '#0b0c0f');
        poli(elipseX(.87, y, 18, .3, 11.5), '#b9bec6');
        for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2;
          linha([S(.88, y, 18), S(.88, y + Math.cos(a) * .28, 18 + Math.sin(a) * 10.5)], '#7f858f', 1.2); }
        poli(elipseX(.9, y, 18, .06, 2.2, 10), '#1f5fae');
      }
    });
    add(kc(9.4, 14, 1.8, .6), () => {                        // macaco jacaré
      ISO.shadow(ctx, 10.2, 14.3, .7, .25);
      box(9.5, 14.05, 1.4, .5, 7, 2, '#c1272d');
      box(10.8, 14.1, .3, .4, 10, 4, '#a52227');
      linha([S(9.55, 14.3, 8), S(8.7, 14.3, 26)], '#c9ced6', 2);
      for (const x of [9.6, 10.75]) ISO.cyl(ctx, x, 14.5, .08, 3, 0, '#222');
    });
    add(kc(11.3, 15, 1, 1), () => {                          // banquinho de rodinhas e a geladeira de bebidas
      ISO.cyl(ctx, 11.8, 15.5, .3, 3, 0, '#222'); ISO.cyl(ctx, 11.8, 15.5, .05, 14, 3, '#9aa1ab');
      ISO.cyl(ctx, 11.8, 15.5, .3, 5, 17, '#1b1d22');
    });
    add(kc(11.4, 2.6, 1.1, 1.1), () => {
      box(11.4, 2.6, 1.1, 1.1, 54, 0, '#2a2d33', { top: '#3a3e46' });
      const a = S(11.45, 3.71, 50), b = S(12.45, 3.71, 50), c = S(12.45, 3.71, 6), d = S(11.45, 3.71, 6);
      poli([a, b, c, d], 'rgba(120,170,220,.28)', '#111', 1);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) {
        const p = S(11.6 + j * .22, 3.72, 12 + i * 13);
        ctx.fillStyle = ['#e1262e', '#f1c40f', '#2c9c5a'][(i + j) % 3]; ctx.fillRect(p.x - 1, p.y - 6, 2.4, 6);
      }
    });
    // o elevador e a BMW: poste do fundo, braços, carro, poste da frente
    add(kc(CARRO.xa, CARRO.ya, CARRO.xb - CARRO.xa, CARRO.yb - CARRO.ya) - .05, elevador);
    add(kc(CARRO.xa, CARRO.ya, CARRO.xb - CARRO.xa, CARRO.yb - CARRO.ya), bmw);
    // portão da garagem aberto: só a soleira e os batentes (a lona fica enrolada lá em cima)
    add(6.5 + 18 + .4, () => {
      ISO.plane(ctx, 0, 17.78, 13, .22, .5, '#80868e');
      linha([S(0, 17.9, .6), S(13, 17.9, .6)], 'rgba(0,0,0,.35)', 1);
      for (const x of [0, 12.85]) box(x, 17.85, .15, .3, PE, 0, '#2b2e35');
    });

    // ---- vidro entre a garagem e a sala (as poltronas olham para o carro)
    for (let y = 0; y < 18; y++) {
      if (y === 14 || y === 15) continue;                     // a porta
      add(13 + y + .55, () => vidroX(13, y, 1));
    }
    add(13 + 14 + 1.2, () => {                                // batente da porta
      box(12.95, 14, .1, .08, PE, 0, '#1c1e22'); box(12.95, 15.92, .1, .08, PE, 0, '#1c1e22');
      box(12.95, 14, .1, 2, 10, PE - 10, '#1c1e22');
    });

    // ---- sala
    const tapete = { t: 'rug', x: 15.3, y: 2.2, w: 7.6, d: 6.4, c: '#6f665c' };
    add(-1, peca(tapete));
    add(kc(17.6, .15, 5, .7), () => {                         // aparador sob a TV
      box(17.6, .15, 5, .7, 20, 6, '#4a3424', { top: '#5a4030' });
      for (const x of [17.8, 22.3]) box(x, .3, .1, .4, 6, 0, '#1a1a1a');
      box(18.2, .3, .6, .3, 6, 26, '#1c1e22');
    });
    add(kc(16.2, 6.4, 5.6, 1.6), peca({ t: 'sofa', x: 16.2, y: 6.4, w: 5.6, d: 1.6, dir: 's', c: '#3f434b' }));
    add(kc(17.6, 3.7, 2.8, 1.4), peca({ t: 'lowTable', x: 17.6, y: 3.7, w: 2.8, d: 1.4 }));
    add(kc(14.4, 3.3, 1.3, 1.3), peca({ t: 'poltrona', x: 14.4, y: 3.3, w: 1.3, d: 1.3, face: 'e', c: '#6d4a33' }));
    add(kc(22.6, 6.6, 1, 1), peca({ t: 'abajur', x: 22.6, y: 6.6 }));
    add(kc(13.6, .3, 1, 1), peca({ t: 'plant', x: 13.6, y: .3, k: 1 }));
    add(kc(22.9, .2, 1, 1), peca({ t: 'plant', x: 22.9, y: .2, k: 0 }));
    // ---- cozinha
    add(kc(24, .1, 1.3, 1.2), () => {                         // geladeira inox
      box(24, .1, 1.3, 1.2, 104, 0, '#a9afb7', { top: '#c3c8cf' });
      linha([S(24.65, 1.31, 100), S(24.65, 1.31, 4)], 'rgba(0,0,0,.35)', 1);
      linha([S(24.5, 1.32, 70), S(24.5, 1.32, 40)], '#e8ebee', 1.6);
      linha([S(24.8, 1.32, 70), S(24.8, 1.32, 40)], '#e8ebee', 1.6);
    });
    add(kc(25.3, .1, 4.7, 1.1), () => {                       // bancada com pia e cooktop
      box(25.3, .1, 4.7, 1.1, 34, 0, '#2d3138');
      for (let i = 0; i < 5; i++) linha([S(25.4 + i * .95, 1.21, 30), S(25.4 + i * .95, 1.21, 4)], 'rgba(255,255,255,.06)', 1);
      box(25.25, .05, 4.8, 1.2, 3, 34, '#ece9e3');
      ISO.plane(ctx, 26.2, .35, .9, .6, 37.1, '#9aa1ab');
      box(26.6, .2, .08, .08, 12, 37, '#c9ced6');
      ISO.plane(ctx, 28.3, .3, 1.1, .7, 37.1, '#121317');
      for (const [x, y] of [[28.55, .5], [29.1, .5], [28.55, .85], [29.1, .85]]) { const p = S(x, y, 37.2); ctx.strokeStyle = '#3a3f47'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 4, 2, 0, 0, 7); ctx.stroke(); }
      ISO.cyl(ctx, 27.6, .55, .12, 9, 37, '#1b1d22');                    // cafeteira
    });
    add(kc(24.6, 3.8, 4.2, 1.6), () => {                      // ilha em quartzo
      box(24.6, 3.8, 4.2, 1.6, 36, 0, '#2d3138');
      box(24.5, 3.7, 4.4, 1.8, 3, 36, '#ece9e3');
      box(24.5, 3.7, .12, 1.8, 36, 0, '#e3dfd8');
      ISO.cyl(ctx, 26, 4.5, .28, 4, 39, '#d8d2c6');                      // fruteira
      for (const [x, y, c] of [[25.95, 4.45, '#e67e22'], [26.1, 4.55, '#c0392b'], [26.02, 4.62, '#2ecc71']]) ISO.cyl(ctx, x, y, .07, 4, 43, c);
    });
    for (const x of [25.2, 26.6, 28]) add(kc(x, 5.9, .6, .6), () => {       // banquetas
      ISO.cyl(ctx, x + .3, 6.2, .2, 2, 0, '#1b1d22'); ISO.cyl(ctx, x + .3, 6.2, .04, 26, 2, '#b39a5c');
      ISO.cyl(ctx, x + .3, 6.2, .26, 5, 28, '#6d4a33');
    });
    // ---- jantar
    const mesa = { x: 23.4, y: 10.2, w: 5.2, d: 2 };
    const km = kc(mesa.x, mesa.y, mesa.w, mesa.d);
    const cadeira = (x, y, f) => add(km + (f === 'n' ? .3 : -.3) + x * .001, () => {
      box(x, y, .8, .8, 4, 18, '#6d4a33', { top: '#7d5a40' });
      for (const [a, b] of [[.05, .05], [.65, .05], [.05, .65], [.65, .65]]) box(x + a, y + b, .1, .1, 18, 0, '#2b2b2b');
      if (f === 's') box(x, y, .8, .12, 26, 22, '#5a3c28'); else box(x, y + .68, .8, .12, 26, 22, '#5a3c28');
    });
    for (const x of [23.8, 25.6, 27.4]) { cadeira(x, 9.3, 's'); cadeira(x, 12.3, 'n'); }
    add(kc(mesa.x, mesa.y, mesa.w, mesa.d), () => {
      for (const [a, b] of [[.3, .3], [mesa.w - .4, .3], [.3, mesa.d - .4], [mesa.w - .4, mesa.d - .4]]) box(mesa.x + a, mesa.y + b, .12, .12, 28, 0, '#2b2b2b');
      box(mesa.x, mesa.y, mesa.w, mesa.d, 4, 28, '#7a5638', { top: '#8a6442' });
      ISO.cyl(ctx, 26, 11.2, .16, 12, 32, '#e9e4db');                    // vaso
      for (let i = 0; i < 5; i++) linha([S(26, 11.2, 44), S(26 + Math.cos(i) * .3, 11.2 + Math.sin(i) * .3, 56)], '#3f8a4a', 1.4);
    });
    add(km + .5, () => {                                       // pendentes sobre a mesa
      for (const x of [24.6, 26, 27.4]) {
        linha([S(x, 11.2, 98), S(x, 11.2, PE + 30)], 'rgba(30,30,30,.7)', 1);
        ISO.cyl(ctx, x, 11.2, .22, 10, 88, '#1b1d22');
        ISO.cyl(ctx, x, 11.2, .05, 2, 98, '#b39a5c');
      }
    });
    // ---- canto das poltronas viradas para a garagem
    add(kc(14.6, 11.8, 1.3, 1.3), peca({ t: 'poltrona', x: 14.6, y: 11.8, w: 1.3, d: 1.3, face: 'w', c: '#6d4a33' }));
    add(kc(14.6, 9.4, 1.3, 1.3), peca({ t: 'poltrona', x: 14.6, y: 9.4, w: 1.3, d: 1.3, face: 'w', c: '#6d4a33' }));
    add(kc(14.85, 11.05, .6, .6), () => { ISO.cyl(ctx, 15.15, 11.25, .25, 3, 22, '#ece9e3'); ISO.cyl(ctx, 15.15, 11.25, .04, 22, 0, '#b39a5c'); ISO.cyl(ctx, 15.1, 11.2, .07, 7, 25, '#8b5a2b'); });
    add(kc(16.4, 13.4, 1, 1), peca({ t: 'abajur', x: 16.4, y: 13.4 }));
    add(kc(13.4, 16.6, 1, 1), peca({ t: 'plant', x: 13.4, y: 16.6, k: 1 }));
    add(kc(28.8, 16.6, 1, 1), peca({ t: 'plant', x: 28.8, y: 16.6, k: 0 }));

    // ---- fachadas de vidro da frente (y = 18, casa) e do lado (x = 30)
    for (let x = 13; x < 30; x++) {
      if (x >= 19 && x < 22) continue;                         // porta de correr aberta para o deck
      add(x + 18 + .9, () => vidroY(x, 18, 1));
    }
    for (let y = 0; y < 18; y++) add(30 + y + .9, () => vidroX(30, y, 1, true));
    // ---- área externa
    for (const y of [20.1, 21.9]) add(kc(27.4, y, 2.2, .9), () => {           // espreguiçadeiras
      box(27.4, y, 2.2, .9, 3, 8, '#f2efe8');
      box(27.4, y, .55, .9, 12, 11, '#f2efe8');
      for (const x of [27.5, 29.4]) box(x, y + .1, .08, .7, 8, 0, '#8a6142');
    });
    add(kc(29, 23.4, 1, 1), peca({ t: 'plant', x: 29, y: 23.4, k: 1 }));
    add(kc(13.6, 23.6, 1, 1), peca({ t: 'plant', x: 13.6, y: 23.6, k: 0 }));
    add(kc(12.2, 19.6, .8, .8), () => {                        // luminária de jardim e número da casa
      box(12.3, 19.7, .4, .4, 40, 0, '#2b2e35');
      const p = S(12.5, 20.1, 30); ctx.fillStyle = '#e8eaee'; ctx.font = "700 9px 'Barlow', sans-serif"; ctx.textAlign = 'center'; ctx.fillText('32', p.x, p.y);
    });
    itens.sort((a, b) => a.k - b.k);

    // o que bloqueia o caminho do Gabriel
    bloqueia(1, 0, 6, 1.3); bloqueia(7.6, 0, 2.4, 1.3); bloqueia(10.7, 0, 1, 1.2);
    bloqueia(0, 3, 1.1, 5); bloqueia(0, 10, 1.1, 3.6); bloqueia(11.3, 2.6, 1.2, 1.2);
    bloqueia(CARRO.xa - .6, CARRO.ya - .1, CARRO.xb - CARRO.xa + 1.2, CARRO.yb - CARRO.ya + .2);
    bloqueia(2.3, 10.9, .6, .5);
    bloqueia(9.5, 14, 1.4, .6);
    for (let y = 0; y < 18; y++) if (y !== 14 && y !== 15) bloqueia(12, y, 1, 1);
    for (let x = 13; x < 30; x++) if (x < 19 || x >= 22) bloqueia(x, 17, 1, 1);
    bloqueia(16.2, 6.4, 5.6, 1.6); bloqueia(17.6, 3.7, 2.8, 1.4); bloqueia(14.4, 3.3, 1.3, 1.3);
    bloqueia(24, 0, 6, 1.3); bloqueia(24.5, 3.7, 4.4, 1.8); bloqueia(mesa.x - .1, mesa.y - .9, mesa.w + .2, mesa.d + 1.8);
    bloqueia(14.6, 9.4, 1.3, 3.7); bloqueia(15.4, 19.9, 11.4, 3.8); bloqueia(27.4, 20, 2.2, 2.8);
  }

  /* ---- painel de vidro (plano x = X ou y = Y) ---- */
  function vidroX(X, y, len, fachada) {
    const q = [S(X, y, PE), S(X, y + len, PE), S(X, y + len, 0), S(X, y, 0)];
    poli(q, fachada ? 'rgba(190,215,240,.06)' : 'rgba(190,215,240,.10)');
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    poli([S(X, y + .2, PE - 10), S(X, y + .35, PE - 10), S(X, y + .65, 10), S(X, y + .5, 10)], 'rgba(255,255,255,.035)');
    ctx.restore();
    linha([S(X, y, 0), S(X, y, PE)], '#1c1e22', 1.4);
    linha([S(X, y, PE), S(X, y + len, PE)], '#1c1e22', 2);
    linha([S(X, y, 1), S(X, y + len, 1)], '#1c1e22', 2);
  }
  function vidroY(x, Y, len) {
    const q = [S(x, Y, PE), S(x + len, Y, PE), S(x + len, Y, 0), S(x, Y, 0)];
    poli(q, 'rgba(190,215,240,.06)');
    linha([S(x, Y, 0), S(x, Y, PE)], '#1c1e22', 1.4);
    linha([S(x, Y, PE), S(x + len, Y, PE)], '#1c1e22', 2);
    linha([S(x, Y, 1), S(x + len, Y, 1)], '#1c1e22', 2);
  }

  /* ===========================================================
     O Gabriel em casa: anda sozinho entre os cantos
     =========================================================== */
  const CANTOS = [
    { x: CARRO.cx + E90.tiles.eixoD, y: CARRO.yb + .75, f: 'n', txt: 'mexendo na BMW', ic: '🔧' },
    { x: 8.9, y: 2.1, f: 'n', txt: 'pegando uma ferramenta', ic: '🧰' },
    { x: 3.8, y: 2.1, f: 'n', txt: 'na bancada', ic: '🛠️' },
    { x: CARRO.xb + 2.6, y: CARRO.cy + .3, f: 'w', txt: 'admirando a BMW', ic: '😎' },
    { x: 23.8, y: 4.6, f: 'e', txt: 'tomando um café', ic: '☕' },
    { x: 19.0, y: 9.0, f: 'n', txt: 'vendo o jogo do Palmeiras', ic: '📺' },
    { x: 21.0, y: 18.7, f: 's', txt: 'na beira da piscina', ic: '🏊' },
    { x: 16.4, y: 11.0, f: 'w', txt: 'olhando a garagem', ic: '🏎️' }
  ];
  const G = { x: 5, y: 14.6, f: 'n', path: [], canto: 3, espera: 4, fase: 0, movendo: false, blink: false, blinkT: 3, txt: 'chegando em casa', ic: '🏠' };

  function irPara(i) {
    const c = CANTOS[i];
    const de = { x: Math.floor(G.x), y: Math.floor(G.y) }, ate = { x: Math.floor(c.x), y: Math.floor(c.y) };
    const r = PATH.find(pisavel, W, H, de, ate) || [];
    G.path = r.map(n => ({ x: n.x + .5, y: n.y + .5 }));
    G.path.push({ x: c.x, y: c.y });
    G.canto = i; G.txt = 'andando pela casa'; G.ic = '🚶';
  }
  function atualizaGabriel(dt) {
    G.blinkT -= dt;
    if (G.blinkT <= 0) { G.blink = !G.blink; G.blinkT = G.blink ? .12 : 2.5 + Math.random() * 4; }
    G.movendo = G.path.length > 0;
    if (G.movendo) {
      let passo = 2.3 * dt;
      while (passo > 0 && G.path.length) {
        const n = G.path[0], dx = n.x - G.x, dy = n.y - G.y, d = Math.hypot(dx, dy);
        if (Math.abs(dx) > Math.abs(dy) * 1.05) G.f = dx > 0 ? 'e' : 'w'; else if (d > .01) G.f = dy > 0 ? 's' : 'n';
        if (d <= passo) { G.x = n.x; G.y = n.y; G.path.shift(); passo -= d; }
        else { G.x += dx / d * passo; G.y += dy / d * passo; passo = 0; }
      }
      if (!G.path.length) {
        const c = CANTOS[G.canto];
        G.f = c.f; G.txt = c.txt; G.ic = c.ic; G.espera = 9 + Math.random() * 10;
      }
    } else {
      G.espera -= dt;
      if (G.espera <= 0) {
        let i; do { i = Math.floor(Math.random() * CANTOS.length); } while (i === G.canto);
        irPara(i);
      }
    }
    G.fase += dt * (G.movendo ? 3.1 : 1);
  }
  function desenhaGabriel() {
    const p = S(G.x, G.y, 0);
    AVATAR.draw(ctx, opts.look, p.x, p.y, G.f, { moving: G.movendo, phase: G.fase, blink: G.blink, scale: AVATAR.SCALE });
  }
  function etiquetaGabriel() {
    const p = S(G.x, G.y, 0);
    let y = p.y - AVATAR.headTop(false) * AVATAR.SCALE - 8;
    y -= AVATAR.nameTag(ctx, p.x, y, opts.nome || 'Gabriel', '#c4b8ff', 'EM CASA') + 4;
    if (!G.movendo) AVATAR.bubble(ctx, p.x, y, G.ic, G.txt, '#c4b8ff');
  }

  /* ===========================================================
     Quadro
     =========================================================== */
  function quadro(agora) {
    if (!aberta) { raf = 0; return; }
    const dt = Math.min(.05, (agora - (T0 || agora)) / 1000); T0 = agora; t += dt;
    // a roda do mouse aproxima no ponto do cursor: ele fica parado na tela
    const ax = ancora ? ancora.x - cw / 2 : 0, ay = ancora ? ancora.y - ch / 2 : 0;
    const wx = ax / cam.z - cam.x, wy = ay / cam.z - cam.y;
    cam.z += (cam.tz - cam.z) * Math.min(1, dt * 9);
    if (ancora) { cam.x = ax / cam.z - wx; cam.y = ay / cam.z - wy; if (Math.abs(cam.tz - cam.z) < 1e-3) ancora = null; }
    lift += Math.sign(liftAlvo - lift) * Math.min(Math.abs(liftAlvo - lift), dt * 16);
    atualizaGabriel(dt);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    NASSA.fundo(ctx, cw, ch);
    ctx.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, dpr * (cw / 2 + cam.x * cam.z), dpr * (ch / 2 + cam.y * cam.z));

    piso();
    paredes();
    // móveis e o Gabriel, de trás para a frente
    const kg = G.x + G.y + .5;
    let foi = false;
    for (const it of itens) {
      if (!foi && it.k > kg) { desenhaGabriel(); foi = true; }
      it.fn(ctx, t);
    }
    if (!foi) desenhaGabriel();

    // noite: escurece o ambiente e acende as luzes
    const n = NASSA.noite();
    if (n > .05) {
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = `rgba(6,10,24,${(.42 * n).toFixed(3)})`; ctx.fillRect(0, 0, cw, ch);
      ctx.restore();
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const luz = (x, y, z, r, c, a) => { const p = S(x, y, z); ISO.glow(ctx, p.x, p.y, r, c, a * n); };
      for (const [x, y] of [[3, 3], [9, 3], [3, 15], [9, 15], [6, 9]]) luz(x, y, 0, 220, '#dfe9ff', .16);
      luz(19, 4, 0, 230, '#ffd9a0', .16); luz(22.6, 6.6, 84, 90, '#ffd9a0', .35);
      luz(16.4, 13.4, 84, 90, '#ffd9a0', .3); luz(26.6, 4.6, 0, 160, '#ffe2b0', .14);
      for (const x of [24.6, 26, 27.4]) luz(x, 11.2, 86, 60, '#ffd9a0', .4);
      luz(26, 11.2, 30, 170, '#ffd9a0', .14);
      luz(21, 21.8, -2, 260, '#38d6ff', .22);                          // luz da piscina
      luz(19.5, .4, 60, 140, '#7fd06a', .10);                          // a TV acesa
      ctx.restore();
    }
    etiquetaGabriel();
    pintaCabecalho();
    raf = requestAnimationFrame(quadro);
  }

  let cabTxt = '';
  function pintaCabecalho() {
    const h = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const s = `${opts.nome || 'Gabriel'} está ${G.movendo ? 'andando pela casa' : G.txt} · ${h}`;
    if (s !== cabTxt) { cabTxt = s; el.querySelector('#casa-sub').textContent = s; }
    const b = el.querySelector('#casa-elev');
    const txt = liftAlvo > 0 ? '⬇ Descer a BMW' : '⬆ Subir a BMW';
    if (b.textContent !== txt) b.textContent = txt;
  }

  /* ---------------- câmera e toque ---------------- */
  const BOUNDS = (() => {
    const pts = [S(0, 0, PE + 10), S(W, 0, PE), S(0, H, 0), S(W, H, -22), S(0, 0, 0)];
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  })();
  const zMin = () => Math.min(.12, fitZ() * .8), zMax = () => Math.min(cw, ch) < 600 ? 2.2 : 2.8;
  const fitZ = () => Math.min(cw / (BOUNDS.x1 - BOUNDS.x0), ch / (BOUNDS.y1 - BOUNDS.y0)) * .94;
  function enquadrar() {
    ancora = null;
    const z = fitZ();
    if (z >= .3) { cam.z = cam.tz = z; cam.x = -(BOUNDS.x0 + BOUNDS.x1) / 2; cam.y = -(BOUNDS.y0 + BOUNDS.y1) / 2; return; }
    // celular em pé: a casa inteira ficaria miúda; abre na garagem, com a BMW
    const p = S(6.5, 9.5, 40);
    cam.z = cam.tz = Math.max(.4, Math.min(.8, cw / 680)); cam.x = -p.x; cam.y = -p.y;
  }
  function resize() {
    const r = cv.getBoundingClientRect();
    cw = r.width; ch = r.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2.5, Math.sqrt(8.3e6 / Math.max(1, cw * ch)));
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
  }
  const dedos = new Map(); let arrasto = null, pinca = null, ancora = null;
  function ligarToque() {
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId);
      ancora = null;
      dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (dedos.size === 1) arrasto = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, andou: false };
      if (dedos.size === 2) {
        const [a, b] = [...dedos.values()];
        pinca = { d: Math.hypot(a.x - b.x, a.y - b.y), z: cam.tz, cx: cam.x, cy: cam.y, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
        arrasto = null;
      }
    });
    cv.addEventListener('pointermove', e => {
      if (!dedos.has(e.pointerId)) return;
      dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinca && dedos.size >= 2) {
        const [a, b] = [...dedos.values()];
        const z = Math.max(zMin(), Math.min(zMax(), pinca.z * Math.hypot(a.x - b.x, a.y - b.y) / pinca.d));
        const r = cv.getBoundingClientRect();
        const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
        // o ponto entre os dedos fica parado
        const wx = (pinca.mx - r.left - cw / 2) / pinca.z - pinca.cx, wy = (pinca.my - r.top - ch / 2) / pinca.z - pinca.cy;
        cam.z = cam.tz = z; cam.x = (mx - cw / 2) / z - wx; cam.y = (my - ch / 2) / z - wy;
      } else if (arrasto) {
        const dx = e.clientX - arrasto.x, dy = e.clientY - arrasto.y;
        if (Math.abs(dx) + Math.abs(dy) > 6) arrasto.andou = true;
        cam.x = arrasto.cx + dx / cam.z; cam.y = arrasto.cy + dy / cam.z;
      }
    });
    const solta = e => {
      if (arrasto && !arrasto.andou && dedos.size === 1) tocou(e);
      dedos.delete(e.pointerId);
      if (dedos.size < 2) pinca = null;
      if (!dedos.size) arrasto = null;
    };
    cv.addEventListener('pointerup', solta);
    cv.addEventListener('pointercancel', solta);
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      ancora = { x: e.clientX - r.left, y: e.clientY - r.top };
      cam.tz = Math.max(zMin(), Math.min(zMax(), cam.tz * (e.deltaY < 0 ? 1.13 : .885)));
    }, { passive: false });
    ['touchstart', 'touchmove', 'touchend'].forEach(tp => cv.addEventListener(tp, e => { if (e.cancelable) e.preventDefault(); }, { passive: false }));
  }
  function tocou(e) {
    const r = cv.getBoundingClientRect();
    const wx = (e.clientX - r.left - cw / 2) / cam.z - cam.x, wy = (e.clientY - r.top - ch / 2) / cam.z - cam.y;
    const c = caixaCarro;
    if (c && wx > c.x0 && wx < c.x1 && wy > c.y0 && wy < c.y1) {
      if (window.__escritorio && __escritorio.abrirBmw) __escritorio.abrirBmw();
      return;
    }
    const g = S(G.x, G.y, 0);
    if (Math.abs(wx - g.x) < 22 && wy < g.y + 8 && wy > g.y - 90) aviso(`${opts.nome || 'Gabriel'} está ${G.txt}.`);
  }
  let tAviso = 0;
  function aviso(txt) {
    const a = el.querySelector('#casa-aviso');
    a.textContent = txt; a.classList.add('on');
    clearTimeout(tAviso); tAviso = setTimeout(() => a.classList.remove('on'), 2800);
  }

  /* ---------------- abrir e fechar ---------------- */
  function criar() {
    el = document.createElement('div');
    el.id = 'casa'; el.className = 'hidden';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Casa do Gabriel');
    el.innerHTML = `
      <header class="casa-top">
        <div><h2>🏠 CASA DO GABRIEL</h2><div class="casa-sub" id="casa-sub"></div></div>
        <div class="casa-acoes">
          <button class="btn" id="casa-elev">⬆ Subir a BMW</button>
          <button class="btn primary" id="casa-voltar">🏢 Voltar ao escritório</button>
          <button class="btn ghost" id="casa-x" aria-label="Fechar">✕</button>
        </div>
      </header>
      <canvas id="casa-cv"></canvas>
      <div class="casa-zoom">
        <button class="zbtn" id="casa-zi" aria-label="Aproximar">+</button>
        <button class="zbtn" id="casa-zo" aria-label="Afastar">−</button>
        <button class="zbtn" id="casa-zf" aria-label="Ver a casa inteira">⛶</button>
      </div>
      <div class="casa-aviso" id="casa-aviso" role="status"></div>`;
    document.body.appendChild(el);
    cv = el.querySelector('#casa-cv'); ctx = cv.getContext('2d');
    el.querySelector('#casa-x').addEventListener('click', fechar);
    el.querySelector('#casa-voltar').addEventListener('click', () => { const f = opts.aoVoltar; fechar(); if (f) f(); });
    el.querySelector('#casa-elev').addEventListener('click', () => {
      liftAlvo = liftAlvo > 0 ? 0 : 46;
      aviso(liftAlvo ? 'Subindo a BMW no elevador…' : 'Descendo a BMW…');
    });
    el.querySelector('#casa-zi').addEventListener('click', () => { ancora = null; cam.tz = Math.min(zMax(), cam.tz * 1.2); });
    el.querySelector('#casa-zo').addEventListener('click', () => { ancora = null; cam.tz = Math.max(zMin(), cam.tz / 1.2); });
    el.querySelector('#casa-zf').addEventListener('click', () => {
      ancora = null;
      const z = fitZ(); cam.tz = Math.max(zMin(), z); cam.x = -(BOUNDS.x0 + BOUNDS.x1) / 2; cam.y = -(BOUNDS.y0 + BOUNDS.y1) / 2;
    });
    ligarToque();
    window.addEventListener('resize', () => { if (aberta) resize(); });
    // com a casa aberta, o teclado é dela: Esc fecha e os atalhos do andar não disparam
    window.addEventListener('keydown', e => {
      if (!aberta) return;
      // o quadro da BMW aberto por cima da casa fecha primeiro, pelo próprio Esc dele
      if (document.querySelector('#modal:not(.hidden)')) return;
      if (e.key === 'Escape') fechar();
      e.stopPropagation();
    }, true);
  }

  /**
   * @param o { look, nome, chegando, aoVoltar }
   */
  function abrir(o = {}) {
    if (!el) criar();
    opts = o; montar();
    el.classList.remove('hidden'); aberta = true;
    resize(); enquadrar();
    if (o.chegando) {
      // chega pela entrada da garagem e vai olhar o carro
      G.x = 6.5; G.y = 24.3; G.path = []; irPara(3);
      G.txt = 'chegando em casa'; G.ic = '🏠';
      aviso(`${o.nome || 'Gabriel'} chegou em casa.`);
    }
    T0 = 0;
    if (!raf) raf = requestAnimationFrame(quadro);
  }
  function fechar() {
    aberta = false;
    if (el) el.classList.add('hidden');
  }

  return { abrir, fechar, aberta: () => aberta, cam };
})();
