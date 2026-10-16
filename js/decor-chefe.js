/* ===========================================================
   decor-chefe.js — a decoração da sala do chefe

   Usa a extensão do furniture.js: FURN.registrar({ tipo(ctx, o, t) {…} })
   para um desenho novo e FURN.add({ t: 'tipo', x, y, … }) + FURN.block()
   para pôr a peça no andar. Carrega depois do furniture.js e antes do
   app.js, que monta a lista de desenho.

   A sala: a camisa do Palmeiras (placa 'palmeiras' do world.js) em cima
   de um aparador de nogueira; a bola de basquete numa caixa de acrílico,
   num pedestal junto da janela; a estante com livros, troféu e o
   cantinho do café do outro lado do quadro da BMW; tapetes de lã; o
   estar com sofá de couro e mesa de centro de mármore; uma oliveira.
   Tudo parado vai para cache: só a plaquinha da mesa e a luz da
   luminária são desenhadas ao vivo.
   =========================================================== */
(() => {
  const S = ISO.toScreen;
  const TOP = FURN.TOP;
  const K = 1.78;          // estica u na frente das peças: lá ele encolhe para ~0,56 na tela
  const NOG = '#5b3a23', NOG_TOPO = '#73492b', LATAO = '#c2a35e';

  /* ---------- peças largas encostadas na parede ----------
     Com uma profundidade só, uma peça de quase 4 tiles entraria antes das
     paredes de trás da ponta direita (que pintariam por cima dela) ou
     depois de quem passa na frente. Como no naParede do furniture.js, ela
     vira tiras de 1 tile, cada uma com a sua chave. O desenho inteiro é
     feito uma vez num canvas (2x) e cada tira copia só a sua faixa
     vertical, com as bordas no pixel inteiro da tela: não sobra costura
     entre as tiras e o custo por quadro é um drawImage por tira.        */
  const ESC = 2;
  const PINTA = {}, VERSAO = {};
  const cachePeca = new Map();

  function cacheDaPeca(o) {
    const ver = VERSAO[o.t] ? VERSAO[o.t]() : 0;
    let c = cachePeca.get(o.peca);
    if (c && c.ver === ver) return c;
    const x0 = S(o.x, o.y + o.d).x - 26, x1 = S(o.x + o.w, o.y).x + 26;
    const y0 = S(o.x, o.y).y - o.alto, y1 = S(o.x + o.w, o.y + o.d).y + 20;
    const cv = c ? c.cv : document.createElement('canvas');
    cv.width = Math.ceil((x1 - x0) * ESC); cv.height = Math.ceil((y1 - y0) * ESC);
    const g = cv.getContext('2d');
    g.setTransform(ESC, 0, 0, ESC, -x0 * ESC, -y0 * ESC);
    PINTA[o.t](g, o);
    c = { cv, x: x0, y: y0, w: cv.width / ESC, h: cv.height / ESC, ver };
    cachePeca.set(o.peca, c);
    return c;
  }

  function tira(ctx, o) {
    const c = cacheDaPeca(o);
    const m = ctx.getTransform();
    const px = v => (Math.round(v * m.a + m.e) - m.e) / m.a;      // borda no pixel da tela
    const yc = o.y + o.d / 2;
    const L = o.fatia[0] <= o.x + 1e-6 ? c.x : Math.max(c.x, px(S(o.fatia[0], yc).x));
    const R = o.fatia[1] >= o.x + o.w - 1e-6 ? c.x + c.w : Math.min(c.x + c.w, px(S(o.fatia[1], yc).x));
    if (R - L <= 0) return;
    ctx.drawImage(c.cv, (L - c.x) * ESC, 0, (R - L) * ESC, c.cv.height, L, c.y, R - L, c.h);
  }

  function encostar(o) {
    const peca = {};                       // chave do cache, comum a todas as tiras
    const n = Math.ceil(o.w - 1e-6);
    for (let i = 0; i < n; i++)
      FURN.add(Object.assign({}, o, { peca, fatia: [o.x + i, Math.min(o.x + i + 1, o.x + o.w)],
                                      dk: o.x + i + o.y + .7 }));
    FURN.block(o.x, o.y, o.w, o.d);
  }

  /* ---------- miudezas de prateleira, desenhadas na frente das peças ----------
     nat() abre um espaço com a proporção natural, com (0,0) no pé do objeto */
  function nat(g, u, base, fn) {
    g.save(); g.translate(u, base); g.scale(K, 1); fn(g); g.restore();
  }

  const CAPAS = ['#e8e1d0', '#2a3a52', '#c9b48c', '#2b2d31', '#41594a', '#f1eee7',
                 '#8c4b32', '#1c2733', '#a07c4c', '#5a6b7a', '#3a2a22', '#b9a27a'];

  /** fileira de livros em pé, de u0 a u1, com o pé em "base" */
  function livros(g, u0, u1, base, alt, seed) {
    let u = u0, i = seed * 5;
    while (u < u1 - 2.5) {
      const bw = Math.min(u1 - u, 3.6 + (i * 7 % 5) * .5);
      const bh = alt * (.72 + (i * 13 % 7) * .045);
      g.fillStyle = CAPAS[(i * 5 + seed) % CAPAS.length]; g.fillRect(u, base - bh, bw - .5, bh);
      g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(u, base - bh, .6, bh);
      g.fillStyle = 'rgba(0,0,0,.24)'; g.fillRect(u + bw - 1.1, base - bh, .6, bh);
      if (i % 3 === 0) { g.fillStyle = 'rgba(214,186,120,.8)'; g.fillRect(u + .7, base - bh + 2.4, bw - 1.9, .6); }
      u += bw; i++;
    }
  }

  /** pilha de livros deitados; devolve o v do topo */
  function pilha(g, u, base, larg, n, seed) {
    let v = base;
    for (let k = 0; k < n; k++) {
      const h = 2.8 + ((k + seed) % 2) * .9, lw = larg - (k * 5 + seed * 3) % 9;
      const u0 = u + (larg - lw) / 2;
      g.fillStyle = CAPAS[(k * 3 + seed * 2) % CAPAS.length]; g.fillRect(u0, v - h, lw, h);
      g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(u0, v - h, lw, .5);
      g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(u0 + lw - 1.4, v - h, 1.4, h);
      v -= h;
    }
    return v;
  }

  function esfera(g, r, cor1, cor2) {
    const gr = g.createRadialGradient(-r * .35, -r * 1.35, r * .1, 0, -r, r);
    gr.addColorStop(0, cor1); gr.addColorStop(1, cor2);
    g.fillStyle = gr; g.beginPath(); g.arc(0, -r, r, 0, 7); g.fill();
  }

  function trofeu(g) {
    g.fillStyle = '#231c18'; g.fillRect(-3.8, -3, 7.6, 3);
    g.fillStyle = '#b8913e'; g.fillRect(-.8, -6.6, 1.6, 3.6); g.fillRect(-2.4, -7.4, 4.8, 1);
    const gg = g.createLinearGradient(-5, 0, 5, 0);
    gg.addColorStop(0, '#9c7a32'); gg.addColorStop(.4, '#f2d98f'); gg.addColorStop(1, '#86662a');
    g.fillStyle = gg;
    g.beginPath(); g.moveTo(-4.7, -17); g.lineTo(4.7, -17);
    g.quadraticCurveTo(4.5, -8.8, 0, -7.4); g.quadraticCurveTo(-4.5, -8.8, -4.7, -17); g.fill();
    g.strokeStyle = '#c9a54e'; g.lineWidth = .8;
    g.beginPath(); g.arc(-4.9, -13.6, 2, Math.PI * .5, Math.PI * 1.5); g.stroke();
    g.beginPath(); g.arc(4.9, -13.6, 2, -Math.PI * .5, Math.PI * .5); g.stroke();
    g.fillStyle = 'rgba(255,248,220,.5)'; g.fillRect(-2.6, -16.4, .9, 6);
  }

  function cristal(g) {
    g.fillStyle = '#17181b'; g.fillRect(-3.6, -2.2, 7.2, 2.2);
    g.fillStyle = 'rgba(190,225,255,.32)';
    g.beginPath(); g.moveTo(-2.6, -2.2); g.lineTo(2.6, -2.2); g.lineTo(1.7, -17); g.lineTo(0, -19.6); g.lineTo(-1.7, -17); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(230,246,255,.65)'; g.lineWidth = .45; g.stroke();
    g.fillStyle = 'rgba(0,179,255,.45)'; g.fillRect(-.35, -15, .7, 11);
  }

  function vaso(g, cor, alto, galhos) {
    const gr = g.createLinearGradient(-5, 0, 5, 0);
    gr.addColorStop(0, ISO.shade(cor, -.25)); gr.addColorStop(.45, ISO.shade(cor, .1)); gr.addColorStop(1, ISO.shade(cor, -.35));
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(-2.4, 0);
    g.bezierCurveTo(-6, -alto * .3, -4.6, -alto * .75, -1.6, -alto);
    g.lineTo(1.6, -alto);
    g.bezierCurveTo(4.6, -alto * .75, 6, -alto * .3, 2.4, 0); g.closePath(); g.fill();
    if (!galhos) return;
    g.strokeStyle = '#6b5236'; g.lineWidth = .45;
    g.beginPath();
    g.moveTo(-.4, -alto); g.quadraticCurveTo(-3, -alto - 4, -5.5, -alto - 7.5);
    g.moveTo(.3, -alto);  g.quadraticCurveTo(1.5, -alto - 5, 4.6, -alto - 8.5);
    g.moveTo(0, -alto);   g.lineTo(-.6, -alto - 9);
    g.stroke();
  }

  function plantinha(g) {
    g.fillStyle = '#d9d3c7'; g.fillRect(-3.4, -5.6, 6.8, 5.6);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(1.6, -5.6, 1.8, 5.6);
    const folhas = [[-3, -7, '#5f7f4c'], [0, -8.6, '#6f9159'], [3, -7.2, '#557544'], [-5, -4.4, '#6f9159'],
                    [5.2, -3.6, '#5f7f4c'], [6, -.6, '#557544'], [-5.8, -1.2, '#5f7f4c'], [1.4, -6.4, '#86a56c']];
    for (const [fx, fy, cor] of folhas) { g.fillStyle = cor; g.beginPath(); g.ellipse(fx, fy, 2.2, 1.3, fx * .1, 0, 7); g.fill(); }
  }

  function cafeteira(g) {
    g.fillStyle = '#25272c'; g.fillRect(-6.5, -14.5, 13, 14.5);
    g.fillStyle = '#c3c9d0'; g.fillRect(-6.5, -14.5, 13, 2.2);
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(-6.5, -12.3, 1.2, 11);
    g.fillStyle = '#9aa1aa'; g.fillRect(-5.5, -1.3, 11, 1.3);
    g.fillStyle = '#c9ced5'; g.fillRect(-2.4, -10, 4.8, 1.8);
    g.fillStyle = '#15161a'; g.fillRect(-.6, -8.2, 1.2, 1.6);
    g.fillStyle = '#f2efe8'; g.fillRect(-1.5, -3.6, 3, 2.3);
    g.fillStyle = '#00b3ff'; g.fillRect(3.5, -11.6, 1.3, .8);
  }

  function xicara(g) {
    g.fillStyle = '#e4e0d8'; g.fillRect(-2.6, -.7, 5.2, .7);
    g.fillStyle = '#f5f3ee'; g.fillRect(-1.6, -3.4, 3.2, 2.7);
    g.strokeStyle = '#f5f3ee'; g.lineWidth = .6; g.beginPath(); g.arc(1.9, -2.1, .9, -1.4, 1.4); g.stroke();
  }

  function escultura(g) {
    g.fillStyle = '#1b1b1e'; g.fillRect(-3, -1.6, 6, 1.6);
    g.strokeStyle = '#9a7642'; g.lineWidth = 1.5;
    g.beginPath(); g.ellipse(0, -7.2, 3, 5.2, .5, 0, 7); g.stroke();
    g.strokeStyle = 'rgba(255,230,180,.45)'; g.lineWidth = .5;
    g.beginPath(); g.ellipse(-.3, -7.6, 3, 5.2, .5, 3.6, 5.2); g.stroke();
  }

  function retratoBmw(g) {
    g.fillStyle = '#16171a'; g.fillRect(-12.4, -13.8, 24.8, 13.8);
    g.fillStyle = '#eceae4'; g.fillRect(-11.4, -12.8, 22.8, 11.8);
    if (BMW.pronto) BMW.miniatura(g, -10, -2.6, 20);
  }

  /** bola de basquete: esfera laranja sombreada, com as costuras pretas */
  function bola(c, px, py, r) {
    const g = c.createRadialGradient(px - r * .38, py - r * .42, r * .06, px, py, r * 1.02);
    g.addColorStop(0, '#f7a768'); g.addColorStop(.42, '#df6c2b');
    g.addColorStop(.82, '#a9461b'); g.addColorStop(1, '#6a280d');
    c.fillStyle = g; c.beginPath(); c.arc(px, py, r, 0, 7); c.fill();
    c.save();
    c.beginPath(); c.arc(px, py, r, 0, 7); c.clip();
    // gomos: textura de couro granulado
    c.fillStyle = 'rgba(60,20,4,.14)';
    for (let i = 0; i < 46; i++) {
      const a = i * 2.39996, q = Math.sqrt((i + .5) / 46) * r * .95;
      c.fillRect(px + Math.cos(a) * q, py + Math.sin(a) * q, .45, .45);
    }
    c.strokeStyle = '#1a0f0a'; c.lineWidth = Math.max(.45, r * .075);
    // dois círculos máximos vistos de lado e as duas costuras curvas
    c.beginPath(); c.ellipse(px, py, r, r * .3, -.35, 0, 7); c.stroke();
    c.beginPath(); c.ellipse(px, py, r * .28, r, -.35, 0, 7); c.stroke();
    c.beginPath(); c.ellipse(px - r * 1.02, py - r * .36, r * .66, r * 1.06, -.35, -1.25, 1.25); c.stroke();
    c.beginPath(); c.ellipse(px + r * 1.02, py + r * .36, r * .66, r * 1.06, -.35, Math.PI - 1.25, Math.PI + 1.25); c.stroke();
    c.restore();
    c.strokeStyle = 'rgba(40,14,4,.5)'; c.lineWidth = .6;
    c.beginPath(); c.arc(px, py, r - .3, 0, 7); c.stroke();
    c.fillStyle = 'rgba(255,238,215,.38)';
    c.beginPath(); c.ellipse(px - r * .42, py - r * .46, r * .3, r * .16, -.6, 0, 7); c.fill();
  }

  /** caixa de acrílico: 'tras' são as arestas vistas através dele, 'frente' as faces e arestas da frente */
  function acrilico(c, x, y, w, d, z, h, fase) {
    const linha = (pts, cor, lw) => {
      c.strokeStyle = cor; c.lineWidth = lw; c.beginPath();
      pts.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.stroke();
    };
    if (fase === 'tras') {
      linha([S(x, y + d, z), S(x, y, z), S(x + w, y, z)], 'rgba(220,236,255,.22)', .55);
      linha([S(x, y, z), S(x, y, z + h)], 'rgba(220,236,255,.22)', .55);
      return;
    }
    ISO.quad(c, [S(x, y + d, z + h), S(x + w, y + d, z + h), S(x + w, y + d, z), S(x, y + d, z)], 'rgba(214,230,248,.07)');
    ISO.quad(c, [S(x + w, y, z + h), S(x + w, y + d, z + h), S(x + w, y + d, z), S(x + w, y, z)], 'rgba(190,210,236,.11)');
    ISO.quad(c, [S(x, y, z + h), S(x + w, y, z + h), S(x + w, y + d, z + h), S(x, y + d, z + h)], 'rgba(232,242,255,.13)');
    const e = 'rgba(236,246,255,.6)';
    linha([S(x, y, z + h), S(x + w, y, z + h), S(x + w, y + d, z + h), S(x, y + d, z + h), S(x, y, z + h)], e, .6);
    linha([S(x, y + d, z + h), S(x, y + d, z)], e, .6);
    linha([S(x + w, y + d, z + h), S(x + w, y + d, z)], 'rgba(236,246,255,.75)', .7);
    linha([S(x + w, y, z + h), S(x + w, y, z)], e, .6);
    linha([S(x, y + d, z), S(x + w, y + d, z), S(x + w, y, z)], 'rgba(236,246,255,.4)', .5);
    // reflexo na face da frente
    ISO.quad(c, [S(x + w * .18, y + d, z + h), S(x + w * .34, y + d, z + h),
                 S(x + w * .12, y + d, z), S(x, y + d, z)], 'rgba(255,255,255,.07)');
  }

  /** a bola na caixa de acrílico, com a base de nogueira e a plaqueta, apoiada em z0 */
  function vitrineBola(c, bx, by, bw, bd, z0) {
    ISO.box(c, bx, by, bw, bd, 4, z0, '#3d2616', { top: '#4f331f', left: '#3a2415', right: '#2b1a10' });
    ISO.quad(c, [S(bx + .14, by + bd, z0 + 3), S(bx + bw - .14, by + bd, z0 + 3),
                 S(bx + bw - .14, by + bd, z0 + 1.4), S(bx + .14, by + bd, z0 + 1.4)], LATAO);
    const zc = z0 + 4;
    acrilico(c, bx + .03, by + .03, bw - .06, bd - .06, zc, 24, 'tras');
    const cb = S(bx + bw / 2, by + bd / 2, zc);
    c.fillStyle = 'rgba(0,0,0,.38)'; c.beginPath(); c.ellipse(cb.x, cb.y, 6.4, 3, 0, 0, 7); c.fill();
    c.strokeStyle = 'rgba(220,236,255,.55)'; c.lineWidth = .6;
    c.beginPath(); c.ellipse(cb.x, cb.y - .8, 3.6, 1.6, 0, 0, 7); c.stroke();
    bola(c, cb.x, cb.y - 10.6, 9.6);
    acrilico(c, bx + .03, by + .03, bw - .06, bd - .06, zc, 24, 'frente');
  }

  /* ================= APARADOR =================
     Nogueira, frente ripada como a parede, pés de metal e puxadores de
     latão. Em cima, só peças baixas: livros de arte com uma esfera de
     latão numa ponta e uma fruteira de cerâmica na outra. O tampo fica
     baixo (26 px) para não tapar a plaqueta da camisa logo acima.      */
  PINTA.aparadorChefe = (c, o) => {
    const { x, y, w, d } = o;
    ISO.plane(c, x - .02, y + .06, w + .1, d + .1, .3, 'rgba(0,0,0,.3)');
    for (const [px, py] of [[.14, .1], [w - .2, .1], [.14, d - .16], [w - .2, d - .16]])
      ISO.box(c, x + px, y + py, .06, .06, 5, 0, '#141416');
    ISO.box(c, x, y, w, d, 19, 5, NOG, { top: NOG_TOPO, left: '#4e321e', right: '#3a2517' });
    FURN.faceY(c, x, y + d, w, 24, (g, len) => {
      const portas = 4, pw = len / portas;
      for (let i = 0; i < portas; i++) {
        const u0 = i * pw;
        for (let u = u0 + 2.2; u < u0 + pw - 1.6; u += 3.2) {
          g.fillStyle = 'rgba(255,225,190,.07)'; g.fillRect(u, 1.2, .9, 17);
          g.fillStyle = 'rgba(20,10,4,.3)'; g.fillRect(u + 1.9, 1.2, .9, 17);
        }
        if (i) { g.fillStyle = 'rgba(10,6,3,.75)'; g.fillRect(u0 - .5, .6, 1, 18); }
      }
      g.fillStyle = LATAO;
      for (const u of [pw - 3.6, pw + 2.4, 3 * pw - 3.6, 3 * pw + 2.4]) g.fillRect(u, 5.5, 1.3, 8);
    });
    ISO.box(c, x - .03, y - .03, w + .06, d + .06, 2, 24, NOG, { top: '#7a4f30', left: '#553621', right: '#3f281a' });

    // livros de arte e a esfera de latão
    const z0 = 26;
    ISO.box(c, x + .2, y + .1, .58, .4, 2.6, z0, '#e7e0cf', { top: '#f0eadc', left: '#d9d1bf' });
    ISO.box(c, x + .24, y + .12, .52, .36, 2.2, z0 + 2.6, '#24272c', { top: '#30333a' });
    {
      const p = S(x + .5, y + .3, z0 + 4.8);
      const gr = c.createRadialGradient(p.x - 1.2, p.y - 4.6, .3, p.x, p.y - 3, 3.2);
      gr.addColorStop(0, '#f6e2a8'); gr.addColorStop(1, '#8c6c30');
      c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(p.x, p.y, 3, 1.4, 0, 0, 7); c.fill();
      c.fillStyle = gr; c.beginPath(); c.arc(p.x, p.y - 3, 3.1, 0, 7); c.fill();
    }
    // fruteira rasa de cerâmica na outra ponta
    ISO.cyl(c, x + w - .5, y + .32, .22, 3.6, z0, '#d9d3c7');
    ISO.cyl(c, x + w - .5, y + .32, .17, .4, z0 + 3.3, '#b9b2a4');
  };

  /* ================= PEDESTAL DA BOLA =================
     Coluna preta com acabamento de latão ao lado da janela, como peça de
     museu: a bola de basquete na caixa de acrílico fica sozinha, longe da
     etiqueta do Gabriel, que tapava a ponta do aparador.               */
  function pedestalBola(c, o) {
    const { x, y, w, d } = o;
    ISO.shadow(c, x + w / 2, y + d / 2, .42, .3);
    ISO.box(c, x + .06, y + .06, w - .12, d - .12, 2, 0, '#0f1012');
    ISO.box(c, x + .08, y + .08, w - .16, d - .16, 38, 2, '#1b1c20', { top: '#26272c', left: '#1f2024', right: '#141518' });
    // filetes de latão no pé e no topo
    for (const z of [3, 37]) {
      ISO.quad(c, [S(x + .08, y + d - .08, z + 1), S(x + w - .08, y + d - .08, z + 1),
                   S(x + w - .08, y + d - .08, z), S(x + .08, y + d - .08, z)], LATAO);
      ISO.quad(c, [S(x + w - .08, y + .08, z + 1), S(x + w - .08, y + d - .08, z + 1),
                   S(x + w - .08, y + d - .08, z), S(x + w - .08, y + .08, z)], ISO.shade(LATAO, -.3));
    }
    ISO.box(c, x + .04, y + .04, w - .08, d - .08, 2, 40, '#1b1c20', { top: '#2a2b30' });
    vitrineBola(c, x + .05, y + .05, w - .1, d - .1, 42);
  }

  /* ================= ESTANTE =================
     Nogueira com três baias: nichos abertos em cima, com fita de luz
     quente sob cada prateleira, e um gaveteiro ripado embaixo. Livros
     em cores sóbrias, troféu, um cristal de premiação, o porta-retrato
     com a BMW, a cafeteira com as xícaras, vasos e uma escultura.     */
  PINTA.estanteChefe = (c, o) => {
    const { x, y, w, d } = o;
    const H = o.h;
    ISO.plane(c, x - .02, y + .06, w + .08, d + .08, .3, 'rgba(0,0,0,.32)');
    ISO.box(c, x + .04, y + .04, w - .08, d - .08, 3, 0, '#130e0b');
    ISO.box(c, x, y, w, d, H - 3, 3, NOG, { top: NOG_TOPO, left: '#4c301d', right: '#37231a' });
    FURN.faceY(c, x, y + d, w, H, (g, len) => {
      const lado = 5, meio = 4, bay = (len - 2 * lado - 2 * meio) / 3;
      const B = [0, 1, 2].map(i => lado + i * (bay + meio));
      const NICHOS = [[4, 27], [30, 52], [55, 73]];
      for (const [v0, v1] of NICHOS) for (const u0 of B) {
        g.fillStyle = '#1d140e'; g.fillRect(u0, v0, bay, v1 - v0);
        const gl = g.createLinearGradient(0, v0, 0, v0 + 11);
        gl.addColorStop(0, 'rgba(255,212,150,.24)'); gl.addColorStop(1, 'rgba(255,212,150,0)');
        g.fillStyle = gl; g.fillRect(u0, v0, bay, 11);
        g.fillStyle = 'rgba(255,228,184,.6)'; g.fillRect(u0 + 2, v0, bay - 4, .6);
        g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(u0, v0, 2.4, v1 - v0);
        g.fillStyle = 'rgba(255,220,180,.07)'; g.fillRect(u0, v1 - 1.3, bay, 1.3);
      }
      g.fillStyle = 'rgba(255,225,190,.07)';
      for (const v of [0, 27, 52, 73]) g.fillRect(0, v, len, 1);

      // nicho de cima
      livros(g, B[0] + 3, B[0] + 42, 27, 19.5, 1);
      nat(g, B[0] + 56, 27, gg => vaso(gg, '#e9e5dd', 11, true));
      nat(g, B[1] + 17, 27, cristal);
      nat(g, B[1] + 48, 27, retratoBmw);
      const topo = pilha(g, B[2] + 5, 27, 30, 3, 2);
      nat(g, B[2] + 20, topo, gg => esfera(gg, 2.6, '#f6e2a8', '#8c6c30'));
      livros(g, B[2] + 40, B[2] + bay - 2, 27, 19, 3);
      // nicho do meio
      livros(g, B[0] + 3, B[0] + 33, 52, 18.5, 5);
      g.fillStyle = '#16110d'; g.fillRect(B[0] + 33.5, 52 - 9, 1.6, 9);           // aparador de livros
      nat(g, B[0] + 52, 52, plantinha);
      nat(g, B[1] + bay / 2, 52, trofeu);
      livros(g, B[2] + 3, B[2] + 38, 52, 18, 7);
      nat(g, B[2] + 54, 52, gg => vaso(gg, '#2c3036', 13, false));
      // nicho de baixo: o café, um respiro e mais livros
      nat(g, B[0] + 18, 73, cafeteira);
      nat(g, B[0] + 41, 73, xicara);
      nat(g, B[0] + 51, 73, xicara);
      const t2 = pilha(g, B[1] + 8, 73, 34, 2, 4);
      nat(g, B[1] + 23, t2, escultura);
      nat(g, B[1] + 58, 73, gg => vaso(gg, '#b9a27a', 9, false));
      nat(g, B[2] + 16, 73, gg => vaso(gg, '#e9e5dd', 12, false));
      livros(g, B[2] + 30, B[2] + bay - 3, 73, 15, 9);

      // gaveteiro ripado com puxadores de latão
      for (const u0 of B) {
        for (let u = u0 + 2.2; u < u0 + bay - 1.6; u += 3.2) {
          g.fillStyle = 'rgba(255,225,190,.07)'; g.fillRect(u, 77, .9, 22);
          g.fillStyle = 'rgba(20,10,4,.3)'; g.fillRect(u + 1.9, 77, .9, 22);
        }
        g.fillStyle = 'rgba(10,6,3,.7)'; g.fillRect(u0, 76, bay, .9);
        g.fillStyle = LATAO; g.fillRect(u0 + bay / 2 - 9, 79.5, 18, 1.3);
      }
      g.fillStyle = 'rgba(10,6,3,.7)';
      for (const u0 of B.slice(1)) g.fillRect(u0 - meio / 2 - .4, 76, .8, 25);
    });
  };
  VERSAO.estanteChefe = () => BMW.pronto ? 1 : 0;      // o porta-retrato espera a foto

  FURN.registrar({
    aparadorChefe: tira,
    estanteChefe: tira,
    pedestalBola,

    /* tapete de lã: borda escura, filete claro e uma trama bem leve */
    tapeteChefe(ctx, o) {
      const { x, y, w, d } = o;
      const b = o.borda;
      ISO.box(ctx, x, y, w, d, 1.2, 0, o.cb, { top: o.cb, left: ISO.shade(o.cb, -.25), right: ISO.shade(o.cb, -.4), line: 'rgba(0,0,0,.18)' });
      ISO.plane(ctx, x + b, y + b, w - 2 * b, d - 2 * b, 1.25, o.c);
      for (let i = .07; i < d - 2 * b; i += .11)
        ISO.plane(ctx, x + b, y + b + i, w - 2 * b, .03, 1.27, 'rgba(255,255,255,.028)');
      for (let i = .07; i < w - 2 * b; i += .11)
        ISO.plane(ctx, x + b + i, y + b, .03, d - 2 * b, 1.27, 'rgba(0,0,0,.035)');
      ISO.plane(ctx, x + b + .14, y + b + .14, w - 2 * b - .28, d - 2 * b - .28, 1.3, null, o.cl);
    },

    /* mesa de centro: base de nogueira recuada e tampo de mármore */
    mesaCentroChefe(ctx, o) {
      const { x, y, w, d } = o;
      ISO.shadow(ctx, x + w / 2, y + d / 2, 1.15, .28);
      ISO.box(ctx, x + .32, y + .26, w - .64, d - .52, 13, 0, '#3d2616', { top: '#4a2f1c' });
      ISO.box(ctx, x, y, w, d, 4, 13, '#cdc7bb', { top: '#ebe7df', left: '#c3bcb0', right: '#a39c90' });
      // veios do mármore
      const q = [S(x, y, 17), S(x + w, y, 17), S(x + w, y + d, 17), S(x, y + d, 17)];
      ctx.save();
      ctx.beginPath(); q.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.clip();
      ctx.strokeStyle = 'rgba(120,115,108,.35)'; ctx.lineWidth = .6;
      for (const [a, b, c2, e] of [[.1, .3, .9, .2], [.2, .9, .6, .55], [.55, .1, 1, .6]]) {
        const p0 = S(x + w * a, y + d * b, 17), p1 = S(x + w * c2, y + d * e, 17);
        const pm = S(x + w * (a + c2) / 2, y + d * ((b + e) / 2 + .15), 17);
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.quadraticCurveTo(pm.x, pm.y, p1.x, p1.y); ctx.stroke();
      }
      ctx.restore();
      // livros, tigela de latão e um vasinho
      ISO.box(ctx, x + .28, y + .3, .66, .48, 2.4, 17, '#24272c', { top: '#30333a' });
      ISO.box(ctx, x + .32, y + .33, .58, .42, 2.2, 19.4, '#e7e0cf', { top: '#f0eadc' });
      ISO.cyl(ctx, x + 1.45, y + .62, .2, 3.2, 17, '#b8913e');
      ISO.cyl(ctx, x + 1.45, y + .62, .15, .4, 19.9, '#6b4a22');
      ISO.cyl(ctx, x + 1.85, y + .95, .08, 8, 17, '#e9e5dd');
      const p = S(x + 1.85, y + .95, 25);
      ctx.strokeStyle = '#5f7f4c'; ctx.lineWidth = .8;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo(p.x - 3, p.y - 6, p.x - 5, p.y - 9);
      ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo(p.x + 2, p.y - 7, p.x + 4, p.y - 10); ctx.stroke();
    },

    /* oliveira num vaso de cimento claro, ao lado da janela: tronco
       torto, galhos abertos e a copa em tufos de folhinhas prateadas */
    oliveira(ctx, o) {
      const cx = o.x + o.w / 2, cy = o.y + o.d / 2;
      ISO.shadow(ctx, cx, cy, .52, .3);
      ISO.cyl(ctx, cx, cy, .33, 28, 0, '#d6d0c4');
      ISO.cyl(ctx, cx, cy, .28, .6, 27.6, '#3a2b20');
      const b = S(cx, cy, 28);
      const TUFOS = [[-11, -47, 12, 9], [9, -52, 13, 10], [-3, -63, 13, 9.5], [12, -40, 8, 6.5],
                     [-15, -37, 7, 5.5], [1, -48, 10, 8]];
      ctx.save(); ctx.lineCap = 'round';
      ctx.strokeStyle = '#5c4632'; ctx.lineWidth = 2.8;
      ctx.beginPath(); ctx.moveTo(b.x, b.y - 1);
      ctx.bezierCurveTo(b.x - 4, b.y - 12, b.x + 4, b.y - 20, b.x + 1, b.y - 30); ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (const [tx, ty] of TUFOS) {
        ctx.moveTo(b.x + 1, b.y - 29);
        ctx.quadraticCurveTo(b.x + tx * .3, b.y + ty * .75, b.x + tx * .8, b.y + ty * .92);
      }
      ctx.stroke();
      ctx.restore();
      const FOLHAS = ['#b2bda3', '#9aa987', '#849574', '#6f8160', '#5b6b4e'];
      TUFOS.forEach(([tx, ty, rx, ry], j) => {
        const n = Math.round(rx * ry * .75);
        for (let i = 0; i < n; i++) {
          const a = i * 2.39996 + j, r = Math.sqrt((i + .5) / n);
          const dx = Math.cos(a) * r, dy = Math.sin(a) * r;
          // luz de cima à esquerda: o lado de baixo e da direita de cada tufo é mais escuro
          const k = Math.max(0, Math.min(4, Math.round(1.7 + (dx * .5 + dy * .9) * 1.9 + ((i * 7) % 3 - 1) * .5)));
          ctx.fillStyle = FOLHAS[k];
          ctx.beginPath();
          ctx.ellipse(b.x + tx + dx * rx, b.y + ty + dy * ry, 2.7, 1.05, a * 1.7, 0, 7);
          ctx.fill();
        }
      });
    },

    /* sofá de couro com almofadas (a de encosto norte é a que aparece) */
    sofaChefe(ctx, o) {
      FURN.desenho.sofa(ctx, o);
      if (o.dir !== 'n') return;
      [[.5, '#d9d1c1'], [1.16, '#3f5865'], [o.w - 1.2, '#8a5634']].forEach(([dx, cor]) => {
        const px = o.x + dx, py = o.y + .42;
        ISO.box(ctx, px, py, .6, .16, 14, 32, cor, { top: ISO.shade(cor, .2), line: 'rgba(0,0,0,.14)' });
        // volume de almofada: luz em cima, sombra embaixo e o vivo da costura
        FURN.faceY(ctx, px, py + .16, .6, 46, (c, len) => {
          const g = c.createLinearGradient(0, 0, 0, 14);
          g.addColorStop(0, 'rgba(255,255,255,.14)'); g.addColorStop(.45, 'rgba(255,255,255,0)');
          g.addColorStop(1, 'rgba(0,0,0,.22)');
          c.fillStyle = g; c.fillRect(0, 0, len, 14);
          c.strokeStyle = 'rgba(255,255,255,.16)'; c.lineWidth = .6;
          c.strokeRect(1.2, 1.2, len - 2.4, 11.6);
        });
      });
    },

    /* plaquinha com o nome, de frente para quem senta nas poltronas */
    plaquinhaNome(ctx, o) {
      const { x, y, w, d } = o;
      ISO.box(ctx, x, y, w, d, 6.8, TOP, '#18181b', { top: '#2a2a2e' });
      const nome = String((window.ESCRITORIO && ESCRITORIO.dono) || 'Gabriel');
      FURN.faceY(ctx, x + .05, y + d, w - .1, TOP + 6.4, (c, len) => {
        c.fillStyle = LATAO; c.fillRect(0, .6, len, 5.8);
        c.fillStyle = 'rgba(255,240,200,.5)'; c.fillRect(0, .6, len, .5);
        c.fillStyle = '#241c10'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.save(); c.translate(len / 2, 3.6); c.scale(1.55, 1);
        c.font = "700 4.9px 'Barlow Semi Condensed', sans-serif";
        c.fillText(nome + ' · CEO', 0, 0);
        c.restore();
      });
    },

    /* a luz da luminária da mesa: mais forte quando escurece lá fora */
    luzMesaChefe(ctx, o, t) {
      if (!(o.tn <= t && t - o.tn < 2)) { o.noite = NASSA.noite(); o.tn = t; }
      const p = S(o.x, o.y, o.z);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ISO.glow(ctx, p.x, p.y + 2, 30, '#ffd9a0', .1 + .24 * o.noite);
      ctx.restore();
    }
  }, { tapeteChefe: 12, mesaCentroChefe: 44, oliveira: 132, sofaChefe: 60, pedestalBola: 100, deskBoss: 96 });

  /* ===========================================================
     LAYOUT
     =========================================================== */
  // tapete grafite sob a mesa e as poltronas, greige claro no estar
  FURN.add({ t: 'tapeteChefe', x: 4.3, y: 2.5, w: 6.4, d: 6.6, borda: .24, dk: -1,
             c: '#4a4d52', cb: '#2a2c30', cl: 'rgba(196,170,120,.45)' });
  // o do estar acaba antes do nome da sala, que é pintado no piso em y 16
  FURN.add({ t: 'tapeteChefe', x: 2.2, y: 11.3, w: 7.4, d: 4.45, borda: .22, dk: -1,
             c: '#968e7f', cb: '#605a4f', cl: 'rgba(255,250,240,.3)' });

  // parede norte: o aparador debaixo da camisa e a estante do outro lado da BMW
  encostar({ t: 'aparadorChefe', x: 1.15, y: 1.1, w: 3.9, d: .62, alto: 72 });
  encostar({ t: 'estanteChefe', x: 10.15, y: 1.08, w: 3.7, d: .8, h: 104, alto: 116 });

  // na mesa do Gabriel: a plaquinha e a luz da luminária, logo depois dela
  const mesa = FURN.items.find(o => o.t === 'deskBoss');
  if (mesa) {
    const dm = FURN.depth(mesa);
    FURN.add({ t: 'plaquinhaNome', x: mesa.x + 1.47, y: mesa.y + 1.28, w: 1.26, d: .17, dk: dm + .01 });
    FURN.add({ t: 'luzMesaChefe', x: mesa.x + 3.3, y: mesa.y + .66, z: 49, dk: dm + .02 });
  }

  // estar: sofá em L de couro, mesa de centro de mármore e a luminária de piso
  FURN.add({ t: 'sofaChefe', x: 2.6, y: 11.6, w: 4.8, d: 1.6, dir: 'n', c: '#2b1d16' });  FURN.block(2.6, 11.6, 4.8, 1.6);
  FURN.add({ t: 'sofaChefe', x: 8.2, y: 12.0, w: 1.6, d: 3.6, dir: 'e', c: '#2b1d16' });  FURN.block(8.2, 12.0, 1.6, 3.6);
  FURN.add({ t: 'mesaCentroChefe', x: 4.2, y: 14.0, w: 2.2, d: 1.4 });                  FURN.block(4.2, 14.0, 2.2, 1.4);
  FURN.add({ t: 'abajur', x: 10.4, y: 11.2 });                                           FURN.block(10.4, 11.2, 1, 1);

  // a bola de basquete no pedestal, junto da janela e perto da camisa
  FURN.add({ t: 'pedestalBola', x: 1.35, y: 3.4, w: .6, d: .6 });                       FURN.block(1.35, 3.4, .6, .6);

  // verde: a oliveira na janela e a planta do canto
  FURN.add({ t: 'oliveira', x: 1.15, y: 6.2, w: .9, d: .9 });                            FURN.block(1.15, 6.2, .9, .9);
  FURN.add({ t: 'plant', x: 12.2, y: 15.6, k: 1 });                                      FURN.block(12.2, 15.6, 1, 1);
})();
