/* ===========================================================
   decor-salas.js — detalhes das salas dos devs, de reunião, de jogos e da recepção

   Usa a extensão do furniture.js: FURN.registrar({ tipo(ctx, o, t) {…} })
   para um desenho novo e FURN.add({ t: 'tipo', x, y, … }) + FURN.block()
   para pôr a peça no andar. Carrega depois do furniture.js e antes do
   app.js, que monta a lista de desenho.

   Tudo aqui é parado e vai para FURN.emCache (cache em níveis de
   resolução, com a caixa justa da peça): o custo por quadro é um
   drawImage por peça, ou por tira nas peças compridas.
   =========================================================== */
(() => {
  const S = ISO.toScreen;
  const add = FURN.add, block = FURN.block;

  /* ---------- utilitários ---------- */

  /** sorteio estável: a mesma peça sai sempre igual */
  function sorteio(seed) {
    let s = (seed * 9301 + 49297) % 233280;
    return () => (s = (s * 9301 + 49297) % 233280) / 233280;
  }

  const faceY = FURN.faceY, faceX = FURN.faceX;   // faces +y e +x, em px

  /** caixa com as três cores na mão: topo, face +y (esq.) e face +x (dir.) */
  function caixa(ctx, x, y, w, d, h, z, topo, esq, dir, linha) {
    ISO.box(ctx, x, y, w, d, h, z, esq, { top: topo, left: esq, right: dir, line: linha || 'rgba(0,0,0,.24)' });
  }

  /** folha lanceolada: da base (bx, by) até a ponta (tx, ty), em px de tela */
  function folha(ctx, bx, by, tx, ty, larg, cor) {
    const mx = (bx + tx) / 2, my = (by + ty) / 2;
    const dx = tx - bx, dy = ty - by, L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L * larg, ny = dx / L * larg;
    ctx.fillStyle = cor;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(mx + nx, my + ny, tx, ty);
    ctx.quadraticCurveTo(mx - nx, my - ny, bx, by);
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,40,24,.35)'; ctx.lineWidth = .5;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(mx + (tx - mx) * .8, my + (ty - my) * .8); ctx.stroke();
  }

  const VERDES = ['#3e7a4b', '#4b8a55', '#5a9c62', '#356b41', '#6aa86c', '#447f4e'];

  /** tufo de folhas compridas saindo de um ponto (px de tela) */
  function tufo(ctx, bx, by, alt, abre, n, rnd, larg = 2.2) {
    for (let i = 0; i < n; i++) {
      const f = n === 1 ? 0 : i / (n - 1) - .5;
      const ang = f * abre + (rnd() - .5) * .35;
      const h = alt * (.7 + rnd() * .35) * (1 - Math.abs(f) * .35);
      const tx = bx + Math.sin(ang) * h * .9, ty = by - Math.cos(ang) * h;
      folha(ctx, bx, by, tx, ty, larg * (.8 + rnd() * .4), VERDES[(i + (rnd() * 6 | 0)) % VERDES.length]);
    }
  }

  /** peça comprida encostada numa parede: vira tiras de ~1 tile, cada uma
      com a sua profundidade (senão quem passa na frente da ponta é coberto
      por ela, ou a parede de trás pinta por cima). Todas as tiras copiam o
      mesmo cache, cada uma a sua faixa vertical da tela.
      o.eixo 'x': corre ao longo de x (parede norte); 'y': ao longo de y (oeste) */
  function encostar(o, bloqueia = true) {
    const peca = {}, eixo = o.eixo;
    const comp = eixo === 'x' ? o.w : o.d;
    const n = Math.max(1, Math.round(comp));
    for (let i = 0; i < n; i++) {
      const a = (eixo === 'x' ? o.x : o.y) + comp * i / n;
      const b = (eixo === 'x' ? o.x : o.y) + comp * (i + 1) / n;
      // "frente" pode vir na peça: o logo no vidro entra logo depois da sua
      // parede e antes do balcão da recepção, que fica na frente dele
      const frente = o.frente !== undefined ? o.frente : (eixo === 'x' ? o.y + o.d : o.x + o.w) + .45;
      const dk = a + frente;
      add(Object.assign({}, o, { peca, tira: [a, b, i === 0, i === n - 1], dk }));
    }
    if (bloqueia) block(o.x, o.y, o.w, o.d);
  }

  /** desenha a peça (inteira ou só a tira dela) pelo cache em níveis */
  function emCache(ctx, o, pinta, alto, margem, ver) {
    const op = { alto, margem, ver, chave: o.peca || o };
    if (o.tira) {
      const [a, b, primeira, ultima] = o.tira;
      const ehX = o.eixo === 'x';
      const xc = o.x + o.w / 2, yc = o.y + o.d / 2;
      const p = v => ehX ? S(v, yc).x : S(xc, v).x;
      // em x a tela cresce com a; em y ela decresce
      const L = ehX ? (primeira ? -Infinity : p(a)) : (ultima ? -Infinity : p(b));
      const R = ehX ? (ultima ? Infinity : p(b)) : (primeira ? Infinity : p(a));
      op.faixa = [L, R];
    }
    FURN.emCache(ctx, o, pinta, op);
  }

  /* ===========================================================
     SALA DOS DEVS
     =========================================================== */

  /* ---------- jardineira com painel acústico, entre as fileiras ----------
     Floreira baixa de aço grafite com borda de carvalho, um painel de
     feltro no meio (abafa a conversa de uma fileira para a outra) e
     folhagem dos dois lados. Fica atrás dos monitores da fileira da
     frente: o que aparece é o feltro e o verde por cima das telas.     */
  function jardineira(ctx, o) {
    const { x, y, w, d } = o;
    const rnd = sorteio(Math.round(x * 7));
    ISO.plane(ctx, x + .02, y + .05, w, d, .3, 'rgba(0,0,0,.26)');
    caixa(ctx, x, y, w, d, 17, 0, '#1f1712', '#30343b', '#23262c');
    // folhagem de trás do feltro: só as pontas aparecem
    for (let u = .25; u < w - .1; u += .42) {
      const b = S(x + u, y + d * .25, 17);
      tufo(ctx, b.x, b.y, 18, 1.4, 4, rnd, 2);
    }
    // painel de feltro com a régua de alumínio em cima, na altura de um
    // biombo de bancada: as telas da fileira de trás aparecem por cima
    // dele, e de longe ele não vira uma parede cinza
    const yp = y + d * .42, hp = 26, zp = 17 + hp;
    caixa(ctx, x + .1, yp, w - .2, .07, hp, 17, '#525861', '#40464f', '#343940');
    faceY(ctx, x + .1, yp + .07, w - .2, zp, (c, len) => {
      c.fillStyle = 'rgba(0,0,0,.10)';
      for (let i = 5; i < len - 2; i += 6) c.fillRect(i, 1, .7, hp - 1);
      c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(0, 0, len, 1);
    });
    caixa(ctx, x + .08, yp - .01, w - .16, .09, 1.2, zp, '#b9c0c8', '#9aa1aa', '#7d848d', 'rgba(0,0,0,.2)');
    // folhagem da frente, transbordando a borda
    for (let u = .18; u < w - .1; u += .3) {
      const b = S(x + u, y + d * .78, 17);
      tufo(ctx, b.x, b.y, 17 + rnd() * 9, 1.8, 5, rnd, 2.3);
    }
    // borda de carvalho na frente
    caixa(ctx, x - .02, y + d - .06, w + .04, .08, 1.8, 16.2, '#c8ab84', '#a98a63', '#8c6f4e', 'rgba(60,40,20,.3)');
    // jiboia caindo pela borda
    for (let u = .3; u < w; u += .55 + rnd() * .3) {
      const b = S(x + u, y + d, 17);
      for (let k = 0; k < 3; k++) {
        const px = b.x + (rnd() - .5) * 5, py = b.y + 2 + k * 3.2;
        ctx.fillStyle = VERDES[(k + (u * 10 | 0)) % VERDES.length];
        ctx.beginPath(); ctx.ellipse(px, py, 2.1, 1.5, rnd() - .5, 0, 7); ctx.fill();
      }
    }
  }

  /* ---------- ponto de café, encostado na divisória oeste ----------
     Armário baixo de carvalho com tampo de quartzo, espresso, moedor,
     xícaras, jarra de água filtrada e a fruteira. A frente olha para +x. */
  function copa(ctx, o) {
    const { x, y, w, d } = o;
    const Z = 34;
    ISO.plane(ctx, x, y, w + .05, d + .05, .3, 'rgba(0,0,0,.25)');
    caixa(ctx, x, y, w - .05, d, 3, 0, '#15171b', '#15171b', '#101114');               // rodapé recuado
    caixa(ctx, x, y, w, d, Z - 3 - 3, 3, '#b49674', '#a98a63', '#8f7353');
    // portas: frisos verticais e puxadores pretos
    faceX(ctx, x + w, y, d, Z - 3, (c, len) => {
      const n = 4, pw = len / n;
      for (let i = 0; i < n; i++) {
        c.fillStyle = 'rgba(40,25,12,.35)'; c.fillRect(i * pw, 0, .9, Z - 6);
        c.fillStyle = 'rgba(255,240,220,.07)'; c.fillRect(i * pw + 1, 0, pw - 2, 1);
        c.fillStyle = '#1b1c1f'; c.fillRect(i * pw + (i % 2 ? 2.5 : pw - 4), 3, 1.3, 7);
      }
    });
    faceY(ctx, x, y + d, w, Z - 3, (c, len) => {
      c.fillStyle = 'rgba(40,25,12,.25)'; c.fillRect(0, 0, len, .8);
    });
    // tampo de quartzo
    caixa(ctx, x - .03, y - .03, w + .06, d + .06, 3, Z - 3, '#ecebe7', '#d8d5ce', '#c3bfb6', 'rgba(0,0,0,.18)');

    /* em cima, do fundo (y menor) para a frente */
    // espresso: corpo inox, grupo e bandeja virados para a sala
    const ex = x + .12, ey = y + .22;
    caixa(ctx, ex, ey, .5, .62, 20, Z, '#d5dae0', '#8f969f', '#aab1ba');
    caixa(ctx, ex, ey, .5, .62, 2.5, Z + 20, '#3a3e45', '#2a2d33', '#32363c');
    faceX(ctx, ex + .5, ey, .62, Z + 19, (c, len) => {
      c.fillStyle = '#1d2026'; c.fillRect(len * .2, 2, len * .6, 5);                    // visor
      c.fillStyle = '#00b3ff'; c.fillRect(len * .27, 3.6, 3, 1.4);
      c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(len * .45, 3.8, 6, .8);
    });
    caixa(ctx, ex + .5, ey + .17, .12, .28, 3, Z + 10, '#3a3e45', '#24272c', '#2e3237');   // grupo
    caixa(ctx, ex + .5, ey + .1, .16, .42, 1.2, Z + .5, '#2a2d33', '#1d2025', '#25282d');  // bandeja
    ISO.cyl(ctx, ex + .58, ey + .31, .045, 4, Z + 1.7, '#f3f1ec');                       // xícara
    // moedor
    ISO.cyl(ctx, x + .38, y + 1.15, .09, 13, Z, '#24262b');
    ISO.cyl(ctx, x + .38, y + 1.15, .065, 3, Z + 13, '#5a3a26');
    FURN.vidro(ctx, x + .38, y + 1.15, .075, 6, Z + 13, 0, '220,200,180');
    // xícaras empilhadas e pires
    ISO.cyl(ctx, x + .42, y + 1.55, .1, 1, Z, '#e9e6df');
    for (let i = 0; i < 3; i++) ISO.cyl(ctx, x + .42, y + 1.55, .065, 3.2, Z + 1 + i * 3.4, '#f4f2ed');
    // jarra de água filtrada
    FURN.vidro(ctx, x + .4, y + 2.05, .09, 15, Z, .6);
    ISO.cyl(ctx, x + .4, y + 2.05, .092, 2.2, Z + 15, '#2c3037');
    // fruteira com laranjas e maçãs verdes
    ISO.cyl(ctx, x + .42, y + 2.6, .2, 3, Z, '#2b2e33');
    const pf = S(x + .42, y + 2.6, Z + 3);
    [[-4, -1, '#e08a2e'], [2, -1.6, '#7fb04a'], [-.5, -3.2, '#e8962f'], [4.2, .4, '#d9822a'], [-3, 1, '#8dbb55']]
      .forEach(([dx, dy, cor]) => {
        ctx.fillStyle = cor; ctx.beginPath(); ctx.arc(pf.x + dx, pf.y + dy - 1.4, 2.4, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.arc(pf.x + dx - .8, pf.y + dy - 2.3, .8, 0, 7); ctx.fill();
      });
  }

  /* ---------- multifuncional ---------- */
  function impressora(ctx, o) {
    const { x, y, w, d } = o;
    ISO.plane(ctx, x, y, w + .04, d + .04, .3, 'rgba(0,0,0,.26)');
    // gabinete das bandejas de papel
    caixa(ctx, x + .02, y + .02, w - .04, d - .04, 24, 0, '#e3e5e8', '#c9ccd1', '#b4b8be');
    faceX(ctx, x + w - .02, y + .02, d - .04, 24, (c, len) => {
      for (let i = 0; i < 3; i++) {
        c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(1, 1 + i * 7.6, len - 2, .8);
        c.fillStyle = '#5c6169'; c.fillRect(len / 2 - 5, 3.5 + i * 7.6, 10, 1.4);
      }
    });
    // corpo da impressora, com a saída de papel
    caixa(ctx, x, y, w, d, 13, 24, '#eef0f2', '#d6d9dd', '#c2c6cc');
    faceX(ctx, x + w, y, d, 37, (c, len) => {
      c.fillStyle = '#2b2e34'; c.fillRect(len * .15, 3, len * .7, 4);
      c.fillStyle = '#f7f7f5'; c.fillRect(len * .2, 5.6, len * .6, 1.2);                 // folhas saindo
    });
    // tampa do scanner, escura
    caixa(ctx, x - .01, y - .01, w + .02, d + .02, 2.6, 37, '#3a3e45', '#2b2e34', '#24272c');
    // painel de toque inclinado no canto da frente
    const a = S(x + w - .05, y + d - .4, 41), b = S(x + w - .05, y + d - .05, 41);
    const c2 = S(x + w + .06, y + d - .05, 37.5), d2 = S(x + w + .06, y + d - .4, 37.5);
    ISO.quad(ctx, [a, b, c2, d2], '#1b1e23', 'rgba(0,0,0,.4)');
    ctx.fillStyle = 'rgba(0,179,255,.8)';
    ctx.beginPath(); ctx.arc((a.x + c2.x) / 2, (a.y + c2.y) / 2, .9, 0, 7); ctx.fill();
  }

  /* ---------- armários com fechadura digital ----------
     Carcaça grafite, portas de carvalho em três alturas, puxador preto e
     o teclado da fechadura com o LED. Em cima, uma jiboia num vaso.   */
  function armarios(ctx, o) {
    const { x, y, w, d } = o;
    const H = 72;
    ISO.plane(ctx, x, y, w + .05, d + .05, .3, 'rgba(0,0,0,.28)');
    caixa(ctx, x, y, w - .04, d, 3, 0, '#15171b', '#15171b', '#101114');
    caixa(ctx, x, y, w, d, H - 3, 3, '#3a3e45', '#2e3238', '#2a2d33');
    const col = Math.round(d / .9), linhas = 3;
    faceX(ctx, x + w, y, d, H, (c, len) => {
      const pw = len / col, ph = (H - 5) / linhas;
      for (let i = 0; i < col; i++) for (let j = 0; j < linhas; j++) {
        const u = i * pw + 1, v = 1 + j * ph;
        c.fillStyle = (i + j) % 2 ? '#a88a64' : '#ad8f69'; c.fillRect(u, v, pw - 2, ph - 1.6);
        c.fillStyle = 'rgba(255,240,215,.08)'; c.fillRect(u, v, pw - 2, .8);
        c.fillStyle = '#16171a'; c.fillRect(u + pw - 6, v + ph / 2 - 3, 1.2, 6);           // puxador
        c.fillStyle = '#1f2227'; c.fillRect(u + 2.5, v + 3, 4.5, 3);                       // fechadura
        c.fillStyle = (i * 3 + j) % 5 === 1 ? '#f2b84b' : '#3fb950'; c.fillRect(u + 5.4, v + 3.6, .9, .9);
      }
    });
    faceY(ctx, x, y + d, w, H, (c, len) => {
      c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, 0, len, 1);
    });
    caixa(ctx, x - .02, y - .02, w + .04, d + .04, 1.6, H, '#4a4f57', '#33373d', '#2c3035');
    // jiboia num vaso branco em cima, perto da ponta sul
    const vx = x + w / 2, vy = y + d - .45;
    ISO.cyl(ctx, vx, vy, .13, 8, H + 1.6, '#e9e6df');
    const rnd = sorteio(11);
    const b = S(vx, vy, H + 9.6);
    tufo(ctx, b.x, b.y, 10, 2.4, 6, rnd, 2.4);
    for (let k = 0; k < 6; k++) {                     // ramos caindo pela lateral
      const px = b.x + 3 + k * .9, py = b.y + 3 + k * 4.2;
      ctx.fillStyle = VERDES[k % VERDES.length];
      ctx.beginPath(); ctx.ellipse(px, py, 2.2, 1.5, .4, 0, 7); ctx.fill();
    }
  }

  /* ---------- quadro branco com rodinhas: o kanban da sprint ---------- */
  const fonteOk = FURN.fonteCarregada;      // o texto repinta quando a fonte chega

  function quadroKanban(ctx, o) {
    const { x, y, w, d } = o;
    const z0 = 30, z1 = 92;
    ISO.shadow(ctx, x + w / 2, y + d / 2, .8, .16);
    // pés em T com rodízios e as duas colunas
    for (const u of [.12, w - .16]) {
      caixa(ctx, x + u - .06, y - .15, .16, d + .3, 2, 2.2, '#9aa1aa', '#7d848d', '#6c737c');
      for (const v of [-.13, d + .11]) {
        const p = S(x + u + .02, y + v, 0);
        ctx.fillStyle = '#16181c'; ctx.beginPath(); ctx.arc(p.x, p.y - 1.2, 1.4, 0, 7); ctx.fill();
      }
      caixa(ctx, x + u, y + d / 2 - .03, .05, .06, z1 + 2 - 4, 4, '#c3c9d1', '#a5acb5', '#8d949d');
    }
    // moldura de alumínio e a lousa
    caixa(ctx, x, y, w, d, z1 - z0, z0, '#cfd4da', '#b3b9c1', '#9aa1aa');
    faceY(ctx, x + .03, y + d, w - .06, z1 - 1, (c, len) => {
      const H = z1 - z0 - 2;
      c.fillStyle = '#f4f5f3'; c.fillRect(0, 0, len, H);
      c.fillStyle = 'rgba(160,190,220,.10)';                                     // reflexo
      c.beginPath(); c.moveTo(len * .55, 0); c.lineTo(len * .8, 0); c.lineTo(len * .5, H); c.lineTo(len * .25, H); c.fill();
      const cols = ['A FAZER', 'FAZENDO', 'FEITO'], cw = len / 3;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = "700 4.6px 'Barlow Semi Condensed', sans-serif";
      c.fillStyle = '#26303c';
      c.fillText('SPRINT 42', len / 2, 4.2);
      c.strokeStyle = 'rgba(40,52,66,.55)'; c.lineWidth = .5;
      c.beginPath(); c.moveTo(4, 7.6); c.lineTo(len - 4, 7.6); c.stroke();
      const notas = ['#f3d97a', '#f4b3c0', '#9fd9ee', '#b5dea6'];
      const qtd = [4, 3, 5];
      for (let i = 0; i < 3; i++) {
        c.fillStyle = '#4a5866'; c.font = "700 3.6px 'Barlow Semi Condensed', sans-serif";
        c.fillText(cols[i], cw * i + cw / 2, 10.6);
        if (i) { c.beginPath(); c.moveTo(cw * i, 8.6); c.lineTo(cw * i, H - 3); c.stroke(); }
        for (let k = 0; k < qtd[i]; k++) {
          const nx = cw * i + 3 + (k % 2) * (cw / 2 - 1), ny = 14 + Math.floor(k / 2) * 9.5;
          c.fillStyle = 'rgba(0,0,0,.08)'; c.fillRect(nx + .5, ny + .6, cw / 2 - 3.4, 8);
          c.fillStyle = notas[(i * 2 + k) % notas.length]; c.fillRect(nx, ny, cw / 2 - 3.4, 8);
          c.fillStyle = 'rgba(40,40,50,.45)';
          c.fillRect(nx + 1.2, ny + 2.2, cw / 2 - 7, .55); c.fillRect(nx + 1.2, ny + 4.2, cw / 2 - 9.5, .55);
        }
      }
      // gráfico de burndown rabiscado no canto
      c.strokeStyle = '#2f5bff'; c.lineWidth = .7;
      c.beginPath(); c.moveTo(cw * 2 + 4, H - 6); c.lineTo(cw * 2 + 9, H - 9); c.lineTo(cw * 2 + 14, H - 10); c.lineTo(cw * 2 + 20, H - 14); c.stroke();
    });
    // calha das canetas
    caixa(ctx, x + .1, y + d, w - .2, .1, 1.4, z0 + 1, '#c3c9d1', '#a5acb5', '#8d949d');
    ISO.cyl(ctx, x + .5, y + d + .05, .025, 1.2, z0 + 2.4, '#2f5bff');
    ISO.cyl(ctx, x + .62, y + d + .05, .025, 1.2, z0 + 2.4, '#1b1c1f');
  }

  /* ---------- planta alta em vaso grande ----------
     k 0: costela-de-adão (folhas largas recortadas); 1: palmeira areca;
     2: figueira-lira (tronco fino e folhas redondas no alto).          */
  function plantaAlta(ctx, o) {
    const { x, y, w, d } = o;
    const cx = x + w / 2, cy = y + d / 2;
    const rnd = sorteio(Math.round(x * 13 + y * 7));
    ISO.shadow(ctx, cx, cy, .42, .3);
    const vaso = o.vaso || '#2b2e34';
    ISO.cyl(ctx, cx, cy, .3, 24, 0, vaso);
    ISO.cyl(ctx, cx, cy, .31, 2, 22, ISO.shade(vaso, .12));
    ISO.cyl(ctx, cx, cy, .26, .5, 23.6, '#2a1d14');
    const b = S(cx, cy, 24);
    if (o.k === 1) {
      // areca: vários caules finos em leque com folíolos
      for (let i = 0; i < 9; i++) {
        const ang = (i / 8 - .5) * 1.9 + (rnd() - .5) * .2;
        const h = 58 + rnd() * 26;
        const tx = b.x + Math.sin(ang) * h * .55, ty = b.y - Math.cos(ang * .7) * h;
        ctx.strokeStyle = '#5c7a3c'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.quadraticCurveTo(b.x + Math.sin(ang) * h * .2, ty + h * .3, tx, ty); ctx.stroke();
        for (let k = 2; k < 9; k++) {
          const f = k / 9, px = b.x + (tx - b.x) * f, py = b.y + (ty - b.y) * f - Math.sin(f * 3) * 3;
          const lado = Math.sign(ang || .1);
          folha(ctx, px, py, px + lado * (5 + rnd() * 3), py + 4 + rnd() * 2, 1.1, VERDES[(i + k) % VERDES.length]);
          folha(ctx, px, py, px - lado * (4 + rnd() * 2), py + 3 + rnd() * 2, 1, VERDES[(i + k + 2) % VERDES.length]);
        }
      }
      return;
    }
    if (o.k === 2) {
      // figueira-lira: tronco e folhas redondas e grandes, de baixo para cima
      ctx.strokeStyle = '#5a4030'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.quadraticCurveTo(b.x - 2, b.y - 30, b.x + 1, b.y - 62); ctx.stroke();
      const fol = [];
      for (let i = 0; i < 16; i++) {
        const hy = 28 + i * 3.4 + rnd() * 3;
        const lado = i % 2 ? 1 : -1;
        fol.push([b.x + lado * (4 + rnd() * 9), b.y - hy, 5.2 + rnd() * 1.6, lado * (.5 + rnd() * .5), VERDES[i % VERDES.length]]);
      }
      fol.sort((p, q) => q[1] - p[1]);
      for (const [px, py, r, rot, cor] of fol) {
        ctx.fillStyle = cor; ctx.beginPath(); ctx.ellipse(px, py, r, r * .78, rot, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(20,40,24,.35)'; ctx.lineWidth = .5;
        ctx.beginPath(); ctx.moveTo(px - Math.cos(rot) * r * .8, py - Math.sin(rot) * r * .8);
        ctx.lineTo(px + Math.cos(rot) * r * .8, py + Math.sin(rot) * r * .8); ctx.stroke();
      }
      return;
    }
    // costela-de-adão: hastes e folhas largas com recortes
    const fol = [];
    for (let i = 0; i < 9; i++) {
      const ang = (i / 8 - .5) * 2.4 + (rnd() - .5) * .3;
      const h = 30 + rnd() * 34;
      fol.push([ang, h]);
    }
    fol.sort((p, q) => q[1] - p[1]);
    for (const [ang, h] of fol) {
      const tx = b.x + Math.sin(ang) * h * .75, ty = b.y - Math.cos(ang * .8) * h;
      ctx.strokeStyle = '#4c7a45'; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.quadraticCurveTo(b.x + Math.sin(ang) * h * .3, ty + 8, tx, ty); ctx.stroke();
      const r = 8 + rnd() * 3;
      const cor = VERDES[(Math.abs(ang * 10) | 0) % VERDES.length];
      ctx.save(); ctx.translate(tx, ty); ctx.rotate(ang * .6);
      ctx.fillStyle = cor;
      ctx.beginPath(); ctx.ellipse(0, -r * .35, r, r * .72, 0, 0, 7); ctx.fill();
      // recortes da folha
      ctx.strokeStyle = 'rgba(14,20,18,.85)'; ctx.lineWidth = .9;
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
        ctx.beginPath(); ctx.moveTo(s * r * (.35 + k * .2), -r * .35 - r * .25 + k * r * .25); ctx.lineTo(s * r * 1.02, -r * .45 + k * r * .3); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(20,40,24,.4)'; ctx.lineWidth = .6;
      ctx.beginPath(); ctx.moveTo(0, r * .3); ctx.lineTo(0, -r); ctx.stroke();
      ctx.restore();
    }
  }

  /* ===========================================================
     SALA DE REUNIÃO
     =========================================================== */
  const NOG = '#5b3a23', NOG_TOPO = '#73492b', NOG_E = '#4f3320', NOG_D = '#3d2616', LATAO = '#c2a35e';

  /* ---------- aparador de nogueira com água e café ---------- */
  function aparadorReuniao(ctx, o) {
    const { x, y, w, d } = o;
    const Z = 30;
    ISO.plane(ctx, x, y, w + .04, d + .06, .3, 'rgba(0,0,0,.26)');
    caixa(ctx, x + .04, y + .04, w - .08, d - .08, 3, 0, '#141518', '#141518', '#101114');
    caixa(ctx, x, y, w, d, Z - 5, 3, NOG_TOPO, NOG_E, NOG_D, 'rgba(30,18,10,.4)');
    // três portas ripadas com puxador de latão
    faceY(ctx, x, y + d, w, Z - 2, (c, len) => {
      const n = 3, pw = len / n, H = Z - 5;
      for (let i = 0; i < n; i++) {
        for (let k = 2.5; k < pw - 1.5; k += 2.6) {
          c.fillStyle = 'rgba(20,10,4,.32)'; c.fillRect(i * pw + k, 1, .6, H - 2);
          c.fillStyle = 'rgba(255,220,180,.06)'; c.fillRect(i * pw + k + .7, 1, .8, H - 2);
        }
        c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(i * pw, 0, .8, H);
        c.fillStyle = LATAO; c.fillRect(i * pw + pw / 2 - 3, 4, 6, 1);
      }
    });
    caixa(ctx, x - .02, y - .02, w + .04, d + .04, 2, Z - 2, '#7a4f30', NOG_E, NOG_D, 'rgba(30,18,10,.4)');
    // bandeja com jarra e copos
    caixa(ctx, x + .2, y + .14, .95, .42, .8, Z, '#2a2420', '#211c18', '#1a1613');
    FURN.vidro(ctx, x + .42, y + .34, .1, 13, Z + .8, .65);
    FURN.vidro(ctx, x + .42, y + .34, .05, 3, Z + 13.8);                    // gargalo
    for (const [gx, gy] of [[.72, .26], [.94, .26], [.72, .46], [.94, .46]])
      FURN.vidro(ctx, x + gx, y + gy, .06, 6, Z + .8);
    // garrafa térmica de café e as xícaras nos pires
    ISO.cyl(ctx, x + 1.5, y + .34, .11, 17, Z, '#25282d');
    ISO.cyl(ctx, x + 1.5, y + .34, .085, 3.5, Z + 17, '#3a3e45');
    ISO.box(ctx, x + 1.58, y + .3, .12, .05, 1.6, Z + 18.5, '#1b1c1f');
    for (const [cx, cy] of [[1.86, .26], [1.86, .5], [2.1, .38]]) {
      ISO.cyl(ctx, x + cx, y + cy, .1, .7, Z, '#ecebe6');
      ISO.cyl(ctx, x + cx, y + cy, .055, 3.6, Z + .7, '#f6f5f1');
    }
    FURN.orquidea(ctx, x + w - .42, y + .36, Z, 1.05);
  }

  /* ---------- quadro de vidro com o fluxo da Nassa ----------
     Vidro pintado de branco por trás, em pé sobre dois postes de
     alumínio. A face escrita olha para +x (para a mesa). Em vez de uma
     arquitetura genérica, o caminho de um projeto pelos sistemas do time,
     a pincel: o lead chega pelo site (com o agente de IA atendendo), vira
     proposta no CRM e projeto no gestor, passa pelo design, pela API e
     pelo app, pelo QA e sai no deploy. Embaixo de cada sistema, quem
     cuida dele: o nome vem do ROSTER (renomeou na ficha, muda aqui), e
     sistema sem ninguém contratado aparece como vaga.
     São oito caixas em duas linhas que fazem um "S" (a de baixo volta da
     direita para a esquerda): com o rótulo grande, lê no zoom 1,2; nomes,
     setas e post-its são o detalhe de quem chega perto.               */
  const FLUXO = [
    { id: 'ia',     rot: 'IA',        quem: ['ia'],               lin: 0, col: 0, tracejada: true },
    { id: 'site',   rot: 'SITE',      quem: ['frontend'],         lin: 0, col: 1 },
    { id: 'crm',    rot: 'CRM',       quem: ['comercial'],        lin: 0, col: 2 },
    { id: 'proj',   rot: 'PROJETO',   quem: ['fullstack'],        lin: 0, col: 3 },
    { id: 'design', rot: 'DESIGN',    quem: ['design'],           lin: 1, col: 3 },
    { id: 'apiapp', rot: 'API + APP', quem: ['backend', 'mobile'], lin: 1, col: 2 },
    { id: 'qa',     rot: 'QA',        quem: ['qa'],               lin: 1, col: 1 },
    { id: 'deploy', rot: 'DEPLOY',    quem: ['devops'],           lin: 1, col: 0 }
  ];
  const SETAS = [
    ['ia', 'site', 'atende', { tracejada: true, cor: 'roxo' }],
    ['site', 'crm', 'lead'], ['crm', 'proj', 'fechou'], ['proj', 'design', 'escopo'],
    ['design', 'apiapp', 'telas'], ['apiapp', 'qa', 'build'], ['qa', 'deploy', 'ok!', { cor: 'vermelho' }]
  ];
  const MARC = { preto: '#252a33', azul: '#2349c4', vermelho: '#cf3a3a', verde: '#1d9257', roxo: '#6a48d6' };
  const MARCADOR = "'Caveat', 'Barlow Semi Condensed', sans-serif";
  const EST_Q = 1.35;          // como no telão: devolve na largura o que a parede encolhe

  /* A letra de pincel é a Caveat, do mesmo Google Fonts da Barlow. Ela só
     serve a este quadro, então vem daqui e não do index.html; até chegar
     (ou se não chegar), a Barlow segura, e o quadro repinta uma vez. */
  let marcador = 0;
  try {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&display=swap';
    const pronto = () => { marcador = 1; };
    l.onload = () => document.fonts.load("700 12px 'Caveat'").then(pronto, pronto);
    l.onerror = pronto;
    document.head.appendChild(l);
  } catch (e) { marcador = 1; }

  /** quem cuida de cada sistema, pelo ROSTER; muda a versão do cache */
  let nomesFluxo = null, nomesEm = -1e9;
  function quemCuida() {
    const agora = performance.now();
    if (nomesFluxo && agora - nomesEm < 1500) return nomesFluxo;
    nomesEm = agora;
    const time = typeof ROSTER !== 'undefined' ? ROSTER.all() : [];
    const nome = k => { const a = time.find(a => a.key === k); return a ? a.name : null; };
    const r = {};
    for (const b of FLUXO) r[b.id] = b.quem.map(nome).filter(Boolean).join(' · ');
    r.v = JSON.stringify(r);
    return (nomesFluxo = r);
  }
  const versaoQuadro = () => fonteOk() + marcador * 2 + '|' + quemCuida().v;

  /** traço de pincel: passa pelos pontos com um leve tremor e ponta redonda */
  function pincel(c, pts, cor, lw, rnd, curva = .6) {
    c.strokeStyle = cor; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      const [a, b] = pts[i - 1], [x, y] = pts[i];
      const dx = x - a, dy = y - b, L = Math.hypot(dx, dy) || 1, k = (rnd() - .5) * curva;
      c.quadraticCurveTo((a + x) / 2 - dy / L * k, (b + y) / 2 + dx / L * k, x, y);
    }
    c.stroke();
  }

  /** caixa a pincel: quatro lados meio tortos, e o fim passa um pouco do começo */
  function caixaPincel(c, u, v, w, h, cor, rnd, tracejada) {
    const j = () => (rnd() - .5) * .9;
    const p = [[u + j(), v + j()], [u + w + j(), v + j()], [u + w + j(), v + h + j()], [u + j(), v + h + j()]];
    if (tracejada) c.setLineDash([2.2, 1.6]);
    pincel(c, [...p, [p[0][0] + 2.2, p[0][1] - .3]], cor, .8, rnd, .8);
    c.setLineDash([]);
  }

  /** escrita esticada na largura, um tiquinho torta */
  function escrita(c, s, u, v, px, cor, alinha = 'center', rot = 0, peso = 700) {
    c.save(); c.translate(u, v); c.rotate(rot); c.scale(EST_Q, 1);
    c.font = `${peso} ${px}px ${MARCADOR}`; c.fillStyle = cor;
    c.textAlign = alinha; c.textBaseline = 'middle'; c.fillText(s, 0, 0);
    c.restore();
  }
  /** tamanho que faz o texto caber na largura (a Caveat é mais estreita que a Barlow) */
  function cabeQ(c, s, px, max, peso = 700) {
    c.font = `${peso} ${px}px ${MARCADOR}`;
    const w = c.measureText(s).width * EST_Q;
    return w > max ? px * max / w : px;
  }

  /** seta a pincel de a para b, com duas farpas na ponta e o rótulo em cima */
  function setaPincel(c, a, b, rot, op, rnd) {
    const cor = MARC[op.cor || 'azul'];
    if (op.tracejada) c.setLineDash([2, 1.6]);
    pincel(c, [a, b], cor, .75, rnd, 1.2);
    c.setLineDash([]);
    const an = Math.atan2(b[1] - a[1], b[0] - a[0]), f = 2.8;
    pincel(c, [[b[0] - Math.cos(an - .5) * f, b[1] - Math.sin(an - .5) * f], b,
               [b[0] - Math.cos(an + .5) * f, b[1] - Math.sin(an + .5) * f]], cor, .75, rnd, .2);
    if (rot) {
      // na horizontal o rótulo vai em cima da seta; na vertical, à esquerda dela
      const vert = Math.abs(b[0] - a[0]) < 1;
      escrita(c, rot, (a[0] + b[0]) / 2 - (vert ? 2.6 : 0), (a[1] + b[1]) / 2 - (vert ? 0 : 3.4),
              cabeQ(c, rot, 5.4, vert ? 24 : Math.abs(b[0] - a[0]) + 4, 600), cor, vert ? 'right' : 'center', (rnd() - .5) * .08, 600);
    }
  }

  /** post-it colado meio torto, com duas linhas a caneta */
  function postit(c, u, v, cor, linhas, rot) {
    c.save(); c.translate(u, v); c.rotate(rot);
    const w = 30, h = 16;
    c.fillStyle = 'rgba(0,0,0,.09)'; c.fillRect(.7, .9, w, h);
    c.fillStyle = cor; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(0,0,0,.06)'; c.fillRect(0, 0, w, 2.2);          // a faixa de cola
    linhas.forEach((l, i) => {
      c.save(); c.translate(w / 2, 6 + i * 5.6); c.scale(EST_Q * .82, 1);
      c.font = `700 ${cabeQ(c, l, 5.4, (w - 3) / .82)}px ${MARCADOR}`;
      c.fillStyle = '#2b2f38'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(l, 0, 0);
      c.restore();
    });
    c.restore();
  }

  function fluxoNoQuadro(c, len, H) {
    const rnd = sorteio(42), nomes = quemCuida();
    // título com o sublinhado de pincel
    escrita(c, 'DO LEAD AO DEPLOY', 8, 9.5, 8.6, MARC.azul, 'left', -.012);
    pincel(c, [[8, 15], [44, 14.6], [79, 15.3]], ISO.rgba(MARC.azul, .8), .7, rnd, 1);
    // post-its no canto de cima, longe das caixas
    postit(c, len - 72, 2.5, '#f6dc79', ['lead novo:', 'resposta em 1 h'], -.05);
    postit(c, len - 37, 3.6, '#a8dcf0', ['deploy só', 'com QA ok'], .06);

    // grade: quatro colunas, duas linhas
    const u0 = 7, BW = 35, BH = 17, gap = (len - 2 * u0 - 4 * BW) / 3;
    const caixaDe = b => ({ u: u0 + b.col * (BW + gap), v: b.lin ? 51 : 24 });
    const pos = {};
    for (const b of FLUXO) pos[b.id] = caixaDe(b);
    for (const b of FLUXO) {
      const { u, v } = pos[b.id], cor = b.tracejada ? MARC.roxo : MARC.preto;
      caixaPincel(c, u, v, BW, BH, cor, rnd, b.tracejada);
      escrita(c, b.rot, u + BW / 2, v + 6.6, cabeQ(c, b.rot, 8.4, BW - 7), cor, 'center', (rnd() - .5) * .05);
      const n = nomes[b.id];
      escrita(c, n || 'vaga aberta', u + BW / 2, v + 13, cabeQ(c, n || 'vaga aberta', 5.6, BW - 6, 600),
              n ? MARC.azul : MARC.vermelho, 'center', 0, 600);
    }
    // no ar: o visto verde no canto do deploy
    const d = pos.deploy;
    pincel(c, [[d.u + BW - 6, d.v + 1.2], [d.u + BW - 3.6, d.v + 3.6], [d.u + BW + 1.5, d.v - 3.5]], MARC.verde, 1.1, rnd, .3);

    // setas: na mesma linha, de borda a borda; entre linhas, descendo
    for (const [de, para, rot, op = {}] of SETAS) {
      const A = pos[de], B = pos[para];
      let a, b;
      if (A.v === B.v) {
        const dir = B.u > A.u ? 1 : -1, vm = A.v + BH / 2 + (rnd() - .5) * .8;
        a = [dir > 0 ? A.u + BW + 1.2 : A.u - 1.2, vm];
        b = [dir > 0 ? B.u - 1.4 : B.u + BW + 1.4, vm + (rnd() - .5) * .8];
      } else {
        const um = A.u + BW / 2;
        a = [um, A.v + BH + 1.2]; b = [um + .4, B.v - 1.4];
      }
      setaPincel(c, a, b, rot, op, rnd);
    }
  }

  function quadroVidro(ctx, o) {
    const { x, y, w, d } = o;
    const z0 = 22, z1 = 96;
    const ALU = ['#c3c9d1', '#a5acb5', '#8d949d'];
    ISO.shadow(ctx, x + w / 2, y + d / 2, .9, .14);
    const pes = [y + .28, y + d - .28];
    for (const py of pes) {
      caixa(ctx, x - .16, py - .05, .48, .1, 1.6, 0, ...ALU);
      caixa(ctx, x + .05, py - .025, .05, .05, z1 + 2 - 1.6, 1.6, ...ALU);
    }
    caixa(ctx, x, y, .06, d, z1 - z0, z0, '#dfe8e6', '#cfdcd9', '#e9eeed', 'rgba(120,140,140,.35)');
    faceX(ctx, x + .06, y, d, z1, (c, len) => {
      const H = z1 - z0;
      c.fillStyle = '#f4f6f5'; c.fillRect(1, 1, len - 2, H - 2);
      // marca de apagador de reuniões passadas e o reflexo do vidro
      c.fillStyle = 'rgba(120,130,150,.05)';
      c.beginPath(); c.ellipse(len * .3, H * .78, 26, 6, -.08, 0, 7); c.fill();
      c.fillStyle = 'rgba(150,180,210,.11)';
      c.beginPath(); c.moveTo(len * .6, 1); c.lineTo(len * .7, 1); c.lineTo(len * .5, H - 1); c.lineTo(len * .4, H - 1); c.fill();
      fluxoNoQuadro(c, len, H);
    });
    // calha das canetas: azul, vermelha, verde e o apagador
    caixa(ctx, x + .06, y + .3, .08, d - .6, 1.4, z0 + 1, ...ALU);
    ISO.cyl(ctx, x + .1, y + 1.0, .025, 1.2, z0 + 2.4, MARC.azul);
    ISO.cyl(ctx, x + .1, y + 1.12, .025, 1.2, z0 + 2.4, MARC.vermelho);
    ISO.cyl(ctx, x + .1, y + 1.24, .025, 1.2, z0 + 2.4, MARC.verde);
    caixa(ctx, x + .07, y + 1.9, .07, .34, 2.4, z0 + 2.4, '#2b2e34', '#3a3e45', '#1e2025');
  }

  /* ===========================================================
     RECEPÇÃO E CIRCULAÇÃO
     =========================================================== */

  /* ---------- o logo jateado no vidro atrás do balcão ---------- */
  function marcaVidro(ctx, o) {
    WORLD.wallFace(ctx, 'n', o.x, 18, o.w, WORLD.WALL_H, (c, len) => {
      const v0 = WORLD.WALL_H - 98, v1 = WORLD.WALL_H - 60;
      c.fillStyle = 'rgba(232,240,250,.15)'; c.fillRect(4, v0, len - 8, v1 - v0);
      c.fillStyle = 'rgba(255,255,255,.26)';
      c.fillRect(4, v0, len - 8, .8); c.fillRect(4, v1 - .8, len - 8, .8);
      const im = NASSA.logo;
      if (NASSA.pronto(im)) {
        const k = Math.min((len - 70) / im.naturalWidth, 22 / im.naturalHeight);
        const lw = im.naturalWidth * k, lh = im.naturalHeight * k;
        c.drawImage(im, (len - lw) / 2, (v0 + v1) / 2 - lh / 2, lw, lh);
      }
    });
  }

  /* ---------- sofá da espera, de couro caramelo como as poltronas do chefe ---------- */
  function sofaEspera(ctx, o) {
    const base = Object.assign({}, o);
    delete base.tira; delete base.camada; delete base.fatia;
    FURN.desenho.sofa(ctx, base);
    // duas almofadas de linho encostadas no encosto
    const { x, y } = o;
    for (const [u, cor] of [[.62, '#cdc2ad'], [o.w - 1.02, '#3e5f68']]) {
      const yy = y + .5;
      const a = S(x + u, yy, 31), b = S(x + u + .4, yy, 31), c = S(x + u + .42, yy - .06, 45), e = S(x + u - .02, yy - .06, 45);
      ctx.fillStyle = ISO.shade(cor, -.18);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x + .5, c.y + .5); ctx.lineTo(e.x, e.y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = cor;
      ctx.beginPath(); ctx.moveTo(a.x + .8, a.y - 1); ctx.quadraticCurveTo((a.x + b.x) / 2, a.y - 2, b.x - .8, b.y - 1);
      ctx.quadraticCurveTo(b.x + 1, (b.y + c.y) / 2, c.x - .5, c.y + 1);
      ctx.quadraticCurveTo((c.x + e.x) / 2, c.y - 1, e.x + .8, e.y + 1);
      ctx.quadraticCurveTo(e.x - 1, (e.y + a.y) / 2, a.x + .8, a.y - 1); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = .5; ctx.stroke();
    }
  }

  /* ---------- mesinha lateral de mármore com livros e um vaso ---------- */
  function mesaLateral(ctx, o) {
    const cx = o.x + o.w / 2, cy = o.y + o.d / 2;
    ISO.shadow(ctx, cx, cy, .32, .22);
    ISO.cyl(ctx, cx, cy, .2, 1.2, 0, '#1d1f23');
    ISO.cyl(ctx, cx, cy, .04, 19, 1.2, '#2a2d33');
    ISO.cyl(ctx, cx, cy, .28, 1.8, 20, '#e4e1da');
    caixa(ctx, cx - .2, cy - .14, .32, .24, 1.6, 21.8, '#2a3a52', '#22314a', '#1c2a40');
    caixa(ctx, cx - .17, cy - .12, .27, .2, 1.4, 23.4, '#e8e1d0', '#d9d1bf', '#c9c0ac');
    ISO.cyl(ctx, cx + .12, cy + .08, .05, 9, 21.8, '#2b2e34');
    const b = S(cx + .12, cy + .08, 30.8);
    ctx.strokeStyle = '#5a7a4a'; ctx.lineWidth = .6;
    for (const [dx, dy] of [[-3, -9], [1, -11], [3.4, -8]]) {
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.quadraticCurveTo(b.x + dx * .3, b.y + dy * .6, b.x + dx, b.y + dy); ctx.stroke();
      ctx.fillStyle = '#6e9a5c'; ctx.beginPath(); ctx.ellipse(b.x + dx, b.y + dy, 1.4, .9, dx * .2, 0, 7); ctx.fill();
    }
  }

  /* ---------- placa bandeira na porta de cada sala ----------
     Chapa grafite perpendicular à parede, acima da cabeça de quem passa,
     com o nome da sala. A face lida é a +x, que a câmera enxerga.       */
  function placaPorta(ctx, o) {
    const { x, y, d } = o;
    const z0 = 74, z1 = 92;
    // braço que prende a placa na parede, pelo alto
    const yb = o.lado === 'n' ? y : y + d - .08;
    caixa(ctx, x, yb, .05, .08, 2, z1 - 3, '#5a606a', '#454a52', '#3a3e45');
    caixa(ctx, x, y + .04, .05, d - .08, z1 - z0 - 3, z0, '#2a2d33', '#1d2026', '#23262c', 'rgba(0,0,0,.4)');
    faceX(ctx, x + .05, y + .04, d - .08, z1 - 3, (c, len) => {
      const H = z1 - z0 - 3;
      c.fillStyle = '#1b1e24'; c.fillRect(0, 0, len, H);
      c.fillStyle = '#00b3ff'; c.fillRect(2.5, 2.2, 2.2, H - 4.4);
      c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillStyle = 'rgba(170,182,200,.85)';
      c.font = "600 3.4px 'Barlow Semi Condensed', sans-serif";
      c.fillText('SALA', 7, 4.6);
      c.fillStyle = '#eef2f7';
      let f = 6.6;
      c.font = `700 ${f}px 'Barlow Semi Condensed', sans-serif`;
      const larg = len - 9;
      const mw = c.measureText(o.nome).width;
      if (mw > larg) { f *= larg / mw; c.font = `700 ${f.toFixed(2)}px 'Barlow Semi Condensed', sans-serif`; }
      c.fillText(o.nome, 7, 10.4);
    });
  }

    FURN.registrar({
    jardineira(ctx, o)   { emCache(ctx, o, jardineira, 46, 6); },
    copa(ctx, o)         { emCache(ctx, o, copa, 58, 6); },
    impressora(ctx, o)   { emCache(ctx, o, impressora, 44, 5); },
    armarios(ctx, o)     { emCache(ctx, o, armarios, 96, 6); },
    quadroKanban(ctx, o) { emCache(ctx, o, quadroKanban, 96, 8, fonteOk); },
    plantaAlta(ctx, o)   { emCache(ctx, o, plantaAlta, o.k === 1 ? 112 : 96, 34); },
    aparadorReuniao(ctx, o) { emCache(ctx, o, aparadorReuniao, 56, 6); },
    quadroVidro(ctx, o)  { emCache(ctx, o, quadroVidro, 100, 8, versaoQuadro); },
    marcaVidro(ctx, o)   { emCache(ctx, o, marcaVidro, WORLD.WALL_H, 4, () => NASSA.pronto(NASSA.logo) ? 1 : 0); },
    sofaEspera(ctx, o)   { emCache(ctx, o, sofaEspera, 54, 6); },
    mesaLateral(ctx, o)  { emCache(ctx, o, mesaLateral, 40, 6); },
    placaPorta(ctx, o)   { emCache(ctx, o, placaPorta, 96, 4, fonteOk); }
  });

  /* ===========================================================
     LAYOUT
     =========================================================== */

  /* ---------- sala dos devs ---------- */
  // jardineira com feltro na "espinha" entre as fileiras, uma por coluna de
  // mesas: fica na faixa de y 10 (a das mesas de trás), então o corredor
  // de y 11 continua livre
  [21, 25, 29, 33, 37, 41].forEach(x => {
    add({ t: 'jardineira', x: x + .12, y: 10.27, w: 2.76, d: .64 });
    block(x + .12, 10.27, 2.76, .64);
  });
  // ponto de café e multifuncional ao norte da porta do hall (x 18, y 8–9)
  encostar({ t: 'copa', x: 19.1, y: 1.3, w: .82, d: 3.0, eixo: 'y' });
  add({ t: 'impressora', x: 19.12, y: 4.75, w: .8, d: 1.0 });  block(19.12, 4.75, .8, 1.0);
  // armários ao sul da porta
  encostar({ t: 'armarios', x: 19.1, y: 10.35, w: .74, d: 3.6, eixo: 'y' });
  // kanban na ponta leste do corredor entre as fileiras. Mais para dentro
  // da sala: colado na parede leste, a régua do alto do vidro passava por
  // cima da lousa
  add({ t: 'quadroKanban', x: 43.15, y: 11.06, w: 1.6, d: .14 });  block(43.15, 11.06, 1.6, .14);
  // plantas altas nos vãos entre os painéis da parede de vidro e nos cantos
  // (no sul o parapeito de 40 px esconderia o vaso: só a areca do canto
  // sudoeste, que é alta e fina, fica bem vista pelo vidro)
  [[29.55, 1.3, 0], [39.55, 1.3, 1], [45.6, 1.3, 2], [19.25, 16.15, 1]]
    .forEach(([x, y, k]) => { add({ t: 'plantaAlta', x, y, w: .9, d: .9, k }); block(x, y, .9, .9); });

  /* ---------- sala de reunião ---------- */
  // aparador na parede norte, à direita do telão. A figueira fica do lado
  // oeste: no canto leste, colada no vidro, a régua de LED do alto da
  // parede passava na frente das folhas e ela parecia presa numa caixa
  encostar({ t: 'aparadorReuniao', x: 42.45, y: 23.14, w: 3.3, d: .7, eixo: 'x' });
  // um pouco ao sul do quadro, para as folhas não taparem o começo do fluxo
  add({ t: 'plantaAlta', x: 33.1, y: 27.5, w: .9, d: .9, k: 2 });  block(33.1, 27.5, .9, .9);
  // quadro de vidro no lado oeste, de frente para a mesa: mais largo e
  // mais alto que antes, para o fluxo dos sistemas caber com letra grande
  encostar({ t: 'quadroVidro', x: 33.1, y: 23.35, w: .1, d: 3.1, eixo: 'y' });

  /* ---------- hall entre a sala do chefe e a dos devs ---------- */
  add({ t: 'plantaAlta', x: 15.55, y: 1.2, w: .9, d: .9, k: 1 });  block(15.55, 1.2, .9, .9);

  /* ---------- recepção e espera, junto dos elevadores ---------- */
  // o logo vai no vidro da divisória dos devs (parede de y 18): não ocupa piso
  encostar({ t: 'marcaVidro', x: 41.3, y: 18.9, w: 4.4, d: .1, eixo: 'x', frente: 19.1 }, false);
  add({ t: 'plantaAlta', x: 37.1, y: 19.05, w: .9, d: .9, k: 1 });  block(37.1, 19.05, .9, .9);
  encostar({ t: 'sofaEspera', x: 38.15, y: 19.03, w: 2.55, d: .95, dir: 'n', c: '#6a4229', eixo: 'x' });
  add({ t: 'mesaLateral', x: 40.95, y: 19.22, w: .6, d: .6 });  block(40.95, 19.22, .6, .6);

  /* ---------- placas nas portas ----------
     Do lado norte do corredor a placa sai da parede de y 18 para o sul;
     do lado sul, sai da parede de y 22 para o norte. Fica a 74–92 px:
     ninguém tropeça nela, então não bloqueia o piso.                  */
  [['CHEFE', 4.95, 'n'], ['DEVS', 29.95, 'n'], ['JOGOS', 12.95, 's'], ['JOGOS', 23.95, 's'], ['REUNIÃO', 34.95, 's']]
    .forEach(([nome, x, lado]) => {
      const y = lado === 'n' ? 19.0 : 21.38;
      add({ t: 'placaPorta', nome, lado, x, y, w: .05, d: .62,
            dk: lado === 'n' ? x + 19.55 : x + 21.95 });
    });
})();
