/* ===========================================================
   e90.js — a BMW 335i E90 LCI M Sport (2009/2010) do Gabriel, preta

   O molde é a foto do carro dele (a mesma do quadro da sala do chefe):
   o perfil lateral (porta-malas alto, vidro de trás, teto, para-brisa,
   capô e o bico) foi medido pixel a pixel nela, com o entre-eixos de
   2,760 m e as rodas 359M de 19" como régua. O corpo é um modelo 3D de
   verdade ("loft" de seções transversais, com o vinco lateral, o ombro,
   a saia M e o caimento dos vidros) e a lateral que a câmera vê recebe
   a própria foto, colada na lataria em pedacinhos que acompanham a
   curva: portas, maçanetas, Hofmeister kink, shadowline, pisca do para-
   lama, portinhola do tanque, lanterna em L e as rodas são as do carro.

   Capô, teto, porta-malas e vidros são pintados pelo reflexo da garagem
   (as calhas de LED do teto, a fita de LED das paredes e o portão
   aberto). A frente é desenhada em cima da lataria: faróis da LCI com os
   dois anéis (angel eyes) e a sobrancelha de LED, rins com moldura
   cromada, para-choque M com a entrada grande, colmeia e faróis de
   neblina, emblema no capô e a placa Mercosul.

   Coordenadas do carro, em metros: X para o lado (+ = o lado direito
   do carro, o que a câmera vê), Y ao longo (0 = para-choque de trás,
   L = da frente) e Z para cima. No mundo o carro fica de frente para
   +x (para a sala); a projeção é a do ISO (2:1, 30° de elevação), com
   1 m = 1,2 tile no chão e 47 px de altura.

   O carro é desenhado uma vez numa tela própria por escala de zoom e
   depois só é carimbado; no elevador ele só sobe e desce.
   =========================================================== */
const E90 = (() => {

  /* ---------------- a foto da lateral ---------------- */
  const cache = new Map();
  const FOTO = { img: new Image(), ok: false };
  // o recorte começa no pixel (36, 148) da foto; o chão fica em y = 436,5
  const KX = 0.0054159, KZ = 0.00525, FX0 = 36, FY0 = 148, CHAO = 436.5, X_TRAS = 37;
  const fu = ix => (ix + FX0 - X_TRAS) * KX;          // coluna do recorte → u (m)
  const fz = iy => (CHAO - (iy + FY0)) * KZ;           // linha do recorte → z (m)
  FOTO.img.onload = () => { FOTO.ok = true; cache.clear(); };
  FOTO.img.src = 'assets/bmw-e90-lado.png?v=20261025b';

  /* ---------------- medidas (m) ---------------- */
  const L = 4.257, LARG = 1.817;
  const EIXO_T = 0.817, EIXO_D = 3.577;                // 2,760 m de entre-eixos
  const RODAS = [
    { y: EIXO_D, r: .320, x: .866, larg: .225 },       // 225/35 R19
    { y: EIXO_T, r: .320, x: .878, larg: .255 }        // 255/30 R19
  ];

  /* ---------------- projeção ---------------- */
  const M = 1.2;                                       // tiles por metro
  const PXM = 32 * Math.SQRT2 * M * Math.sqrt(3) / 2;  // px de altura por metro (≈ 47)
  const P = (X, Y, Z) => ({ x: (Y - L / 2 - X) * M * 32, y: (X + Y - L / 2) * M * 16 - Z * PXM });
  const P3 = q => P(q[0], q[1], q[2]);

  /* ---------------- vetores e curvas ---------------- */
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = a => { const n = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / n, a[1] / n, a[2] / n]; };
  const V = unit([1, 1, 32 * M / PXM]);                // para onde fica a câmera
  const LUZ = unit([.25, .3, .92]);
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp01 = t => t < 0 ? 0 : t > 1 ? 1 : t;
  const suave = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

  /** curva monótona por uma tabela [u, valor] (não passa do ponto nas quinas) */
  function curva(tab) {
    const n = tab.length, xs = tab.map(p => p[0]), ys = tab.map(p => p[1]);
    const d = [], m = new Array(n);
    for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
    return u => {
      if (u <= xs[0]) return ys[0];
      if (u >= xs[n - 1]) return ys[n - 1];
      let lo = 0, hi = n - 1;
      while (hi - lo > 1) { const k = (lo + hi) >> 1; if (xs[k] <= u) lo = k; else hi = k; }
      const h = xs[hi] - xs[lo], t = (u - xs[lo]) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * ys[lo] + (t3 - 2 * t2 + t) * h * m[lo] + (-2 * t3 + 3 * t2) * ys[hi] + (t3 - t2) * h * m[hi];
    };
  }

  /* ===========================================================
     O perfil, medido na foto (u, z em metros)
     =========================================================== */
  // linha de cima pelo meio: para-choque e tampa de trás, vidro, teto, para-brisa, capô e o bico
  const zTop = curva([[0, .601], [.049, .696], [.097, .921], [.146, .97], [.195, 1.051], [.244, 1.09], [.292, 1.102],
    [.341, 1.111], [.39, 1.116], [.439, 1.12], [.487, 1.121], [.536, 1.125], [.585, 1.134], [.634, 1.147], [.682, 1.165],
    [.731, 1.188], [.78, 1.21], [.829, 1.234], [.877, 1.256], [.926, 1.278], [.975, 1.297], [1.024, 1.316], [1.072, 1.333],
    [1.121, 1.348], [1.17, 1.362], [1.219, 1.375], [1.267, 1.387], [1.316, 1.395], [1.365, 1.401], [1.414, 1.406],
    [1.462, 1.407], [1.56, 1.409], [1.706, 1.411], [1.803, 1.413], [1.901, 1.412], [1.998, 1.41], [2.047, 1.406],
    [2.096, 1.401], [2.145, 1.394], [2.193, 1.383], [2.242, 1.371], [2.291, 1.356], [2.34, 1.338], [2.388, 1.317],
    [2.437, 1.294], [2.486, 1.268], [2.535, 1.242], [2.583, 1.212], [2.632, 1.185], [2.681, 1.157], [2.73, 1.131],
    [2.778, 1.101], [2.827, 1.075], [2.876, 1.053], [2.925, 1.035], [2.973, 1.02], [3.022, 1.012], [3.071, 1.007],
    [3.12, 1.001], [3.168, .994], [3.217, .988], [3.266, .982], [3.315, .974], [3.363, .968], [3.412, .961], [3.461, .955],
    [3.51, .95], [3.558, .942], [3.607, .933], [3.656, .924], [3.704, .914], [3.753, .899], [3.802, .887], [3.851, .873],
    [3.899, .858], [3.948, .842], [3.997, .822], [4.046, .798], [4.094, .765], [4.143, .712], [4.192, .655], [4.226, .58],
    [4.241, .507], [L, .26]]);
  // embaixo: para-choque de trás com o difusor, a saia M e o lábio do para-choque da frente
  const zBase = curva([[0, .522], [.097, .375], [.195, .293], [.292, .276], [.39, .262], [.487, .249], [.585, .237],
    [.682, .224], [.78, .211], [.877, .197], [.975, .184], [1.072, .171], [1.17, .161], [1.267, .159], [1.365, .155],
    [1.462, .151], [1.56, .146], [1.852, .144], [2.145, .143], [2.437, .142], [2.632, .135], [2.73, .125], [2.827, .116],
    [2.925, .113], [3.022, .109], [3.217, .109], [3.315, .113], [3.802, .113], [3.899, .118], [3.997, .125], [4.094, .146],
    [4.192, .174], [L, .213]]);
  const wMax = curva([[0, .880], [.35, .900], [.82, .9085], [3.58, .9085], [4.0, .902], [L, .890]]);
  const wCint = curva([[0, .79], [.30, .83], [.9, .848], [2.9, .852], [3.6, .845], [4.0, .825], [L, .80]]);
  const wTeto = curva([[.55, .70], [1.2, .61], [1.7, .585], [2.1, .60], [2.6, .68], [2.95, .74]]);
  const gEstufa = u => suave(.52, .64, u) * (1 - suave(2.86, 2.98, u));    // 1 = vidros e teto

  /** cantos arredondados vistos de cima */
  function cantos(u) {
    let f = 1;
    const df = L - u, dt = u;
    if (df < .50) { const q = (.50 - df) / .50; f = Math.min(f, 1 - .36 * (1 - Math.sqrt(1 - q * q))); }
    if (dt < .36) { const q = (.36 - dt) / .36; f = Math.min(f, 1 - .26 * (1 - Math.sqrt(1 - q * q))); }
    return f;
  }

  /**
   * Seção transversal em u: pontos [meia-largura, altura] do meio de baixo
   * ao meio de cima, sempre 24 pontos.
   */
  const NP = 24;
  function secao(u) {
    const zt = zTop(u), zb = Math.min(zBase(u), zt - .02);
    // cintura: o alto das portas; na frente vira o alto do para-lama, junto do capô
    let zc = lerp(lerp(.94, .928, clamp01(u / 2.95)), zt - .045, suave(2.85, 3.05, u));
    zc = Math.max(Math.min(zc, zt - .025), zb + .02);
    const wm = wMax(u), wc = Math.min(wCint(u), wm - .03);
    const h = zt - zc, D = zc - zb, g = gEstufa(u);
    const wr = lerp(wc - .05, wTeto(u), clamp01(h / .40));
    const p = [
      [0, zb], [wm - .11, zb], [wm - .05, zb + .07 * D], [wm - .032, zb + .24 * D],   // saia M
      [wm - .008, zb + .40 * D], [wm, zb + .55 * D],
      [wm - .003, zc - .21 * D],                                                     // o vinco lateral
      [wm - .025, zc - .145 * D], [wm - .040, zc - .075 * D], [wc + .004, zc - .02 * D],
      [wc, zc],
      mix([wc - .018, zc + .5 * h], [wc - .03, zc + .015], g),
      mix([wc - .05, Math.min(zc + .85 * h, zt - .012)], [wr, zt - .05], g)
    ];
    const wE = lerp(wc - .13, wr - .09, g), coroa = lerp(.010, .016, g);
    for (let k = 0; k < 10; k++) { const w = wE * (1 - k / 10); p.push([w, zt - coroa * (w / wE) * (w / wE)]); }
    p.push([0, zt]);
    const f = cantos(u);
    for (const q of p) q[0] *= f;
    return { p, g, u };
  }

  /** meia-largura da lataria na altura z, na seção u (null fora do carro) */
  function ladoW(u, z) {
    const { p } = secao(u);
    for (let j = 1; j < NP - 1; j++) {
      const a = p[j], b = p[j + 1];
      if (z >= a[1] && z <= b[1] && b[1] > a[1]) return a[0] + (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]);
    }
    return null;
  }
  const dentro = (u, w, z) => { const lw = ladoW(u, z); return lw !== null && w <= lw; };
  /** até onde a frente vai, na largura w e altura z (para colar os detalhes da frente) */
  function frenteU(w, z) {
    if (dentro(L, w, z)) return L;
    let lo = L - 1, hi = L;
    if (!dentro(lo, w, z)) return null;
    for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (dentro(m, w, z)) lo = m; else hi = m; }
    return lo;
  }
  const memoF = new Map();
  /** ponto da frente: (w, z) da vista de frente → 3D */
  function fp(w, z) {
    const k = Math.abs(w).toFixed(4) + ',' + z.toFixed(4);
    let u = memoF.get(k);
    if (u === undefined) { u = frenteU(Math.abs(w), z); if (u === null) u = L; memoF.set(k, u); }
    return [w, u + .003, z];
  }

  /* ===========================================================
     Luz: o reflexo da garagem
     Luzes largas e suaves: com a malha de 5 cm, reflexo estreito vira
     xadrez; caixas de luz grandes dão o degradê de verniz preto.
     =========================================================== */
  const CALHAS = [-1.35, -.7, -.05, .6];
  function ambiente(R, noite) {
    const [x, y, z] = R;
    let teto = 40;
    if (z > .02) {
      const a = x / z, b = y / z;
      let k = 0;
      for (const c of CALHAS) k += Math.exp(-Math.pow((a - c) / .2, 2));
      teto += 640 * k * (1 - suave(1.6, 2.8, Math.abs(b)));
    }
    const fita = 400 * Math.exp(-Math.pow((z - .2) / .085, 2));      // fita de LED no alto das paredes
    const chao = 26 + 44 * Math.exp(Math.min(0, z) * 4);
    let v = lerp(chao, 62, suave(-.08, .08, z));
    v = lerp(v, teto, suave(.12, .42, z)) + fita;
    // o portão aberto: o dia lá fora (ou a noite)
    const fy = x / (Math.hypot(x, y) + 1e-6);
    const porta = suave(.35, .85, fy) * suave(-.55, -.2, z) * (1 - suave(.18, .45, z));
    const fora = noite > .5 ? [20, 26, 40] : [420, 470, 540];
    return [lerp(v, fora[0], porta), lerp(v, fora[1], porta), lerp(v * 1.04, fora[2], porta)];
  }
  const MAT = {
    pintura:  { base: [9, 10, 13], r0: .085, r1: .55, dif: .6 },      // Black Sapphire, com verniz
    vidro:    { base: [4, 6, 9], r0: .10, r1: .6, dif: .3, tinta: [.86, .95, 1.06] },
    friso:    { base: [5, 5, 6], r0: .06, r1: .45, dif: .3 },          // shadowline: preto brilhante
    plastico: { base: [16, 17, 19], r0: .015, r1: .2, dif: .6 },
    borracha: { base: [16, 16, 17], r0: .01, r1: .12, dif: .7 }
  };
  const rgb = (r, g, b) => `rgb(${Math.min(255, r) | 0},${Math.min(255, g) | 0},${Math.min(255, b) | 0})`;
  const rgbA = a => rgb(a[0], a[1], a[2]);
  function tomN(n, mat, noite, k = 1) {
    const m = MAT[mat];
    const ndv = Math.max(0, dot(n, V));
    const R = [2 * ndv * n[0] - V[0], 2 * ndv * n[1] - V[1], 2 * ndv * n[2] - V[2]];
    const e = ambiente(R, noite);
    const fr = m.r0 + m.r1 * Math.pow(1 - ndv, 4);
    const dif = ((1 - m.dif) + m.dif * Math.max(0, dot(n, LUZ))) * k;
    const t = m.tinta || [1, 1, 1];
    return [m.base[0] * dif + e[0] * fr * t[0], m.base[1] * dif + e[1] * fr * t[1], m.base[2] * dif + e[2] * fr * t[2]];
  }
  const tom = (n, mat, noite, k) => rgbA(tomN(n, mat, noite, k));

  /* ===========================================================
     A malha da carroceria
     =========================================================== */
  const US = [];
  for (let u = 0; u < .2; u += .02) US.push(u);
  for (let u = .2; u < 4.05; u += .05) US.push(u);
  for (let u = 4.05; u < L - .004; u += .012) US.push(u);
  US.push(L);

  function material(j, u, g) {
    if (j === 0) return 'plastico';
    if (j === 10) return g > .5 ? 'friso' : 'pintura';
    if (j >= 13 && g > .5 && ((u > 2.17 && u < 2.95) || (u > .60 && u < 1.22))) return 'vidro';
    return 'pintura';
  }
  const fundo = q => (q[0][0] + q[1][0] + q[2][0] + q[3][0]) * V[0] + (q[0][1] + q[1][1] + q[2][1] + q[3][1]) * V[1] + (q[0][2] + q[1][2] + q[2][2] + q[3][2]) * V[2];
  // linhas da seção onde a lataria tem quina: o vinco lateral, a cintura e a borda da estufa
  const QUINA = new Set([6, 10, 11, 12]);

  let geo = null;
  function montar() {
    const secs = US.map(secao), ns = secs.length;
    const faces = [];
    for (const lado of [1, -1]) {
      const pt = (i, j) => [lado * secs[i].p[j][0], secs[i].u, secs[i].p[j][1]];
      const FN = [];
      for (let i = 0; i < ns - 1; i++) {
        FN.push([]);
        for (let j = 0; j < NP - 1; j++) {
          const d1 = sub(pt(i + 1, j + 1), pt(i, j)), d2 = sub(pt(i + 1, j), pt(i, j + 1));
          FN[i].push(unit(lado > 0 ? cross(d2, d1) : cross(d1, d2)));
        }
      }
      // normal no canto: média com as vizinhas, menos atravessando uma quina
      const cantoN = (ii, jj, j) => {
        const is = [ii - 1, ii].filter(i => i >= 0 && i < ns - 1);
        const js = QUINA.has(jj) ? [j] : [jj - 1, jj].filter(k => k >= 0 && k < NP - 1);
        const a = [0, 0, 0];
        for (const i of is) for (const k of js) { const n = FN[i][k]; a[0] += n[0]; a[1] += n[1]; a[2] += n[2]; }
        return unit(a);
      };
      for (let i = 0; i < ns - 1; i++) {
        for (let j = 0; j < NP - 1; j++) {
          const n = FN[i][j];
          if (dot(n, V) <= .002) continue;
          const q = [pt(i, j), pt(i, j + 1), pt(i + 1, j + 1), pt(i + 1, j)];
          const cn = [cantoN(i, j, j), cantoN(i, j + 1, j), cantoN(i + 1, j + 1, j), cantoN(i + 1, j, j)];
          faces.push({ pts: q.map(P3), cn, mat: material(j, (secs[i].u + secs[i + 1].u) / 2, (secs[i].g + secs[i + 1].g) / 2), d: fundo(q) });
        }
      }
    }
    faces.sort((a, b) => a.d - b.d);
    const ult = secs[ns - 1].p, tampa = [];
    for (let j = 0; j < NP; j++) tampa.push(P(ult[j][0], L, ult[j][1]));
    for (let j = NP - 1; j >= 0; j--) tampa.push(P(-ult[j][0], L, ult[j][1]));
    geo = { faces, tampa };
  }

  /* ---------------- desenho: utilidades ---------------- */
  let c = null;                       // contexto da tela do carro durante o desenho
  function caminho(pts, fechar = true) {
    c.beginPath();
    pts.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y));
    if (fechar) c.closePath();
  }
  function enche(pts, cor) { caminho(pts); c.fillStyle = cor; c.fill(); }
  function traca(pts, cor, lw, fechar = false) { caminho(pts, fechar); c.strokeStyle = cor; c.lineWidth = lw; c.stroke(); }
  /** subdivide um contorno 2D para ele acompanhar a curva da lataria */
  function denso(pts, passo, fechado = true) {
    const r = [], n = pts.length;
    for (let i = 0; i < (fechado ? n : n - 1); i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / passo));
      for (let s = 0; s < k; s++) r.push([a[0] + (b[0] - a[0]) * s / k, a[1] + (b[1] - a[1]) * s / k]);
    }
    if (!fechado) r.push(pts[n - 1]);
    return r;
  }
  /** retângulo de cantos redondos em 2D; r = [embaixo-esq, embaixo-dir, cima-dir, cima-esq] */
  function rret(a0, b0, a1, b1, r) {
    const pts = [];
    const arco = (ca, cb, rr, t0, t1) => { for (let i = 0; i <= 6; i++) { const t = t0 + (t1 - t0) * i / 6; pts.push([ca + Math.cos(t) * rr, cb + Math.sin(t) * rr]); } };
    arco(a0 + r[0], b0 + r[0], r[0], Math.PI, Math.PI * 1.5);
    arco(a1 - r[1], b0 + r[1], r[1], Math.PI * 1.5, Math.PI * 2);
    arco(a1 - r[2], b1 - r[2], r[2], 0, Math.PI * .5);
    arco(a0 + r[3], b1 - r[3], r[3], Math.PI * .5, Math.PI);
    return pts;
  }
  /** corta um contorno 2D em a ≤ amax (o farol do outro lado some na curva do para-choque) */
  function corta(pts, amax) {
    const r = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const ina = a[0] <= amax, inb = b[0] <= amax;
      if (ina) r.push(a);
      if (ina !== inb) { const t = (amax - a[0]) / (b[0] - a[0]); r.push([amax, a[1] + (b[1] - a[1]) * t]); }
    }
    return r;
  }
  const circ = (a, b, r, n = 28) => { const p = []; for (let i = 0; i < n; i++) { const t = i / n * Math.PI * 2; p.push([a + Math.cos(t) * r, b + Math.sin(t) * r]); } return p; };
  /** contorno da vista de frente (w, z) para a tela; lado = 1 (direito, de cá) ou -1 */
  const F2 = (pts, lado = 1) => pts.map(([w, z]) => P3(fp(lado * w, z)));
  const grad = (pts, cores) => {
    const ys = pts.map(p => p.y), g = c.createLinearGradient(0, Math.min(...ys), 0, Math.max(...ys));
    cores.forEach(([t, cor]) => g.addColorStop(t, cor));
    return g;
  };
  /** emblema da BMW: azul em cima à esquerda e embaixo à direita, como se olha para ele */
  function emblema(mapa, ca, cb, r, esq) {
    // esq: para que lado de "a" fica a esquerda de quem olha (+1 ou -1)
    enche(mapa(circ(ca, cb, r, 24)), '#0b0c0e');
    traca(mapa(circ(ca, cb, r * .97, 24)), '#c9ced6', r * PXM * .12, true);
    const q = t0 => { const p = [[ca, cb]]; for (let i = 0; i <= 6; i++) { const t = t0 + i / 6 * Math.PI / 2; p.push([ca + Math.cos(t) * r * .62, cb + Math.sin(t) * r * .62]); } return mapa(p); };
    // quadrantes em (a, b): 0 = (+a,+b), π/2 = (-a,+b), π = (-a,-b), 3π/2 = (+a,-b)
    const cimaEsq = esq > 0 ? 0 : Math.PI / 2, baixoDir = cimaEsq + Math.PI;
    for (const t0 of [0, Math.PI / 2, Math.PI, Math.PI * 1.5])
      enche(q(t0), (t0 === cimaEsq || t0 === baixoDir) ? '#1f78d1' : '#f3f5f7');
  }

  /* ===========================================================
     A lateral: a foto do carro colada na lataria
     =========================================================== */
  const PASSO_X = 12, PASSO_Y = 3;
  let grade = null;
  function montarGrade() {
    const im = FOTO.img, W = im.naturalWidth, H = im.naturalHeight;
    // onde a foto tem carro (para não desenhar pedaço vazio)
    const t = document.createElement('canvas'); t.width = W; t.height = H;
    const tx = t.getContext('2d'); tx.drawImage(im, 0, 0);
    const a = tx.getImageData(0, 0, W, H).data;
    const nx = Math.ceil(W / PASSO_X), ny = Math.ceil(H / PASSO_Y);
    const cheio = new Uint8Array(nx * ny);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
      if (a[(y * W + x) * 4 + 3] > 8) cheio[Math.floor(y / PASSO_Y) * nx + Math.floor(x / PASSO_X)] = 1;
    // nós da grade: cada ponto da foto vai para a lataria (u, z) com a largura dela ali
    const nos = [];
    for (let j = 0; j <= ny; j++) {
      const iy = Math.min(H, j * PASSO_Y), z = fz(iy), linha = [];
      for (let i = 0; i <= nx; i++) {
        const ix = Math.min(W, i * PASSO_X), u = Math.max(0, Math.min(L, fu(ix)));
        // a largura vem da faixa lateral da seção (da saia até a borda de cima):
        // fora dela, repete a da beirada, senão o pedaço da foto entorta
        const sp = secao(u).p;
        const w = ladoW(u, Math.min(Math.max(z, sp[2][1]), sp[12][1])) ?? wMax(u) * cantos(u);
        linha.push(P(w + .004, u, z));
      }
      nos.push(linha);
    }
    // até onde a foto sobe em cada coluna: dali para cima é capô, teto ou tampa (sombreados)
    const topoLado = [];
    for (let i = 0; i < nx; i++) { const u = Math.max(0, Math.min(L, fu((i + .5) * PASSO_X))); topoLado.push(secao(u).p[12][1] + .03); }
    // e o recorte exato: a borda de cima da lateral, de trás para a frente, e o chão
    const borda = US.map(u => { const q = secao(u).p[12]; return P(q[0], u, q[1]); });
    borda.push(P(.95, L + .02, borda[borda.length - 1] ? zTop(L) : 0), P(.95, L + .02, -.3), P(.95, -.02, -.3), P(.95, -.02, zTop(0)));
    grade = { W, H, nx, ny, cheio, nos, topoLado, borda };
  }
  function fotoLado(esc, ox, oy) {
    if (!FOTO.ok) return;
    if (!grade) montarGrade();
    const { W, H, nx, ny, cheio, nos, topoLado, borda } = grade, im = FOTO.img;
    c.save();
    caminho(borda); c.clip();
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    for (let j = 0; j < ny; j++) {
      const iy0 = j * PASSO_Y, sh = Math.min(PASSO_Y, H - iy0);
      const zm = fz(iy0 + sh / 2);
      for (let i = 0; i < nx; i++) {
        if (!cheio[j * nx + i] || zm > topoLado[i]) continue;
        const ix0 = i * PASSO_X, sw = Math.min(PASSO_X, W - ix0);
        const A = nos[j][i], B = nos[j][i + 1], D = nos[j + 1][i];
        const a = (B.x - A.x) / sw, b = (B.y - A.y) / sw, cc = (D.x - A.x) / sh, d = (D.y - A.y) / sh;
        c.setTransform(esc * a, esc * b, esc * cc, esc * d,
                       esc * (A.x - a * ix0 - cc * iy0) - ox, esc * (A.y - b * ix0 - d * iy0) - oy);
        // meio pixel a mais de cada lado fecha as frestas entre os pedaços
        const ew = Math.min(.5, W - ix0 - sw), eh = Math.min(.5, H - iy0 - sh);
        c.drawImage(im, ix0, iy0, sw + ew, sh + eh, ix0, iy0, sw + ew, sh + eh);
      }
    }
    c.restore();
  }

  /** a banda de rodagem dos pneus do lado de cá (a foto só mostra o flanco) */
  function bandas(noite) {
    for (const r of RODAS) {
      const xi = r.x - r.larg, N = 40;
      const Q = (x, t) => P(x, r.y + Math.cos(t) * r.r, r.r + Math.sin(t) * r.r);
      for (let i = 0; i < N; i++) {
        const t0 = i / N * Math.PI * 2, t1 = (i + 1) / N * Math.PI * 2, tm = (t0 + t1) / 2;
        const nn = [0, Math.cos(tm), Math.sin(tm)];
        if (dot(nn, V) <= 0) continue;
        enche([Q(xi, t0), Q(r.x, t0), Q(r.x, t1), Q(xi, t1)], tom(nn, 'borracha', noite));
      }
    }
  }

  /* ===========================================================
     A frente (LCI M Sport)
     =========================================================== */
  // na altura medida na foto: o farol vai de 0,55 a 0,68 m, logo abaixo da linha do capô
  const LENTE = [[.235, .628], [.30, .662], [.50, .674], [.66, .670], [.77, .662], [.80, .654], [.80, .583],
    [.62, .563], [.42, .553], [.30, .557], [.245, .573], [.225, .600]];
  const ANEIS = [[.355, .610, .050], [.580, .610, .054]];
  function frente(noite) {
    // a linha do capô, onde ele encontra faróis, rins e para-choque
    for (const lado of [-1, 1]) {
      const pts = [];
      for (let w = 0; w <= .80; w += .02) pts.push([w, .684 - .012 * (w / .8) * (w / .8)]);
      traca(F2(lado < 0 ? pts.filter(p => p[0] <= .70) : pts, lado), 'rgba(0,0,0,.8)', .010 * PXM);
    }
    // faróis: lente clara, refletor cromado, os dois anéis e a sobrancelha de LED
    const lente = denso(LENTE, .02);
    for (const lado of [-1, 1]) {
      const pl = F2(lado < 0 ? corta(lente, .72) : lente, lado);
      enche(pl, grad(pl, [[0, '#dfe4ea'], [.5, '#a3acb6'], [1, '#56606a']]));
      c.save(); caminho(pl); c.clip();
      for (const [a, b, r] of ANEIS) {
        if (lado < 0 && a + r > .72) continue;
        const concha = F2(circ(a, b, r * 1.3, 24), lado);
        enche(concha, grad(concha, [[0, '#eef1f4'], [.6, '#9aa2ab'], [1, '#5b636c']]));
        const pj = F2(circ(a, b, r * .48, 18), lado);                        // o projetor
        enche(pj, grad(pj, [[0, '#8a96a6'], [1, '#2c3440']]));
        enche(F2(circ(a - r * .14, b + r * .18, r * .16, 10), lado), 'rgba(240,246,255,.75)');
        traca(F2(circ(a, b, r, 28), lado), '#ffffff', .009 * PXM, true);     // o anel
        const sob = [];
        for (let i = 0; i <= 10; i++) { const t = Math.PI * (.2 + .6 * i / 10); sob.push([a + Math.cos(t) * r * 1.24, b + Math.sin(t) * r * 1.24]); }
        traca(F2(sob, lado), '#ffffff', .008 * PXM);                         // a sobrancelha da LCI
      }
      traca(F2([[.30, .566], [.50, .560], [.70, .566], [.80, .578]].filter(p => lado > 0 || p[0] <= .72), lado), '#d6dce3', .006 * PXM);
      c.restore();
      traca(pl, '#0b0d10', .005 * PXM, true);
    }
    // os rins: moldura cromada e as aletas pretas
    for (const lado of [-1, 1]) {
      const pf = F2(rret(.035, .486, .205, .650, [.025, .058, .034, .020]), lado);
      enche(pf, grad(pf, [[0, '#f5f7f9'], [.5, '#b3bac2'], [1, '#626a72']]));
      const pd = F2(rret(.048, .499, .192, .637, [.014, .046, .022, .010]), lado);
      enche(pd, '#040506');
      c.save(); caminho(pd); c.clip();
      for (let w = .054; w < .192; w += .0125) traca(F2([[w, .500], [w, .637]], lado), '#3d434a', .0045 * PXM);
      c.restore();
    }
    emblema(pts => F2(pts), 0, .706, .038, 1);          // de frente, o lado direito do carro fica à esquerda
    // para-choque M: a entrada grande do meio com a colmeia
    const meio = F2(denso(rret(-.42, .215, .42, .345, [.03, .03, .02, .02]), .03));
    enche(meio, '#040506');
    c.save(); caminho(meio); c.clip();
    c.fillStyle = '#20242a';
    for (let w = -.40; w <= .40; w += .024) for (let z = .226; z <= .336; z += .019) {
      const p = P3(fp(w + ((Math.round(z / .019) % 2) ? .012 : 0), z)); c.fillRect(p.x - .3, p.y - .22, .6, .44);
    }
    c.restore();
    // as entradas dos lados, com os faróis de neblina redondos
    const ENT = denso([[.53, .225], [.75, .222], [.80, .24], [.82, .29], [.80, .345], [.75, .362], [.56, .362], [.525, .34]], .02);
    for (const lado of [-1, 1]) {
      enche(F2(lado < 0 ? corta(ENT, .72) : ENT, lado), '#040506');
      enche(F2(circ(.665, .292, .036, 22), lado), '#9aa1a9');
      const lz = F2(circ(.665, .292, .028, 22), lado);
      enche(lz, grad(lz, [[0, '#e6ecf2'], [1, '#76808b']]));
    }
    placa();
  }

  function placa() {
    const Y = L + .014, w0 = .20, w1 = -.20, z0 = .350, z1 = .480;   // da esquerda para a direita de quem olha
    const q = [P(w0, Y, z1), P(w1, Y, z1), P(w1, Y, z0), P(w0, Y, z0)];
    enche(q, '#f4f5f6'); traca(q, '#3a3d42', .004 * PXM, true);
    const o = q[0], ux = (q[1].x - q[0].x) / 40, uy = (q[1].y - q[0].y) / 40;
    const dx = (q[3].x - q[0].x) / 13, dy = (q[3].y - q[0].y) / 13;
    c.save();
    c.transform(ux, uy, dx, dy, o.x, o.y);        // em centímetros da placa
    c.fillStyle = '#1b4fa8'; c.fillRect(0, 0, 40, 3.1);
    c.fillStyle = '#fff'; c.font = "700 2.2px 'Barlow Semi Condensed', sans-serif"; c.textAlign = 'center';
    c.fillText('BRASIL', 20, 2.35);
    c.fillStyle = '#1f8a3e'; c.fillRect(35.2, .6, 3, 1.9); c.fillStyle = '#f2c919'; c.fillRect(36.2, 1.05, 1, 1);
    c.fillStyle = '#111'; c.font = "700 8.6px 'Barlow Semi Condensed', sans-serif";
    c.fillText('NSS3E90', 20, 11.6);
    c.restore();
  }

  /** o retrovisor do lado de lá aparece por cima do capô */
  function espelhoLonge(noite) {
    const x0 = -.845, x1 = -1.022, y0 = 2.52, y1 = 2.69, z0 = .875, z1 = .99;
    const sec = enc => rret(y0 + enc, z0 + enc * .6, y1 - enc * .4, z1 - enc * .5, [.03, .045, .05, .025].map(v => Math.max(.006, v - enc * .5)));
    const pa = sec(0).map(([y, z]) => [x0, y, z]), pb = sec(.022).map(([y, z]) => [x1, y, z]);
    const fs = [];
    for (let i = 0; i < pa.length; i++) {
      const j = (i + 1) % pa.length, q = [pa[i], pa[j], pb[j], pb[i]];
      const n = unit(cross(sub(q[3], q[1]), sub(q[2], q[0])));
      if (dot(n, V) > 0) fs.push({ q, n, d: fundo(q) });
    }
    fs.sort((p, q) => p.d - q.d);
    for (const f of fs) { const pts = f.q.map(P3), cor = tom(f.n, 'pintura', noite); enche(pts, cor); traca(pts, cor, .003 * PXM, true); }
  }

  /* ===========================================================
     Montagem da imagem por escala
     =========================================================== */
  function limites() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const vale = p => { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); };
    for (const f of geo.faces) f.pts.forEach(vale);
    for (const s of [-1, 1]) { vale(P(s * 1.03, 2.6, 1.0)); vale(P(s * .95, 0, 0)); vale(P(s * .95, L, 0)); vale(P(s * .95, 2.1, 1.5)); }
    return { x0: x0 - 3, y0: y0 - 3, x1: x1 + 3, y1: y1 + 3 };
  }

  function pintar(cv, esc, noite) {
    c = cv.getContext('2d');
    const b = geo.lim;
    const base = () => c.setTransform(esc, 0, 0, esc, -b.x0 * esc, -b.y0 * esc);
    base();
    c.lineJoin = 'round';
    espelhoLonge(noite);
    const lw = .5 / esc;
    const med = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    const meio = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const lum = a => a[0] * .3 + a[1] * .59 + a[2] * .11;
    for (const f of geo.faces) {
      const k = f.cn.map(n => tomN(n, f.mat, noite));
      const p = f.pts;
      // degradê atravessando a seção: é onde a curva da lataria muda a cor
      // as linhas de mesma cor ficam paralelas às bordas da faixa: assim a faixa vizinha emenda
      const pa = meio(p[0], p[3]), pm = meio(p[1], p[2]), ca = med(k[0], k[3]), cb = med(k[1], k[2]);
      let ex = p[3].x - p[0].x, ey = p[3].y - p[0].y; const el = Math.hypot(ex, ey) || 1; ex /= el; ey /= el;
      const dx0 = pm.x - pa.x, dy0 = pm.y - pa.y, t = dx0 * ex + dy0 * ey;
      const pb = { x: pa.x + dx0 - t * ex, y: pa.y + dy0 - t * ey };
      let fill;
      if (Math.abs(lum(ca) - lum(cb)) < .6 || Math.hypot(pb.x - pa.x, pb.y - pa.y) < .05) fill = rgbA(med(ca, cb));
      else { fill = c.createLinearGradient(pa.x, pa.y, pb.x, pb.y); fill.addColorStop(0, rgbA(ca)); fill.addColorStop(1, rgbA(cb)); }
      // cada face cresce meio pixel para fora: fecha as frestas sem riscar a grade
      const cx = (p[0].x + p[1].x + p[2].x + p[3].x) / 4, cy = (p[0].y + p[1].y + p[2].y + p[3].y) / 4;
      c.beginPath();
      for (let i = 0; i < 4; i++) {
        const dx = p[i].x - cx, dy = p[i].y - cy, d = Math.hypot(dx, dy) || 1;
        const x = p[i].x + dx / d * lw, y = p[i].y + dy / d * lw;
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.closePath(); c.fillStyle = fill; c.fill();
    }
    enche(geo.tampa, tom([0, 1, 0], 'pintura', noite));
    bandas(noite);
    fotoLado(esc, b.x0 * esc, b.y0 * esc);
    base();
    frente(noite);
    c = null;
  }

  let alvoAntes = 0, desdeAlvo = 0;
  function imagem(esc, noite) {
    if (!geo) { montar(); geo.lim = limites(); }
    const nk = noite > .5 ? 1 : 0;
    const nivel = Math.min(8, Math.max(.25, Math.pow(2, Math.round(Math.log2(esc) * 3) / 3)));
    const chave = nivel.toFixed(3) + '|' + nk;
    let im = cache.get(chave);
    if (im) return im;
    // enquanto o zoom anda, usa a imagem mais próxima que já existe
    const agora = performance.now();
    if (nivel !== alvoAntes) { alvoAntes = nivel; desdeAlvo = agora; }
    if (cache.size && agora - desdeAlvo < 180) {
      let melhor = null, dm = Infinity;
      for (const [k, v] of cache) { if (!k.endsWith('|' + nk)) continue; const d = Math.abs(Math.log(v.nivel / nivel)); if (d < dm) { dm = d; melhor = v; } }
      if (melhor) return melhor;
    }
    const b = geo.lim, cv = document.createElement('canvas');
    cv.width = Math.ceil((b.x1 - b.x0) * nivel); cv.height = Math.ceil((b.y1 - b.y0) * nivel);
    pintar(cv, nivel, noite);
    im = { cv, nivel, x0: b.x0, y0: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 };
    if (cache.size >= 6) cache.delete(cache.keys().next().value);
    cache.set(chave, im);
    return im;
  }

  /**
   * Carimba o carro com o centro do chão em (sx, sy), nas coordenadas do
   * mundo do ctx. Devolve o contorno na tela, para o toque.
   */
  function desenhar(ctx, sx, sy, noite) {
    const m = ctx.getTransform();
    const im = imagem(Math.hypot(m.a, m.b), noite);
    ctx.drawImage(im.cv, sx + im.x0, sy + im.y0, im.w, im.h);
    return { x0: sx + im.x0, y0: sy + im.y0, x1: sx + im.x0 + im.w, y1: sy + im.y0 + im.h };
  }

  /** onde ficam os anéis dos faróis (para o brilho à noite), relativos ao centro */
  function farois() {
    const r = [];
    for (const lado of [1, -1]) for (const [a, b, rr] of ANEIS) { if (lado < 0 && a + rr > .72) continue; r.push(P3(fp(lado * a, b))); }
    return r;
  }

  return {
    desenhar, farois,
    /** medidas em tiles, para a garagem: comprimento (no x do mundo), largura (no y) e os eixos */
    tiles: { comp: L * M, larg: LARG * M, eixoT: (EIXO_T - L / 2) * M, eixoD: (EIXO_D - L / 2) * M, bitola: .75 * M },
    PXM
  };
})();
