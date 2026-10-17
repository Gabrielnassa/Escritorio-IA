/* ===========================================================
   world.js — a planta do escritório da Nassa Tech
   Grade 48 x 34: um andar da torre na Faria Lima.
   Sala do chefe, sala dos devs, sala de jogos, sala de reunião
   e a circulação com recepção e elevadores.
   A fachada (paredes norte e oeste) é pele de vidro: pela janela
   aparece São Paulo, de dia ou de noite, conforme o relógio.
   =========================================================== */
const WORLD = (() => {

  const W = 48, H = 34;

  const VOID = 0, FLOOR = 1, WALL = 2, DOOR = 3;

  /* ---------- paleta ---------- */
  const C = {
    fire1: '#7c6cff', fire2: '#9d8cff', fire3: '#f59e0b',
    volt1: '#38bdf8', volt2: '#2563eb',
    dark:  '#0b0d15', wall: '#1b2033', wallTop: '#2a3149'
  };

  /* ---------- salas ---------- */
  /* piso: madeira (chefe), carpete em placas (devs e reunião),
     vinílico escuro (jogos) e porcelanato acetinado (circulação) */
  const ROOMS = {
    diretoria: {
      id: 'diretoria', name: 'SALA DO CHEFE', short: 'Chefe',
      bx: 0, by: 0, bw: 15, bh: 19,
      x1: 1, y1: 1, x2: 13, y2: 17,
      accent: '#00b3ff', piso: 'madeira',
      floorA: '#3a2618', floorB: '#432c1c',
      desc: 'A sala do Gabriel. Painel ripado de madeira, quadro da BMW 335i E90, vista da Ponte Estaiada e estar com sofá.'
    },
    servico: {
      id: 'servico', name: 'SALA DOS DEVS', short: 'Devs',
      bx: 18, by: 0, bw: 30, bh: 19,
      x1: 19, y1: 1, x2: 46, y2: 17,
      accent: '#2f7bff', piso: 'carpete',
      floorA: '#1a1f2a', floorB: '#1d2330',
      desc: 'Onde o código acontece. 12 estações com monitor, painel da equipe, CI/CD ao vivo e vista para a Faria Lima.'
    },
    lounge: {
      id: 'lounge', name: 'SALA DE JOGOS', short: 'Jogos',
      bx: 0, by: 22, bw: 30, bh: 12,
      x1: 1, y1: 23, x2: 28, y2: 32,
      accent: '#c9a46a', piso: 'madeira',
      tons: ['#6b5240', '#735845', '#6f5543', '#775c48', '#684f3d'],
      floorA: '#6b5240', floorB: '#735845',
      desc: 'Lounge sóbrio: sinuca com luminária pendente, pebolim, mesa de xadrez, videogame no telão, poltronas de couro e café.'
    },
    reuniao: {
      id: 'reuniao', name: 'SALA DE REUNIÃO', short: 'Reunião',
      bx: 32, by: 22, bw: 16, bh: 12,
      x1: 33, y1: 23, x2: 46, y2: 32,
      accent: '#22d3a6', piso: 'carpete',
      floorA: '#22262f', floorB: '#252a34',
      desc: 'Aquário de vidro com mesa para oito e telão. É aqui que acontecem as dailies e a reunião dos agentes.'
    },
    corredor: {
      id: 'corredor', name: 'RECEPÇÃO & CIRCULAÇÃO', short: 'Corredor',
      accent: '#64748b', piso: 'porcelanato',
      floorA: '#2a2e36', floorB: '#2c3039',
      desc: 'Hall dos elevadores, recepção com o logo da Nassa Tech e a circulação entre as salas.'
    }
  };

  /* ---------- portas (x, y, orientação) ---------- */
  const DOORS = [
    { x: 14, y: 8,  o: 'v' }, { x: 14, y: 9,  o: 'v' },   // diretoria -> hall vertical
    { x: 5,  y: 18, o: 'h' }, { x: 6,  y: 18, o: 'h' },   // diretoria -> corredor
    { x: 18, y: 8,  o: 'v' }, { x: 18, y: 9,  o: 'v' },   // serviço  -> hall vertical
    { x: 30, y: 18, o: 'h' }, { x: 31, y: 18, o: 'h' },   // serviço  -> corredor
    { x: 13, y: 22, o: 'h' }, { x: 14, y: 22, o: 'h' },   // lounge   -> corredor
    { x: 24, y: 22, o: 'h' }, { x: 25, y: 22, o: 'h' },   // lounge   -> corredor (2ª porta)
    { x: 35, y: 22, o: 'h' }, { x: 36, y: 22, o: 'h' }    // reunião  -> corredor (fora do telão)
  ];

  /* ---------- grade ---------- */
  const kind   = new Uint8Array(W * H);
  const roomOf = new Array(W * H).fill(null);
  const blocked = new Uint8Array(W * H);   // móveis ocupando o tile

  const idx = (x, y) => y * W + x;
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

  function buildGrid() {
    kind.fill(FLOOR);
    for (let i = 0; i < W * H; i++) roomOf[i] = 'corredor';

    // anel externo
    for (let x = 0; x < W; x++) { kind[idx(x, 0)] = WALL; kind[idx(x, H - 1)] = WALL; }
    for (let y = 0; y < H; y++) { kind[idx(0, y)] = WALL; kind[idx(W - 1, y)] = WALL; }

    // faixa morta entre as salas de baixo e as de cima já é corredor (y 19..21)

    for (const r of Object.values(ROOMS)) {
      if (r.bw === undefined) continue;
      const x0 = r.bx, y0 = r.by, x1 = r.bx + r.bw - 1, y1 = r.by + r.bh - 1;
      for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) {
          if (!inside(x, y)) continue;
          const borda = (x === x0 || x === x1 || y === y0 || y === y1);
          if (borda) { kind[idx(x, y)] = WALL; roomOf[idx(x, y)] = r.id; }
          else       { kind[idx(x, y)] = FLOOR; roomOf[idx(x, y)] = r.id; }
        }
      }
    }

    for (const d of DOORS) if (inside(d.x, d.y)) kind[idx(d.x, d.y)] = DOOR;

    // elevador / entrada na parede leste do corredor
    kind[idx(W - 1, 20)] = WALL;
  }
  buildGrid();

  const kindAt  = (x, y) => inside(x, y) ? kind[idx(x, y)] : VOID;
  const roomAt  = (x, y) => inside(x, y) ? roomOf[idx(x, y)] : null;
  const isWall  = (x, y) => kindAt(x, y) === WALL;

  /** o tile dá para pisar? (usado pelo A*) */
  function walkable(x, y) {
    if (!inside(x, y)) return false;
    const k = kind[idx(x, y)];
    return (k === FLOOR || k === DOOR) && !blocked[idx(x, y)];
  }
  function setBlocked(x, y, v = 1) {
    if (inside(x, y)) blocked[idx(x, y)] = v;
  }

  /* ---------- alturas de parede ----------
     Uma parede que tem chão ATRÁS dela (em x-1 ou y-1) taparia
     a visão: ela vira parapeito sólido + vidro fumê por cima.
     As demais sobem inteiras e viram painel de LED / logo.        */
  const WALL_H = 108, PARAPET = 40;

  function wallOccludes(x, y) {
    const a = kindAt(x - 1, y), b = kindAt(x, y - 1);
    return a === FLOOR || a === DOOR || b === FLOOR || b === DOOR;
  }

  /* ---------- painéis nas paredes altas ---------- */
  const SIGNS = [
    { o: 'n', x: 1,  y: 0,  len: 3,  kind: 'palmeiras' }, // chefe: camisa do Palmeiras, era Parmalat
    { o: 'n', x: 5,  y: 0,  len: 5,  kind: 'bmw'      },  // chefe: o quadro da BMW
    { o: 'w', x: 0,  y: 9,  len: 5,  kind: 'quadro'   },  // chefe: quadro de ideias
    { o: 'w', x: 0,  y: 14, len: 4,  kind: 'eventos'  },  // chefe: próximos eventos
    // TV da equipe: 8 tiles a partir da copa. Até x 28, a planta de x 29,5
    // (que fica na frente) tapava a ponta direita da tela
    { o: 'n', x: 20, y: 0,  len: 8,  kind: 'equipe'   },  // devs: a equipe agora
    { o: 'n', x: 31, y: 0,  len: 8,  kind: 'logo'     },  // devs: logo adesivado no vidro
    { o: 'n', x: 41, y: 0,  len: 5,  kind: 'pipeline' },  // devs: CI/CD da branch main
    { o: 'w', x: 0,  y: 25, len: 6,  kind: 'logoParede' } // jogos: logo em metal no feltro
  ];

  /* ---------- acabamento das paredes externas ----------
     vidro   = pele de vidro do prédio, com a cidade atrás
     ripado  = painel de madeira ripada (sala do chefe)
     acustico= painel acústico de feltro (sala de jogos)          */
  function material(x, y, o) {
    if (o === 'n' && y === 0) return (x >= 1 && x <= 13) ? 'ripado' : 'vidro';
    if (o === 'w' && x === 0) {
      if (y >= 9 && y <= 17)  return 'ripado';
      if (y >= 23 && y <= 32) return 'acustico';
      return 'vidro';
    }
    return null;
  }
  const SEM_LED = id => id === 'lounge';       // a sala de jogos é sóbria: sem fita de LED

  /* ===========================================================
     DESENHO
     =========================================================== */

  /** superfície de parede em espaço "u (px ao longo) × v (px para baixo)" */
  function wallFace(ctx, orient, x, y, lenTiles, topZ, fn) {
    const T = ISO.TW;
    let o, a, b;
    if (orient === 'n') {                       // face virada para +y
      o = ISO.toScreen(x, y + 1, topZ);
      a =  ISO.HW / T; b =  ISO.HH / T;
    } else {                                    // 'w' — face virada para +x
      // começa na ponta de baixo e cresce subindo à direita;
      // pelo outro lado o texto sairia espelhado
      o = ISO.toScreen(x + 1, y + lenTiles, topZ);
      a =  ISO.HW / T; b = -ISO.HH / T;
    }
    ctx.save();
    ctx.transform(a, b, 0, 1, o.x, o.y);
    fn(ctx, lenTiles * T);
    ctx.restore();
  }

  /* ---- chão ----
     O piso é fixo: 1632 losangos por quadro era desperdício puro. Com a luz
     do andar (decor-luz.js) ele vira um mosaico de pedaços em cache, cada
     um pintado daqui (desenhaPisoCru, só os tiles do recorte) na resolução
     do zoom. Sem ela, drawFloor copia um canvas único em 1x, como antes. */
  let caixaPiso = null;
  /** retângulo do piso na tela, sem câmera (px de mundo): laje inclusa */
  function pisoCaixa() {
    if (caixaPiso) return caixaPiso;
    const x0 = ISO.toScreen(0, H - 1).x - ISO.TW;
    const x1 = ISO.toScreen(W - 1, 0).x + ISO.TW;
    const y0 = ISO.toScreen(0, 0).y - 4;
    const y1 = ISO.toScreen(W, H).y + LAJE + 8;
    caixaPiso = { x: x0, y: y0, w: Math.ceil(x1 - x0), h: Math.ceil(y1 - y0) };
    return caixaPiso;
  }

  /** o piso cru (laje, tiles e a faixa azul) no ctx, com a transformação de
      quem chama. r = {x0, y0, x1, y1} em px de mundo: só o que cai nele.  */
  function desenhaPisoCru(c, r) {
    const fora = (x0, y0, x1, y1) => r && (x1 < r.x0 || x0 > r.x1 || y1 < r.y0 || y0 > r.y1);
    const HW = ISO.HW, TH = ISO.TH, P = ISO.toScreen;
    // a laje só aparece na borda de baixo do andar
    if (!fora(P(0, H).x - 4, P(0, H).y - 4, P(W, 0).x + 4, P(W, H).y + 16 + LAJE + 4)) desenhaLaje(c);
    // contrapiso: o losango do andar inteiro, opaco, por baixo dos tiles. A
    // emenda suavizada entre dois tiles deixava passar um fio do fundo; e,
    // sem nenhum furo, o pedaço do miolo do andar dispensa a máscara da luz
    // (decor-luz.js). Onde não há piso há parede, que cobre o contrapiso.
    ISO.quad(c, [P(0, 0), P(W, 0), P(W, H), P(0, H)], '#1d2027');

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const k = kind[idx(x, y)];
        if (k !== FLOOR && k !== DOOR) continue;
        // caixa do losango (vértice de cima em (x-y)·HW, (x+y)·HH), com folga do traço
        const sx = (x - y) * HW, sy = (x + y) * ISO.HH;
        if (fora(sx - HW - 2, sy - 2, sx + HW + 2, sy + TH + 2)) continue;
        const rm = ROOMS[roomOf[idx(x, y)]] || ROOMS.corredor;
        if (k === DOOR) { ISO.tile(c, x, y, '#3a3f49', 'rgba(255,255,255,.05)'); continue; }
        pisoTile(c, x, y, rm);
      }
    }
    // faixa de piso com o azul da marca: guia do elevador até as salas
    c.save();
    for (let x = 2; x <= 45; x++) {
      const sx = (x - 20) * HW, sy = (x + 20) * ISO.HH;
      if (fora(sx - HW - 2, sy - 2, sx + HW + 2, sy + TH + 2)) continue;
      if (walkable(x, 20) && roomAt(x, 20) === 'corredor')
        ISO.plane(c, x, 20.42, 1, .16, 0, ISO.rgba('#00b3ff', .22));
    }
    c.restore();
  }

  let pisoCache = null;
  function montaPiso() {
    const b = pisoCaixa();
    const cv = document.createElement('canvas');
    cv.width = b.w; cv.height = b.h;
    const c = cv.getContext('2d');
    c.translate(-b.x, -b.y);
    desenhaPisoCru(c);
    pisoCache = { cv, x: b.x, y: b.y };
  }

  /** hash estável por tile, para variar tábua e placa sem piscar */
  const hash = (x, y) => {
    let h = (x * 374761393 + y * 668265263) >>> 0;
    h = (h ^ (h >>> 13)) * 1274126177 >>> 0;
    return (h & 0xffff) / 0xffff;
  };

  function pisoTile(c, x, y, r) {
    const P = ISO.toScreen;
    if (r.piso === 'madeira') {
      // assoalho de madeira escura em réguas, com emendas desencontradas
      const tons = r.tons || ['#3b2719', '#422b1b', '#46301f', '#3f2a1c', '#4a3322'];
      for (let i = 0; i < 3; i++) {
        const cor = tons[Math.floor(hash(x, y * 3 + i) * tons.length)];
        ISO.plane(c, x, y + i / 3, 1, 1 / 3, 0, cor);
        c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = .8;
        const a = P(x, y + i / 3), b = P(x + 1, y + i / 3);
        c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
        // emenda de topo
        const e = (hash(y * 3 + i, x) * .8 + .1);
        if (((x + i) % 2) === 0) {
          const q1 = P(x + e, y + i / 3), q2 = P(x + e, y + (i + 1) / 3);
          c.strokeStyle = 'rgba(0,0,0,.22)';
          c.beginPath(); c.moveTo(q1.x, q1.y); c.lineTo(q2.x, q2.y); c.stroke();
        }
        // veio da madeira
        c.strokeStyle = 'rgba(255,220,180,.035)';
        const v1 = P(x + .1, y + i / 3 + .16), v2 = P(x + .9, y + i / 3 + .16);
        c.beginPath(); c.moveTo(v1.x, v1.y); c.lineTo(v2.x, v2.y); c.stroke();
      }
      return;
    }
    if (r.piso === 'carpete') {
      // placas de carpete 50x50 assentadas em "parquet" (direção alternada)
      const alt = ((x + y) & 1);
      ISO.tile(c, x, y, alt ? r.floorA : r.floorB, 'rgba(0,0,0,.18)');
      c.strokeStyle = 'rgba(255,255,255,.022)'; c.lineWidth = .7;
      for (let i = 1; i < 6; i++) {
        const f = i / 6;
        const a = alt ? P(x + f, y) : P(x, y + f), b = alt ? P(x + f, y + 1) : P(x + 1, y + f);
        c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
      }
      return;
    }
    if (r.piso === 'porcelanato') {
      // porcelanato grande (1 placa = 2x2 tiles) com rejunte fino
      const v = hash(x >> 1, y >> 1) * .035;
      ISO.tile(c, x, y, ISO.shade(r.floorA, v), null);
      c.strokeStyle = 'rgba(0,0,0,.32)'; c.lineWidth = .8;
      if (x % 2 === 0) { const a = P(x, y), b = P(x, y + 1); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
      if (y % 2 === 0) { const a = P(x, y), b = P(x + 1, y); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
      // brilho acetinado
      ISO.plane(c, x + .1, y + .1, .8, .8, 0, 'rgba(255,255,255,.012)');
      return;
    }
    // vinílico da sala de jogos: escuro com faixas finas de neon
    ISO.tile(c, x, y, ((x + y) & 1) ? r.floorA : r.floorB, 'rgba(255,255,255,.02)');
    if ((x + y) % 7 === 0) ISO.plane(c, x + .45, y, .1, 1, 0, 'rgba(192,86,255,.10)');
  }

  /* ---- laje: a borda do andar, com o andar de baixo sumindo no vidro ----
     É o que faz o escritório parecer uma fatia da torre, e não um tabuleiro
     solto no fundo.                                                       */
  const LAJE = 150;
  function desenhaLaje(c) {
    const P = ISO.toScreen;
    // concreto da laje
    ISO.quad(c, [P(0, H, 0), P(W, H, 0), P(W, H, -16), P(0, H, -16)], '#3a404b');
    ISO.quad(c, [P(W, 0, 0), P(W, H, 0), P(W, H, -16), P(W, 0, -16)], '#2c313a');
    // fachada de vidro do andar de baixo, esmaecendo
    const fachada = (pts, escura) => {
      const g = c.createLinearGradient(0, pts[0].y, 0, pts[0].y + LAJE);
      g.addColorStop(0, escura ? 'rgba(40,62,92,.85)' : 'rgba(58,86,122,.85)');
      g.addColorStop(1, 'rgba(10,14,24,0)');
      ISO.quad(c, pts, g);
    };
    fachada([P(0, H, -16), P(W, H, -16), P(W, H, -16 - LAJE), P(0, H, -16 - LAJE)], false);
    fachada([P(W, 0, -16), P(W, H, -16), P(W, H, -16 - LAJE), P(W, 0, -16 - LAJE)], true);
    // montantes da fachada
    c.save();
    for (let x = 0; x <= W; x += 1.5) {
      const a = P(x, H, -16), b = P(x, H, -16 - LAJE * .8);
      const g = c.createLinearGradient(0, a.y, 0, b.y);
      g.addColorStop(0, 'rgba(200,215,235,.35)'); g.addColorStop(1, 'rgba(200,215,235,0)');
      c.strokeStyle = g; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
    }
    for (let y = 0; y <= H; y += 1.5) {
      const a = P(W, y, -16), b = P(W, y, -16 - LAJE * .8);
      const g = c.createLinearGradient(0, a.y, 0, b.y);
      g.addColorStop(0, 'rgba(170,190,215,.28)'); g.addColorStop(1, 'rgba(170,190,215,0)');
      c.strokeStyle = g; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
    }
    // linha da laje do andar de baixo
    c.strokeStyle = 'rgba(160,175,200,.18)'; c.lineWidth = 3;
    let a = P(0, H, -16 - 108), b = P(W, H, -16 - 108);
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
    a = P(W, 0, -16 - 108); b = P(W, H, -16 - 108);
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
    // aresta clara do piso acabado
    c.strokeStyle = 'rgba(220,230,245,.35)'; c.lineWidth = 1.2;
    a = P(0, H, 0); b = P(W, H, 0); const d = P(W, 0, 0);
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(d.x, d.y); c.stroke();
    c.restore();
  }

  /** o piso cru inteiro num canvas em 1x: só para quando não há a luz do
      andar (decor-luz.js monta o dele em pedaços, com desenhaPisoCru) */
  function pisoBase() {
    if (!pisoCache) montaPiso();
    return pisoCache;
  }

  function drawFloor(ctx) {
    // a luz da fachada e das luminárias saiu daqui: os brilhos soltos por
    // quadro viraram o mapa de luz pré-pintado do decor-luz.js
    const p = pisoBase();
    ctx.drawImage(p.cv, p.x, p.y);
  }


  /* ---- nome de cada sala, pintado no piso ----
     Deitado na perspectiva do chão, ao longo do eixo x, como um adesivo
     de piso. Em pé, o texto atravessava as paredes de vidro e os racks.
     Cada ponto fica a mais de 1,25 tile da parede da frente (o parapeito
     de 40 px tapa essa faixa do piso) e longe de móveis altos.         */
  function drawRoomLabels(ctx) {
    const put = (txt, cor, cx, cy) => {
      const p = ISO.toScreen(cx, cy, 0);
      ctx.save();
      ctx.transform(ISO.HW / ISO.TW, ISO.HH / ISO.TW, -ISO.HW / ISO.TW, ISO.HH / ISO.TW, p.x, p.y);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '700 22px Barlow Semi Condensed, sans-serif';
      ctx.letterSpacing = '5px';
      ctx.fillStyle = ISO.rgba(cor, .30);
      ctx.fillText(txt, 0, 0);
      ctx.restore();
    };
    put(ROOMS.diretoria.name, ROOMS.diretoria.accent, 3.7, 16.1);
    put(ROOMS.servico.name,   ROOMS.servico.accent,   32.5, 15.9);
    put(ROOMS.lounge.name,    ROOMS.lounge.accent,    20.5, 30.9);
    put(ROOMS.reuniao.name,   ROOMS.reuniao.accent,   39.6, 31.2);
    put('RECEPÇÃO',           '#9fb3c8',              41.0, 20.4);
  }

  const cacheGrad = new Map();

  /** px na tela por px de mundo no ctx (o maior dos dois eixos: dentro de
      uma face de parede a transformação é inclinada) */
  function escalaDe(ctx) {
    const m = ctx.getTransform();
    return Math.max(Math.hypot(m.a, m.b), Math.hypot(m.c, m.d));
  }

  /* ---- texturas das paredes externas (pintadas uma vez por resolução) ----
     Em 2x fixo, o ripado da sala do chefe aparecia borrado na tela 3x do
     celular. São pequenas (64 x 108 px de mundo): 1x, 2x e 4x cabem fácil. */
  const cacheTextura = new Map();
  function textura(tipo, s) {
    const ESC = s > 2.3 ? 4 : s > 1.15 ? 2 : 1;
    const ck = tipo + ESC;
    let cv = cacheTextura.get(ck);
    if (cv) return cv;
    const T = ISO.TW;
    cv = document.createElement('canvas');
    cv.width = T * ESC; cv.height = WALL_H * ESC;
    const c = cv.getContext('2d');
    c.scale(ESC, ESC);
    if (tipo === 'ripado') {
      // ripas verticais de madeira escura com frisos pretos
      const g = c.createLinearGradient(0, 0, 0, WALL_H);
      g.addColorStop(0, '#5a3d27'); g.addColorStop(1, '#3a2617');
      c.fillStyle = '#120c08'; c.fillRect(0, 0, T, WALL_H);
      for (let x = 0; x < T; x += 5.333) {
        c.fillStyle = g; c.fillRect(x + .9, 0, 3.6, WALL_H);
        c.fillStyle = 'rgba(255,225,190,.07)'; c.fillRect(x + .9, 0, 1, WALL_H);
      }
      // rodapé embutido
      c.fillStyle = '#0d0a08'; c.fillRect(0, WALL_H - 5, T, 5);
    } else if (tipo === 'acustico') {
      // painel acústico de feltro grafite em réguas verticais
      c.fillStyle = '#1b1c1f'; c.fillRect(0, 0, T, WALL_H);
      for (let x = 0; x < T; x += 16) {
        const g = c.createLinearGradient(0, 0, 0, WALL_H);
        g.addColorStop(0, '#3a3c41'); g.addColorStop(1, '#2a2c30');
        c.fillStyle = g; c.fillRect(x + 1, 0, 14, WALL_H);
        c.fillStyle = 'rgba(255,255,255,.035)'; c.fillRect(x + 1, 0, 1, WALL_H);
      }
      c.fillStyle = '#121214'; c.fillRect(0, WALL_H - 5, T, 5);
    }
    cacheTextura.set(ck, cv);
    return cv;
  }

  /** um painel de vidro da fachada: cidade atrás, caixilho e reflexo */
  function janela(ctx, o, x, y, t) {
    const T = ISO.TW;
    const len = (o === 'n' ? W : H) * T;
    const pan = NASSA.panorama(o, len, WALL_H);
    const off = o === 'n' ? x * T : (H - 1 - y) * T;
    const esc = pan.width / len;
    wallFace(ctx, o, x, y, 1, WALL_H, (c) => {
      c.drawImage(pan, off * esc, 0, T * esc, WALL_H * esc, 0, 0, T, WALL_H);
      // película e reflexo do vidro
      c.fillStyle = 'rgba(120,170,220,.10)'; c.fillRect(0, 0, T, WALL_H);
      c.fillStyle = 'rgba(255,255,255,.05)';
      c.beginPath(); c.moveTo(T * .15, 0); c.lineTo(T * .45, 0); c.lineTo(T * .05, WALL_H); c.lineTo(0, WALL_H); c.lineTo(0, WALL_H * .55); c.closePath(); c.fill();
      // caixilho: montante, travessa baixa e peitoril
      c.fillStyle = '#c4ccd8'; c.fillRect(0, 0, 2.2, WALL_H);
      c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(2.2, 0, 1, WALL_H);
      c.fillStyle = '#aab3c0'; c.fillRect(0, WALL_H - 14, T, 2);
      // pé do vidro serigrafado, da travessa ao peitoril. Transparente, ele
      // mostrava as janelas acesas da cidade numa tira fina rente ao chão: sob
      // o painel da equipe parecia uma fita de LED queimada
      c.fillStyle = '#232933'; c.fillRect(0, WALL_H - 12, T, 6);
      c.fillStyle = '#1b1f27'; c.fillRect(0, WALL_H - 6, T, 6);
      c.fillStyle = '#d4dbe5'; c.fillRect(0, 0, T, 3);
    });
  }

  /* LED da marca em tom sóbrio: o ciano/azul puxado para um branco frio.
     Saturado e forte, ele deixava o andar com cara de fliperama.       */
  const ledSobrio = (t, k) => NASSA.mix(NASSA.led(t, k), '#d9ecf5', .38);

  /* ---- uma parede ---- */
  function drawWallTile(ctx, x, y, t, rgbOn, zoom) {
    // afastado, o vidro fumê da divisória some em menos de um pixel
    const detalhe = (zoom === undefined || zoom > 0.7);
    const occ  = wallOccludes(x, y);
    const room = ROOMS[roomOf[idx(x, y)]] || ROOMS.corredor;
    const h    = occ ? PARAPET : WALL_H;
    const semLed = SEM_LED(room.id);
    const corLed = (k) => ledSobrio(t, k);

    const showLeft  = !isWall(x, y + 1);   // face virada para +y
    const showRight = !isWall(x + 1, y);   // face virada para +x
    // quina escondida pelas vizinhas: só a tampa. Se for parapeito (o canto
    // da sala de reunião), segue o caminho normal, senão ficava um buraco na
    // tampa de vidro e uma tampa escura solta lá em cima
    if (!showLeft && !showRight && !occ) {
      ISO.plane(ctx, x, y, 1, 1, WALL_H, C.wallTop);
      return;
    }

    const P = ISO.toScreen;
    const base = C.wall;

    const faces = [];
    if (showLeft)  faces.push({ o: 'n', pts: [P(x, y+1, h), P(x+1, y+1, h), P(x+1, y+1, 0), P(x, y+1, 0)], sh: -0.05 });
    if (showRight) faces.push({ o: 'w', pts: [P(x+1, y, h), P(x+1, y+1, h), P(x+1, y+1, 0), P(x+1, y, 0)], sh: -0.3  });

    let externa = false;
    for (const f of faces) {
      const mat = occ ? null : material(x, y, f.o);
      if (mat === 'vidro') { janela(ctx, f.o, x, y, t); externa = true; continue; }
      if (mat) {
        const tx = textura(mat, escalaDe(ctx));
        wallFace(ctx, f.o, x, y, 1, WALL_H, (c) => c.drawImage(tx, 0, 0, ISO.TW, WALL_H));
        if (f.o === 'w') ISO.quad(ctx, f.pts, 'rgba(0,0,0,.28)');   // face lateral mais escura
        externa = true;
        continue;
      }
      // corpo
      // as coordenadas da face são fixas em espaço de mundo, então o
      // gradiente pode ser criado uma vez só por tile
      const ck = x + ',' + y + ',' + f.o;
      let g = cacheGrad.get(ck);
      if (!g) {
        g = ctx.createLinearGradient(0, f.pts[0].y, 0, f.pts[2].y);
        g.addColorStop(0, ISO.shade(base, f.sh + 0.06));
        g.addColorStop(1, ISO.shade(base, f.sh - 0.28));
        cacheGrad.set(ck, g);
      }
      ISO.quad(ctx, f.pts, g);

      // rodapé com fita de LED: fina e discreta, só um friso de luz
      if (rgbOn && !semLed) {
        const neon = corLed(x + y);
        const strip = [
          f.pts[3], f.pts[2],
          { x: f.pts[2].x, y: f.pts[2].y - 3 },
          { x: f.pts[3].x, y: f.pts[3].y - 3 }
        ];
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ISO.quad(ctx, strip, ISO.rgba(neon, .26));
        ctx.restore();
      }
    }

    // topo
    ISO.plane(ctx, x, y, 1, 1, h, occ ? ISO.rgba('#8fa4d8', .28) : (externa ? '#9aa4b2' : C.wallTop));

    if (occ && detalhe) {
      // vidro fumê acima do parapeito
      for (const f of faces) {
        const top = [
          P(f.o === 'n' ? x : x + 1, f.o === 'n' ? y + 1 : y,     WALL_H),
          P(x + 1, y + 1, WALL_H),
          P(x + 1, y + 1, h),
          P(f.o === 'n' ? x : x + 1, f.o === 'n' ? y + 1 : y,     h)
        ];
        ISO.quad(ctx, top, ISO.rgba('#9fc4ff', .085));
        ISO.quad(ctx, top, null, ISO.rgba('#bcd8ff', .12));
      }
      // tampa do vidro: aresta de vidro incolor, não mais pintada da cor da sala
      ISO.plane(ctx, x, y, 1, 1, WALL_H, 'rgba(200,218,238,.09)');
    }

    // perfil de LED no topo da parede (menos na sala de jogos). Era a tampa
    // inteira acesa em neon, e de longe a planta toda virava um letreiro;
    // agora é só uma linha fina na aresta da frente, como um perfil embutido
    if (rgbOn && !semLed && (showLeft || showRight)) {
      const neon = corLed(x + y);
      const a = P(x, y + 1, WALL_H), b = P(x + 1, y + 1, WALL_H), c = P(x + 1, y, WALL_H);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = ISO.rgba(neon, externa ? .3 : .4);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      if (showLeft) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); } else ctx.moveTo(b.x, b.y);
      if (showRight) ctx.lineTo(c.x, c.y);
      ctx.stroke();
      ctx.restore();
    }

    drawSignTile(ctx, x, y, t, rgbOn);
  }

  /**
   * Fatia da placa que pertence a este tile de parede.
   * Uma placa larga tem uma profundidade só; se ela fosse um item solto na
   * ordenação, os tiles de parede depois dela pintariam por cima e a placa
   * parecia enfiada dentro da parede. Recortando por tile, cada pedaço é
   * pintado junto com a sua própria parede.
   */
  function drawSignTile(ctx, x, y, t, rgbOn) {
    for (const s of SIGNS) {
      const cobre = s.o === 'n'
        ? (s.y === y && x >= s.x && x < s.x + s.len)
        : (s.x === x && y >= s.y && y < s.y + s.len);
      if (!cobre) continue;

      // recorte por clip custava caro; agora copia só a fatia da placa que
      // é deste tile, direto do canvas em cache (na resolução do zoom)
      const T = ISO.TW;
      const off = s.o === 'n' ? (x - s.x) * T
                              : (s.y + s.len - 1 - y) * T;
      const m = ctx.getTransform();
      const esc = nivelPlaca(s, Math.hypot(m.a, m.b));
      const cv = placaCanvas(s, t, rgbOn, esc);
      // a fatia corre em u, que anda meio px de tela por px; as bordas entre
      // fatias são verticais na tela. Com a borda no meio de um pixel, as duas
      // fatias o cobriam pela metade e passava um fio escuro da parede: a
      // borda vai para o pixel inteiro (a vizinha faz a mesma conta). E vai
      // sempre para o lado do tile pintado ANTES: o de depois (à direita na
      // parede norte, à esquerda na oeste)
      // pinta o vidro dele por cima da fatia vizinha, e com o arredondamento
      // para o lado dele sobrava um fio do montante claro atravessando a TV
      const ox = s.o === 'n' ? ISO.toScreen(x, y + 1).x : ISO.toScreen(x + 1, y + 1).x;
      const arred = s.o === 'n' ? Math.floor : Math.ceil;
      const enc = u => m.b || m.c ? u : ((arred(m.a * (ox + u * ISO.HW / T) + m.e) - m.e) / m.a - ox) * T / ISO.HW;
      const u0 = Math.max(-off, enc(0)), u1 = Math.min(s.len * T - off, enc(T));
      if (u1 <= u0) continue;
      wallFace(ctx, s.o, x, y, 1, WALL_H, (c) =>
        c.drawImage(cv, (off + u0) * esc, 0, (u1 - u0) * esc, WALL_H * esc, u0, 0, u1 - u0, WALL_H));
    }
  }

  /* ---- porta ---- */
  function drawDoorTile(ctx, x, y, t) {
    const d = DOORS.find(d => d.x === x && d.y === y);
    if (!d) return;
    if (SEM_LED(roomAt(x, y + (d.o === 'h' ? 1 : 0)))) return;
    const neon = ledSobrio(t, x + y);
    const P = ISO.toScreen;
    const h = 96;

    // friso de luz na verga da porta, no mesmo tom sóbrio das paredes
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (d.o === 'h') {
      ISO.quad(ctx, [P(x, y+1, h), P(x+1, y+1, h), P(x+1, y+1, h-3), P(x, y+1, h-3)], ISO.rgba(neon, .4));
    } else {
      ISO.quad(ctx, [P(x+1, y, h), P(x+1, y+1, h), P(x+1, y+1, h-3), P(x+1, y, h-3)], ISO.rgba(neon, .4));
    }
    const c = ISO.toScreen(x + .5, y + .5, 30);
    ISO.glow(ctx, c.x, c.y, 62, neon, .06);
    ctx.restore();
  }

  /** profundidade do painel, para ele entrar na ordenação junto com
      móveis e bonecos — senão ele seria pintado por cima de todo mundo */
  function signDepth(s) {
    return s.o === 'n' ? (s.x + s.len / 2) + (s.y + 1)
                       : (s.x + 1) + (s.y + s.len / 2);
  }

  /* ---- conteúdo de uma placa, em espaço plano de parede ---- */
  function pintaPlaca(c, s, len, t, rgbOn) {
    if (s.kind === 'nome') {
      const padY = 16, hgt = 62;
      c.fillStyle = 'rgba(4,5,10,.62)';
      ISO.rrect(c, 6, padY, len - 12, hgt, 8); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 1; c.stroke();
      signNome(c, len, padY, hgt, rgbOn);
    }
    else if (s.kind === 'equipe')   signEquipe(c, len);
    else if (s.kind === 'eventos')  signEventos(c, len);
    else if (s.kind === 'quadro')   signQuadro(c, len);
    else if (s.kind === 'bmw')      signBmw(c, len, rgbOn);
    else if (s.kind === 'logo')     signLogo(c, len, rgbOn);
    else if (s.kind === 'pipeline') signPipeline(c, len, t, rgbOn);
    else if (s.kind === 'palmeiras') signPalmeiras(c, len);
    else if (s.kind === 'logoParede') signLogoParede(c, len);
  }

  /* a chave de versão é pedida por tile de parede, a cada quadro: refeita
     no máximo a cada `ms`, e a placa compara só o texto que sai daqui     */
  function aCada(ms, fn) {
    let v, ate = -1;
    return () => {
      const a = performance.now();
      if (a >= ate) { v = fn(); ate = a + ms; }
      return v;
    };
  }

  /* placas paradas só repintam quando algo nelas muda. A TV da equipe, o
     quadro de ideias e a agenda também: mudam com a equipe, com o que foi
     anotado, com o minuto (o relógio da TV) ou com o dia (o calendário)  */
  const PLACA_FIXA = {
    bmw:  () => BMW.pronto ? 'ok' : 'carregando',
    palmeiras: () => fontesProntas() ? 'ok' : 'carregando',
    logo: () => NASSA.pronto(NASSA.logo) ? 'ok' : 'carregando',
    logoParede: () => NASSA.pronto(NASSA.logo) ? 'ok' : 'carregando',
    equipe:  aCada(400, chaveEquipe),
    quadro:  aCada(400, () => (typeof QUADRO !== 'undefined' ? QUADRO.versao() : 0) + '|' + fontesProntas()),
    eventos: aCada(1000, chaveEventos)
  };
  /* Cada placa é pintada uma vez num canvas próprio e depois só é COPIADA
     para cada tile de parede. Antes ela era redesenhada inteira por tile —
     50 desenhos completos por quadro, vários com shadowBlur, e era daí que
     vinha quase toda a lentidão.
     A resolução acompanha o zoom (1x a 4x): em 2x fixo, a foto da BMW e a
     camisa do Palmeiras ficavam borradas na tela 3x do celular. A que se
     repinta sozinha (o CI/CD, animado) para em 3x: lá cada repintura custa
     o triplo de pixels. Um nível que fica uns segundos sem aparecer é
     descartado.                                                           */
  const NIVEIS_PLACA = [1, 2, 3, 4];
  const ESC_SOMBRA = 2;    // as sombras e brilhos das placas foram acertados em 2x
  let kSombra = 1;         // shadowBlur não segue a escala do ctx: corrige à mão
  function nivelPlaca(s, escala) {
    const teto = PLACA_FIXA[s.kind] ? 4 : 3;
    for (const n of NIVEIS_PLACA) if (n >= teto || n * 1.12 >= escala) return n;
    return teto;
  }
  const cachePlaca = new Map();      // placa -> { nível: { cv, ctx, t, rgb, ver, uso } }
  let placasVarridas = 0;
  function placaCanvas(s, t, rgbOn, esc = ESC_SOMBRA) {
    let niveis = cachePlaca.get(s);
    if (!niveis) cachePlaca.set(s, niveis = {});
    let c = niveis[esc];
    if (!c) {
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(s.len * ISO.TW * esc); cv.height = WALL_H * esc;
      c = niveis[esc] = { cv, ctx: cv.getContext('2d'), t: -1e9, rgb: null, ver: null, uso: 0 };
    }
    const fixa = PLACA_FIXA[s.kind];
    const ver = fixa ? fixa() : null;
    // repinta no máximo ~6x por segundo; o olho não vê diferença
    const vencida = fixa ? (c.ver !== ver) : (t - c.t > 0.16 || c.t > t);
    if (vencida || c.rgb !== rgbOn) {
      c.t = t; c.rgb = rgbOn; c.ver = ver;
      c.ctx.setTransform(1, 0, 0, 1, 0, 0);
      c.ctx.clearRect(0, 0, c.cv.width, c.cv.height);
      c.ctx.setTransform(esc, 0, 0, esc, 0, 0);
      kSombra = esc / ESC_SOMBRA;
      pintaPlaca(c.ctx, s, s.len * ISO.TW, t, rgbOn);
      kSombra = 1;
    }
    const agora = performance.now();
    c.uso = agora;
    if (agora - placasVarridas > 2000) {
      placasVarridas = agora;
      for (const nv of cachePlaca.values()) for (const k in nv) {
        if (agora - nv[k].uso < 5000) continue;
        nv[k].cv.width = nv[k].cv.height = 0;      // devolve a memória já (o Safari demora)
        delete nv[k];
      }
    }
    return c.cv;
  }

  /* ---- logos e painéis nas paredes altas ---- */
  function drawSigns(ctx, t, rgbOn, lista) {
    for (const s of (lista || SIGNS)) {
      const esc = nivelPlaca(s, escalaDe(ctx));
      const cv = placaCanvas(s, t, rgbOn, esc);
      wallFace(ctx, s.o, s.x, s.y, s.len, WALL_H, (c) => c.drawImage(cv, 0, 0, s.len * ISO.TW, WALL_H));
    }
  }

  /* ===========================================================
     QUADROS DA PAREDE: a TV da equipe, a agenda e as ideias do chefe
     =========================================================== */

  /* Na tela, o eixo u da parede encolhe para ~0,56 (o plano está de lado).
     Estes três são desenhados num espaço esticado em u por K, como a camisa
     do Palmeiras: o retrato sai redondo, o dia do calendário sai quadrado e
     a letra tem a largura de verdade, em vez de espremida.               */
  const K_PAREDE = 1.78;
  const F_COND = "'Barlow Semi Condensed', sans-serif";
  const DIAS_CURTOS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
  const INICIAIS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  const MESES = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO',
                 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
  const dois = n => String(n).padStart(2, '0');
  const hhmm = d => dois(d.getHours()) + ':' + dois(d.getMinutes());

  /** corta o texto com reticências para caber em w, na fonte atual */
  function cabe(c, txt, w) {
    txt = String(txt);
    if (c.measureText(txt).width <= w) return txt;
    let a = 0, b = txt.length;
    while (a < b) {
      const m = (a + b + 1) >> 1;
      if (c.measureText(txt.slice(0, m).trimEnd() + '…').width <= w) a = m; else b = m - 1;
    }
    return a ? txt.slice(0, a).trimEnd() + '…' : '';
  }

  /** quebra em até `max` linhas de largura w; o que sobrar vira reticências */
  function quebra(c, txt, w, max) {
    const L = [];
    let lin = '';
    for (const p of String(txt).trim().split(/\s+/)) {
      const tenta = lin ? lin + ' ' + p : p;
      if (!lin || c.measureText(tenta).width <= w) { lin = tenta; continue; }
      L.push(lin); lin = p;
    }
    if (lin) L.push(lin);
    const cortou = L.length > max;
    if (cortou) L.splice(max - 1, L.length, L.slice(max - 1).join(' '));
    // palavra sozinha maior que a linha, ou o resto que não coube
    for (let i = 0; i < L.length; i++) if (c.measureText(L[i]).width > w) L[i] = cabe(c, L[i], w);
    return { linhas: L, cortou: cortou || L.some(l => l.endsWith('…')) };
  }

  /* ---------------- TV da equipe (sala dos devs) ---------------- */

  /* status: as mesmas cores das etiquetas dos bonecos (STATUS_COLOR, app.js) */
  const COR_STATUS = { trabalhando: '#23e08a', reuniao: '#38bdf8', descanso: '#ffb020', offline: '#5a6280' };
  const NOME_STATUS = { trabalhando: 'TRABALHANDO', reuniao: 'REUNIÃO', descanso: 'DESCANSO', offline: 'OFFLINE' };
  const ORDEM_STATUS = { trabalhando: 0, reuniao: 1, descanso: 2, offline: 3 };
  const COR_SISTEMA = { 'no ar': '#23e08a', web: '#38bdf8', subindo: '#ffb020', caiu: '#ff7a6b', desligado: '#5a6280' };

  /** o que a pessoa está fazendo, curto: o sistema que ela toca ou onde está */
  function fazendo(a) {
    if (a.status === 'reuniao')  return 'na sala de reunião';
    if (a.status === 'descanso') return 'na sala de jogos';
    if (a.status === 'offline')  return 'fora do expediente';
    return a.system || String(a.role || '').split(' · ')[0];
  }

  /* Retrato (busto) de cada pessoa, pintado uma vez por aparência num
     canvas pequeno. A TV só copia: redesenhar dez bonecos a cada repintura
     era trabalho jogado fora.                                            */
  const retratos = new Map();
  function retrato(a) {
    const lk = a.look || {};
    const chave = [lk.skin, lk.hair, lk.style, lk.shirt, lk.glasses, lk.beard, lk.cap].join('|');
    const r = retratos.get(a.id);
    if (r && r.chave === chave) return r.cv;
    const N = 64, cv = document.createElement('canvas');
    cv.width = cv.height = N;
    const c = cv.getContext('2d');
    c.beginPath(); c.arc(N / 2, N / 2, N / 2, 0, 7); c.clip();
    const g = c.createLinearGradient(0, 0, 0, N);
    g.addColorStop(0, '#2c3749'); g.addColorStop(1, '#151b26');
    c.fillStyle = g; c.fillRect(0, 0, N, N);
    if (typeof AVATAR !== 'undefined' && a.look) {
      // de frente, enquadrado da ponta do cabelo aos ombros (cabeça em y -65…-44)
      const R = 17;
      c.translate(N / 2, N / 2); c.scale(N / (2 * R), N / (2 * R)); c.translate(1, 54);
      AVATAR.draw(c, a.look, 0, 0, 's', { phase: 0 });
    }
    retratos.set(a.id, { chave, cv });
    return cv;
  }

  /** chave da TV: muda com a equipe, com os sistemas e com o minuto */
  function chaveEquipe() {
    const d = new Date();
    let k = hhmm(d) + '|' + d.getDate() + '|' + fontesProntas();
    if (typeof ROSTER !== 'undefined') {
      for (const a of ROSTER.all()) {
        const lk = a.look || {};
        k += '|' + a.id + ':' + a.status + ':' + a.name + ':' + (a.system || '') + ':' + lk.skin + lk.hair + lk.style + lk.shirt;
      }
    }
    if (typeof SISTEMAS !== 'undefined') for (const s of SISTEMAS.todos()) k += '|' + s.estado;
    return k;
  }

  /* As TVs da sala dos devs ficam penduradas no forro por duas hastes (o
     vidro da fachada não segura parafuso), com a tela opaca numa moldura
     fina e uma sombra leve no vidro. A borda de baixo assenta na travessa
     do caixilho (v 94): com qualquer fresta, as janelas acesas da cidade
     viravam uma fileira de pontinhos rente à TV. Desenhadas no espaço
     esticado (K), sem shadowBlur.                                       */
  const TV = { y: 12, h: WALL_H - 14 - 12 };
  function telaTV(c, x, y, w, h) {
    for (const f of [.18, .82]) {
      const hx = x + w * f;
      c.fillStyle = '#2b313b'; c.fillRect(hx - .7, 0, 1.4, y);
      c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(hx - .7, 0, .45, y);
      c.fillStyle = '#3b424d'; c.fillRect(hx - 2.4, y - 1.6, 4.8, 1.8);
    }
    // sombra no vidro, puxada para baixo e para a direita
    for (let i = 3; i >= 1; i--) {
      c.fillStyle = 'rgba(0,0,0,' + (.05 + (3 - i) * .045) + ')';
      ISO.rrect(c, x + 1.6 - i * .7, y + 2.6 - i * .5, w + i * 1.4, h + i * 1.2, 3 + i);
      c.fill();
    }
    // corpo: moldura grafite fina, com um fio de luz na aresta de cima
    const gb = c.createLinearGradient(0, y, 0, y + h);
    gb.addColorStop(0, '#262a32'); gb.addColorStop(1, '#101216');
    c.fillStyle = gb; ISO.rrect(c, x, y, w, h, 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(x + 2, y + .25, w - 4, .45);
    const b = 2, s = { x: x + b, y: y + b, w: w - 2 * b, h: h - 2 * b - .4 };
    const gt = c.createLinearGradient(0, s.y, 0, s.y + s.h);
    gt.addColorStop(0, '#0c1017'); gt.addColorStop(1, '#06080c');
    c.fillStyle = gt; c.fillRect(s.x, s.y, s.w, s.h);
    // led de ligada no canto da moldura
    c.fillStyle = 'rgba(120,225,255,.75)';
    c.beginPath(); c.arc(x + w - 4.5, y + h - 1.1, .45, 0, 7); c.fill();
    return s;
  }
  /** reflexo do vidro da tela */
  function brilhoTV(c, s) {
    c.save();
    c.beginPath(); c.rect(s.x, s.y, s.w, s.h); c.clip();
    c.fillStyle = 'rgba(255,255,255,.028)';
    c.beginPath();
    c.moveTo(s.x + s.w * .52, s.y); c.lineTo(s.x + s.w * .74, s.y);
    c.lineTo(s.x + s.w * .58, s.y + s.h); c.lineTo(s.x + s.w * .36, s.y + s.h);
    c.closePath(); c.fill();
    c.restore();
  }
  /* A TV do CI/CD se repinta seis vezes por segundo, mas a moldura dela
     não muda: é pintada uma vez por resolução e só copiada. Refeita a cada
     repintura (meia dúzia de preenchimentos do tamanho da placa), ela
     deixava cada repintura seis vezes mais cara que a do painel antigo.
     Chamada no espaço da parede, antes do esticão K.                     */
  const cacheTV = new Map();
  function fundoTV(c, len) {
    const W = len / K_PAREDE, x = 5, w = W - 10, b = 2;
    const s = { x: x + b, y: TV.y + b, w: w - 2 * b, h: TV.h - 2 * b - .4 };
    const esc = c.getTransform().a;            // a resolução do canvas da placa
    const ck = len + '@' + esc;
    let cv = cacheTV.get(ck);
    if (!cv) {
      cv = document.createElement('canvas');
      cv.width = Math.ceil(len * esc); cv.height = WALL_H * esc;
      const g = cv.getContext('2d');
      g.setTransform(esc * K_PAREDE, 0, 0, esc, 0, 0);
      telaTV(g, x, TV.y, w, TV.h);
      brilhoTV(g, s);                          // o reflexo fica por baixo do texto
      cacheTV.set(ck, cv);
    }
    c.drawImage(cv, 0, 0, cv.width / esc, WALL_H);
    return s;
  }

  /* ---- TV da equipe: quem está aqui e fazendo o quê, e os sistemas ---- */
  function signEquipe(c, len) {
    const W = len / K_PAREDE;
    c.save(); c.scale(K_PAREDE, 1);
    const s = telaTV(c, 5, TV.y, W - 10, TV.h);
    const px = s.x + 6, pw = s.w - 12;
    c.textBaseline = 'middle';

    // cabeçalho: título, data e hora
    const agora = new Date(), hy = s.y + 7.2;
    c.textAlign = 'left';
    c.font = `700 6.2px ${F_COND}`; c.letterSpacing = '.7px'; c.fillStyle = '#41c6ff';
    c.fillText('EQUIPE AGORA', px, hy);
    c.letterSpacing = '0px';
    c.textAlign = 'right';
    c.font = "700 7.4px 'Barlow', sans-serif"; c.fillStyle = '#eef3fb';
    const hora = hhmm(agora);
    c.fillText(hora, px + pw, hy);
    const lh = c.measureText(hora).width;
    c.font = `600 5px ${F_COND}`; c.letterSpacing = '.35px'; c.fillStyle = 'rgba(190,202,224,.62)';
    c.fillText(DIAS_CURTOS[agora.getDay()] + ' · ' + agora.getDate() + ' ' + MESES[agora.getMonth()].slice(0, 3), px + pw - lh - 5.4, hy + .3);
    c.letterSpacing = '0px';
    c.fillStyle = 'rgba(255,255,255,.08)';
    c.fillRect(px, s.y + 12.6, pw, .5);

    // a equipe: quem trabalha primeiro, o chefe na frente
    const RO = (typeof ROSTER !== 'undefined') ? ROSTER.all() : [];
    const pessoas = RO.map((a, i) => ({ a, i })).sort((p, q) =>
      ((ORDEM_STATUS[p.a.status] ?? 4) - (ORDEM_STATUS[q.a.status] ?? 4)) ||
      ((q.a.boss ? 1 : 0) - (p.a.boss ? 1 : 0)) || (p.i - q.i)).map(p => p.a);
    const topo = s.y + 15, base = s.y + s.h - 12.4;
    if (!pessoas.length) {
      c.textAlign = 'center';
      c.font = `500 6px ${F_COND}`; c.fillStyle = 'rgba(190,202,224,.5)';
      c.fillText('chamando a equipe…', s.x + s.w / 2, (topo + base) / 2);
    } else {
      const cols = pessoas.length > 10 ? 3 : 2, maxL = 5, cap = cols * maxL;
      const mostra = pessoas.length > cap ? pessoas.slice(0, cap - 1) : pessoas;
      const resto = pessoas.length - mostra.length;
      const linhas = Math.min(maxL, Math.ceil((mostra.length + (resto ? 1 : 0)) / cols));
      const gap = 6, cw = (pw - gap * (cols - 1)) / cols;
      const rh = Math.min(12.4, (base - topo) / linhas);
      mostra.forEach((a, i) => {
        const col = Math.floor(i / linhas), lin = i % linhas;
        linhaPessoa(c, a, px + col * (cw + gap), topo + lin * rh, cw, rh, cols < 3);
      });
      if (resto) {
        const i = mostra.length, col = Math.floor(i / linhas), lin = i % linhas;
        c.textAlign = 'left';
        c.font = `600 6px ${F_COND}`; c.fillStyle = 'rgba(190,202,224,.6)';
        c.fillText('+ ' + resto + (resto > 1 ? ' pessoas' : ' pessoa'), px + col * (cw + gap) + 3, topo + lin * rh + rh / 2);
      }
    }

    // rodapé: os sistemas, um traço por sistema e a conta por estado
    c.fillStyle = 'rgba(255,255,255,.07)';
    c.fillRect(px, s.y + s.h - 11.2, pw, .5);
    const fy = s.y + s.h - 5.4;
    const SI = (typeof SISTEMAS !== 'undefined') ? SISTEMAS.todos() : [];
    c.textAlign = 'left';
    c.font = `700 4.6px ${F_COND}`; c.letterSpacing = '.6px'; c.fillStyle = 'rgba(160,176,204,.7)';
    c.fillText('SISTEMAS', px, fy);
    let sx = px + c.measureText('SISTEMAS').width + 4;
    c.letterSpacing = '0px';
    if (!SI.length) {
      c.font = `500 5px ${F_COND}`; c.fillStyle = 'rgba(160,176,204,.5)';
      c.fillText('nenhum sistema cadastrado', sx, fy);
    } else {
      const conta = {};
      for (const si of SI) conta[si.estado] = (conta[si.estado] || 0) + 1;
      // legenda da direita para a esquerda: no ar, web e desligado sempre;
      // subindo e caiu só quando há
      const ordem = ['no ar', 'web', 'subindo', 'caiu', 'desligado'].filter(e => conta[e] || ['no ar', 'web', 'desligado'].includes(e));
      c.font = `600 5.2px ${F_COND}`; c.textAlign = 'right';
      let rx = px + pw;
      for (let i = ordem.length - 1; i >= 0; i--) {
        const e = ordem[i], txt = (conta[e] || 0) + ' ' + e;
        c.fillStyle = conta[e] ? 'rgba(222,230,244,.86)' : 'rgba(160,176,204,.45)';
        c.fillText(txt, rx, fy + .2);
        rx -= c.measureText(txt).width + 3.2;
        c.fillStyle = conta[e] ? COR_SISTEMA[e] : 'rgba(110,122,148,.6)';
        c.beginPath(); c.arc(rx + .6, fy, 1.25, 0, 7); c.fill();
        rx -= 6;
      }
      // um traço por sistema, na cor do estado
      const livre = rx - sx - 4, n = SI.length;
      const sw = Math.max(1.6, Math.min(7, livre / n - 1.2));
      for (const si of SI.slice(0, Math.floor(livre / (sw + 1.2)))) {
        c.fillStyle = COR_SISTEMA[si.estado] || '#5a6280';
        ISO.rrect(c, sx, fy - 1.2, sw, 2.4, 1.2); c.fill();
        sx += sw + 1.2;
      }
    }
    brilhoTV(c, s);
    c.restore();
  }

  /** uma linha da lista: retrato com anel de status, nome, o que faz e o selo */
  function linhaPessoa(c, a, x, y, w, h, comAtividade) {
    const cor = COR_STATUS[a.status] || '#5a6280';
    const off = a.status === 'offline';
    c.fillStyle = 'rgba(255,255,255,.035)';
    ISO.rrect(c, x, y + .5, w, h - 1.4, 2); c.fill();
    const d = h - 3.4, cy = y + .5 + (h - 1.4) / 2, cx = x + 1.7 + d / 2;
    c.save();
    if (off) c.globalAlpha = .45;
    c.drawImage(retrato(a), cx - d / 2, cy - d / 2, d, d);
    c.restore();
    c.strokeStyle = cor; c.lineWidth = .75;
    c.beginPath(); c.arc(cx, cy, d / 2 + .15, 0, 7); c.stroke();

    // selo do status, encostado na direita
    c.font = `700 4px ${F_COND}`; c.letterSpacing = '.3px';
    const rot = NOME_STATUS[a.status] || String(a.status || '').toUpperCase();
    const sw = c.measureText(rot).width + 6.4, sh = 5.4, sx = x + w - sw - 1.8;
    c.fillStyle = ISO.rgba(cor, off ? .1 : .12);
    ISO.rrect(c, sx, cy - sh / 2, sw, sh, sh / 2); c.fill();
    c.fillStyle = cor;
    c.beginPath(); c.arc(sx + 2.6, cy, .9, 0, 7); c.fill();
    c.fillStyle = off ? '#8b93ad' : ISO.rgba(cor, .92);
    c.textAlign = 'center';
    c.fillText(rot, sx + sw / 2 + 1.25, cy + .2);
    c.letterSpacing = '0px';

    // nome e, na mesma linha, o que está fazendo
    let tx = cx + d / 2 + 3.4;
    c.textAlign = 'left';
    c.font = `700 7px ${F_COND}`;
    c.fillStyle = off ? 'rgba(220,226,240,.5)' : '#f1f5fb';
    const nome = cabe(c, a.name, Math.min(46, sx - tx - 3));
    c.fillText(nome, tx, cy + .3);
    if (!comAtividade) return;
    tx += c.measureText(nome).width + 3.4;
    c.font = `500 5.6px ${F_COND}`;
    c.fillStyle = off ? 'rgba(170,180,200,.42)' : 'rgba(196,206,226,.72)';
    const atv = cabe(c, fazendo(a), sx - tx - 2.6);
    if (atv) c.fillText(atv, tx, cy + .5);
  }

  /* ---------------- sala do chefe: nogueira, latão e couro ---------------- */

  /** luz quente de parede lavando o painel ripado, como nos quadros da parede norte */
  function luzQuente(c, W) {
    const g = c.createRadialGradient(W / 2, 0, 4, W / 2, 26, W * .62);
    g.addColorStop(0, 'rgba(255,226,170,.16)'); g.addColorStop(1, 'rgba(255,226,170,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, WALL_H);
  }

  /** moldura de nogueira escura com filete de latão e sombra na parede;
      devolve o retângulo de dentro                                       */
  function molduraNogueira(c, x, y, w, h) {
    // sombra na parede em camadas: o shadowBlur em 4x custava mais que o resto
    for (let i = 4; i >= 1; i--) {
      c.fillStyle = 'rgba(0,0,0,' + (.07 + (4 - i) * .05) + ')';
      ISO.rrect(c, x + 2.4 - i * .55, y + 3.2 - i * .55, w + i * 1.1, h + i * 1.1, 2 + i);
      c.fill();
    }
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#4d3321'); g.addColorStop(.5, '#3b2617'); g.addColorStop(1, '#2a1a0f');
    c.fillStyle = g; ISO.rrect(c, x, y, w, h, 1.8); c.fill();
    // veio da madeira correndo na moldura
    c.strokeStyle = 'rgba(255,214,170,.05)'; c.lineWidth = .4;
    for (let i = 1; i < 4; i++) {
      c.beginPath(); c.moveTo(x + 2, y + i * .9); c.lineTo(x + w - 2, y + i * .9); c.stroke();
      c.beginPath(); c.moveTo(x + 2, y + h - i * .9); c.lineTo(x + w - 2, y + h - i * .9); c.stroke();
    }
    // chanfro: luz em cima e à esquerda, sombra embaixo
    c.fillStyle = 'rgba(255,226,186,.2)';
    c.fillRect(x + 1.5, y + .2, w - 3, .5); c.fillRect(x + .2, y + 1.5, .5, h - 3);
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x + 1.5, y + h - .7, w - 3, .5);
    const b = 3.6, r = { x: x + b, y: y + b, w: w - 2 * b, h: h - 2 * b };
    c.strokeStyle = '#b39a5c'; c.lineWidth = .7;
    c.strokeRect(r.x - .45, r.y - .45, r.w + .9, r.h + .9);
    return r;
  }

  /** a moldura funda faz sombra no fundo, em cima e à esquerda */
  function sombraInterna(c, r) {
    const gs = c.createLinearGradient(0, r.y, 0, r.y + 6);
    gs.addColorStop(0, 'rgba(0,0,0,.42)'); gs.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gs; c.fillRect(r.x, r.y, r.w, 6);
    const gl = c.createLinearGradient(r.x, 0, r.x + 4, 0);
    gl.addColorStop(0, 'rgba(0,0,0,.25)'); gl.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gl; c.fillRect(r.x, r.y, 4, r.h);
  }

  /** plaqueta de latão gravada, centrada em cx */
  function plaquinhaLatao(c, cx, y, txt) {
    const alt = 6.8;
    c.font = `700 4.5px ${F_COND}`; c.letterSpacing = '1.1px';
    const w = c.measureText(txt).width + 9, x = cx - w / 2;
    c.fillStyle = 'rgba(0,0,0,.38)'; c.fillRect(x + .5, y + .8, w, alt);
    const g = c.createLinearGradient(0, y, 0, y + alt);
    g.addColorStop(0, '#dcc07a'); g.addColorStop(.55, '#c2a25c'); g.addColorStop(1, '#94763c');
    c.fillStyle = g; c.fillRect(x, y, w, alt);
    c.strokeStyle = 'rgba(70,52,20,.7)'; c.lineWidth = .4;
    c.strokeRect(x + .2, y + .2, w - .4, alt - .4);
    c.fillStyle = 'rgba(70,52,20,.75)';
    for (const sx of [x + 2, x + w - 2]) { c.beginPath(); c.arc(sx, y + alt / 2, .55, 0, 7); c.fill(); }
    // gravado: o texto escuro com um fio de luz por baixo
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = 'rgba(255,240,200,.4)'; c.fillText(txt, cx + .55, y + alt / 2 + .75);
    c.fillStyle = '#2b2214'; c.fillText(txt, cx + .55, y + alt / 2 + .35);
    c.letterSpacing = '0px';
  }

  /* ---------------- agenda: calendário do mês e próximos eventos ---------------- */

  /** a reunião dos agentes (data/config.json → reuniao). Sem o servidor
      (GitHub Pages) não há config: valem os padrões do config.exemplo,
      segunda e sexta às 11h, e a agenda nunca fica vazia               */
  function reuniaoAgentes() {
    const R = (window.ESCRITORIO && window.ESCRITORIO.reuniao) || {};
    const dias = Array.isArray(R.dias) ? R.dias.map(Number).filter(d => d >= 0 && d <= 6) : [1, 5];
    const num = (v, pad) => (v === undefined || v === null || v === '' || !isFinite(+v)) ? pad : +v;
    return { dias, hora: num(R.hora, 11), minuto: num(R.minuto, 0), dur: num(R.duracaoMin, 30) };
  }

  /** a data do evento como foi anotada ("20/10", "20/10/26", "hoje"…).
      Sem ano, vale a próxima: 05/01 anotado em dezembro é o janeiro que vem */
  function dataDoEvento(txt, hoje) {
    const s = String(txt || '').trim().toLowerCase();
    if (s === 'hoje') return new Date(hoje);
    if (/^amanh[ãa]$/.test(s)) { const d = new Date(hoje); d.setDate(d.getDate() + 1); return d; }
    const m = /^(\d{1,2})\s*[\/.\-]\s*(\d{1,2})(?:\s*[\/.\-]\s*(\d{2}|\d{4}))?$/.exec(s);
    if (!m) return null;
    const dia = +m[1], mes = +m[2] - 1;
    const ano = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : hoje.getFullYear();
    const d = new Date(ano, mes, dia);
    if (d.getMonth() !== mes || d.getDate() !== dia) return null;   // 31/02 e afins
    if (!m[3] && hoje - d > 60 * 864e5) d.setFullYear(ano + 1);
    return d;
  }

  /** o que entra na agenda: os eventos anotados que não passaram e as
      próximas reuniões dos agentes. Também os dias marcados do mês.     */
  function agenda(agora, vagas) {
    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const R = reuniaoAgentes();
    const anotados = [], marcas = {};
    const marca = (d, tipo) => {
      if (d.getMonth() !== hoje.getMonth() || d.getFullYear() !== hoje.getFullYear()) return;
      (marcas[d.getDate()] = marcas[d.getDate()] || {})[tipo] = true;
    };
    for (const e of (typeof QUADRO !== 'undefined' ? QUADRO.eventos() : [])) {
      const d = dataDoEvento(e.data, hoje);
      if (d && d < hoje) continue;                       // já passou
      if (d) marca(d, 'evento');
      // data que não deu para ler ("semana que vem"): vai para o fim, com o texto no detalhe
      anotados.push({ d, nome: e.nome, meta: d ? e.tipo : String(e.data) + ' · ' + e.tipo, tipo: 'evento' });
    }
    const reunioes = [];
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
    for (let i = 1; i <= fim; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth(), i);
      if (R.dias.includes(d.getDay())) marca(d, 'reuniao');
    }
    for (let i = 0; i < 45 && reunioes.length < 6 && R.dias.length; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + i, R.hora, R.minuto);
      if (!R.dias.includes(d.getDay())) continue;
      if (d.getTime() + R.dur * 60000 <= agora.getTime()) continue;   // a de hoje já acabou
      reunioes.push({ d, nome: 'Reunião dos agentes', meta: hhmm(d) + ' · sala de reunião', tipo: 'reuniao' });
    }
    // a reunião não pode tomar a lista (quatro vezes o mesmo nome não diz
    // nada): entram as duas próximas no que sobrar, e a próxima sempre
    const itens = anotados.concat(reunioes.slice(0, Math.max(1, Math.min(2, vagas - anotados.length))));
    itens.sort((a, b) => (a.d ? a.d.getTime() : Infinity) - (b.d ? b.d.getTime() : Infinity));
    return { hoje, itens: itens.slice(0, vagas), marcas, R };
  }

  /** chave da agenda: o que foi anotado, o dia e se a reunião de hoje já acabou */
  function chaveEventos() {
    const d = new Date(), R = reuniaoAgentes();
    const fimHoje = R.dias.includes(d.getDay()) && (d.getHours() * 60 + d.getMinutes() >= R.hora * 60 + R.minuto + R.dur);
    return (typeof QUADRO !== 'undefined' ? QUADRO.versao() : 0) + '|' + d.getFullYear() + '-' + d.getMonth() + '-' +
           d.getDate() + '|' + fimHoje + '|' + fontesProntas();
  }

  function signEventos(c, len) {
    const W = len / K_PAREDE;
    c.save(); c.scale(K_PAREDE, 1);
    luzQuente(c, W);
    const r = molduraNogueira(c, 4, 9, W - 8, 86);
    // fundo grafite acetinado
    const g = c.createLinearGradient(0, r.y, 0, r.y + r.h);
    g.addColorStop(0, '#222327'); g.addColorStop(1, '#17181b');
    c.fillStyle = g; c.fillRect(r.x, r.y, r.w, r.h);
    sombraInterna(c, r);
    plaquinhaLatao(c, W / 2, r.y + 3.2, 'PRÓXIMOS EVENTOS');

    const agora = new Date(), VAGAS = 4;
    const { hoje, itens, marcas, R } = agenda(agora, VAGAS);
    const TXT = '#efe7d8', LATAO = '#d2b46a';

    /* calendário do mês, à esquerda */
    const cx0 = r.x + 3.6, cw = 7.7, gx = cx0 + 7 * cw;
    const ano = hoje.getFullYear(), mes = hoje.getMonth();
    const desloc = new Date(ano, mes, 1).getDay(), nDias = new Date(ano, mes + 1, 0).getDate();
    const semanas = Math.ceil((desloc + nDias) / 7);
    c.textBaseline = 'middle'; c.textAlign = 'left';
    c.font = `700 5.4px ${F_COND}`; c.letterSpacing = '.9px'; c.fillStyle = TXT;
    c.fillText(MESES[mes], cx0 + .6, r.y + 17.2);
    c.letterSpacing = '0px';
    c.textAlign = 'right';
    c.font = `600 4.6px ${F_COND}`; c.fillStyle = ISO.rgba(LATAO, .8);
    c.fillText(String(ano), gx - .6, r.y + 17.4);
    c.textAlign = 'center';
    c.font = `700 3.9px ${F_COND}`;
    INICIAIS.forEach((l, i) => {
      c.fillStyle = ISO.rgba(LATAO, i === 0 || i === 6 ? .5 : .78);
      c.fillText(l, cx0 + (i + .5) * cw, r.y + 23.6);
    });
    c.fillStyle = 'rgba(210,180,106,.22)'; c.fillRect(cx0, r.y + 26.4, 7 * cw, .4);
    const gy0 = r.y + 27.6, ch = Math.min(cw, (r.y + r.h - 2.6 - gy0) / semanas);
    for (let dia = 1; dia <= nDias; dia++) {
      const p = desloc + dia - 1, col = p % 7, lin = Math.floor(p / 7);
      const x = cx0 + (col + .5) * cw, y = gy0 + (lin + .5) * ch - .4;
      const eHoje = dia === hoje.getDate(), passou = dia < hoje.getDate();
      if (eHoje) {
        const gh = c.createLinearGradient(0, y - 3.4, 0, y + 3.4);
        gh.addColorStop(0, '#e6cb86'); gh.addColorStop(1, '#a8873f');
        c.fillStyle = gh; c.beginPath(); c.arc(x, y + .1, 3.35, 0, 7); c.fill();
      }
      c.font = `${eHoje ? 700 : 600} 4.5px 'Barlow', sans-serif`;
      c.fillStyle = eHoje ? '#1f1a10' : (col === 0 || col === 6) ? 'rgba(239,231,216,.5)' : TXT;
      if (passou) c.globalAlpha = .38;
      c.fillText(String(dia), x, y + .3);
      c.globalAlpha = 1;
      // marcas do dia: latão para o que foi anotado, verde-água para a reunião
      const mk = marcas[dia];
      if (mk) {
        const cores = [];
        if (mk.evento) cores.push('#e8c46e');
        if (mk.reuniao) cores.push('#5fd4b4');
        cores.forEach((cor, i) => {
          c.fillStyle = passou ? ISO.rgba(cor, .35) : cor;
          c.beginPath(); c.arc(x + (i - (cores.length - 1) / 2) * 1.7, y + (eHoje ? 4.6 : 2.9), .55, 0, 7); c.fill();
        });
      }
    }

    /* próximos eventos, à direita */
    const lx = gx + 4.6, lw = r.x + r.w - 3 - lx;
    c.fillStyle = 'rgba(210,180,106,.28)'; c.fillRect(gx + 2.2, r.y + 14, .4, r.h - 17);
    const ly0 = r.y + 13.2, ih = (r.y + r.h - 2.4 - ly0) / VAGAS;
    if (!itens.length) {
      c.textAlign = 'left';
      c.font = `500 5.2px ${F_COND}`; c.fillStyle = 'rgba(239,231,216,.5)';
      c.fillText('agenda livre', lx, ly0 + ih / 2);
    }
    itens.forEach((it, i) => {
      const y = ly0 + i * ih, my = y + ih / 2;
      if (i) { c.fillStyle = 'rgba(239,231,216,.07)'; c.fillRect(lx, y, lw, .4); }
      // a data numa ficha: dia grande, dia da semana em latão
      const fw = 11;
      c.fillStyle = it.tipo === 'reuniao' ? 'rgba(95,212,180,.10)' : 'rgba(232,196,110,.10)';
      ISO.rrect(c, lx, my - 5, fw, 10, 1.4); c.fill();
      c.fillStyle = it.tipo === 'reuniao' ? '#5fd4b4' : '#e8c46e';
      c.fillRect(lx, my - 4, .6, 8);
      c.textAlign = 'center';
      if (it.d) {
        c.font = "700 5.8px 'Barlow', sans-serif"; c.fillStyle = TXT;
        c.fillText(dois(it.d.getDate()), lx + fw / 2 + .3, my - 1.2);
        c.font = `700 3.3px ${F_COND}`; c.letterSpacing = '.3px'; c.fillStyle = ISO.rgba(LATAO, .9);
        const dd = Math.round((new Date(it.d.getFullYear(), it.d.getMonth(), it.d.getDate()) - hoje) / 864e5);
        const sem = dd === 0 ? 'HOJE' : DIAS_CURTOS[it.d.getDay()];
        c.fillText(cabe(c, sem, fw - 1), lx + fw / 2 + .45, my + 3.1);
        c.letterSpacing = '0px';
      } else {
        c.font = "700 5.8px 'Barlow', sans-serif"; c.fillStyle = ISO.rgba(LATAO, .8);
        c.fillText('—', lx + fw / 2 + .3, my + .1);
      }
      // nome e detalhe: a letra encolhe um pouco antes de cortar
      const tx = lx + fw + 2.6, tw = lx + lw - tx;
      c.textAlign = 'left';
      let tam = 5.6;
      c.font = `600 ${tam}px ${F_COND}`;
      while (tam > 4.8 && c.measureText(it.nome).width > tw) { tam -= .2; c.font = `600 ${tam}px ${F_COND}`; }
      c.fillStyle = TXT;
      c.fillText(cabe(c, it.nome, tw), tx, my - 2);
      c.font = `500 4.3px ${F_COND}`; c.fillStyle = 'rgba(239,231,216,.55)';
      c.fillText(cabe(c, it.meta, tw), tx, my + 3);
    });
    // sobrou espaço: a regra da reunião, para a lista não acabar no meio
    if (R.dias.length && itens.length && itens.length < VAGAS) {
      const y = ly0 + itens.length * ih, my = y + (VAGAS - itens.length) * ih / 2;
      c.fillStyle = 'rgba(239,231,216,.07)'; c.fillRect(lx, y, lw, .4);
      const nomes = R.dias.slice().sort().map(d => DIAS_CURTOS[d].toLowerCase());
      const quando = nomes.length === 7 ? 'todo dia' : nomes.length > 1
        ? 'toda ' + nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1] : 'toda ' + nomes[0];
      c.textAlign = 'left';
      c.font = `700 3.8px ${F_COND}`; c.letterSpacing = '.7px'; c.fillStyle = ISO.rgba(LATAO, .8);
      c.fillText('REUNIÃO DOS AGENTES', lx + 1, my - 2.6);
      c.letterSpacing = '0px';
      c.font = `500 4.8px ${F_COND}`; c.fillStyle = 'rgba(239,231,216,.62)';
      c.fillText(cabe(c, quando + ' · ' + dois(R.hora) + ':' + dois(R.minuto), lw - 1), lx + 1, my + 2.8);
    }
    c.restore();
  }

  /* ---------------- quadro de ideias ---------------- */

  /* papel das notas: tons de bloco adesivo, um pouco apagados para não
     brigar com a madeira                                                */
  const NOTAS = ['#f1d987', '#f0b39b', '#a7d8c0', '#aac9ea', '#cdbbe9', '#efe3c8'];
  const GIRO = [-2.1, 1.5, -1, 2.3, -1.7, 1.1];
  /* sem nenhuma ideia anotada, o quadro mostra sugestões claramente de
     exemplo (tracejadas, translúcidas). Elas não são salvas.            */
  const EXEMPLOS = ['Agente de IA no WhatsApp', 'Novo site da Nassa', 'Painel de métricas para clientes'];

  function signQuadro(c, len) {
    const ideias = (typeof QUADRO !== 'undefined') ? QUADRO.ideias().slice(0, 6) : [];
    const W = len / K_PAREDE;
    c.save(); c.scale(K_PAREDE, 1);
    luzQuente(c, W);
    const r = molduraNogueira(c, 4, 9, W - 8, 86);
    feltro(c, r);
    sombraInterna(c, r);
    plaquinhaLatao(c, W / 2, r.y + 3.2, 'IDEIAS');

    const exemplo = !ideias.length;
    const lista = exemplo ? EXEMPLOS : ideias;
    const n = lista.length;
    const cols = n <= 3 ? n : n === 4 ? 2 : 3, lins = n <= 3 ? 1 : 2;
    const ax = r.x + 4, ay = r.y + 13, aw = r.w - 8, ah = r.y + r.h - 3.5 - ay;
    const cw = aw / cols, chh = ah / lins;
    const nw = Math.min(cw - 6, 74), nh = Math.min(chh - 4.5, exemplo ? 40 : 50);
    lista.forEach((txt, i) => {
      const col = i % cols, lin = Math.floor(i / cols);
      nota(c, txt, ax + (col + .5) * cw, ay + (lin + .5) * chh, nw, nh,
           NOTAS[i % NOTAS.length], exemplo ? 0 : GIRO[i % GIRO.length] * Math.PI / 180, exemplo);
    });
    c.restore();
  }

  /** feltro grafite do quadro, com a trama em pontinhos */
  function feltro(c, r) {
    const g = c.createLinearGradient(0, r.y, 0, r.y + r.h);
    g.addColorStop(0, '#36332f'); g.addColorStop(1, '#2a2825');
    c.fillStyle = g; c.fillRect(r.x, r.y, r.w, r.h);
    for (let i = 0; i < 480; i++) {
      const hx = hash(i, 7), hy = hash(7, i), hv = hash(i, i + 3);
      c.fillStyle = hv > .5 ? 'rgba(255,245,230,.05)' : 'rgba(0,0,0,.14)';
      c.fillRect(r.x + hx * r.w, r.y + hy * r.h, .5, .5);
    }
  }

  /** uma nota presa no quadro (ou o contorno tracejado de um exemplo) */
  function nota(c, txt, cx, cy, w, h, cor, giro, exemplo) {
    c.save();
    c.translate(cx, cy); c.rotate(giro);
    const x = -w / 2, y = -h / 2;
    if (exemplo) {
      c.fillStyle = ISO.rgba(cor, .1); c.fillRect(x, y, w, h);
      c.setLineDash([2.2, 1.5]); c.strokeStyle = ISO.rgba(cor, .55); c.lineWidth = .55;
      c.strokeRect(x + .3, y + .3, w - .6, h - .6); c.setLineDash([]);
      c.textAlign = 'left'; c.textBaseline = 'middle';
      c.font = `700 3.7px ${F_COND}`; c.letterSpacing = '.8px'; c.fillStyle = ISO.rgba(cor, .85);
      c.fillText('EXEMPLO', x + 3.2, y + 4.4);
      c.letterSpacing = '0px';
    } else {
      // sombra no feltro, em duas camadas (seis shadowBlur por repintura pesavam)
      c.fillStyle = 'rgba(0,0,0,.16)'; c.fillRect(x + .2, y + .9, w + 1.6, h + 1.4);
      c.fillStyle = 'rgba(0,0,0,.24)'; c.fillRect(x + .5, y + 1, w + .7, h + .6);
      c.fillStyle = cor; c.fillRect(x, y, w, h);
      // papel: faixa da cola um tom acima e a ponta de baixo levemente curva
      const gp = c.createLinearGradient(0, y, 0, y + h);
      gp.addColorStop(0, 'rgba(0,0,0,.06)'); gp.addColorStop(.16, 'rgba(255,255,255,.12)');
      gp.addColorStop(.6, 'rgba(255,255,255,0)'); gp.addColorStop(1, 'rgba(0,0,0,.09)');
      c.fillStyle = gp; c.fillRect(x, y, w, h);
      c.fillStyle = 'rgba(0,0,0,.08)';
      c.beginPath(); c.moveTo(x + w, y + h - 4); c.lineTo(x + w, y + h); c.lineTo(x + w - 4, y + h); c.closePath(); c.fill();
    }
    // o texto: a letra encolhe antes de cortar com reticências
    const pad = 3.2, topo = y + (exemplo ? 8.6 : 5.8), base = y + h - 2.4, tw = w - 2 * pad;
    let q = null, tam = 6.6, lh = 0;
    for (; tam >= 4.8; tam -= .3) {
      lh = tam * 1.18;
      c.font = `600 ${tam}px ${F_COND}`;
      q = quebra(c, txt, tw, Math.max(1, Math.floor((base - topo) / lh)));
      if (!q.cortou) break;
    }
    c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillStyle = exemplo ? 'rgba(241,232,214,.72)' : '#2a2117';
    q.linhas.forEach((l, i) => c.fillText(l, x + pad, topo + lh * (i + .5)));
    if (!exemplo) {
      // alfinete de latão
      c.fillStyle = 'rgba(0,0,0,.35)';
      c.beginPath(); c.ellipse(.7, y + 3.3, 1.7, 1.1, 0, 0, 7); c.fill();
      const ga = c.createRadialGradient(-.5, y + 1.9, .2, 0, y + 2.5, 1.9);
      ga.addColorStop(0, '#fff1c4'); ga.addColorStop(.45, '#d4b467'); ga.addColorStop(1, '#8a6d32');
      c.fillStyle = ga;
      c.beginPath(); c.arc(0, y + 2.5, 1.75, 0, 7); c.fill();
    }
    c.restore();
  }

  /* ---- o quadro da BMW, com luminária de quadro em cima ---- */
  /* tamanho do quadro da BMW na parede (px de parede): ~3/4 da parede, com
     respiro em volta, em vez de ocupar a altura toda. O clique (pontoNaPlaca)
     usa a mesma caixa. Formato ≈ o da foto recortada no carro (2,6 : 1).  */
  // mesma altura e mesmo topo do quadro da camisa do Palmeiras (fy 8, fh 72),
  // para os dois ficarem alinhados na parede
  const QUADRO_BMW = { w: 190, h: 72, y: 8 };
  function signBmw(c, len, rgbOn) {
    const { w, h } = QUADRO_BMW, x0 = (len - w) / 2, y0 = QUADRO_BMW.y;
    // luminária de galeria (latão) e a luz lavando o quadro
    const gl = c.createRadialGradient(len / 2, y0 - 4, 4, len / 2, y0 + 30, w * .6);
    gl.addColorStop(0, 'rgba(255,226,170,.28)'); gl.addColorStop(1, 'rgba(255,226,170,0)');
    c.fillStyle = gl; c.fillRect(0, 0, len, WALL_H);
    BMW.quadro(c, x0, y0, w, h);
    c.fillStyle = '#b39a5c';
    ISO.rrect(c, len / 2 - 40, y0 - 6, 80, 4, 2); c.fill();
    c.fillStyle = '#6e5d33';
    c.fillRect(len / 2 - 2, 0, 4, y0 - 5);
    void rgbOn;
  }

  /* ---- logo da Nassa Tech adesivado no vidro (jateado) ---- */
  function signLogo(c, len, rgbOn) {
    const img = NASSA.logo;
    // faixa jateada
    c.fillStyle = 'rgba(230,240,255,.10)';
    c.fillRect(6, 20, len - 12, 62);
    c.fillStyle = 'rgba(255,255,255,.18)';
    c.fillRect(6, 20, len - 12, 1.2); c.fillRect(6, 80.8, len - 12, 1.2);
    if (NASSA.pronto(img)) {
      const maxW = len - 60, maxH = 48;
      const k = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
      const w = img.naturalWidth * k, h = img.naturalHeight * k;
      if (rgbOn) { c.shadowColor = 'rgba(0,179,255,.55)'; c.shadowBlur = 14 * kSombra; }
      c.drawImage(img, (len - w) / 2, 51 - h / 2, w, h);
      c.shadowBlur = 0;
    } else {
      signNome(c, len, 20, 62, rgbOn);
    }
  }

  /* ---- CI/CD da branch main: build, testes, deploy ---- */
  const COMMITS = [
    ['feat', 'agente de atendimento no WhatsApp'],
    ['fix',  'timeout no deploy da API'],
    ['perf', 'cache nas consultas do painel'],
    ['feat', 'novo site institucional'],
    ['test', 'cobertura do checkout 92%'],
    ['chore','atualiza dependências']
  ];
  function signPipeline(c, len, t, rgbOn) {
    const x0 = 8, y0 = 12, w = len - 16;
    // a mesma TV pendurada da equipe (moldura em cache); o conteúdo segue
    // no espaço da parede
    fundoTV(c, len);
    c.textBaseline = 'middle'; c.textAlign = 'left';
    c.font = "700 10px 'Barlow Semi Condensed', sans-serif";
    c.fillStyle = '#00b3ff'; c.letterSpacing = '2px';
    c.fillText('CI/CD · main', x0 + 10, y0 + 11);
    c.letterSpacing = '0px';
    // estágios: o deploy roda em ciclo
    const fase = (Math.max(0, t) / 3) % 4;
    const etapas = ['build', 'test', 'deploy'];
    const cw = (w - 20) / 3;
    etapas.forEach((nome, i) => {
      const cx = x0 + 10 + i * cw;
      const ok = fase > i + 1 || fase >= 3.5, rodando = !ok && fase > i && fase <= i + 1;
      const cor = ok ? '#23e08a' : rodando ? '#ffb020' : '#3a4256';
      c.fillStyle = ISO.rgba(cor, .18);
      ISO.rrect(c, cx, y0 + 21, cw - 6, 15, 4); c.fill();
      c.fillStyle = cor;
      c.beginPath(); c.arc(cx + 8, y0 + 28.5, 3 + (rodando ? Math.sin(t * 8) * .8 : 0), 0, 7); c.fill();
      c.font = "600 9px 'Barlow Semi Condensed', sans-serif";
      c.fillStyle = '#dfe6f5';
      c.fillText(nome + (ok ? ' ✓' : ''), cx + 15, y0 + 29);
    });
    // últimos commits
    // o primeiro quadro pode chegar com t levemente negativo
    const base = Math.floor(Math.max(0, t) / 9);
    for (let i = 0; i < 3; i++) {
      const [tipo, msg] = COMMITS[(base + i) % COMMITS.length];
      const ry = y0 + 47 + i * 12;
      c.font = "700 8.5px 'JetBrains Mono', 'Consolas', monospace";
      c.fillStyle = tipo === 'fix' ? '#ff7a7a' : tipo === 'feat' ? '#00b3ff' : '#c4b8ff';
      c.fillText(tipo, x0 + 10, ry);
      c.font = "600 8.5px 'Barlow Semi Condensed', sans-serif";
      c.fillStyle = 'rgba(220,228,245,.85)';
      c.fillText(msg.length > 30 ? msg.slice(0, 29) + '…' : msg, x0 + 38, ry);
    }
    void rgbOn;
  }

  /* ---- camisa do Palmeiras da era Parmalat (1993), em quadro de memorabilia ----
     Caixa funda de moldura preta com filete dourado, fundo de suede, a
     camisa aberta com gola em V branca, o "Parmalat" azul no oval branco,
     o escudo e a plaqueta de latão. Na tela o eixo u da parede encolhe
     para ~0,56 (o plano está de lado): tudo é desenhado num espaço
     esticado em u por K, senão a camisa sairia magra e as letras finas. */
  function signPalmeiras(c, len) {
    const K = 1.78, cx = len / 2 - 4;
    const fx = -44, fy = 8, fw = 88, fh = 72;             // caixa externa
    const ix = fx + 4.5, iy = fy + 4.5, iw = fw - 9, ih = fh - 9;
    c.save();
    c.translate(cx, 0); c.scale(K, 1);

    // luz de galeria lavando a parede e o quadro (igual à da BMW)
    const gl = c.createRadialGradient(0, fy - 4, 3, 0, fy + 28, 64);
    gl.addColorStop(0, 'rgba(255,226,170,.30)'); gl.addColorStop(1, 'rgba(255,226,170,0)');
    c.fillStyle = gl; c.fillRect(-cx / K, 0, len / K, WALL_H);

    // moldura: caixa preta funda, com sombra na parede
    c.save();
    c.shadowColor = 'rgba(0,0,0,.55)'; c.shadowBlur = 8 * kSombra; c.shadowOffsetX = 4 * kSombra; c.shadowOffsetY = 5 * kSombra;
    c.fillStyle = '#121316'; ISO.rrect(c, fx, fy, fw, fh, 1.6); c.fill();
    c.restore();
    const gm = c.createLinearGradient(0, fy, 0, fy + fh);
    gm.addColorStop(0, '#34363b'); gm.addColorStop(1, '#0c0d0f');
    c.strokeStyle = gm; c.lineWidth = 1.1;
    ISO.rrect(c, fx + .6, fy + .6, fw - 1.2, fh - 1.2, 1.2); c.stroke();
    c.strokeStyle = '#b39a5c'; c.lineWidth = .7;
    c.strokeRect(ix - .9, iy - .9, iw + 1.8, ih + 1.8);

    // fundo de suede claro; a borda de cima da caixa faz sombra nele
    c.fillStyle = '#e2ded5'; c.fillRect(ix, iy, iw, ih);
    const gs = c.createLinearGradient(0, iy, 0, iy + 8);
    gs.addColorStop(0, 'rgba(40,30,20,.42)'); gs.addColorStop(1, 'rgba(40,30,20,0)');
    c.fillStyle = gs; c.fillRect(ix, iy, iw, 8);
    const gL = c.createLinearGradient(ix, 0, ix + 4, 0);
    gL.addColorStop(0, 'rgba(40,30,20,.22)'); gL.addColorStop(1, 'rgba(40,30,20,0)');
    c.fillStyle = gL; c.fillRect(ix, iy, 4, ih);
    // laterais internas da caixa que a câmera enxerga: a esquerda e o fundo
    c.fillStyle = '#26272b';
    c.beginPath(); c.moveTo(ix, iy); c.lineTo(ix + 2.2, iy + 2.2); c.lineTo(ix + 2.2, iy + ih - 2.2); c.lineTo(ix, iy + ih); c.closePath(); c.fill();
    c.fillStyle = '#3a3b40';
    c.beginPath(); c.moveTo(ix, iy + ih); c.lineTo(ix + 2.2, iy + ih - 2.2); c.lineTo(ix + iw - 2.2, iy + ih - 2.2); c.lineTo(ix + iw, iy + ih); c.closePath(); c.fill();

    /* ---- a camisa, aberta com as mangas para os lados ---- */
    c.save();
    c.translate(0, 39.4); c.scale(1.1, 1.1); c.translate(0, -38.4);
    const corpo = new Path2D();
    corpo.moveTo(-6.2, 18.8);
    corpo.lineTo(-14.5, 20.8); corpo.lineTo(-29.5, 27.8);           // ombro e manga
    corpo.lineTo(-25.6, 36.2); corpo.lineTo(-16.2, 32.6);           // punho e axila
    corpo.lineTo(-16.4, 58.2); corpo.quadraticCurveTo(0, 59.6, 16.4, 58.2);
    corpo.lineTo(16.2, 32.6); corpo.lineTo(25.6, 36.2);
    corpo.lineTo(29.5, 27.8); corpo.lineTo(14.5, 20.8);
    corpo.lineTo(6.2, 18.8); corpo.lineTo(0, 25.8);                 // decote em V
    corpo.closePath();

    const gv = c.createLinearGradient(-30, 0, 30, 0);
    gv.addColorStop(0, '#0a5b2d'); gv.addColorStop(.32, '#0f7a3c');
    gv.addColorStop(.55, '#138a47'); gv.addColorStop(1, '#09562a');
    c.save();
    c.shadowColor = 'rgba(30,20,10,.42)'; c.shadowBlur = 5 * kSombra; c.shadowOffsetY = 3 * kSombra;
    c.fillStyle = gv; c.fill(corpo);
    c.restore();
    c.save();
    c.clip(corpo);
    // luz de cima e barra um pouco mais escura
    const gt = c.createLinearGradient(0, 19, 0, 59);
    gt.addColorStop(0, 'rgba(255,255,255,.10)'); gt.addColorStop(.5, 'rgba(255,255,255,0)');
    gt.addColorStop(1, 'rgba(0,0,0,.16)');
    c.fillStyle = gt; c.fillRect(-30, 18, 60, 42);
    // dobras do tecido preso no fundo
    c.strokeStyle = 'rgba(0,45,18,.38)'; c.lineWidth = .55;
    c.beginPath();
    c.moveTo(-16, 33.5); c.quadraticCurveTo(-11, 37, -9.5, 45);
    c.moveTo(16, 33.5);  c.quadraticCurveTo(11, 37, 9.5, 45);
    c.moveTo(-7.5, 50);  c.lineTo(-8.6, 58.5);
    c.moveTo(6.5, 51);   c.lineTo(7.6, 58.5);
    c.stroke();
    // punhos brancos
    c.fillStyle = '#f3f2ec';
    c.beginPath(); c.moveTo(-29.5, 27.8); c.lineTo(-25.6, 36.2); c.lineTo(-23.5, 35.3); c.lineTo(-27.4, 26.9); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(29.5, 27.8);  c.lineTo(25.6, 36.2);  c.lineTo(23.5, 35.3);  c.lineTo(27.4, 26.9);  c.closePath(); c.fill();
    c.restore();

    // por dentro do V aparece o avesso das costas, e a gola branca atrás
    c.fillStyle = '#08451f';
    c.beginPath(); c.moveTo(-6.2, 18.8); c.lineTo(6.2, 18.8); c.lineTo(0, 25.8); c.closePath(); c.fill();
    c.strokeStyle = '#f3f2ec'; c.lineWidth = 1.3; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-6.2, 18.9); c.quadraticCurveTo(0, 17.2, 6.2, 18.9); c.stroke();
    c.lineWidth = 2; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(-6.6, 18.7); c.lineTo(0, 26.2); c.lineTo(6.6, 18.7); c.stroke();
    c.strokeStyle = 'rgba(0,60,25,.55)'; c.lineWidth = .4;
    c.beginPath(); c.moveTo(-5.2, 19.6); c.lineTo(0, 25.1); c.lineTo(5.2, 19.6); c.stroke();

    // escudo do Palmeiras no peito esquerdo de quem veste
    c.fillStyle = '#f3f2ec'; c.beginPath(); c.arc(8.6, 28.4, 3.2, 0, 7); c.fill();
    c.strokeStyle = '#0b6e36'; c.lineWidth = .9; c.beginPath(); c.arc(8.6, 28.4, 2.5, 0, 7); c.stroke();
    c.fillStyle = '#0b6e36'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = "800 3.4px 'Barlow', sans-serif"; c.fillText('P', 8.6, 28.6);
    // marca do fornecedor no outro lado
    c.fillStyle = 'rgba(243,242,236,.9)';
    c.beginPath(); c.moveTo(-10.4, 27.4); c.lineTo(-6.8, 27.4); c.lineTo(-7.6, 29.4); c.lineTo(-9.6, 29.4); c.closePath(); c.fill();

    // patrocínio: "Parmalat" azul no oval branco, grande no peito
    c.fillStyle = '#f7f6f0'; c.beginPath(); c.ellipse(0, 41.6, 12.9, 5.5, 0, 0, 7); c.fill();
    c.strokeStyle = '#1f4fa8'; c.lineWidth = .5; c.beginPath(); c.ellipse(0, 41.6, 11.9, 4.6, 0, 0, 7); c.stroke();
    c.fillStyle = '#1b3f98';
    let tam = 6.6;
    c.font = `italic 800 ${tam}px 'Barlow', sans-serif`;
    while (tam > 4 && c.measureText('Parmalat').width > 20.5) { tam -= .2; c.font = `italic 800 ${tam}px 'Barlow', sans-serif`; }
    c.fillText('Parmalat', 0, 41.9);

    // alfinetes que prendem a camisa no fundo
    c.fillStyle = 'rgba(200,205,212,.85)';
    for (const [px, py] of [[-14, 21.6], [14, 21.6], [-15.4, 57.4], [15.4, 57.4]]) {
      c.beginPath(); c.arc(px, py, .55, 0, 7); c.fill();
    }
    c.restore();

    // plaqueta de latão
    const pw = 66, ph = 6.8, px0 = -pw / 2, py0 = 65;
    const gp = c.createLinearGradient(0, py0, 0, py0 + ph);
    gp.addColorStop(0, '#d2b46a'); gp.addColorStop(1, '#9a7b3f');
    c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(px0 + .4, py0 + .8, pw, ph);
    c.fillStyle = gp; c.fillRect(px0, py0, pw, ph);
    c.strokeStyle = 'rgba(70,52,20,.7)'; c.lineWidth = .4; c.strokeRect(px0 + .2, py0 + .2, pw - .4, ph - .4);
    c.fillStyle = '#2b2214'; c.textAlign = 'center'; c.textBaseline = 'middle';
    let tp = 4.6;
    c.font = `700 ${tp}px 'Barlow Semi Condensed', sans-serif`;
    c.letterSpacing = '.25px';
    while (tp > 3 && c.measureText('PALMEIRAS · ERA PARMALAT · 1993').width > pw - 5) {
      tp -= .1; c.font = `700 ${tp}px 'Barlow Semi Condensed', sans-serif`;
    }
    c.fillText('PALMEIRAS · ERA PARMALAT · 1993', 0, py0 + ph / 2 + .3);
    c.letterSpacing = '0px';

    // vidro: um reflexo diagonal leve
    c.save();
    c.beginPath(); c.rect(ix, iy, iw, ih); c.clip();
    c.fillStyle = 'rgba(255,255,255,.09)';
    c.beginPath(); c.moveTo(ix + iw * .60, iy); c.lineTo(ix + iw * .76, iy);
    c.lineTo(ix + iw * .50, iy + ih); c.lineTo(ix + iw * .34, iy + ih); c.closePath(); c.fill();
    c.restore();

    // luminária de quadro em latão
    c.fillStyle = '#6e5d33'; c.fillRect(-1.2, 5, 2.4, fy - 5);
    c.fillStyle = '#b39a5c'; ISO.rrect(c, -26, 1.6, 52, 4, 2); c.fill();
    c.fillStyle = 'rgba(255,240,200,.55)'; c.fillRect(-24.5, 2, 49, .8);
    c.restore();
  }
  /* placas fixas com texto (a plaqueta da camisa, a TV, a agenda, as
     ideias) se repintam quando a fonte chegar */
  let fontesOk = false;
  function fontesProntas() {
    return fontesOk || (fontesOk = !document.fonts ||
      (document.fonts.check("700 10px 'Barlow Semi Condensed'") && document.fonts.check("700 10px 'Barlow'")));
  }

  /* ---- logo em metal escovado no painel de feltro, com luz de parede quente ---- */
  function signLogoParede(c, len) {
    const gl = c.createRadialGradient(len / 2, 0, 4, len / 2, 30, len * .55);
    gl.addColorStop(0, 'rgba(255,226,170,.18)'); gl.addColorStop(1, 'rgba(255,226,170,0)');
    c.fillStyle = gl; c.fillRect(0, 0, len, WALL_H);
    const img = NASSA.logo;
    if (!NASSA.pronto(img)) return;
    const maxW = len - 80, maxH = 34;
    const k = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
    const w = img.naturalWidth * k, h = img.naturalHeight * k;
    c.save();
    c.globalAlpha = .9;
    c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 4 * kSombra; c.shadowOffsetY = 2 * kSombra;
    c.drawImage(img, (len - w) / 2, 46 - h / 2, w, h);
    c.restore();
  }

  /* ---- placa com o nome do escritório (data/config.json) ---- */
  function signNome(c, len, y0, h, rgbOn) {
    const E = window.ESCRITORIO || {};
    const nome = String(E.nome || 'Escritório de Agentes').toUpperCase();
    const cx = len / 2, cy = y0 + h / 2;
    c.save();
    c.textAlign = 'center'; c.textBaseline = 'middle';
    let tam = 26;
    c.font = `700 ${tam}px 'Barlow', sans-serif`;
    while (tam > 10 && c.measureText(nome).width > len - 36) { tam--; c.font = `700 ${tam}px 'Barlow', sans-serif`; }
    c.fillStyle = '#ffffff';
    if (rgbOn) { c.shadowColor = 'rgba(124,108,255,.8)'; c.shadowBlur = 14 * kSombra; }
    c.fillText(nome, cx, cy - 6);
    c.shadowBlur = 0;
    if (E.subtitulo) {
      c.font = `500 ${Math.min(10, len / 22)}px 'Barlow Semi Condensed', sans-serif`;
      c.fillStyle = 'rgba(200,210,235,.6)'; c.letterSpacing = '2px';
      c.fillText(String(E.subtitulo).toUpperCase().slice(0, 48), cx, cy + 16);
    }
    c.restore();
  }


  /* ---- luminárias e detalhes de teto no chão (decalques) ---- */
  function drawDecals(ctx, t) { /* piso liso: sem logo pintado */ }

  /** o ponto (coordenada de mundo, sem câmera) cai dentro da placa?
      Usado para clicar no quadro da BMW.                              */
  function pontoNaPlaca(kind, wx, wy) {
    const s = SIGNS.find(s => s.kind === kind);
    if (!s) return false;
    const len = s.len * ISO.TW;
    let u, z;
    if (s.o === 'n') {
      const Y = s.y + 1, x = wx / ISO.HW + Y;
      z = (x + Y) * ISO.HH - wy;
      u = (x - s.x) * ISO.TW;
    } else {
      const X = s.x + 1, y = X - wx / ISO.HW;
      z = (X + y) * ISO.HH - wy;
      u = (s.y + s.len - y) * ISO.TW;
    }
    const v = WALL_H - z;
    if (kind === 'bmw') {
      const q = QUADRO_BMW, x0 = (len - q.w) / 2;
      return u > x0 - 4 && u < x0 + q.w + 4 && v > q.y - 4 && v < q.y + q.h + 4;
    }
    return u > 32 && u < len - 32 && v > 2 && v < 106;
  }

  /* ---------- pontos de interesse ---------- */
  const SPAWN = { x: 45, y: 20 };          // elevador / recepção

  return {
    W, H, VOID, FLOOR, WALL, DOOR, C,
    ROOMS, DOORS, SPAWN, WALL_H, PARAPET,
    SIGNS, signDepth,
    kindAt, roomAt, isWall, walkable, setBlocked, wallOccludes,
    drawFloor, drawWallTile, drawDoorTile, drawSigns, drawDecals, drawRoomLabels,
    wallFace, material, pontoNaPlaca, LAJE, pisoBase, pisoCaixa, desenhaPisoCru
  };
})();
