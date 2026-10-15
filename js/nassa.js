/* ===========================================================
   nassa.js — a cara da Nassa Tech e o prédio em volta do andar

   • cores da marca (tiradas do logo) e o LED que corre nas paredes
   • céu e vista de São Paulo pelas janelas, conforme a hora do dia
   =========================================================== */
const NASSA = (() => {

  /* ---------------- marca ---------------- */
  const COR = {
    fundo:  '#05070d',
    branco: '#f2f6ff',
    ciano:  '#00b3ff',
    azul:   '#2f5bff',
    aco:    '#a9b4c6'
  };

  const E = () => window.ESCRITORIO || {};

  function mix(a, b, f) {
    const na = parseInt(a.slice(1), 16), nb = parseInt(b.slice(1), 16);
    const ch = (n, s) => (n >> s) & 255;
    const m = s => Math.round(ch(na, s) + (ch(nb, s) - ch(na, s)) * f);
    return '#' + [m(16), m(8), m(0)].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  /** LED da marca: oscila entre o ciano e o azul do logo, e passa um
      "pulso" branco de vez em quando, como um deploy atravessando o andar */
  function led(t, k) {
    const f = (Math.sin(t * 1.1 + k * 0.32) + 1) / 2;
    let c = mix(COR.ciano, COR.azul, f);
    const pulso = Math.max(0, Math.sin(t * 0.9 - k * 0.22)) ** 24;
    if (pulso > 0.02) c = mix(c, '#e8f6ff', pulso * 0.8);
    return c;
  }

  /* imagens do logo (PNG) */
  const logo = new Image();  logo.src  = 'assets/nassatech-logo-transparente.png?v=20261015d';
  const icone = new Image(); icone.src = 'assets/nassatech-icone.png?v=20261015d';
  const pronto = img => img.complete && img.naturalWidth > 0;

  /* ---------------- hora do dia ---------------- */
  /** 0 = dia claro, 1 = noite fechada; o pôr do sol fica no meio */
  function noite(d = new Date()) {
    const h = d.getHours() + d.getMinutes() / 60;
    if (h >= 7.5 && h <= 16.5) return 0;
    if (h > 16.5 && h < 19.2) return (h - 16.5) / 2.7;
    if (h >= 5.2 && h < 7.5) return 1 - (h - 5.2) / 2.3;
    return 1;
  }
  function ceu(n) {
    // dia: azul paulistano meio enevoado · fim de tarde: laranja · noite: azul-marinho
    const tarde = n > 0 && n < 1 ? Math.sin(n * Math.PI) : 0;
    const topo = mix(mix('#5f8fc4', '#0a1226', n), '#5b4a7a', tarde * .35);
    const meio = mix(mix('#9cbad6', '#14213d', n), '#c9785a', tarde * .55);
    const base = mix(mix('#d5dde2', '#24304f', n), '#f0a35e', tarde * .7);
    return { topo, meio, base, tarde };
  }

  /* gerador estável: a mesma cidade sempre no mesmo lugar */
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
  }

  /* ---------------- vista pelas janelas ---------------- */
  const cachePan = new Map();
  /**
   * Faixa panorâmica para a fachada de vidro.
   * lado 'n' = Faria Lima / Itaim · lado 'w' = Rio Pinheiros e Ponte Estaiada.
   */
  function panorama(lado, len, h) {
    const n = noite();
    const balde = Math.round(n * 12);
    const k = lado + '|' + len + '|' + h + '|' + balde;
    let cv = cachePan.get(k);
    if (cv) return cv;
    if (cachePan.size > 8) cachePan.clear();

    const ESC = 2;
    cv = document.createElement('canvas');
    cv.width = Math.ceil(len * ESC); cv.height = Math.ceil(h * ESC);
    const c = cv.getContext('2d');
    c.scale(ESC, ESC);
    const C = ceu(n);
    const hor = h * 0.5;                              // linha do horizonte

    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, C.topo); g.addColorStop(.42, C.meio); g.addColorStop(.62, C.base); g.addColorStop(1, mix(C.base, '#0b0f18', .55));
    c.fillStyle = g; c.fillRect(0, 0, len, h);

    // estrelas à noite / sol no fim da tarde
    const R = rng(lado === 'n' ? 9127 : 4411);
    if (n > .6) {
      c.fillStyle = `rgba(255,255,255,${(n - .6) * 1.2})`;
      for (let i = 0; i < len / 9; i++) c.fillRect(R() * len, R() * hor * .7, .8, .8);
    }
    if (C.tarde > .2 && lado === 'w') {
      const sx = len * .62, sy = hor - 6;
      const gs = c.createRadialGradient(sx, sy, 2, sx, sy, 70);
      gs.addColorStop(0, 'rgba(255,214,150,.95)'); gs.addColorStop(.15, 'rgba(255,170,90,.55)'); gs.addColorStop(1, 'rgba(255,140,80,0)');
      c.fillStyle = gs; c.fillRect(sx - 70, sy - 70, 140, 140);
    }

    // camada distante: serra e prédios esfumaçados
    c.fillStyle = mix(C.base, '#56627a', .35 + n * .3);
    c.beginPath(); c.moveTo(0, hor + 4);
    for (let x = 0; x <= len; x += 6) c.lineTo(x, hor + 4 - 6 * Math.sin(x * .011 + 1) - 4 * Math.sin(x * .037));
    c.lineTo(len, h); c.lineTo(0, h); c.closePath(); c.fill();
    for (let x = 0; x < len;) {
      const w = 6 + R() * 14, alt = 6 + R() * 22;
      c.fillStyle = mix(C.base, '#4a5570', .45 + n * .35);
      c.fillRect(x, hor + 6 - alt, w, alt + 40);
      x += w + R() * 3;
    }

    // Ponte Estaiada (Octavio Frias de Oliveira) sobre o Pinheiros, do lado oeste
    if (lado === 'w') {
      const px = len * .34, base = hor + 22, topo = hor - 42;
      c.strokeStyle = n > .5 ? 'rgba(255,255,255,.9)' : '#e9eef3';
      c.lineWidth = 2.2;
      // mastro em "X": duas pernas inclinadas que se cruzam
      c.beginPath(); c.moveTo(px - 10, base); c.lineTo(px + 6, topo); c.stroke();
      c.beginPath(); c.moveTo(px + 10, base); c.lineTo(px - 6, topo); c.stroke();
      // estais em leque para os dois tabuleiros curvos
      c.lineWidth = .55;
      c.strokeStyle = n > .5 ? 'rgba(200,230,255,.75)' : 'rgba(235,240,245,.85)';
      for (let i = 0; i < 9; i++) {
        const z = topo + 6 + i * 3.4;
        c.beginPath(); c.moveTo(px, z); c.lineTo(px - 26 - i * 9, base - 2 + i * .4); c.stroke();
        c.beginPath(); c.moveTo(px, z); c.lineTo(px + 26 + i * 9, base - 2 + i * .4); c.stroke();
      }
      c.strokeStyle = n > .5 ? '#9fb6d6' : '#c7ced6'; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(px - 120, base + 4); c.quadraticCurveTo(px, base - 6, px + 120, base + 4); c.stroke();
      if (n > .5) {                                // iluminação colorida da ponte à noite
        const gl = c.createRadialGradient(px, topo + 20, 2, px, topo + 20, 48);
        gl.addColorStop(0, 'rgba(0,179,255,.45)'); gl.addColorStop(1, 'rgba(0,179,255,0)');
        c.fillStyle = gl; c.fillRect(px - 50, topo - 30, 100, 100);
      }
      // o rio
      c.fillStyle = n > .5 ? 'rgba(40,70,110,.6)' : 'rgba(120,150,170,.55)';
      c.fillRect(0, base + 4, len, 3);
    }

    // camada do meio: as torres de vidro da Faria Lima e do Itaim
    const corTorre = mix('#3d4b60', '#0d1320', n);
    for (let x = -10; x < len;) {
      const w = 14 + R() * 26, alt = 18 + R() * (lado === 'n' ? 46 : 30);
      const y0 = hor + 26 - alt;
      const vidro = c.createLinearGradient(x, 0, x + w, 0);
      vidro.addColorStop(0, mix(corTorre, C.meio, .35 - n * .25));
      vidro.addColorStop(1, mix(corTorre, '#000000', .2));
      c.fillStyle = vidro;
      c.fillRect(x, y0, w, h - y0);
      // janelas: grade fina de dia, acesas à noite
      for (let yy = y0 + 3; yy < h; yy += 3.2) {
        for (let xx = x + 2; xx < x + w - 2; xx += 3) {
          if (n > .35) {
            if (R() < .38) { c.fillStyle = `rgba(255,${200 + R() * 40 | 0},${130 + R() * 60 | 0},${.35 + n * .5})`; c.fillRect(xx, yy, 1.6, 1.4); }
          } else if (R() < .25) { c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(xx, yy, 1.6, 1.2); }
        }
      }
      // heliponto e luz de obstáculo (São Paulo tem helicóptero em todo topo)
      if (R() < .5) {
        c.fillStyle = mix(corTorre, '#ffffff', .15); c.fillRect(x + w * .2, y0 - 2, w * .6, 2);
        c.fillStyle = '#ff3b3b'; c.fillRect(x + w / 2 - .7, y0 - 4, 1.4, 1.4);
      }
      x += w + 2 + R() * 10;
    }
    // névoa perto do chão
    const gn = c.createLinearGradient(0, hor, 0, h);
    gn.addColorStop(0, 'rgba(0,0,0,0)'); gn.addColorStop(1, n > .5 ? 'rgba(5,8,16,.55)' : 'rgba(210,220,230,.25)');
    c.fillStyle = gn; c.fillRect(0, hor, len, h - hor);

    cachePan.set(k, cv);
    return cv;
  }

  /* ---------------- fundo da tela (o céu em volta do andar) ---------------- */
  let cacheFundo = null;
  function fundo(ctx, w, h) {
    const n = noite();
    const k = w + 'x' + h + '|' + Math.round(n * 12);
    if (!cacheFundo || cacheFundo.k !== k) {
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, w); cv.height = Math.max(1, h);
      const c = cv.getContext('2d');
      const C = ceu(n);
      const escuro = .62;                       // o painel é escuro: o céu entra apagado
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, mix(C.topo, '#05070d', escuro));
      g.addColorStop(.55, mix(C.meio, '#05070d', escuro + .05));
      g.addColorStop(1, mix(C.base, '#05070d', escuro + .1));
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      // silhueta da cidade bem lá embaixo
      const R = rng(777);
      for (let x = -20; x < w;) {
        const bw = 18 + R() * 50, alt = 20 + R() * h * .12;
        c.fillStyle = mix('#0a0e19', C.meio, .16);
        c.fillRect(x, h - alt, bw, alt);
        if (n > .4) for (let yy = h - alt + 6; yy < h; yy += 7) for (let xx = x + 4; xx < x + bw - 4; xx += 6)
          if (R() < .22) { c.fillStyle = `rgba(255,214,150,${.10 + n * .18})`; c.fillRect(xx, yy, 2, 2); }
        x += bw + R() * 8;
      }
      const gv = c.createRadialGradient(w / 2, h * .45, 40, w / 2, h * .45, Math.max(w, h) * .75);
      gv.addColorStop(0, 'rgba(0,179,255,.07)'); gv.addColorStop(.6, 'rgba(0,0,0,0)'); gv.addColorStop(1, 'rgba(0,0,0,.55)');
      c.fillStyle = gv; c.fillRect(0, 0, w, h);
      cacheFundo = { k, cv };
    }
    ctx.drawImage(cacheFundo.cv, 0, 0, w, h);
  }

  return { COR, mix, led, logo, icone, pronto, noite, ceu, panorama, fundo };
})();
