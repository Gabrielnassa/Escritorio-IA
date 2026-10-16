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
    { o: 'n', x: 20, y: 0,  len: 9,  kind: 'equipe'   },  // devs: a equipe agora
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
     O piso é fixo: 1632 losangos por quadro era desperdício puro. Ele é
     pintado uma vez num canvas próprio e depois só copiado; só o brilho
     RGB refletido continua sendo calculado a cada quadro.                */
  let pisoCache = null;
  function montaPiso() {
    const x0 = ISO.toScreen(0, H - 1).x - ISO.TW;
    const x1 = ISO.toScreen(W - 1, 0).x + ISO.TW;
    const y0 = ISO.toScreen(0, 0).y - 4;
    const y1 = ISO.toScreen(W, H).y + LAJE + 8;
    const cv = document.createElement('canvas');
    cv.width  = Math.ceil(x1 - x0);
    cv.height = Math.ceil(y1 - y0);
    const c = cv.getContext('2d');
    c.translate(-x0, -y0);

    desenhaLaje(c);

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const k = kind[idx(x, y)];
        if (k !== FLOOR && k !== DOOR) continue;
        const r = ROOMS[roomOf[idx(x, y)]] || ROOMS.corredor;
        if (k === DOOR) { ISO.tile(c, x, y, '#3a3f49', 'rgba(255,255,255,.05)'); continue; }
        pisoTile(c, x, y, r);
      }
    }
    // faixa de piso com o azul da marca: guia do elevador até as salas
    c.save();
    for (let x = 2; x <= 45; x++) {
      if (walkable(x, 20) && roomAt(x, 20) === 'corredor')
        ISO.plane(c, x, 20.42, 1, .16, 0, ISO.rgba('#00b3ff', .22));
    }
    c.restore();
    pisoCache = { cv, x: x0, y: y0 };
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

  function drawFloor(ctx, t) {
    if (!pisoCache) montaPiso();
    ctx.drawImage(pisoCache.cv, pisoCache.x, pisoCache.y);

    // luz da cidade entrando pela fachada + LED da marca refletido no piso
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const luzDia = 1 - NASSA.noite();
    for (let x = ROOMS.servico.x1; x <= ROOMS.servico.x2; x += 7) {
      const p = ISO.toScreen(x, 1.5);
      ISO.glow(ctx, p.x, p.y, 120, NASSA.led(t, x), .06);
      if (luzDia > .05) ISO.glow(ctx, p.x, p.y + 30, 150, '#cfe3ff', .05 * luzDia);
    }
    for (let y = 2; y <= 8; y += 5) {
      const p = ISO.toScreen(1.5, y);
      if (luzDia > .05) ISO.glow(ctx, p.x, p.y, 130, '#ffe9c8', .06 * luzDia);
    }
    ctx.restore();
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

  /* ---- texturas das paredes externas (pintadas uma vez) ---- */
  const cacheTextura = new Map();
  function textura(tipo) {
    let cv = cacheTextura.get(tipo);
    if (cv) return cv;
    const T = ISO.TW, ESC = 2;
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
    cacheTextura.set(tipo, cv);
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
      c.fillStyle = '#1b1f27'; c.fillRect(0, WALL_H - 6, T, 6);
      c.fillStyle = '#d4dbe5'; c.fillRect(0, 0, T, 3);
    });
  }

  /* ---- uma parede ---- */
  function drawWallTile(ctx, x, y, t, rgbOn, zoom) {
    // afastado, o vidro fumê da divisória some em menos de um pixel
    const detalhe = (zoom === undefined || zoom > 0.7);
    const occ  = wallOccludes(x, y);
    const room = ROOMS[roomOf[idx(x, y)]] || ROOMS.corredor;
    const h    = occ ? PARAPET : WALL_H;
    const semLed = SEM_LED(room.id);
    const corLed = (k) => NASSA.led(t, k);

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
        const tx = textura(mat);
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

      // rodapé com fita de LED
      if (rgbOn && !semLed) {
        const neon = corLed(x + y);
        const strip = [
          f.pts[3], f.pts[2],
          { x: f.pts[2].x, y: f.pts[2].y - 5 },
          { x: f.pts[3].x, y: f.pts[3].y - 5 }
        ];
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ISO.quad(ctx, strip, ISO.rgba(neon, .55));
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
      ISO.plane(ctx, x, y, 1, 1, WALL_H, ISO.rgba(room.accent, rgbOn ? .16 : .08));
    }

    // trilho de LED no topo da parede (menos na sala de jogos)
    if (rgbOn && !semLed) {
      const neon = corLed(x + y);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // a fita já brilha sozinha; um glow radial por tile custava mais
      // área pintada que a tela inteira, várias vezes por quadro
      ISO.plane(ctx, x + .02, y + .02, .96, .96, WALL_H + 2, ISO.rgba(neon, externa ? .3 : .38));
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
      // é deste tile, direto do canvas em cache
      const T = ISO.TW;
      const off = s.o === 'n' ? (x - s.x) * T
                              : (s.y + s.len - 1 - y) * T;
      const cv = placaCanvas(s, t, rgbOn);
      wallFace(ctx, s.o, x, y, 1, WALL_H, (c) =>
        c.drawImage(cv, off * ESC_PLACA, 0, T * ESC_PLACA, WALL_H * ESC_PLACA, 0, 0, T, WALL_H));
    }
  }

  /* ---- porta ---- */
  function drawDoorTile(ctx, x, y, t) {
    const d = DOORS.find(d => d.x === x && d.y === y);
    if (!d) return;
    if (SEM_LED(roomAt(x, y + (d.o === 'h' ? 1 : 0)))) return;
    const neon = NASSA.led(t, x + y);
    const P = ISO.toScreen;
    const h = 96;

    // batentes laterais
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (d.o === 'h') {
      ISO.quad(ctx, [P(x, y+1, h), P(x+1, y+1, h), P(x+1, y+1, h-4), P(x, y+1, h-4)], ISO.rgba(neon, .65));
    } else {
      ISO.quad(ctx, [P(x+1, y, h), P(x+1, y+1, h), P(x+1, y+1, h-4), P(x+1, y, h-4)], ISO.rgba(neon, .65));
    }
    const c = ISO.toScreen(x + .5, y + .5, 30);
    ISO.glow(ctx, c.x, c.y, 62, neon, .18);
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
    else if (s.kind === 'equipe')   signEquipe(c, len, t, rgbOn);
    else if (s.kind === 'eventos')  signEventos(c, len, rgbOn);
    else if (s.kind === 'quadro')   signQuadro(c, len);
    else if (s.kind === 'bmw')      signBmw(c, len, rgbOn);
    else if (s.kind === 'logo')     signLogo(c, len, rgbOn);
    else if (s.kind === 'pipeline') signPipeline(c, len, t, rgbOn);
    else if (s.kind === 'palmeiras') signPalmeiras(c, len);
    else if (s.kind === 'logoParede') signLogoParede(c, len);
  }

  /* placas paradas só repintam quando algo nelas muda */
  const PLACA_FIXA = {
    bmw:  () => BMW.pronto ? 'ok' : 'carregando',
    palmeiras: () => fontePalmeiras() ? 'ok' : 'carregando',
    logo: () => NASSA.pronto(NASSA.logo) ? 'ok' : 'carregando',
    logoParede: () => NASSA.pronto(NASSA.logo) ? 'ok' : 'carregando'
  };
  const ESC_PLACA = 2;     // pintadas em 2x para continuarem nítidas no zoom

  /* Cada placa é pintada uma vez num canvas próprio e depois só é COPIADA
     para cada tile de parede. Antes ela era redesenhada inteira por tile —
     50 desenhos completos por quadro, vários com shadowBlur, e era daí que
     vinha quase toda a lentidão.                                          */
  const cachePlaca = new Map();
  function placaCanvas(s, t, rgbOn) {
    let c = cachePlaca.get(s);
    if (!c) {
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(s.len * ISO.TW * ESC_PLACA); cv.height = WALL_H * ESC_PLACA;
      c = { cv, ctx: cv.getContext('2d'), t: -1e9, rgb: null, ver: null };
      cachePlaca.set(s, c);
    }
    const fixa = PLACA_FIXA[s.kind];
    const ver = fixa ? fixa() : null;
    // repinta no máximo ~6x por segundo; o olho não vê diferença
    const vencida = fixa ? (c.ver !== ver) : (t - c.t > 0.16 || c.t > t);
    if (vencida || c.rgb !== rgbOn) {
      c.t = t; c.rgb = rgbOn; c.ver = ver;
      c.ctx.setTransform(1, 0, 0, 1, 0, 0);
      c.ctx.clearRect(0, 0, c.cv.width, c.cv.height);
      c.ctx.setTransform(ESC_PLACA, 0, 0, ESC_PLACA, 0, 0);
      pintaPlaca(c.ctx, s, s.len * ISO.TW, t, rgbOn);
    }
    return c.cv;
  }

  /* ---- logos e painéis nas paredes altas ---- */
  function drawSigns(ctx, t, rgbOn, lista) {
    for (const s of (lista || SIGNS)) {
      const cv = placaCanvas(s, t, rgbOn);
      wallFace(ctx, s.o, s.x, s.y, s.len, WALL_H, (c) => c.drawImage(cv, 0, 0, s.len * ISO.TW, WALL_H));
    }
  }

  /* ---- painel da equipe: quem está trabalhando agora ---- */
  function signEquipe(c, len, t, rgbOn) {
    const x0 = 8, y0 = 12, w = len - 16, h = 84;
    c.fillStyle = 'rgba(5,7,13,.88)';
    ISO.rrect(c, x0, y0, w, h, 8); c.fill();
    c.strokeStyle = 'rgba(56,189,248,.35)'; c.lineWidth = 1.4; c.stroke();

    c.textBaseline = 'middle'; c.textAlign = 'left';
    c.font = "700 11px 'Barlow Semi Condensed', sans-serif";
    c.fillStyle = '#38bdf8'; c.letterSpacing = '2px';
    c.fillText('EQUIPE AGORA', x0 + 12, y0 + 12);
    c.letterSpacing = '0px';
    c.strokeStyle = 'rgba(255,255,255,.09)';
    c.beginPath(); c.moveTo(x0 + 10, y0 + 22); c.lineTo(x0 + w - 10, y0 + 22); c.stroke();

    const RO = (typeof ROSTER !== 'undefined') ? ROSTER : null;
    const SI = (typeof SISTEMAS !== 'undefined') ? SISTEMAS : null;
    const n = st => RO ? RO.count(st) : 0;
    const noAr = SI ? SI.todos().filter(s => s.estado === 'no ar' || s.estado === 'web').length : 0;
    const cels = [
      { r: 'TRABALHANDO', v: String(n('trabalhando') + n('reuniao')), cor: '#23e08a' },
      { r: 'DESCANSO',    v: String(n('descanso')),                   cor: '#c4b8ff' },
      { r: 'OFFLINE',     v: String(n('offline')),                    cor: '#8b93ad' },
      { r: 'SISTEMAS',    v: String(noAr),                            cor: '#38bdf8' }
    ];
    const cw = (w - 20) / cels.length;
    cels.forEach((cel, i) => {
      const cx = x0 + 10 + i * cw;
      if (i) {
        c.strokeStyle = 'rgba(255,255,255,.07)';
        c.beginPath(); c.moveTo(cx - 2, y0 + 28); c.lineTo(cx - 2, y0 + h - 8); c.stroke();
      }
      c.textAlign = 'left';
      c.font = "600 8.5px 'Barlow Semi Condensed', sans-serif";
      c.fillStyle = 'rgba(180,190,215,.75)';
      c.fillText(cel.r, cx + 8, y0 + 36);
      c.font = "700 20px 'Barlow', sans-serif";
      c.fillStyle = cel.cor;
      if (rgbOn) { c.shadowColor = ISO.rgba(cel.cor, .8); c.shadowBlur = 12; }
      c.fillText(cel.v, cx + 8, y0 + 56);
      c.shadowBlur = 0;
      const amp = rgbOn ? (.45 + .55 * Math.abs(Math.sin(t * 1.1 + i))) : .7;
      c.fillStyle = ISO.rgba(cel.cor, .5);
      c.fillRect(cx + 8, y0 + 66, (cw - 24) * amp, 2.5);
    });
  }

  /* ---- agenda de eventos da diretoria ---- */
  function signEventos(c, len, rgbOn) {
    const evs = (typeof QUADRO !== 'undefined') ? QUADRO.eventos() : [];
    const x0 = 8, y0 = 12, w = len - 16, h = 84;

    c.fillStyle = 'rgba(5,7,13,.9)';
    ISO.rrect(c, x0, y0, w, h, 8); c.fill();
    c.strokeStyle = 'rgba(56,189,248,.32)'; c.lineWidth = 1.4; c.stroke();

    c.textBaseline = 'middle'; c.textAlign = 'left';
    c.font = "700 11px 'Barlow Semi Condensed', sans-serif";
    c.fillStyle = '#38bdf8'; c.letterSpacing = '2px';
    if (rgbOn) { c.shadowColor = 'rgba(56,189,248,.7)'; c.shadowBlur = 10; }
    c.fillText('PRÓXIMOS EVENTOS', x0 + 12, y0 + 13);
    c.shadowBlur = 0; c.letterSpacing = '0px';
    c.strokeStyle = 'rgba(255,255,255,.09)';
    c.beginPath(); c.moveTo(x0 + 10, y0 + 23); c.lineTo(x0 + w - 10, y0 + 23); c.stroke();

    if (!evs.length) {
      c.font = "600 10px 'Barlow Semi Condensed', sans-serif";
      c.fillStyle = 'rgba(150,160,190,.6)';
      c.fillText('nenhum evento marcado', x0 + 14, y0 + 42);
      return;
    }
    evs.slice(0, 4).forEach((e, i) => {
      const ry = y0 + 36 + i * 15;
      c.font = "700 10px 'Barlow', sans-serif";
      c.fillStyle = '#c4b8ff';
      c.fillText(e.data, x0 + 14, ry);
      c.font = "600 10px 'Barlow Semi Condensed', sans-serif";
      c.fillStyle = '#e4e9f6';
      c.fillText(e.nome, x0 + 58, ry);
      c.textAlign = 'right';
      c.font = "600 8.5px 'Barlow Semi Condensed', sans-serif";
      c.fillStyle = 'rgba(56,189,248,.8)';
      c.fillText(e.tipo, x0 + w - 14, ry);
      c.textAlign = 'left';
    });
  }

  /* ---- quadro branco de ideias ---- */
  function signQuadro(c, len) {
    const ideias = (typeof QUADRO !== 'undefined') ? QUADRO.ideias() : [];
    const x0 = 10, y0 = 10, w = len - 20, h = 88;

    // moldura de alumínio
    c.fillStyle = '#5b6377';
    ISO.rrect(c, x0 - 3, y0 - 3, w + 6, h + 6, 5); c.fill();
    // superfície branca
    const g = c.createLinearGradient(0, y0, 0, y0 + h);
    g.addColorStop(0, '#f6f8fb'); g.addColorStop(1, '#dde3ec');
    c.fillStyle = g;
    ISO.rrect(c, x0, y0, w, h, 3); c.fill();
    // reflexo
    c.fillStyle = 'rgba(255,255,255,.55)';
    c.beginPath();
    c.moveTo(x0 + w * .55, y0); c.lineTo(x0 + w, y0);
    c.lineTo(x0 + w, y0 + h * .5); c.closePath(); c.fill();

    c.textBaseline = 'middle'; c.textAlign = 'left';
    c.font = "700 11px 'Barlow Semi Condensed', sans-serif";
    c.fillStyle = '#d8342a'; c.letterSpacing = '1.5px';
    c.fillText('IDEIAS', x0 + 12, y0 + 14);
    c.letterSpacing = '0px';
    c.font = "600 8px 'Barlow Semi Condensed', sans-serif";
    c.fillStyle = 'rgba(70,80,100,.7)';
    c.fillText('botão 📌 Quadro', x0 + 58, y0 + 14);
    c.strokeStyle = 'rgba(216,52,42,.5)'; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(x0 + 12, y0 + 22); c.lineTo(x0 + w - 14, y0 + 22); c.stroke();

    const cores = ['#1f5fd0', '#1f8a4c', '#d8342a', '#7b3fc4', '#0f7f92', '#b8620a'];
    ideias.slice(0, 5).forEach((txt, i) => {
      const ry = y0 + 36 + i * 12.5;
      c.fillStyle = cores[i % cores.length];
      c.beginPath(); c.arc(x0 + 17, ry - 1, 2, 0, 7); c.fill();
      c.font = "600 10.5px 'Barlow Semi Condensed', sans-serif";
      c.fillText(txt, x0 + 25, ry);
    });
    if (!ideias.length) {
      c.font = "italic 600 10px 'Barlow Semi Condensed', sans-serif";
      c.fillStyle = 'rgba(70,80,100,.55)';
      c.fillText('quadro vazio', x0 + 25, y0 + 38);
    }
    // canetinhas na bandeja
    ['#d8342a', '#1f5fd0', '#1f8a4c'].forEach((cor, i) => {
      c.fillStyle = cor;
      ISO.rrect(c, x0 + w - 60 + i * 15, y0 + h - 8, 12, 4, 2); c.fill();
    });
  }

  /* ---- o quadro da BMW, com luminária de quadro em cima ---- */
  function signBmw(c, len, rgbOn) {
    // formato do quadro ≈ o da foto recortada no carro (2,6 : 1)
    const h = 96, w = 250, x0 = (len - w) / 2, y0 = 8;
    // luminária de galeria (latão) e a luz lavando o quadro
    const gl = c.createRadialGradient(len / 2, y0 - 4, 4, len / 2, y0 + 30, w * .6);
    gl.addColorStop(0, 'rgba(255,226,170,.28)'); gl.addColorStop(1, 'rgba(255,226,170,0)');
    c.fillStyle = gl; c.fillRect(0, 0, len, WALL_H);
    BMW.quadro(c, x0, y0, w, h);
    c.fillStyle = '#b39a5c';
    ISO.rrect(c, len / 2 - 50, y0 - 9, 100, 5, 2.5); c.fill();
    c.fillStyle = '#6e5d33';
    c.fillRect(len / 2 - 2, y0 - 14, 4, 6);
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
      if (rgbOn) { c.shadowColor = 'rgba(0,179,255,.55)'; c.shadowBlur = 14; }
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
    const x0 = 8, y0 = 12, w = len - 16, h = 84;
    c.fillStyle = 'rgba(5,7,13,.9)';
    ISO.rrect(c, x0, y0, w, h, 8); c.fill();
    c.strokeStyle = 'rgba(0,179,255,.35)'; c.lineWidth = 1.4; c.stroke();
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
    c.shadowColor = 'rgba(0,0,0,.55)'; c.shadowBlur = 8; c.shadowOffsetX = 4; c.shadowOffsetY = 5;
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
    c.shadowColor = 'rgba(30,20,10,.42)'; c.shadowBlur = 5; c.shadowOffsetY = 3;
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
  /* a plaqueta tem texto: a placa (fixa) se repinta quando a fonte chegar */
  let fonteOkPalmeiras = false;
  function fontePalmeiras() {
    return fonteOkPalmeiras || (fonteOkPalmeiras = !document.fonts ||
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
    c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 4; c.shadowOffsetY = 2;
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
    if (rgbOn) { c.shadowColor = 'rgba(124,108,255,.8)'; c.shadowBlur = 14; }
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
    wallFace, material, pontoNaPlaca, LAJE
  };
})();
