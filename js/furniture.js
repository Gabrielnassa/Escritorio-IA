/* ===========================================================
   furniture.js — móveis, estações de trabalho e pontos de lazer

   Convenção de altura (px acima do piso):
     0 .. 25   estrutura da mesa
     28        tampo  (tudo que fica "em cima da mesa" nasce aqui)
     28 .. 62  monitor
     ≈ 21      assento da cadeira  (AVATAR.SEAT × AVATAR.SCALE: o quadril sentado)
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
    // par: as duas camadas saem sempre no mesmo nível do cache (ver emCache)
    const comum = { x: seat.x - L / 2, y: seat.y - L / 2, w: L, d: L,
                    face: seat.facing, hue: hue || 200, par: {} };
    // o boneco é desenhado em (seat.x + seat.y + 0.5). De costas ('n'/'w')
    // a camada de trás já tem base e assento: ela entra logo antes dele,
    // senão a mesa de reunião (chave no centro dela) pintava por cima
    const costas = seat.facing === 'n' || seat.facing === 'w';
    add(Object.assign({ t: tipo, camada: 'tras',   dk: seat.x + seat.y + (costas ? 0.48 : -0.25) }, comum));
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
                         face: r.face, busy: false, hue, var: n });   // var: o que cada um deixa na mesa
      block(x, deskY, 3, 1.3);
      cadeira(seat, 'chairGamer', hue);
      workSlots.push({ id, room: 'servico', label: 'estação ' + id,
                       x: seat.x, y: seat.y, facing: seat.facing, obj: mesa });
    }
  }


  /* ---------- SALA DO CHEFE ----------
     Mesa do Gabriel de frente para a porta, com o quadro da BMW na
     parede ripada atrás dele, e as duas poltronas de visita de couro
     caramelo viradas para ela. O resto da sala (camisa do Palmeiras,
     aparador com a bola de basquete, estante, tapetes e o estar com
     sofá) fica em js/decor-chefe.js.                                  */
  const seatA = { x: 7.5, y: 4.0,  facing: 's' };
  const mesaA = add({ t: 'deskBoss', id: 'DIR-1', x: 5.4, y: 4.7, w: 4.2, d: 1.6,
                      face: 's', busy: false, hue: 198, controle: true });
  block(5.4, 4.7, 4.2, 1.6);
  cadeira(seatA, 'chairBoss');
  workSlots.push({ id: 'DIR-1', room: 'diretoria', label: 'mesa do chefe',
                   x: seatA.x, y: seatA.y, facing: 's', obj: mesaA, vip: true });

  [6.5, 8.5].forEach(x => { add({ t: 'poltrona', x: x - .6, y: 7.3, w: 1.2, d: 1.2, face: 'n', c: '#6a4229' });
                            block(x - .6, 7.3, 1.2, 1.2); });

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
  const sofaL = emCamadas({ t: 'sofa', x: 18.6, y: 26.4, w: 4.6, d: 1.6, dir: 's', c: '#2b1d16', manta: true }, 3);
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

  add({ t: 'vending', x: 26.6, y: 23.2, w: 1.2, d: 1.1 });    block(26.6, 23.2, 1.2, 1.2);
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

  // a porta da sala fica em x 35..36 (world.js): o telão não fica mais no caminho.
  // Ele mostra a agenda, a pauta e quem fala (ver TELÃO DA SALA DE REUNIÃO)
  naParede({ t: 'tvWall', x: 37.4, y: 23.15, w: 4.8, d: 0.5, meeting: true });
  block(37.4, 23.15, 4.8, .75);
  add({ t: 'plant', x: 33.4, y: 31.2, k: 0 });               block(33.4, 31.2, 1, 1);

  /* ---------- CORREDOR / RECEPÇÃO ---------- */
  // as portas ficam no plano da parede leste: entram depois das paredes
  // (x 47, y 19..21) para o parapeito de vidro não passar na frente delas
  add({ t: 'elevator',  x: 46, y: 19.2, w: 1, d: 2, dk: 69.5 });
  add({ t: 'reception', x: 42.6, y: 19, w: 2.6, d: 1 }); block(42.6, 19, 2.6, 1);
  add({ t: 'plant', x: 32.4, y: 19, k: 0 }); block(32.4, 19, 1, 1);
  // longe da placa da porta da reunião (x 35), que sai da parede em y 21,4
  add({ t: 'plant', x: 32.25, y: 21, k: 1 }); block(32.25, 21, 1, 1);

  add({ t: 'rack', x: 8.4,  y: 19, label: 'API',     w: 1.2, d: 1 }); block(8.4, 19, 1.2, 1);
  add({ t: 'rack', x: 10.0, y: 19, label: 'AGENTES', w: 1.2, d: 1 }); block(10.0, 19, 1.2, 1);
  add({ t: 'rack', x: 11.6, y: 19, label: 'DB',      w: 1.2, d: 1 }); block(11.6, 19, 1.2, 1);

  [2.2, 17.4, 27.4].forEach((x, i) => { add({ t: 'plant', x, y: 19, k: i % 2 }); block(x, 19, 1, 1); });
  add({ t: 'neonSign', x: 20.4, y: 19, txt: String((window.ESCRITORIO && ESCRITORIO.nome) || 'NASSA TECH').toUpperCase().slice(0, 16), hue: 190, marca: true });

  /* ===========================================================
     DESENHO
     =========================================================== */
  /** pinta sub-peças de um móvel do fundo para a frente (menor y primeiro) */
  function emOrdem(pecas) {
    pecas.sort((a, b) => a[0] - b[0]).forEach(p => p[1]());
  }

  /* Peças que nunca mudam (as cadeiras, o expositor…) são pintadas uma vez
     num canvas próprio e depois só copiadas. O que tem animação — arcade,
     TV, os LEDs do rack — continua sendo desenhado ao vivo.
     Eram canvases em 2x fixo, que nunca saíam da memória: borrados na tela
     3x do celular e 15 MB parados na visão geral. Agora passam pelo cache
     em níveis (emCache, mais abaixo), com a caixa larga de sempre: a
     resolução acompanha o zoom e o nível sem uso é descartado.         */
  const ALTURA_CACHE = {
    chairGamer: 48, chairBoss: 68, chairSimple: 54, chairGuest: 54, expositor: 96,
    pilhaCaixas: 118, lowTable: 40, cooler: 64
  };
  /* poltrona, xadrez, sinuca, pebolim, sofá e os móveis das salas chamam o
     emCache direto, com a caixa justa: em 2x, com a margem fixa daqui, eles
     somavam quase 2 Mpx de canvas — e, passando do orçamento de textura do
     Chromium, o quadro inteiro da visão geral ficava duas vezes mais lento. */
  const opMovel = new Map();      // peça -> opções do emCache, ou null (grande demais)
  function opcoesMovel(o) {
    const w = o.w || 1, d = o.d || 1;
    const alto = ALTURA_CACHE[o.t] || 120;
    const x0 = ISO.toScreen(o.x, o.y + d).x - 22;
    const x1 = ISO.toScreen(o.x + w, o.y).x + 22;
    const y0 = ISO.toScreen(o.x, o.y).y - alto;
    const y1 = ISO.toScreen(o.x + w, o.y + d).y + 26;
    if (x1 <= x0 || y1 <= y0 || (x1 - x0) * (y1 - y0) > 3e5) return null;
    return { caixa: [x0, y0, x1, y1], par: o.par };
  }

  function drawItem(ctx, o, t) {
    const f = DRAW[o.t];
    if (!f) return;
    if (!(o.t in ALTURA_CACHE)) { f(ctx, o, t); return; }
    let op = opMovel.get(o);
    if (op === undefined) { op = opcoesMovel(o); opMovel.set(o, op); }
    if (!op) { f(ctx, o, t); return; }
    emCache(ctx, o, f, op);
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

    /* ================= ESTAÇÃO DOS DEVS =================
       Mesa regulável de tampo de carvalho claro e pés em T de aço grafite,
       com calha de cabos; dois monitores num braço articulado, notebook no
       suporte, teclado e mouse no feltro e as coisas de quem usa a mesa.
       Tudo isso é fixo e vai para o cache em níveis; ao vivo ficam o conteúdo
       das telas e a luz delas, e só quando há alguém trabalhando.
       A mesa corre no eixo X: quem senta fica ao sul ('n', de costas para
       nós, telas à vista) ou ao norte ('s', de frente, telas de costas). */
    deskGamer(ctx, o, t) {
      emCache(ctx, o, mesaDevBase, { alto: 62 });
      if (o.busy) telasDev(ctx, o, t);
    },

    /* ================= MESA DA DIRETORIA =================
       Mesa executiva de nogueira: tampo grosso com filete de latão, uma
       lâmina de madeira de cada lado e o painel da frente recuado. Em cima,
       do lado do Gabriel: mata-borrão de couro com o notebook, o monitor
       num braço articulado preso na borda da frente, caderno, luminária de
       mesa, café e um vasinho. Sem gabinete gamer nem fita de LED: como
       nada nela se mexe, a mesa vai para o cache (a altura é registrada em
       decor-chefe.js). A plaquinha com o nome é peça à parte, ao vivo,
       porque o texto depende da fonte já ter carregado.                  */
    deskBoss(ctx, o) {
      const { x, y, w, d } = o;
      const NOG = '#5b3a23', NOG_TOPO = '#73492b', NOG_ESC = '#3d2616';
      const LATAO = '#c2a35e', GRAFITE = '#2c2f35';

      ISO.shadow(ctx, x + w / 2, y + d / 2 + .1, 2.3, .22);
      ISO.plane(ctx, x + .02, y + .1, w + .06, d + .02, .3, 'rgba(0,0,0,.22)');

      // base: lâminas nas pontas e o painel da frente recuado, que esconde
      // as pernas de quem senta
      ISO.box(ctx, x + .1, y + .12, .16, d - .24, 24, 0, NOG, { top: NOG_TOPO });
      ISO.box(ctx, x + .26, y + d - .46, w - .52, .07, 6, 0, '#17100b');
      ISO.box(ctx, x + .26, y + d - .46, w - .52, .07, 17, 6, NOG_ESC);
      ISO.box(ctx, x + w - .26, y + .12, .16, d - .24, 24, 0, NOG, { top: NOG_TOPO });

      // tampo de 4 px com veio, e o filete de latão na borda
      ISO.box(ctx, x - .06, y - .06, w + .12, d + .12, 4, 24, NOG,
              { top: NOG_TOPO, left: '#4c301d', right: '#3a2517' });
      for (let i = 0; i < 8; i++)
        ISO.plane(ctx, x - .06, y - .02 + i * .2 + (i % 3) * .03, w + .12, .018, TOP + .05, 'rgba(40,20,8,.2)');
      ISO.plane(ctx, x + .5, y + .2, w - 1, d - .5, TOP + .06, 'rgba(255,230,200,.035)');
      ISO.quad(ctx, [S(x - .06, y + d + .06, 26.3), S(x + w + .06, y + d + .06, 26.3),
                     S(x + w + .06, y + d + .06, 25.5), S(x - .06, y + d + .06, 25.5)], LATAO);
      ISO.quad(ctx, [S(x + w + .06, y - .06, 26.3), S(x + w + .06, y + d + .06, 26.3),
                     S(x + w + .06, y + d + .06, 25.5), S(x + w + .06, y - .06, 25.5)], ISO.shade(LATAO, -.3));

      // poça de luz da luminária no tampo
      {
        const p = S(x + 3.2, y + .8, TOP + .1);
        ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, .5);
        const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 30);
        g.addColorStop(0, 'rgba(255,222,165,.24)'); g.addColorStop(1, 'rgba(255,222,165,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 30, 0, 7); ctx.fill();
        ctx.restore();
      }

      // mata-borrão de couro preto com pesponto
      ISO.box(ctx, x + 1.22, y + .14, 1.76, .76, 1, TOP, '#18181b', { top: '#222226' });
      ISO.plane(ctx, x + 1.28, y + .2, 1.64, .64, TOP + 1.05, null, 'rgba(255,255,255,.07)');

      const pecas = [];
      /* monitor num braço: a tela é dele, nós vemos as costas de alumínio */
      pecas.push([x + .98 + y + .64, () => {
        const mx = x + .38, my = y + .6, mw = 1.22;
        ISO.box(ctx, mx, my, mw, .08, 24, 38, '#2b2e33', { top: '#4a4f57', left: '#a8aeb6', right: '#80868e' });
        faceY(ctx, mx, my + .08, mw, 62, (c, len) => {
          const g = c.createLinearGradient(0, 0, 0, 24);
          g.addColorStop(0, '#c2c7ce'); g.addColorStop(1, '#959ba3');
          c.fillStyle = g; c.fillRect(0, 0, len, 24);
          c.fillStyle = 'rgba(0,0,0,.16)'; c.fillRect(len / 2 - 9, 7, 18, 10);
          c.fillStyle = '#7d838b'; c.fillRect(len / 2 - 7, 8, 14, 8);
        });
      }]);
      pecas.push([x + .99 + y + 1.3, () => {
        // coluna presa na borda da frente, e os dois braços até as costas do monitor
        const px = x + .99, py = y + 1.42;
        ISO.box(ctx, px - .08, py - .14, .16, .38, 1.5, TOP, '#1e2024');
        ISO.box(ctx, px - .08, y + d - .04, .16, .1, 7, 21.5, '#1e2024');
        ISO.cyl(ctx, px, py, .045, 22, TOP + 1.5, GRAFITE);
        const a = S(px, py, 51), b = S(px, y + 1.08, 55), m = S(px, y + .68, 51);
        ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.strokeStyle = GRAFITE; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(m.x, m.y); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = .7;
        ctx.beginPath(); ctx.moveTo(a.x, a.y - .8); ctx.lineTo(b.x, b.y - .8); ctx.lineTo(m.x, m.y - .8); ctx.stroke();
        ctx.fillStyle = '#1e2024';
        for (const q of [a, b]) { ctx.beginPath(); ctx.arc(q.x, q.y, 1.7, 0, 7); ctx.fill(); }
        ctx.restore();
      }]);
      /* notebook aberto para ele: daqui só aparece a tampa de alumínio */
      pecas.push([x + 2.1 + y + .5, () => {
        const lx = x + 1.63, ly = y + .26, lw = .94;
        ISO.box(ctx, lx, ly, lw, .48, 1.2, TOP + 1, '#8f959d', { top: '#b4bac2' });
        ISO.plane(ctx, lx + .05, ly + .04, lw - .1, .3, TOP + 2.25, '#2a2d33');
        const t0 = S(lx, ly + .6, 45), t1 = S(lx + lw, ly + .6, 45);
        const b1 = S(lx + lw, ly + .48, TOP + 2.2), b0 = S(lx, ly + .48, TOP + 2.2);
        const g = ctx.createLinearGradient(0, t0.y, 0, b0.y);
        g.addColorStop(0, '#cfd3d9'); g.addColorStop(1, '#9ca2aa');
        ISO.quad(ctx, [t0, t1, b1, b0], g, 'rgba(0,0,0,.25)');
        ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = .8;
        ctx.beginPath(); ctx.moveTo(t0.x, t0.y + .5); ctx.lineTo(t1.x, t1.y + .5); ctx.stroke();
        const c = S(lx + lw / 2, ly + .55, 38);
        ctx.fillStyle = '#00b3ff'; ctx.beginPath(); ctx.ellipse(c.x, c.y, 1.7, 1.7, 0, 0, 7); ctx.fill();
      }]);
      /* caderno de couro com elástico e a caneta ao lado */
      pecas.push([x + 2.75 + y + .45, () => {
        ISO.box(ctx, x + 2.6, y + .24, .32, .44, 1.6, TOP + 1, '#2a2522', { top: '#36302b' });
        ISO.plane(ctx, x + 2.83, y + .24, .035, .44, TOP + 2.65, '#8a5a34');
        const p0 = S(x + 2.6, y + .8, TOP + 1.6), p1 = S(x + 2.93, y + .76, TOP + 1.6);
        ctx.save(); ctx.lineCap = 'round';
        ctx.strokeStyle = '#1b1c20'; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
        ctx.strokeStyle = LATAO; ctx.lineWidth = .7;
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y - .3); ctx.lineTo(p0.x + (p1.x - p0.x) * .2, p0.y - .3 + (p1.y - p0.y) * .2); ctx.stroke();
        ctx.restore();
      }]);
      /* luminária de mesa: preta e latão, com a cúpula virada para o tampo */
      pecas.push([x + 3.75 + y + .3, () => {
        const bx = x + 3.75, by = y + .3;
        ISO.cyl(ctx, bx, by, .13, 2.2, TOP, '#1c1d20');
        const j0 = S(bx, by, TOP + 2.2), j1 = S(bx - .08, by + .1, 58), h = S(x + 3.3, y + .66, 51);
        ctx.save(); ctx.lineCap = 'round';
        ctx.strokeStyle = '#b39a5c'; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(j0.x, j0.y); ctx.lineTo(j1.x, j1.y); ctx.lineTo(h.x + 2.4, h.y - 2); ctx.stroke();
        ctx.fillStyle = '#1c1d20'; ctx.beginPath(); ctx.arc(j1.x, j1.y, 1.7, 0, 7); ctx.fill();
        // cúpula: domo preto e a boca acesa por baixo
        ctx.fillStyle = '#1c1d20';
        ctx.beginPath(); ctx.ellipse(h.x, h.y, 6.2, 4.8, 0, Math.PI, 0); ctx.lineTo(h.x + 6.2, h.y + .7);
        ctx.ellipse(h.x, h.y + .7, 6.2, 1.9, 0, 0, Math.PI); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.16)';
        ctx.beginPath(); ctx.ellipse(h.x - 1.9, h.y - 2.8, 2.3, 1.1, -.3, 0, 7); ctx.fill();
        ctx.fillStyle = '#ffe3ae';
        ctx.beginPath(); ctx.ellipse(h.x, h.y + .8, 5.1, 1.35, 0, 0, 7); ctx.fill();
        ctx.restore();
      }]);
      /* espresso no pires, do lado direito */
      pecas.push([x + 3.72 + y + 1.15, () => {
        const cx = x + 3.72, cy = y + 1.15;
        ISO.cyl(ctx, cx, cy, .11, 1, TOP, '#e4e0d8');
        ISO.cyl(ctx, cx, cy, .062, 4.4, TOP + 1, '#f5f3ee');
        const p = S(cx, cy, TOP + 5.4);
        ctx.fillStyle = '#3b2418'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 2.6, 1.3, 0, 0, 7); ctx.fill();
        const a = S(cx + .09, cy, TOP + 3.6);
        ctx.strokeStyle = '#f5f3ee'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(a.x + 1, a.y, 1.5, -1.3, 1.3); ctx.stroke();
      }]);
      /* vasinho de concreto com uma suculenta, na ponta esquerda */
      pecas.push([x + .32 + y + 1.25, () => {
        const cx = x + .32, cy = y + 1.25;
        ISO.cyl(ctx, cx, cy, .1, 5.5, TOP, '#9b988f');
        const p = S(cx, cy, TOP + 5.5);
        [['#5f7f4c', -2.6, -1.2], ['#7a9a62', 2.4, -1.4], ['#6c8c57', 0, -3], ['#86a56c', -.8, -1.6]].forEach(([cor, dx, dy]) => {
          ctx.fillStyle = cor; ctx.beginPath(); ctx.ellipse(p.x + dx, p.y + dy, 2.4, 1.5, dx * .2, 0, 7); ctx.fill();
        });
      }]);
      emOrdem(pecas);
    },

    /* ================= CADEIRAS =================
       Os nomes ficaram da época das cadeiras gamer; o desenho de cada
       modelo está em cadeiraBase(), mais abaixo.                        */
    chairGamer(ctx, o)  { cadeiraBase(ctx, o, MODELOS.tela, ISO.hsl(o.hue || 198, 85, 56)); },
    chairBoss(ctx, o)   { cadeiraBase(ctx, o, MODELOS.executiva, NASSA.COR.ciano); },
    chairGuest(ctx, o)  { cadeiraBase(ctx, o, MODELOS.conferencia, NASSA.COR.ciano); },
    chairSimple(ctx, o) { cadeiraBase(ctx, o, MODELOS.conferencia, NASSA.COR.ciano); },

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

    /* sinuca: nogueira, feltro verde, caçapas de couro com cantoneira de
       latão, marcadores de madrepérola no trilho, o triângulo e um taco */
    poolTable(ctx, o) { emCache(ctx, o, pintaSinuca, { alto: 46, margem: 10 }); },

    /* pebolim de design: caixa de nogueira, campo verde-musgo, varões
       cromados com manopla preta e jogadores creme e grafite           */
    foosball(ctx, o) { emCache(ctx, o, pintaPebolim, { alto: 50, margem: 16 }); },

    /* sofá. A peça do layout vai para o cache em níveis: a base num, o
       encosto noutro, que cada fatia (ver emCamadas) copia na sua faixa
       da tela — uma caixa só, sem a costura que aparecia entre as fatias.
       Quem usa este desenho dentro de uma peça que já tem cache (o
       sofaChefe, a espera da recepção) recebe só a pintura.             */
    sofa(ctx, o) {
      if (o.t !== 'sofa') { pintaSofa(ctx, o); return; }
      const op = { alto: 54, margem: 6, chave: 'sofa|' + o.x + '|' + o.y + '|' + (o.camada || 'tudo') };
      if (o.camada === 'frente' && o.fatia) {
        const [a0, a1] = o.fatia, ym = o.y + o.d - .21;
        op.faixa = [a0 <= 0 ? -Infinity : S(o.x + o.w * a0, ym).x, a1 >= 1 ? Infinity : S(o.x + o.w * a1, ym).x];
      }
      emCache(ctx, o, (g, oo) => {
        const inteiro = Object.assign({}, oo, { fatia: null });
        pintaSofa(g, inteiro);
        if (oo.manta && oo.camada !== 'base') mantaSofa(g, inteiro);
      }, op);
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

    /* tapete de lã: barra mais escura, campo e um filete claro. São três
       planos: ao vivo sai mais barato que um cache do tamanho dele.    */
    rug(ctx, o) {
      const { x, y, w, d } = o;
      const c = o.c || '#2a2240';
      ISO.plane(ctx, x, y, w, d, 0.6, ISO.rgba(ISO.shade(c, -.22), .9));
      ISO.plane(ctx, x + .2, y + .2, w - .4, d - .4, 0.7, ISO.rgba(c, .94));
      ISO.plane(ctx, x + .34, y + .34, w - .68, d - .68, 0.75, null, 'rgba(255,240,220,.08)');
    },

    tvWall(ctx, o, t) {
      // o da sala de reunião mostra a reunião de verdade e vai para o
      // cache em níveis (ver TELÃO DA SALA DE REUNIÃO, mais abaixo)
      if (o.meeting) { telaoReuniao(ctx, o, t); return; }
      // uma tira (ver naParede): desenha o telão inteiro recortado na faixa
      // vertical dela, com as bordas no pixel inteiro para não sobrar costura
      if (o.fatia) {
        const [L, R] = recorteTira(ctx, o);
        ctx.save();
        ctx.beginPath(); ctx.rect(L, -1e5, R - L, 2e5); ctx.clip();
        DRAW.tvWall(ctx, Object.assign({}, o, { fatia: null }), t);
        ctx.restore();
        return;
      }
      const { x, y, w } = o;
      const h = 62, z = 46;
      corpoTelao(ctx, o, z, true);
      // videogame e a caixinha de som no rack
      ISO.box(ctx, x + 1.1, y + .2, .55, .32, 3.2, 19, '#e9eaec', { top: '#f4f5f6', line: 'rgba(0,0,0,.2)' });
      ISO.box(ctx, x + w - 1.5, y + .22, .3, .26, 6, 19, '#2b2e34', { top: '#3a3e45' });
      ISO.box(ctx, x, y, w, .22, h, z, '#0a0c14');
      faceY(ctx, x + .02, y + .22, w - .04, z + h - 4, (c, len) => {
        c.fillStyle = '#05070f'; c.fillRect(0, 0, len, h - 8);
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
      });
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gc = S(x + w / 2, y + .3, z + h / 2);
      ISO.glow(ctx, gc.x, gc.y, 110, '#cfe0ff', .08);
      ctx.restore();
    },

    /* balcão de café em madeira com tampo de pedra; geladeira de bebidas
       com porta de vidro. Parados: vão para o cache em níveis.          */
    bar(ctx, o) { emCache(ctx, o, pintaBar, { alto: 76, margem: 6 }); },
    vending(ctx, o) { emCache(ctx, o, pintaGeladeira, { alto: 92, margem: 4 }); },

    /* gabinete de servidor: porta de chapa perfurada grafite, a placa com
       o nome no alto e a coluna de LEDs de status. O corpo vai para o
       cache; ao vivo ficam só os LEDs, piscando devagar.               */
    rack(ctx, o, t) {
      emCache(ctx, o, pintaRack, { alto: 90, margem: 4, ver: fonteCarregada });
      const { x, y } = o;
      faceY(ctx, x + .08, y + o.d, o.w - .16, 78, (c, len) => {
        for (let i = 0; i < 6; i++) {
          const k = Math.sin(t * (.9 + i * .17) + x * 3 + i * 1.7);
          c.fillStyle = k > .55 ? (i % 3 === 2 ? '#f2b84b' : '#3fd28a') : k > -.2 ? 'rgba(63,210,138,.55)' : 'rgba(0,179,255,.5)';
          c.fillRect(len - 6, 4 + i * 6.5, 2.2, 1.6);
        }
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

    /* balcão da recepção: frente ripada de carvalho com a faixa grafite do
       logo, tampo de quartzo um pouco acima do balcão de trabalho (só a
       traseira do monitor aparece por cima dele), orquídea e o tablet de
       check-in dos visitantes. Parado: vai para o cache (repinta quando o
       logo termina de carregar).                                        */
    reception(ctx, o) {
      emCache(ctx, o, balcaoRecepcao, { alto: 58, margem: 8, ver: () => NASSA.pronto(NASSA.logo) ? 1 : 0 });
    },

    /* planta em vaso de cerâmica fosca: k 1 é a seringueira (folhas largas),
       k 0 a espada-de-são-jorge. Parada: vai para o cache em níveis.   */
    plant(ctx, o) { emCache(ctx, o, pintaPlanta, { alto: 70, margem: 24 }); },

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

    /* poltrona de couro; "face" é para onde quem senta olha. Cada camada
       (ver emCamadas) tem o seu cache em níveis.                       */
    poltrona(ctx, o) { emCache(ctx, o, pintaPoltrona, { alto: 50, margem: 6 }); },

    /* mesa de xadrez com o tabuleiro montado e o relógio de partida */
    xadrez(ctx, o) { emCache(ctx, o, pintaXadrez, { alto: 40, margem: 6 }); },

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

    /* estante de nogueira com livros, troféu, a miniatura da BMW e um
       vaso. Parada: cache em níveis (repinta quando a foto carrega).    */
    estante(ctx, o) { emCache(ctx, o, pintaEstante, { alto: 136, margem: 4, ver: () => BMW.pronto ? 1 : 0 }); },

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

    /* ================= MESA DE REUNIÃO =================
       Tampo de nogueira com cantos arredondados e borda fina, sobre dois
       pés de chapa grafite; no eixo, as duas caixas de tomada de alumínio
       e o viva-voz de conferência no meio. Em cada lugar, o que a pessoa
       deixou na mesa: bloco e caneta, copo d'água, um notebook fechado.
       Nada mexe: vai para o cache em níveis.                            */
    meetTable(ctx, o) {
      emCache(ctx, o, mesaReuniao, { alto: 34, margem: 6 });
    }
  };

  /* ===========================================================
     TELÃO DE PAREDE — o pedestal, comum ao lounge e à reunião
     =========================================================== */
  /** bordas da tira (ver naParede) na tela, no pixel inteiro: [L, R] */
  function recorteTira(ctx, o) {
    const m = ctx.getTransform(), snap = v => (Math.round(v * m.a + m.e) - m.e) / m.a;
    const [a, b] = o.fatia, yc = o.y + .4;
    return [a <= o.x + 1e-6 ? -1e5 : snap(S(a, yc).x),
            b >= o.x + o.w - 1e-6 ? 1e5 : snap(S(b, yc).x)];
  }

  /** duas colunas finas até a base da tela (z) e o rack baixo na frente —
      de nogueira ripada no lounge, grafite na sala de reunião */
  function corpoTelao(ctx, o, z, madeira) {
    const { x, y, w } = o;
    ISO.shadow(ctx, x + w / 2, y + .5, w * .4, .22);
    for (const px of [.7, w - .85]) ISO.box(ctx, x + px, y + .1, .12, .12, z, 0, '#2a2d33');
    const [cT, cE, cD] = madeira ? ['#5e3a22', '#4f3320', '#3d2616'] : ['#2c2f35', '#1f2126', '#191b1f'];
    ISO.box(ctx, x + .34, y + .1, w - .68, .5, 2, 0, '#141518', { line: 'rgba(0,0,0,.3)' });
    ISO.box(ctx, x + .3, y + .05, w - .6, .55, 17, 2, cE, { top: cT, left: cE, right: cD, line: 'rgba(0,0,0,.35)' });
    faceY(ctx, x + .3, y + .6, w - .6, 19, (c, len) => {
      const n = 4, pw = len / n;
      for (let i = 0; i < n; i++) {
        c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(i * pw, 0, .8, 17);
        if (madeira) for (let k = 2.5; k < pw - 1; k += 2.6) {
          c.fillStyle = 'rgba(20,10,4,.3)'; c.fillRect(i * pw + k, 1.5, .6, 14);
        }
      }
      c.fillStyle = madeira ? 'rgba(255,220,180,.07)' : 'rgba(255,255,255,.05)'; c.fillRect(0, 0, len, .8);
    });
  }

  /* ===========================================================
     TELÃO DA SALA DE REUNIÃO
     Mostra a reunião dos agentes (js/reuniao.js), e não um enfeite:
     · antes: o dia, a hora e quanto falta, a pauta e quem senta à mesa;
     · durante: quem está falando, a rodada, o tempo corrido e a última fala;
     · depois: o começo do briefing, por algumas horas.
     A agenda vem do servidor (/api/reuniao) quando ele responde; senão de
     ESCRITORIO.reuniao; no GitHub Pages, sem nenhum dos dois, do padrão de
     data/config.exemplo.json (segunda e sexta, 11:00).
     É uma superfície grande: corpo e tela vão juntos para o cache em
     níveis (cada tira copia a sua fatia), e o conteúdo é remontado no
     máximo duas vezes por segundo — o cache só é repintado quando o texto
     muda, ou seja, quando o relógio vira o minuto ou a reunião anda. Ao
     vivo ficam só a luz da tela na sala e o ponto vermelho de "ao vivo".
     =========================================================== */
  const TV_Z = 42, TV_H = 66;      // tela de 46 a 104 px: quem senta na frente fica abaixo do conteúdo
  const DIA_TV  = ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'];
  const DIA_API = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const PAUTA_PADRAO = 'o que cada agente pode melhorar no próprio sistema esta semana';
  // na parede a largura sai encolhida pela perspectiva (64 px de face viram
  // 32 na tela): o texto ganha 30% de volta, e os retratos quase voltam à
  // proporção real — senão o rosto fica fino
  const ESTICA = 1.3, ESTICA_RET = 1.6;
  const FONTE = (peso, px, fam = 'Barlow Semi Condensed') => `${peso} ${px}px '${fam}', sans-serif`;
  const CIANO = '#00b3ff', CIANO_CLARO = '#38bdf8', TEXTO = '#f2f6ff',
        TEXTO_2 = '#dfe5ef', APAGADO = 'rgba(170,185,212,.85)', ROTULO = 'rgba(150,166,196,.9)';

  /** dias, hora, duração e pauta: o servidor manda quando responde; senão
      ESCRITORIO.reuniao; senão o padrão do config.exemplo */
  function agendaReuniao(est) {
    const R = (window.ESCRITORIO && ESCRITORIO.reuniao) || {};
    const ag = {
      dias: Array.isArray(R.dias) ? R.dias.map(Number) : [1, 5],
      hora: R.hora != null ? +R.hora : 11, minuto: R.minuto != null ? +R.minuto : 0,
      dur: +R.duracaoMin || 30, foco: String(R.foco || '').trim() || PAUTA_PADRAO, proxima: null
    };
    if (est) {
      const hm = /^(\d{1,2}):(\d{2})$/.exec(est.hora || '');
      if (hm) { ag.hora = +hm[1]; ag.minuto = +hm[2]; }
      if (Array.isArray(est.dias)) ag.dias = est.dias.map(n => DIA_API.indexOf(n)).filter(i => i >= 0);
      if (est.duracao) ag.dur = +est.duracao;
      if (est.proxima) ag.proxima = +est.proxima;
    }
    return ag;
  }

  /** próximo horário da agenda (ms); até um minuto depois da hora ainda é "agora" */
  function proximaReuniao(ag, agora) {
    if (ag.proxima && ag.proxima > agora - 6e4) return ag.proxima;
    const d = new Date(agora);
    for (let i = 0; i < 8; i++) {
      d.setHours(ag.hora, ag.minuto, 0, 0);
      if (ag.dias.includes(d.getDay()) && d.getTime() > agora - 6e4) return d.getTime();
      d.setDate(d.getDate() + 1);
    }
    return null;
  }

  /** "em 2 d 3 h", "em 5 h 20 min", "em 45 min": a precisão cai com a
      distância, e com ela a frequência com que a tela é repintada */
  function falta(ms) {
    const min = Math.ceil(ms / 6e4);
    if (min <= 0) return 'agora';
    if (min < 60) return 'em ' + min + ' min';
    const h = Math.floor(min / 60), m = min % 60;
    if (h < 24) return 'em ' + h + ' h' + (m ? ' ' + m + ' min' : '');
    const d = Math.floor(h / 24), hh = h % 24;
    return 'em ' + d + ' d' + (hh ? ' ' + hh + ' h' : '');
  }

  /** { dia: 'HOJE' | 'AMANHÃ' | 'SEGUNDA'…, data: '19/10', hora: '11:00' } */
  function quando(ms, agora) {
    const d = new Date(ms), h = new Date(agora);
    const dia0 = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const dd = Math.round((dia0(d) - dia0(h)) / 864e5);
    const p2 = n => String(n).padStart(2, '0');
    return { dia: dd === 0 ? 'HOJE' : dd === 1 ? 'AMANHÃ' : dd === -1 ? 'ONTEM' : DIA_TV[d.getDay()],
             data: p2(d.getDate()) + '/' + p2(d.getMonth() + 1),
             hora: p2(d.getHours()) + ':' + p2(d.getMinutes()) };
  }

  /** nomes da reunião casados com o boneco do ROSTER (o rosto vem dele) */
  function pessoasTV(nomes) {
    const time = typeof ROSTER !== 'undefined' ? ROSTER.all() : [];
    return nomes.map(n => {
      const a = time.find(a => a.name === n);
      return { nome: n, look: (a && a.look) || null };
    });
  }

  /** fora da reunião: os convocados do servidor ou, sem ele, quem tem um
      sistema conhecido (como o servidor faz) e não foi tirado da mesa */
  function convocadosTV(est) {
    if (est && est.convocados && est.convocados.length) return est.convocados.map(p => p.nome);
    if (typeof ROSTER === 'undefined') return [];
    const SI = typeof SISTEMAS !== 'undefined' && SISTEMAS.todos().length ? SISTEMAS : null;
    return ROSTER.all().filter(a => !a.boss && a.sistema && a.reuniao !== false && (!SI || SI.porId(a.sistema)))
                       .map(a => a.name);
  }

  /** markdown curto numa linha só: sem negrito, título nem marcador */
  const corrido = s => String(s || '').replace(/\*\*/g, '').replace(/^#+\s*/gm, '')
                                      .replace(/^\s*([-*•]|\d+[.)])\s+/gm, '').replace(/\s+/g, ' ').trim();

  /** briefing em linhas [{ titulo, texto }]: "**ONDE ESTAMOS** — …" vira as duas partes */
  function linhasBriefing(md) {
    return String(md || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const m = /^\*\*([^*]+)\*\*\s*[—–:-]?\s*(.*)$/.exec(l);
      return m ? { titulo: corrido(m[1]), texto: corrido(m[2]) } : { titulo: '', texto: corrido(l) };
    }).filter(l => l.titulo || l.texto);
  }

  /** a última reunião, se acabou há pouco (12 h): o resumo dela fica na tela */
  function ultimaAta(est, agora) {
    if (!est) return null;
    for (const a of [est, est.ataDeHoje]) {
      if (!a || a.rodando || !a.fim || agora - a.fim > 12 * 36e5) continue;
      if (a.briefing || (a.falas || []).some(f => f.texto)) return a;
    }
    return null;
  }

  let tvModelo = null, tvModeloEm = -1e9;
  /** o que a tela mostra agora, com uma chave que só muda quando o que
      aparece muda; remontado no máximo duas vezes por segundo */
  function modeloTelao() {
    const agora = performance.now();
    if (tvModelo && agora - tvModeloEm < 500) return tvModelo;
    tvModeloEm = agora;
    return (tvModelo = montaModeloTelao(Date.now()));
  }
  const verTelao = () => modeloTelao().chave;

  function montaModeloTelao(agora) {
    const est = typeof REUNIAO !== 'undefined' ? REUNIAO.estado : null;
    const ag = agendaReuniao(est);
    const prox = proximaReuniao(ag, agora);
    const m = { modo: 'antes', pauta: ag.foco, prox: prox ? quando(prox, agora) : null,
                falta: prox ? falta(prox - agora) : '', pessoas: [] };
    const ata = est && !est.rodando ? ultimaAta(est, agora) : null;
    if (est && est.rodando) {
      const parts = est.participantes || [], falas = est.falas || [];
      const rodada = /2/.test(est.fase || '') ? 2 : 1;
      // cada um fala na ordem da mesa; quem já tem fala nesta rodada passou a vez
      const ja = new Set(falas.filter(f => f.rodada === rodada).map(f => f.quem));
      const vez = est.fase === 'briefing' ? null : parts.find(p => !ja.has(p.nome)) || null;
      const ult = falas.filter(f => f.texto).slice(-1)[0];
      Object.assign(m, {
        modo: 'andamento', briefing: est.fase === 'briefing', rodada,
        falando: vez ? vez.nome : null, papel: vez ? vez.papel || '' : '',
        vez: vez ? parts.indexOf(vez) + 1 : parts.length, total: parts.length,
        min: est.desde ? Math.max(0, Math.floor((agora - est.desde) / 6e4)) : 0,
        dur: est.ate && est.desde ? Math.max(1, Math.round((est.ate - est.desde) / 6e4)) : ag.dur,
        ultima: ult ? { quem: ult.quem, texto: corrido(ult.texto) } : null,
        pessoas: pessoasTV(parts.map(p => p.nome))
          .map(p => Object.assign(p, { ja: ja.has(p.nome), vez: !!vez && p.nome === vez.nome }))
      });
    } else if (ata) {
      const ini = quando(ata.desde || ata.fim, agora), fim = quando(ata.fim, agora);
      const linhas = ata.briefing ? linhasBriefing(ata.briefing)
        : (ata.falas || []).filter(f => f.texto).map(f => ({ titulo: f.quem, texto: corrido(f.texto) }));
      Object.assign(m, {
        modo: 'depois', interrompida: ata.fase === 'interrompida', temBriefing: !!ata.briefing,
        quando: ini.dia + ' · ' + ini.hora + '–' + fim.hora, linhas: linhas.slice(0, 4),
        nPessoas: (ata.participantes || []).length
      });
    } else {
      m.pessoas = pessoasTV(convocadosTV(est));
    }
    // o rosto entra na chave pelos traços (quem troca o visual na ficha repinta)
    m.chave = fonteCarregada() + '|' + (NASSA.pronto(NASSA.logo) ? 1 : 0) + '|' + JSON.stringify(m, (k, v) =>
      k === 'look' ? (v ? [v.skin, v.hair, v.style, v.shirt, v.glasses, v.beard, v.cap].join() : 0) : v);
    return m;
  }

  /* ---------- tipografia da tela ---------- */
  /** texto esticado na largura (ver ESTICA); devolve a largura ocupada */
  function escreve(c, s, u, v, fonte, cor, alinha = 'left', esp = 0) {
    c.font = fonte; c.fillStyle = cor; c.textBaseline = 'middle'; c.textAlign = alinha;
    c.letterSpacing = esp + 'px';
    c.save(); c.translate(u, v); c.scale(ESTICA, 1); c.fillText(s, 0, 0); c.restore();
    const w = c.measureText(s).width * ESTICA;
    c.letterSpacing = '0px';
    return w;
  }
  function mede(c, s, fonte, esp = 0) {
    c.font = fonte; c.letterSpacing = esp + 'px';
    const w = c.measureText(s).width * ESTICA;
    c.letterSpacing = '0px';
    return w;
  }
  /** corta com reticências até caber em max (esp: o espaçamento com que vai ser escrito) */
  function cabe(c, s, fonte, max, esp = 0) {
    s = String(s || '');
    if (mede(c, s, fonte, esp) <= max) return s;
    let t = s;
    while (t.length > 1 && mede(c, t + '…', fonte, esp) > max) t = t.slice(0, -1);
    return t.trimEnd() + '…';
  }
  /** quebra em até n linhas; a última leva reticências se sobrar texto */
  function quebra(c, s, fonte, max, n) {
    const pal = String(s || '').split(/\s+/).filter(Boolean), linhas = [];
    let l = '';
    for (let i = 0; i < pal.length; i++) {
      const t = l ? l + ' ' + pal[i] : pal[i];
      if (!l || mede(c, t, fonte) <= max) { l = t; continue; }
      linhas.push(l); l = pal[i];
      if (linhas.length === n - 1) { l = pal.slice(i).join(' '); break; }
    }
    if (l) linhas.push(l);
    return linhas.slice(0, n).map((x, i, a) => i === a.length - 1 ? cabe(c, x, fonte, max) : x);
  }
  const rotulo = (c, s, u, v, cor = ROTULO) => escreve(c, s, u, v, FONTE(700, 5.6), cor, 'left', 1);
  function filete(c, u0, u1, v) {
    c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(u0, v, u1 - u0, .6);
  }
  function fileteV(c, u, v0, v1) {
    c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(u, v0, .9, v1 - v0);
  }
  /** etiqueta arredondada (a contagem regressiva) */
  function pilula(c, s, u, v, fonte, cor, fundo) {
    const w = mede(c, s, fonte) + 10, h = 9.4;
    c.save(); c.translate(u, v); c.scale(ESTICA, 1);
    ISO.rrect(c, 0, -h / 2, w / ESTICA, h, h / 2);
    c.fillStyle = fundo; c.fill();
    c.strokeStyle = ISO.rgba(cor, .4); c.lineWidth = .6; c.stroke();
    c.restore();
    escreve(c, s, u + 5, v + .3, fonte, cor);
    return w;
  }

  /** medalhão com o rosto do boneco (sem boneco: a inicial) */
  function retrato(c, p, u, v, r, est = {}) {
    c.save();
    c.translate(u, v); c.scale(ESTICA_RET, 1);
    if (est.apagado) c.globalAlpha = .55;
    c.beginPath(); c.arc(0, 0, r, 0, 7);
    c.fillStyle = est.vez ? '#123049' : '#172031'; c.fill();
    if (p.look && typeof AVATAR !== 'undefined') {
      // do topo do cabelo ao ombro (34 px do boneco) cabem no diâmetro
      c.save(); c.clip();
      const k = r * 2 / 34;
      let look = p.look;
      if (look.style === 'longo' || look.style === 'chanel') {
        // de frente, o boneco pinta o cabelo comprido por cima do rosto (o
        // painel de trás vem depois da cabeça): no retrato ele vai para trás
        // dela, e por cima fica só a parte de cima do cabelo
        c.save(); c.translate(1.2 * k, 53 * k); c.scale(k, k);
        ISO.rrect(c, -13.7, -63, 25, look.style === 'longo' ? 24 : 15, 7);
        c.fillStyle = ISO.shade(look.hair, -.22); c.fill();
        c.strokeStyle = 'rgba(6,8,14,.55)'; c.lineWidth = 1.4; c.stroke();
        c.restore();
        look = Object.assign({}, look, { style: 'franja' });
      }
      AVATAR.draw(c, look, 1.2 * k, 53 * k, 's', { phase: 0, scale: k });
      c.restore();
    } else {
      c.font = FONTE(700, r * 1.1, 'Barlow'); c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = TEXTO_2; c.fillText(String(p.nome || '?').charAt(0).toUpperCase(), 0, .4);
    }
    c.beginPath(); c.arc(0, 0, r, 0, 7);
    c.lineWidth = est.vez ? 1.1 : .55;
    c.strokeStyle = est.vez ? CIANO : 'rgba(255,255,255,.16)'; c.stroke();
    if (est.ja) {
      // já falou nesta rodada: o visto verde no canto
      const b = r * .74, rb = Math.max(1.8, r * .3);
      c.globalAlpha = 1;
      c.beginPath(); c.arc(b, b, rb, 0, 7); c.fillStyle = '#16a36a'; c.fill();
      c.strokeStyle = '#eafff4'; c.lineWidth = .55; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(b - rb * .45, b); c.lineTo(b - rb * .1, b + rb * .38); c.lineTo(b + rb * .5, b - rb * .35); c.stroke();
    }
    c.restore();
  }

  /* A tela tem três colunas, e não faixas de ponta a ponta: na parede a
     linha horizontal desce para a direita junto com o telão, e uma fileira
     comprida cruzava o texto do lado. Em coluna, cada bloco se lê inteiro.
     · esquerda: a próxima reunião (ou quem está falando)
     · meio: a pauta (ou a última fala, ou o briefing)
     · direita: os rostos de quem senta à mesa                           */
  function colunas(len, P) {
    const c3 = len - P - 88;
    return { c1: P, c2: P + 104, c3, fim1: P + 94, fim2: c3 - 10 };
  }

  /** os rostos de quem senta à mesa, em grade de até duas linhas */
  function grade(c, pessoas, u0, u1, v0) {
    const n = pessoas.length;
    rotulo(c, 'NA MESA' + (n ? ' · ' + n : ''), u0, v0);
    if (!n) {
      escreve(c, 'ninguém convocado', u0, v0 + 10, FONTE(600, 6.4), APAGADO);
      return;
    }
    const porLinha = n <= 4 ? n : Math.ceil(n / 2), passo = Math.min(26, (u1 - u0) / porLinha);
    // mesa cheia: rosto e letra encolhem um pouco antes de o nome ser cortado
    const r = Math.min(5.6, passo / (2 * ESTICA_RET) - .3);
    pessoas.forEach((p, i) => {
      const lin = Math.floor(i / porLinha), col = i % porLinha;
      const u = u0 + passo * (col + .5), v = v0 + 11 + lin * 18;
      retrato(c, p, u, v, r, { vez: p.vez, ja: p.ja, apagado: p.ja && !p.vez });
      const px = Math.max(4.2, Math.min(5.3, 5.3 * (passo - 2) / mede(c, p.nome, FONTE(600, 5.3))));
      const fn = FONTE(600, +px.toFixed(2));
      escreve(c, cabe(c, p.nome, fn, passo - 2), u, v + 9.4, fn, p.vez ? CIANO_CLARO : APAGADO, 'center');
    });
  }

  const LOGO_W = 54;              // o logo no canto e uma folga: o título do alto para antes dele
  function logoTela(c, uDir, v) {
    if (!NASSA.pronto(NASSA.logo)) return;
    const im = NASSA.logo, h = 7.2, w = im.naturalWidth * h / im.naturalHeight * ESTICA_RET;
    c.globalAlpha = .88; c.drawImage(im, uDir - w, v - h / 2, w, h); c.globalAlpha = 1;
  }

  /** a próxima reunião em bloco: o dia grande, a data, a hora e quanto falta */
  function blocoProxima(c, m, u, v, max) {
    if (!m.prox) {
      escreve(c, 'SEM HORÁRIO', u, v + 1, FONTE(700, 11, 'Barlow'), TEXTO);
      quebra(c, 'a reunião começa quando você clicar em Reunir agora', FONTE(600, 6.4), max, 3)
        .forEach((l, i) => escreve(c, l, u, v + 12 + i * 7.6, FONTE(600, 6.4), APAGADO));
      return;
    }
    escreve(c, m.prox.dia, u, v + 1, FONTE(700, 13, 'Barlow'), TEXTO);
    escreve(c, m.prox.data + '  ·  ' + m.prox.hora, u, v + 13, FONTE(700, 9, 'Barlow'), CIANO);
    pilula(c, m.falta, u, v + 24, FONTE(700, 6.8), '#bfe9ff', 'rgba(0,179,255,.15)');
  }

  /** texto corrido numa coluna, em até n linhas */
  function paragrafo(c, s, u, v, max, n, fonte = FONTE(600, 7.6), cor = TEXTO_2) {
    quebra(c, s, fonte, max, n).forEach((l, i) => escreve(c, l, u, v + i * 8.4, fonte, cor));
  }

  function telaAntes(c, len, H, m, P) {
    const K = colunas(len, P);
    rotulo(c, 'PRÓXIMA REUNIÃO', P, 7.4, CIANO_CLARO);
    filete(c, P, len - P, 13.4);
    blocoProxima(c, m, K.c1, 23, K.fim1 - K.c1);
    fileteV(c, K.c2 - 7, 18, H - 4);
    rotulo(c, 'PAUTA', K.c2, 19.5);
    paragrafo(c, m.pauta, K.c2, 28.4, K.fim2 - K.c2, 4);
    fileteV(c, K.c3 - 7, 18, H - 4);
    grade(c, m.pessoas, K.c3, len - P, 19.5);
  }

  function telaAndamento(c, len, H, m, P) {
    const K = colunas(len, P);
    // o ponto "ao vivo" (o brilho dele pulsa fora do cache, ver telaoReuniao)
    c.fillStyle = '#ff4d5e';
    c.beginPath(); c.ellipse(P + 2.4 * ESTICA_RET, 7.4, 2.3 * ESTICA_RET, 2.3, 0, 0, 7); c.fill();
    let u = P + 10;
    u += escreve(c, 'EM ANDAMENTO', u, 7.4, FONTE(700, 6.6), '#ff8f99', 'left', 1.1) + 7;
    const fh = FONTE(600, 6.2);
    escreve(c, cabe(c, (m.briefing ? 'BRIEFING' : 'RODADA ' + m.rodada + ' · ' + m.vez + ' DE ' + m.total) +
               '  ·  ' + m.min + ' DE ' + m.dur + ' MIN', fh, len - P - LOGO_W - u, .6), u, 7.6, fh, APAGADO, 'left', .6);
    // o tempo corrido é a barra no lugar do filete
    c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(P, 13, len - 2 * P, 1.2);
    c.fillStyle = CIANO; c.fillRect(P, 13, (len - 2 * P) * Math.min(1, m.min / m.dur), 1.2);

    const u2 = K.c1 + 28;
    if (m.falando) {
      rotulo(c, 'FALANDO AGORA', K.c1, 19.5, CIANO_CLARO);
      retrato(c, m.pessoas.find(p => p.vez) || { nome: m.falando }, K.c1 + 10.5, 34, 9.4, { vez: true });
      const fn = FONTE(700, 11.5, 'Barlow');
      escreve(c, cabe(c, m.falando, fn, K.fim1 - u2), u2, 30.5, fn, TEXTO);
      paragrafo(c, m.papel, u2, 39.5, K.fim1 - u2, 2, FONTE(600, 6.2), APAGADO);
    } else {
      // briefing: o documento sendo escrito no lugar do rosto
      rotulo(c, 'BRIEFING', K.c1, 19.5, CIANO_CLARO);
      c.save(); c.translate(K.c1 + 10.5, 34); c.scale(ESTICA_RET, 1);
      c.fillStyle = '#172031'; c.beginPath(); c.arc(0, 0, 9.4, 0, 7); c.fill();
      c.strokeStyle = CIANO; c.lineWidth = 1.1; c.stroke();
      c.fillStyle = TEXTO_2; c.fillRect(-3.6, -4.8, 7.2, 9.6);
      c.fillStyle = '#5b6b86'; for (let i = 0; i < 4; i++) c.fillRect(-2.4, -3 + i * 2.1, i === 3 ? 3 : 4.8, .7);
      c.restore();
      paragrafo(c, 'juntando as falas no plano do dia', u2, 30.5, K.fim1 - u2, 3, FONTE(600, 6.8), TEXTO_2);
    }
    fileteV(c, K.c2 - 7, 18, H - 4);
    if (m.ultima) {
      // curto de propósito: na parede ele fica na mesma linha do "NA MESA"
      rotulo(c, cabe(c, m.ultima.quem.toUpperCase() + ' DISSE', FONTE(700, 5.6), K.fim2 - K.c2 - 16, 1), K.c2, 19.5);
      paragrafo(c, '“' + m.ultima.texto + '”', K.c2, 28.4, K.fim2 - K.c2, 4);
    } else {
      rotulo(c, 'PAUTA', K.c2, 19.5);
      paragrafo(c, m.pauta, K.c2, 28.4, K.fim2 - K.c2, 4);
    }
    fileteV(c, K.c3 - 7, 18, H - 4);
    grade(c, m.pessoas, K.c3, len - P, 19.5);
  }

  function telaDepois(c, len, H, m, P) {
    const K = colunas(len, P);
    const cor = m.interrompida ? '#f2b84b' : '#23e08a';
    // o visto (ou o traço, se foi interrompida) antes do título
    c.save(); c.translate(P + 2.4 * ESTICA_RET, 7.4); c.scale(ESTICA_RET, 1);
    c.fillStyle = ISO.rgba(cor, .18); c.beginPath(); c.arc(0, 0, 3.2, 0, 7); c.fill();
    c.strokeStyle = cor; c.lineWidth = .8; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
    if (m.interrompida) { c.moveTo(-1.4, 0); c.lineTo(1.4, 0); }
    else { c.moveTo(-1.5, .1); c.lineTo(-.4, 1.2); c.lineTo(1.6, -1.1); }
    c.stroke(); c.restore();
    let u = P + 11;
    u += escreve(c, m.interrompida ? 'REUNIÃO INTERROMPIDA' : 'REUNIÃO ENCERRADA', u, 7.4, FONTE(700, 6.6), cor, 'left', 1.1) + 7;
    // quantos sentaram só entra se couber inteiro: cortado no meio não diz nada
    const fh = FONTE(600, 6.2), cabeAte = len - P - LOGO_W - u;
    const comMesa = m.quando + (m.nPessoas ? '  ·  ' + m.nPessoas + ' na mesa' : '');
    escreve(c, mede(c, comMesa, fh, .4) <= cabeAte ? comMesa : cabe(c, m.quando, fh, cabeAte, .4),
            u, 7.6, fh, APAGADO, 'left', .4);
    filete(c, P, len - P, 13.4);

    // o resumo ocupa as duas primeiras colunas; a próxima fica na terceira
    const maxL = K.fim2 - P;
    rotulo(c, m.temBriefing ? 'BRIEFING DO DIA' : 'O QUE CADA UM TROUXE', P, 19.5, CIANO_CLARO);
    const ft = FONTE(700, 6.8), fx = FONTE(600, 6.8);
    m.linhas.forEach((l, i) => {
      const v = 28.4 + i * 8.2;
      let w = 0;
      if (l.titulo) w = escreve(c, cabe(c, l.titulo, ft, maxL * .55), P, v, ft, l.texto ? CIANO_CLARO : TEXTO) + 4;
      if (l.texto) escreve(c, cabe(c, l.texto, fx, maxL - w), P + w, v, fx, TEXTO_2);
    });
    fileteV(c, K.c3 - 7, 18, H - 4);
    rotulo(c, 'PRÓXIMA', K.c3, 19.5);
    blocoProxima(c, m, K.c3, 28.5, len - P - K.c3);
  }

  /** a tela inteira, em px de face (len × H) */
  function telaReuniao(c, len, H, m) {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0c1424'); g.addColorStop(1, '#060a13');
    c.fillStyle = g; c.fillRect(0, 0, len, H);
    // reflexo do vidro em diagonal, bem de leve
    c.fillStyle = 'rgba(255,255,255,.022)';
    c.beginPath(); c.moveTo(len * .6, 0); c.lineTo(len * .76, 0); c.lineTo(len * .58, H); c.lineTo(len * .42, H); c.fill();
    const P = 9;
    logoTela(c, len - P, 7.4);
    if (m.modo === 'andamento') telaAndamento(c, len, H, m, P);
    else if (m.modo === 'depois') telaDepois(c, len, H, m, P);
    else telaAntes(c, len, H, m, P);
  }

  /** corpo e tela, pintados no cache */
  function pintaTelaoReuniao(ctx, o) {
    const { x, y, w } = o;
    const m = modeloTelao();
    corpoTelao(ctx, o, TV_Z, false);
    // barra de videoconferência logo abaixo da tela: câmera no meio e o
    // LED, verde enquanto a reunião roda
    ISO.box(ctx, x + w / 2 - .5, y + .1, 1, .14, 4, TV_Z - 6, '#16181d', { top: '#2a2e35', line: 'rgba(0,0,0,.35)' });
    faceY(ctx, x + w / 2 - .5, y + .24, 1, TV_Z - 2, (c, len) => {
      c.fillStyle = 'rgba(255,255,255,.06)';
      for (let u = 4; u < len - 4; u += 2.2) if (Math.abs(u - len / 2) > 6) c.fillRect(u, 1.3, .9, 1.4);
      c.fillStyle = '#040508'; c.beginPath(); c.ellipse(len / 2, 2, 3.6, 1.6, 0, 0, 7); c.fill();
      c.fillStyle = 'rgba(120,170,255,.55)'; c.beginPath(); c.ellipse(len / 2 - 1, 1.6, 1, .5, 0, 0, 7); c.fill();
      c.fillStyle = m.modo === 'andamento' ? '#23e08a' : 'rgba(255,255,255,.18)'; c.fillRect(len - 5, 1.6, 1.4, .9);
    });
    ISO.box(ctx, x, y, w, .22, TV_H, TV_Z, '#0a0c14');
    faceY(ctx, x + .02, y + .22, w - .04, TV_Z + TV_H - 4, (c, len) => telaReuniao(c, len, TV_H - 8, m));
  }

  /** caixa do cache: do pé do rack ao alto da tela, com a sombra */
  function caixaTelao(o) {
    const { x, y, w } = o, mg = 6;
    return [S(x, y + .62).x - mg, S(x, y).y - TV_Z - TV_H - mg, S(x + w, y).x + mg, S(x + w, y + .62).y + mg];
  }

  /** uma tira do telão: copia a sua fatia do cache e soma a luz ao vivo */
  function telaoReuniao(ctx, o, t) {
    let op = o._tv;
    if (!op) {
      const yc = o.y + .4, f = o.fatia || [o.x, o.x + o.w];
      op = o._tv = {
        chave: 'telaoReuniao|' + o.x + '|' + o.y, ver: verTelao, caixa: caixaTelao(o),
        faixa: [f[0] <= o.x + 1e-6 ? -Infinity : S(f[0], yc).x, f[1] >= o.x + o.w - 1e-6 ? Infinity : S(f[1], yc).x]
      };
    }
    emCache(ctx, o, pintaTelaoReuniao, op);
    // a luz da tela na sala, recortada na tira (senão as cinco somariam) e,
    // com a reunião rodando, o brilho do ponto vermelho pulsando na primeira
    const [L, R] = o.fatia ? recorteTira(ctx, o) : [-1e5, 1e5];
    ctx.save();
    ctx.beginPath(); ctx.rect(L, -1e5, R - L, 2e5); ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    const gc = S(o.x + o.w / 2, o.y + .3, TV_Z + TV_H / 2);
    ISO.glow(ctx, gc.x, gc.y, 110, CIANO_CLARO, .14);
    const xPonto = o.x + .02 + (9 + 2.4 * ESTICA_RET) / ISO.TW;
    if (modeloTelao().modo === 'andamento' && (!o.fatia || (o.fatia[0] <= xPonto && xPonto < o.fatia[1]))) {
      faceY(ctx, o.x + .02, o.y + .22, o.w - .04, TV_Z + TV_H - 4, c => {
        ISO.glow(c, 9 + 2.4 * ESTICA_RET, 7.4, 7, '#ff4d5e', .3 + .35 * (Math.sin(t * 3.2) + 1) / 2);
      });
    }
    ctx.restore();
  }

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

  /* ===========================================================
     CADEIRAS
     Três modelos da mesma família de escritório corporativo:
       tela        — cadeira de trabalho em tela, estilo Aeron (devs)
       conferencia — espaldar alto em couro e alumínio (sala de reunião)
       executiva   — a do chefe: mais alta, mais larga, couro mais grosso

     Referencial próprio: u corre na largura (u > 0 é o lado mais perto da
     câmera), v aponta para o encosto e z sobe em px. A origem é o quadril
     do boneco (o ponto do slot), por isso o assento fica quase todo à
     frente dela: quem senta encosta no fundo do assento, não no meio.
     Todas são estáticas e vão para o cache (ALTURA_CACHE): o capricho
     abaixo custa só na primeira vez que cada cadeira aparece.
     =========================================================== */
  const EIXOS = {
    n: { U: [1, 0], V: [0, 1] },  s: { U: [1, 0], V: [0, -1] },
    e: { U: [0, 1], V: [-1, 0] }, w: { U: [0, 1], V: [1, 0] }
  };

  const MODELOS = {
    tela: {
      assento: { w: .37, vf: -.56, vt: .17, esp: 4.5, r: .13, aro: .05 },
      encosto: { v: .25, esp: .05, h0: 5, h1: 28, wb: .29, c1: .31, c2: .46, wt: .42,
                 arco: 2, rtu: .13, rth: 5, rbu: .08, rbh: 4 },
      braco: 'poste', raio: .40,
      cor: { aro: '#3a3f49', aroLado: '#20232a', tela: 'rgba(25,28,34,.86)',
             assento: '#262930', base: '#3c414a', baseLado: '#20232a',
             pistao: '#8f98a8', capa: '#1d2026', almof: '#31353d', almofLado: '#1b1e23' }
    },
    /* sala de reunião: couro preto com estrutura grafite. Alumínio polido
       aqui virava um risco aceso atrás do vidro da sala, na fileira da frente */
    conferencia: {
      assento: { w: .38, vf: -.55, vt: .17, esp: 5, r: .14 },
      encosto: { v: .25, esp: .065, h0: 3, h1: 34, wb: .37, c1: .37, c2: .38, wt: .37,
                 arco: 1.6, rtu: .11, rth: 5, rbu: .07, rbh: 3, gomos: [1, 1, 1, 1] },
      braco: 'aluminio', raio: .41,
      cor: { couro: '#25282e', couroClaro: '#3d414a', couroEscuro: '#131519', costura: '#0b0c0f',
             alu: '#626872', aluLado: '#40454d', aluTopo: '#8a909a', base: '#3b3f47', baseLado: '#22252b',
             pistao: '#7f8794', capa: '#1d2026', almof: '#25282e', almofLado: '#15171b' }
    },
    /* a do chefe: couro conhaque (o mesmo tom do sofá e das poltronas da
       sala), alumínio polido, abas laterais e apoio de cabeça            */
    executiva: {
      assento: { w: .42, vf: -.58, vt: .17, esp: 6, r: .15 },
      encosto: { v: .26, esp: .09, h0: 3, h1: 47, wb: .43, c1: .44, c2: .45, wt: .44,
                 arco: 2.4, rtu: .13, rth: 6, rbu: .08, rbh: 3, gomos: [1, 1, 1, 1, 1.45], abas: .075 },
      braco: 'aluminio', raio: .44,
      cor: { couro: '#4a2e1d', couroClaro: '#7a5236', couroEscuro: '#24160d', costura: '#160d07',
             alu: '#bfc5ce', aluLado: '#7f8794', aluTopo: '#e4e8ed', base: '#bfc5ce', baseLado: '#79818e',
             pistao: '#a3acba', capa: '#17191d', almof: '#4a2e1d', almofLado: '#24160d' }
    }
  };

  /** liga o referencial da cadeira (u, v, z) à tela */
  function refCadeira(o) {
    const f = EIXOS[o.face] ? o.face : 'n';
    const { U, V } = EIXOS[f];
    const ox = o.x + o.w / 2, oy = o.y + o.d / 2;
    const P = (u, v, z) => S(ox + u * U[0] + v * V[0], oy + u * U[1] + v * V[1], z);
    const mu = [32 * (U[0] - U[1]), 16 * (U[0] + U[1])];   // tela por tile de u
    const mv = [32 * (V[0] - V[1]), 16 * (V[0] + V[1])];   // tela por tile de v
    return {
      f, U, V, ox, oy, P,
      // de costas para a câmera ('n'/'w') o encosto fica do lado dela
      cs: V[0] + V[1],
      /** plano horizontal na altura z: (u, v) -> tela */
      H: z => { const p = P(0, 0, z); return [mu[0], mu[1], mv[0], mv[1], p.x, p.y]; },
      /** plano vertical do encosto, na profundidade v: (u, altura) -> tela */
      E: v => { const p = P(0, v, 0); return [mu[0], mu[1], 0, -1, p.x, p.y]; }
    };
  }

  /** monta um caminho num plano local; ele continua valendo depois do restore */
  function noPlano(ctx, m, forma) {
    ctx.save();
    ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    ctx.beginPath(); forma(ctx);
    ctx.restore();
  }
  /** preenche dentro do plano local (o degradê nasce nas unidades dele) */
  function pintaNoPlano(ctx, m, forma, estilo) {
    ctx.save();
    ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    ctx.beginPath(); forma(ctx);
    ctx.fillStyle = typeof estilo === 'function' ? estilo(ctx) : estilo;
    ctx.fill();
    ctx.restore();
  }
  /** retângulo arredondado com raio próprio em cada eixo (u em tiles, h em px) */
  function rrLocal(c, x0, y0, x1, y1, rx, ry) {
    c.moveTo(x0 + rx, y0);
    c.lineTo(x1 - rx, y0); c.quadraticCurveTo(x1, y0, x1, y0 + ry);
    c.lineTo(x1, y1 - ry); c.quadraticCurveTo(x1, y1, x1 - rx, y1);
    c.lineTo(x0 + rx, y1); c.quadraticCurveTo(x0, y1, x0, y1 - ry);
    c.lineTo(x0, y0 + ry); c.quadraticCurveTo(x0, y0, x0 + rx, y0);
    c.closePath();
  }
  /** contorno do encosto no plano (u, altura): base estreita, ombros mais
      largos, cantos de cima arredondados e o topo levemente em arco      */
  function contornoEncosto(c, e, rec = 0, recH = 0) {
    const h0 = e.h0 + recH, h1 = e.h1 - recH, H = h1 - h0;
    const wb = e.wb - rec, c1 = e.c1 - rec, c2 = e.c2 - rec, wt = e.wt - rec;
    const rbh = Math.max(1, e.rbh - recH * .5), rth = Math.max(1, e.rth - recH * .5);
    const rbu = Math.max(.02, e.rbu - rec * .5), rtu = Math.max(.02, e.rtu - rec * .5);
    c.moveTo(0, h0);
    c.lineTo(wb - rbu, h0);
    c.quadraticCurveTo(wb, h0, wb, h0 + rbh);
    c.bezierCurveTo(c1, h0 + H * .45, c2, h0 + H * .8, wt, h1 - rth);
    c.quadraticCurveTo(wt, h1, wt - rtu, h1);
    c.quadraticCurveTo(0, h1 + e.arco * 2, -(wt - rtu), h1);
    c.quadraticCurveTo(-wt, h1, -wt, h1 - rth);
    c.bezierCurveTo(-c2, h0 + H * .8, -c1, h0 + H * .45, -wb, h0 + rbh);
    c.quadraticCurveTo(-wb, h0, -(wb - rbu), h0);
    c.closePath();
  }

  /** caixa alinhada ao mundo dada por faixas do referencial da cadeira */
  function caixaRef(ctx, R, u0, u1, v0, v1, h, z, cor, opt) {
    const ax = R.ox + u0 * R.U[0] + v0 * R.V[0], ay = R.oy + u0 * R.U[1] + v0 * R.V[1];
    const bx = R.ox + u1 * R.U[0] + v1 * R.V[0], by = R.oy + u1 * R.U[1] + v1 * R.V[1];
    ISO.box(ctx, Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay),
            h, z, cor, opt);
  }

  /** placa horizontal (assento, apoio de braço): a mesma forma empilhada
      de z0 a z1 vira a lateral arredondada, e o topo vem por cima        */
  function laje(ctx, R, forma, z0, z1, lado, topo) {
    for (let z = z0; z < z1; z += .75) {
      noPlano(ctx, R.H(z), forma);
      ctx.fillStyle = lado; ctx.fill();
    }
    pintaNoPlano(ctx, R.H(z1), forma, topo);
  }

  /** trama fina de tela, nas duas diagonais do plano (já recortada) */
  function trama(ctx, m, x0, y0, x1, y1, passoU, passoH) {
    ctx.save();
    ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    ctx.beginPath();
    for (let u = x0; u <= x1; u += passoU) { ctx.moveTo(u, y0); ctx.lineTo(u, y1); }
    for (let h = y0; h <= y1; h += passoH) { ctx.moveTo(x0, h); ctx.lineTo(x1, h); }
    ctx.restore();
    ctx.lineWidth = .45;
    ctx.strokeStyle = 'rgba(165,180,205,.075)'; ctx.stroke();
  }


  /** medidas que dependem do boneco e do modelo, usadas por todas as peças */
  function medidas(M) {
    const ASSENTO = AVATAR.SEAT * AVATAR.SCALE;          // topo do assento = quadril sentado
    const a = M.assento, couro = M.braco !== 'poste';
    return {
      ASSENTO, couro,
      vc: (a.vf + a.vt) / 2 + .03,                       // eixo do pistão, sob o meio do assento
      zAlu: ASSENTO - a.esp - 1.5,                       // estrutura de alumínio sob o couro
      zMec: ASSENTO - a.esp - (couro ? 1.5 : 0) - 2.5,   // embaixo do mecanismo
      uBraco: a.w + .06
    };
  }

  /* ---------- base estrela: cinco pernas, rodízios e pistão ---------- */
  function estrela(ctx, R, M, K, repinta) {
    const c = M.cor, vc = K.vc;
    const zCubo = 6.5, zPonta = 4.6, alt = 2.4;
    const pernas = [];
    for (let i = 0; i < 5; i++) {
      const a = Math.PI / 2 + i * Math.PI * 2 / 5;     // uma perna aponta para o encosto
      const du = Math.cos(a), dv = Math.sin(a);
      pernas.push({ du, dv, prof: du + R.cs * dv });
    }
    pernas.sort((a, b) => a.prof - b.prof);            // do fundo para a frente
    const perna = ({ du, dv }) => {
      const u0 = du * .05, v0 = vc + dv * .05, u1 = du * M.raio, v1 = vc + dv * M.raio;
      // rodízio duplo apoiado no chão, preso por baixo da ponta da perna
      const pr = R.P(u1, v1, 0);
      if (!repinta) {      // a sombra no piso não pode escurecer duas vezes
        ctx.fillStyle = 'rgba(0,0,0,.36)';
        ctx.beginPath(); ctx.ellipse(pr.x, pr.y + .3, 3.6, 1.7, 0, 0, 7); ctx.fill();
      }
      ISO.rrect(ctx, pr.x - 2.8, pr.y - 4.6, 5.6, 4.6, 2.2);
      ctx.fillStyle = '#0f1114'; ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.13)'; ctx.fillRect(pr.x - 1.7, pr.y - 4.1, 3.4, .8);
      // perna afinando até a ponta: lateral que a câmera vê, ponta e topo
      const pu = -dv, pv = du;
      const lado = (pu + R.cs * pv) > 0 ? 1 : -1;
      const l0 = .042, l1 = .027;
      const A = (u, v, w, z) => R.P(u + pu * w, v + pv * w, z);
      ISO.quad(ctx, [A(u0, v0, lado * l0, zCubo), A(u1, v1, lado * l1, zPonta),
                     A(u1, v1, lado * l1, zPonta - alt), A(u0, v0, lado * l0, zCubo - alt - 1)], c.baseLado);
      if (du + R.cs * dv > 0)
        ISO.quad(ctx, [A(u1, v1, l1, zPonta), A(u1, v1, -l1, zPonta),
                       A(u1, v1, -l1, zPonta - alt), A(u1, v1, l1, zPonta - alt)], ISO.shade(c.baseLado, -.18));
      ISO.quad(ctx, [A(u0, v0, l0, zCubo), A(u1, v1, l1, zPonta),
                     A(u1, v1, -l1, zPonta), A(u0, v0, -l0, zCubo)], c.base);
      const b0 = A(u0, v0, 0, zCubo), b1 = A(u1, v1, 0, zPonta);
      ctx.strokeStyle = 'rgba(255,255,255,.13)'; ctx.lineWidth = .55;
      ctx.beginPath(); ctx.moveTo(b0.x, b0.y); ctx.lineTo(b1.x, b1.y); ctx.stroke();
    };
    const cx = R.ox + vc * R.V[0], cy = R.oy + vc * R.V[1];
    pernas.filter(p => p.prof < 0).forEach(perna);
    ISO.cyl(ctx, cx, cy, .066, 3.6, zCubo - 3, ISO.shade(c.baseLado, .12));    // cubo
    pernas.filter(p => p.prof >= 0).forEach(perna);
    // pistão: capa escura embaixo e haste cromada até o mecanismo
    const meio = zCubo + (K.zMec - zCubo) * .5;
    ISO.cyl(ctx, cx, cy, .056, meio - zCubo + .5, zCubo, c.capa);
    ISO.cyl(ctx, cx, cy, .037, K.zMec - meio, meio, c.pistao);
  }

  /* ---------- mecanismo sob o assento e os suportes dos braços ---------- */
  function mecanismo(ctx, R, M, K) {
    const c = M.cor, a = M.assento;
    caixaRef(ctx, R, -.11, .11, K.vc - .14, K.vc + .12, 2.5, K.zMec, c.capa);
    for (const s of [-1, 1]) {
      if (K.couro)        // o braço de alumínio se prende na lateral da estrutura
        caixaRef(ctx, R, Math.min(s * a.w, s * K.uBraco), Math.max(s * a.w, s * K.uBraco),
                 -.27, -.21, 1.6, K.zAlu, c.aluLado);
      else                // suporte do braço regulável, por baixo do assento
        caixaRef(ctx, R, Math.min(0, s * K.uBraco), Math.max(0, s * K.uBraco),
                 -.1, -.04, 2.2, K.zMec + .3, c.aroLado);
    }
  }

  /* ---------- assento ---------- */
  function assento(ctx, R, M, K) {
    const a = M.assento, c = M.cor, Z = K.ASSENTO;
    const forma = k => cc => rrLocal(cc, -a.w + k, a.vf + k, a.w - k, a.vt - k, a.r, a.r);
    // lateral: mais clara do lado esquerdo da tela, como nas caixas
    const xs = [R.P(-a.w, a.vt, Z), R.P(a.w, a.vf, Z), R.P(a.w, a.vt, Z), R.P(-a.w, a.vf, Z)].map(p => p.x);
    const base = K.couro ? c.couro : c.aroLado;
    const g = ctx.createLinearGradient(Math.min(...xs), 0, Math.max(...xs), 0);
    g.addColorStop(0, ISO.shade(base, K.couro ? .05 : .12)); g.addColorStop(1, ISO.shade(base, -.4));
    if (K.couro) {
      // estrutura de alumínio por baixo da almofada
      laje(ctx, R, forma(.035), K.zAlu, Z - a.esp, c.aluLado, c.alu);
      laje(ctx, R, forma(0), Z - a.esp, Z, g, cc => {
        const gr = cc.createLinearGradient(0, a.vf, 0, a.vt);
        gr.addColorStop(0, c.couroClaro); gr.addColorStop(.3, c.couro); gr.addColorStop(1, c.couroEscuro);
        return gr;
      });
      // gomos costurados na largura
      for (let i = 1; i < 3; i++) {
        const vv = a.vf + (a.vt - a.vf) * i / 3;
        noPlano(ctx, R.H(Z + .05), cc => { cc.moveTo(-a.w + .05, vv); cc.lineTo(a.w - .05, vv); });
        ctx.strokeStyle = c.costura; ctx.lineWidth = .9; ctx.stroke();
        noPlano(ctx, R.H(Z + .05), cc => { cc.moveTo(-a.w + .06, vv - .025); cc.lineTo(a.w - .06, vv - .025); });
        ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = .6; ctx.stroke();
      }
      return;
    }
    // tela: aro escuro com a tela esticada por dentro
    laje(ctx, R, forma(0), Z - a.esp, Z, g, c.aro);
    pintaNoPlano(ctx, R.H(Z + .05), forma(a.aro), c.assento);
    ctx.save();
    noPlano(ctx, R.H(Z + .05), forma(a.aro)); ctx.clip();
    trama(ctx, R.H(Z + .06), -a.w, a.vf, a.w, a.vt, .035, .035);
    ctx.restore();
    noPlano(ctx, R.H(Z + .06), cc => { cc.moveTo(-a.w + a.r, a.vf + .014); cc.lineTo(a.w - a.r, a.vf + .014); });
    ctx.strokeStyle = 'rgba(255,255,255,.11)'; ctx.lineWidth = .7; ctx.stroke();
  }

  /* ---------- espinha: liga o mecanismo à base do encosto ---------- */
  function espinha(ctx, R, M, K, trecho) {
    const e = M.encosto, c = M.cor;
    const cor = K.couro ? c.alu : c.aro;
    const opt = K.couro ? { top: c.aluTopo, left: c.alu, right: c.aluLado } : undefined;
    const meia = K.couro ? .05 : .07;
    if (trecho === 'deitado')        // por baixo do assento
      caixaRef(ctx, R, -meia, meia, K.vc + .1, e.v + .03, 2.5, K.zMec, cor, opt);
    else                             // em pé, atrás do fundo do assento
      caixaRef(ctx, R, -meia, meia, e.v - .03, e.v + .03, K.ASSENTO + e.h0 + 6 - K.zMec, K.zMec, cor, opt);
  }

  /* ---------- encosto ---------- */
  function encosto(ctx, R, M, K, accent) {
    const e = M.encosto, c = M.cor, cs = R.cs;
    const longe = e.v - cs * e.esp / 2, perto = e.v + cs * e.esp / 2;
    const contorno = (rec, recH) => cc => contornoEncosto(cc, e, rec, recH);
    const sobe = m => [m[0], m[1], m[2], m[3], m[4], m[5] - K.ASSENTO];   // altura medida do assento
    const costas = cs > 0;                     // vemos o lado de trás do encosto

    if (!K.couro) {
      /* ----- tela: aro curvo com a tela esticada ----- */
      const aro = .045, aroH = 2.2;
      const meio = sobe(R.E(e.v));
      pintaNoPlano(ctx, meio, contorno(aro * .6, aroH * .6), c.tela);
      ctx.save();
      noPlano(ctx, meio, contorno(aro * .6, aroH * .6)); ctx.clip();
      trama(ctx, meio, -e.wt, e.h0, e.wt, e.h1 + e.arco, .03, 1.15);
      // apoio lombar atrás da tela, na altura da cintura
      const hl = e.h0 + (e.h1 - e.h0) * .3;
      pintaNoPlano(ctx, meio, cc => rrLocal(cc, -e.wb - .05, hl, e.wb + .05, hl + 4.2, .05, 2),
                   costas ? '#2f333b' : 'rgba(62,68,80,.32)');
      if (costas) {
        noPlano(ctx, meio, cc => { cc.moveTo(-e.wb + .04, hl + 1.3); cc.lineTo(e.wb - .04, hl + 1.3); });
        ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = .7; ctx.stroke();
        noPlano(ctx, meio, cc => { cc.moveTo(-.055, hl + 2.9); cc.lineTo(.055, hl + 2.9); });
        ctx.strokeStyle = ISO.rgba(accent, .9); ctx.lineWidth = .8; ctx.stroke();
      }
      ctx.restore();
      // aro: anel extrudado de trás para a frente
      const anel = cc => { contornoEncosto(cc, e); contornoEncosto(cc, e, aro, aroH); };
      for (let k = 0; k < 4; k++) {
        noPlano(ctx, sobe(R.E(longe + (perto - longe) * k / 4)), anel);
        ctx.fillStyle = c.aroLado; ctx.fill('evenodd');
      }
      noPlano(ctx, sobe(R.E(perto)), anel);
      ctx.fillStyle = c.aro; ctx.fill('evenodd');
      // luz de recorte no contorno: sem ela o aro some no carpete escuro
      noPlano(ctx, sobe(R.E(perto)), contorno(0, 0));
      ctx.strokeStyle = 'rgba(255,255,255,.09)'; ctx.lineWidth = .6; ctx.stroke();
      noPlano(ctx, sobe(R.E(perto)), cc => {
        cc.moveTo(e.wt - e.rtu, e.h1 - .4);
        cc.quadraticCurveTo(0, e.h1 - .4 + e.arco * 2, -(e.wt - e.rtu), e.h1 - .4);
      });
      ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = .7; ctx.stroke();
      return;
    }

    /* ----- couro, com trilhos de alumínio nas laterais ----- */
    const alu = { top: c.aluTopo, left: c.alu, right: c.aluLado };
    const trilho = s => caixaRef(ctx, R, s > 0 ? e.wt : -e.wt - .032, s > 0 ? e.wt + .032 : -e.wt,
                                 e.v - .03, e.v + .03, e.h1 + 2, K.ASSENTO - 4, c.alu, alu);
    trilho(-1);
    for (let k = 0; k < 5; k++) {
      noPlano(ctx, sobe(R.E(longe + (perto - longe) * k / 5)), contorno(0, 0));
      ctx.fillStyle = c.couroEscuro; ctx.fill();
    }
    const face = sobe(R.E(perto));
    if (costas) {
      // costas lisas, com degradê suave e pesponto em volta
      pintaNoPlano(ctx, face, contorno(0, 0), cc => {
        const g = cc.createLinearGradient(0, e.h1, 0, e.h0);
        g.addColorStop(0, c.couroClaro); g.addColorStop(.3, c.couro); g.addColorStop(1, c.couroEscuro);
        return g;
      });
      noPlano(ctx, face, contorno(.035, 2.4));
      ctx.save(); ctx.setLineDash([1.4, 1.1]);
      ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = .5; ctx.stroke();
      ctx.restore();
    } else {
      // frente em gomos estofados: luz em cima, sombra embaixo de cada um.
      // Com abas, os gomos ficam entre duas laterais mais cheias
      const pesos = e.gomos, total = pesos.reduce((a, b) => a + b, 0);
      const hA = e.h0 + 1, hB = e.h1 + e.arco, ab = e.abas || 0;
      const gomo = (u0, u1, g0, g1, ru) => pintaNoPlano(ctx, face,
        cc => rrLocal(cc, u0, g0 + .45, u1, g1 - .45, ru, 2.2), cc => {
          const g = cc.createLinearGradient(0, g1, 0, g0);
          g.addColorStop(0, c.couroClaro); g.addColorStop(.45, c.couro); g.addColorStop(1, c.couroEscuro);
          return g;
        });
      pintaNoPlano(ctx, face, contorno(0, 0), c.couroEscuro);
      ctx.save();
      noPlano(ctx, face, contorno(0, 0)); ctx.clip();
      let acc = 0;
      for (const p of pesos) {
        const g0 = hA + (hB - hA) * acc / total, g1 = hA + (hB - hA) * (acc + p) / total;
        gomo(-e.wt + .03 + ab, e.wt - .03 - ab, g0, g1, .06);
        acc += p;
      }
      if (ab) for (const s of [-1, 1]) {
        // aba lateral: uma peça só, de cima a baixo, com luz na borda de dentro
        const u0 = s < 0 ? -e.wt + .02 : e.wt - ab + .005, u1 = s < 0 ? -e.wt + ab - .005 : e.wt - .02;
        pintaNoPlano(ctx, face, cc => rrLocal(cc, u0, hA, u1, hB + 2, .03, 3), cc => {
          const g = cc.createLinearGradient(s < 0 ? u0 : u1, 0, s < 0 ? u1 : u0, 0);
          g.addColorStop(0, c.couroEscuro); g.addColorStop(.55, c.couro); g.addColorStop(1, c.couroClaro);
          return g;
        });
      }
      ctx.restore();
    }
    // filete claro no contorno, para o encosto não sumir no piso escuro
    noPlano(ctx, face, contorno(0, 0));
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = .6; ctx.stroke();
    trilho(1);
  }

  /* ---------- braço (coluna e apoio); o suporte vai junto do mecanismo ---------- */
  function braco(ctx, R, M, K, lado) {
    const e = M.encosto, c = M.cor, Z = K.ASSENTO;
    const uc = lado * K.uBraco;
    if (!K.couro) {
      // regulável: coluna fina e apoio estreito
      const zP = Z + 9, vP0 = -.33, vP1 = .07;
      caixaRef(ctx, R, uc - .026, uc + .026, -.1, -.04, zP - K.zMec, K.zMec, c.aro, { top: c.aro });
      laje(ctx, R, cc => rrLocal(cc, uc - .05, vP0, uc + .05, vP1, .04, .06), zP, zP + 3, c.almofLado, c.almof);
      noPlano(ctx, R.H(zP + 3.05), cc => { cc.moveTo(uc, vP0 + .05); cc.lineTo(uc, vP1 - .05); });
      ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = .6; ctx.stroke();
      return;
    }
    // alumínio: sobe da lateral do assento e corre até o trilho do encosto
    const zP = Z + 10, vF = -.30, vT = e.v - .02;
    const alu = { top: c.aluTopo, left: c.alu, right: c.aluLado };
    caixaRef(ctx, R, uc - .022, uc + .022, -.27, -.21, zP - K.zAlu, K.zAlu, c.alu, alu);
    caixaRef(ctx, R, uc - .03, uc + .03, vF + .02, vT, 2, zP - 1.5, c.alu, alu);
    laje(ctx, R, cc => rrLocal(cc, uc - .048, vF, uc + .048, vT - .02, .04, .07), zP, zP + 3, c.almofLado, cc => {
      const g = cc.createLinearGradient(0, vF, 0, vT);
      g.addColorStop(0, c.couroClaro); g.addColorStop(1, c.couro);
      return g;
    });
  }

  /**
   * Cadeira em DUAS camadas, para o boneco sentar dentro dela.
   *
   * De frente para a câmera ('s'/'e'): quase tudo vai na camada de trás
   * (antes do boneco); só o braço do lado da câmera vem por cima dele.
   * De costas ('n'/'w'): a camada de trás tem base, assento e o braço do
   * fundo; a da frente repinta só o que fica ABAIXO do quadril — assim o
   * assento e a base escondem canelas e pés sem cobrir o tronco — e por
   * fim põe o braço da frente e o encosto, que tapa a lombar de quem senta.
   */
  function cadeiraBase(ctx, o, M, accent) {
    const R = refCadeira(o), K = medidas(M);
    const camada = o.camada || 'tras';
    const costas = R.cs > 0;

    const corpo = (repinta) => {
      estrela(ctx, R, M, K, repinta);
      if (!costas) {                       // encosto ao fundo: vai primeiro
        espinha(ctx, R, M, K, 'deitado');
        espinha(ctx, R, M, K, 'em pe');
        encosto(ctx, R, M, K, accent);
        mecanismo(ctx, R, M, K);
      } else {
        mecanismo(ctx, R, M, K);
        espinha(ctx, R, M, K, 'deitado');
      }
      braco(ctx, R, M, K, -1);
      assento(ctx, R, M, K);
    };

    if (camada === 'tras') {
      const pc = R.P(0, K.vc, 0);
      ctx.fillStyle = 'rgba(0,0,0,.24)';
      ctx.beginPath(); ctx.ellipse(pc.x, pc.y, M.raio * 44, M.raio * 22, 0, 0, 7); ctx.fill();
      corpo(false);
      return;
    }
    if (!costas) { braco(ctx, R, M, K, 1); return; }

    const m = ctx.getTransform();
    // linha do quadril no pixel inteiro do cache, para não sobrar costura
    const quadril = (Math.round(R.P(0, 0, K.ASSENTO).y * m.d + m.f) - m.f) / m.d;
    ctx.save();
    ctx.beginPath(); ctx.rect(-1e5, quadril, 2e5, 1e5); ctx.clip();
    corpo(true);
    ctx.restore();
    espinha(ctx, R, M, K, 'em pe');
    braco(ctx, R, M, K, 1);
    encosto(ctx, R, M, K, accent);
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

  /* ===========================================================
     SALA DE JOGOS, CORREDOR — pinturas das peças paradas
     (as entradas do DRAW chamam estas pelo cache em níveis)
     =========================================================== */

  /** a fonte da interface já carregou? Quando carrega, os caches com
      texto repintam. document.fonts.check() custa caro para chamar por
      peça a cada quadro: só pergunta de novo a cada meio segundo.      */
  let fonteOk = false, fonteT = -1e9;
  function fonteCarregada() {
    if (!fonteOk && performance.now() - fonteT > 500) {
      fonteT = performance.now();
      fonteOk = !document.fonts || document.fonts.check("700 8px 'Barlow Semi Condensed'");
    }
    return fonteOk ? 1 : 0;
  }

  function pintaSinuca(ctx, o) {
    const { x, y, w, d } = o;
    const NOG = '#4a2a14', NOG_T = '#5e3719', NOG_D = '#36200f';
    ISO.shadow(ctx, x + w / 2, y + d / 2, 2.5, .3);
    // pés torneados e a saia de nogueira
    [[.22, .22], [w - .62, .22], [.22, d - .62], [w - .62, d - .62]].forEach(([px, py]) => {
      ISO.box(ctx, x + px - .03, y + py - .03, .46, .46, 3, 0, '#1f1209');
      ISO.box(ctx, x + px, y + py, .4, .4, 21, 3, '#2e1a0c', { top: '#3a2210' });
    });
    ISO.box(ctx, x, y, w, d, 14, 24, NOG, { top: NOG_T, left: NOG, right: NOG_D, line: 'rgba(20,10,4,.45)' });
    faceY(ctx, x, y + d, w, 38, (c, len) => {
      c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, 9, len, .8);
      c.fillStyle = 'rgba(255,220,180,.06)'; c.fillRect(0, 1, len, .8);
    });
    // feltro e as tabelas (bordas de feltro um tom abaixo)
    const m = .3, z = 38.05;
    ISO.plane(ctx, x + m, y + m, w - 2 * m, d - 2 * m, z, '#145a3c');
    ISO.plane(ctx, x + m, y + m, w - 2 * m, .07, z + .1, '#0e4a30');
    ISO.plane(ctx, x + m, y + m, .07, d - 2 * m, z + .1, '#0e4a30');
    ISO.plane(ctx, x + m, y + d - m - .06, w - 2 * m, .06, z + .1, '#1b6a47');
    ISO.plane(ctx, x + w - m - .06, y + m, .06, d - 2 * m, z + .1, '#1b6a47');
    ISO.plane(ctx, x + w * .25 - .01, y + m, .02, d - 2 * m, z + .12, 'rgba(255,255,255,.12)');   // linha de saída
    // marcadores de madrepérola no trilho
    for (let i = 1; i < 8; i++) if (i !== 4) {
      for (const yy of [y + .14, y + d - .14]) { const p = S(x + w * i / 8, yy, 38); ctx.fillStyle = '#efe6d2'; ctx.fillRect(p.x - .8, p.y - .4, 1.6, .8); }
    }
    for (let i = 1; i < 4; i++) for (const xx of [x + .14, x + w - .14]) {
      const p = S(xx, y + d * i / 4, 38); ctx.fillStyle = '#efe6d2'; ctx.fillRect(p.x - .8, p.y - .4, 1.6, .8);
    }
    // caçapas: boca preta e cantoneira de latão
    for (const [px, py] of [[m, m], [w / 2, m - .04], [w - m, m], [m, d - m], [w / 2, d - m + .04], [w - m, d - m]]) {
      const p = S(x + px, y + py, z + .2);
      ctx.fillStyle = '#b8964f'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 7.4, 3.9, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#0b0b0c'; ctx.beginPath(); ctx.ellipse(p.x, p.y + .3, 5.6, 2.9, 0, 0, 7); ctx.fill();
    }
    // taco deitado na mesa e o giz no trilho
    const t0 = S(x + .75, y + d - .55, z + 1.2), t1 = S(x + 2.9, y + .85, z + 1.2);
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(t0.x, t0.y + 1.6); ctx.lineTo(t1.x, t1.y + 1.6); ctx.stroke();
    const gt = ctx.createLinearGradient(t0.x, t0.y, t1.x, t1.y);
    gt.addColorStop(0, '#1a1210'); gt.addColorStop(.35, '#3a2418'); gt.addColorStop(.38, '#d9c39a'); gt.addColorStop(1, '#e8d8b6');
    ctx.strokeStyle = gt; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(t0.x, t0.y); ctx.lineTo(t1.x, t1.y); ctx.stroke();
    ctx.restore();
    ISO.box(ctx, x + w - .26, y + .06, .1, .1, 2, 38, '#3d6fa8', { top: '#5a8cc4' });
    // as bolas, do fundo para a frente
    [['#f4f2ec', .7, .62], ['#e8b923', 2.85, 1.05], ['#b3261e', 3.2, 1.38],
     ['#1f3f8f', 3.45, .92], ['#111111', 3.0, 1.72], ['#d9772b', 3.62, 1.62], ['#2f6b3a', 3.75, 1.15]]
      .sort((a, b) => (a[1] + a[2]) - (b[1] + b[2]))
      .forEach(([c, bx, by]) => {
        const p = S(x + bx, y + by, z);
        ctx.fillStyle = 'rgba(0,0,0,.32)';
        ctx.beginPath(); ctx.ellipse(p.x + 1, p.y + 1.6, 5.4, 2.8, 0, 0, 7); ctx.fill();
        const g = ctx.createRadialGradient(p.x - 1.8, p.y - 5, .8, p.x, p.y - 3, 6.4);
        g.addColorStop(0, ISO.shade(c, .55)); g.addColorStop(.5, c); g.addColorStop(1, ISO.shade(c, -.35));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y - 3, 4.6, 0, 7); ctx.fill();
      });
  }

  function pintaPebolim(ctx, o) {
    const { x, y, w, d } = o;
    const NOG = '#4a2c18', NOG_T = '#5c3820', NOG_D = '#36200f';
    ISO.shadow(ctx, x + w / 2, y + d / 2, 2.2, .28);
    [[.12, .12], [w - .52, .12], [.12, d - .52], [w - .52, d - .52]].forEach(([px, py]) =>
      ISO.box(ctx, x + px, y + py, .4, .4, 24, 0, '#2e1a0c', { top: '#3a2210' }));
    ISO.box(ctx, x, y, w, d, 12, 24, NOG, { top: NOG_T, left: NOG, right: NOG_D, line: 'rgba(20,10,4,.45)' });
    // campo verde-musgo com as linhas
    const z = 34.2, m = .16;
    ISO.plane(ctx, x + m, y + m, w - 2 * m, d - 2 * m, z, '#2f6a40');
    const L = 'rgba(240,240,232,.55)';
    ISO.plane(ctx, x + w / 2 - .015, y + m, .03, d - 2 * m, z + .05, L);
    ISO.plane(ctx, x + m, y + m, w - 2 * m, d - 2 * m, z + .05, null, L);
    for (const gx of [x + m, x + w - m - .45]) ISO.plane(ctx, gx, y + d / 2 - .45, .45, .9, z + .05, null, L);
    const pc = S(x + w / 2, y + d / 2, z + .05);
    ctx.save(); ctx.translate(pc.x, pc.y); ctx.scale(1, .5);
    ctx.strokeStyle = L; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 13, 0, 7); ctx.stroke();
    ctx.restore();
    // gol do lado da câmera e o placar de contas
    faceY(ctx, x, y + d, w, 36, (c, len) => {
      c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(0, 10, len, .8);
    });
    for (let k = 0; k < 9; k++) {
      const p = S(x + .5 + k * .1, y + .05, 36.4);
      ctx.fillStyle = k < 3 ? '#e8e1d0' : k > 6 ? '#2b2e34' : '#8a6a48';
      ctx.beginPath(); ctx.arc(p.x, p.y - .8, 1.1, 0, 7); ctx.fill();
    }
    // varões cromados, jogadores e manoplas, do fundo (x menor) para a frente
    const nv = 6;
    for (let i = 0; i < nv; i++) {
      const bx = x + .45 + i * ((w - .9) / (nv - 1));
      const time = (i === 0 || i === 1 || i === 3) ? 0 : 1;          // goleiro, zaga, ataque…
      const corJ = time ? '#2b2e34' : '#e8e1d0', corC = time ? '#1b1d21' : '#f4efe4';
      const nj = i === 0 || i === nv - 1 ? 1 : i % 2 ? 3 : 2;
      ISO.box(ctx, bx - .03, y - .3, .06, .3, 3, 41, '#c3c9d1', { line: 'rgba(0,0,0,.2)' });
      ISO.box(ctx, bx - .05, y - .52, .1, .22, 4, 40.5, '#151619', { line: 'rgba(0,0,0,.3)' });   // manopla
      for (let j = 0; j < nj; j++) {
        const py = y + d / 2 + (j - (nj - 1) / 2) * ((d - .7) / Math.max(1, nj - 1)) * (nj > 1 ? 1 : 0);
        ISO.box(ctx, bx - .05, py - .07, .1, .14, 9, z - 2, corJ, { top: ISO.shade(corJ, .15), line: 'rgba(0,0,0,.3)' });
        ISO.cyl(ctx, bx, py, .055, 3.6, z + 7, corC);
      }
      ISO.box(ctx, bx - .03, y, .06, d, 3, 41, '#c3c9d1', { top: '#e2e6ea', line: 'rgba(0,0,0,.2)' });
      ISO.box(ctx, bx - .03, y + d, .06, .32, 3, 41, '#c3c9d1', { top: '#e2e6ea', line: 'rgba(0,0,0,.2)' });
      ISO.box(ctx, bx - .05, y + d + .32, .1, .24, 4, 40.5, '#151619', { top: '#2a2c31', line: 'rgba(0,0,0,.3)' });
    }
    const pb = S(x + w / 2 + .3, y + d / 2 + .1, z);
    ctx.fillStyle = '#f6f4ee'; ctx.beginPath(); ctx.arc(pb.x, pb.y - 1.4, 1.5, 0, 7); ctx.fill();
  }

  function pintaSofa(ctx, o) {
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
        // costuras verticais do encosto, uma por almofada
        faceY(ctx, x, y + d, w, 50, (g, len) => {
          g.fillStyle = 'rgba(0,0,0,.16)';
          for (let i = 1; i < 3; i++) g.fillRect(len * i / 3 - .4, 3, .8, 30);
          g.fillStyle = 'rgba(255,230,200,.06)'; g.fillRect(0, .5, len, 1);
        });
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
  }

  /** manta de tricô jogada no encosto do sofá (sofá 's': encosto na frente) */
  function mantaSofa(ctx, o) {
    const { x, y, w, d } = o;
    const u0 = x + w * .6, u1 = u0 + .72, yb = y + d - .42, yf = y + d + .015;
    const COR = '#cbbfa6';
    // por cima do encosto
    ISO.quad(ctx, [S(u0, yb, 50.4), S(u1, yb, 50.4), S(u1, yf, 50.4), S(u0, yf, 50.4)], COR, 'rgba(0,0,0,.08)');
    // caindo pela frente, com a barra ondulada
    const a = S(u0, yf, 50.4), b = S(u1, yf, 50.4);
    ctx.fillStyle = ISO.shade(COR, -.08);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.lineTo(b.x + .6, b.y + 20);
    for (let k = 1; k <= 6; k++) {
      const f = k / 6;
      ctx.quadraticCurveTo(b.x + (a.x - b.x) * (f - .08), b.y + (a.y - b.y) * (f - .08) + 23 + (k % 2) * 1.6,
                           b.x + (a.x - b.x) * f + .2, b.y + (a.y - b.y) * f + 21.5);
    }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(80,64,40,.22)'; ctx.lineWidth = .6;
    for (let k = 1; k < 7; k++) {
      const f = k / 7, px = a.x + (b.x - a.x) * f, py = a.y + (b.y - a.y) * f;
      ctx.beginPath(); ctx.moveTo(px, py + 1); ctx.lineTo(px + .3, py + 20); ctx.stroke();
    }
  }

  function pintaBar(ctx, o) {
    const { x, y, w, d } = o;
    ISO.shadow(ctx, x + w / 2, y + d / 2, 2.3, .3);
    ISO.box(ctx, x, y, w, d, 42, 0, '#4a3322', { top: '#5a3d27' });
    ISO.box(ctx, x - .05, y - .05, w + .1, d + .1, 4, 42, '#bdb6aa', { top: '#d8d2c6' });
    faceY(ctx, x, y + d + .05, w, 40, (c, len) => {
      c.fillStyle = 'rgba(0,0,0,.18)';
      for (let i = 6; i < len; i += 8) c.fillRect(i, 2, 1.4, 36);
    });
    // espresso de inox com o grupo e a bandeja, moedor, xícaras e a fruteira
    ISO.box(ctx, x + .5, y + .3, .9, .7, 22, 46, '#c3c9d1', { top: '#3a3e45', left: '#aab1ba', right: '#8f969f' });
    faceY(ctx, x + .5, y + 1.0, .9, 66, (c, len) => {
      c.fillStyle = '#1d2026'; c.fillRect(len * .3, 3, len * .4, 4);
      c.fillStyle = '#00b3ff'; c.fillRect(len * .34, 4.4, 3, 1.2);
    });
    ISO.box(ctx, x + .62, y + 1.0, .66, .14, 2.5, 47, '#2a2d33');
    ISO.box(ctx, x + .8, y + 1.0, .3, .1, 3, 55, '#3a3e45');
    ISO.cyl(ctx, x + .95, y + 1.08, .06, 4, 49.5, '#f3f1ec');
    ISO.cyl(ctx, x + 1.9, y + .6, .14, 20, 46, '#24262b');
    ISO.cyl(ctx, x + 1.9, y + .6, .1, 4, 66, '#5a3a26');                    // café em grão no funil
    vidro(ctx, x + 1.9, y + .6, .12, 9, 66, 0, '220,200,180');
    for (let i = 0; i < 4; i++) {
      ISO.cyl(ctx, x + 3.0 + i * .4, y + .55, .1, .8, 46, '#e4e1da');
      ISO.cyl(ctx, x + 3.0 + i * .4, y + .55, .07, 5, 46.8, '#f4f2ed');
    }
    ISO.cyl(ctx, x + w - .6, y + .6, .22, 4, 46, '#2b2e33');
    [['#e08a2e', -.06, .02], ['#7fb04a', .08, -.04], ['#e8962f', .02, .08]].forEach(([cor, dx, dy]) => {
      const p = S(x + w - .6 + dx, y + .6 + dy, 50);
      ctx.fillStyle = cor; ctx.beginPath(); ctx.arc(p.x, p.y - 2, 2.6, 0, 7); ctx.fill();
    });
  }

  function pintaGeladeira(ctx, o) {
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
  }

  function pintaRack(ctx, o) {
    const { x, y, w, d } = o;
    const H = 86;
    ISO.shadow(ctx, x + w / 2, y + d / 2, .75, .3);
    ISO.box(ctx, x, y, w, d, H, 0, '#1d2026', { top: '#2b2f36', left: '#1d2026', right: '#16181c', line: 'rgba(0,0,0,.4)' });
    // porta de chapa perfurada, puxador e a placa com o nome
    faceY(ctx, x + .08, y + d, w - .16, H - 4, (c, len) => {
      const Hp = H - 12;
      c.fillStyle = '#23262c'; c.fillRect(0, 8, len, Hp);
      c.fillStyle = 'rgba(0,0,0,.55)';
      for (let v = 11; v < Hp + 6; v += 2.2) for (let u = 2 + (v % 4.4 < 2.2 ? 0 : 1.1); u < len - 9; u += 2.2) c.fillRect(u, v, .9, .9);
      c.fillStyle = '#4a4f57'; c.fillRect(len - 4.5, 30, 1.2, 16);
      c.fillStyle = '#121418'; c.fillRect(2, 1, len - 4, 5.5);
      c.textAlign = 'left'; c.textBaseline = 'middle';
      c.font = "700 4.2px 'Barlow Semi Condensed', sans-serif";
      c.fillStyle = '#dfe6ee'; c.fillText(o.label, 4, 3.9);
      c.fillStyle = '#00b3ff'; c.fillRect(len - 9, 3.2, 4, 1.2);
    });
    faceX(ctx, x + w, y, d, H - 6, (c, len) => {
      c.fillStyle = 'rgba(0,0,0,.25)';
      for (let v = 6; v < H - 12; v += 5) c.fillRect(6, v, len - 12, 1.4);
    });
  }

  /** superfície virada para +x, com u nascendo na ponta sul (ver faceY) */
  function faceX(ctx, xPlane, y, lenTiles, topZ, fn) {
    const o = S(xPlane, y + lenTiles, topZ);
    ctx.save();
    ctx.transform(ISO.HW / ISO.TW, -ISO.HH / ISO.TW, 0, 1, o.x, o.y);
    fn(ctx, lenTiles * ISO.TW);
    ctx.restore();
  }

  function pintaPlanta(ctx, o) {
    const cx = o.x + .5, cy = o.y + .5;
    const vaso = o.k ? '#d6d0c4' : '#2f3238';
    ISO.shadow(ctx, cx, cy, .45, .26);
    ISO.cyl(ctx, cx, cy, .27, 18, 0, vaso);
    ISO.cyl(ctx, cx, cy, .285, 2, 17, ISO.shade(vaso, .1));
    ISO.cyl(ctx, cx, cy, .24, .4, 18.6, '#2a1d14');
    const b = S(cx, cy, 19);
    const folha = (bx, by, tx, ty, larg, cor, nervura) => {
      const mx = (bx + tx) / 2, my = (by + ty) / 2, dx = tx - bx, dy = ty - by, L = Math.hypot(dx, dy) || 1;
      const nx = -dy / L * larg, ny = dx / L * larg;
      ctx.fillStyle = cor;
      ctx.beginPath(); ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(mx + nx, my + ny, tx, ty); ctx.quadraticCurveTo(mx - nx, my - ny, bx, by); ctx.fill();
      if (nervura) { ctx.strokeStyle = nervura; ctx.lineWidth = .5; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(mx + dx * .3, my + dy * .3); ctx.stroke(); }
    };
    if (o.k) {
      // seringueira: caule e folhas ovais escuras e brilhantes
      ctx.strokeStyle = '#4a3a2a'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + 1, b.y - 34); ctx.stroke();
      const fol = [[-9, -14, -1], [9, -18, 1], [-8, -26, -1], [10, -29, 1], [-6, -36, -1], [6, -40, 1], [0, -45, 0], [-11, -20, -1], [11, -24, 1]];
      fol.forEach(([dx, dy, s2], i) => {
        const bx = b.x + s2 * 1.5, by = b.y + dy * .78;
        folha(bx, by, b.x + dx, b.y + dy, 4.6, ['#2f5e3a', '#3a6f45', '#28523a'][i % 3], 'rgba(160,200,150,.35)');
      });
      return;
    }
    // espada-de-são-jorge: folhas eretas com a borda amarelada
    const alt = [44, 52, 38, 48, 34, 42, 30];
    alt.forEach((h, i) => {
      const dx = (i - 3) * 2.2, inc = (i - 3) * 1.4;
      folha(b.x + dx * .5, b.y, b.x + dx + inc, b.y - h, 3.4, '#b9b46a');
      folha(b.x + dx * .5, b.y, b.x + dx + inc, b.y - h + 1.5, 2.6, ['#3e6b45', '#4b7a50', '#36603e'][i % 3]);
    });
  }

  function pintaPoltrona(ctx, o) {
    const { x, y, w, d } = o;
    const c = o.c || '#3b2a1f';
    const f = o.face || 'n';
    if (o.camada !== 'frente') ISO.shadow(ctx, x + w / 2, y + d / 2, Math.max(w, d) * .55, .28);
    const esp = .3, br = .22;
    // pés, assento e depois encosto e braços, do fundo para a frente
    if (o.camada !== 'frente') {
      [[.1, .1], [w - .2, .1], [.1, d - .2], [w - .2, d - .2]]
        .forEach(([px, py]) => ISO.box(ctx, x + px, y + py, .1, .1, 6, 0, '#1a1410'));
      ISO.box(ctx, x + .04, y + .04, w - .08, d - .08, 9, 6, ISO.shade(c, -.14), { top: ISO.shade(c, .08) });
      // almofada do assento, um pouco recuada, com o vivo claro na borda
      ISO.box(ctx, x + .08, y + .08, w - .16, d - .16, 3.4, 15, ISO.shade(c, -.02), { top: ISO.shade(c, .16) });
      ISO.plane(ctx, x + .08, y + .08, w - .16, d - .16, 18.45, null, ISO.rgba(ISO.shade(c, .35), .35));
    }
    const enc = f === 'n' ? [x, y + d - esp, w, esp] : f === 's' ? [x, y, w, esp]
              : f === 'e' ? [x, y, esp, d]          : [x + w - esp, y, esp, d];
    const bracos = (f === 'n' || f === 's')
      ? [[x, y, br, d], [x + w - br, y, br, d]]
      : [[x, y, w, br], [x, y + d - br, w, br]];
    const pecas = [[enc[0] + enc[2] / 2 + enc[1] + enc[3] / 2, 'enc', () => {
      ISO.box(ctx, enc[0], enc[1], enc[2], enc[3], 30, 6, c, { top: ISO.shade(c, .18) });
      ISO.plane(ctx, enc[0] + .02, enc[1] + .02, enc[2] - .04, enc[3] - .04, 36.1, null, ISO.rgba(ISO.shade(c, .4), .3));
    }]];
    for (const b of bracos) pecas.push([b[0] + b[2] / 2 + b[1] + b[3] / 2, 'braco', () => {
      ISO.box(ctx, b[0], b[1], b[2], b[3], 17, 6, ISO.shade(c, .04), { top: ISO.shade(c, .2) });
      ISO.plane(ctx, b[0] + .02, b[1] + .02, b[2] - .04, b[3] - .04, 23.1, null, ISO.rgba(ISO.shade(c, .4), .3));
    }]);
    // de costas ('n'/'w') o encosto fica entre quem senta e a câmera: ele é
    // pintado numa camada própria, depois do boneco
    const cm = o.camada;
    pecas.sort((a, b) => a[0] - b[0]).forEach(p => {
      if (cm === 'frente' && p[1] !== 'enc') return;
      if (cm === 'base' && p[1] === 'enc') return;
      p[2]();
    });
  }

  function pintaXadrez(ctx, o) {
    const { x, y, w, d } = o;
    ISO.shadow(ctx, x + w / 2, y + d / 2, .7, .28);
    ISO.cyl(ctx, x + w / 2, y + d / 2, .35, 2, 0, '#2a1b12');
    ISO.cyl(ctx, x + w / 2, y + d / 2, .12, 22, 0, '#2a1b12');
    ISO.box(ctx, x, y, w, d, 3, 22, '#4a3322', { top: '#5a3d27' });
    const n = 8, k = (w - .2) / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++)
      ISO.plane(ctx, x + .1 + i * k, y + .1 + j * k, k, k, 25.1, (i + j) % 2 ? '#2b1d14' : '#e6dcc8');
    // peças: peões baixos e as maiores com a cabeça
    const pecas = [[1, 0, 0, 1], [3, 1, 0, 0], [4, 1, 0, 0], [6, 0, 0, 1], [4, 0, 0, 2],
                   [2, 6, 1, 0], [4, 6, 1, 0], [3, 7, 1, 2], [5, 4, 0, 1], [2, 3, 1, 1], [6, 7, 1, 1]];
    pecas.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]));
    for (const [i, j, preta, tipo] of pecas) {
      const cor = preta ? '#1d1610' : '#f2efe8';
      const px = x + .1 + (i + .5) * k, py = y + .1 + (j + .5) * k;
      const h = tipo === 2 ? 6.5 : tipo === 1 ? 4.8 : 2.8;
      ISO.cyl(ctx, px, py, k * .38, 1.3, 25.1, cor);
      ISO.cyl(ctx, px, py, k * .27, h, 26.4, cor);
      const p = S(px, py, 26.4 + h);
      ctx.fillStyle = ISO.shade(cor, preta ? .22 : -.06);
      ctx.beginPath(); ctx.arc(p.x, p.y - 1.2, tipo ? 2.3 : 1.9, 0, 7); ctx.fill();
      if (tipo === 2) { ctx.fillRect(p.x - .4, p.y - 5.6, .8, 2.6); ctx.fillRect(p.x - 1.2, p.y - 4.9, 2.4, .7); }
    }
  }

  const LIVROS = ['#e8e1d0', '#2a3a52', '#c9b48c', '#2b2d31', '#41594a', '#f1eee7',
                  '#8c4b32', '#1c2733', '#a07c4c', '#5a6b7a', '#3a2a22', '#b9a27a'];
  function pintaEstante(ctx, o) {
    const { x, y, w, d } = o;
    ISO.shadow(ctx, x + w / 2, y + d / 2, 1.3, .3);
    ISO.box(ctx, x, y, w, d, 132, 0, '#3e2a1b', { top: '#5a3d27' });
    // nichos (face virada para a câmera, plano y + d)
    faceY(ctx, x, y + d, w, 132, (c, len) => {
      c.fillStyle = '#1a120c'; c.fillRect(4, 4, len - 8, 124);
      for (let r = 0; r < 4; r++) {
        const y0 = 6 + r * 31;
        c.fillStyle = '#5a3d27'; c.fillRect(4, y0 + 27, len - 8, 4);
        let xx = 8, i = r * 5;
        while (xx < len - 14) {
          if ((r === 1 && xx > len * .55 && xx < len * .8) || (r === 3 && xx > len * .3 && xx < len * .55) ||
              (r === 2 && xx > len * .68 && xx < len * .9)) { xx += 8; continue; }
          const bw = 3 + (i * 7 % 4), bh = 16 + (i * 5 % 9);
          c.fillStyle = LIVROS[(i * 5 + r) % LIVROS.length];
          c.fillRect(xx, y0 + 27 - bh, bw, bh);
          c.fillStyle = 'rgba(255,255,255,.10)'; c.fillRect(xx, y0 + 27 - bh, .6, bh);
          xx += bw + .8; i++;
        }
      }
      // porta-retrato do carro numa prateleira
      BMW.miniatura(c, len * .54, 6 + 31 + 27, 26);
      // troféu pequeno
      c.fillStyle = '#c9a227'; c.fillRect(len * .36, 6 + 93 + 12, 6, 15);
      c.beginPath(); c.arc(len * .36 + 3, 6 + 93 + 11, 6, Math.PI, 0); c.fill();
      // vasinho com uma planta na terceira prateleira
      const vx = len * .79, vb = 6 + 62 + 27;
      c.fillStyle = '#d6d0c4'; c.fillRect(vx - 4, vb - 9, 8, 9);
      c.fillStyle = '#3e6b45';
      for (const [dx, dy, r] of [[-4, -13, 3.4], [3, -14, 3.2], [0, -18, 3], [-2, -10, 2.6], [4, -10, 2.4]]) {
        c.beginPath(); c.ellipse(vx + dx, vb + dy, r, r * .7, 0, 0, 7); c.fill();
      }
    });
  }

  /* ===========================================================
     RECEPÇÃO (ver DRAW.reception)
     =========================================================== */
  /** copo, jarra ou funil de vidro: corpo translúcido, a água até a fração
      "agua" da altura, a boca e um reflexo. (ISO.cyl só aceita cor em
      hex: com rgba a sombra dele sai preta, e o vidro virava um tubo.) */
  function vidro(ctx, cx, cy, r, h, z, agua = 0, tom = '200,225,245') {
    const rx = r * ISO.HW, ry = r * ISO.HH;
    const corpo = (z0, z1, cor) => {
      const b = S(cx, cy, z0), t = S(cx, cy, z1);
      ctx.fillStyle = cor;
      ctx.beginPath(); ctx.moveTo(b.x - rx, b.y); ctx.lineTo(t.x - rx, t.y);
      ctx.ellipse(t.x, t.y, rx, ry, 0, Math.PI, 0, true); ctx.lineTo(b.x + rx, b.y);
      ctx.ellipse(b.x, b.y, rx, ry, 0, 0, Math.PI, false); ctx.closePath(); ctx.fill();
    };
    corpo(z, z + h, `rgba(${tom},.20)`);
    if (agua > 0) {
      corpo(z, z + h * agua, 'rgba(140,190,225,.30)');
      const w = S(cx, cy, z + h * agua);
      ctx.fillStyle = 'rgba(190,225,248,.42)';
      ctx.beginPath(); ctx.ellipse(w.x, w.y, rx * .96, ry * .96, 0, 0, 7); ctx.fill();
    }
    const t = S(cx, cy, z + h), b = S(cx, cy, z);
    ctx.strokeStyle = 'rgba(235,245,255,.6)'; ctx.lineWidth = .6;
    ctx.beginPath(); ctx.ellipse(t.x, t.y, rx, ry, 0, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(t.x - rx * .6, t.y + .6, .7, Math.max(0, b.y - t.y - 1.2));
  }

  /** orquídea branca num cachepô de cerâmica, apoiada em z */
  function orquidea(ctx, ox, oy, z, s = 1) {
    ISO.cyl(ctx, ox, oy, .11 * s, 7 * s, z, '#e9e6df');
    const b = S(ox, oy, z + 7 * s);
    [['#3d7a4a', -4, 1.4, -.5], ['#4b8a55', 4, 1.2, .5], ['#356b41', -1, 2.4, -.1]].forEach(([cor, dx, dy, r]) => {
      ctx.fillStyle = cor; ctx.beginPath(); ctx.ellipse(b.x + dx * s, b.y + (dy - 1) * s, 4.2 * s, 1.6 * s, r, 0, 7); ctx.fill();
    });
    ctx.strokeStyle = '#5c6b3e'; ctx.lineWidth = .7;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.quadraticCurveTo(b.x - s, b.y - 12 * s, b.x + 5 * s, b.y - 17 * s); ctx.stroke();
    [[1.4, -11], [3, -14], [5, -16.6], [-.6, -8]].forEach(([dx, dy]) => {
      ctx.fillStyle = '#f6f2f4'; ctx.beginPath(); ctx.arc(b.x + dx * s, b.y + dy * s, 2 * s, 0, 7); ctx.fill();
      ctx.fillStyle = '#d6a4be'; ctx.beginPath(); ctx.arc(b.x + dx * s, b.y + dy * s, .7 * s, 0, 7); ctx.fill();
    });
  }

  function balcaoRecepcao(ctx, o) {
    const { x, y, w, d } = o;
    const yf = y + .38, Z = 38;
    const CARV = '#b49674', CARV_E = '#a98a63', CARV_D = '#8f7353';
    ISO.shadow(ctx, x + w / 2, y + d / 2 + .1, 1.7, .22);
    // luz quente rasante saindo do rodapé recuado
    ISO.plane(ctx, x - .05, y + d - .02, w + .1, .22, .2, 'rgba(255,212,150,.10)');
    ISO.box(ctx, x + .05, yf + .05, w - .1, d - .38 - .1, 3, 0, '#141518', { line: 'rgba(0,0,0,.3)' });
    // traseira do monitor de quem atende, por trás do tampo
    ISO.box(ctx, x + .85, y + .14, .78, .05, 22, Z - 6, '#2b2e34', { top: '#3a3e45', line: 'rgba(0,0,0,.35)' });
    ISO.box(ctx, x + 1.18, y + .19, .12, .1, 10, Z - 6, '#24272c');
    // corpo do balcão
    ISO.box(ctx, x, yf, w, d - .38, Z - 3, 3, CARV_E, { top: CARV, left: CARV_E, right: CARV_D, line: 'rgba(60,40,20,.35)' });
    faceY(ctx, x, y + d, w, Z, (c, len) => {
      const H = Z - 3;
      for (let i = 2; i < len - 1; i += 3.2) {                       // ripas
        c.fillStyle = 'rgba(60,38,18,.30)'; c.fillRect(i, 0, .7, H);
        c.fillStyle = 'rgba(255,236,210,.07)'; c.fillRect(i + .8, 0, .9, H);
      }
      // faixa grafite com o logo
      const fx = len * .2, fw = len * .6, fy = 9, fh = 15;
      c.fillStyle = '#1b1d22'; c.fillRect(fx, fy, fw, fh);
      c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(fx, fy, fw, .7);
      if (NASSA.pronto(NASSA.logo)) {
        const im = NASSA.logo, k = Math.min((fw - 10) / im.naturalWidth, (fh - 5) / im.naturalHeight);
        const lw = im.naturalWidth * k, lh = im.naturalHeight * k;
        c.save(); c.shadowColor = 'rgba(0,179,255,.45)'; c.shadowBlur = 5;
        c.drawImage(im, fx + (fw - lw) / 2, fy + (fh - lh) / 2, lw, lh);
        c.restore();
      } else {
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.font = "700 7px 'Barlow Semi Condensed', sans-serif";
        c.fillStyle = 'rgba(233,237,248,.9)'; c.fillText('NASSA TECH', len / 2, fy + fh / 2);
      }
    });
    // tampo de quartzo, com a pingadeira sobre a frente
    ISO.box(ctx, x - .04, y + .3, w + .08, d - .3 + .08, 3, Z, '#d9d6cf', { top: '#efeeea', left: '#dcd9d2', right: '#c6c2ba', line: 'rgba(0,0,0,.18)' });
    orquidea(ctx, x + .32, y + .66, Z + 3);
    // tablet de check-in num suporte, virado para quem chega
    const tx = x + w - .78;
    ISO.box(ctx, tx + .12, y + .62, .2, .14, 2, Z + 3, '#3a3e45');
    ISO.box(ctx, tx, y + .74, .44, .04, 11, Z + 4.5, '#1b1d22', { top: '#2b2e34', line: 'rgba(0,0,0,.4)' });
    faceY(ctx, tx + .03, y + .78, .38, Z + 14.5, (c, len) => {
      c.fillStyle = '#0d1520'; c.fillRect(0, 0, len, 9);
      c.fillStyle = '#00b3ff'; c.fillRect(len * .2, 2, len * .6, 1.4);
      c.fillStyle = 'rgba(220,230,245,.55)'; c.fillRect(len * .25, 4.6, len * .5, .8); c.fillRect(len * .3, 6.2, len * .4, .8);
    });
  }

  /* ===========================================================
     MESA DE REUNIÃO (ver DRAW.meetTable)
     =========================================================== */
  /** desenha no plano do chão, na altura z, com (u, v) em tiles */
  function noChao(ctx, z, fn) {
    const p = S(0, 0, z);
    ctx.save();
    ctx.transform(ISO.HW, ISO.HH, -ISO.HW, ISO.HH, p.x, p.y);
    ctx.beginPath(); fn(ctx);
    ctx.restore();
  }
  /** retângulo de cantos arredondados no plano do chão (tiles) */
  function retArred(c, x, y, w, d, r) {
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + d - r); c.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
    c.lineTo(x + r, y + d); c.quadraticCurveTo(x, y + d, x, y + d - r);
    c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }

  function mesaReuniao(ctx, o) {
    const { x, y, w, d } = o;
    const R = .42, Z0 = TOP - 3.4;
    const forma = (k = 0) => c => retArred(c, x + k, y + k, w - 2 * k, d - 2 * k, Math.max(.05, R - k));

    ISO.shadow(ctx, x + w / 2, y + d / 2 + .1, 3.4, .22);
    noChao(ctx, .3, forma(.3)); ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fill();

    // pés de chapa grafite, com a viga entre eles e as sapatas no piso
    for (const px of [x + 1.05, x + w - 1.25]) {
      ISO.box(ctx, px - .08, y + .55, .36, d - 1.1, 1.2, 0, '#1b1d21', { line: 'rgba(0,0,0,.3)' });
      ISO.box(ctx, px, y + .62, .2, d - 1.24, Z0 - 1.2, 1.2, '#2c3036',
              { top: '#3a3e45', left: '#2c3036', right: '#202328', line: 'rgba(0,0,0,.3)' });
    }
    ISO.box(ctx, x + 1.25, y + d / 2 - .06, w - 2.5, .12, 3, Z0 - 4, '#25282d', { line: 'rgba(0,0,0,.3)' });

    // borda do tampo: a mesma forma empilhada, clara na face +y e escura na +x
    const cE = S(x + w, y + d).x;
    const xa = S(x, y + d).x, xb = S(x + w, y).x;
    const g = ctx.createLinearGradient(xa, 0, xb, 0);
    const tq = (cE - xa) / (xb - xa);
    g.addColorStop(0, '#4a3020'); g.addColorStop(Math.max(0, tq - .03), '#4f3322');
    g.addColorStop(Math.min(1, tq + .03), '#342116'); g.addColorStop(1, '#2c1c12');
    for (let z = Z0; z < TOP; z += .7) { noChao(ctx, z, forma()); ctx.fillStyle = g; ctx.fill(); }

    // tampo de nogueira: veio ao longo da mesa e um brilho suave
    noChao(ctx, TOP, forma()); ctx.fillStyle = '#6b4830'; ctx.fill();
    ctx.save();
    noChao(ctx, TOP, forma()); ctx.clip();
    for (let i = 0; i < 18; i++) {
      const vy = y + .1 + i * (d - .2) / 17 + Math.sin(i * 2.3) * .03;
      ISO.plane(ctx, x, vy, w, .02 + (i % 3) * .008, TOP + .02, i % 2 ? 'rgba(40,22,10,.22)' : 'rgba(120,80,48,.18)');
    }
    const p0 = S(x + w * .2, y, TOP), p1 = S(x + w * .8, y + d, TOP);
    const br = ctx.createLinearGradient(p0.x, p0.y, p1.x, p1.y);
    br.addColorStop(0, 'rgba(255,230,200,.0)'); br.addColorStop(.45, 'rgba(255,230,200,.07)'); br.addColorStop(1, 'rgba(255,230,200,0)');
    ctx.fillStyle = br; ctx.fillRect(xa - 10, p0.y - 200, xb - xa + 20, 400);
    ctx.restore();
    noChao(ctx, TOP, forma(.012)); ctx.strokeStyle = 'rgba(255,225,190,.16)'; ctx.lineWidth = .7; ctx.stroke();

    const cx = x + w / 2, cy = y + d / 2;
    // caixas de tomada embutidas, de alumínio escovado
    for (const ux of [cx - 1.75, cx + 1.75]) {
      ISO.plane(ctx, ux - .42, cy - .15, .84, .3, TOP + .08, '#1f2125');
      ISO.plane(ctx, ux - .38, cy - .12, .76, .24, TOP + .12, '#aab1ba');
      ISO.plane(ctx, ux - .38, cy - .005, .76, .01, TOP + .14, 'rgba(0,0,0,.35)');
      for (let k = 0; k < 3; k++) ISO.plane(ctx, ux - .26 + k * .2, cy + .04, .08, .04, TOP + .15, '#3a3e45');
    }
    // viva-voz de conferência: disco preto, grade e o anel de LED da marca
    ISO.cyl(ctx, cx, cy, .3, 1.4, TOP, '#16181c');
    ISO.cyl(ctx, cx, cy, .27, .8, TOP + 1.4, '#1f2227');
    const pc = S(cx, cy, TOP + 2.25);
    ctx.save();
    ctx.translate(pc.x, pc.y); ctx.scale(1, .5);
    ctx.strokeStyle = 'rgba(0,179,255,.75)'; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.arc(0, 0, 13.6, 0, 7); ctx.stroke();
    ctx.fillStyle = '#2b2f36';
    for (let a = 0; a < 6; a++) for (let r = 3; r < 11; r += 3.4) {
      const ang = a * Math.PI / 3 + r * .2;
      ctx.beginPath(); ctx.arc(Math.cos(ang) * r, Math.sin(ang) * r, .9, 0, 7); ctx.fill();
    }
    ctx.restore();

    // o que ficou em cada lugar
    const bloco = (bx, by) => {
      ISO.box(ctx, bx, by, .34, .44, .9, TOP, '#e9e6de', { top: '#f3f1ec', line: 'rgba(0,0,0,.18)' });
      for (let k = 1; k < 5; k++) ISO.plane(ctx, bx + .05, by + k * .08, .24, .008, TOP + 1, 'rgba(70,90,120,.35)');
      ISO.box(ctx, bx + .38, by + .04, .03, .36, .8, TOP, '#1b1c1f', { line: 'rgba(0,0,0,0)' });
    };
    const copo = (gx, gy) => {
      ISO.cyl(ctx, gx, gy, .085, .4, TOP, '#2a2d33');                    // porta-copo
      vidro(ctx, gx, gy, .065, 8, TOP + .4, .6);
    };
    const xicara = (gx, gy) => {
      ISO.cyl(ctx, gx, gy, .13, .8, TOP, '#ecebe6');
      ISO.cyl(ctx, gx, gy, .07, 4.6, TOP + .8, '#f6f5f1');
      const pp = S(gx, gy, TOP + 5.4);
      ctx.fillStyle = '#3b2418'; ctx.beginPath(); ctx.ellipse(pp.x, pp.y, 3, 1.5, 0, 0, 7); ctx.fill();
    };
    const notebook = (bx, by) => {
      ISO.box(ctx, bx, by, .62, .42, 1.3, TOP, '#9aa1aa', { top: '#c3c8cf', line: 'rgba(0,0,0,.25)' });
      const pl = S(bx + .31, by + .21, TOP + 1.35);
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(pl.x, pl.y, 1.6, .8, 0, 0, 7); ctx.fill();
    };
    const pecas = [
      [36.8 - .55, 26.22, b => bloco(...b)], [36.8 + .28, 26.36, b => copo(...b)],
      [38.8 + .3, 26.34, b => xicara(...b)],
      [40.8 - .55, 26.22, b => bloco(...b)], [40.8 + .3, 26.36, b => copo(...b)],
      [36.8 - .5, 28.5, b => notebook(...b)], [36.8 + .32, 28.82, b => copo(...b)],
      [38.8 - .55, 28.52, b => bloco(...b)],
      [40.8 - .5, 28.52, b => bloco(...b)], [40.8 + .32, 28.84, b => xicara(...b)],
      [x + .55, cy - .45, b => copo(...b)], [x + w - .62, cy + .2, b => bloco(...b)]
    ];
    pecas.sort((p, q) => (p[0] + p[1]) - (q[0] + q[1])).forEach(p => p[2]([p[0], p[1]]));
  }

  /* ===========================================================
     ESTAÇÃO DOS DEVS — peças da mesa (ver DRAW.deskGamer)
     Coordenadas locais: u corre na largura da mesa (eixo X) e v sai da
     borda de quem senta (0) para o fundo (d). Assim a mesma receita
     serve para as duas fileiras, que se olham.
     =========================================================== */
  /* ---------- cache em níveis de resolução ----------
     A peça parada é pintada num canvas próprio e depois só copiada, como
     no ALTURA_CACHE, mas com duas diferenças medidas no "desenho X ms":
     a caixa é justa (altura e margem da própria peça, não 120 px fixos)
     e a resolução acompanha o zoom. Um canvas em 2x copiado no zoom de
     visão geral (fator < 0,5) custava ~3 ms por mesa no Chromium, e as
     12 mesas dobravam o tempo do quadro; com a cópia em 1x abaixo do
     zoom ~1,15 (e 0,5x abaixo de 0,45) ela volta a ser de graça.
     Opções: alto (px acima do piso), margem, ver (função: quando o valor
     muda, repinta — fonte ou logo que terminaram de carregar), chave
     (várias tiras da mesma peça dividem um cache), faixa ([x0, x1] na
     tela, sem câmera: a tira copia só essa fatia vertical da peça), caixa
     ([x0, y0, x1, y1] na tela, no lugar de alto e margem) e par (ver
     abaixo).
     Os níveis vão até 5x: na tela 3x do celular, de perto, o 2x aparecia
     ampliado e borrado. Para isso caber na memória (no iPhone ela é curta,
     e passando dela o Safari recarrega a página):
     · nenhum canvas passa de MAX_PX: a peça grande para num nível menor;
     · um nível que fica VIDA_NIVEL ms sem ser desenhado é descartado, e
       passando do teto (umas 4 telas de pixels, entre 24 e 48 MB) sai o
       usado há mais tempo — nunca um que apareceu neste quadro ou no
       anterior, senão as peças do fim da lista se apagavam e repintavam;
     · um nível novo é pintado dentro de um orçamento por quadro (ORC_MS):
       ao cruzar de nível no zoom, as peças vão ficando nítidas aos poucos,
       mostrando o nível pronto mais parecido enquanto isso, em vez de
       travar um quadro pintando todas. Com o zoom andando (pinça,
       animação), um nível pronto a até ~2x do certo segue aparecendo, e o
       certo entra QUIETO ms depois de a escala parar. Peça sem nível
       nenhum pinta na hora — em 1x, se o orçamento do quadro já acabou.
     · peças em camadas que se encaixam no pixel do cache (a cadeira,
       'tras' e 'frente', ver cadeiraBase) passam op.par, um objeto comum
       às duas: a primeira a desenhar escolhe o nível do quadro e a outra
       segue, senão a costura do quadril aparecia.                       */
  const cacheNiveis = new Map();
  const MAX_PX = 2.2e6, MB = 1048576, VIDA_NIVEL = 4000, ORC_MS = 4;
  let varridoEm = 0, varridoQ = -1, bytesNiveis = 0, teto = 24 * MB, telaPx = 0;
  let quadro = 0, orcamento = ORC_MS;
  const QUIETO = 250;                         // ms de escala parada até subir de nível
  let quadroEscala = -1, escalaAntes = 0, mexeuEm = -1e9;
  // um quadro do navegador renova o orçamento (este rAF foi pedido antes do
  // do app, então roda antes dele em cada quadro)
  (function conta() { quadro++; orcamento = ORC_MS; requestAnimationFrame(conta); })();

  /** nível para a escala da tela: até ~12% de ampliação não se vê */
  function nivelAlvo(a, c) {
    let esc = a < .45 ? .5 : a <= 1.15 ? 1 : a <= 2.24 ? 2 : a <= 3.36 ? 3 : a <= 4.48 ? 4 : 5;
    while (esc > .5 && c.w * c.h * esc * esc > MAX_PX) esc = esc > 2 ? esc - 1 : esc / 2;
    return esc;
  }
  /** dos níveis prontos, o mais parecido com o alvo (empate: o maior) */
  function nivelPronto(c, alvo) {
    let melhor = null, dm = Infinity;
    for (const k in c.nivel) {
      const e = +k, d = Math.abs(Math.log(e / alvo)) - (e > alvo ? 1e-6 : 0);
      if (d < dm) { dm = d; melhor = e; }
    }
    return melhor;
  }
  function soltaNivel(c, k) {
    const cv = c.nivel[k];
    bytesNiveis -= cv.width * cv.height * 4;
    cv.width = cv.height = 0;                // devolve a memória já: o Safari demora a recolher
    delete c.nivel[k]; delete c.uso[k]; delete c.q[k];
  }
  function varreNiveis(agora) {
    for (const c of cacheNiveis.values()) for (const k in c.nivel)
      if (agora - c.uso[k] >= VIDA_NIVEL) soltaNivel(c, k);
    if (bytesNiveis <= teto) return;
    const fila = [];
    for (const c of cacheNiveis.values()) for (const k in c.nivel)
      if (c.q[k] < quadro - 1) fila.push([c.uso[k], c, k]);
    fila.sort((a, b) => a[0] - b[0]);
    for (const [, c, k] of fila) { if (bytesNiveis <= teto) break; soltaNivel(c, k); }
  }
  function emCache(ctx, o, pinta, op = {}) {
    const chave = op.chave || o;
    let c = cacheNiveis.get(chave);
    const v = op.ver ? op.ver() : 0;
    if (c && c.v !== v) { for (const k in c.nivel) soltaNivel(c, k); c.v = v; }
    if (!c) {
      let x0, y0, x1, y1;
      if (op.caixa) [x0, y0, x1, y1] = op.caixa;
      else {
        const w = o.w || 1, d = o.d || 1, m = op.margem === undefined ? 4 : op.margem;
        x0 = S(o.x, o.y + d).x - m; x1 = S(o.x + w, o.y).x + m;
        y0 = S(o.x, o.y).y - (op.alto || 60) - m; y1 = S(o.x + w, o.y + d).y + m;
      }
      c = { x: x0, y: y0, w: x1 - x0, h: y1 - y0, nivel: {}, uso: {}, q: {}, v };
      cacheNiveis.set(chave, c);
    }
    const tela = ctx.canvas.width * ctx.canvas.height;   // a tela dá o tamanho do teto
    if (tela > telaPx) { telaPx = tela; teto = Math.min(48 * MB, Math.max(24 * MB, tela * 16)); }
    const mt = ctx.getTransform();
    const a = Math.hypot(mt.a, mt.b);                     // px na tela por px de mundo
    const agora = performance.now();
    // a primeira peça do quadro vê se o zoom está andando
    if (quadroEscala !== quadro) {
      quadroEscala = quadro;
      if (Math.abs(a - escalaAntes) > a * .002) mexeuEm = agora;
      escalaAntes = a;
    }
    const alvo = nivelAlvo(a, c);
    const par = op.par;
    let esc;
    if (par && par.quadro === quadro) esc = par.esc;      // a outra camada já escolheu
    else {
      esc = alvo;
      if (!c.nivel[alvo]) {
        const pr = nivelPronto(c, alvo);
        const perto = pr !== null && Math.max(alvo / pr, pr / alvo) <= 2.2;
        if (pr !== null) { if (orcamento <= 0 || (perto && agora - mexeuEm < QUIETO)) esc = pr; }
        else if (orcamento <= 0 && alvo > 1) esc = 1;   // provisório barato; o certo vem depois
      }
      if (par) { par.quadro = quadro; par.esc = esc; }
    }
    let cv = c.nivel[esc];
    if (!cv) {
      const t0 = performance.now();
      cv = c.nivel[esc] = document.createElement('canvas');
      cv.width = Math.ceil(c.w * esc); cv.height = Math.ceil(c.h * esc);
      const g = cv.getContext('2d');
      g.setTransform(esc, 0, 0, esc, -c.x * esc, -c.y * esc);
      pinta(g, o, 0);
      bytesNiveis += cv.width * cv.height * 4;
      orcamento -= performance.now() - t0;
    }
    c.uso[esc] = agora; c.q[esc] = quadro;
    if (agora - varridoEm > 2000 || (bytesNiveis > teto && varridoQ !== quadro)) {
      varridoEm = agora; varridoQ = quadro; varreNiveis(agora);
    }
    const W = cv.width / esc, H = cv.height / esc;
    if (!op.faixa) { ctx.drawImage(cv, c.x, c.y, W, H); return; }
    // borda da tira no pixel inteiro da tela, para não sobrar costura
    const px = q => (Math.round(q * mt.a + mt.e) - mt.e) / mt.a;
    const L = Math.max(c.x, px(op.faixa[0])), R = Math.min(c.x + W, px(op.faixa[1]));
    // a origem não pode passar da borda do canvas nem por um fio: em 3x a
    // conta sobra 1e-13 px, e o Safari antigo não desenha nada nesse caso
    const sx = Math.max(0, (L - c.x) * esc), sw = Math.min(cv.width - sx, (R - L) * esc);
    if (sw <= 0) return;
    ctx.drawImage(cv, sx, 0, sw, cv.height, L, c.y, R - L, H);
  }

  const MESA_DEV = {
    tampo: '#c8ab84', bordaE: '#a98a63', bordaD: '#8c6f4e',     // carvalho claro
    aco: '#2c3037', acoClaro: '#3a3f47',                         // pés e calha
    braco: '#3d424b', bracoTopo: '#5c626c',                     // braço grafite: some nas costas dos monitores
    painel: '#15181d', costas: '#2a2e35',                        // monitores
    alu: '#bcc2ca', feltro: '#30333a'
  };

  function layoutMesaDev(o) {
    if (o._L) return o._L;
    const lado = (o.var || 0) % 2;                  // de que lado fica o notebook
    const mw = .96, mt = mw * 2 + .05;               // dois monitores e o vão
    const u0 = lado ? .14 : o.w - .14 - mt;
    const kw = .92, kx = u0 + mt / 2 - kw / 2;
    const lap = lado ? o.w - .14 - .56 : .14;
    // zona livre na frente, do lado do notebook: caneca, caderno, planta…
    const dentro = lado ? kx + kw + .62 : kx - .3;
    const fora   = lado ? o.w - .3 : .3;
    return (o._L = { lado, mw, mt, u0, kw, kx, lap, lw: .56, dentro, fora,
                     uc: u0 + mt / 2, telaZ: 34, telaH: 22 });
  }

  function mesaDevBase(ctx, o) {
    const { x, y, w, d } = o;
    const n = o.face === 'n';
    const L = layoutMesaDev(o), M = MESA_DEV;
    const R = (u, v, du, dv) => [x + u, n ? y + d - v - dv : y + v, du, dv];
    const B = (r, h, z, cor, opt) => ISO.box(ctx, r[0], r[1], r[2], r[3], h, z, cor, opt);
    const Pl = (r, z, cor, tr) => ISO.plane(ctx, r[0], r[1], r[2], r[3], z, cor, tr);
    const C = (u, v) => [x + u, n ? y + d - v : y + v];
    const P = (u, v, z) => { const c = C(u, v); return S(c[0], c[1], z); };
    const linha = { line: 'rgba(0,0,0,.28)' };

    // sombra de contato: a mesa tem pés, então é um retângulo suave
    Pl(R(.05, .06, w - .1, d - .12), .3, 'rgba(0,0,0,.18)');
    ISO.shadow(ctx, x + w / 2, y + d / 2, 1.2, .12);

    /* ---- estrutura sob o tampo: pés em T, colunas telescópicas, travessa,
       calha de cabos no fundo e o painel de altura na frente ---- */
    const sob = [];
    const pe = (u) => () => {
      B(R(u - .03, .08, .18, d - .16), 2.2, 0, M.aco, linha);
      B(R(u - .01, d / 2 - .1, .14, .2), 12, 2.2, M.aco, linha);
      B(R(u + .015, d / 2 - .07, .09, .14), 11.2, 14.2, M.acoClaro, linha);
    };
    sob.push([d / 2, .2, pe(.2)]);
    sob.push([d / 2, w / 2, () => B(R(.34, d / 2 - .04, w - .68, .08), 3, 21.6, M.aco, linha)]);
    sob.push([d / 2, w - .34, pe(w - .34)]);
    sob.push([d - .28, w / 2, () => {
      B(R(.55, d - .42, w - 1.1, .28), 3.6, 19.8, '#24272d', { top: '#121418', line: 'rgba(0,0,0,.3)' });
      Pl(R(.68, d - .33, w - 1.36, .09), 23.5, '#3a3e46');        // feixe de cabos na calha
    }]);
    if (n) sob.push([.05, w - .5, () => {                           // botoeira do ajuste de altura
      B(R(w - .62, .02, .24, .07), 2.6, 22.4, '#1b1d22', linha);
      const p1 = P(w - .55, .02, 23.7), p2 = P(w - .47, .02, 23.7);
      ctx.fillStyle = '#7d8590'; ctx.fillRect(p1.x - .6, p1.y - .6, 1.3, 1.3); ctx.fillRect(p2.x - .6, p2.y - .6, 1.3, 1.3);
    }]);
    sob.sort((a, b) => (n ? b[0] - a[0] : a[0] - b[0]) || a[1] - b[1]).forEach(p => p[2]());

    /* ---- tampo ---- */
    B([x - .03, y - .03, w + .06, d + .06], 2.6, TOP - 2.6, M.bordaE,
      { top: M.tampo, left: M.bordaE, right: M.bordaD, line: 'rgba(60,40,20,.38)' });
    for (let i = 0; i < 6; i++)                                     // veio da madeira
      Pl([x + .04, y + .1 + i * .2 + (i % 2) * .04, w - .08, .016], TOP + .05, 'rgba(120,84,48,.12)');

    /* ---- monitores no braço e notebook, no fundo da mesa ---- */
    const { mw, u0, uc, telaZ, telaH } = L;
    const telas = [u0, u0 + mw + .05];
    // a coluna do braço termina na altura do meio das telas: por trás delas
    // ela some, e pelas costas não sobra uma antena acima dos monitores
    const poste = () => {
      B(R(uc - .07, d - .17, .14, .14), 3, TOP, '#1e2126', linha);  // grampo na borda
      ISO.cyl(ctx, ...C(uc, d - .1), .036, 18, TOP + 3, M.braco);
    };
    const braco = () => {
      const op = { top: M.bracoTopo, line: 'rgba(0,0,0,.25)' };
      B(R(u0 + mw / 2, d - .22, mw + .05, .045), 2.2, 43.5, M.braco, op);
      B(R(uc - .03, d - .17, .06, .07), 2.2, 43.5, M.braco, op);
    };
    const vesa = () => telas.forEach(u => B(R(u + mw / 2 - .08, d - .245, .16, .025), 9, 40, '#22252b', linha));
    const painel = (u) => () => {
      B(R(u, d - .3, mw, .055), telaH, telaZ, n ? M.painel : M.costas,
        { top: '#33373f', line: 'rgba(0,0,0,.42)' });
      if (n) {
        // tela desligada: vidro escuro com um reflexo leve
        faceY(ctx, x + u + .025, y + .3, mw - .05, telaZ + telaH - 1, (c, len) => {
          c.fillStyle = '#07090d'; c.fillRect(0, 0, len, telaH - 3.4);
          c.fillStyle = 'rgba(160,190,230,.05)';
          c.beginPath(); c.moveTo(len * .5, 0); c.lineTo(len * .78, 0); c.lineTo(len * .42, telaH - 3.4);
          c.lineTo(len * .14, telaH - 3.4); c.closePath(); c.fill();
          c.fillStyle = '#2b3038'; c.fillRect(len / 2 - 2, telaH - 2.5, 4, .9);   // logo no queixo
        });
      } else {
        faceY(ctx, x + u, y + d - .245, mw, telaZ + telaH, (c, len) => {
          c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(0, 0, len, 1);
          c.fillStyle = 'rgba(0,0,0,.16)';
          for (let i = 0; i < 5; i++) c.fillRect(len * .3 + i * len * .1, 3, len * .05, 1.2);   // respiro
        });
      }
    };
    const notebook = () => {
      const { lap, lw } = L;
      B(R(lap + .1, .68, lw - .2, .38), 5, TOP, '#9aa1aa', { top: '#b3b9c1', line: 'rgba(0,0,0,.25)' });   // suporte
      const tampa = () => {
        B(R(lap, 1.08, lw, .035), 15, TOP + 10, M.alu, { top: '#d3d8de', line: 'rgba(0,0,0,.3)' });
        if (n) faceY(ctx, x + lap + .03, y + d - 1.08, lw - .06, TOP + 24, (c, len) => {
          c.fillStyle = '#080a0e'; c.fillRect(0, 0, len, 12);
        });
        else faceY(ctx, x + lap, y + 1.115, lw, TOP + 25, (c, len) => {
          c.fillStyle = 'rgba(255,255,255,.55)';
          c.beginPath(); c.arc(len / 2, 6.5, 1.6, 0, 7); c.fill();
        });
      };
      const base = () => {
        ISO.quad(ctx, [P(lap, .6, TOP + 5), P(lap + lw, .6, TOP + 5),
                       P(lap + lw, 1.08, TOP + 10), P(lap, 1.08, TOP + 10)], n ? '#c3c8cf' : '#8a919a', 'rgba(0,0,0,.25)');
        if (n) {
          ISO.quad(ctx, [P(lap + .05, .74, TOP + 6.5), P(lap + lw - .05, .74, TOP + 6.5),
                         P(lap + lw - .05, 1.02, TOP + 9.4), P(lap + .05, 1.02, TOP + 9.4)], '#2c2f35');
          ISO.quad(ctx, [P(lap, .6, TOP + 5), P(lap + lw, .6, TOP + 5),
                         P(lap + lw, .6, TOP + 3.8), P(lap, .6, TOP + 3.8)], '#8d949d');
        }
      };
      if (n) { tampa(); base(); } else { base(); tampa(); }
    };

    /* ---- frente: feltro, teclado, mouse e os objetos ---- */
    const { kx, kw } = L;
    const frente = [];
    frente.push([kx + kw / 2, () => {
      B(R(kx, .23, kw, .26), 1.6, TOP + .2, '#c5cad2', { top: '#e2e5e9', line: 'rgba(0,0,0,.16)' });
      for (let i = 0; i < 4; i++) Pl(R(kx + .05, .27 + i * .055, kw - .1, .013), TOP + 1.85, 'rgba(88,96,108,.4)');
    }]);
    frente.push([kx + kw + .2, () => ISO.cyl(ctx, ...C(kx + kw + .2, .35), .062, 2.4, TOP + .2, '#e3e6ea')]);
    const variante = (o.var || 0) % 4;
    const obj = {
      caneca: (u) => canecaDev(ctx, ...C(u, .33), (o.var || 0) % 3),
      caderno: (u) => {
        B(R(u - .2, .14, .4, .3), 1.6, TOP, ['#26313f', '#3a3e45', '#7a5c3e'][(o.var || 0) % 3],
          { top: ['#2f3c4d', '#464a52', '#8c6b48'][(o.var || 0) % 3], line: 'rgba(0,0,0,.3)' });
        B(R(u - .16, .36, .3, .025), 1.2, TOP + 1.6, '#e7e9ec', { line: 'rgba(0,0,0,.15)' });   // caneta
      },
      celular: (u) => B(R(u - .06, .16, .12, .24), .9, TOP, '#121418', { top: '#1d2633', line: 'rgba(0,0,0,.4)' }),
      planta: (u) => suculenta(ctx, ...C(u, .3)),
      garrafa: (u) => {
        ISO.cyl(ctx, ...C(u, .3), .055, 15, TOP, '#9fb2c2');
        ISO.cyl(ctx, ...C(u, .3), .04, 3, TOP + 15, '#2a2e35');
      }
    };
    const par = [['caderno', 'caneca'], ['celular', 'caneca'], ['planta', 'caderno'], ['garrafa', 'celular']][variante];
    frente.push([L.fora, () => obj[par[0]](L.fora)]);
    frente.push([L.dentro, () => obj[par[1]](L.dentro)]);

    if (n) {
      // fundo primeiro: braço, monitores e notebook; depois a frente
      poste(); braco(); telas.forEach(u => painel(u)()); notebook();
      Pl(R(kx - .12, .13, kw + .55, .5), TOP + .15, M.feltro, 'rgba(0,0,0,.3)');
      frente.sort((a, b) => a[0] - b[0]).forEach(p => p[1]());
    } else {
      // de frente para nós: o fundo da mesa é o lado da câmera
      Pl(R(kx - .12, .13, kw + .55, .5), TOP + .15, M.feltro, 'rgba(0,0,0,.3)');
      frente.sort((a, b) => a[0] - b[0]).forEach(p => p[1]());
      notebook(); telas.forEach(u => painel(u)()); vesa(); braco(); poste();
    }
  }

  /** caneca da mesa do dev: branca, grafite ou no ciano da marca */
  function canecaDev(ctx, cx, cy, k) {
    const cor = ['#eceef1', '#3a3f47', '#1aa6e6'][k];
    ISO.cyl(ctx, cx, cy, .085, 10, TOP, cor);
    ISO.cyl(ctx, cx, cy, .068, 1, TOP + 9, '#3b2418');
    const p = S(cx + .1, cy, TOP + 5.5);
    ctx.save(); ctx.strokeStyle = ISO.shade(cor, -.12); ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(p.x + 1, p.y, 2.2, -1.3, 1.3); ctx.stroke(); ctx.restore();
  }

  /** suculenta num vasinho de cerâmica branca */
  function suculenta(ctx, cx, cy) {
    ISO.cyl(ctx, cx, cy, .08, 6, TOP, '#e9e6df');
    const p = S(cx, cy, TOP + 6);
    const folhas = [[-3.2, -1.5, '#5e9b62'], [3, -1.2, '#4f8a55'], [0, -3.4, '#6fae70'],
                    [-1.6, -.2, '#5a9660'], [1.8, -.4, '#679f66'], [0, -1.6, '#7dbb7a']];
    for (const [dx, dy, c] of folhas) {
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.ellipse(p.x + dx, p.y + dy, 2.4, 1.6, dx * .2, 0, 7); ctx.fill();
    }
  }

  /* conteúdo das telas da estação, ao vivo: editor de código, um segundo
     monitor que muda de mesa para mesa e o chat no notebook             */
  const CODIGO = [
    [0, 9, '#c792ea', 12, '#82aaff', 8, '#a6accd'], [1, 7, '#c792ea', 14, '#a6accd'],
    [1, 10, '#82aaff', 6, '#c3e88d', 9, '#a6accd'], [2, 16, '#a6accd', 7, '#f78c6c'],
    [2, 6, '#c792ea', 11, '#c3e88d'], [1, 4, '#a6accd'], [0, 13, '#5c6773'],
    [0, 8, '#c792ea', 9, '#82aaff', 5, '#a6accd'], [1, 12, '#4fc3f7', 10, '#a6accd'],
    [2, 9, '#a6accd', 6, '#c3e88d', 4, '#a6accd'], [1, 5, '#c792ea', 8, '#f78c6c'], [0, 3, '#a6accd']
  ];
  function telasDev(ctx, o, t) {
    if (o.face !== 'n') {
      // telas de costas: só a luz delas no rosto de quem trabalha
      const g = S(o.x + 1.5, o.y - .7, 56);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ISO.glow(ctx, g.x, g.y, 26, '#7cc4ff', .06);
      ctx.restore();
      return;
    }
    const L = layoutMesaDev(o);
    const { x, y } = o;
    const H = L.telaH - 3.4, topo = L.telaZ + L.telaH - 1;
    const passo = Math.floor(t * .8 + (o.var || 0) * 1.7);
    // monitor 1: editor
    faceY(ctx, x + L.u0 + .025, y + .3, L.mw - .05, topo, (c, len) => {
      c.fillStyle = '#0e1117'; c.fillRect(0, 0, len, H);
      c.fillStyle = '#161b22'; c.fillRect(0, 0, 8, H); c.fillRect(0, 0, len, 2);
      c.fillStyle = '#00b3ff'; c.fillRect(10, 0, 12, 2);
      let fimX = 12, fimY = 4;
      for (let i = 0; i < 6; i++) {
        const s = CODIGO[(passo + i) % CODIGO.length];
        let xx = 12 + s[0] * 4;
        const yy = 3.6 + i * 2.25;
        c.fillStyle = 'rgba(120,130,150,.35)'; c.fillRect(3, yy, 2.4, 1);
        for (let j = 1; j < s.length; j += 2) { c.fillStyle = s[j + 1]; c.fillRect(xx, yy, s[j] * .9, 1.05); xx += s[j] * .9 + 1.6; }
        fimX = xx; fimY = yy;
      }
      if ((t * 2.2 | 0) % 2) { c.fillStyle = '#e6edf3'; c.fillRect(fimX - .8, fimY - .3, .8, 1.7); }
    });
    // monitor 2: terminal, prévia do site ou painel de métricas
    const tipo = (o.var || 0) % 3;
    faceY(ctx, x + L.u0 + L.mw + .075, y + .3, L.mw - .05, topo, (c, len) => {
      if (tipo === 0) {
        c.fillStyle = '#0b0d10'; c.fillRect(0, 0, len, H);
        const p2 = Math.floor(t * 1.6 + (o.var || 0));
        for (let i = 0; i < 6; i++) {
          const k = (p2 + i) * 7 % 11;
          c.fillStyle = k % 4 === 0 ? '#3fb950' : 'rgba(150,160,175,.7)';
          c.fillRect(3, 2 + i * 2.3, 2, 1);
          c.fillStyle = 'rgba(150,160,175,.55)'; c.fillRect(7, 2 + i * 2.3, 12 + k * 2.6, 1);
        }
        c.fillStyle = '#58a6ff'; c.fillRect(3, 2 + 6 * 2.3, 3, 1.1);
        if ((t * 2 | 0) % 2) { c.fillStyle = '#e6edf3'; c.fillRect(8, 1.7 + 6 * 2.3, 1, 1.6); }
      } else if (tipo === 1) {
        c.fillStyle = '#111620'; c.fillRect(0, 0, len, H);
        c.fillStyle = '#1e2532'; c.fillRect(0, 0, len, 2.4);
        ['#ff5f57', '#febc2e', '#28c840'].forEach((k, i) => { c.fillStyle = k; c.fillRect(2 + i * 2.4, .7, 1.2, 1.1); });
        c.fillStyle = '#00b3ff'; c.fillRect(5, 4.5, len * .42, 2);
        c.fillStyle = 'rgba(220,228,240,.5)'; c.fillRect(5, 7.8, len * .55, 1); c.fillRect(5, 9.4, len * .35, 1);
        for (let i = 0; i < 3; i++) {
          const real = Math.floor(t * .5) % 3 === i;
          c.fillStyle = real ? '#2a3a52' : '#1c2433'; c.fillRect(5 + i * (len - 10) / 3, 11.6, (len - 10) / 3 - 2, 5.6);
        }
      } else {
        c.fillStyle = '#0f141c'; c.fillRect(0, 0, len, H);
        for (let i = 0; i < 3; i++) {
          c.fillStyle = '#18202c'; c.fillRect(3 + i * (len - 4) / 3, 2, (len - 4) / 3 - 2, 4);
          c.fillStyle = ['#00b3ff', '#3fb950', '#c4b8ff'][i]; c.fillRect(5 + i * (len - 4) / 3, 3.4, 6, 1.2);
        }
        c.strokeStyle = '#00b3ff'; c.lineWidth = .9;
        c.beginPath();
        for (let i = 0; i <= 12; i++) {
          const px = 3 + i * (len - 6) / 12;
          const py = 13.5 - 3.2 * Math.sin(i * .9 + t * .6 + (o.var || 0)) - i * .25;
          if (i) c.lineTo(px, py); else c.moveTo(px, py);
        }
        c.stroke();
      }
    });
    // notebook: o chat da equipe
    faceY(ctx, x + L.lap + .03, y + o.d - 1.08, L.lw - .06, TOP + 24, (c, len) => {
      c.fillStyle = '#14171d'; c.fillRect(0, 0, len, 12);
      c.fillStyle = '#1d2230'; c.fillRect(0, 0, len * .3, 12);
      const p3 = Math.floor(t * .4 + (o.var || 0) * 2);
      for (let i = 0; i < 4; i++) {
        c.fillStyle = ['#00b3ff', '#c4b8ff', '#3fb950', '#f2b84b'][(p3 + i) % 4];
        c.fillRect(len * .3 + 2, 1.5 + i * 2.6, 1.4, 1.4);
        c.fillStyle = 'rgba(200,208,222,.5)'; c.fillRect(len * .3 + 5, 1.8 + i * 2.6, 6 + ((p3 + i) * 5 % 9), .9);
      }
    });
    // a luz das telas
    const g = S(x + L.uc, y + .36, L.telaZ + 10);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ISO.glow(ctx, g.x, g.y, 56, '#5aaeff', .1);
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
           add, block, cadeira, emCamadas, naParede, registrar, remover, emCache, orquidea, vidro, fonteCarregada, faceX,
           faceY, monitor, monitorY, teclado, tecladoY, gabinete, desenho: DRAW,
           /** memória do cache em níveis, para depurar (lista: cada nível vivo) */
           estadoCache(lista) {
             const r = { MB: +(bytesNiveis / MB).toFixed(1), teto: +(teto / MB).toFixed(1), pecas: cacheNiveis.size };
             if (lista) {
               r.niveis = [];
               for (const [k, c] of cacheNiveis) for (const e in c.nivel)
                 r.niveis.push([(k && k.t) || String(k).slice(0, 20), +e, +(c.nivel[e].width * c.nivel[e].height * 4 / 1048576).toFixed(2)]);
               r.niveis.sort((a, b) => b[2] - a[2]);
             }
             return r;
           } };
})();
