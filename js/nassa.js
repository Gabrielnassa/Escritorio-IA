/* ===========================================================
   nassa.js — a cara da Nassa Tech e o prédio em volta do andar

   • cores da marca (tiradas do logo) e o LED que corre nas paredes
   • céu e vista de São Paulo pelas janelas, conforme a hora do dia
   • fachada da torre na Faria Lima, com a praça e a escultura da
     baleia, para a tela de entrada
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

  /* ---------------- a torre, vista da Faria Lima ---------------- */
  /**
   * SVG da fachada para a tela de entrada: a torre de vidro, o prédio
   * baixo do teatro, a praça aberta com a escultura da baleia e a
   * avenida com a ciclovia vermelha. O andar da Nassa Tech fica aceso.
   */
  function predioSVG() {
    const n = noite();
    const C = ceu(n);
    const andares = 24;
    const andar = Math.max(2, Math.min(andares, Number(E().andar) || 18));
    const W = 1200, H = 760, chao = 600;
    const tx = 560, tw = 300, ttop = 70, alturaAndar = (chao - 40 - ttop) / andares;
    const R = rng(32);
    let s = '';
    s += `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMax slice" role="img" aria-label="Torre de vidro na Faria Lima com a escultura da baleia na praça">`;
    s += `<defs>
      <linearGradient id="pc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.topo}"/><stop offset=".6" stop-color="${C.meio}"/><stop offset="1" stop-color="${C.base}"/></linearGradient>
      <linearGradient id="pv" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${mix('#7f9bb8', '#1a2740', n)}"/><stop offset=".45" stop-color="${mix('#b9cde0', '#2a3d5c', n)}"/><stop offset=".55" stop-color="${mix('#6f88a3', '#16233a', n)}"/><stop offset="1" stop-color="${mix('#4d6580', '#0c1424', n)}"/></linearGradient>
      <linearGradient id="pl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${mix('#3f5670', '#0b1220', n)}"/><stop offset="1" stop-color="${mix('#2c3e55', '#070c16', n)}"/></linearGradient>
      <linearGradient id="pb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f7fa"/><stop offset=".35" stop-color="#aeb8c3"/><stop offset=".6" stop-color="#e6ebf0"/><stop offset="1" stop-color="#7d8895"/></linearGradient>
      <linearGradient id="pa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix('#9aa3ab', '#22262e', n)}"/><stop offset="1" stop-color="${mix('#6d757d', '#111318', n)}"/></linearGradient>
      <radialGradient id="pg" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#00b3ff" stop-opacity=".55"/><stop offset="1" stop-color="#00b3ff" stop-opacity="0"/></radialGradient>
    </defs>`;
    s += `<rect width="${W}" height="${H}" fill="url(#pc)"/>`;
    // cidade ao fundo
    for (let x = -20; x < W;) {
      const w = 40 + R() * 70, a = 120 + R() * 260;
      s += `<rect x="${x.toFixed(1)}" y="${(chao - a).toFixed(1)}" width="${w.toFixed(1)}" height="${a.toFixed(1)}" fill="${mix(C.meio, '#2b3647', .5 + n * .3)}" opacity=".75"/>`;
      if (n > .4) for (let yy = chao - a + 10; yy < chao - 10; yy += 14) for (let xx = x + 6; xx < x + w - 6; xx += 10)
        if (R() < .3) s += `<rect x="${xx.toFixed(1)}" y="${yy.toFixed(1)}" width="4" height="5" fill="#ffd79a" opacity="${(.35 + n * .4).toFixed(2)}"/>`;
      x += w + R() * 20;
    }
    // torre: pano de vidro contínuo, com marcação de laje a cada andar
    s += `<rect x="${tx + tw}" y="${ttop + 18}" width="70" height="${chao - ttop - 18}" fill="url(#pl)"/>`;
    s += `<polygon points="${tx + tw},${ttop + 18} ${tx + tw + 70},${ttop + 36} ${tx + tw + 70},${chao} ${tx + tw},${chao}" fill="url(#pl)"/>`;
    s += `<rect x="${tx}" y="${ttop}" width="${tw}" height="${chao - ttop}" fill="url(#pv)"/>`;
    for (let i = 0; i <= andares; i++) {
      const y = ttop + 14 + i * alturaAndar;
      s += `<line x1="${tx}" y1="${y.toFixed(1)}" x2="${tx + tw}" y2="${y.toFixed(1)}" stroke="${mix('#dbe6f0', '#3a4b66', n)}" stroke-width="1.2" opacity=".55"/>`;
      s += `<line x1="${tx + tw}" y1="${(y + 1).toFixed(1)}" x2="${tx + tw + 70}" y2="${(y + 19 - 18 * i / andares).toFixed(1)}" stroke="#000" stroke-width="1" opacity=".2"/>`;
    }
    for (let x = tx + 15; x < tx + tw; x += 15)
      s += `<line x1="${x}" y1="${ttop}" x2="${x}" y2="${chao}" stroke="${mix('#e8f0f7', '#22314a', n)}" stroke-width=".7" opacity=".35"/>`;
    // janelas acesas à noite
    if (n > .3) for (let i = 0; i < andares; i++) for (let x = tx + 2; x < tx + tw - 4; x += 15)
      if (R() < .45) s += `<rect x="${x + 1}" y="${(ttop + 16 + i * alturaAndar).toFixed(1)}" width="12" height="${(alturaAndar - 4).toFixed(1)}" fill="#ffe2ad" opacity="${(n * .45).toFixed(2)}"/>`;
    // reflexo diagonal do vidro
    s += `<polygon points="${tx + 40},${ttop} ${tx + 120},${ttop} ${tx + 10},${chao} ${tx - 70 < tx ? tx : tx},${chao}" fill="#fff" opacity="${(.12 - n * .08).toFixed(2)}"/>`;
    // o andar da Nassa Tech
    const ay = ttop + 14 + (andares - andar) * alturaAndar;
    s += `<rect x="${tx - 30}" y="${(ay - 30).toFixed(1)}" width="${tw + 60}" height="${(alturaAndar + 60).toFixed(1)}" fill="url(#pg)"/>`;
    s += `<rect class="andar-nassa" x="${tx}" y="${ay.toFixed(1)}" width="${tw}" height="${alturaAndar.toFixed(1)}" fill="#00b3ff" opacity=".85"/>`;
    s += `<text x="${tx + tw / 2}" y="${(ay + alturaAndar / 2 + 5).toFixed(1)}" text-anchor="middle" fill="#ffffff" font-family="Barlow, sans-serif" font-weight="700" font-size="14" letter-spacing="3">NASSA TECH · ${andar}º</text>`;
    // coroa: terraço com pérgola
    s += `<rect x="${tx - 6}" y="${ttop - 10}" width="${tw + 12}" height="12" fill="${mix('#c9d3dc', '#2a3445', n)}"/>`;
    for (let x = tx; x < tx + tw; x += 20) s += `<rect x="${x}" y="${ttop - 26}" width="3" height="16" fill="${mix('#b4bec8', '#26303f', n)}"/>`;
    s += `<rect x="${tx}" y="${ttop - 28}" width="${tw}" height="4" fill="${mix('#c9d3dc', '#2a3445', n)}"/>`;
    s += `<circle cx="${tx + tw - 20}" cy="${ttop - 34}" r="3" fill="#ff3b3b"><animate attributeName="opacity" values="1;.15;1" dur="1.6s" repeatCount="indefinite"/></circle>`;
    // prédio baixo (teatro) com teto verde
    s += `<rect x="180" y="455" width="330" height="${chao - 455}" fill="url(#pl)"/>`;
    s += `<rect x="180" y="445" width="330" height="12" fill="${mix('#4f7d4a', '#1d2e1c', n)}"/>`;
    for (let x = 190; x < 500; x += 22) s += `<circle cx="${x}" cy="443" r="9" fill="${mix('#5b8f4e', '#1b2c19', n)}"/>`;
    for (let x = 196; x < 500; x += 26) s += `<rect x="${x}" y="475" width="18" height="${chao - 490}" fill="${mix('#9fb6cc', '#ffcf86', n * .9)}" opacity="${(.35 + n * .3).toFixed(2)}"/>`;
    s += `<text x="345" y="${chao - 8}" text-anchor="middle" fill="${mix('#2a3340', '#d7deea', n)}" font-family="Barlow Semi Condensed, sans-serif" font-weight="700" font-size="13" letter-spacing="4" opacity=".75">TEATRO</text>`;
    // praça
    s += `<rect x="0" y="${chao}" width="${W}" height="${H - chao}" fill="url(#pa)"/>`;
    s += `<polygon points="120,${chao} 1040,${chao} 1120,${chao + 46} 40,${chao + 46}" fill="${mix('#b8bcc0', '#2a2d33', n)}" opacity=".7"/>`;
    for (let x = 60; x < 1120; x += 46) s += `<line x1="${x}" y1="${chao}" x2="${x - 30}" y2="${chao + 46}" stroke="#000" opacity=".08"/>`;
    // árvores da praça
    [[90, 1.1], [150, .9], [990, 1.15], [1080, 1], [1150, .85]].forEach(([x, k]) => {
      s += `<rect x="${x - 3}" y="${chao - 50 * k}" width="6" height="${50 * k}" fill="#3b2c22"/>`;
      s += `<circle cx="${x}" cy="${chao - 62 * k}" r="${30 * k}" fill="${mix('#4f7f43', '#16261a', n)}"/><circle cx="${x - 16 * k}" cy="${chao - 50 * k}" r="${20 * k}" fill="${mix('#5f9150', '#1b2e1f', n)}"/><circle cx="${x + 16 * k}" cy="${chao - 52 * k}" r="${22 * k}" fill="${mix('#467238', '#132217', n)}"/>`;
    });
    // a baleia: escultura de alumínio e vidro, saltando na praça
    const bx = 300, by = chao + 18;
    s += `<g transform="translate(${bx} ${by - 236}) scale(1.05)">
      <ellipse cx="150" cy="226" rx="150" ry="10" fill="#000" opacity=".25"/>
      <rect x="118" y="168" width="5" height="58" fill="#8b949e"/><rect x="190" y="150" width="5" height="76" fill="#8b949e"/>
      <path d="M8 196 C 20 150, 70 112, 132 102 C 186 94, 224 70, 246 38 L 258 18 C 262 30, 266 40, 270 46 C 254 86, 210 138, 140 170 C 98 188, 50 204, 8 196 Z" fill="url(#pb)" stroke="#5d6772" stroke-width="1"/>
      <path d="M258 18 C 246 10, 232 6, 214 6 C 228 16, 242 24, 254 30 Z" fill="url(#pb)" stroke="#5d6772" stroke-width="1"/>
      <path d="M262 20 C 270 8, 284 0, 302 -2 C 294 12, 282 24, 268 32 Z" fill="url(#pb)" stroke="#5d6772" stroke-width="1"/>
      <path d="M70 176 C 64 196, 70 212, 86 222 C 88 206, 86 190, 92 178 Z" fill="url(#pb)" stroke="#5d6772" stroke-width="1"/>
      <path d="M20 192 C 60 186, 100 176, 138 160" fill="none" stroke="#ffffff" stroke-width="1.4" opacity=".55"/>
      <path d="M40 160 L 70 196 M 80 128 L 104 184 M 126 108 L 140 168 M 170 100 L 178 150 M 206 80 L 214 124 M 232 56 L 240 86" stroke="#4a545e" stroke-width=".8" opacity=".45"/>
      <path d="M12 194 C 30 198, 46 200, 60 198" stroke="#3b4550" stroke-width="2" fill="none" opacity=".6"/>
      <circle cx="40" cy="178" r="2.4" fill="#2b333c"/>
    </g>`;
    s += `<text x="${bx + 160}" y="${by + 26}" text-anchor="middle" fill="${mix('#2a3340', '#c9d3df', n)}" font-family="Barlow Semi Condensed, sans-serif" font-weight="600" font-size="12" letter-spacing="3" opacity=".7">A BALEIA · PRAÇA ABERTA</text>`;
    // avenida com a ciclovia vermelha
    const av = chao + 46;
    s += `<rect x="0" y="${av}" width="${W}" height="${H - av}" fill="${mix('#3a3d42', '#14161a', n)}"/>`;
    s += `<rect x="0" y="${av}" width="${W}" height="12" fill="${mix('#b8473b', '#5a2420', n)}"/>`;
    for (let x = 10; x < W; x += 60) s += `<rect x="${x}" y="${av + 40}" width="32" height="3" fill="#e9e3c8" opacity=".7"/>`;
    for (let i = 0; i < 5; i++) {
      const x = 80 + i * 230 + R() * 60, y = av + 22 + (i % 2) * 34;
      const cor = ['#e9ecef', '#1c1f24', '#5f6873', '#24406e', '#a6acb2'][i];
      s += `<rect x="${x}" y="${y}" width="58" height="14" rx="5" fill="${cor}"/><rect x="${x + 12}" y="${y - 7}" width="30" height="9" rx="3" fill="${cor}"/><rect x="${x + 15}" y="${y - 5}" width="24" height="5" rx="2" fill="#16202c" opacity=".8"/><circle cx="${x + 12}" cy="${y + 14}" r="4" fill="#0c0c0c"/><circle cx="${x + 46}" cy="${y + 14}" r="4" fill="#0c0c0c"/>`;
      if (n > .4) s += `<circle cx="${x + 58}" cy="${y + 6}" r="7" fill="#fff6d0" opacity=".35"/>`;
    }
    s += `</svg>`;
    return s;
  }

  return { COR, mix, led, logo, icone, pronto, noite, ceu, panorama, fundo, predioSVG };
})();
