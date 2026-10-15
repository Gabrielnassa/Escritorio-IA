/* ===========================================================
   bmw.js — o quadro da sala do chefe
   BMW 335i E90 M Sport LCI (2009/2010), vista lateral, com as
   rodas Style 359M de 19" em prata.

   O carro é desenhado em vetor, num espaço de projeto de 1000
   unidades de comprimento (≈ 4,52 m do E90 real), com o y para
   cima e o chão em y = 0. Proporções do E90:
     comprimento 4520 mm · entre-eixos 2760 mm · altura 1421 mm
     balanço dianteiro ≈ 800 mm · roda 19" com pneu 225/35 R19
   Assim o mesmo desenho serve para a miniatura na parede do
   escritório e para a versão grande que abre ao clicar.
   =========================================================== */
const BMW = (() => {

  /* cores de fábrica oferecidas no E90 LCI */
  const CORES = {
    alpine:   { nome: 'Alpine White',          codigo: '300', base: '#eef0ef', luz: '#ffffff', sombra: '#b4b9bd', fundo: '#8f959b' },
    sapphire: { nome: 'Black Sapphire',        codigo: '475', base: '#16191d', luz: '#55606b', sombra: '#07080a', fundo: '#030405' },
    lemans:   { nome: 'Le Mans Blue',          codigo: '381', base: '#1f4fa0', luz: '#5f8fe0', sombra: '#122f63', fundo: '#0a1a38' },
    montego:  { nome: 'Montego Blue',          codigo: 'A51', base: '#2b3b62', luz: '#61759e', sombra: '#18223b', fundo: '#0d1322' },
    space:    { nome: 'Space Grey',            codigo: 'A52', base: '#5a6066', luz: '#9aa1a8', sombra: '#363a3e', fundo: '#1f2224' },
    titanium: { nome: 'Titanium Silver',       codigo: '354', base: '#a7acb1', luz: '#e4e8ec', sombra: '#6d7277', fundo: '#4a4e52' },
    melbourne:{ nome: 'Melbourne Red',         codigo: 'A83', base: '#7c1a20', luz: '#c4434a', sombra: '#4a0d11', fundo: '#2a0709' }
  };
  const CHAVE = 'nassa-bmw-cor';
  let corAtual = 'alpine';
  try { const c = localStorage.getItem(CHAVE); if (c && CORES[c]) corAtual = c; } catch (e) { /* sem storage */ }
  const ouvintes = [];

  function setCor(k) {
    if (!CORES[k]) return;
    corAtual = k;
    try { localStorage.setItem(CHAVE, k); } catch (e) { /* sem storage */ }
    ouvintes.forEach(f => f(k));
  }

  /* ---------------- geometria (y para cima) ---------------- */
  const EIXO_D = 177, EIXO_T = 787;     // centros das rodas
  const R_PNEU = 70.8, R_ARO = 53.4;    // 19" + 225/35
  const R_CAIXA = 80;                   // caixa de roda (19" enche o para-lama)
  const MEIA_CAIXA = Math.sqrt(R_CAIXA * R_CAIXA - 41 * 41);   // meia boca da caixa no chão (y = 30)

  /** cria um "pincel" que converte do espaço do carro para a tela */
  function pincel(ctx, ox, oy, s) {
    const X = x => ox + x * s, Y = y => oy - y * s;
    return {
      X, Y, s,
      M: (x, y) => ctx.moveTo(X(x), Y(y)),
      L: (x, y) => ctx.lineTo(X(x), Y(y)),
      C: (a, b, c, d, e, f) => ctx.bezierCurveTo(X(a), Y(b), X(c), Y(d), X(e), Y(f)),
      Q: (a, b, c, d) => ctx.quadraticCurveTo(X(a), Y(b), X(c), Y(d))
    };
  }

  /** caixa de roda: arco sobre a roda entre dois pontos na altura y0 */
  function arco(ctx, p, cx, y0, ida) {
    const dy = y0 - 71, dx = Math.sqrt(R_CAIXA * R_CAIXA - dy * dy);
    const a = Math.atan2(-dy, dx);              // ângulo do ponto de trás (tela, y para baixo)
    if (ida) ctx.arc(p.X(cx), p.Y(71), R_CAIXA * p.s, a, Math.PI - a, true);
    void dx;
  }

  /** silhueta da carroceria, frente à esquerda */
  function silhueta(ctx, p) {
    ctx.beginPath();
    p.M(16, 30);
    p.L(6, 42);                                   // lábio do para-choque M
    p.C(0, 58, -2, 86, 1, 104);                   // face do para-choque
    p.C(2, 118, 6, 132, 12, 142);
    p.C(20, 152, 34, 160, 54, 165);               // topo do farol
    p.C(150, 182, 262, 200, 336, 214);            // capô até o pé do para-brisa
    p.C(382, 240, 444, 286, 506, 306);            // para-brisa
    p.C(562, 319, 650, 318, 706, 308);            // teto
    p.C(762, 292, 812, 262, 850, 240);            // vigia traseira
    p.C(884, 238, 930, 238, 968, 241);            // tampa do porta-malas
    p.L(976, 241);                                // aba do spoiler
    p.C(990, 236, 998, 222, 1000, 200);
    p.C(1002, 170, 1000, 130, 996, 100);          // para-choque traseiro
    p.C(994, 70, 990, 48, 982, 36);
    p.L(966, 30);
    p.L(EIXO_T + MEIA_CAIXA, 30);
    arco(ctx, p, EIXO_T, 30, true);               // caixa de roda traseira
    p.L(EIXO_D + MEIA_CAIXA, 30);                       // saia lateral M
    arco(ctx, p, EIXO_D, 30, true);               // caixa de roda dianteira
    p.L(16, 30);
    ctx.closePath();
  }

  /** área envidraçada (DLO) com o "Hofmeister kink" na coluna C */
  function vidros(ctx, p) {
    ctx.beginPath();
    p.M(354, 214);
    p.C(404, 248, 462, 292, 514, 301);
    p.C(572, 309, 652, 307, 700, 298);
    p.C(730, 285, 764, 258, 788, 234);
    p.C(795, 227, 792, 219, 778, 218);            // a dobra para a frente
    p.L(354, 214);
    ctx.closePath();
  }

  /* ---------------- roda Style 359M ---------------- */
  function roda(ctx, p, cx, frente) {
    const X = p.X(cx), Y = p.Y(71), s = p.s;
    // pneu
    ctx.fillStyle = '#101113';
    ctx.beginPath(); ctx.arc(X, Y, R_PNEU * s, 0, Math.PI * 2); ctx.fill();
    const gp = ctx.createRadialGradient(X, Y, R_ARO * s, X, Y, R_PNEU * s);
    gp.addColorStop(0, '#1d1f22'); gp.addColorStop(.55, '#151618'); gp.addColorStop(1, '#0a0a0b');
    ctx.fillStyle = gp;
    ctx.beginPath(); ctx.arc(X, Y, R_PNEU * s * .985, 0, Math.PI * 2); ctx.fill();
    // inscrição discreta no flanco
    ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = Math.max(.6, 2.2 * s);
    ctx.beginPath(); ctx.arc(X, Y, (R_ARO + 9) * s, -2.5, -1.2); ctx.stroke();

    // fundo do aro: disco de freio e pinça
    ctx.fillStyle = '#16181b';
    ctx.beginPath(); ctx.arc(X, Y, R_ARO * s, 0, Math.PI * 2); ctx.fill();
    const gd = ctx.createRadialGradient(X - 8 * s, Y - 8 * s, 4 * s, X, Y, 44 * s);
    gd.addColorStop(0, '#8d9298'); gd.addColorStop(.7, '#5b6066'); gd.addColorStop(1, '#3a3d41');
    ctx.fillStyle = gd;
    ctx.beginPath(); ctx.arc(X, Y, 43 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.arc(X, Y, 20 * s, 0, Math.PI * 2); ctx.fill();
    // pinça (atrás do eixo, lado de cima)
    const ap = frente ? -0.35 : -0.25;
    ctx.save();
    ctx.translate(X, Y); ctx.rotate(ap);
    ctx.fillStyle = '#4b4f55';
    ISO_rr(ctx, 26 * s, -13 * s, 18 * s, 26 * s, 4 * s); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ISO_rr(ctx, 28 * s, -11 * s, 5 * s, 22 * s, 2 * s); ctx.fill();
    ctx.restore();

    // raios em Y: 10 raios que se abrem em dois perto do aro
    const prata = ctx.createLinearGradient(X - R_ARO * s, Y - R_ARO * s, X + R_ARO * s, Y + R_ARO * s);
    prata.addColorStop(0, '#f4f6f8'); prata.addColorStop(.45, '#c9ced4');
    prata.addColorStop(.7, '#a3a9b0'); prata.addColorStop(1, '#d7dbe0');
    const N = 10, rCubo = 11, rGarfo = 33, rFim = R_ARO - 4.5;
    for (let i = 0; i < N; i++) {
      const a = -Math.PI / 2 + i * (Math.PI * 2 / N);
      const pt = (r, da, off) => {
        const aa = a + da;
        return [X + Math.cos(aa) * r * s - Math.sin(aa) * off * s,
                Y + Math.sin(aa) * r * s + Math.cos(aa) * off * s];
      };
      // haste
      ctx.beginPath();
      let q = pt(rCubo, 0, -3.6); ctx.moveTo(q[0], q[1]);
      q = pt(rGarfo, 0, -2.6);    ctx.lineTo(q[0], q[1]);
      // braço esquerdo do Y
      q = pt(rFim, -0.165, -2.2); ctx.lineTo(q[0], q[1]);
      q = pt(rFim, -0.11, 2.2);   ctx.lineTo(q[0], q[1]);
      q = pt(rGarfo + 6, 0, 0);   ctx.lineTo(q[0], q[1]);
      // braço direito do Y
      q = pt(rFim, 0.11, -2.2);   ctx.lineTo(q[0], q[1]);
      q = pt(rFim, 0.165, 2.2);   ctx.lineTo(q[0], q[1]);
      q = pt(rGarfo, 0, 2.6);     ctx.lineTo(q[0], q[1]);
      q = pt(rCubo, 0, 3.6);      ctx.lineTo(q[0], q[1]);
      ctx.closePath();
      ctx.fillStyle = prata; ctx.fill();
      ctx.strokeStyle = 'rgba(40,44,50,.55)'; ctx.lineWidth = Math.max(.4, .9 * s); ctx.stroke();
      // aresta usinada clara no centro do raio
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = Math.max(.3, .8 * s);
      ctx.beginPath(); q = pt(rCubo + 2, 0, 0); ctx.moveTo(q[0], q[1]);
      q = pt(rGarfo + 2, 0, 0); ctx.lineTo(q[0], q[1]); ctx.stroke();
    }
    // borda do aro (lábio) e flange
    ctx.strokeStyle = '#cfd4d9'; ctx.lineWidth = 4.2 * s;
    ctx.beginPath(); ctx.arc(X, Y, (R_ARO - 2) * s, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1 * s;
    ctx.beginPath(); ctx.arc(X, Y, (R_ARO - 4.4) * s, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = .9 * s;
    ctx.beginPath(); ctx.arc(X, Y, (R_ARO - .4) * s, -2.6, -.9); ctx.stroke();
    // cubo + 5 parafusos + emblema
    const gc = ctx.createRadialGradient(X - 3 * s, Y - 3 * s, 1, X, Y, rCubo * s);
    gc.addColorStop(0, '#eef1f4'); gc.addColorStop(1, '#8e959d');
    ctx.fillStyle = gc;
    ctx.beginPath(); ctx.arc(X, Y, (rCubo + 1) * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b2f35';
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * Math.PI * 2 / 5 + Math.PI / 5;
      ctx.beginPath(); ctx.arc(X + Math.cos(a) * 7.6 * s, Y + Math.sin(a) * 7.6 * s, 1.3 * s, 0, 7); ctx.fill();
    }
    emblema(ctx, X, Y, 4.6 * s);
  }

  /** o emblema redondo da marca (quadrantes azul e branco) */
  function emblema(ctx, X, Y, r) {
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(X, Y, r, 0, 7); ctx.fill();
    const ri = r * .66;
    const q = (a0, cor) => { ctx.fillStyle = cor; ctx.beginPath(); ctx.moveTo(X, Y);
      ctx.arc(X, Y, ri, a0, a0 + Math.PI / 2); ctx.closePath(); ctx.fill(); };
    q(-Math.PI / 2, '#f5f7fa'); q(0, '#2a7ad4'); q(Math.PI / 2, '#f5f7fa'); q(Math.PI, '#2a7ad4');
    ctx.strokeStyle = 'rgba(220,225,230,.8)'; ctx.lineWidth = Math.max(.3, r * .08);
    ctx.beginPath(); ctx.arc(X, Y, r * .98, 0, 7); ctx.stroke();
  }

  function ISO_rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);         ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function linha(ctx, p, pts, cor, larg) {
    ctx.strokeStyle = cor; ctx.lineWidth = Math.max(.35, larg * p.s);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    p.M(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 6) p.C(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], pts[i + 4], pts[i + 5]);
    ctx.stroke();
  }

  /* ---------------- o carro ---------------- */
  /**
   * Desenha o carro com a frente para a esquerda.
   * (ox, oy) = posição na tela do ponto (0, chão); s = px por unidade.
   */
  function carro(ctx, ox, oy, s, corKey) {
    const K = CORES[corKey || corAtual] || CORES.alpine;
    const p = pincel(ctx, ox, oy, s);

    // sombra no chão
    ctx.save();
    const gs = ctx.createRadialGradient(p.X(490), p.Y(0), 10 * s, p.X(490), p.Y(0), 500 * s);
    gs.addColorStop(0, 'rgba(0,0,0,.55)'); gs.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gs;
    ctx.beginPath(); ctx.ellipse(p.X(490), p.Y(4), 500 * s, 16 * s, 0, 0, 7); ctx.fill();
    ctx.restore();

    // interior visto pelas caixas de roda
    ctx.fillStyle = '#060607';
    ctx.beginPath(); ctx.arc(p.X(EIXO_D), p.Y(71), R_CAIXA * s * .98, Math.PI, 0); ctx.fill();
    ctx.beginPath(); ctx.arc(p.X(EIXO_T), p.Y(71), R_CAIXA * s * .98, Math.PI, 0); ctx.fill();

    roda(ctx, p, EIXO_D, true);
    roda(ctx, p, EIXO_T, false);

    /* ---- lataria ---- */
    ctx.save();
    silhueta(ctx, p);
    const g = ctx.createLinearGradient(0, p.Y(320), 0, p.Y(28));
    g.addColorStop(0,    K.luz);
    g.addColorStop(.22,  K.base);
    g.addColorStop(.40,  K.luz);           // linha de ombro pegando luz
    g.addColorStop(.47,  K.base);
    g.addColorStop(.70,  K.sombra);        // reflexo do chão na lateral
    g.addColorStop(.86,  K.base);
    g.addColorStop(1,    K.fundo);
    ctx.fillStyle = g; ctx.fill();
    ctx.clip();

    // reflexo de estúdio: uma faixa clara inclinada ao longo da lateral
    const gr = ctx.createLinearGradient(p.X(120), 0, p.X(980), 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.35, 'rgba(255,255,255,.16)');
    gr.addColorStop(.5, 'rgba(255,255,255,.04)'); gr.addColorStop(.78, 'rgba(255,255,255,.14)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr;
    ctx.beginPath(); p.M(0, 190); p.L(1000, 205); p.L(1000, 170); p.L(0, 150); ctx.closePath(); ctx.fill();

    // saia lateral M: aresta viva + sombra
    ctx.fillStyle = 'rgba(0,0,0,.20)';
    ctx.beginPath(); p.M(250, 30); p.L(720, 30); p.L(720, 50); p.C(560, 52, 400, 52, 250, 50); ctx.closePath(); ctx.fill();
    linha(ctx, p, [262, 52, 420, 54, 600, 54, 712, 52], 'rgba(255,255,255,.18)', 1.1);

    // para-choque M: tomada de ar lateral
    ctx.fillStyle = 'rgba(10,11,13,.85)';
    ctx.beginPath(); p.M(4, 52); p.C(12, 51, 22, 52, 30, 55); p.L(34, 74); p.C(24, 77, 12, 78, 3, 78); ctx.closePath(); ctx.fill();
    // aresta do para-choque e do splitter
    linha(ctx, p, [6, 44, 30, 40, 60, 36, 92, 34], 'rgba(0,0,0,.35)', 1.2);
    linha(ctx, p, [2, 104, 30, 110, 60, 114, 96, 116], 'rgba(255,255,255,.25)', 1.0);
    ctx.restore();

    // contorno fino
    silhueta(ctx, p);
    ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = Math.max(.5, 1.1 * s); ctx.stroke();

    /* ---- vidros (acabamento Shadowline preto do M Sport) ---- */
    vidros(ctx, p);
    ctx.fillStyle = '#0b0d10'; ctx.fill();
    ctx.save();
    vidros(ctx, p); ctx.clip();
    const gv = ctx.createLinearGradient(0, p.Y(305), 0, p.Y(214));
    gv.addColorStop(0, '#2b3440'); gv.addColorStop(.5, '#151a21'); gv.addColorStop(1, '#0d1015');
    ctx.fillStyle = gv;
    ctx.beginPath(); p.M(366, 218); p.C(410, 250, 462, 290, 512, 296); p.C(572, 304, 650, 302, 694, 294);
    p.C(724, 282, 756, 258, 778, 235); p.C(782, 229, 780, 223, 772, 222); p.L(366, 218); ctx.closePath(); ctx.fill();
    // reflexo do céu nos vidros
    ctx.fillStyle = 'rgba(190,210,235,.13)';
    ctx.beginPath(); p.M(420, 300); p.L(470, 300); p.L(420, 214); p.L(380, 214); ctx.closePath(); ctx.fill();
    ctx.beginPath(); p.M(600, 310); p.L(625, 310); p.L(585, 214); p.L(565, 214); ctx.closePath(); ctx.fill();
    ctx.restore();
    // coluna B e divisória do vidro fixo da porta traseira (pretas)
    ctx.fillStyle = '#050607';
    ctx.beginPath(); p.M(548, 215); p.L(562, 215); p.L(566, 306); p.L(552, 306); ctx.closePath(); ctx.fill();
    ctx.beginPath(); p.M(738, 216); p.L(744, 216); p.L(756, 264); p.L(750, 266); ctx.closePath(); ctx.fill();
    // borracha da linha de cintura
    linha(ctx, p, [354, 214, 500, 215, 650, 216, 780, 218], 'rgba(0,0,0,.75)', 2.2);

    /* ---- recortes das portas, capô e tampa ---- */
    const gap = 'rgba(0,0,0,.55)';
    linha(ctx, p, [352, 214, 348, 170, 352, 100, 362, 44], gap, 1.1);           // porta dianteira
    linha(ctx, p, [554, 215, 556, 160, 556, 100, 558, 44], gap, 1.1);           // entre as portas
    linha(ctx, p, [778, 218, 772, 190, 770, 165, 764, 150], gap, 1.1);          // porta traseira
    linha(ctx, p, [764, 150, 742, 128, 714, 100, 710, 46], gap, 1.1);
    linha(ctx, p, [362, 44, 480, 43, 620, 43, 710, 46], gap, 1.0);              // base das portas
    linha(ctx, p, [336, 214, 300, 205, 270, 200, 250, 196], 'rgba(0,0,0,.32)', .9); // linha do capô
    linha(ctx, p, [850, 240, 900, 236, 940, 236, 968, 238], 'rgba(0,0,0,.3)', .8);  // tampa traseira

    /* ---- vincos: linha de ombro e linha baixa ---- */
    linha(ctx, p, [64, 166, 300, 184, 640, 193, 950, 208], 'rgba(255,255,255,.55)', 1.2);
    linha(ctx, p, [64, 163, 300, 180, 640, 189, 950, 204], 'rgba(0,0,0,.22)', 1.6);
    linha(ctx, p, [300, 92, 450, 98, 600, 104, 712, 112], 'rgba(255,255,255,.22)', 1.0);
    linha(ctx, p, [300, 89, 450, 95, 600, 101, 712, 109], 'rgba(0,0,0,.18)', 1.6);

    /* ---- macanetas na cor do carro ---- */
    for (const hx of [478, 690]) {
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ISO_rr(ctx, p.X(hx), p.Y(193), 38 * s, 7 * s, 3 * s); ctx.fill();
      ctx.fillStyle = K.base;
      ISO_rr(ctx, p.X(hx + 1), p.Y(194), 36 * s, 5 * s, 2.5 * s); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.fillRect(p.X(hx + 4), p.Y(194), 28 * s, 1 * s);
    }

    /* ---- tampa do combustível (lado direito do E90) ---- */
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = Math.max(.4, .9 * s);
    ISO_rr(ctx, p.X(822), p.Y(200), 32 * s, 26 * s, 4 * s); ctx.stroke();

    /* ---- retrovisor com seta integrada (novidade do LCI) ---- */
    ctx.beginPath();
    p.M(360, 218); p.C(362, 236, 376, 246, 400, 246); p.C(408, 246, 410, 238, 408, 228);
    p.C(404, 220, 386, 216, 360, 218); ctx.closePath();
    const gm = ctx.createLinearGradient(0, p.Y(248), 0, p.Y(216));
    gm.addColorStop(0, K.luz); gm.addColorStop(1, K.sombra);
    ctx.fillStyle = gm; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = Math.max(.4, .8 * s); ctx.stroke();
    ctx.fillStyle = '#f0a020';
    ctx.beginPath(); p.M(364, 221); p.C(380, 219, 396, 221, 406, 226); p.L(406, 229); p.C(394, 225, 380, 223, 365, 224); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#050607';                                      // base preta (Shadowline)
    ctx.beginPath(); p.M(354, 214); p.L(368, 214); p.L(370, 224); p.L(358, 224); ctx.closePath(); ctx.fill();

    /* ---- farol com "angel eye" ---- */
    ctx.beginPath();
    p.M(10, 140); p.C(18, 150, 34, 158, 54, 163); p.C(74, 166, 92, 166, 104, 163);
    p.C(90, 154, 70, 146, 44, 140); p.C(30, 137, 18, 137, 10, 140); ctx.closePath();
    const gf = ctx.createLinearGradient(p.X(10), 0, p.X(104), 0);
    gf.addColorStop(0, '#dfe8f2'); gf.addColorStop(.6, '#8d99a6'); gf.addColorStop(1, '#4e5864');
    ctx.fillStyle = gf; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = Math.max(.4, .8 * s); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = Math.max(.5, 1.4 * s);
    ctx.beginPath(); ctx.ellipse(p.X(30), p.Y(150), 9 * s, 6 * s, -.2, 0, 7); ctx.stroke();
    // pisca lateral na lente e grade dupla
    ctx.fillStyle = 'rgba(240,160,32,.55)';
    ctx.beginPath(); p.M(80, 162); p.L(102, 163); p.L(92, 156); p.L(72, 154); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c9ced4';
    ctx.fillRect(p.X(0), p.Y(132), 3.2 * s, 22 * s);

    /* ---- lanterna LED em "L" (LCI) ---- */
    ctx.beginPath();
    p.M(938, 236); p.C(956, 239, 970, 240, 977, 240); p.C(990, 235, 997, 224, 999, 208);
    p.L(982, 207); p.C(968, 214, 954, 224, 938, 236); ctx.closePath();
    const gl = ctx.createLinearGradient(p.X(938), 0, p.X(1000), 0);
    gl.addColorStop(0, '#5a0a0e'); gl.addColorStop(.5, '#c4161f'); gl.addColorStop(1, '#ff4d55');
    ctx.fillStyle = gl; ctx.fill();
    ctx.strokeStyle = 'rgba(255,190,190,.65)'; ctx.lineWidth = Math.max(.4, 1 * s);
    ctx.beginPath(); p.M(946, 234); p.C(962, 236, 976, 236, 986, 230); p.L(993, 214); ctx.stroke();
    // refletor no para-choque e ponteira do escape
    ctx.fillStyle = '#8a1016';
    ctx.fillRect(p.X(984), p.Y(92), 14 * s, 6 * s);
    ctx.fillStyle = '#1a1b1d';
    ctx.beginPath(); ctx.ellipse(p.X(968), p.Y(34), 14 * s, 4.5 * s, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#c9ced4'; ctx.lineWidth = Math.max(.4, 1.2 * s); ctx.stroke();

    /* ---- antena barbatana ---- */
    ctx.fillStyle = '#0b0c0e';
    ctx.beginPath(); p.M(676, 311); p.C(684, 324, 696, 326, 704, 320); p.L(708, 309); ctx.closePath(); ctx.fill();

    /* ---- emblema "M" no para-lama dianteiro ---- */
    const mx = p.X(286), my = p.Y(156);
    ctx.fillStyle = '#d6dade';
    ISO_rr(ctx, mx, my, 22 * s, 9 * s, 1.5 * s); ctx.fill();
    ['#5fb3e6', '#1c3f94', '#e2231a'].forEach((c, i) => {
      ctx.fillStyle = c; ctx.fillRect(mx + (1.6 + i * 3) * s, my + 1.6 * s, 2.6 * s, 5.8 * s);
    });
    ctx.fillStyle = '#2b2f35';
    ctx.font = `700 ${Math.max(3, 7.4 * s)}px Arial, sans-serif`;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillText('M', mx + 11 * s, my + 4.8 * s);
  }

  /* ---------------- o quadro completo ---------------- */
  /**
   * Quadro emoldurado: moldura preta, paspatur branco e fotografia de
   * estúdio. (x, y, w, h) é a caixa externa da moldura.
   * opt.legenda = desenha a plaqueta com o nome do carro.
   */
  function quadro(ctx, x, y, w, h, opt = {}) {
    const corKey = opt.cor || corAtual;
    const K = CORES[corKey] || CORES.alpine;
    const m = Math.max(2, Math.min(w, h) * .045);     // moldura
    const pp = Math.max(2, Math.min(w, h) * .07);     // paspatur

    ctx.save();
    // sombra na parede
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ISO_rr(ctx, x + m * .6, y + m * 1.2, w, h, m * .6); ctx.fill();
    // moldura
    const gmo = ctx.createLinearGradient(x, y, x + w, y + h);
    gmo.addColorStop(0, '#2a2d33'); gmo.addColorStop(.5, '#0c0d10'); gmo.addColorStop(1, '#1e2025');
    ctx.fillStyle = gmo;
    ISO_rr(ctx, x, y, w, h, m * .5); ctx.fill();
    // paspatur
    ctx.fillStyle = '#eceae4';
    ctx.fillRect(x + m, y + m, w - 2 * m, h - 2 * m);
    // fotografia
    const fx = x + m + pp, fy = y + m + pp, fw = w - 2 * (m + pp), fh = h - 2 * (m + pp);
    ctx.beginPath(); ctx.rect(fx, fy, fw, fh); ctx.clip();
    const gb = ctx.createLinearGradient(0, fy, 0, fy + fh);
    gb.addColorStop(0, '#2a2f37'); gb.addColorStop(.62, '#14171c'); gb.addColorStop(.63, '#0d0f12'); gb.addColorStop(1, '#060708');
    ctx.fillStyle = gb; ctx.fillRect(fx, fy, fw, fh);
    // luz de estúdio
    const gl = ctx.createRadialGradient(fx + fw * .5, fy + fh * .25, 4, fx + fw * .5, fy + fh * .3, fw * .6);
    gl.addColorStop(0, 'rgba(210,225,245,.30)'); gl.addColorStop(1, 'rgba(210,225,245,0)');
    ctx.fillStyle = gl; ctx.fillRect(fx, fy, fw, fh);

    // carro: o maior que couber, centralizado na foto
    const s = Math.min((fw * .88) / 1000, (fh * .74) / 320);
    const ox = fx + (fw - 1000 * s) / 2, oy = fy + fh * .86;
    // reflexo no piso
    ctx.save();
    ctx.globalAlpha = .16;
    ctx.translate(0, oy * 2); ctx.scale(1, -1);
    carro(ctx, ox, oy, s, corKey);
    ctx.restore();
    const gf = ctx.createLinearGradient(0, oy, 0, fy + fh);
    gf.addColorStop(0, 'rgba(6,7,8,.2)'); gf.addColorStop(1, 'rgba(6,7,8,.95)');
    ctx.fillStyle = gf; ctx.fillRect(fx, oy, fw, fy + fh - oy);
    carro(ctx, ox, oy, s, corKey);

    // assinatura discreta da foto
    if (fw > 160) {
      ctx.font = `600 ${Math.max(4, fh * .05)}px 'Barlow Semi Condensed', sans-serif`;
      ctx.fillStyle = 'rgba(220,226,235,.55)';
      ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('335i · E90 LCI · M SPORT', fx + fw - fw * .03, fy + fh * .09);
    }
    ctx.restore();

    // vidro do quadro: um reflexo diagonal leve
    ctx.save();
    ctx.beginPath(); ctx.rect(x + m, y + m, w - 2 * m, h - 2 * m); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    ctx.beginPath(); ctx.moveTo(x + w * .55, y); ctx.lineTo(x + w * .72, y);
    ctx.lineTo(x + w * .52, y + h); ctx.lineTo(x + w * .35, y + h); ctx.closePath(); ctx.fill();
    ctx.restore();

    if (opt.legenda) {
      const lw = Math.min(w * .5, 260), lh = Math.max(8, h * .085);
      const lx = x + w / 2 - lw / 2, ly = y + h + lh * .5;
      ctx.fillStyle = '#b9a46a';
      ISO_rr(ctx, lx, ly, lw, lh, lh * .2); ctx.fill();
      ctx.fillStyle = '#2a2414';
      ctx.font = `700 ${lh * .52}px 'Barlow Semi Condensed', sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('BMW 335i E90 M SPORT LCI · 2010', lx + lw / 2, ly + lh / 2 + .5);
    }
    void K;
  }

  return { CORES, carro, quadro, emblema,
           get cor() { return corAtual; }, setCor, onCor: f => ouvintes.push(f) };
})();
