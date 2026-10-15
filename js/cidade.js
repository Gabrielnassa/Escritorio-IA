/* ===========================================================
   cidade.js — a Faria Lima em volta da torre, na tela de entrada

   A foto da torre é vertical; numa tela larga sobrava um vão dos
   lados. Este módulo pinta o resto da cidade no mesmo pixel art da
   foto, numa tela pequena que o navegador amplia sem suavizar:
   céu com estrelas, a serra no horizonte, o mar de prédios com as
   janelas acesas, as torres residenciais, as árvores, a calçada com
   os postes e a avenida com os carros passando.

   As faixas (céu, calçada, avenida) ficam nas mesmas alturas da
   foto, para a cidade continuar dentro dela sem emenda.
   =========================================================== */
const CIDADE = (() => {

  /* alturas, em fração da altura da foto */
  const F = { horizonte: .058, longe: .24, meio0: .30, meio1: .60, calcada: .905, rua: .955 };

  const COR = {
    ceu0: [7, 26, 52], ceu1: [18, 32, 64],
    estrela: ['#8ea6d6', '#c9d6f2', '#5d77ad'],
    serra: '#0d1938', serra2: '#111e40',
    neblina: [17, 31, 63],
    copa: ['#0f2a1c', '#143322', '#1a3f29', '#21502f'],
    copaLuz: ['#2e6b3c', '#3f8545'],
    janela: ['#ffd57a', '#f4c15a', '#e9a640', '#ffe6a3'],
    janelaFria: ['#9fd3ff', '#cfe8ff'],
    calcada: '#4f463f', calcadaLuz: '#8a6b42', meioFio: '#8b8176',
    asfalto: '#34343c', faixa: '#d8d2c0'
  };

  const TIPOS = [
    // fachada, lateral, cobertura — residenciais bege e concreto, escritórios de vidro
    { f: '#5e4f43', l: '#41372f', t: '#76655a', varanda: '#4b3f36' },
    { f: '#6a5a4c', l: '#493e35', t: '#837161', varanda: '#54473c' },
    { f: '#4c4a4a', l: '#353434', t: '#625f5d', varanda: '#403e3e' },
    { f: '#2c3446', l: '#1f2533', t: '#3e475c', vidro: true },
    { f: '#252d3e', l: '#1a202c', t: '#374055', vidro: true }
  ];
  const BAIXO = [
    { f: '#3a3d46', l: '#2a2c33', t: '#2c4f2e' },     // teto verde, como o teatro da foto
    { f: '#45403b', l: '#312d29', t: '#5a544d' },
    { f: '#33384a', l: '#252a37', t: '#2f5531' }
  ];

  let cv = null, ctx = null, fundo = null, raf = 0, ultimo = 0, tAnim = 0;
  let W = 0, H = 0, P = 2, larguraUtil = 0;
  let carros = [], aviso = [], piscam = [];

  /* ---------------- utilidades ---------------- */
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, f) => hex(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * f));
  const pick = (R, arr) => arr[Math.floor(R() * arr.length)];

  function px(c, x, y, w, h, cor) {
    c.fillStyle = cor;
    c.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  }

  /** brilho redondo em pixel: anéis concêntricos com alfa caindo */
  function brilho(c, x, y, r, cor, a) {
    const [cr, cg, cb] = rgb(cor);
    for (let i = r; i >= 1; i--) {
      c.fillStyle = `rgba(${cr},${cg},${cb},${(a * (1 - i / (r + 1))).toFixed(3)})`;
      c.beginPath(); c.arc(Math.round(x), Math.round(y), i, 0, Math.PI * 2); c.fill();
    }
  }

  /* ---------------- céu e serra ---------------- */
  function ceu(c, R) {
    const hz = Math.round(H * F.horizonte);
    for (let y = 0; y <= hz + 4; y++) {
      const f = Math.min(1, y / hz);
      // degraus de 2px, como o degradê da foto
      px(c, 0, y, W, 1, hex(COR.ceu0.map((v, i) => v + (COR.ceu1[i] - v) * Math.floor(f * 8) / 8)));
    }
    const n = Math.round(W * hz / 70);
    for (let i = 0; i < n; i++) {
      const x = R() * W, y = R() * (hz - 3);
      px(c, x, y, 1, 1, pick(R, COR.estrela));
      if (R() < .12) piscam.push({ x: Math.round(x), y: Math.round(y), fase: R() * 9 });
    }
    // a serra da Cantareira lá no fundo
    const ph = [R() * 9, R() * 9, R() * 9];
    for (let x = 0; x < W; x++) {
      const h = 3 + Math.sin(x / 37 + ph[0]) * 2 + Math.sin(x / 13 + ph[1]) * 1.2 + Math.sin(x / 91 + ph[2]) * 2.5;
      px(c, x, hz - h, 1, h + 6, x % 2 ? COR.serra : COR.serra2);
    }
  }

  /* ---------------- copas de árvore ---------------- */
  function copa(c, x, y, r, R, nevoa, luz) {
    const base = mix(pick(R, COR.copa), hex(COR.neblina), nevoa);
    const esc = mix(base, '#050b08', .35);
    const cla = mix(luz ? pick(R, COR.copaLuz) : mix(base, '#3d7a4a', .35), hex(COR.neblina), nevoa * .8);
    c.fillStyle = esc;
    c.beginPath(); c.arc(Math.round(x), Math.round(y), r + .6, 0, Math.PI * 2); c.fill();
    c.fillStyle = base;
    c.beginPath(); c.arc(Math.round(x), Math.round(y), r, 0, Math.PI * 2); c.fill();
    if (r >= 2) {
      c.fillStyle = cla;
      c.beginPath(); c.arc(Math.round(x - r * .35), Math.round(y - r * .4), Math.max(1, r * .45), 0, Math.PI * 2); c.fill();
    }
  }

  /* ---------------- um prédio visto do alto, de quina ---------------- */
  function predio(c, R, x, base, w, h, nevoa, opts = {}) {
    const tipo = opts.tipo || pick(R, TIPOS);
    const d = Math.max(1, Math.round(w * (opts.lado || .32)));
    const sobe = Math.max(1, Math.round(d * .5));
    const topo = base - h;
    const nv = cor => mix(cor, hex(COR.neblina), nevoa);
    // lateral à direita (na sombra), fachada, cobertura
    c.fillStyle = nv(tipo.l);
    c.beginPath();
    c.moveTo(x + w, topo); c.lineTo(x + w + d, topo - sobe); c.lineTo(x + w + d, base - sobe); c.lineTo(x + w, base);
    c.closePath(); c.fill();
    px(c, x, topo, w, h, nv(tipo.f));
    c.fillStyle = nv(tipo.t);
    c.beginPath();
    c.moveTo(x, topo); c.lineTo(x + w, topo); c.lineTo(x + w + d, topo - sobe); c.lineTo(x + d, topo - sobe);
    c.closePath(); c.fill();
    // casa de máquinas na cobertura
    if (w >= 6 && R() < .7) {
      const mw = Math.max(2, Math.round(w * .3)), mx = x + 1 + Math.round(R() * (w - mw - 1));
      px(c, mx, topo - sobe + 1 - 2, mw, 2, nv(tipo.l));
      px(c, mx, topo - sobe - 2, mw, 1, nv(tipo.t));
    }
    // janelas
    const passoY = opts.passoY || (h > 30 ? 3 : 2), passoX = opts.passoX || 2;
    const acesas = opts.acesas ?? .3;
    for (let wy = topo + 2; wy < base - 1; wy += passoY) {
      if (tipo.varanda && passoY >= 3) px(c, x, wy + 1, w, 1, nv(tipo.varanda));
      for (let wx = x + 1; wx < x + w - 1; wx += passoX) {
        const r = R();
        if (r < acesas) {
          const cor = tipo.vidro && R() < .5 ? pick(R, COR.janelaFria) : pick(R, COR.janela);
          px(c, wx, wy, 1, 1, mix(cor, hex(COR.neblina), nevoa * .55));
        } else if (r < acesas + .25) {
          px(c, wx, wy, 1, 1, nv(mix(tipo.f, '#000000', .35)));
        }
      }
    }
    // algumas janelas na lateral, mais apagadas
    for (let wy = topo + 2; wy < base - 2; wy += passoY)
      for (let k = 1; k < d; k += 2)
        if (R() < acesas * .6) px(c, x + w + k, wy - Math.round(k * .5), 1, 1, mix(pick(R, COR.janela), nv(tipo.l), .45 + nevoa * .3));
    // luz de obstáculo no topo dos mais altos
    if (opts.aviao) aviso.push({ x: Math.round(x + w / 2 + d / 2), y: Math.round(topo - sobe - 3), fase: R() * 6 });
    if (opts.aviao) px(c, x + w / 2 + d / 2, topo - sobe - 2, 1, 2, nv('#2a2a30'));
  }

  /* ---------------- poste com o facho de luz ---------------- */
  function poste(c, x, y, alt) {
    brilho(c, x, y - alt, 5, '#ffcf7a', .32);
    brilho(c, x, y + 1, 7, '#ffbf66', .14);
    px(c, x, y - alt, 1, alt, '#22252b');
    px(c, x - 1, y - alt - 1, 3, 1, '#2b2e35');
    px(c, x, y - alt, 1, 1, '#fff1c4');
  }

  /* ---------------- a cena estática ---------------- */
  function montaFundo() {
    const R = rng(1817);
    piscam = []; aviso = [];
    fundo = document.createElement('canvas');
    fundo.width = W; fundo.height = H;
    const c = fundo.getContext('2d');
    c.imageSmoothingEnabled = false;
    const k = H / 390;                       // a foto tem ~390 pixels de arte de altura

    ceu(c, R);

    const hz = Math.round(H * F.horizonte);
    const calc = Math.round(H * F.calcada), rua = Math.round(H * F.rua);

    // chão da cidade: um tapete escuro de copas, para não sobrar buraco entre os prédios
    px(c, 0, hz + 2, W, calc - hz - 2, '#0a1510');
    for (let y = hz + 3; y < calc; y += 2) for (let x = (y * 3) % 4; x < W; x += 3 + Math.floor(R() * 3))
      px(c, x, y, 2, 1, R() < .5 ? '#0e1f16' : '#0c1a13');

    // o mar de prédios até o fundo, cada fileira um pouco maior e mais nítida
    const longe = H * F.longe;
    for (let base = hz + 2; base < longe; base += 2 + Math.floor(R() * 2)) {
      const t = (base - hz) / (longe - hz);
      const s = (.4 + t * .8) * k;
      const nevoa = .6 * (1 - t);
      for (let x = -4; x < W + 4; x += 2 + R() * 4 * s) copa(c, x, base - 1, Math.max(1, Math.round((1 + R() * 1.4) * s)), R, nevoa, false);
      for (let x = -10 + R() * 8; x < W; x += (6 + R() * 10) * s) {
        if (R() < .3) continue;
        const alto = R() < .05;
        const w = Math.round((3 + R() * 5) * s);
        const h = Math.round((alto ? 8 + R() * 7 : 2 + R() * 6) * s);
        predio(c, R, Math.round(x), Math.round(base), w, h, nevoa,
               { acesas: .26, aviao: alto && R() < .7, tipo: pick(R, TIPOS.slice(2)) });
      }
    }

    // torres residenciais e escritórios, mais perto
    const meio0 = H * F.meio0, meio1 = H * F.meio1, teto = H * .16;
    for (let base = meio0; base < meio1; base += Math.round((7 + R() * 7) * k)) {
      const t = (base - meio0) / (meio1 - meio0);
      const s = (1 + t * .5) * k;
      for (let x = -14 + R() * 20; x < W; x += (26 + R() * 36) * s) {
        const r = R();
        if (r < .3) {
          for (let q = 0; q < 4; q++) copa(c, x + R() * 14 * s, base - R() * 4, Math.round((2 + R() * 2) * s), R, .15 * (1 - t), false);
          continue;
        }
        const torre = r > .66;
        const w = Math.round((torre ? 13 + R() * 10 : 11 + R() * 9) * s);
        const h = Math.round(torre ? (base - teto) * (.45 + R() * .55) : Math.min(base - teto, (10 + R() * 20) * s));
        predio(c, R, Math.round(x), Math.round(base), w, h, .18 * (1 - t),
               { acesas: .24, aviao: torre && R() < .6, passoY: 3,
                 tipo: torre ? pick(R, TIPOS) : pick(R, TIPOS.slice(1)) });
        for (let q = 0; q < 3; q++) copa(c, x - 2 + R() * (w + 4), base + 1, Math.round((1.5 + R() * 2) * s), R, 0, false);
      }
    }

    // perto: uma rua transversal, prédios baixos com teto verde, praças e muitas árvores
    const perto0 = Math.round(meio1 - 6 * k), ruaT = Math.round(H * .76);
    let fezRua = false;
    for (let base = perto0; base < calc - 3 * k; base += Math.round((7 + R() * 5) * k)) {
      if (!fezRua && base > ruaT) {
        fezRua = true;
        px(c, 0, ruaT - 3 * k, W, 5 * k, '#26262c');
        px(c, 0, ruaT - 3 * k - 1, W, 1, '#4a4440');
        for (let x = 4; x < W; x += Math.round(26 * k)) {
          brilho(c, x, ruaT, Math.round(9 * k), '#d39a52', .28);
          poste(c, x, ruaT - 3 * k, Math.round(9 * k));
        }
      }
      for (let x = -10 + R() * 14; x < W; x += (22 + R() * 26) * k) {
        const r = R();
        if (r < .34) {
          const w = Math.round((14 + R() * 16) * k), h = Math.round((6 + R() * 9) * k);
          predio(c, R, Math.round(x), Math.round(base), w, h, 0,
                 { tipo: pick(R, BAIXO), acesas: .45, passoX: 3, passoY: 3, lado: .22 });
        } else if (r < .46) {
          // praça com o piso aceso
          const w = Math.round((12 + R() * 10) * k), h = Math.round(4 * k);
          px(c, x, base - h, w, h, '#4a3d31');
          brilho(c, x + w / 2, base - h / 2, Math.round(8 * k), '#e0a35a', .35);
          poste(c, Math.round(x + 2), Math.round(base - 1), Math.round(7 * k));
          poste(c, Math.round(x + w - 2), Math.round(base - 1), Math.round(7 * k));
        }
        for (let q = 0; q < 4; q++) copa(c, x + R() * 26 * k, base + 2 - R() * 5 * k, Math.round((3 + R() * 2.5) * k), R, 0, R() < .1);
      }
    }

    // calçada larga com o piso iluminado pelos postes
    px(c, 0, calc, W, rua - calc, COR.calcada);
    for (let y = calc + 2; y < rua - 1; y += 3) for (let x = (y % 2) * 3; x < W; x += 6) px(c, x, y, 4, 1, mix(COR.calcada, '#6a5e54', .5));
    px(c, 0, calc, W, 1, mix(COR.calcada, '#000000', .3));
    const passoPoste = Math.round(40 * k);
    for (let x = 6; x < W; x += passoPoste) {
      brilho(c, x + 2, rua - 3, Math.round(12 * k), '#c98d47', .32);
      const xa = x + Math.round(passoPoste / 2);
      px(c, xa, calc - 1, 1, Math.round(4 * k), '#3a2a1c');
      copa(c, xa, calc - Math.round(4 * k), Math.round(6 * k), R, 0, true);
      poste(c, x + 2, rua - 2, Math.round(15 * k));
    }
    px(c, 0, rua - 1, W, 1, COR.meioFio);

    // avenida
    px(c, 0, rua, W, H - rua, COR.asfalto);
    for (let y = rua + 2; y < H; y += 2) for (let x = (y * 7) % 5; x < W; x += 9) px(c, x, y, 1, 1, '#3a3a43');
    const meio = Math.round(rua + (H - rua) * .5);
    for (let x = 0; x < W; x += Math.round(16 * k)) px(c, x, meio, Math.round(7 * k), 1, COR.faixa);

    // sombra suave à esquerda: a torre continua sendo o centro da cena
    const sombra = c.createLinearGradient(0, 0, W * .5, 0);
    sombra.addColorStop(0, 'rgba(5,7,13,.38)'); sombra.addColorStop(1, 'rgba(5,7,13,0)');
    c.fillStyle = sombra; c.fillRect(0, 0, W, rua);

    larguraUtil = W;
    escCarro = k;
    carros = [];
    const altCarro = Math.round(6 * k);
    const faixas = [{ y: meio - altCarro - 1, dir: 1 }, { y: meio + 2, dir: -1 }];
    faixas.forEach((f, i) => {
      for (let q = 0; q < 3; q++) carros.push({
        x: R() * W, y: f.y, dir: f.dir, v: (16 + R() * 14 + i * 4) * k,
        cor: pick(R, ['#c8ccd2', '#1d2333', '#7a1f25', '#2c4b7a', '#5c6470', '#e8e3d5'])
      });
    });
  }

  /* ---------------- carro visto de lado, do tamanho dos da foto ---------------- */
  let escCarro = 1;
  function carro(c, q) {
    const k = escCarro;
    const L = Math.round(15 * k), A = Math.round(6 * k);
    const x = Math.round(q.x), y = Math.round(q.y);
    const u = n => Math.max(1, Math.round(n * k));
    const frente = q.dir > 0 ? x + L - 1 : x;
    const tras = q.dir > 0 ? x : x + L - 1;
    // reflexo do farol no asfalto
    px(c, q.dir > 0 ? x + L : x - u(3), y + A - u(1), u(3), 1, 'rgba(255,236,180,.35)');
    px(c, x, y + u(2), L, A - u(3), q.cor);                                   // carroceria
    px(c, x + u(3), y, L - u(6), u(2), mix(q.cor, '#000000', .2));             // teto
    px(c, x + u(4), y + u(1), L - u(8), u(1), '#1a2230');                      // vidros
    px(c, x, y + A - u(2), L, 1, mix(q.cor, '#000000', .45));                  // saia
    px(c, x + u(2), y + A - u(1), u(3), u(1), '#0b0b0e');                      // rodas
    px(c, x + L - u(5), y + A - u(1), u(3), u(1), '#0b0b0e');
    px(c, frente, y + u(2), 1, u(2), '#f4f8ff');
    px(c, tras, y + u(2), 1, u(2), '#ff3a3a');
  }

  /* ---------------- animação ---------------- */
  function quadro(agora) {
    raf = requestAnimationFrame(quadro);
    const dt = Math.min(.1, (agora - (ultimo || agora)) / 1000);
    if (agora - ultimo < 60) return;        // ~16 quadros por segundo bastam
    ultimo = agora; tAnim += dt;
    ctx.drawImage(fundo, 0, 0);
    for (const s of piscam) if (Math.sin(tAnim * 1.7 + s.fase) > .6) px(ctx, s.x, s.y, 1, 1, '#ffffff');
    for (const a of aviso) {
      if (Math.sin(tAnim * 2.4 + a.fase) > 0) { brilho(ctx, a.x, a.y, 3, '#ff3030', .45); px(ctx, a.x, a.y, 1, 1, '#ff5a5a'); }
      else px(ctx, a.x, a.y, 1, 1, '#6a1a1a');
    }
    for (const k of carros) {
      k.x += k.v * k.dir * dt;
      if (k.dir > 0 && k.x > larguraUtil + 10) k.x = -20;
      if (k.dir < 0 && k.x < -20) k.x = larguraUtil + 10;
      carro(ctx, k);
    }
  }

  function medir() {
    const r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    P = Math.max(2, Math.round(r.height / 330));
    const nW = Math.ceil(r.width / P), nH = Math.ceil(r.height / P);
    if (nW === W && nH === H && fundo) return true;
    W = nW; H = nH;
    cv.width = W; cv.height = H;
    ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    montaFundo();
    return true;
  }

  let ativo = false;
  function rodar() {
    // no celular a foto cobre a tela e o canvas fica escondido: nada a animar
    if (!medir()) { if (raf) cancelAnimationFrame(raf); raf = 0; return; }
    if (!raf) { ultimo = 0; raf = requestAnimationFrame(quadro); }
  }

  function iniciar(canvas) {
    cv = canvas;
    ativo = true;
    rodar();
  }

  function parar() {
    ativo = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  window.addEventListener('resize', () => { if (ativo && cv) rodar(); });

  return { iniciar, parar };
})();
