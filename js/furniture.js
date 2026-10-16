/* ===========================================================
   furniture.js — móveis, estações de trabalho e pontos de lazer

   Convenção de altura (px acima do piso):
     0 .. 25   estrutura da mesa
     28        tampo  (tudo que fica "em cima da mesa" nasce aqui)
     28 .. 62  monitor
     9 .. 15   assento da cadeira  (bate com AVATAR.SEAT = 15)
   =========================================================== */
const FURN = (() => {

  const items = [];
  const workSlots = [];
  const restSlots = [];
  const meetSlots = [];

  const TOP  = 28;          // tampo da mesa
  const S    = ISO.toScreen;
  const add  = (o) => { items.push(o); return o; };

  function block(x, y, w, d) {
    for (let i = Math.floor(x); i < Math.ceil(x + w); i++)
      for (let j = Math.floor(y); j < Math.ceil(y + d); j++)
        WORLD.setBlocked(i, j, 1);
  }

  /** cadeira no lugar do boneco, em duas camadas para ele sentar DENTRO dela.
      A pegada acompanha a escala do boneco: se a cadeira ficasse menor que
      ele, o corpo sobraria para fora do encosto.                          */
  function cadeira(seat, tipo, hue) {
    const L = 1.05 * AVATAR.SCALE;                   // lado da pegada, em tiles
    const comum = { x: seat.x - L / 2, y: seat.y - L / 2, w: L, d: L,
                    face: seat.facing, hue: hue || 200 };
    // o boneco é desenhado em (seat.x + seat.y + 0.5)
    add(Object.assign({ t: tipo, camada: 'tras',   dk: seat.x + seat.y - 0.25 }, comum));
    return add(Object.assign({ t: tipo, camada: 'frente', dk: seat.x + seat.y + 0.75 }, comum));
  }

  /** assento com encosto na frente de quem senta (poltrona 'n'/'w', sofá
      's'): a base entra antes do boneco e o encosto depois dele. Devolve a
      base, que é o objeto do slot.                                       */
  function emCamadas(o, partes = 1) {
    const base = add(Object.assign({}, o, { camada: 'base' }));
    // móvel largo (sofá) tem o encosto fatiado: cada fatia entra logo depois
    // de quem senta na frente dela, e não depois de todo mundo
    for (let i = 0; i < partes; i++) {
      const a0 = i / partes, a1 = (i + 1) / partes;
      const cx = o.x + (o.w || 1) * (a0 + a1) / 2;
      // nunca antes da própria base (nem de quem senta nela, que vai em
      // base + .02): a primeira fatia de um sofá largo tinha o centro tão
      // à esquerda que entrava antes do assento e sumia, deixando um buraco
      const dkBase = o.x + (o.w || 1) / 2 + o.y + (o.d || 1) / 2;
      const dk = Math.max(dkBase + .03 + i * .001,
                          partes > 1 ? cx + o.y + (o.d || 1) + .5
                                     : cx + o.y + (o.d || 1) / 2 + .9);
      add(Object.assign({}, o, { camada: 'frente', fatia: [a0, a1], dk }));
    }
    return base;
  }

  /** telão de parede, largo demais para uma profundidade só: com a chave no
      centro, as paredes de vidro atrás da ponta direita entravam depois e
      cobriam a tela, e quem passava na frente era cortado por ela. Cada
      tira de 1 tile tem a sua chave: depois da parede atrás dela e antes de
      quem anda na fileira da frente.                                     */
  function naParede(o) {
    const n = Math.ceil(o.w - 1e-6);
    for (let i = 0; i < n; i++)
      add(Object.assign({}, o, { fatia: [o.x + i, Math.min(o.x + i + 1, o.x + o.w)], dk: o.x + i + o.y + .7 }));
  }

  /* ===========================================================
     LAYOUT
     =========================================================== */

  /* ---------- SALA DOS DEVS: 12 estações ----------
     Duas fileiras. A que ficava colada na parede do fundo saiu: tapava o
     painel de números e deixava a sala apertada.                        */
  const COLS = [21, 25, 29, 33, 37, 41];
  const ROWS = [
    { y: 7,  face: 's' },      // de frente: vemos o rosto, monitor de costas
    { y: 12, face: 'n' }       // de costas: a tela aparece para nós
  ];
  let n = 0;
  for (const r of ROWS) {
    for (const x of COLS) {
      n++;
      const id = 'DEV-' + String(n).padStart(2, '0');
      const hue = 192 + (n % 4) * 9;          // tons do azul da marca
      let deskY, seat;
      if (r.face === 'n') { deskY = r.y;       seat = { x: x + 1.5, y: r.y + 2.0,  facing: 'n' }; }
      else                { deskY = r.y + 1.9; seat = { x: x + 1.5, y: r.y + 1.20, facing: 's' }; }

      const mesa = add({ t: 'deskGamer', id, x, y: deskY, w: 3, d: 1.3,
                         face: r.face, busy: false, hue, sabor: n % 3 });
      block(x, deskY, 3, 1.3);
      cadeira(seat, 'chairGamer', hue);
      workSlots.push({ id, room: 'servico', label: 'estação ' + id,
                       x: seat.x, y: seat.y, facing: seat.facing, obj: mesa });
    }
  }


  /* ---------- SALA DO CHEFE ----------
     Mesa do Gabriel de frente para a porta, com o quadro da BMW na
     parede ripada atrás dele. Duas cadeiras de visita, estar com sofá
     de couro, estante e vista para a Ponte Estaiada pela fachada.     */
  const seatA = { x: 7.5, y: 4.0,  facing: 's' };
  const mesaA = add({ t: 'deskBoss', id: 'DIR-1', x: 5.4, y: 4.7, w: 4.2, d: 1.6,
                      face: 's', busy: false, hue: 198, controle: true });
  block(5.4, 4.7, 4.2, 1.6);
  cadeira(seatA, 'chairBoss');
  workSlots.push({ id: 'DIR-1', room: 'diretoria', label: 'mesa do chefe',
                   x: seatA.x, y: seatA.y, facing: 's', obj: mesaA, vip: true });

  add({ t: 'rug', x: 4.4, y: 2.6, w: 6.2, d: 6.4, c: '#1d2a3a' });
  [6.5, 8.5].forEach(x => { add({ t: 'poltrona', x: x - .6, y: 7.3, w: 1.2, d: 1.2, face: 'n', c: '#3b2a1f' });
                            block(x - .6, 7.3, 1.2, 1.2); });

  add({ t: 'rug',      x: 2.2, y: 11.2, w: 7.6, d: 5.2, c: '#2a2018' });
  add({ t: 'sofa',     x: 2.6, y: 11.6, w: 4.8, d: 1.6, dir: 'n', c: '#2b1d16' });     block(2.6, 11.6, 4.8, 1.6);
  add({ t: 'sofa',     x: 8.2, y: 12.0, w: 1.6, d: 3.6, dir: 'e', c: '#2b1d16' });     block(8.2, 12.0, 1.6, 3.6);
  add({ t: 'lowTable', x: 4.2, y: 14.0, w: 2.2, d: 1.4 });                            block(4.2, 14.0, 2.2, 1.4);
  add({ t: 'estante',  x: 11.4, y: 1.15, w: 2.4, d: .8 });                            block(11.4, 1.15, 2.4, .8);
  add({ t: 'abajur',   x: 1.3, y: 1.3 });                                             block(1.3, 1.3, 1, 1);
  add({ t: 'plant',    x: 12.2, y: 15.6, k: 1 });                                     block(12.2, 15.6, 1, 1);
  add({ t: 'plant',    x: 1.4,  y: 6.6, k: 0 });                                      block(1.4, 6.6, 1, 1);
  add({ t: 'cafe',     x: 10.3, y: 1.1 });                                            block(10.3, 1.1, 1, 1);
  add({ t: 'abajur',   x: 10.4, y: 11.2 });                                           block(10.4, 11.2, 1, 1);

  /* ---------- SALA DE JOGOS ----------
     Um lounge sóbrio, sem neon: assoalho claro, painel de feltro grafite,
     sinuca, pebolim, mesa de xadrez, videogame no telão e café.        */
  add({ t: 'xadrez', x: 3.5, y: 24.2, w: 1.2, d: 1.2 });
  block(3.5, 24.2, 1.2, 1.2);
  [{ x: 2.0, face: 'e', sx: 2.65 }, { x: 4.9, face: 'w', sx: 5.55 }].forEach((p, i) => {
    const o = { t: 'poltrona', x: p.x, y: 24.15, w: 1.3, d: 1.3, face: p.face, c: '#3b2a1f' };
    const pol = p.face === 'w' ? emCamadas(o) : add(o);
    block(p.x, 24.15, 1.3, 1.3);
    restSlots.push({ id: 'XAD' + i, label: 'xadrez', x: p.sx, y: 24.8, facing: p.face,
                     sit: true, act: 'jogando xadrez', obj: pol });
  });
  add({ t: 'estante', x: 6.6, y: 23.15, w: 2.2, d: .8 });  block(6.6, 23.15, 2.2, .8);

  const pool = add({ t: 'poolTable', x: 9.6, y: 25, w: 4.6, d: 2.6 });
  block(9.6, 25, 4.6, 2.6);
  restSlots.push({ id: 'POOL0', label: 'sinuca', x: 8.6,  y: 26.3, facing: 'e', act: 'na sinuca', obj: pool });
  restSlots.push({ id: 'POOL1', label: 'sinuca', x: 15.0, y: 26.3, facing: 'w', act: 'na sinuca', obj: pool });
  restSlots.push({ id: 'POOL2', label: 'sinuca', x: 11.9, y: 24.3, facing: 's', act: 'na sinuca', obj: pool });

  const peb = add({ t: 'foosball', x: 9.8, y: 29.4, w: 4.2, d: 2 });
  block(9.8, 29.4, 4.2, 2);
  restSlots.push({ id: 'PEB0', label: 'pebolim', x: 8.6,  y: 30.4, facing: 'e', act: 'no pebolim', obj: peb });
  restSlots.push({ id: 'PEB1', label: 'pebolim', x: 14.7, y: 30.4, facing: 'w', act: 'no pebolim', obj: peb });

  naParede({ t: 'tvWall', x: 18.4, y: 23.15, w: 5, d: 0.5 });
  block(18.4, 23.15, 5, .75);     // ninguém passa por trás da tela
  add({ t: 'rug', x: 18.0, y: 24.2, w: 5.8, d: 4.4, c: '#2b2a29' });
  // sofá de frente para o telão: o encosto fica do lado da câmera
  const sofaL = emCamadas({ t: 'sofa', x: 18.6, y: 26.4, w: 4.6, d: 1.6, dir: 's', c: '#2b1d16' }, 3);
  block(18.6, 26.4, 4.6, 1.6);
  ['SOF0', 'SOF1', 'SOF2'].forEach((id, i) =>
    restSlots.push({ id, label: 'sofá', x: 19.7 + i * 1.4, y: 26.95, facing: 'n',
                     sit: true, act: i === 1 ? 'jogando FIFA no telão' : 'assistindo o jogo', obj: sofaL }));
  [25.2, 27.2].forEach((y, i) => {
    const pol = emCamadas({ t: 'poltrona', x: 24.4, y, w: 1.3, d: 1.3, face: 'w', c: '#3b2a1f' });
    block(24.4, y, 1.3, 1.3);
    restSlots.push({ id: 'POL' + i, label: 'poltrona', x: 25.05, y: y + .65, facing: 'w',
                     sit: true, act: i ? 'lendo no lounge' : 'assistindo o jogo', obj: pol });
  });

  const bar = add({ t: 'bar', x: 2, y: 30.4, w: 5.4, d: 1.4 });
  block(2, 30.4, 5.4, 1.4);
  restSlots.push({ id: 'BAR0', label: 'café', x: 3.0, y: 29.4, facing: 's', act: 'tomando um café', obj: bar });
  restSlots.push({ id: 'BAR1', label: 'café', x: 5.4, y: 29.4, facing: 's', act: 'tomando um café', obj: bar });

  add({ t: 'vending', x: 26.6, y: 23.2 });                    block(26.6, 23.2, 1.2, 1.2);
  add({ t: 'plant', x: 16.6, y: 23.4, k: 1 });                 block(16.6, 23.4, 1, 1);
  add({ t: 'plant', x: 27.0, y: 31.2, k: 0 });                 block(27.0, 31.2, 1, 1);

  /* ---------- SALA DE REUNIÃO ---------- */
  const mtable = add({ t: 'meetTable', x: 36, y: 26, w: 7, d: 3.2 });
  block(36, 26, 7, 3.2);
  [36.8, 38.8, 40.8].forEach((x, i) => {
    const s = { id: 'MT' + i, x, y: 25.2, facing: 's', sit: true, obj: mtable };
    meetSlots.push(s); cadeira(s, 'chairSimple');
  });
  [36.8, 38.8, 40.8].forEach((x, i) => {
    const s = { id: 'MB' + i, x, y: 29.9, facing: 'n', sit: true, obj: mtable };
    meetSlots.push(s); cadeira(s, 'chairSimple');
  });
  [{ id: 'ML', x: 35.2, y: 27.6, facing: 'e' }, { id: 'MR', x: 43.7, y: 27.6, facing: 'w' }]
    .forEach(p => {
      const s = Object.assign({ sit: true, obj: mtable }, p);
      meetSlots.push(s); cadeira(s, 'chairSimple');
    });

  // a porta da sala fica em x 35..36 (world.js): o telão não fica mais no caminho
  naParede({ t: 'tvWall', x: 37.5, y: 23.15, w: 4.6, d: 0.5, meeting: true });
  block(37.5, 23.15, 4.6, .75);
  add({ t: 'plant', x: 33.4, y: 31.2, k: 0 });               block(33.4, 31.2, 1, 1);

  /* ---------- CORREDOR / RECEPÇÃO ---------- */
  // as portas ficam no plano da parede leste: entram depois das paredes
  // (x 47, y 19..21) para o parapeito de vidro não passar na frente delas
  add({ t: 'elevator',  x: 46, y: 19.2, w: 1, d: 2, dk: 69.5 });
  add({ t: 'reception', x: 42.6, y: 19, w: 2.6, d: 1 }); block(42.6, 19, 2.6, 1);
  add({ t: 'plant', x: 32.4, y: 19, k: 0 }); block(32.4, 19, 1, 1);
  add({ t: 'plant', x: 33.6, y: 21, k: 1 }); block(33.6, 21, 1, 1);

  add({ t: 'rack', x: 8.4,  y: 19, label: 'API',       hue: 190 }); block(8.4, 19, 1.2, 1);
  add({ t: 'rack', x: 10.0, y: 19, label: 'AGENTES',   hue: 205 }); block(10.0, 19, 1.2, 1);
  add({ t: 'rack', x: 11.6, y: 19, label: 'DB',        hue: 220 }); block(11.6, 19, 1.2, 1);

  [2.2, 17.4, 27.4].forEach((x, i) => { add({ t: 'plant', x, y: 19, k: i % 2 }); block(x, 19, 1, 1); });
  add({ t: 'neonSign', x: 20.4, y: 19, txt: String((window.ESCRITORIO && ESCRITORIO.nome) || 'NASSA TECH').toUpperCase().slice(0, 16), hue: 190, marca: true });

  /* ===========================================================
     DESENHO
     =========================================================== */
  /** pinta sub-peças de um móvel do fundo para a frente (menor y primeiro) */
  function emOrdem(pecas) {
    pecas.sort((a, b) => a[0] - b[0]).forEach(p => p[1]());
  }

  /* Peças que nunca mudam (cadeira, sinuca, pebolim, sofá, expositor…) são
     pintadas uma vez num canvas próprio e depois só copiadas. O cache é
     feito em 2x para continuar nítido no zoom. O que tem RGB ou animação
     — mesa, arcade, rack, TV, planta — continua sendo desenhado ao vivo. */
  const ALTURA_CACHE = {
    chairGamer: 78, chairBoss: 84, chairSimple: 58, chairGuest: 64, expositor: 96,
    poltrona: 60, xadrez: 50,
    pilhaCaixas: 118, poolTable: 56, foosball: 52, sofa: 60,
    rug: 12, lowTable: 40, cooler: 64
  };
  const ESC_CACHE = 2;
  const cacheMovel = new Map();

  function montaCacheMovel(o, f) {
    const w = o.w || 1, d = o.d || 1;
    const alto = ALTURA_CACHE[o.t] || 120;
    const x0 = ISO.toScreen(o.x, o.y + d).x - 22;
    const x1 = ISO.toScreen(o.x + w, o.y).x + 22;
    const y0 = ISO.toScreen(o.x, o.y).y - alto;
    const y1 = ISO.toScreen(o.x + w, o.y + d).y + 26;
    const W = Math.ceil((x1 - x0) * ESC_CACHE), H = Math.ceil((y1 - y0) * ESC_CACHE);
    if (W <= 0 || H <= 0 || W * H > 1.2e6) return null;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    c.scale(ESC_CACHE, ESC_CACHE);
    c.translate(-x0, -y0);
    f(c, o, 0);
    return { cv, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  function drawItem(ctx, o, t) {
    const f = DRAW[o.t];
    if (!f) return;
    if (!(o.t in ALTURA_CACHE)) { f(ctx, o, t); return; }
    let c = cacheMovel.get(o);
    if (c === undefined) { c = montaCacheMovel(o, f); cacheMovel.set(o, c); }
    if (!c) { f(ctx, o, t); return; }
    ctx.drawImage(c.cv, c.x, c.y, c.w, c.h);
  }
  function depth(o) {
    if (o.dk !== undefined) return o.dk;
    if (o.t === 'rug') return -1;          // tapete é chão: vai antes de tudo
    return (o.x + (o.w || 1) / 2) + (o.y + (o.d || 1) / 2);
  }

  /** superfície virada para +y (a que a câmera enxerga), em px */
  function faceY(ctx, x, yPlane, lenTiles, topZ, fn) {
    const T = ISO.TW;
    const o = ISO.toScreen(x, yPlane, topZ);
    ctx.save();
    ctx.transform(ISO.HW / T, ISO.HH / T, 0, 1, o.x, o.y);
    fn(ctx, lenTiles * T);
    ctx.restore();
  }

  /** caneca de café em cima da mesa (cor muda por mesa) */
  const CANECAS = ['#e9edf8', '#7c6cff', '#38bdf8', '#f472b6', '#22c55e'];
  function caneca(ctx, cx, cy, z, cor, s = 1) {
    const c = CANECAS[((cor | 0) % CANECAS.length + CANECAS.length) % CANECAS.length];
    const r = 0.11 * s;
    ISO.cyl(ctx, cx, cy, r, 13 * s, z, c);
    ISO.cyl(ctx, cx, cy, r * .82, 1.5, z + 13 * s - 1.5, '#3b2418');
    const p = ISO.toScreen(cx + r * 1.2, cy, z + 7 * s);
    ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = 1.6 * s;
    ctx.beginPath(); ctx.arc(p.x + 1.5 * s, p.y, 2.6 * s, -1.3, 1.3); ctx.stroke(); ctx.restore();
  }

  const DRAW = {

    /* ================= MESA GAMER =================
       Suporta mesa no eixo Y (face 'n'/'s') e no eixo X (face 'e'/'w').
       No eixo X o boneco senta de perfil e a mesa fica ao lado dele.     */
    deskGamer(ctx, o, t) {
      const { x, y, w, d } = o;
      const neon = NASSA.led(t, o.x + o.y);
      const eixoX = (o.face === 'e' || o.face === 'w');
      // a tela só aponta para a câmera quando o boneco está de costas
      const telaVisivel = (o.face === 'n' || o.face === 'w');

      ISO.shadow(ctx, x + w / 2, y + d / 2, Math.max(w, d) * .55, .28);

      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gp = S(x + w / 2, y + d / 2, 6);
      ISO.glow(ctx, gp.x, gp.y, 74, neon, o.busy ? .3 : .13);
      ctx.restore();

      /* estrutura: dois painéis nas pontas + travessa */
      if (eixoX) {
        ISO.box(ctx, x + .12, y + .05,      w - .24, .17, 25, 0, '#1c202b');
        ISO.box(ctx, x + .12, y + d - .22,  w - .24, .17, 25, 0, '#1c202b');
        ISO.box(ctx, x + .16, y + .22,      .1, d - .44, 14, 6, '#181c26');
      } else {
        ISO.box(ctx, x + .05,     y + .12, .17, d - .24, 25, 0, '#1c202b');
        ISO.box(ctx, x + w - .22, y + .12, .17, d - .24, 25, 0, '#1c202b');
        ISO.box(ctx, x + .22,     y + .16, w - .44, .1,  14, 6, '#181c26');
      }
      ISO.plane(ctx, x - .05, y - .05, w + .1, d + .1, TOP, '#39414f');
      ISO.plane(ctx, x + .1,  y + .06, w - .2, d - .22, TOP + .1, 'rgba(255,255,255,.028)');

      // fita de LED na borda do tampo virada para a câmera
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ISO.quad(ctx, [S(x - .05, y + d + .05, 25), S(x + w + .05, y + d + .05, 25),
                     S(x + w + .05, y + d + .05, 21), S(x - .05, y + d + .05, 21)],
               ISO.rgba(neon, .68));
      ctx.restore();

      if (eixoX) {
        // mesa de lado: monitor no fundo, teclado na beira de quem senta
        const cy  = y + d / 2;
        const monX = o.face === 'e' ? x + .55 : x + .2;
        const tecX = o.face === 'e' ? x + .06 : x + .62;
        emOrdem([
          [monX, () => monitorY(ctx, monX, cy - .85, 1.7, telaVisivel, o.busy, neon, t)],
          [tecX, () => tecladoY(ctx, tecX, cy - .78, neon)],
          [x + .1,  () => gabinete(ctx, x + .1, y + d - .92, neon, t)],
          [x + w - .45, () => caneca(ctx, x + w - .35, y + .38, TOP, o.sabor, .85)]
        ]);
      } else {
        const monY = o.face === 'n' ? y + .12 : y + .62;
        const tecY = o.face === 'n' ? y + .78 : y + .06;
        const mw = 1.7, mx = x + w / 2 - mw / 2 - .3;
        emOrdem([
          [monY,      () => monitor(ctx, mx, monY, mw, telaVisivel, o.busy, neon, t, o)],
          [tecY,      () => teclado(ctx, x + w / 2 - .95, tecY, neon)],
          [y + .14,   () => gabinete(ctx, x + w - .68, y + .14, neon, t)],
          [y + d / 2, () => caneca(ctx, x + .42, y + d / 2, TOP, o.sabor, .85)]
        ]);
      }
    },

    /* ================= MESA DA DIRETORIA ================= */
    deskBoss(ctx, o, t) {
      const { x, y, w, d } = o;
      const neon = NASSA.led(t * .6, o.x + o.y);
      ISO.shadow(ctx, x + w / 2, y + d / 2, 2.1, .3);

      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gp = S(x + w / 2, y + d / 2, 6);
      ISO.glow(ctx, gp.x, gp.y, 94, neon, o.busy ? .3 : .13);
      ctx.restore();

      ISO.box(ctx, x + .06,     y + .12, .2, d - .24, 25, 0, '#191419');
      ISO.box(ctx, x + w - .26, y + .12, .2, d - .24, 25, 0, '#191419');
      ISO.box(ctx, x + .26,     y + .16, w - .52, .12, 16, 6, '#151115');
      ISO.plane(ctx, x - .06, y - .06, w + .12, d + .12, TOP, '#4a3322');
      for (let i = 0; i < 6; i++)
        ISO.plane(ctx, x, y + .12 + i * .24, w, .035, TOP + .1, 'rgba(255,255,255,.04)');

      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ISO.quad(ctx, [S(x - .06, y + d + .06, 25), S(x + w + .06, y + d + .06, 25),
                     S(x + w + .06, y + d + .06, 21), S(x - .06, y + d + .06, 21)],
               ISO.rgba(neon, .7));
      ctx.restore();

      // dois monitores, de costas (quem senta está de frente para nós)
      const monY = y + .66;
      emOrdem([
        [monY,      () => { monitor(ctx, x + .42,  monY, 1.5, false, o.busy, neon, t, o);
                            monitor(ctx, x + 2.24, monY, 1.5, false, o.busy, neon, t, o); }],
        [y + .06,   () => teclado(ctx, x + w / 2 - 1.0, y + .06, neon)],
        // o gabinete vai pela frente (y + .96): pela borda de trás ele entrava
        // antes do monitor, que pintava por cima da janela de vidro dele
        [y + .96,   () => gabinete(ctx, x + w - .72, y + .18, neon, t)],
        [y + d - .3,() => caneca(ctx, x + .2, y + d - .3, TOP, 0, .9)]
      ]);
    },

    /* ================= CADEIRAS ================= */
    chairGamer(ctx, o) { const a = ISO.hsl(o.hue, 85, 52);
      cadeiraBase(ctx, o, '#14171f', a, 30, true); },
    chairBoss(ctx, o)  {
      cadeiraBase(ctx, o, '#17191e', '#00b3ff', 36, true); },
    chairGuest(ctx, o) {
      cadeiraBase(ctx, o, '#3a2a20', '#c99a6b', 24, true); },
    chairSimple(ctx, o){
      cadeiraBase(ctx, o, '#1c2234', '#4a5a86', 22, false); },

    /* ---------- o resto do mobiliário ---------- */
    arcade(ctx, o, t) {
      const { x, y } = o;
      const neon = ISO.hsl((o.hue + t * 40) % 360, 95, 60);
      ISO.shadow(ctx, x + .75, y + .6, .9, .3);
      ISO.box(ctx, x, y, 1.5, 1.2, 84, 0, '#161a2c');
      ISO.box(ctx, x - .04, y - .04, 1.58, 1.28, 14, 84, '#0e1120', { top: ISO.rgba(neon, .8) });
      const p1 = S(x, y + 1.2, 74), p2 = S(x + 1.5, y + 1.2, 74);
      const p3 = S(x + 1.5, y + 1.2, 44), p4 = S(x, y + 1.2, 44);
      ISO.quad(ctx, [p1, p2, p3, p4], '#04060e');
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 9; i++) {
        const f = i / 9, hh = .15 + .5 * Math.abs(Math.sin(t * 3 + i));
        ISO.quad(ctx, [
          { x: p1.x + (p2.x - p1.x) * f,        y: p1.y + (p2.y - p1.y) * f + (p4.y - p1.y) * hh },
          { x: p1.x + (p2.x - p1.x) * (f + .07), y: p1.y + (p2.y - p1.y) * (f + .07) + (p4.y - p1.y) * hh },
          { x: p1.x + (p2.x - p1.x) * (f + .07), y: p4.y + (p3.y - p4.y) * (f + .07) },
          { x: p1.x + (p2.x - p1.x) * f,         y: p4.y + (p3.y - p4.y) * f }
        ], ISO.rgba(ISO.hsl((o.hue + i * 30) % 360, 95, 60), .55));
      }
      ctx.restore();
      ISO.box(ctx, x + .05, y + 1.14, 1.4, .5, 8, 34, '#1b2136', { top: '#262d47' });
      ISO.cyl(ctx, x + .45, y + 1.4, .1, 9, 42, '#7c6cff');
      ISO.cyl(ctx, x + .75, y + 1.4, .09, 7, 42, '#38bdf8');
      ISO.cyl(ctx, x + 1.05, y + 1.4, .09, 7, 42, '#c4b8ff');
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = S(x + .75, y + .6, 70); ISO.glow(ctx, g.x, g.y, 74, neon, .3);
      ctx.restore();
    },

    poolTable(ctx, o) {
      const { x, y, w, d } = o;
      ISO.shadow(ctx, x + w / 2, y + d / 2, 2.4, .32);
      [[.2, .2], [w - .6, .2], [.2, d - .6], [w - .6, d - .6]]
        .forEach(p => ISO.box(ctx, x + p[0], y + p[1], .4, .4, 26, 0, '#231208'));
      ISO.box(ctx, x, y, w, d, 12, 26, '#3a1d0c', { top: '#4a2610' });
      ISO.plane(ctx, x + .28, y + .28, w - .56, d - .56, 38.4, '#0f5c3a');
      ISO.plane(ctx, x + .28, y + .28, w - .56, d - .56, 38.4, null, 'rgba(0,0,0,.35)');
      [['#f2f2f2', .5, .5], ['#e8b923', 2.6, 1.0], ['#b3261e', 3.0, 1.35],
       ['#1f3f8f', 3.3, .9], ['#111111', 2.8, 1.7], ['#d9772b', 3.5, 1.6]]
      .forEach(([c, bx, by]) => {
        const p = S(x + bx, y + by, 38.4);
        ctx.fillStyle = 'rgba(0,0,0,.3)';
        ctx.beginPath(); ctx.ellipse(p.x, p.y + 2, 6, 3.4, 0, 0, 7); ctx.fill();
        const g = ctx.createRadialGradient(p.x - 2, p.y - 4, 1, p.x, p.y - 2, 7);
        g.addColorStop(0, ISO.shade(c, .5)); g.addColorStop(1, ISO.shade(c, -.25));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y - 2, 5.4, 0, 7); ctx.fill();
      });
    },

    foosball(ctx, o) {
      const { x, y, w, d } = o;
      ISO.shadow(ctx, x + w / 2, y + d / 2, 2.1, .3);
      [[.15, .15], [w - .5, .15], [.15, d - .5], [w - .5, d - .5]]
        .forEach(p => ISO.box(ctx, x + p[0], y + p[1], .35, .35, 24, 0, '#2a1b12'));
      ISO.box(ctx, x, y, w, d, 10, 24, '#3a2618', { top: '#14361f' });
      ISO.plane(ctx, x + .2, y + .2, w - .4, d - .4, 34.4, '#166534');
      ISO.plane(ctx, x + w / 2 - .03, y + .2, .06, d - .4, 34.5, 'rgba(255,255,255,.45)');
      for (let i = 0; i < 5; i++) {
        const bx = x + .6 + i * ((w - 1.2) / 4);
        ISO.box(ctx, bx, y - .18, .07, d + .36, 4, 44, '#9aa6c4');
        for (let j = 0; j < 3; j++)
          ISO.box(ctx, bx - .07, y + .5 + j * ((d - 1) / 2) - .1, .22, .22, 11, 34,
                  i % 2 ? '#b3261e' : '#1f3f8f');
      }
    },

    sofa(ctx, o) {
      const { x, y, w, d } = o;
      const c = o.c || '#2b2340';
      const braco = ISO.shade(c, .06);
      /* almofada do assento: uma caixa de 16 px em cima da base, com frente
         e lateral. Antes era só uma placa solta a 32 px de altura, e entre
         ela e a base aparecia um vão escuro, como um buraco no sofá.     */
      const almofada = (ax, ay, aw, ad) => {
        ISO.box(ctx, ax, ay, aw, ad, 16, 16, ISO.shade(c, .02), { top: ISO.shade(c, .16) });
        // costura entre as almofadas
        const longo = aw >= ad, comp = longo ? aw : ad, n = Math.max(1, Math.round(comp / 1.6));
        for (let i = 1; i < n; i++) {
          if (longo) ISO.plane(ctx, ax + aw * i / n - .015, ay, .03, ad, 32.2, ISO.shade(c, -.12));
          else       ISO.plane(ctx, ax, ay + ad * i / n - .015, aw, .03, 32.2, ISO.shade(c, -.12));
        }
      };
      if (o.camada !== 'frente') {
        ISO.shadow(ctx, x + w / 2, y + d / 2, Math.max(w, d) * .55, .28);
        ISO.box(ctx, x, y, w, d, 16, 0, ISO.shade(c, -.2));
      }
      // as peças vão do fundo para a frente: o que tem x ou y menor primeiro
      if (o.dir === 's') {
        // encosto do lado da câmera: quem senta olha para o norte
        if (o.camada !== 'frente') {
          ISO.box(ctx, x, y, .38, d - .42, 16, 16, braco);
          almofada(x + .38, y, w - .76, d - .42);
          ISO.box(ctx, x + w - .38, y, .38, d - .42, 16, 16, braco);
        }
        if (o.camada !== 'base') {
          const [a0, a1] = o.fatia || [0, 1];
          ISO.box(ctx, x + w * a0, y + d - .42, w * (a1 - a0), .42, 34, 16, c);
        }
        return;
      }
      if (o.dir === 'e') {
        // encosto do lado leste: quem senta olha para oeste
        ISO.box(ctx, x, y, w - .42, .38, 16, 16, braco);
        almofada(x, y + .38, w - .42, d - .76);
        ISO.box(ctx, x, y + d - .38, w - .42, .38, 16, 16, braco);
        ISO.box(ctx, x + w - .42, y, .42, d, 34, 16, c);
        return;
      }
      if (o.dir === 'n') {
        ISO.box(ctx, x, y, w, .42, 34, 16, c);
        ISO.box(ctx, x, y + .42, .38, d - .42, 16, 16, braco);
        almofada(x + .38, y + .42, w - .76, d - .42);
        ISO.box(ctx, x + w - .38, y + .42, .38, d - .42, 16, 16, braco);
      } else {
        ISO.box(ctx, x, y, .42, d, 34, 16, c);
        ISO.box(ctx, x + .42, y, w - .42, .38, 16, 16, braco);
        almofada(x + .42, y + .38, w - .42, d - .76);
        ISO.box(ctx, x + .42, y + d - .38, w - .42, .38, 16, 16, braco);
      }
    },

    beanbag(ctx, o) {
      const { x, y } = o;
      const c = ISO.hsl(o.hue, 62, 46);
      ISO.shadow(ctx, x + .6, y + .6, .82, .28);
      const p = S(x + .6, y + .6, 0);
      const g = ctx.createRadialGradient(p.x - 6, p.y - 22, 3, p.x, p.y - 12, 30);
      g.addColorStop(0, ISO.shade(c, .3)); g.addColorStop(1, ISO.shade(c, -.28));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(p.x, p.y - 11, 30, 19, 0, 0, 7); ctx.fill();
      ctx.fillStyle = ISO.shade(c, .12);
      ctx.beginPath(); ctx.ellipse(p.x, p.y - 20, 22, 11, 0, 0, 7); ctx.fill();
    },

    lowTable(ctx, o) {
      const { x, y, w, d } = o;
      ISO.shadow(ctx, x + w / 2, y + d / 2, .9, .26);
      ISO.box(ctx, x + .12, y + .12, .12, .12, 18, 0, '#24202c');
      ISO.box(ctx, x + w - .24, y + d - .24, .12, .12, 18, 0, '#24202c');
      ISO.box(ctx, x, y, w, d, 5, 18, '#2e2836', { top: 'rgba(160,190,255,.2)' });
      caneca(ctx, x + w / 2, y + d / 2, 23, 1, .8);
    },

    rug(ctx, o) {
      const { x, y, w, d } = o;
      ISO.plane(ctx, x, y, w, d, 0.6, ISO.rgba(o.c || '#2a2240', .78));
      ISO.plane(ctx, x + .3, y + .3, w - .6, d - .6, 0.7, null, 'rgba(255,255,255,.07)');
    },

    tvWall(ctx, o, t) {
      // uma tira (ver naParede): desenha o telão inteiro recortado na faixa
      // vertical dela, com as bordas no pixel inteiro para não sobrar costura
      if (o.fatia) {
        const m = ctx.getTransform(), snap = v => (Math.round(v * m.a + m.e) - m.e) / m.a;
        const [a, b] = o.fatia, yc = o.y + .4;
        const L = a <= o.x + 1e-6 ? -1e5 : snap(S(a, yc).x);
        const R = b >= o.x + o.w - 1e-6 ? 1e5 : snap(S(b, yc).x);
        ctx.save();
        ctx.beginPath(); ctx.rect(L, -1e5, R - L, 2e5); ctx.clip();
        DRAW.tvWall(ctx, Object.assign({}, o, { fatia: null }), t);
        ctx.restore();
        return;
      }
      const { x, y, w } = o;
      const h = 62, z = 46;
      // pedestal: base no piso e duas colunas até a tela
      ISO.shadow(ctx, x + w / 2, y + .5, w * .4, .25);
      ISO.box(ctx, x + .3, y + .05, w - .6, .7, 4, 0, '#1b1d22', { top: '#2a2d33' });
      for (const px of [.7, w - .85]) ISO.box(ctx, x + px, y + .1, .15, .15, z, 2, '#25282e');
      ISO.box(ctx, x + .3, y + .05, w - .6, .5, 22, 4, '#1f2126', { top: '#2c2f35' });
      ISO.box(ctx, x, y, w, .22, h, z, '#0a0c14');
      faceY(ctx, x + .02, y + .22, w - .04, z + h - 4, (c, len) => {
        c.fillStyle = '#05070f'; c.fillRect(0, 0, len, h - 8);
        if (o.meeting) {
          c.textAlign = 'left'; c.textBaseline = 'middle';
          if (NASSA.pronto(NASSA.logo)) {
            const im = NASSA.logo, k = 12 / im.naturalHeight;
            c.drawImage(im, len - 12 - im.naturalWidth * k, 5, im.naturalWidth * k, 12);
          }
          c.font = "700 9px 'Barlow Semi Condensed', sans-serif";
          c.fillStyle = '#00b3ff'; c.fillText('DAILY · SALA DE REUNIÃO', 10, 11);
          c.font = "600 8px 'Barlow Semi Condensed', sans-serif";
          c.fillStyle = 'rgba(170,182,210,.8)';
          c.fillText(new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }).toUpperCase(), 12, 27);
          for (let i = 0; i < 3; i++) {
            c.fillStyle = ISO.rgba('#38bdf8', .18 + .1 * i);
            c.fillRect(12, 38 + i * 9, (len - 24) * (.35 + .25 * ((Math.sin(t * .6 + i) + 1) / 2)), 4);
          }
        } else {
          // partida no videogame: gramado, linhas e placar
          const g = c.createLinearGradient(0, 0, 0, h - 8);
          g.addColorStop(0, '#2f6b33'); g.addColorStop(1, '#245528');
          c.fillStyle = g; c.fillRect(0, 0, len, h - 8);
          c.fillStyle = 'rgba(255,255,255,.06)';
          for (let i = 0; i < 8; i += 2) c.fillRect(i * len / 8, 0, len / 8, h - 8);
          c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1;
          c.strokeRect(6, 6, len - 12, h - 20);
          c.beginPath(); c.moveTo(len / 2, 6); c.lineTo(len / 2, h - 14); c.stroke();
          c.beginPath(); c.arc(len / 2, (h - 8) / 2, 8, 0, 7); c.stroke();
          const bx = len / 2 + Math.sin(t * .7) * len * .3, by = (h - 8) / 2 + Math.sin(t * 1.3) * 10;
          c.fillStyle = '#fff'; c.beginPath(); c.arc(bx, by, 1.6, 0, 7); c.fill();
          c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(8, 8, 40, 9);
          c.fillStyle = '#fff'; c.font = "700 7px 'Barlow Semi Condensed', sans-serif";
          c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('NAS 2 x 1 DEV', 11, 12.8);
        }
      });
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gc = S(x + w / 2, y + .3, z + h / 2);
      ISO.glow(ctx, gc.x, gc.y, 110, o.meeting ? '#38bdf8' : '#cfe0ff', o.meeting ? .18 : .08);
      ctx.restore();
    },

    /* balcão de café em madeira com tampo de pedra */
    bar(ctx, o) {
      const { x, y, w, d } = o;
      ISO.shadow(ctx, x + w / 2, y + d / 2, 2.3, .3);
      ISO.box(ctx, x, y, w, d, 42, 0, '#4a3322', { top: '#5a3d27' });
      ISO.box(ctx, x - .05, y - .05, w + .1, d + .1, 4, 42, '#bdb6aa', { top: '#d8d2c6' });
      faceY(ctx, x, y + d + .05, w, 40, (c, len) => {
        c.fillStyle = 'rgba(0,0,0,.18)';
        for (let i = 6; i < len; i += 8) c.fillRect(i, 2, 1.4, 36);
      });
      ISO.box(ctx, x + .5, y + .3, .9, .7, 24, 46, '#8d96a3', { top: '#c4ccd6' });
      ISO.box(ctx, x + .55, y + .95, .8, .1, 5, 52, '#1b1f27');
      ISO.cyl(ctx, x + 1.9, y + .6, .16, 24, 46, '#2a2d33');
      ISO.cyl(ctx, x + 1.9, y + .6, .12, 8, 70, '#6b4a33');
      for (let i = 0; i < 4; i++) ISO.cyl(ctx, x + 3.0 + i * .4, y + .55, .08, 7, 46, '#eef1f4');
      ISO.cyl(ctx, x + w - .6, y + .6, .22, 5, 46, '#d8d2c6');
      [['#c0392b', -.06, .02], ['#e8b923', .08, -.04], ['#4f8a3a', .02, .08]].forEach(([cor, dx, dy]) =>
        ISO.cyl(ctx, x + w - .6 + dx, y + .6 + dy, .07, 5, 51, cor));
    },

    /* geladeira de bebidas com porta de vidro */
    vending(ctx, o) {
      const { x, y } = o;
      ISO.shadow(ctx, x + .6, y + .6, .8, .3);
      ISO.box(ctx, x, y, 1.2, 1.1, 92, 0, '#2a2d33', { top: '#3a3e45' });
      faceY(ctx, x + .08, y + 1.1, 1.04, 86, (c, len) => {
        c.fillStyle = 'rgba(210,225,235,.18)'; c.fillRect(0, 0, len, 80);
        const garrafas = ['#2f5f3a', '#c9a227', '#7a1c1c', '#d8dde3', '#2b3b62'];
        for (let r = 0; r < 4; r++) {
          c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(2, 18 + r * 19, len - 4, 1);
          for (let i = 0; i < 6; i++) {
            c.fillStyle = garrafas[(r + i) % garrafas.length];
            c.fillRect(5 + i * (len - 10) / 6, 6 + r * 19, 4, 12);
          }
        }
        c.fillStyle = '#9aa1aa'; c.fillRect(len - 5, 20, 2, 30);
      });
    },

    rack(ctx, o, t) {
      const { x, y } = o;
      const neon = ISO.hsl(o.hue + Math.sin(t * .8 + x) * 8, 90, 55);
      ISO.shadow(ctx, x + .6, y + .5, .78, .3);
      ISO.box(ctx, x, y, 1.2, 1, 86, 0, '#0e1220', { top: '#1a2136' });
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 9; i++) {
        const z = 8 + i * 8.6, on = Math.sin(t * 4 + i * 2.1) > -.2;
        ISO.quad(ctx, [S(x + .1, y + 1, z + 3), S(x + 1.1, y + 1, z + 3),
                       S(x + 1.1, y + 1, z), S(x + .1, y + 1, z)],
                 ISO.rgba(on ? neon : '#1b2540', on ? .62 : .3));
      }
      const g = S(x + .6, y + .5, 50); ISO.glow(ctx, g.x, g.y, 58, neon, .2);
      ctx.restore();
      faceY(ctx, x, y + 1, 1.2, 100, (c, len) => {
        c.textAlign = 'center'; c.font = "700 8px 'Barlow Semi Condensed', sans-serif";
        c.fillStyle = ISO.rgba(neon, .95); c.fillText(o.label, len / 2, 6);
      });
    },

    /* hall dos elevadores: duas cabines com porta de aço escovado, mostrador
       do andar e botoeira. A cabine onde o pessoal chega abre a porta
       (o.abre, de 0 a 1, vem do app.js) quando tem alguém entrando ou saindo */
    elevator(ctx, o, t) {
      const { x, y, d } = o;
      const neon = NASSA.led(t, x + y);
      const andar = String((window.ESCRITORIO && ESCRITORIO.andar) || 18);
      WORLD.wallFace(ctx, 'w', x, y, d, 96, (c, len) => {
        // painel de pedra escura do hall
        c.fillStyle = '#121620'; c.fillRect(0, 2, len, 94);
        c.fillStyle = '#0b0e16'; c.fillRect(0, 2, len, 13);
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.font = "700 7.5px 'Barlow Semi Condensed', sans-serif";
        c.fillStyle = ISO.rgba(neon, .9); c.letterSpacing = '2px';
        c.fillText('ELEVADORES', len / 2, 9);
        c.letterSpacing = '0px';
        const cw = 46, gap = len - 2 * cw - 20;
        const cabines = [10, 10 + cw + gap];
        // a cabine da chegada é a que fica do lado da recepção (u maior)
        cabines.forEach((u0, i) => {
          const abre = i === 1 ? Math.max(0, Math.min(1, o.abre || 0)) : 0;
          // batente
          c.fillStyle = '#3a4252'; c.fillRect(u0 - 3, 25, cw + 6, 71);
          c.fillStyle = '#596274'; c.fillRect(u0 - 3, 25, cw + 6, 2);
          // mostrador do andar
          c.fillStyle = '#05070b'; c.fillRect(u0 + cw / 2 - 11, 16, 22, 8);
          c.font = "700 7px 'JetBrains Mono', 'Consolas', monospace";
          c.fillStyle = ISO.rgba(neon, .95);
          c.fillText((abre > 0 ? '▲' : ' ') + andar, u0 + cw / 2, 20.5);
          // vão da cabine: luz quente lá dentro quando a porta abre
          c.fillStyle = '#05070b'; c.fillRect(u0, 28, cw, 68);
          if (abre > 0) {
            const g = c.createLinearGradient(0, 28, 0, 96);
            g.addColorStop(0, `rgba(255,231,176,${(.55 * abre).toFixed(2)})`);
            g.addColorStop(1, `rgba(255,214,150,${(.25 * abre).toFixed(2)})`);
            c.fillStyle = g; c.fillRect(u0, 28, cw, 68);
          }
          // folhas da porta, correndo para os lados
          const folha = cw / 2 * (1 - abre * .92);
          const aco = (ua, ub) => {
            const g = c.createLinearGradient(ua, 0, ub, 0);
            g.addColorStop(0, '#7b8494'); g.addColorStop(.5, '#bcc4d0'); g.addColorStop(1, '#858e9e');
            c.fillStyle = g; c.fillRect(ua, 28, ub - ua, 68);
            c.fillStyle = 'rgba(255,255,255,.08)';
            for (let k = ua + 3; k < ub - 1; k += 4) c.fillRect(k, 28, 1, 68);
          };
          aco(u0, u0 + folha);
          aco(u0 + cw - folha, u0 + cw);
          c.fillStyle = 'rgba(10,12,18,.55)';
          if (abre < .05) c.fillRect(u0 + cw / 2 - .6, 28, 1.2, 68);
        });
        // botoeira entre as cabines
        const ub = len / 2;
        c.fillStyle = '#2a303d'; ISO.rrect(c, ub - 4, 50, 8, 16, 2); c.fill();
        c.fillStyle = ISO.rgba(neon, .95); c.beginPath(); c.arc(ub, 55, 1.6, 0, 7); c.fill();
        c.fillStyle = '#4a5468'; c.beginPath(); c.arc(ub, 61, 1.6, 0, 7); c.fill();
      });
    },

    reception(ctx, o, t) {
      const { x, y, w, d } = o;
      ISO.shadow(ctx, x + w / 2, y + d / 2, 1.6, .28);
      ISO.box(ctx, x, y, w, d, 40, 0, '#161b2e', { top: '#242c46' });
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ISO.quad(ctx, [S(x, y + d, 40), S(x + w, y + d, 40), S(x + w, y + d, 35), S(x, y + d, 35)],
               ISO.rgba(NASSA.led(t, x), .66));
      ctx.restore();
      faceY(ctx, x, y + d, w, 40, (c, len) => {
        // frente do balcão com o logo
        if (NASSA.pronto(NASSA.logo)) {
          const im = NASSA.logo, k = Math.min((len - 14) / im.naturalWidth, 16 / im.naturalHeight);
          c.drawImage(im, (len - im.naturalWidth * k) / 2, 10, im.naturalWidth * k, im.naturalHeight * k);
        } else {
          c.textAlign = 'center'; c.font = "700 10px 'Barlow', sans-serif";
          c.fillStyle = 'rgba(233,237,248,.85)'; c.letterSpacing = '2px';
          c.fillText('NASSA TECH', len / 2, 18);
        }
      });
      caneca(ctx, x + w - .35, y + .5, 40, 0, .8);
    },

    plant(ctx, o, t) {
      const { x, y } = o;
      ISO.shadow(ctx, x + .5, y + .5, .5, .26);
      ISO.cyl(ctx, x + .5, y + .5, .3, 20, 0, o.k ? '#3a2b22' : '#242b3e');
      const base = S(x + .5, y + .5, 20);
      const nn = o.k ? 7 : 9;
      for (let i = 0; i < nn; i++) {
        const a = (i / nn) * Math.PI * 2 + Math.sin(t * .5 + i) * .07;
        const len = 20 + (i % 3) * 9;
        ctx.strokeStyle = i % 2 ? '#1f7a44' : '#2a9c56';
        ctx.lineWidth = o.k ? 5 : 3.4; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.quadraticCurveTo(base.x + Math.cos(a) * len * .5, base.y - len * .75,
                             base.x + Math.cos(a) * len, base.y - len * .5 - 8);
        ctx.stroke();
      }
    },

    cooler(ctx, o) {
      const { x, y } = o;
      ISO.shadow(ctx, x + .5, y + .5, .5, .26);
      ISO.box(ctx, x + .1, y + .1, .8, .8, 40, 0, '#1a2136', { top: '#252d47' });
      ISO.cyl(ctx, x + .5, y + .5, .3, 32, 40, 'rgba(120,200,255,.42)');
      ISO.cyl(ctx, x + .5, y + .5, .3, 12, 40, 'rgba(60,160,255,.62)');
    },

    trophy(ctx, o, t) {
      const { x, y } = o;
      ISO.shadow(ctx, x + .6, y + .6, .6, .3);
      ISO.box(ctx, x + .15, y + .15, .9, .9, 34, 0, '#1a1622', { top: '#2a2333' });
      ISO.cyl(ctx, x + .6, y + .6, .1, 12, 34, '#c9a227');
      ISO.cyl(ctx, x + .6, y + .6, .26, 20, 46, ISO.rgba('#c4b8ff', .9));
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const p = S(x + .6, y + .6, 68);
      ISO.glow(ctx, p.x, p.y, 40, '#c4b8ff', .3 + .12 * Math.sin(t * 2));
      ctx.restore();
      ISO.cyl(ctx, x + .6, y + .6, .16, 8, 66, '#ffe98a');
    },

    neonSign(ctx, o, t) {
      const { x, y } = o;
      const neon = o.marca ? NASSA.led(t, x) : ISO.hsl((o.hue + t * 30) % 360, 95, 62);
      WORLD.wallFace(ctx, 'n', x, y, 3, 92, (c, len) => {
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.font = "700 17px 'Barlow', sans-serif";
        c.shadowColor = ISO.rgba(neon, .95); c.shadowBlur = 16;
        c.fillStyle = ISO.rgba(neon, .95); c.letterSpacing = '2px';
        c.fillText(o.txt, len / 2, 16);
        c.shadowBlur = 0; c.letterSpacing = '0px';
        c.strokeStyle = ISO.rgba(neon, .35); c.lineWidth = 1;
        c.beginPath(); c.moveTo(14, 32); c.lineTo(len - 14, 32); c.stroke();
      });
    },

    /* poltrona de couro; "face" é para onde quem senta olha */
    poltrona(ctx, o) {
      const { x, y, w, d } = o;
      const c = o.c || '#3b2a1f';
      const f = o.face || 'n';
      if (o.camada !== 'frente') ISO.shadow(ctx, x + w / 2, y + d / 2, Math.max(w, d) * .55, .28);
      const esp = .3, br = .22;
      // pés, assento e depois encosto e braços, do fundo para a frente
      if (o.camada !== 'frente') {
        [[.1, .1], [w - .2, .1], [.1, d - .2], [w - .2, d - .2]]
          .forEach(([px, py]) => ISO.box(ctx, x + px, y + py, .1, .1, 6, 0, '#1a1410'));
        ISO.box(ctx, x + .04, y + .04, w - .08, d - .08, 12, 6, ISO.shade(c, -.1), { top: ISO.shade(c, .12) });
      }
      const enc = f === 'n' ? [x, y + d - esp, w, esp] : f === 's' ? [x, y, w, esp]
                : f === 'e' ? [x, y, esp, d]          : [x + w - esp, y, esp, d];
      const bracos = (f === 'n' || f === 's')
        ? [[x, y, br, d], [x + w - br, y, br, d]]
        : [[x, y, w, br], [x, y + d - br, w, br]];
      const pecas = [[enc[0] + enc[2] / 2 + enc[1] + enc[3] / 2, 'enc', () =>
        ISO.box(ctx, enc[0], enc[1], enc[2], enc[3], 30, 6, c, { top: ISO.shade(c, .18) })]];
      for (const b of bracos) pecas.push([b[0] + b[2] / 2 + b[1] + b[3] / 2, 'braco', () =>
        ISO.box(ctx, b[0], b[1], b[2], b[3], 17, 6, ISO.shade(c, .04), { top: ISO.shade(c, .2) })]);
      // de costas ('n'/'w') o encosto fica entre quem senta e a câmera: ele é
      // pintado numa camada própria, depois do boneco
      const cm = o.camada;
      pecas.sort((a, b) => a[0] - b[0]).forEach(p => {
        if (cm === 'frente' && p[1] !== 'enc') return;
        if (cm === 'base' && p[1] === 'enc') return;
        p[2]();
      });
    },

    /* mesa de xadrez com o tabuleiro montado */
    xadrez(ctx, o) {
      const { x, y, w, d } = o;
      ISO.shadow(ctx, x + w / 2, y + d / 2, .7, .28);
      ISO.cyl(ctx, x + w / 2, y + d / 2, .35, 2, 0, '#2a1b12');
      ISO.cyl(ctx, x + w / 2, y + d / 2, .12, 22, 0, '#2a1b12');
      ISO.box(ctx, x, y, w, d, 3, 22, '#4a3322', { top: '#5a3d27' });
      const n = 8, k = (w - .2) / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++)
        ISO.plane(ctx, x + .1 + i * k, y + .1 + j * k, k, k, 25.1, (i + j) % 2 ? '#2b1d14' : '#e6dcc8');
      const pecas = [[1, 0, '#f2efe8'], [3, 1, '#f2efe8'], [4, 1, '#f2efe8'], [6, 0, '#f2efe8'],
                     [2, 6, '#1a1410'], [4, 6, '#1a1410'], [3, 7, '#1a1410'], [5, 4, '#f2efe8'], [2, 3, '#1a1410']];
      for (const [i, j, cor] of pecas)
        ISO.cyl(ctx, x + .1 + (i + .5) * k, y + .1 + (j + .5) * k, k * .3, 5, 25, cor);
    },

    /* luminária pendente sobre a sinuca, luz quente */
    luminariaSinuca(ctx, o) {
      const { x, y, w, d } = o;
      const z = 120;
      ISO.box(ctx, x + .4, y + d / 2 - .15, w - .8, .3, 6, z, '#1c1d20', { top: '#2a2b2f' });
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const fx of [.25, .5, .75]) {
        const p = S(x + w * fx, y + d / 2, z);
        ISO.glow(ctx, p.x, p.y + 4, 22, '#ffe2a8', .35);
      }
      const pc = S(x + w / 2, y + d / 2, 38);
      ISO.glow(ctx, pc.x, pc.y, 120, '#ffe2a8', .10);
      ctx.restore();
    },

    /* estante de nogueira com livros, troféus e uma miniatura */
    estante(ctx, o) {
      const { x, y, w, d } = o;
      ISO.shadow(ctx, x + w / 2, y + d / 2, 1.3, .3);
      ISO.box(ctx, x, y, w, d, 132, 0, '#3e2a1b', { top: '#5a3d27' });
      // nichos (face virada para a câmera, plano y + d)
      faceY(ctx, x, y + d, w, 132, (c, len) => {
        c.fillStyle = '#1a120c'; c.fillRect(4, 4, len - 8, 124);
        const cores = ['#00b3ff', '#e9edf8', '#2f5bff', '#b8473b', '#1e2633', '#c9a227', '#3d7a52'];
        for (let r = 0; r < 4; r++) {
          const y0 = 6 + r * 31;
          c.fillStyle = '#5a3d27'; c.fillRect(4, y0 + 27, len - 8, 4);
          let xx = 8, i = r * 3;
          while (xx < len - 14) {
            if ((r === 1 && xx > len * .55 && xx < len * .8) || (r === 3 && xx > len * .3 && xx < len * .55)) { xx += 8; continue; }
            const bw = 3 + (i * 7 % 4), bh = 16 + (i * 5 % 9);
            c.fillStyle = cores[i % cores.length];
            c.fillRect(xx, y0 + 27 - bh, bw, bh);
            xx += bw + .8; i++;
          }
        }
        // porta-retrato do carro numa prateleira
        BMW.miniatura(c, len * .54, 6 + 31 + 27, 26);
        // troféu pequeno
        c.fillStyle = '#c9a227'; c.fillRect(len * .36, 6 + 93 + 12, 6, 15);
        c.beginPath(); c.arc(len * .36 + 3, 6 + 93 + 11, 6, Math.PI, 0); c.fill();
      });
    },

    /* luminária de piso com cúpula de tecido, luz quente */
    abajur(ctx, o) {
      const { x, y } = o;
      ISO.shadow(ctx, x + .5, y + .5, .35, .25);
      ISO.cyl(ctx, x + .5, y + .5, .22, 3, 0, '#1c1d20');
      ISO.cyl(ctx, x + .5, y + .5, .035, 78, 3, '#b39a5c');
      ISO.cyl(ctx, x + .5, y + .5, .26, 20, 78, '#e9e1d0');
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const p = S(x + .5, y + .5, 84); ISO.glow(ctx, p.x, p.y, 70, '#ffdca0', .16);
      ctx.restore();
    },

    /* máquina de espresso sobre um gaveteiro */
    cafe(ctx, o, t) {
      const { x, y } = o;
      ISO.shadow(ctx, x + .5, y + .5, .55, .26);
      ISO.box(ctx, x + .05, y + .1, .9, .8, 36, 0, '#2a1d14', { top: '#3a281b' });
      ISO.box(ctx, x + .2, y + .2, .6, .5, 22, 36, '#2a2c31', { top: '#8d96a3' });
      ISO.box(ctx, x + .2, y + .66, .6, .08, 6, 44, '#1b1f27');
      ISO.cyl(ctx, x + .5, y + .76, .08, 6, 38, '#e9edf8');
      void t;
    },

    meetTable(ctx, o, t) {
      const { x, y, w, d } = o;
      ISO.shadow(ctx, x + w / 2, y + d / 2, 3.2, .3);
      ISO.box(ctx, x + w / 2 - .5, y + d / 2 - .4, 1, .8, 24, 0, '#171b2c');
      ISO.box(ctx, x, y, w, d, 4, 24, '#1b2036', { top: '#2b3350' });
      ISO.plane(ctx, x + .25, y + .25, w - .5, d - .5, TOP + .2, 'rgba(120,160,255,.08)');
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ISO.plane(ctx, x + w / 2 - 1.2, y + d / 2 - .5, 2.4, 1, TOP + .3,
                ISO.rgba(NASSA.led(t, x), .16));
      ctx.restore();
      caneca(ctx, x + 1.2, y + d / 2, TOP, 0, .8);
      caneca(ctx, x + w - 1.2, y + d / 2, TOP, 1, .8);
    }
  };

  /* ===========================================================
     PEÇAS REUTILIZADAS
     =========================================================== */

  /** monitor montado em cima da mesa, com pé e braço */
  function monitor(ctx, x, y, w, telaVisivel, busy, neon, t, o) {
    const baseZ = TOP;
    // pé
    ISO.box(ctx, x + w / 2 - .28, y + .02, .56, .3, 3, baseZ, '#12161f', { top: '#1b2130' });
    // haste
    ISO.box(ctx, x + w / 2 - .07, y + .1, .14, .14, 9, baseZ + 3, '#171c28');
    // painel
    const pz = baseZ + 8, ph = 26;
    ISO.box(ctx, x, y, w, .13, ph, pz, '#0b0e17', { top: '#1a2030' });

    faceY(ctx, x + .03, y + .13, w - .06, pz + ph - 2, (c, len) => {
      if (telaVisivel) {
        c.fillStyle = '#04060d'; c.fillRect(0, 0, len, ph - 4);
        if (busy) {
          // linhas de código rolando
          for (let i = 0; i < 6; i++) {
            const ly = 3 + ((i * 3.6 + (t * 9) % 3.6));
            if (ly > ph - 6) continue;
            const lw = (len - 16) * (.25 + .6 * Math.abs(Math.sin(i * 3.7 + Math.floor(t * 2))));
            c.fillStyle = ISO.rgba(i % 3 ? '#8ef0c0' : neon, .62);
            c.fillRect(8, ly, lw, 1.6);
          }
          c.fillStyle = ISO.rgba(neon, .9);
          c.fillRect(8, ph - 8, 3, 1.8);
        } else {
          c.fillStyle = ISO.rgba(neon, .1); c.fillRect(0, 0, len, ph - 4);
          c.textAlign = 'center'; c.textBaseline = 'middle';
          c.font = "700 8px 'Barlow', sans-serif";
          c.fillStyle = ISO.rgba(neon, .5);
          c.fillText('●', len / 2, (ph - 4) / 2);
        }
      } else {
        // costas do monitor: nada de tela acesa
        const g = c.createLinearGradient(0, 0, 0, ph - 4);
        g.addColorStop(0, '#242a38'); g.addColorStop(1, '#161b26');
        c.fillStyle = g; c.fillRect(0, 0, len, ph - 4);
        c.strokeStyle = 'rgba(255,255,255,.05)'; c.lineWidth = 1;
        for (let i = 1; i < 6; i++) {
          c.beginPath(); c.moveTo(i * len / 6, 4); c.lineTo(i * len / 6, ph - 8); c.stroke();
        }
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.font = "700 7px 'Barlow', sans-serif";
        c.fillStyle = 'rgba(190,200,225,.35)';
        c.fillText('●', len / 2, (ph - 4) / 2);
      }
    });

    // brilho fino na moldura de cima
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ISO.quad(ctx, [S(x, y + .13, pz + ph), S(x + w, y + .13, pz + ph),
                   S(x + w, y + .13, pz + ph - 2), S(x, y + .13, pz + ph - 2)],
             ISO.rgba(neon, telaVisivel ? .6 : .3));
    if (telaVisivel && busy) {
      const gc = S(x + w / 2, y + .3, pz + ph / 2);
      ISO.glow(ctx, gc.x, gc.y, 58, neon, .26);
    }
    ctx.restore();
    void o;
  }

  /** monitor com o painel correndo no eixo Y (mesa de lado) */
  function monitorY(ctx, x, y, alt, telaVisivel, busy, neon, t) {
    const cy = y + alt / 2;
    ISO.box(ctx, x + .02, cy - .28, .3, .56, 3, TOP, '#12161f', { top: '#1b2130' });
    ISO.box(ctx, x + .1,  cy - .07, .14, .14, 9, TOP + 3, '#171c28');

    const pz = TOP + 8, ph = 26;
    // painel fino em X, largo em Y: a tela aponta para -x quando face 'e'
    ISO.box(ctx, x, y, .13, alt, ph, pz, '#0b0e17', { top: '#1a2030' });

    // a face que a câmera enxerga é a +x
    const T = ISO.TW;
    const o = ISO.toScreen(x + .13, y, pz + ph - 2);
    ctx.save();
    ctx.transform(-ISO.HW / T, ISO.HH / T, 0, 1, o.x, o.y);
    const len = alt * T;
    if (telaVisivel) {
      ctx.fillStyle = '#04060d'; ctx.fillRect(-len, 0, len, ph - 4);
      if (busy) {
        for (let i = 0; i < 6; i++) {
          const ly = 3 + ((i * 3.6 + (t * 9) % 3.6));
          if (ly > ph - 6) continue;
          const lw = (len - 16) * (.25 + .6 * Math.abs(Math.sin(i * 3.7 + Math.floor(t * 2))));
          ctx.fillStyle = ISO.rgba(i % 3 ? '#8ef0c0' : neon, .62);
          ctx.fillRect(-len + 8, ly, lw, 1.6);
        }
      } else {
        ctx.fillStyle = ISO.rgba(neon, .1); ctx.fillRect(-len, 0, len, ph - 4);
      }
    } else {
      // costas do monitor: chapa escura com respiros, nada de tela acesa
      const g = ctx.createLinearGradient(0, 0, 0, ph - 4);
      g.addColorStop(0, '#242a38'); g.addColorStop(1, '#161b26');
      ctx.fillStyle = g; ctx.fillRect(-len, 0, len, ph - 4);
      ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 1;
      for (let i = 1; i < 6; i++) {
        ctx.beginPath(); ctx.moveTo(-i * len / 6, 4); ctx.lineTo(-i * len / 6, ph - 8); ctx.stroke();
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = "700 7px 'Barlow', sans-serif";
      ctx.fillStyle = 'rgba(190,200,225,.35)';
      ctx.fillText('●', -len / 2, (ph - 4) / 2);
    }
    ctx.restore();

    // luz da tela vazando pelas bordas — dá para ver que está ligado
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ISO.quad(ctx, [S(x + .13, y, pz + ph), S(x + .13, y + alt, pz + ph),
                   S(x + .13, y + alt, pz + ph - 2), S(x + .13, y, pz + ph - 2)],
             ISO.rgba(neon, busy ? .6 : .3));
    if (busy) {
      const gc = S(x - .1, cy, pz + ph / 2);
      ISO.glow(ctx, gc.x, gc.y, 60, neon, .26);
    }
    ctx.restore();
  }

  /** teclado deitado no eixo Y */
  function tecladoY(ctx, x, y, neon) {
    ISO.plane(ctx, x - .06, y - .08, .56, 2.05, TOP + .05, ISO.rgba(neon, .2));
    ISO.box(ctx, x, y, .36, 1.45, 3, TOP, '#141822', { top: '#232a38' });
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ISO.plane(ctx, x + .04, y + .04, .28, 1.37, TOP + 3.2, ISO.rgba(neon, .33));
    ctx.restore();
    ISO.box(ctx, x + .06, y + 1.62, .26, .2, 3.5, TOP, '#1b2130');
  }

  function teclado(ctx, x, y, neon) {
    ISO.plane(ctx, x - .08, y - .06, 2.05, .56, TOP + .05, ISO.rgba(neon, .2));
    ISO.box(ctx, x, y, 1.45, .36, 3, TOP, '#141822', { top: '#232a38' });
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ISO.plane(ctx, x + .04, y + .04, 1.37, .28, TOP + 3.2, ISO.rgba(neon, .33));
    ctx.restore();
    ISO.box(ctx, x + 1.62, y + .06, .2, .26, 3.5, TOP, '#1b2130');
  }

  /** gabinete em cima da mesa, com painel de vidro e RGB */
  function gabinete(ctx, x, y, neon, t) {
    ISO.box(ctx, x, y, .42, .78, 30, TOP, '#11141d', { top: '#1d2431' });
    faceY(ctx, x, y + .78, .42, TOP + 30, (c, len) => {
      c.fillStyle = 'rgba(8,11,20,.9)'; c.fillRect(2, 3, len - 4, 24);
      for (let i = 0; i < 3; i++) {
        c.fillStyle = ISO.rgba(NASSA.led(t * 2, i * 6), .55);
        c.fillRect(4, 6 + i * 7, len - 8, 3.4);
      }
    });
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = S(x + .21, y + .39, TOP + 15);
    ISO.glow(ctx, g.x, g.y, 30, neon, .22);
    ctx.restore();
  }

  /**
   * Cadeira gamer no estilo da Hawker (Westwing) que o usuário mandou:
   * concha com bolsters laterais, encosto alto com "asas", almofadas de
   * cabeça e lombar, braços acolchoados e base estrela de 5 pontas.
   * Centrada no lugar do boneco; encosto do lado oposto ao que ele encara.
   * Assento com topo em z=15, casando com AVATAR.SEAT.
   */
  /**
   * Cadeira gamer, em DUAS camadas.
   *
   * Quando o boneco está de costas para a câmera ('n' e 'w'), a cadeira fica
   * entre ele e nós: aí tudo do assento para cima é pintado DEPOIS dele, e a
   * cadeira tapa de verdade as pernas e as costas. Antes ela era pintada toda
   * antes do boneco e parecia translúcida.
   * Quando ele está de frente ('s' e 'e'), a cadeira inteira vai atrás.
   */
  function cadeiraBase(ctx, o, cor, accent, altEncosto, gamer) {
    // o boneco é desenhado em AVATAR.SCALE, então o assento precisa subir junto
    const ESC     = AVATAR.SCALE;
    const ASSENTO = AVATAR.SEAT * ESC;  // topo do assento = quadril sentado
    const { x, y, w, d } = o;
    const f      = o.face || 'n';
    const camada = o.camada || 'tras';
    const costasNaFrente = (f === 'n' || f === 'w');

    const corD = ISO.shade(cor, -.24);
    const corL = ISO.shade(cor, .14);
    const trim = gamer ? ISO.shade(cor, .19) : ISO.shade(cor, .14);
    const cx = x + w / 2, cy = y + d / 2;
    const eixoX = (f === 'e' || f === 'w');
    const H = altEncosto * ESC;

    /* fatia paralela ao encosto: a0..a1 ao longo da largura,
       esp = espessura, rec = recuo a partir da borda de trás */
    const seg = (a0, a1, esp, rec) =>
      f === 'n' ? [x + w * a0, y + d - rec - esp, w * (a1 - a0), esp]
    : f === 's' ? [x + w * a0, y + rec,           w * (a1 - a0), esp]
    : f === 'e' ? [x + rec,          y + d * a0,  esp, d * (a1 - a0)]
    :             [x + w - rec - esp, y + d * a0, esp, d * (a1 - a0)];
    const bx = (s, h, z, c, opt) => ISO.box(ctx, s[0], s[1], s[2], s[3], h, z, c, opt);

    /* De costas, a cadeira INTEIRA (inclusive a base) vai na frente dele:
       é ela que esconde as pernas e os pés, como aconteceria de verdade.
       Só a sombra fica atrás. De frente, a cadeira inteira fica atrás.    */
    if (camada === 'tras') {
      ISO.shadow(ctx, cx, cy, .68, .28);
      if (costasNaFrente) return;
    } else if (!costasNaFrente) {
      return;
    }

    /* ---------- base estrela de 5 pontas + rodízios ----------
       Cada perna sai do pistão e desce até o rodízio. Antes só havia um
       toco no meio da perna, e os rodízios pareciam copinhos soltos no chão. */
    {
      const pontas = [];
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + .35;
        pontas.push([cx + Math.cos(a) * w * .36, cy + Math.sin(a) * d * .36]);
      }
      pontas.sort((p, q) => (p[0] + p[1]) - (q[0] + q[1]));   // do fundo para a frente
      const centro = S(cx, cy, 5);
      ctx.save();
      ctx.lineCap = 'round';
      for (const [ex, ey] of pontas) {
        const e = S(ex, ey, 3);
        ctx.strokeStyle = '#151922'; ctx.lineWidth = 3.4;
        ctx.beginPath(); ctx.moveTo(centro.x, centro.y); ctx.lineTo(e.x, e.y); ctx.stroke();
        ctx.strokeStyle = 'rgba(150,160,185,.35)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(centro.x, centro.y - 1); ctx.lineTo(e.x, e.y - 1); ctx.stroke();
      }
      ctx.restore();
      for (const [ex, ey] of pontas) ISO.cyl(ctx, ex, ey, .055, 3, 0, '#20242e');
      ISO.cyl(ctx, cx, cy, .13, 4, 3, '#272d3b');
      ISO.cyl(ctx, cx, cy, .075, ASSENTO - 7, 6, '#8e97ab');   // pistão cromado
    }

    /* ---------- assento tipo concha ---------- */
    ISO.box(ctx, x + .1, y + .1, w - .2, d - .2, 5, ASSENTO - 6, cor, { top: corL });
    if (eixoX) {
      ISO.box(ctx, x + .08, y + .04, w - .16, .15, 4, ASSENTO - 2, corD);
      ISO.box(ctx, x + .08, y + d - .19, w - .16, .15, 4, ASSENTO - 2, corD);
    } else {
      ISO.box(ctx, x + .04, y + .08, .15, d - .16, 4, ASSENTO - 2, corD);
      ISO.box(ctx, x + w - .19, y + .08, .15, d - .16, 4, ASSENTO - 2, corD);
    }
    ISO.plane(ctx, x + .24, y + .24, w - .48, d - .48, ASSENTO + .1, ISO.rgba(accent, .16));

    /* ---------- encosto ---------- */
    const estofado = () => {
      const est = seg(.24, .76, .05, .53);
      ISO.box(ctx, est[0], est[1], est[2], est[3], H * .8, ASSENTO + 3, trim);
    };
    const painel = () => {
      if (costasNaFrente) {
        // de costas para a câmera: uma casca só, lisa. As abas, a costura e a
        // plaqueta como caixas soltas pareciam peças desmontadas
        bx(seg(.03, .97, .2, .32), H, ASSENTO, '#101319', { top: corL });
        return;
      }
      bx(seg(.03, .97, .18, .34), H, ASSENTO, cor, { top: corL });
      if (gamer) {
        bx(seg(-.02, .20, .32, .30), H * .74, ASSENTO, corD);
        bx(seg(.80, 1.02, .32, .30), H * .74, ASSENTO, corD);
      }
    };
    /* ---------- braços ----------
       Cada braço é partido onde encontra o encosto: o pedaço de trás entra
       antes do encosto e o da frente depois. Inteiro, ele era pintado por
       cima da casca e parecia atravessar o encosto.                      */
    const br = !gamer ? [] : eixoX
      ? [[x + .1, y + .0, w - .2, .14], [x + .1, y + d - .14, w - .2, .14]]
      : [[x + .0, y + .1, .14, d - .2], [x + w - .14, y + .1, .14, d - .2]];
    const braco = a => {
      ISO.box(ctx, a[0], a[1], a[2], a[3], 6, ASSENTO, '#1d2230');
      ISO.box(ctx, a[0] - .02, a[1] - .02, a[2] + .04, a[3] + .04, 3, ASSENTO + 6, corD, { top: corL });
    };
    // face da frente do que o braço atravessa: a casca (n/w) ou as abas (s/e)
    const corte = f === 'n' ? y + d - .32 : f === 'w' ? x + w - .32 : f === 's' ? y + .62 : x + .62;
    const tras = [], frente = [];
    for (const a of br) {
      if (eixoX) { tras.push([a[0], a[1], corte - a[0], a[3]]); frente.push([corte, a[1], a[0] + a[2] - corte, a[3]]); }
      else       { tras.push([a[0], a[1], a[2], corte - a[1]]); frente.push([a[0], corte, a[2], a[1] + a[3] - corte]); }
    }

    tras.forEach(braco);
    if (costasNaFrente) painel();
    else              { painel(); estofado(); }

    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const tp = seg(.03, .97, .18, .34);
    ISO.plane(ctx, tp[0], tp[1], tp[2], tp[3], ASSENTO + H, ISO.rgba(accent, .34));
    ctx.restore();

    frente.forEach(braco);
  }

  function dispenser(ctx, cx, cy, color, t) {
    ISO.cyl(ctx, cx, cy, .22, 8, 46, '#cfd6e8');
    ISO.cyl(ctx, cx, cy, .26, 34, 54, 'rgba(190,215,255,.22)');
    ISO.cyl(ctx, cx, cy, .23, 22 + Math.sin(t * 1.5) * 1.6, 54, ISO.rgba(color, .82));
    ISO.cyl(ctx, cx, cy, .2, 8, 88, '#e5ebf7');
    ISO.cyl(ctx, cx, cy, .1, 9, 96, '#e5ebf7');
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const p = S(cx, cy, 70); ISO.glow(ctx, p.x, p.y, 40, color, .22);
    ctx.restore();
  }

  /* ---------- extensões ----------
     Os arquivos js/decor-*.js (carregados depois deste e antes do app.js)
     acrescentam móveis sem mexer aqui: registram o desenho de um tipo novo
     com registrar() e põem as peças no andar com add() e block().       */
  function registrar(desenhos, alturasCache) {
    Object.assign(DRAW, desenhos);
    if (alturasCache) Object.assign(ALTURA_CACHE, alturasCache);
  }
  /** tira do andar as peças que casam com o filtro (e devolve quantas) */
  function remover(filtro) {
    let n = 0;
    for (let i = items.length - 1; i >= 0; i--) if (filtro(items[i])) { items.splice(i, 1); n++; }
    return n;
  }

  return { items, workSlots, restSlots, meetSlots, drawItem, depth, caneca, TOP,
           add, block, cadeira, emCamadas, naParede, registrar, remover,
           faceY, monitor, monitorY, teclado, tecladoY, gabinete, desenho: DRAW };
})();
