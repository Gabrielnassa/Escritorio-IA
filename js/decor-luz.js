/* ===========================================================
   decor-luz.js — a luz do andar

   O andar era chapado: o piso tinha a mesma cor em todo canto, de dia
   e de noite. Aqui a luz vira um MAPA pintado uma vez, em coordenadas
   de mundo, e "assado" junto com o piso (tapetes e nomes das salas
   inclusos) num mosaico de pedaços em cache, cada um na resolução do
   zoom (ver PISO ILUMINADO): cada quadro só copia pedaços prontos, e a
   luz sai de graça. O mapa só é refeito quando muda a faixa da hora (o
   sol anda, a noite cai) — nunca por quadro.

   Como o mapa age, em duas camadas:
   · GANHO, aplicado com 'overlay': cinza 50% não muda nada; abaixo
     disso escurece (a noite fora das poças), acima clareia até 2x.
   · SOMA, aplicada com 'screen': a luz que o piso devolve. O carpete
     dos devs é quase preto, e só multiplicar não faria poça nenhuma.

   Fontes: painéis embutidos sobre as estações dos devs (luz fria),
   pendentes sobre a mesa de reunião e a sinuca, abajur e spots quentes
   na sala do chefe e no lounge, spots no corredor e na recepção, a
   claridade do céu pelas fachadas de vidro e o sol entrando pelo norte
   e pelo oeste.

   As luminárias pendentes e o brilho da cúpula do abajur são peças de
   verdade (FURN.registrar), desenhadas na ordem de profundidade.
   =========================================================== */
const LUZ = (() => {
  const P = ISO.toScreen;
  const ESC = 0.5;          // resolução do mapa: luz é macia, meia resolução sobra
  const PX_TILE = 28;       // px de altura que valem 1 tile de chão, para projetar o sol
  const PARAPEITO = 14;     // o vidro da fachada começa acima do peitoril…
  const VERGA = 104;        // …e termina no caixilho de cima (ver world.js, janela)

  /* ---------- temperatura de cor ---------- */
  const COR = {
    fria:   '#dfe8ff',   // painéis de LED da sala dos devs (4000 K)
    neutra: '#ffeedd',   // reunião e circulação (3500 K)
    quente: '#ffcf96',   // abajur, sala do chefe e lounge (2700 K)
    ceu:    '#d6e4ff',   // claridade do céu pela fachada
    sol:    '#fff1d6',
    poente: '#ffad6b',
    cidade: '#8ea6ff',   // a cidade acesa, à noite, pelo vidro
    tela:   '#9cc2ff'    // telão
  };
  const mix = (a, b, f) => NASSA.mix(a, b, Math.max(0, Math.min(1, f)));
  const lerp = (a, b, f) => a + (b - a) * f;

  /* luz geral de cada sala, sem contar as luminárias: ganho [dia, noite].
     De dia 1 = o piso como ele é; à noite o fundo apaga e as poças de luz
     sobram. Lounge e reunião só têm o vidro da frente: são mais fechados. */
  const AMBIENTE = {
    servico:   [1.06, .6], diretoria: [1.04, .56], lounge: [.94, .58],
    reuniao:   [.94, .6],  corredor:  [1.04, .58]
  };
  /* quanto de luz o piso devolve por cima do ganho: o carpete escuro precisa
     de mais para a poça aparecer; a madeira já clareia bem só com o ganho */
  const DEVOLVE = { carpete: .2, madeira: .085, porcelanato: .15 };

  const chao = (x, y) => { const k = WORLD.kindAt(x, y); return k === WORLD.FLOOR || k === WORLD.DOOR; };
  const salaDe = (x, y) => WORLD.roomAt(Math.floor(x), Math.floor(y));

  /* itens que fazem parte do chão (tapetes: profundidade negativa) são
     assados no piso iluminado; senão a poça de luz parava na borda deles.
     Por isso ficam parados: algo animado no chão não pode usar dk < 0 */
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

  /** vãos de vidro da fachada do fundo (norte e oeste) com piso atrás, e
      quanto de luz cada um deixa passar: o painel da equipe e o do CI/CD
      tapam o vidro; o logo adesivado deixa passar quase tudo */
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

  /** trechos contínuos de vidro por sala, para a claridade do céu */
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

  /** a fachada da frente (sul e leste) é parapeito com vidro por cima:
      não pega sol direto (o sol de São Paulo passa pelo norte), mas
      deixa entrar a claridade do céu */
  function vidrosDaFrente() {
    const L = [];
    const yS = WORLD.H - 1, xL = WORLD.W - 1;
    for (let x = 1; x < WORLD.W - 1; x++)
      if (WORLD.kindAt(x, yS) === WORLD.WALL && chao(x, yS - 1)) L.push({ o: 's', x, sala: WORLD.roomAt(x, yS - 1) });
    for (let y = 1; y < WORLD.H - 1; y++)
      if (WORLD.kindAt(xL, y) === WORLD.WALL && chao(xL - 1, y)) L.push({ o: 'l', y, sala: WORLD.roomAt(xL - 1, y) });
    const T = [];
    for (const j of L) {
      const u = T[T.length - 1], pos = j.o === 's' ? j.x : j.y;
      if (u && u.o === j.o && u.sala === j.sala && u.fim === pos - 1) u.fim = pos;
      else T.push({ o: j.o, sala: j.sala, ini: pos, fim: pos });
    }
    return T;
  }

  /* ===========================================================
     FONTES DE LUZ
     Lidas dos móveis na hora de pintar o mapa: se alguém mexer no
     layout (ou outro decor-*.js trocar um móvel), a luz acompanha.
     =========================================================== */
  function fontes() {
    const F = [];
    /** forma 'red' ou 'ret', centro (x,y), meia largura rx × meia
        profundidade ry em tiles, cor e força [dia, noite] (ganho somado
        no centro da poça) */
    const luz = (forma, x, y, rx, ry, cor, dia, noite, sala) =>
      F.push({ forma, x, y, rx, ry, cor, dia, noite, sala: sala || salaDe(x, y) });
    const centro = o => ({ x: o.x + (o.w || 1) / 2, y: o.y + (o.d || 1) / 2 });

    // sala dos devs: um painel de LED embutido no forro sobre cada estação,
    // pegando mesa e cadeira
    for (const s of FURN.workSlots) {
      if (s.room !== 'servico' || !s.obj) continue;
      const m = centro(s.obj);
      const rx = Math.max(s.obj.w / 2, Math.abs(s.x - m.x)) + 1.0;
      const ry = Math.max(s.obj.d / 2, Math.abs(s.y - m.y)) + 1.1;
      luz('ret', (m.x + s.x) / 2, (m.y + s.y) / 2, rx, ry, COR.fria, .2, .95, 'servico');
    }
    // e uma luz geral mais fraca nos corredores entre as fileiras
    const R = WORLD.ROOMS.servico;
    for (let x = R.x1 + 3; x <= R.x2 - 2; x += 6) {
      luz('ret', x, R.y1 + 3.2, 2.7, 1.9, COR.fria, .06, .42);
      luz('ret', x, R.y2 - .9, 2.7, 1.4, COR.fria, .05, .34);
    }

    for (const o of FURN.items) {
      const c = centro(o);
      switch (o.t) {
        case 'abajur':      // abajur de piso: poça quente de verdade em volta
          luz('red', o.x + .5, o.y + .5, 2.6, 2.6, COR.quente, .25, 1.1); break;
        case 'deskBoss':    // spot dirigido sobre a mesa do chefe
          luz('ret', c.x, c.y - .3, o.w / 2 + 1.3, o.d / 2 + 1.5, mix(COR.neutra, COR.quente, .5), .15, .8); break;
        case 'mesaCentroChefe':   // spot sobre o estar do chefe
          luz('red', c.x, c.y - .3, 3.2, 2.6, COR.quente, .1, .6); break;
        case 'poolTable':   // o pendente da sinuca: a luz mais forte do lounge
          luz('ret', c.x, c.y, o.w / 2 + 1.25, o.d / 2 + 1.3, COR.quente, .4, 1.15); break;
        case 'foosball':
          luz('ret', c.x, c.y, o.w / 2 + .9, o.d / 2 + .9, COR.quente, .2, .6); break;
        case 'xadrez':
          luz('red', c.x, c.y, 2.1, 2.1, COR.quente, .2, .7); break;
        case 'bar':         // três spots no balcão do café, do lado de quem pede
          for (let i = 0; i < 3; i++)
            luz('red', o.x + o.w * (i + .5) / 3, o.y - .35, 1.5, 1.5, COR.quente, .25, .8);
          break;
        case 'meetTable':   // o pendente linear da reunião, pegando as cadeiras
          luz('ret', c.x, c.y, o.w / 2 + 1.7, o.d / 2 + 1.6, COR.neutra, .4, 1.05); break;
        case 'reception':   // spots sobre o balcão da recepção, do lado de quem chega
          luz('ret', c.x, o.y + o.d + .6, o.w / 2 + 1, 1.35, mix(COR.neutra, COR.quente, .4), .25, .95); break;
        case 'elevator':
          luz('red', o.x - .5, c.y, 1.6, 1.8, COR.neutra, .15, .7); break;
        case 'vending':
          luz('red', c.x, o.y + 1.6, 1.3, 1.1, '#cfe4ff', .05, .3); break;
        case 'tvWall':      // a tela acesa banha o chão da frente (uma vez por telão)
          if (!o.fatia || o.fatia[0] <= o.x + 1e-6)
            luz('ret', o.x + o.w / 2, o.y + 1.5, o.w / 2 + .6, 1.4, COR.tela, .04, o.meeting ? .22 : .32);
          break;
        case 'rug':         // tapete marca um canto de estar: luz baixa e quente
          if (salaDe(c.x, c.y) === 'lounge')
            luz('ret', c.x, c.y, o.w / 2 + .3, o.d / 2 + .3, COR.quente, .08, .4);
          break;
      }
    }

    // sala do chefe: luz baixa lavando as paredes de madeira (norte e oeste)
    const D = WORLD.ROOMS.diretoria;
    luz('ret', (D.x1 + D.x2 + 1) / 2, D.y1 + 1, (D.x2 - D.x1 + 1) / 2, 1.6, COR.quente, .06, .38, 'diretoria');
    luz('ret', D.x1 + 1, 13.5, 1.6, 4.4, COR.quente, .05, .32, 'diretoria');
    // lounge: o painel de feltro com o logo e spots gerais, baixos (é para relaxar)
    const Lg = WORLD.ROOMS.lounge;
    luz('ret', Lg.x1 + .4, (Lg.y1 + Lg.y2 + 1) / 2, 1.6, 3.8, COR.quente, .08, .4, 'lounge');
    [[6.5, 27.6], [16.6, 30.6], [25.6, 30.4], [16.4, 24.6], [25.8, 24.6]].forEach(([x, y]) =>
      luz('red', x, y, 2.4, 2.4, COR.quente, .1, .42));
    // reunião: os cantos não ficam no escuro
    [[34.6, 24.6], [45, 24.6], [34.6, 31.4], [45, 31.4]].forEach(([x, y]) =>
      luz('red', x, y, 1.9, 1.9, COR.neutra, .06, .34));

    // circulação: spots redondos no porcelanato, cadenciados
    for (let x = 4; x <= 40; x += 4) luz('red', x, 20.2, 1.6, 1.6, COR.neutra, .12, .8);
    for (let y = 3; y <= 16; y += 4) luz('red', 16.5, y, 1.5, 1.5, COR.neutra, .1, .75);
    for (let y = 24.5; y <= 31; y += 3.5) luz('red', 31, y, 1.3, 1.3, COR.neutra, .08, .65);
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
      alc: Math.min(2.8, 1 / Math.tan(el)) / PX_TILE,        // tiles de chão por px de altura
      forca,
      cor: mix(COR.sol, COR.poente, Math.max(baixo * 1.25 - .3, n * 1.5))
    };
  }

  /** mancha de sol de um vão de vidro: o paralelogramo que o vão projeta no chão */
  function manchaSol(c, j, s) {
    const MONT = .07;                                        // sombra do montante
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
  let ganho = null, soma = null;

  /** prepara um canvas do mapa com a transformação de tile: (x,y) do
      andar -> pixel do mapa, já na escala ESC. base = caixa do piso */
  function emTile(c, base) {
    c.setTransform(ESC * ISO.HW, ESC * ISO.HH, -ESC * ISO.HW, ESC * ISO.HH, -base.x * ESC, -base.y * ESC);
  }
  /** cinza do mapa de ganho: 0,5 = 1x. 'azul' puxa a noite para o frio */
  const cinza = (g, azul) => {
    const v = Math.max(0, Math.min(1, g / 2));
    const k = Math.round(v * 255);
    return `rgb(${Math.round(k * (2 - azul))},${k},${Math.min(255, Math.round(k * azul))})`;
  };

  function pintaMapa(base, d) {
    const n = NASSA.noite(d);
    const W = Math.ceil(base.w * ESC), H = Math.ceil(base.h * ESC);
    for (const cv of [ganho, soma]) { if (cv.width !== W) cv.width = W; if (cv.height !== H) cv.height = H; }
    const m = ganho.getContext('2d'), b = soma.getContext('2d');
    for (const c of [m, b]) {
      c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1; c.filter = 'none'; c.clearRect(0, 0, W, H);
    }

    if (!salas) montaSalas();
    const F = fontes();
    const J = janelas();
    const s = sol(d);
    const vidros = trechos(J, j => j.tr > .5 ? 1 : 0);
    const frente = vidrosDaFrente();

    /** uma poça nos dois mapas: ganho com força f, soma com f × devolve */
    const poca = (spr, x, y, w, h, f, dev) => {
      m.globalAlpha = Math.min(1, f / 2);
      m.drawImage(spr, x, y, w, h);
      if (dev > 0) { b.globalAlpha = Math.min(1, f * dev); b.drawImage(spr, x, y, w, h); }
    };

    for (const id of Object.keys(salas)) {
      const amb = AMBIENTE[id] || AMBIENTE.corredor;
      const dev = DEVOLVE[(WORLD.ROOMS[id] || {}).piso] || .12;
      for (const c of [m, b]) { emTile(c, base); c.save(); c.clip(salas[id]); }

      // fundo: a luz geral da sala (à noite, um pouco azulada)
      m.fillStyle = cinza(lerp(amb[0], amb[1], n), 1 + .12 * n);
      m.fillRect(0, 0, WORLD.W, WORLD.H);
      for (const c of [m, b]) c.globalCompositeOperation = 'lighter';

      // claridade do céu pela fachada: de dia, branca e funda; à noite, a
      // cidade acesa só tinge a beira do vidro
      for (const v of vidros) {
        if (v.sala !== id) continue;
        const meio = (v.ini + v.fim + 1) / 2, meia = (v.fim - v.ini + 1) / 2 + .8;
        const tr = v.tr < .5 ? .5 : 1;
        const desenha = (cor, f, fundo) => {
          if (f <= .01) return;
          const spr = sprite('ret', cor);
          if (v.o === 'n') poca(spr, meio - meia, 1 - fundo, meia * 2, fundo * 2, f * tr, dev * .5);
          else             poca(spr, 1 - fundo, meio - meia, fundo * 2, meia * 2, f * tr, dev * .5);
        };
        desenha(COR.ceu, .7 * (1 - n), 7);
        desenha(COR.cidade, .16 * n, 2.4);
      }
      for (const v of frente) {
        if (v.sala !== id) continue;
        const meio = (v.ini + v.fim + 1) / 2, meia = (v.fim - v.ini + 1) / 2 + .6;
        const f = .3 * (1 - n) + .06 * n, cor = mix(COR.ceu, COR.cidade, n), spr = sprite('ret', cor);
        if (f <= .01) continue;
        const borda = v.o === 's' ? WORLD.H - 1 : WORLD.W - 1, fundo = 4.2;
        if (v.o === 's') poca(spr, meio - meia, borda - fundo, meia * 2, fundo * 2, f, dev * .4);
        else             poca(spr, borda - fundo, meio - meia, fundo * 2, meia * 2, f, dev * .4);
      }

      // luminárias
      for (const f of F) {
        if (f.sala !== id) continue;
        const a = lerp(f.dia, f.noite, n);
        if (a <= .01) continue;
        poca(sprite(f.forma, f.cor), f.x - f.rx, f.y - f.ry, f.rx * 2, f.ry * 2, a, dev);
      }

      for (const c of [m, b]) { c.restore(); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
    }
    if (s) pintaSol(base, s, J, m, b);
  }

  /* sol: o paralelogramo de cada vão, recortado pela sala. As manchas são
     pintadas nítidas num mapa 2x menor e ampliadas com suavização: a borda
     fica macia de graça. Um filtro de blur por mancha custava meio segundo. */
  let solG = null, solS = null;
  const SOL_RED = 2;
  function pintaSol(base, s, J, m, b) {
    if (!solG) { solG = document.createElement('canvas'); solS = document.createElement('canvas'); }
    const W = Math.ceil(m.canvas.width / SOL_RED), H = Math.ceil(m.canvas.height / SOL_RED);
    const sg = solG.getContext('2d'), ss = solS.getContext('2d');
    for (const [cv, c] of [[solG, sg], [solS, ss]]) {
      if (cv.width !== W) cv.width = W;
      if (cv.height !== H) cv.height = H;
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H);
      const k = ESC / SOL_RED;
      c.setTransform(k * ISO.HW, k * ISO.HH, -k * ISO.HW, k * ISO.HH, -base.x * k, -base.y * k);
      c.fillStyle = s.cor;
      c.globalCompositeOperation = 'lighter';
    }
    for (const id of Object.keys(salas)) {
      const dev = Math.max(.12, DEVOLVE[(WORLD.ROOMS[id] || {}).piso] || .12);
      let aberto = false;
      for (const j of J) {
        if (j.sala !== id) continue;
        const e = entrada(j, s) * s.forca;
        if (e < .02) continue;
        if (!aberto) { for (const c of [sg, ss]) { c.save(); c.clip(salas[id]); } aberto = true; }
        sg.globalAlpha = e; manchaSol(sg, j, s);
        ss.globalAlpha = Math.min(1, e * dev * 3); manchaSol(ss, j, s);
      }
      if (aberto) for (const c of [sg, ss]) c.restore();
    }
    for (const [c, cv, a] of [[m, solG, .48], [b, solS, .25]]) {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.imageSmoothingEnabled = true;
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = a;
      c.drawImage(cv, 0, 0, W, H, 0, 0, W * SOL_RED, H * SOL_RED);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    }
  }

  /* ===========================================================
     PISO ILUMINADO (o que o app desenha por quadro)
     Era UM canvas do andar inteiro em 1x: na tela 3x do celular, e de perto
     em qualquer tela, ele aparecia ampliado e borrado. Agora é um mosaico
     de pedaços de TAM px, e cada nível de zoom (NIVEIS) tem os seus: piso
     cru, tapetes e nomes das salas saem vetoriais, nítidos na escala da
     tela, e a luz entra por cima (o mapa é macio: continua em meia
     resolução e só é ampliado).
     · Só os pedaços que aparecem são pintados, poucos por quadro (ORC_*):
       enquanto um falta, aparece o mesmo trecho de outro nível já pronto,
       ou do nível RESERVA, que cobre o andar todo e nunca sai da memória.
     · Com o zoom andando (pinça, animação), pintar um nível a cada degrau
       era o que pesava: o nível em uso segue, ampliado ou reduzido, e o
       certo entra quando a escala para por QUIETO ms. Se o nível em uso
       ficou longe demais (o zoom grande saindo da visão geral), o da vez é
       pintado, um pedaço por quadro.
     · Câmera parada = nada a pintar: o quadro só copia pedaços prontos.
     · Pedaço que fica VIDA ms sem aparecer é descartado, e há um teto de
       memória (sai o usado há mais tempo): no iPhone a memória de canvas
       é curta e, passando dela, o Safari recarrega a página.
     · Quando a hora troca o mapa de luz, os pedaços ficam velhos: seguem
       aparecendo até serem repintados, um por quadro.
     =========================================================== */
  const TAM = 512;                                // lado do pedaço, em px do nível
  const NIVEIS = [.5, 1, 1.5, 2, 3, 4, 5, 6, 8];   // px do pedaço por px de mundo
  const FOLGA = 1.1;      // ampliar até 10% não se vê, e evita subir de nível à toa
  const RESERVA = .5;     // cobre o andar todo e fica sempre pronto
  const VIDA = 5000;      // ms sem aparecer até o pedaço ser descartado
  // pedaços novos por quadro: tempo e quantidade (arrastando, só um: a borda
  // que entra na tela aparece um instante no nível de reserva)
  const ORC_MS = 5, ORC_N = 2;
  const QUIETO = 250;     // ms de escala parada até trocar de nível e pintar
  const MB = 1048576;

  let caixa = null;       // { x, y, w, h } do piso em px de mundo (WORLD.pisoCaixa)
  let noPiso = null;      // o que é chão (tapetes), com a caixa na tela
  let contorno = null;    // hexágono do andar + laje: fora dele não há piso
  let rascunho = null;    // canvas de trabalho: o piso cru antes da luz, e a máscara
  const pedacos = new Map();  // 'nível|i|j' -> { L, x, y, x1, y1, w, h, cv, ger, uso }
  const vazios = new Map();   // mesma chave -> o pedaço não encosta no andar
  const livres = [];          // canvases soltos, para reaproveitar
  let ger = 0;                // geração do mapa de luz: pedaço de outra está velho
  let bytes = 0, varridoEm = 0;
  let aceso = false, chaveAtual = '', checado = -1e9, sujo = false;
  let escalaAntes = 0, mexeuEm = -1e9, nivelVisto = 0, eAntes = 0, fAntes = 0;
  const NOITE_FAIXAS = 12;    // degraus do anoitecer; mesma conta do céu (nassa.js)
  // níveis de reserva para cada nível, do mais parecido ao menos (empate: o maior)
  const ORDEM = new Map(NIVEIS.map(L => [L, NIVEIS.filter(n => n !== L)
    .sort((a, b) => Math.abs(Math.log(a / L)) - Math.abs(Math.log(b / L)) || b - a)]));

  /** a faixa da hora: o degrau do anoitecer e, enquanto há sol, a meia hora
      (a mancha anda). De noite fechada o mapa não muda, nada a refazer */
  function chave(d) {
    const h = d.getHours() + d.getMinutes() / 60;
    return Math.round(NASSA.noite(d) * NOITE_FAIXAS) + '|' + (sol(d) ? Math.round(h * 2) : '-');
  }

  function nivel(s) {
    // abaixo de 1x não há folga: a reserva já é meia resolução, e ampliá-la
    // mesmo um pouco amolecia a visão geral no monitor comum
    for (const L of NIVEIS) if (L * (L < 1 ? 1 : FOLGA) >= s) return L;
    return NIVEIS[NIVEIS.length - 1];
  }
  const colunas = L => Math.ceil(Math.ceil(caixa.w * L) / TAM);
  const linhas = L => Math.ceil(Math.ceil(caixa.h * L) / TAM);
  const chaveDe = (L, i, j) => L + '|' + i + '|' + j;

  /** onde o pedaço (i, j) do nível L cai no mundo. As bordas saem da mesma
      conta dos vizinhos: na tela elas arredondam para o mesmo pixel */
  function geo(L, i, j) {
    const w = Math.min(TAM, Math.ceil(caixa.w * L) - i * TAM);
    const h = Math.min(TAM, Math.ceil(caixa.h * L) - j * TAM);
    return { w, h, x: caixa.x + i * TAM / L, y: caixa.y + j * TAM / L,
             x1: caixa.x + (i * TAM + w) / L, y1: caixa.y + (j * TAM + h) / L };
  }

  /* o andar com a laje é um hexágono convexo na tela: o pedaço que não
     encosta nele (os cantos do retângulo) nem chega a ser criado */
  function montaContorno() {
    const W = WORLD.W, H = WORLD.H, z = -16 - WORLD.LAJE;
    const pts = [P(0, 0), P(W, 0), P(W, 0, z), P(W, H, z), P(0, H, z), P(0, H)];
    const eixos = pts.map((a, k) => { const b = pts[(k + 1) % pts.length]; return [a.y - b.y, b.x - a.x]; });
    eixos.push([1, 0], [0, 1]);
    contorno = eixos.map(([ex, ey]) => {
      let lo = Infinity, hi = -Infinity;
      for (const p of pts) { const v = p.x * ex + p.y * ey; lo = Math.min(lo, v); hi = Math.max(hi, v); }
      return { ex, ey, lo, hi };
    });
  }
  function ehVazio(L, i, j) {
    const k = chaveDe(L, i, j);
    let v = vazios.get(k);
    if (v !== undefined) return v;
    const g = geo(L, i, j), F = 4;          // folga: traço e borda suavizada
    const x0 = g.x - F, x1 = g.x1 + F, y0 = g.y - F, y1 = g.y1 + F;
    v = false;
    for (const e of contorno) {             // eixo separador: projeções sem sobreposição
      const a = Math.min(x0 * e.ex, x1 * e.ex) + Math.min(y0 * e.ey, y1 * e.ey);
      const b = Math.max(x0 * e.ex, x1 * e.ex) + Math.max(y0 * e.ey, y1 * e.ey);
      if (b < e.lo || a > e.hi) { v = true; break; }
    }
    vazios.set(k, v);
    return v;
  }

  function canvasLivre(w, h) {
    const cv = livres.pop() || document.createElement('canvas');
    if (cv.width !== w) cv.width = w;
    if (cv.height !== h) cv.height = h;
    return cv;
  }
  function solta(k, p) {
    pedacos.delete(k);
    bytes -= p.w * p.h * 4;
    if (livres.length < 3) livres.push(p.cv);
    else p.cv.width = p.cv.height = 0;      // devolve a memória já: o Safari demora a recolher
  }

  /** o pedaço cai todo dentro do losango do andar? Lá o contrapiso deixa o
      piso cru opaco (ver WORLD.desenhaPisoCru) e a máscara é dispensável */
  function noMiolo(g) {
    const F = 2;
    for (const [x, y] of [[g.x - F, g.y - F], [g.x1 + F, g.y - F], [g.x - F, g.y1 + F], [g.x1 + F, g.y1 + F]]) {
      const t = ISO.toTile(x, y);
      if (t.x < .05 || t.y < .05 || t.x > WORLD.W - .05 || t.y > WORLD.H - .05) return false;
    }
    return true;
  }

  /** pinta (ou repinta) um pedaço: piso cru + tapetes + nomes, a luz por
      cima e, na borda do andar, a máscara do piso cru de novo (o miolo é
      opaco e pula o rascunho e a máscara: duas passadas a menos) */
  function pinta(L, i, j, k, p) {
    if (!p) {
      const g = geo(L, i, j);
      p = Object.assign(g, { L, cv: canvasLivre(g.w, g.h), ger: -1, uso: 0, miolo: noMiolo(g) });
      pedacos.set(k, p);
      bytes += p.w * p.h * 4;
    }
    const c = p.cv.getContext('2d');
    let r = c;
    if (!p.miolo) {
      if (!rascunho) { rascunho = document.createElement('canvas'); rascunho.width = rascunho.height = TAM; }
      r = rascunho.getContext('2d');
      r.setTransform(1, 0, 0, 1, 0, 0);
      r.clearRect(0, 0, p.w, p.h);
    }
    r.setTransform(L, 0, 0, L, -p.x * L, -p.y * L);
    const R = { x0: p.x, y0: p.y, x1: p.x1, y1: p.y1 };
    WORLD.desenhaPisoCru(r, R);
    for (const q of noPiso) if (q.x1 > R.x0 && q.x0 < R.x1 && q.y1 > R.y0 && q.y0 < R.y1) FURN.drawItem(r, q.o, 0);
    WORLD.drawRoomLabels(r);

    if (!p.miolo) {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = 'copy';
      c.drawImage(rascunho, 0, 0, p.w, p.h, 0, 0, p.w, p.h);
    }
    // o mapa inteiro, na transformação que o leva a este pedaço: a amostragem
    // não para na borda do pedaço, então não sobra degrau entre vizinhos
    const e = L / ESC;
    c.setTransform(e, 0, 0, e, (caixa.x - p.x) * L, (caixa.y - p.y) * L);
    c.imageSmoothingEnabled = true;
    c.globalCompositeOperation = 'overlay';
    c.drawImage(ganho, 0, 0);
    c.globalCompositeOperation = 'screen';
    c.drawImage(soma, 0, 0);
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (!p.miolo) {
      // o que vazou para fora do piso volta a ser transparente
      c.globalCompositeOperation = 'destination-in';
      c.drawImage(rascunho, 0, 0, p.w, p.h, 0, 0, p.w, p.h);
    }
    c.globalCompositeOperation = 'source-over';
    p.ger = ger;
    return p;
  }

  function assa(d, k) {
    const t0 = performance.now();
    if (!caixa) {
      caixa = WORLD.pisoCaixa();
      montaContorno();
      noPiso = FURN.items.filter(noChao).map(o => {
        const w = o.w || 1, dd = o.d || 1;
        return { o, x0: P(o.x, o.y + dd).x - 16, x1: P(o.x + w, o.y).x + 16,
                 y0: P(o.x, o.y).y - 16, y1: P(o.x + w, o.y + dd).y + 16 };
      });
    }
    if (!ganho) { ganho = document.createElement('canvas'); soma = document.createElement('canvas'); }
    pintaMapa(caixa, d);
    ger++;
    // a reserva sai inteira já: é ela que aparece enquanto falta pedaço
    for (let j = 0; j < linhas(RESERVA); j++)
      for (let i = 0; i < colunas(RESERVA); i++) {
        if (ehVazio(RESERVA, i, j)) continue;
        const kk = chaveDe(RESERVA, i, j);
        pinta(RESERVA, i, j, kk, pedacos.get(kk));
      }
    chaveAtual = k;
    aceso = true;
    estado.msAssar = performance.now() - t0;
  }

  /** copia o trecho [x0,x1] x [y0,y1] (px de mundo) do pedaço p para a tela,
      com as bordas no pixel inteiro: pedaços vizinhos encostam sem fresta */
  function copia(ctx, m, p, x0, y0, x1, y1) {
    const X0 = Math.round(m.a * x0 + m.e), X1 = Math.round(m.a * x1 + m.e);
    const Y0 = Math.round(m.d * y0 + m.f), Y1 = Math.round(m.d * y1 + m.f);
    if (X1 <= X0 || Y1 <= Y0) return;
    const L = p.L;
    // origem dentro do canvas: com sobra, o Safari antigo não desenhava nada
    const sx = Math.max(0, (x0 - p.x) * L), sy = Math.max(0, (y0 - p.y) * L);
    const sw = Math.min(p.w - sx, (x1 - x0) * L), sh = Math.min(p.h - sy, (y1 - y0) * L);
    if (sw <= 0 || sh <= 0) return;
    ctx.drawImage(p.cv, sx, sy, sw, sh, X0, Y0, X1 - X0, Y1 - Y0);
  }

  /** os pedaços prontos do nível L que cobrem o retângulo, ou null se falta algum */
  function cobertura(L, x0, y0, x1, y1) {
    const i0 = Math.max(0, Math.floor((x0 - caixa.x) * L / TAM));
    const i1 = Math.min(colunas(L) - 1, Math.floor(((x1 - caixa.x) * L - 1e-6) / TAM));
    const j0 = Math.max(0, Math.floor((y0 - caixa.y) * L / TAM));
    const j1 = Math.min(linhas(L) - 1, Math.floor(((y1 - caixa.y) * L - 1e-6) / TAM));
    const ps = [];
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        if (ehVazio(L, i, j)) continue;
        const p = pedacos.get(chaveDe(L, i, j));
        if (!p) return null;
        ps.push(p);
      }
    return ps;
  }

  /** no lugar de um pedaço que ainda falta: o mesmo trecho de outro nível */
  function quebraGalho(ctx, m, L, g, agora) {
    for (const Lr of ORDEM.get(L)) {
      const ps = cobertura(Lr, g.x, g.y, g.x1, g.y1);
      if (!ps) continue;
      for (const p of ps) {
        p.uso = agora;
        copia(ctx, m, p, Math.max(g.x, p.x), Math.max(g.y, p.y), Math.min(g.x1, p.x1), Math.min(g.y1, p.y1));
      }
      return;
    }
  }

  /** descarta o que não aparece há VIDA ms e, passando do teto, o usado há
      mais tempo — nunca a reserva nem o que apareceu neste quadro */
  function varre(agora, teto) {
    for (const [k, p] of pedacos) if (p.L !== RESERVA && agora - p.uso > VIDA) solta(k, p);
    if (bytes > teto) {
      const fila = [];
      for (const [k, p] of pedacos) if (p.L !== RESERVA && p.uso < agora) fila.push([k, p]);
      fila.sort((a, b) => a[1].uso - b[1].uso);
      for (const [k, p] of fila) { if (bytes <= teto) break; solta(k, p); }
    }
    estado.mosaico = { pedacos: pedacos.size, MB: +(bytes / MB).toFixed(1) };
  }

  function mosaico(ctx, agora) {
    const m = ctx.getTransform();
    if (m.b || m.c || m.a <= 0 || m.d <= 0) {
      // a câmera do app não gira; se um dia girar, vai a reserva sem encaixe
      for (const p of pedacos.values()) if (p.L === RESERVA) ctx.drawImage(p.cv, p.x, p.y, p.x1 - p.x, p.y1 - p.y);
      return;
    }
    const s = Math.max(m.a, m.d);
    if (Math.abs(s - escalaAntes) > s * .002) mexeuEm = agora;
    escalaAntes = s;
    // zoom andando: segura o nível em uso enquanto ele não ficar longe demais
    const andando = agora - mexeuEm < QUIETO;
    let L = nivel(s);
    const segura = andando && nivelVisto && s / nivelVisto < 1.7 && s / nivelVisto > .45;
    if (segura) L = nivelVisto;
    nivelVisto = estado.nivel = L;
    const arrastando = m.e !== eAntes || m.f !== fAntes;
    eAntes = m.e; fAntes = m.f;
    const cw = ctx.canvas.width, ch = ctx.canvas.height;
    // a tela em px de mundo
    const vx0 = -m.e / m.a, vx1 = (cw - m.e) / m.a, vy0 = -m.f / m.d, vy1 = (ch - m.f) / m.d;
    const i0 = Math.max(0, Math.floor((vx0 - caixa.x) * L / TAM)), i1 = Math.min(colunas(L) - 1, Math.floor((vx1 - caixa.x) * L / TAM));
    const j0 = Math.max(0, Math.floor((vy0 - caixa.y) * L / TAM)), j1 = Math.min(linhas(L) - 1, Math.floor((vy1 - caixa.y) * L / TAM));
    const mx = (vx0 + vx1) / 2, my = (vy0 + vy1) / 2;
    const vis = [], faltam = [];
    let velho = null, dVelho = Infinity;
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        if (ehVazio(L, i, j)) continue;
        const k = chaveDe(L, i, j), v = { i, j, k, p: pedacos.get(k) };
        vis.push(v);
        if (v.p && v.p.ger === ger) continue;
        const dx = caixa.x + (i + .5) * TAM / L - mx, dy = caixa.y + (j + .5) * TAM / L - my;
        const dist = dx * dx + dy * dy;
        if (!v.p) faltam.push([dist, v]);
        else if (dist < dVelho) { dVelho = dist; velho = v; }
      }
    // o que falta, do meio da tela para fora; sem falta, um velho por quadro
    if (segura) { /* no zoom não se pinta: aparece o que já existe */ }
    else if (faltam.length) {
      faltam.sort((a, b) => a[0] - b[0]);
      const t0 = performance.now();
      for (let n = 0; n < faltam.length && n < (arrastando || andando ? 1 : ORC_N); n++) {
        if (n && performance.now() - t0 > ORC_MS) break;
        const v = faltam[n][1];
        v.p = pinta(L, v.i, v.j, v.k, null);
      }
    } else if (velho) pinta(L, velho.i, velho.j, velho.k, velho.p);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true;
    for (const v of vis) {
      if (v.p) { v.p.uso = agora; copia(ctx, m, v.p, v.p.x, v.p.y, v.p.x1, v.p.y1); }
      else quebraGalho(ctx, m, L, geo(L, v.i, v.j), agora);
    }
    ctx.restore();

    // teto: umas 3,5 telas de pedaços, entre 24 e 64 MB
    const teto = Math.min(64 * MB, Math.max(24 * MB, cw * ch * 4 * 3.5));
    if (agora - varridoEm > 500 || bytes > teto) { varridoEm = agora; varre(agora, teto); }
  }

  /** desenha o piso já iluminado (no lugar do WORLD.drawFloor) */
  let tentaDeNovo = 0;
  function piso(ctx) {
    const agora = performance.now();
    if ((sujo || !aceso || agora - checado > 3000) && agora >= tentaDeNovo) {
      checado = agora;
      const d = new Date(), k = chave(d);
      estado.noite = NASSA.noite(d);
      if (sujo || !aceso || k !== chaveAtual) {
        sujo = false;
        try { assa(d, k); }
        catch (e) { console.warn('luz: piso sem iluminação', e); aceso = false; tentaDeNovo = agora + 6e4; }
      }
    }
    if (aceso) {
      try { mosaico(ctx, agora); return; }
      catch (e) { console.warn('luz: mosaico do piso falhou', e); aceso = false; tentaDeNovo = agora + 6e4; }
    }
    // sem o mapa, o piso cru: e os tapetes e nomes, que o app deixou para cá
    WORLD.drawFloor(ctx);
    for (const o of FURN.items) if (noChao(o)) FURN.drawItem(ctx, o, 0);
    WORLD.drawRoomLabels(ctx);
  }

  // os nomes das salas usam a Barlow: quando a fonte chega, repinta o piso
  if (document.fonts) {
    document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', () => { sujo = true; });
    document.fonts.ready && document.fonts.ready.then(() => { sujo = true; });
  }

  const estado = { noite: NASSA.noite(), msAssar: 0, mosaico: null, nivel: 0 };

  /* ===========================================================
     LUMINÁRIAS PENDENTES
     Desenhadas ao vivo: são poucas formas pequenas e o brilho delas
     acompanha a hora. Gradientes são criados uma vez e guardados no
     objeto (as coordenadas são fixas no mundo); brilhos são sprites.
     =========================================================== */
  /** cabo de aço que sobe acima do pé-direito e some no escuro do forro */
  function cabo(ctx, o, i, x, y, z0, z1) {
    const a = P(x, y, z0), b = P(x, y, z1);
    o.cabos = o.cabos || [];
    let g = o.cabos[i];
    if (!g) {
      g = ctx.createLinearGradient(0, a.y, 0, b.y);
      g.addColorStop(0, 'rgba(176,184,198,.8)');
      g.addColorStop(.5, 'rgba(160,168,182,.5)');
      g.addColorStop(1, 'rgba(160,168,182,0)');
      o.cabos[i] = g;
    }
    ctx.strokeStyle = g;
    ctx.lineWidth = .8;
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

  /** brilho macio (o "bloom" da lâmpada), achatado como luz no ar */
  function halo(ctx, x, y, z, r, cor, a) {
    const p = P(x, y, z);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a;
    ctx.drawImage(sprite('red', cor), p.x - r, p.y - r * .55, r * 2, r * 1.1);
    ctx.restore();
  }

  /** cúpula de pendente vista de cima: ombro arredondado, boca aberta
      embaixo com o friso de latão e a luz escapando pela borda */
  function cupula(ctx, o, i, cx, cy, z, h, rb, rt, acesa) {
    const b = P(cx, cy, z), t = P(cx, cy, z + h);
    const rxb = rb * ISO.HW, ryb = rb * ISO.HH, rxt = rt * ISO.HW, ryt = rt * ISO.HH;
    o.grads = o.grads || [];
    let g = o.grads[i];
    if (!g) {
      g = ctx.createLinearGradient(b.x - rxb, 0, b.x + rxb, 0);
      g.addColorStop(0, '#2b2e34'); g.addColorStop(.34, '#40444c'); g.addColorStop(1, '#121317');
      o.grads[i] = g;
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(b.x - rxb, b.y);
    ctx.bezierCurveTo(b.x - rxb, b.y - h * .55, t.x - rxt - rxb * .35, t.y + 1, t.x - rxt, t.y);
    ctx.ellipse(t.x, t.y, rxt, ryt, 0, Math.PI, 0, true);
    ctx.bezierCurveTo(t.x + rxt + rxb * .35, t.y + 1, b.x + rxb, b.y - h * .55, b.x + rxb, b.y);
    ctx.ellipse(b.x, b.y, rxb, ryb, 0, 0, Math.PI, false);
    ctx.closePath();
    ctx.fill();
    // tampinha de cima
    ctx.fillStyle = '#4b5059';
    ctx.beginPath(); ctx.ellipse(t.x, t.y, rxt, ryt, 0, 0, Math.PI * 2); ctx.fill();
    // friso de latão na boca e a luz que escapa por ele
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#b8995a';
    ctx.beginPath(); ctx.ellipse(b.x, b.y, rxb, ryb, 0, 0, Math.PI, false); ctx.stroke();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = ISO.rgba('#ffdcaa', acesa);
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(b.x, b.y + .9, rxb * .9, ryb * .8, 0, .15, Math.PI - .15, false); ctx.stroke();
    ctx.restore();
  }

  FURN.registrar({
    /* pendente linear de LED sobre a mesa de reunião: perfil preto fino,
       difusor embaixo, dois cabos de aço. o.mesa = o tampo */
    pendenteLinear(ctx, o) {
      const { x, y, w, d, z } = o;
      const n = estado.noite;
      const m = o.mesa;
      // a luz no tampo vem antes da peça: a barra fica por cima do brilho
      luzNoPlano(ctx, m.x + m.w / 2, m.y + m.d / 2, FURN.TOP + .4, w / 2 + .7, m.d / 2 - .2,
                 '#ffe9cc', lerp(.12, .24, n));
      o.cabosX.forEach((cx, i) => cabo(ctx, o, i, cx, y + d / 2, z + 5, z + 92));
      // perfil: corpo preto fosco, tampa grafite e ponteiras de alumínio
      ISO.box(ctx, x, y, w, d, 5, z, '#16181d', { top: '#2c2f36', left: '#1b1d22', right: '#101114' });
      ISO.box(ctx, x - .05, y - .01, .06, d + .02, 5, z, '#8d95a3', { top: '#b9c0cc' });
      ISO.box(ctx, x + w - .01, y - .01, .06, d + .02, 5, z, '#8d95a3', { top: '#b9c0cc' });
      // difusor aceso na aresta de baixo e o halo no ar logo abaixo dele
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ISO.quad(ctx, [P(x + .04, y + d, z + 1.3), P(x + w - .04, y + d, z + 1.3), P(x + w - .04, y + d, z), P(x + .04, y + d, z)],
               ISO.rgba('#fff3e0', lerp(.6, .95, n)));
      ctx.restore();
      for (let i = 0; i < 3; i++)
        halo(ctx, x + w * (i + .5) / 3, y + d / 2, z - 4, 36, '#ffe6c2', lerp(.06, .15, n));
    },

    /* luminária de sinuca: três cúpulas pretas com friso de latão numa
       barra fina, pendurada por dois cabos. o.mesa = a sinuca */
    pendenteSinuca(ctx, o) {
      const { x, y, w, d, z } = o;           // z = boca das cúpulas
      const n = estado.noite;
      const m = o.mesa;
      const cy = y + d / 2, H = 12, zBarra = z + H + 5;
      luzNoPlano(ctx, m.x + m.w / 2, m.y + m.d / 2, 38.6, w / 2 + .5, m.d / 2 - .4,
                 '#ffd9a0', lerp(.16, .3, n));
      o.cabosX.forEach((cx, i) => cabo(ctx, o, i, cx, cy, zBarra + 2.5, zBarra + 88));
      ISO.box(ctx, x, cy - .05, w, .1, 2.5, zBarra, '#17191d', { top: '#34373e' });
      const acesa = lerp(.45, .85, n);
      o.cupulas.forEach((cx, i) => {
        // haste curta da barra até a cúpula
        const a = P(cx, cy, z + H), b = P(cx, cy, zBarra);
        ctx.strokeStyle = '#2a2d33'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        cupula(ctx, o, i, cx, cy, z, H, .3, .07, acesa);
      });
      o.cupulas.forEach(cx => halo(ctx, cx, cy, z - 4, 24, '#ffd7a0', lerp(.07, .15, n)));
    },

    /* o brilho de uma lâmpada no ar (cúpula do abajur): quase nada de dia,
       aceso à noite. Entra logo depois da luminária na ordem de desenho */
    haloLuz(ctx, o) {
      const a = lerp(o.dia, o.noite, estado.noite);
      if (a > .01) halo(ctx, o.x, o.y, o.z, o.r, o.cor, a);
    }
  });

  // abajur de piso: a cúpula de tecido acende (a poça no chão vem do mapa)
  for (const o of FURN.items.filter(o => o.t === 'abajur'))
    FURN.add({ t: 'haloLuz', x: o.x + .5, y: o.y + .5, w: .01, d: .01, z: 88, r: 46,
               cor: '#ffd49a', dia: .03, noite: .2, dk: FURN.depth(o) + .01 });

  /* as pendentes vão no andar ao lado das mesas que elas iluminam, onde
     quer que essas mesas estejam. Ficam logo depois da mesa na ordem de
     desenho: por cima do tampo e de quem senta do lado de lá, e atrás de
     quem está do lado de cá. Ninguém pisa nelas: não bloqueiam o chão.
     Os cabos caem entre os rostos de quem senta do outro lado da mesa. */
  for (const m of FURN.items.filter(o => o.t === 'meetTable')) {
    const cx = m.x + m.w / 2, cy = m.y + m.d / 2;
    const w = Math.min(4, m.w - 2.4), d = .16;
    FURN.add({ t: 'pendenteLinear', x: cx - w / 2, y: cy - d / 2, w, d, z: 80, mesa: m,
               cabosX: [cx - 1, cx + 1], dk: FURN.depth(m) + .01 });
  }
  for (const m of FURN.items.filter(o => o.t === 'poolTable')) {
    const cx = m.x + m.w / 2, cy = m.y + m.d / 2;
    const w = Math.min(3, m.w - 1.4), d = .6, passo = Math.min(1.05, w / 2 - .4);
    FURN.add({ t: 'pendenteSinuca', x: cx - w / 2, y: cy - d / 2, w, d, z: 80, mesa: m,
               cupulas: [cx - passo, cx, cx + passo], cabosX: [cx - w / 2 + .22, cx + w / 2 - .22],
               dk: FURN.depth(m) + .01 });
  }

  return { piso, noChao, ROTULOS_NO_PISO: true, estado, recalcula: () => { sujo = true; } };
})();
