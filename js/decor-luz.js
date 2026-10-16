/* ===========================================================
   decor-luz.js — a luz do andar

   O andar era chapado: o piso tinha a mesma cor em todo canto, de dia
   e de noite. Aqui a luz vira um MAPA pintado uma vez, em coordenadas
   de mundo, e "assado" junto com o piso (tapetes e nomes das salas
   inclusos): cada quadro continua sendo uma cópia só do piso, como
   antes. O mapa só é refeito quando muda a faixa da hora (o sol anda,
   a noite cai) — nunca por quadro.

   Como o mapa age: ele é aplicado com 'overlay'. Cinza 50% não muda
   nada; abaixo disso escurece (a noite fora das poças de luz), acima
   clareia até 2x (as poças). Uma segunda camada em 'screen' só para o
   sol, que no carpete escuro precisa de mais que o dobro para parecer sol.

   Fontes: painéis embutidos sobre as estações dos devs (luz fria),
   pendentes sobre a mesa de reunião e a sinuca, abajures e arandelas
   quentes na sala do chefe e no lounge, spots no corredor e na
   recepção, e o sol entrando pelas fachadas de vidro (norte e oeste).

   As luminárias pendentes são peças de verdade (FURN.registrar).
   =========================================================== */
const LUZ = (() => {
  const P = ISO.toScreen;
  const ESC = 0.5;          // resolução do mapa: luz é macia, meia resolução sobra
  const PX_TILE = 28;       // px de altura que valem 1 tile de chão, para projetar o sol
  const PARAPEITO = 14;     // o vidro da fachada começa acima do peitoril…
  const VERGA = 104;        // …e termina no caixilho de cima (ver world.js, janela)

  /* ---------- temperatura de cor ---------- */
  const COR = {
    fria:   '#dde7ff',   // painéis de LED da sala dos devs (4000 K)
    neutra: '#ffeedb',   // reunião e circulação (3500 K)
    quente: '#ffcb8c',   // abajur, sala do chefe e lounge (2700 K)
    ceu:    '#d2e2ff',   // claridade do céu pela fachada
    sol:    '#fff0d2',
    poente: '#ffa864',
    cidade: '#7f9bff',   // a cidade acesa, à noite, pelo vidro
    tela:   '#9cc2ff'    // telão
  };
  const mix = (a, b, f) => NASSA.mix(a, b, Math.max(0, Math.min(1, f)));
  const lerp = (a, b, f) => a + (b - a) * f;

  /* luz geral de cada sala, sem contar as luminárias: [dia, noite].
     De dia 0,5 = o piso como ele é; à noite o fundo apaga e as poças
     de luz sobram. Lounge e reunião não têm janela: são mais fechados. */
  const AMBIENTE = {
    servico:   [.50, .30], diretoria: [.50, .27], lounge: [.47, .27],
    reuniao:   [.47, .29], corredor:  [.50, .26]
  };

  const chao = (x, y) => { const k = WORLD.kindAt(x, y); return k === WORLD.FLOOR || k === WORLD.DOOR; };
  const salaDe = (x, y) => WORLD.roomAt(Math.floor(x), Math.floor(y));

  /* itens que fazem parte do chão (tapetes: profundidade negativa) são
     assados no piso iluminado; senão a poça de luz parava na borda deles */
  const noChao = o => FURN.depth(o) < 0;

  /* ===========================================================
     SPRITES DE LUZ
     Poça redonda e poça retangular macia, em branco tingido. Desenhadas
     com a transformação isométrica, viram elipse e losango no piso.
     =========================================================== */
  const sprites = new Map();
  const queda = a => {                       // platô no meio, borda suave
    if (a <= .38) return 1;
    if (a >= 1) return 0;
    const t = (a - .38) / .62;
    return 1 - t * t * (3 - 2 * t);
  };
  function sprite(forma, cor) {
    const chave = forma + cor;
    let cv = sprites.get(chave);
    if (cv) return cv;
    const N = 128;
    cv = document.createElement('canvas');
    cv.width = cv.height = N;
    const c = cv.getContext('2d');
    const img = c.createImageData(N, N);
    const n = parseInt(cor.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const u = (i + .5) / N * 2 - 1, v = (j + .5) / N * 2 - 1;
        let f;
        if (forma === 'red') { const d2 = u * u + v * v; f = d2 >= 1 ? 0 : (1 - d2) * (1 - d2); }
        else f = queda(Math.abs(u)) * queda(Math.abs(v));
        const p = (j * N + i) * 4;
        img.data[p] = r; img.data[p + 1] = g; img.data[p + 2] = b;
        img.data[p + 3] = Math.round(f * 255);
      }
    }
    c.putImageData(img, 0, 0);
    sprites.set(chave, cv);
    return cv;
  }

  /* ===========================================================
     GEOMETRIA FIXA: recorte de cada sala e janelas da fachada
     =========================================================== */
  let salas = null;       // id -> Path2D em coordenadas de tile
  function montaSalas() {
    salas = {};
    for (let y = 0; y < WORLD.H; y++) {
      let x = 0;
      while (x < WORLD.W) {
        if (!chao(x, y)) { x++; continue; }
        const id = WORLD.roomAt(x, y);
        let x1 = x;
        while (x1 + 1 < WORLD.W && chao(x1 + 1, y) && WORLD.roomAt(x1 + 1, y) === id) x1++;
        (salas[id] = salas[id] || new Path2D()).rect(x, y, x1 - x + 1, 1);
        x = x1 + 1;
      }
    }
  }

  /** vãos de vidro da fachada com piso atrás, e quanto de luz cada um deixa
      passar: o painel da equipe e o do CI/CD tapam o vidro; o logo jateado
      deixa passar quase tudo */
  function janelas() {
    const tapa = {};
    for (const s of WORLD.SIGNS) {
      if (s.o !== 'n' || s.y !== 0) continue;
      const tr = s.kind === 'logo' ? .72 : (s.kind === 'equipe' || s.kind === 'pipeline') ? .1 : 1;
      for (let i = 0; i < s.len; i++) tapa[s.x + i] = tr;
    }
    const J = [];
    for (let x = 1; x < WORLD.W - 1; x++)
      if (WORLD.material(x, 0, 'n') === 'vidro' && chao(x, 1))
        J.push({ o: 'n', x, y: 0, sala: WORLD.roomAt(x, 1), tr: tapa[x] === undefined ? 1 : tapa[x] });
    for (let y = 1; y < WORLD.H - 1; y++)
      if (WORLD.material(0, y, 'w') === 'vidro' && chao(1, y))
        J.push({ o: 'w', x: 0, y, sala: WORLD.roomAt(1, y), tr: 1 });
    return J;
  }

  /** trechos contínuos de vidro (ou de painel ripado) por sala, para a
      claridade do céu e para as arandelas que lavam a madeira */
  function trechos(lista, chaveDe) {
    const T = [];
    for (const j of lista) {
      const u = T[T.length - 1];
      const pos = j.o === 'n' ? j.x : j.y;
      if (u && u.o === j.o && u.sala === j.sala && u.fim === pos - 1 && chaveDe(u) === chaveDe(j)) u.fim = pos;
      else T.push({ o: j.o, sala: j.sala, ini: pos, fim: pos, tr: j.tr });
    }
    return T;
  }
  function ripados() {
    const L = [];
    for (let x = 1; x < WORLD.W - 1; x++)
      if (WORLD.material(x, 0, 'n') === 'ripado' && chao(x, 1)) L.push({ o: 'n', x, sala: WORLD.roomAt(x, 1) });
    for (let y = 1; y < WORLD.H - 1; y++)
      if (WORLD.material(0, y, 'w') === 'ripado' && chao(1, y)) L.push({ o: 'w', y, sala: WORLD.roomAt(1, y) });
    return trechos(L, () => 0);
  }

  /* ===========================================================
     FONTES DE LUZ
     Lidas dos móveis na hora de pintar o mapa: se alguém mexer no
     layout (ou outro decor-*.js trocar um móvel), a luz acompanha.
     =========================================================== */
  function fontes() {
    const F = [];
    /** forma 'red' ou 'ret', centro (x,y), meia largura rx × meia
        profundidade ry em tiles, cor e força de dia / de noite */
    const luz = (forma, x, y, rx, ry, cor, dia, noite, sala) =>
      F.push({ forma, x, y, rx, ry, cor, dia, noite, sala: sala || salaDe(x, y) });
    const centro = o => ({ x: o.x + (o.w || 1) / 2, y: o.y + (o.d || 1) / 2 });

    // sala dos devs: um painel de LED embutido no forro sobre cada estação,
    // pegando mesa e cadeira
    for (const s of FURN.workSlots) {
      if (s.room !== 'servico' || !s.obj) continue;
      const m = centro(s.obj);
      const rx = Math.max(s.obj.w / 2, Math.abs(s.x - m.x)) + 1.0;
      const ry = Math.max(s.obj.d / 2, Math.abs(s.y - m.y)) + 1.05;
      luz('ret', (m.x + s.x) / 2, (m.y + s.y) / 2, rx, ry, COR.fria, .1, .34, 'servico');
    }
    // e uma luz geral mais fraca na frente (junto aos painéis) e no fundo
    const R = WORLD.ROOMS.servico;
    for (let x = R.x1 + 3; x <= R.x2 - 2; x += 6) {
      luz('ret', x, R.y1 + 3.4, 2.6, 1.8, COR.fria, .03, .15);
      luz('ret', x, R.y2 - .8, 2.6, 1.3, COR.fria, .02, .11);
    }

    for (const o of FURN.items) {
      const c = centro(o);
      switch (o.t) {
        case 'abajur':      // abajur de piso: poça quente de verdade em volta
          luz('red', o.x + .5, o.y + .5, 2.5, 2.5, COR.quente, .08, .4); break;
        case 'deskBoss':    // spot dirigido sobre a mesa do chefe
          luz('ret', c.x, c.y - .4, o.w / 2 + 1.3, o.d / 2 + 1.5, mix(COR.neutra, COR.quente, .5), .06, .27); break;
        case 'poolTable':   // o pendente da sinuca: a luz mais forte do lounge
          luz('ret', c.x, c.y, o.w / 2 + 1.2, o.d / 2 + 1.25, COR.quente, .16, .44); break;
        case 'foosball':
          luz('ret', c.x, c.y, o.w / 2 + .9, o.d / 2 + .9, COR.quente, .07, .22); break;
        case 'xadrez':
          luz('red', c.x, c.y, 2, 2, COR.quente, .07, .24); break;
        case 'bar':         // três spots no balcão do café, do lado de quem pede
          for (let i = 0; i < 3; i++)
            luz('red', o.x + o.w * (i + .5) / 3, o.y - .35, 1.45, 1.45, COR.quente, .09, .27);
          break;
        case 'meetTable':   // o pendente linear da reunião, pegando as cadeiras
          luz('ret', c.x, c.y, o.w / 2 + 1.7, o.d / 2 + 1.6, COR.neutra, .14, .36); break;
        case 'reception':   // spots sobre o balcão da recepção
          luz('ret', c.x, o.y + o.d + .5, o.w / 2 + .9, 1.25, mix(COR.neutra, COR.quente, .4), .1, .32); break;
        case 'elevator':
          luz('red', o.x - .4, c.y, 1.5, 1.6, COR.neutra, .06, .24); break;
        case 'vending':
          luz('red', c.x, o.y + 1.6, 1.3, 1.1, '#cfe4ff', .03, .12); break;
        case 'tvWall':      // a tela acesa banha o chão da frente (uma vez por telão)
          if (!o.fatia || o.fatia[0] <= o.x + 1e-6)
            luz('ret', o.x + o.w / 2, o.y + 1.5, o.w / 2 + .6, 1.4, COR.tela, .02, o.meeting ? .1 : .14);
          break;
        case 'rug':         // tapete marca um canto de estar: luz baixa e quente
          if (salaDe(c.x, c.y) === 'diretoria' || salaDe(c.x, c.y) === 'lounge')
            luz('ret', c.x, c.y, o.w / 2 + .3, o.d / 2 + .3, COR.quente, .03, .14);
          break;
      }
    }

    // arandelas lavando o painel ripado da sala do chefe
    for (const r of ripados()) {
      const meio = (r.ini + r.fim + 1) / 2, meia = (r.fim - r.ini + 1) / 2;
      if (r.o === 'n') luz('ret', meio, 1, meia + .4, 1.7, COR.quente, .05, .2, r.sala);
      else             luz('ret', 1, meio, 1.7, meia + .4, COR.quente, .05, .2, r.sala);
    }
    // painel de feltro do lounge com o logo: luz rasante de parede
    const Lg = WORLD.ROOMS.lounge;
    luz('ret', Lg.x1, (Lg.y1 + Lg.y2 + 1) / 2, 1.6, 3.6, COR.quente, .04, .15, 'lounge');
    // lounge: spots gerais, baixos (é para relaxar)
    [[6.5, 27.6], [16.6, 30.6], [25.6, 30.4], [16.4, 24.6]].forEach(([x, y]) =>
      luz('red', x, y, 2.3, 2.3, COR.quente, .05, .14));

    // circulação: spots redondos no porcelanato, cadenciados
    for (let x = 4; x <= 40; x += 4) luz('red', x, 20, 1.55, 1.55, COR.neutra, .06, .22);
    for (let y = 3; y <= 16; y += 4) luz('red', 16, y, 1.4, 1.4, COR.neutra, .05, .2);
    for (let y = 24.5; y <= 31; y += 4) luz('red', 30.9, y, 1.25, 1.25, COR.neutra, .04, .17);
    return F;
  }

  /* ===========================================================
     O SOL
     Um modelo simples, pensado para ficar bonito: nasce a leste-nordeste,
     passa alto pelo norte ao meio-dia e se põe a oeste-noroeste. Em São
     Paulo o sol do meio do dia vem do norte: a fachada norte pega sol
     quase o dia todo e a oeste, o da tarde.
     =========================================================== */
  function sol(d) {
    const h = d.getHours() + d.getMinutes() / 60;
    const u = (h - 6.5) / 11.5;
    if (u <= 0 || u >= 1) return null;
    const az = (75 - 150 * u) * Math.PI / 180;               // 0 = norte, + = leste
    const el = (8 + 54 * Math.sin(Math.PI * u)) * Math.PI / 180;
    const n = NASSA.noite(d);
    const forca = Math.pow(1 - n, .8) * Math.min(1, u / .06, (1 - u) / .06);
    if (forca < .02) return null;
    const baixo = 1 - Math.sin(Math.PI * u);                 // sol baixo = luz dourada
    return {
      ax: -Math.sin(az), ay: Math.cos(az),                   // para onde o raio anda no chão
      alc: Math.min(3.4, 1 / Math.tan(el)) / PX_TILE,        // tiles de chão por px de altura
      forca,
      cor: mix(COR.sol, COR.poente, Math.max(baixo * 1.25 - .3, n * 1.5))
    };
  }

  /** mancha de sol de um vão de vidro: o paralelogramo que o vão projeta no chão */
  function manchaSol(c, j, s) {
    const MONT = .06;                                        // sombra do montante
    const za = PARAPEITO * s.alc, zb = VERGA * s.alc;
    let pts;
    if (j.o === 'n') {
      const a = j.x + MONT, b = j.x + 1;
      pts = [[a + s.ax * za, 1 + s.ay * za], [b + s.ax * za, 1 + s.ay * za],
             [b + s.ax * zb, 1 + s.ay * zb], [a + s.ax * zb, 1 + s.ay * zb]];
    } else {
      const a = j.y, b = j.y + 1 - MONT;
      pts = [[1 + s.ax * za, a + s.ay * za], [1 + s.ax * za, b + s.ay * za],
             [1 + s.ax * zb, b + s.ay * zb], [1 + s.ax * zb, a + s.ay * zb]];
    }
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < 4; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.closePath();
    c.fill();
  }
  /** quanto do sol atravessa o vão: o raio rasante quase não entra */
  function entrada(j, s) {
    const cos = j.o === 'n' ? s.ay : s.ax;
    return j.tr * Math.max(0, Math.min(1, (cos - .06) / .4));
  }

  /* ===========================================================
     PINTURA DO MAPA
     =========================================================== */
  let mapa = null, brilho = null;

  /** prepara um canvas do mapa com a transformação de tile: (x,y) do
      andar -> pixel do mapa, já na escala ESC */
  function emTile(c, base) {
    c.setTransform(ESC * ISO.HW, ESC * ISO.HH, -ESC * ISO.HW, ESC * ISO.HH, -base.x * ESC, -base.y * ESC);
  }
  const cinza = (v, azul) => {
    const k = Math.round(Math.max(0, Math.min(1, v)) * 255);
    return `rgb(${k},${k},${Math.min(255, Math.round(k * azul))})`;
  };

  function pintaMapa(base, d) {
    const n = NASSA.noite(d);
    const W = Math.ceil(base.cv.width * ESC), H = Math.ceil(base.cv.height * ESC);
    for (const cv of [mapa, brilho]) { if (cv.width !== W) cv.width = W; if (cv.height !== H) cv.height = H; }
    const m = mapa.getContext('2d'), b = brilho.getContext('2d');
    for (const c of [m, b]) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.clearRect(0, 0, W, H); }

    if (!salas) montaSalas();
    const F = fontes();
    const J = janelas();
    const s = sol(d);
    const vidros = trechos(J, j => j.tr > .5 ? 1 : 0);
    // a sombra do sol tem borda macia; onde o filtro não existe, fica nítida
    const desfoque = 'blur(' + (1.6 * ESC * 2).toFixed(1) + 'px)';

    for (const id of Object.keys(salas)) {
      const amb = AMBIENTE[id] || AMBIENTE.corredor;
      for (const c of [m, b]) { emTile(c, base); c.save(); c.clip(salas[id]); }

      // fundo: a luz geral da sala (à noite, um pouco azulada)
      m.fillStyle = cinza(lerp(amb[0], amb[1], n), 1 + .1 * n);
      m.fillRect(0, 0, WORLD.W, WORLD.H);
      m.globalCompositeOperation = 'lighter';

      // claridade do céu pela fachada: de dia, branca e funda; à noite, a
      // cidade acesa só tinge a beira do vidro
      for (const v of vidros) {
        if (v.sala !== id) continue;
        const meio = (v.ini + v.fim + 1) / 2, meia = (v.fim - v.ini + 1) / 2 + .8;
        const tr = lerp(1, .55, v.tr < .5 ? 1 : 0);
        const desenha = (cor, a, fundo) => {
          if (a <= .004) return;
          m.globalAlpha = a * tr;
          if (v.o === 'n') m.drawImage(sprite('ret', cor), meio - meia, 1 - fundo, meia * 2, fundo * 2);
          else             m.drawImage(sprite('ret', cor), 1 - fundo, meio - meia, fundo * 2, meia * 2);
        };
        desenha(COR.ceu, .17 * (1 - n), 6.2);
        desenha(COR.cidade, .06 * n, 2.4);
      }

      // luminárias
      for (const f of F) {
        if (f.sala !== id) continue;
        const a = lerp(f.dia, f.noite, n);
        if (a <= .004) continue;
        m.globalAlpha = Math.min(1, a);
        m.drawImage(sprite(f.forma, f.cor), f.x - f.rx, f.y - f.ry, f.rx * 2, f.ry * 2);
      }

      // sol: entra no mapa (ganho) e na camada de brilho (o "a mais")
      if (s) {
        for (const c of [m, b]) { c.filter = desfoque; c.globalCompositeOperation = 'lighter'; }
        m.fillStyle = s.cor; b.fillStyle = s.cor;
        for (const j of J) {
          if (j.sala !== id) continue;
          const e = entrada(j, s) * s.forca;
          if (e < .02) continue;
          m.globalAlpha = .34 * e; manchaSol(m, j, s);
          b.globalAlpha = .2 * e;  manchaSol(b, j, s);
        }
        for (const c of [m, b]) c.filter = 'none';
      }
      for (const c of [m, b]) { c.restore(); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
    }
    return !!s;
  }

  /* ===========================================================
     PISO ILUMINADO (o que o app desenha por quadro)
     =========================================================== */
  let aceso = null;           // { cv, x, y, chave }
  let checado = -1e9, sujo = false;
  const NOITE_FAIXAS = 12;    // degraus do anoitecer; mesma conta do céu (nassa.js)

  function chave(d) {
    const h = d.getHours() + d.getMinutes() / 60;
    return Math.round(NASSA.noite(d) * NOITE_FAIXAS) + '|' + Math.round(h * 2);
  }

  function assa(d, k) {
    const base = WORLD.pisoBase();
    if (!mapa) { mapa = document.createElement('canvas'); brilho = document.createElement('canvas'); }
    if (!aceso) aceso = { cv: document.createElement('canvas'), x: base.x, y: base.y, chave: '' };
    const cv = aceso.cv;
    if (cv.width !== base.cv.width) cv.width = base.cv.width;
    if (cv.height !== base.cv.height) cv.height = base.cv.height;
    const c = cv.getContext('2d');

    // piso cru + o que é chão (tapetes) + os nomes das salas
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'copy';
    c.drawImage(base.cv, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.setTransform(1, 0, 0, 1, -base.x, -base.y);
    for (const o of FURN.items) if (noChao(o)) FURN.drawItem(c, o, 0);
    WORLD.drawRoomLabels(c);
    c.setTransform(1, 0, 0, 1, 0, 0);

    // luz por cima, e o que vazou para fora do piso volta a ser transparente
    const temSol = pintaMapa(base, d);
    c.imageSmoothingEnabled = true;
    c.globalCompositeOperation = 'overlay';
    c.drawImage(mapa, 0, 0, mapa.width, mapa.height, 0, 0, cv.width, cv.height);
    if (temSol) {
      c.globalCompositeOperation = 'screen';
      c.drawImage(brilho, 0, 0, brilho.width, brilho.height, 0, 0, cv.width, cv.height);
    }
    c.globalCompositeOperation = 'destination-in';
    c.drawImage(base.cv, 0, 0);
    c.globalCompositeOperation = 'source-over';
    aceso.chave = k;
  }

  /** desenha o piso já iluminado (no lugar do WORLD.drawFloor) */
  function piso(ctx) {
    const agora = performance.now();
    if (sujo || !aceso || agora - checado > 3000) {
      checado = agora;
      const d = new Date(), k = chave(d);
      estado.noite = NASSA.noite(d);
      if (sujo || !aceso || k !== aceso.chave) {
        sujo = false;
        try { assa(d, k); }
        catch (e) { console.warn('luz: piso sem iluminação', e); aceso = null; }
      }
    }
    if (aceso) ctx.drawImage(aceso.cv, aceso.x, aceso.y);
    else WORLD.drawFloor(ctx);
  }

  // os nomes das salas usam a Barlow: quando a fonte chega, repinta o piso
  if (document.fonts) {
    document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', () => { sujo = true; });
    document.fonts.ready && document.fonts.ready.then(() => { sujo = true; });
  }

  const estado = { noite: NASSA.noite() };

  /* ===========================================================
     LUMINÁRIAS PENDENTES
     Desenhadas ao vivo: são poucas formas pequenas, e um cache delas
     seria um retângulo quase todo transparente, mais caro de copiar.
     Gradientes e sprites são criados uma vez e guardados no objeto.
     =========================================================== */
  /** cabo de aço que sobe acima do pé-direito e some no escuro do forro */
  function cabo(ctx, o, i, x, y, z0, z1) {
    const a = P(x, y, z0), b = P(x, y, z1);
    o.cabos = o.cabos || [];
    let g = o.cabos[i];
    if (!g) {
      g = ctx.createLinearGradient(0, a.y, 0, b.y);
      g.addColorStop(0, 'rgba(170,178,192,.75)');
      g.addColorStop(.45, 'rgba(150,158,172,.45)');
      g.addColorStop(1, 'rgba(150,158,172,0)');
      o.cabos[i] = g;
    }
    ctx.strokeStyle = g;
    ctx.lineWidth = .9;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }

  /** luz batendo num plano horizontal (tampo, feltro): poça projetada */
  function luzNoPlano(ctx, cx, cy, z, rx, ry, cor, a) {
    const p = P(cx, cy, z);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a;
    ctx.transform(ISO.HW, ISO.HH, -ISO.HW, ISO.HH, p.x, p.y);
    ctx.drawImage(sprite('red', cor), -rx, -ry, rx * 2, ry * 2);
    ctx.restore();
  }

  /** friso de luz na aresta de baixo da face da frente (+y) */
  function friso(ctx, x0, x1, y, z, cor, a, alt = 1.4) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ISO.quad(ctx, [P(x0, y, z + alt), P(x1, y, z + alt), P(x1, y, z), P(x0, y, z)], ISO.rgba(cor, a));
    ctx.restore();
  }

  FURN.registrar({
    /* pendente linear de LED sobre a mesa de reunião: perfil preto fino,
       difusor quente embaixo, dois cabos de aço. o.mesa = o tampo */
    pendenteLinear(ctx, o) {
      const { x, y, w, d, z } = o;
      const n = estado.noite;
      const m = o.mesa;
      // a luz no tampo vem antes da peça: a barra fica por cima do brilho
      luzNoPlano(ctx, m.x + m.w / 2, m.y + m.d / 2, FURN.TOP + .4, w / 2 + .6, m.d / 2 - .15,
                 '#ffe6c4', lerp(.1, .2, n));
      o.cabosX.forEach((cx, i) => cabo(ctx, o, i, cx, y + d / 2, z + 4, z + 98));
      ISO.box(ctx, x, y, w, d, 4, z, '#16181d', { top: '#2b2e35', left: '#1d2026', right: '#121418' });
      friso(ctx, x + .05, x + w - .05, y + d, z, '#fff1dc', lerp(.55, .9, n));
      // ponteiras de alumínio
      ISO.box(ctx, x - .04, y - .01, .06, d + .02, 4, z, '#8b93a1');
      ISO.box(ctx, x + w - .02, y - .01, .06, d + .02, 4, z, '#8b93a1');
    },

    /* luminária de sinuca: cúpula retangular verde-garrafa com friso de
       latão, três lâmpadas quentes por baixo e duas correntes finas */
    pendenteSinuca(ctx, o) {
      const { x, y, w, d, z } = o;
      const n = estado.noite;
      const m = o.mesa;
      luzNoPlano(ctx, m.x + m.w / 2, m.y + m.d / 2, 38.6, w / 2 + .35, m.d / 2 - .45,
                 '#ffd9a0', lerp(.12, .26, n));
      o.cabosX.forEach((cx, i) => cabo(ctx, o, i, cx, y + d / 2, z + 11, z + 96));
      // cúpula: corpo e friso de latão em cima e embaixo
      ISO.box(ctx, x, y, w, d, 9, z + 1.5, '#1c4334', { top: '#245442', left: '#1f4a39', right: '#163629' });
      ISO.box(ctx, x - .03, y - .03, w + .06, d + .06, 1.6, z, '#b39a5c', { top: '#cdb276' });
      ISO.box(ctx, x - .02, y - .02, w + .04, d + .04, 1.4, z + 10.5, '#9c854c', { top: '#c2a86c' });
      // a luz escapando pela boca da cúpula
      friso(ctx, x + .1, x + w - .1, y + d + .03, z - .2, '#ffd9a0', lerp(.35, .7, n), 1.2);
      // canopla no meio da cúpula
      ISO.box(ctx, x + w / 2 - .09, y + d / 2 - .09, .18, .18, 3, z + 12, '#9c854c', { top: '#c2a86c' });
    }
  });

  /* as pendentes vão no andar ao lado das mesas que elas iluminam, onde
     quer que essas mesas estejam. Ficam logo depois da mesa na ordem de
     desenho: por cima do tampo e de quem senta do lado de lá, e atrás de
     quem está do lado de cá. Ninguém pisa nelas: não bloqueiam o chão. */
  for (const m of FURN.items.filter(o => o.t === 'meetTable')) {
    const cx = m.x + m.w / 2, cy = m.y + m.d / 2;
    const w = Math.min(3.8, m.w - 2.4), d = .2;
    // os cabos ficam entre as cadeiras do lado de lá, e não na frente do rosto de alguém
    FURN.add({ t: 'pendenteLinear', x: cx - w / 2, y: cy - d / 2, w, d, z: 66, mesa: m,
               cabosX: [cx - 1.2, cx + 1.2], dk: FURN.depth(m) + .01 });
  }
  for (const m of FURN.items.filter(o => o.t === 'poolTable')) {
    const cx = m.x + m.w / 2, cy = m.y + m.d / 2;
    const w = Math.min(2.9, m.w - 1.6), d = .5;
    FURN.add({ t: 'pendenteSinuca', x: cx - w / 2, y: cy - d / 2, w, d, z: 74, mesa: m,
               cabosX: [cx - w / 2 + .7, cx + w / 2 - .7], dk: FURN.depth(m) + .01 });
  }

  return { piso, noChao, ROTULOS_NO_PISO: true, estado, recalcula: () => { sujo = true; } };
})();
