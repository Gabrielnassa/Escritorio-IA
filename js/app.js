/* ===========================================================
   app.js — motor do escritório
   =========================================================== */
(() => {

const cv  = document.getElementById('scene');
const ctx = cv.getContext('2d');
const $   = s => document.querySelector(s);
const $$  = s => Array.from(document.querySelectorAll(s));

const opts = { rgb: true, names: true, status: true, paths: false };

/* ===========================================================
   CÂMERA
   =========================================================== */
/* ancora: ponto de mundo que fica parado na tela enquanto o zoom anima
   (toque duplo); sem ela o zoom é em volta do centro, como no botão */
const cam = { x: 0, y: 0, z: 0.62, tz: 0.62, ancora: null };
let cw = 0, ch = 0, dpr = 1;      // dpr = escala de desenho em uso (ver NIT)

/* ---------- nitidez ----------
   O canvas é desenhado na densidade real da tela (até 3x, a do iPhone).
   Antes o teto era 1,5x e o navegador esticava a imagem 2x no celular:
   era daí o embaçado. Densidade alta custa pixel, então a escala desce
   um degrau (3 → 2,5 → 2 → 1,5 …) quando o aparelho não segura ~45 fps
   por 2 s, e sobe de volta quando sobra folga. Cada degrau que falha
   fica mais tempo de castigo antes de ser tentado de novo (não fica
   oscilando). Se descer não melhora o fps (modo de economia do iPhone
   trava em 30), a culpa não era dos pixels: volta e não insiste.     */
const NIT = {
  degraus: [1], i: 0,
  fixo: null,                // __escritorio.nitidez(2) trava num valor
  janelas: [],               // fps de cada meio segundo, o mais novo no fim
  calmaAte: 0,               // quadros logo depois de trocar refazem cache: não contam
  bloqueio: {}, castigo: {}, // degrau -> até quando não sobe para ele / próxima pena
  prova: null,               // acabou de descer: confere se adiantou
  semDescerAte: 0, esperaDescer: 30000,
  historico: []
};
// iOS recusa canvas acima de 16,7 M pixels e cada pixel são 4 bytes de
// memória: 8,3 M (um 4K) é folga para monitor retina grande
const MAX_PX = 8.3e6;

function escalaMax() {
  const real = Math.min(3, window.devicePixelRatio || 1);
  const teto = Math.sqrt(MAX_PX / Math.max(1, cw * ch));
  return Math.max(Math.min(1, real), Math.min(real, teto));
}

function resize() {
  const r = cv.getBoundingClientRect();
  cw = r.width; ch = r.height;
  // degraus abaixo da densidade da tela. Quem estava no topo continua no
  // topo (janela levada para um monitor retina já fica nítida); quem tinha
  // descido fica no mesmo valor
  const max = escalaMax(), antes = NIT.degraus[NIT.i], noTopo = NIT.i === 0;
  NIT.degraus = [max].concat([2.5, 2, 1.5, 1.25, 1].filter(v => v < max - 0.05));
  const k = NIT.degraus.findIndex(v => v <= antes + 1e-6);
  NIT.i = noTopo ? 0 : k < 0 ? NIT.degraus.length - 1 : k;
  dpr = NIT.fixo ? Math.min(NIT.fixo, max) : NIT.degraus[NIT.i];
  const w = Math.max(1, Math.round(cw * dpr)), h = Math.max(1, Math.round(ch * dpr));
  // mexer em width/height zera e realoca o canvas: só quando mudou mesmo
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
}

function trocaDegrau(i, agora, fps) {
  // histórico curto das trocas, para conferir pelo console (__escritorio.nitidez())
  NIT.historico.push({ s: +(agora / 1000).toFixed(1), de: NIT.degraus[NIT.i], para: NIT.degraus[i],
                       fps: Math.round(fps) });
  if (NIT.historico.length > 12) NIT.historico.shift();
  NIT.i = i; NIT.janelas.length = 0; NIT.calmaAte = agora + 1500;
  resize();
}

/** chamada a cada meio segundo com o fps medido */
function avaliaNitidez(fps, ms, agora) {
  const J = NIT.janelas;
  // aba escondida, entrada do prédio por cima ou escala travada: não julga
  if (NIT.fixo || document.hidden || !entrada.classList.contains('hidden')) { J.length = 0; return; }
  if (agora < NIT.calmaAte) return;
  J.push(fps); if (J.length > 8) J.shift();
  const media = n => J.slice(-n).reduce((a, b) => a + b, 0) / n;

  if (NIT.prova) {
    if (J.length < 4) return;
    const p = NIT.prova; NIT.prova = null;
    if (media(4) < p.fpsAntes * 1.12 + 1) {
      // não adiantou: volta para a nitidez de antes e passa um tempo sem descer
      NIT.castigo[p.de] = p.castigoAntes;
      NIT.bloqueio[p.de] = 0;
      NIT.semDescerAte = agora + NIT.esperaDescer;
      NIT.esperaDescer = Math.min(240000, NIT.esperaDescer * 2);
      trocaDegrau(p.de, agora, media(4));
    }
    return;
  }
  if (J.length >= 4 && J.slice(-4).every(f => f < 45) &&
      NIT.i < NIT.degraus.length - 1 && agora > NIT.semDescerAte) {
    const de = NIT.i, castigoAntes = NIT.castigo[de] || 0;
    // o degrau que falhou fica de castigo: 8 s, 16 s, 32 s… até 2 min
    NIT.castigo[de] = Math.min(120000, (castigoAntes || 4000) * 2);
    NIT.bloqueio[de] = agora + NIT.castigo[de];
    NIT.prova = { de, fpsAntes: media(4), castigoAntes };
    // muito longe dos 45 (menos de 28 fps): pula dois degraus de uma vez
    const passo = media(4) < 28 ? 2 : 1;
    trocaDegrau(Math.min(NIT.degraus.length - 1, de + passo), agora, media(4));
    return;
  }
  if (J.length >= 8 && NIT.i > 0 && J.every(f => f >= 56) && ms < 12 &&
      agora > (NIT.bloqueio[NIT.i - 1] || 0)) trocaDegrau(NIT.i - 1, agora, media(8));
}

/* tela que muda de tamanho: janela, giro do celular, barra do Safari que
   aparece e some, painel que abre e fecha, monitor trocando de densidade */
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 120));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
if (window.ResizeObserver) new ResizeObserver(() => resize()).observe(cv);
(function vigiaDensidade() {
  if (!window.matchMedia) return;
  const mq = matchMedia('(resolution: ' + (window.devicePixelRatio || 1) + 'dppx)');
  const muda = () => { resize(); vigiaDensidade(); };
  if (mq.addEventListener) mq.addEventListener('change', muda, { once: true });
})();
/* iOS antes do 15.4 não conhece 100dvh: a altura vem do JS (ver style.css) */
if (!(window.CSS && CSS.supports && CSS.supports('height', '100dvh'))) {
  const raiz = document.documentElement;
  raiz.classList.add('sem-dvh');
  const altura = () => raiz.style.setProperty('--app-h', window.innerHeight + 'px');
  altura();
  window.addEventListener('resize', altura);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', altura);
}

const BOUNDS = (() => {
  const minX = ISO.toScreen(0, WORLD.H - 1).x;
  const maxX = ISO.toScreen(WORLD.W - 1, 0).x + ISO.TW;
  const minY = ISO.toScreen(0, 0).y - WORLD.WALL_H;
  const maxY = ISO.toScreen(WORLD.W - 1, WORLD.H - 1).y + ISO.TH + WORLD.LAJE * .55;
  return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY,
           cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
})();

/** zoom que põe o andar inteiro na tela (o botão ⛶ e a tecla F) */
const zoomInteiro = () => Math.min(cw / BOUNDS.w, ch / BOUNDS.h) * 0.95;

/* limites do zoom: tela pequena não precisa chegar tão perto (2,8 no
   celular mostra dois pisos de largura) */
const ZMIN = 0.1;
const zMax = () => (Math.min(cw, ch) < 600 ? 2.2 : 2.8);
const limZ = z => Math.max(ZMIN, Math.min(zMax(), z));

function fit() {
  cam.tz = cam.z = Math.max(0.1, Math.min(1.6, zoomInteiro()));
  cam.x = -BOUNDS.cx; cam.y = -BOUNDS.cy;
  cam.ancora = null;
}

/** primeira vista. Na tela grande é o andar inteiro, como sempre foi. No
    celular em pé o andar inteiro sai com zoom 0,14, miúdo no meio de um
    monte de vazio: aí abre na sala do chefe com o andar enchendo a altura,
    e o resto fica a um arrasto de distância (o ⛶ continua mostrando tudo) */
function enquadraInicio() {
  const zi = zoomInteiro();
  if (zi >= 0.3 || !cw || !ch) { fit(); return; }
  const z = Math.max(zi, Math.min(0.62, Math.max(ch * 0.98 / BOUNDS.h, cw / 950)));
  // sala do chefe à esquerda da tela e, se couber, o começo da dos devs
  const visL = cw / z, visA = ch / z;
  const esq = ISO.toScreen(1, 17).x - 40;              // quina oeste da sala do chefe
  let cx = esq + visL / 2;
  cx = Math.min(cx, BOUNDS.maxX - visL / 2);
  let cy = ISO.toScreen(7, 9).y;                       // meio da sala do chefe
  cy = visA >= BOUNDS.h ? BOUNDS.cy
     : Math.max(BOUNDS.minY + visA / 2, Math.min(BOUNDS.maxY - visA / 2, cy));
  cam.tz = cam.z = z;
  cam.x = -cx; cam.y = -cy;
  cam.ancora = null;
}

function focusTile(x, y, zoom) {
  const p = ISO.toScreen(x, y, 30);
  cam.x = -p.x; cam.y = -p.y;
  cam.ancora = null;
  if (zoom) cam.tz = limZ(Math.max(cam.tz, zoom));
}

/** zoom animado que mantém parado o ponto (sx, sy) da tela */
function zoomEm(sx, sy, z) {
  const w = screenToWorld(sx, sy);
  cam.ancora = { sx, sy, wx: w.x, wy: w.y };
  cam.tz = limZ(z);
}

const worldToScreen = (wx, wy) => ({
  x: (wx + cam.x) * cam.z + cw / 2,
  y: (wy + cam.y) * cam.z + ch / 2
});
const screenToWorld = (sx, sy) => ({
  x: (sx - cw / 2) / cam.z - cam.x,
  y: (sy - ch / 2) / cam.z - cam.y
});

/* ===========================================================
   ATOR — o boneco que caminha
   =========================================================== */
const SPEED = 2.5;                 // tiles por segundo
const reserved = new Map();        // slotId -> actorId

class Actor {
  constructor(agent) {
    this.a = agent;
    this.x = WORLD.SPAWN.x;
    this.y = WORLD.SPAWN.y;
    this.path = [];
    this.fine = null;              // último passo fracionário até a cadeira
    this.facing = 's';
    this.phase = 0;
    this.moving = false;
    this.seated = false;
    this.slot = null;
    this.hidden = false;
    this.wait = 1 + Math.random() * 3;
    this.blinkT = 2 + Math.random() * 4;
    this.blink = false;
    this.act = '';
    this.sx = 0; this.sy = 0;
    this.microBreak = 0;
  }

  get id() { return this.a.id; }

  /* ---------- escolha de destino ---------- */
  releaseSlot() {
    if (this.slot && reserved.get(this.slot.id) === this.id) reserved.delete(this.slot.id);
    this.slot = null;
  }

  takeSlot(slot) {
    if (!slot) return false;
    const owner = reserved.get(slot.id);
    if (owner && owner !== this.id) return false;
    this.releaseSlot();
    reserved.set(slot.id, this.id);
    this.slot = slot;
    return true;
  }

  freeFrom(list) {
    const free = list.filter(s => !reserved.has(s.id) || reserved.get(s.id) === this.id);
    if (!free.length) return null;
    return free[Math.floor(Math.random() * free.length)];
  }

  desiredSlot() {
    const st = this.a.status;
    if (st === 'trabalhando') {
      // a estação é dele e só dele. Antes, quem levantasse voltava para a
      // primeira mesa livre e acabava sentando no computador de outro.
      return FURN.workSlots.find(s => s.id === this.a.slotId) || null;
    }
    if (st === 'reuniao') {
      if (this.slot && FURN.meetSlots.includes(this.slot)) return this.slot;
      return this.freeFrom(FURN.meetSlots);
    }
    if (st === 'descanso') {
      if (this.slot && FURN.restSlots.includes(this.slot) && this.wait > 0) return this.slot;
      return this.freeFrom(FURN.restSlots);
    }
    return null;   // offline -> elevador
  }

  /* ---------- ciclo ---------- */
  update(dt) {
    // piscada
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = !this.blink; this.blinkT = this.blink ? 0.12 : 2.5 + Math.random() * 4; }

    if (this.a.status === 'offline') {
      this.act = 'fora do expediente';
      if (!this.hidden) {
        if (!this.path.length && !this.fine) {
          const d = Math.hypot(this.x - WORLD.SPAWN.x, this.y - WORLD.SPAWN.y);
          if (d < 0.9) { this.hidden = true; this.releaseSlot(); }
          else this.goTo(WORLD.SPAWN.x, WORLD.SPAWN.y);
        }
      }
    } else if (this.hidden) {
      // volta pelo elevador, a pé
      this.hidden = false;
      this.x = WORLD.SPAWN.x; this.y = WORLD.SPAWN.y;
      this.path = []; this.fine = null; this.seated = false;
    }

    if (this.hidden) return;

    // quem está trabalhando fica na estação dele, ponto. Existia aqui uma
    // micro-pausa que levava ao bar de tempos em tempos: soltava a mesa e
    // na volta ele pegava outra. Descanso agora só na mão ou por agenda.

    // rodízio de atividade no lounge
    if (this.a.status === 'descanso') {
      this.wait -= dt;
      if (this.wait <= 0 && this.seated) {
        this.wait = 11 + Math.random() * 16;
        this.releaseSlot(); this.path = []; this.fine = null; this.seated = false;
      }
    }

    // destino
    if (!this.path.length && !this.fine) {
      const want = this.desiredSlot();
      if (want && want !== this.slot) {
        if (this.takeSlot(want)) this.goTo(want.x, want.y);
      } else if (want && want === this.slot && !this.seated) {
        this.goTo(want.x, want.y);
      } else if (!want && !this.seated &&
                 (this.a.status === 'descanso' || this.a.status === 'reuniao')) {
        // só perambula no lounge e na sala de reunião; trabalhando, fica parado
        this.wander();
      }
    }

    this.step(dt);
    this.describe();
  }

  /** caminho até uma posição fracionária: A* até o tile + deslize final */
  goTo(fx, fy) {
    let from = { x: Math.round(this.x), y: Math.round(this.y) };
    // se ele parou em cima de um móvel, sai para o tile livre mais perto
    if (!WORLD.walkable(from.x, from.y))
      from = PATH.nearestWalkable(WORLD.walkable, WORLD.W, WORLD.H, from) || from;
    const to = { x: Math.floor(fx), y: Math.floor(fy) };
    const p = PATH.find(WORLD.walkable, WORLD.W, WORLD.H, from, to);
    if (!p) { this.fine = null; return false; }
    this.path = p;
    this.fine = { x: fx, y: fy };
    this.seated = false;
    return true;
  }

  wander() {
    const room = this.a.status === 'descanso' ? WORLD.ROOMS.lounge
               : this.a.status === 'reuniao'  ? WORLD.ROOMS.reuniao
               : WORLD.ROOMS.servico;
    for (let i = 0; i < 14; i++) {
      const x = room.x1 + Math.floor(Math.random() * (room.x2 - room.x1));
      const y = room.y1 + Math.floor(Math.random() * (room.y2 - room.y1));
      if (WORLD.walkable(x, y)) { this.goTo(x + 0.5, y + 0.5); return; }
    }
  }

  step(dt) {
    let budget = SPEED * dt;
    this.moving = false;

    while (budget > 0) {
      let tx, ty, last = false;
      if (this.path.length) {
        tx = this.path[0].x; ty = this.path[0].y;
      } else if (this.fine) {
        tx = this.fine.x; ty = this.fine.y; last = true;
      } else break;

      const dx = tx - this.x, dy = ty - this.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 1e-4) {
        if (last) { this.arrive(); this.fine = null; }
        else this.path.shift();
        continue;
      }

      // direção que o boneco encara enquanto anda
      if (Math.abs(dx) > Math.abs(dy) * 1.05) this.facing = dx > 0 ? 'e' : 'w';
      else                                    this.facing = dy > 0 ? 's' : 'n';

      this.moving = true;
      if (dist <= budget) {
        this.x = tx; this.y = ty; budget -= dist;
        if (last) { this.arrive(); this.fine = null; }
        else this.path.shift();
      } else {
        this.x += dx / dist * budget;
        this.y += dy / dist * budget;
        budget = 0;
      }
    }

    this.phase += dt * (this.moving ? 3.1 : 1);
  }

  arrive() {
    this.seated = true;
    this.moving = false;
    if (this.slot && this.slot.facing) this.facing = this.slot.facing;
    if (this.a.status === 'descanso') this.wait = 11 + Math.random() * 16;
  }

  describe() {
    const st = this.a.status;
    if (st === 'offline')      { this.act = 'fora do expediente'; return; }
    if (this.microBreak > 0)   { this.act = 'pegando um café'; return; }
    if (this.moving)           { this.act = 'indo para ' + (this.slot ? (this.slot.label || 'a estação') : 'algum lugar'); return; }
    if (st === 'trabalhando')  { this.act = this.slot ? ('produzindo na ' + this.slot.label) : 'procurando mesa livre'; return; }
    if (st === 'reuniao')      { this.act = 'em reunião'; return; }
    if (st === 'descanso')     { this.act = this.slot ? this.slot.act : 'circulando na sala de jogos'; return; }
    this.act = '';
  }

  /* ---------- desenho ---------- */
  draw(ctx, t) {
    if (this.hidden) return;
    const p = ISO.toScreen(this.x, this.y, 0);
    const sp = worldToScreen(p.x, p.y);
    this.sx = sp.x; this.sy = sp.y;

    const working = this.a.status === 'trabalhando' && this.seated && this.microBreak <= 0;
    const sitting = this.seated && !!(this.slot && (this.slot.sit || working || this.a.status === 'reuniao'));

    // luz de recorte: destaca o boneco do piso escuro
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ISO.glow(ctx, p.x, p.y - 26, 34, STATUS_COLOR[this.a.status] || '#8b93ad', .12);
    ctx.restore();

    AVATAR.draw(ctx, this.a.look, p.x, p.y, this.facing, {
      moving: this.moving,
      phase: this.phase,
      sitting,
      working,
      headset: working,
      blink: this.blink,
      scale: SCALE
    });

    if (opts.paths && this.path.length) {
      ctx.save();
      ctx.strokeStyle = 'rgba(56,189,248,.35)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
      ctx.beginPath();
      const s0 = ISO.toScreen(this.x, this.y, 2); ctx.moveTo(s0.x, s0.y);
      for (const n of this.path) { const s = ISO.toScreen(n.x, n.y, 2); ctx.lineTo(s.x, s.y); }
      if (this.fine) { const s = ISO.toScreen(this.fine.x, this.fine.y, 2); ctx.lineTo(s.x, s.y); }
      ctx.stroke(); ctx.restore();
    }

    // etiquetas empilhadas ACIMA da cabeça, nunca sobre o rosto
    const col = STATUS_COLOR[this.a.status] || '#8b93ad';
    let stack = p.y - AVATAR.headTop(sitting) * SCALE - 8;

    if (opts.names) {
      stack -= AVATAR.nameTag(ctx, p.x, stack, this.a.name,
                              this.a.boss ? '#c4b8ff' : col,
                              this.a.boss ? 'DONO' : null) + 4;
    }
    if (opts.status && !this.moving) {
      const ic = this.a.status === 'trabalhando' ? '💻'
               : this.a.status === 'descanso' ? '🎮'
               : this.a.status === 'reuniao' ? '🗣️' : '💤';
      AVATAR.bubble(ctx, p.x, stack, ic,
                    this.microBreak > 0 ? 'pausa' : SHORT_ACT[this.a.status], col);
    }
    void t;
  }
}

/** escala dos bonecos na cena — a mobília sentável usa a mesma */
const SCALE = AVATAR.SCALE;

/** móveis em que o boneco senta EM CIMA — aí ele é desenhado por cima do móvel.
    Mesa e cadeira ficam de fora: a cadeira já tem profundidade própria e o
    monitor deve mesmo tapar o peito de quem está atrás dele. */
const SIT_OVER = new Set(['sofa', 'beanbag', 'poltrona']);

const STATUS_COLOR = {
  trabalhando: '#23e08a', descanso: '#ffb020', reuniao: '#38bdf8', offline: '#5a6280'
};
const SHORT_ACT = {
  trabalhando: 'trabalhando', descanso: 'descanso', reuniao: 'reunião', offline: 'offline'
};

/* ===========================================================
   MUNDO VIVO
   =========================================================== */
const actors = new Map();

/** Cada agente recebe uma estação fixa e guarda esse número. Sem isso ele
    volta para a primeira mesa livre depois de qualquer saída e acaba no
    computador de outro. Mesa que sumiu do mapa ou que já é de alguém é
    trocada por outra livre. */
function garanteEstacao() {
  const mesas = FURN.workSlots.filter(s => !s.vip).sort((a, b) => a.id < b.id ? -1 : 1);
  const tomadas = new Set();
  let mudou = false;
  for (const ag of ROSTER.all()) {
    if (ag.boss) { if (ag.slotId) tomadas.add(ag.slotId); continue; }
    const valida = ag.slotId && mesas.some(m => m.id === ag.slotId) && !tomadas.has(ag.slotId);
    if (valida) { tomadas.add(ag.slotId); continue; }
    const livre = mesas.find(m => !tomadas.has(m.id));
    ag.slotId = livre ? livre.id : null;
    if (livre) tomadas.add(livre.id);
    mudou = true;
  }
  if (mudou) ROSTER.save();
}

function syncActors() {
  garanteEstacao();
  const ids = new Set();
  for (const ag of ROSTER.all()) {
    ids.add(ag.id);
    if (!actors.has(ag.id)) actors.set(ag.id, new Actor(ag));
    else actors.get(ag.id).a = ag;
  }
  for (const [id, ac] of actors) {
    if (!ids.has(id)) { ac.releaseSlot(); actors.delete(id); }
  }
  // o dono fica na mesa da sala do chefe
  for (const ac of actors.values()) {
    if (ac.a.boss) {
      const s = FURN.workSlots.find(s => s.id === ac.a.slotId);
      if (s) ac.takeSlot(s);
      // o dono já está na mesa quando o escritório abre; não sobe pelo elevador
      if (s && !ac.jaPosicionado && ac.a.status === 'trabalhando') {
        ac.x = s.x; ac.y = s.y; ac.path = []; ac.fine = null; ac.arrive();
      }
      ac.jaPosicionado = true;
    }
  }
}

/* ---------- lista estática de desenho (paredes + móveis) ---------- */
const staticDraw = [];
/** caixa que a peça ocupa na tela, em coordenadas de mundo (sem câmera).
    Como tudo isso é fixo, dá para calcular uma vez e usar para descartar
    o que está fora do enquadramento — é o que mais economiza no zoom.  */
function caixaTile(x, y, topo) {
  const p = ISO.toScreen(x, y);
  return { x0: p.x - 36, y0: p.y - topo, x1: p.x + 36, y1: p.y + 38 };
}
function caixaMovel(o) {
  const w = o.w || 1, d = o.d || 1;
  return {
    x0: ISO.toScreen(o.x, o.y + d).x - 34,
    x1: ISO.toScreen(o.x + w, o.y).x + 34,
    y0: ISO.toScreen(o.x, o.y).y - 175,
    y1: ISO.toScreen(o.x + w, o.y + d).y + 44
  };
}

for (let y = 0; y < WORLD.H; y++) {
  for (let x = 0; x < WORLD.W; x++) {
    const k = WORLD.kindAt(x, y);
    if (k === WORLD.WALL) staticDraw.push({ k: x + y + 1, t: 'wall', x, y, bb: caixaTile(x, y, WORLD.WALL_H + 14) });
    else if (k === WORLD.DOOR) staticDraw.push({ k: x + y + 0.4, t: 'door', x, y, bb: caixaTile(x, y, 110) });
  }
}
// com a luz do andar (decor-luz.js), tapetes e nomes das salas já vêm
// assados no piso iluminado: desenhá-los de novo apagaria a luz sobre eles
const LUZ_ON = typeof LUZ !== 'undefined';
for (const o of FURN.items) {
  if (LUZ_ON && LUZ.noChao(o)) continue;
  staticDraw.push({ k: FURN.depth(o), t: 'furn', o, bb: caixaMovel(o) });
}
// nomes das salas no piso: depois dos tapetes (k = -1), antes de todo o resto
if (!(LUZ_ON && LUZ.ROTULOS_NO_PISO)) staticDraw.push({ k: -0.5, t: 'rotulos' });
staticDraw.sort((a, b) => a.k - b.k);

/* ===========================================================
   RENDER
   =========================================================== */
let T0 = performance.now(), t = 0;
const elevador = FURN.items.find(o => o.t === 'elevator');
let bgCache = null;
const elFps = document.getElementById("fps");
let fpsN = 0, fpsT = 0, msDesenho = 0;

function frame(now) {
  // dt da animação tem teto; o fps é medido com o intervalo real, senão
  // 10 e 15 fps apareciam iguais (20) e a nitidez não via a diferença
  const dtReal = Math.max(0, (now - T0) / 1000);
  const dt = Math.min(0.05, dtReal);
  T0 = now; t += dt;

  cam.z += (cam.tz - cam.z) * Math.min(1, dt * 9);
  if (cam.ancora) {
    const a = cam.ancora;
    if (Math.abs(cam.tz - cam.z) < cam.tz * 0.002) { cam.z = cam.tz; cam.ancora = null; }
    cam.x = (a.sx - cw / 2) / cam.z - a.wx;
    cam.y = (a.sy - ch / 2) / cam.z - a.wy;
  }
  // embalo do arrasto com o dedo: segue andando e freia
  if (embalo) {
    cam.x += embalo.vx * dt / cam.z; cam.y += embalo.vy * dt / cam.z;
    const f = Math.exp(-dt * 4.2);
    embalo.vx *= f; embalo.vy *= f;
    if (Math.hypot(embalo.vx, embalo.vy) < 12) embalo = null;
  }
  const tDesenho = performance.now();

  // ocupação das mesas para o brilho dos monitores
  for (const o of FURN.items) if (o.busy !== undefined) o.busy = false;
  let noElevador = false;
  for (const ac of actors.values()) {
    ac.update(dt);
    if (ac.slot && ac.slot.obj && ac.seated && ac.a.status === 'trabalhando' && ac.microBreak <= 0)
      ac.slot.obj.busy = true;
    if (!ac.hidden && Math.hypot(ac.x - WORLD.SPAWN.x, ac.y - WORLD.SPAWN.y) < 1.6) noElevador = true;
  }
  // a porta do elevador abre enquanto alguém chega ou vai embora
  if (elevador) elevador.abre = Math.max(0, Math.min(1, (elevador.abre || 0) + (noElevador ? dt * 2.2 : -dt * 1.4)));

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // fundo: o céu de São Paulo em volta do andar, conforme a hora
  NASSA.fundo(ctx, cw, ch);
  void bgCache;

  ctx.save();
  ctx.setTransform(dpr * cam.z, 0, 0, dpr * cam.z,
                   dpr * (cw / 2 + cam.x * cam.z), dpr * (ch / 2 + cam.y * cam.z));

  // piso com a luz do andar já pintada (mapa de luz em cache, ver decor-luz.js)
  if (LUZ_ON) LUZ.piso(ctx); else WORLD.drawFloor(ctx);
  WORLD.drawDecals(ctx, t);

  // retângulo visível, em coordenadas de mundo
  const meiaL = cw / (2 * cam.z), meiaA = ch / (2 * cam.z);
  const vis = { x0: -cam.x - meiaL, x1: -cam.x + meiaL,
                y0: -cam.y - meiaA, y1: -cam.y + meiaA };
  const aparece = b => b.x1 > vis.x0 && b.x0 < vis.x1 && b.y1 > vis.y0 && b.y0 < vis.y1;

  // mescla estáticos + atores por profundidade
  const dyn = [];
  for (const ac of actors.values()) {
    if (ac.hidden) continue;
    let k = ac.x + ac.y + 0.5;
    // sentado: desenha por cima do próprio móvel, senão a cadeira e o
    // monitor tapam o boneco (é o mesmo truque do Habbo)
    if (ac.seated && ac.slot && ac.slot.obj && SIT_OVER.has(ac.slot.obj.t))
      k = Math.max(k, FURN.depth(ac.slot.obj) + 0.02);
    const pa = ISO.toScreen(ac.x, ac.y);
    dyn.push({ k, t: 'actor', ac,
               bb: { x0: pa.x - 40, x1: pa.x + 40, y0: pa.y - 165, y1: pa.y + 20 } });
  }
  dyn.sort((a, b) => a.k - b.k);

  let i = 0, j = 0;
  while (i < staticDraw.length || j < dyn.length) {
    const useStatic = j >= dyn.length || (i < staticDraw.length && staticDraw[i].k <= dyn[j].k);
    const it = useStatic ? staticDraw[i++] : dyn[j++];
    if (it.bb && !aparece(it.bb)) continue;          // fora da tela: pula
    if (it.t === 'wall')       WORLD.drawWallTile(ctx, it.x, it.y, opts.rgb ? t : 0, opts.rgb, cam.z);
    else if (it.t === 'door')  WORLD.drawDoorTile(ctx, it.x, it.y, opts.rgb ? t : 0);
    else if (it.t === 'furn')  FURN.drawItem(ctx, it.o, t);
    else if (it.t === 'rotulos') WORLD.drawRoomLabels(ctx);
    else                       it.ac.draw(ctx, t);
  }

  ctx.restore();

  // contador: separa o quadro inteiro do tempo que o desenho realmente leva
  msDesenho += performance.now() - tDesenho;
  fpsN++; fpsT += dtReal;
  if (fpsT >= 0.5) {
    const fps = fpsN / fpsT, ms = msDesenho / fpsN;
    // a escala de desenho vai junto: "2x" no iPhone quer dizer que desceu
    elFps.innerHTML = '<b>' + fps.toFixed(0) + '</b> fps · desenho ' + ms.toFixed(1) + ' ms · ' +
                      (+dpr.toFixed(2)) + 'x';
    elFps.classList.toggle('ruim', fps < 50);
    fpsN = 0; fpsT = 0; msDesenho = 0;
    avaliaNitidez(fps, ms, now);
  }

  requestAnimationFrame(frame);
}

/* ===========================================================
   INTERAÇÃO NO PALCO
   =========================================================== */
/* Mouse: arrasta, clica e a rodinha dá zoom, como sempre. Toque: um dedo
   arrasta (com embalo ao soltar), dois dedos fazem pinça — o ponto entre
   os dedos fica embaixo dos dedos — e toque duplo no vazio aproxima.
   Toque só vale como clique se o dedo quase não andou e nunca entrou um
   segundo dedo: senão cada pinça ou arrasto abria uma ficha sem querer. */
const dedos = new Map();     // pointerId -> posição no canvas
let gesto = null;            // do primeiro dedo que encosta ao último que sai
let embalo = null;           // velocidade do arrasto solto, px de tela por s
let toqueAnterior = null;    // para reconhecer o toque duplo

const noCanvas = e => {
  const r = cv.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
};

/** centro e abertura dos dedos, e o ponto de mundo embaixo do centro.
    Refeito sempre que um dedo entra ou sai, senão a câmera dá um pulo */
function referenciaGesto(t) {
  let sx = 0, sy = 0;
  for (const p of dedos.values()) { sx += p.x; sy += p.y; }
  const n = dedos.size, cx = sx / n, cy = sy / n;
  let ab = 0;
  for (const p of dedos.values()) ab += Math.hypot(p.x - cx, p.y - cy);
  const w = screenToWorld(cx, cy);
  gesto.ref = { cx, cy, ab: ab / n, z: cam.z, wx: w.x, wy: w.y };
  gesto.rastro = [{ x: cx, y: cy, t }];
}

cv.addEventListener('pointerdown', e => {
  // no celular o painel ☰ abre por cima do palco: mexer no palco o fecha
  const painel = document.getElementById('panel');
  if (painel.classList.contains('open')) painel.classList.remove('open');
  const p = noCanvas(e);
  try { cv.setPointerCapture(e.pointerId); } catch (_) { /* dedo já saiu */ }
  embalo = null;
  // primeiro dedo de um toque novo: se algum dedo antigo ficou preso (o
  // iOS às vezes não manda o pointerup), descarta, senão nada mais vira toque
  if (e.isPrimary && dedos.size) { dedos.clear(); gesto = null; }
  if (!gesto || !dedos.size) {
    gesto = { toque: e.pointerType !== 'mouse', x0: p.x, y0: p.y, andou: false, varios: false };
    cv.classList.add('dragging');
  }
  dedos.set(e.pointerId, p);
  if (dedos.size > 1) gesto.varios = true;
  // dedo encostou: o zoom animado para onde está (a pinça parte dele)
  if (gesto.toque) cam.tz = cam.z;
  cam.ancora = null;
  referenciaGesto(e.timeStamp);
});

cv.addEventListener('pointermove', e => {
  if (gesto && dedos.has(e.pointerId)) {
    const p = noCanvas(e);
    dedos.set(e.pointerId, p);
    const lim = gesto.toque ? 10 : 4;
    if (Math.abs(p.x - gesto.x0) + Math.abs(p.y - gesto.y0) > lim) gesto.andou = true;
    let sx = 0, sy = 0;
    for (const q of dedos.values()) { sx += q.x; sy += q.y; }
    const n = dedos.size, cx = sx / n, cy = sy / n, R = gesto.ref;
    if (n > 1 && R.ab > 2) {
      let ab = 0;
      for (const q of dedos.values()) ab += Math.hypot(q.x - cx, q.y - cy);
      cam.z = cam.tz = limZ(R.z * (ab / n) / R.ab);
    }
    // o ponto de mundo que estava sob o centro dos dedos continua sob ele
    cam.x = (cx - cw / 2) / cam.z - R.wx;
    cam.y = (cy - ch / 2) / cam.z - R.wy;
    // hora do evento, não a do tratamento: com o quadro pesado o dedo
    // chega atrasado e o embalo sairia errado
    const t = e.timeStamp;
    gesto.rastro.push({ x: cx, y: cy, t });
    while (gesto.rastro.length > 2 && t - gesto.rastro[0].t > 100) gesto.rastro.shift();
  }
  // dedo não tem "passar por cima": a etiqueta só atrapalharia o arrasto
  if (e.pointerType === 'mouse' || e.pointerType === 'pen') hover(e);
});

function soltaDedo(e, cancelou) {
  if (!dedos.has(e.pointerId)) return;
  dedos.delete(e.pointerId);
  if (dedos.size) { referenciaGesto(e.timeStamp); return; }
  const g = gesto; gesto = null;
  cv.classList.remove('dragging');
  if (!g || cancelou) return;
  if (!g.andou && !g.varios) { tocou(e, g); return; }
  // soltou arrastando com um dedo só: a câmera segue no embalo
  if (g.toque && !g.varios && g.rastro.length > 1) {
    const a = g.rastro[0], b = g.rastro[g.rastro.length - 1];
    const dt = (b.t - a.t) / 1000;
    // o dedo parou antes de sair (mais de 90 ms sem andar): sem embalo
    if (dt > 0.008 && e.timeStamp - b.t < 90) {
      const vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt;
      if (Math.hypot(vx, vy) > 250) embalo = { vx: Math.max(-4000, Math.min(4000, vx)),
                                               vy: Math.max(-4000, Math.min(4000, vy)) };
    }
  }
}
cv.addEventListener('pointerup', e => soltaDedo(e, false));
cv.addEventListener('pointercancel', e => soltaDedo(e, true));
cv.addEventListener('pointerleave', () => { $('#tooltip').classList.add('hidden'); });

/** clique do mouse ou toque parado: abre quem/o que estiver embaixo */
function tocou(e, g) {
  const a = pick(e);
  if (a) { openAgent(a.a.id); return; }
  if (noQuadroBmw(e)) { abrirBmw(); return; }
  if (naMesaDeReuniao(e)) { REUNIAO.abrir(); return; }
  const m = pegaMesa(e);
  if (m && m.ator) { abrirMonitor(m.ator.a); return; }
  if (m) { toast('Estação ' + m.slot.id + ' está vazia.'); return; }
  if (!g.toque) return;
  // toque duplo no vazio: aproxima no ponto tocado
  const p = noCanvas(e), agora = performance.now(), ant = toqueAnterior;
  if (ant && agora - ant.t < 350 && Math.hypot(p.x - ant.x, p.y - ant.y) < 40) {
    zoomEm(p.x, p.y, cam.tz * 1.8);
    toqueAnterior = null;
  } else toqueAnterior = { t: agora, x: p.x, y: p.y };
}

/* No palco o navegador não pode fazer nada sozinho com o dedo: rolar a
   página, dar zoom nela (gesturestart é o gesto próprio do Safari) ou
   gerar um clique "fantasma" depois do toque — a ficha que o toque abre
   aparece embaixo do dedo e esse clique cairia num botão dela. */
['touchstart', 'touchmove', 'touchend'].forEach(t =>
  cv.addEventListener(t, e => { if (e.cancelable) e.preventDefault(); }, { passive: false }));
['gesturestart', 'gesturechange', 'gestureend'].forEach(t =>
  document.addEventListener(t, e => {
    if (e.target && e.target.closest && e.target.closest('#stage, #topbar')) e.preventDefault();
  }, { passive: false }));

cv.addEventListener('wheel', e => {
  e.preventDefault();
  cam.ancora = null;
  cam.tz = limZ(cam.tz * (e.deltaY < 0 ? 1.13 : 0.885));
}, { passive: false });

function pick(e) {
  const r = cv.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  let best = null, bestK = -1e9;
  for (const ac of actors.values()) {
    if (ac.hidden) continue;
    // posição na tela calculada agora: sx/sy só são atualizados quando o
    // boneco é desenhado, e quem está fora do quadro guardava a posição
    // de antes do arrasto — o toque abria a ficha de alguém lá longe
    const pw = ISO.toScreen(ac.x, ac.y, 0), ps = worldToScreen(pw.x, pw.y);
    ac.sx = ps.x; ac.sy = ps.y;
    const dx = mx - ac.sx, dy = my - ac.sy;
    const hw = 22 * cam.z, hh = 74 * cam.z;
    if (dx > -hw && dx < hw && dy > -hh && dy < 8 * cam.z) {
      const k = ac.x + ac.y;
      if (k > bestK) { bestK = k; best = ac; }
    }
  }
  return best;
}

const tip = $('#tooltip');
function hover(e) {
  const a = pick(e);
  if (!a && noQuadroBmw(e)) {
    const r = cv.getBoundingClientRect();
    tip.innerHTML = '<b>🖼️ BMW 335i E90 M Sport LCI</b><div class="tt-role">rodas Style 359M 19" prata</div><div class="tt-act">clique para ver o quadro</div>';
    tip.style.left = (e.clientX - r.left) + 'px';
    tip.style.top  = (e.clientY - r.top - 12) + 'px';
    tip.classList.remove('hidden');
    cv.style.cursor = 'zoom-in';
    return;
  }
  if (!a) {
    const m = pegaMesa(e);
    if (m && m.ator) {
      const sis = m.ator.a.sistema ? SISTEMAS.porId(m.ator.a.sistema) : null;
      tip.innerHTML = '<b>🖥️ ' + esc(m.slot.label) + '</b>' +
        '<div class="tt-role">' + esc(m.ator.a.name) + '</div>' +
        '<div class="tt-act">' + (sis ? 'abrir ' + esc(sis.nome) : 'sem sistema ligado') + '</div>';
      const r = cv.getBoundingClientRect();
      tip.style.left = (e.clientX - r.left) + 'px';
      tip.style.top  = (e.clientY - r.top - 12) + 'px';
      tip.classList.remove('hidden');
      cv.style.cursor = 'pointer';
      return;
    }
    cv.style.cursor = '';
    tip.classList.add('hidden');
    return;
  }
  cv.style.cursor = 'pointer';
  const r = cv.getBoundingClientRect();
  tip.innerHTML = `<b>${esc(a.a.name)}${a.a.boss ? ' ⚡' : ''}</b>
    <div class="tt-role">${esc(a.a.role)}</div>
    <div class="tt-act">${a.a.emoji || '•'} ${esc(a.act || '—')}</div>`;
  tip.style.left = (a.sx) + 'px';
  tip.style.top  = (a.sy - 60 * cam.z) + 'px';
  tip.classList.remove('hidden');
  void r;
}

/* ===========================================================
   PAINEL
   =========================================================== */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function renderTeam() {
  const q = ($('#team-search').value || '').toLowerCase().trim();
  const box = $('#team-list');
  const list = ROSTER.all().filter(a =>
    !q || a.name.toLowerCase().includes(q) || a.role.toLowerCase().includes(q));
  $('#team-count').textContent = ROSTER.all().length;
  box.innerHTML = '';

  for (const a of list) {
    const ac = actors.get(a.id);
    const el = document.createElement('div');
    el.className = 'card s-' + a.status;
    el.innerHTML = `
      <canvas class="av"></canvas>
      <div class="info">
        <div class="nm">${esc(a.name)}</div>
        <div class="rl">${a.emoji || ''} ${esc(a.role)}</div>
        <div class="ac">${esc(ac ? ac.act : '')}</div>
      </div>
      <div class="side"><span class="pill ${a.status}">${SHORT_ACT[a.status]}</span></div>
      ${a.boss ? '<span class="boss">⚡</span>' : ''}`;
    AVATAR.portrait(el.querySelector('.av'), a.look);
    el.addEventListener('click', () => openAgent(a.id));
    box.appendChild(el);
  }
}

let hireCat = 'todos';
function renderHire() {
  const box = $('#hire-list');
  box.innerHTML = '';
  // "com sistema" mostra todo mundo que já chega com um computador funcionando
  const list = ROSTER.CATALOG.filter(c => hireCat === 'todos' ||
    (hireCat === 'detectado' ? !!c.sistema : c.cat === hireCat));

  for (const c of list) {
    const hired = ROSTER.isHired(c.key);
    const el = document.createElement('div');
    el.className = 'hcard' + (hired ? ' hired' : '');
    el.innerHTML = `
      <div class="top">
        <div class="emo">${c.emoji}</div>
        <div class="nm">${esc(c.name)} <span style="color:var(--txt-dim);font-weight:600">· ${esc(c.role)}</span></div>
        <span class="tag ${c.cat}">${c.cat === 'detectado' ? 'na máquina' : c.sistema ? 'com sistema' : 'sugestão'}</span>
      </div>
      <p class="desc">${esc(c.desc)}</p>
      <p class="why"><b>Por que vale:</b> ${esc(c.why)}</p>
      ${c.system ? `<p class="desc" style="margin-top:-3px">🖥️ Sistema: <b style="color:var(--txt)">${esc(c.system)}</b></p>` : ''}
      ${c.path ? `<p class="desc" style="font-family:monospace;font-size:10.5px;opacity:.6">${esc(c.path)}</p>` : ''}
      <div class="acts">
        <button class="mini act">${hired ? '✓ já contratado' : '＋ contratar'}</button>
      </div>`;
    const btn = el.querySelector('.act');
    btn.disabled = hired;
    btn.addEventListener('click', () => {
      const a = ROSTER.hire(c.key);
      if (!a) return;
      syncActors(); renderAll();
      toast(`${a.name} foi contratado(a) — entrando pela recepção.`);
      const ac = actors.get(a.id);
      if (ac) focusTile(ac.x, ac.y, 0.6);
    });
    box.appendChild(el);
  }

  // criar agente do zero
  const add = document.createElement('div');
  add.className = 'hcard';
  add.innerHTML = `
    <div class="top">
      <div class="emo">🤖</div>
      <div class="nm">Cadastrar um agente meu</div>
    </div>
    <p class="desc">Tem um agente que não está na lista? Cadastre aqui com nome, função e visual próprio.</p>
    <div class="acts"><button class="mini act">＋ cadastrar agente</button></div>`;
  add.querySelector('.act').addEventListener('click', openNew);
  box.appendChild(add);
}

function renderRooms() {
  const box = $('#rooms-list');
  box.innerHTML = '';
  const order = ['diretoria', 'servico', 'lounge', 'reuniao', 'corredor'];
  for (const id of order) {
    const r = WORLD.ROOMS[id];
    const inside = Array.from(actors.values()).filter(ac =>
      !ac.hidden && WORLD.roomAt(Math.round(ac.x), Math.round(ac.y)) === id);
    const cap = id === 'servico' ? FURN.workSlots.filter(s => s.room === 'servico').length
              : id === 'diretoria' ? 1 : id === 'reuniao' ? 8 : id === 'lounge' ? FURN.restSlots.length : 0;
    const pct = cap ? Math.min(100, inside.length / cap * 100) : 0;
    const el = document.createElement('div');
    el.className = 'roomcard';
    el.innerHTML = `
      <div class="rname"><span style="width:9px;height:9px;border-radius:3px;background:${r.accent};box-shadow:0 0 9px ${r.accent}"></span>${esc(r.name)}</div>
      <div class="rmeta">${esc(r.desc)}</div>
      <div class="rmeta" style="color:${r.accent}">${inside.length} pessoa(s) agora${cap ? ` · ${cap} lugares` : ''}</div>
      ${cap ? `<div class="bar"><i style="width:${pct}%;background:${r.accent}"></i></div>` : ''}`;
    el.addEventListener('click', () => {
      if (id === 'corredor') focusTile(24, 20, 0.7);
      else focusTile((r.x1 + r.x2) / 2, (r.y1 + r.y2) / 2, 0.7);
    });
    box.appendChild(el);
  }
}

function renderStats() {
  $('#st-work').textContent = ROSTER.count('trabalhando') + ROSTER.count('reuniao');
  $('#st-idle').textContent = ROSTER.count('descanso');
  $('#st-off').textContent  = ROSTER.count('offline');
  const leg = $('#roomlegend');
  leg.innerHTML = ['diretoria', 'servico', 'lounge', 'reuniao'].map(id => {
    const r = WORLD.ROOMS[id];
    const n = Array.from(actors.values()).filter(ac =>
      !ac.hidden && WORLD.roomAt(Math.round(ac.x), Math.round(ac.y)) === id).length;
    return `<div class="rl"><span class="dot" style="background:${r.accent};color:${r.accent}"></span>${esc(r.short)} · ${n}</div>`;
  }).join('');
}

function renderAll() { renderTeam(); renderHire(); renderRooms(); renderStats(); }

/* ===========================================================
   FICHA DO FUNCIONÁRIO
   =========================================================== */
const modal = $('#modal'), mbody = $('#modal-body');
const closeModal = () => modal.classList.add('hidden');
$('#modal-x').addEventListener('click', closeModal);
// o segundo toque de um toque duplo cai no fundo da ficha que o primeiro
// abriu: fundo tocado logo depois de abrir não fecha
let modalAbertoEm = 0;
modal.addEventListener('click', e => {
  if (e.target === modal && performance.now() - modalAbertoEm > 450) closeModal();
});


/* O confirm() nativo é bloqueado em alguns navegadores embutidos: ele devolve
   false sem mostrar nada, e a ação simplesmente não acontecia — sem erro, sem
   aviso. Esta confirmação é desenhada na própria página, então sempre aparece. */
function confirmar(titulo, texto, rotuloOk = 'Confirmar') {
  return new Promise(resolve => {
    mbody.innerHTML =
      '<h3 style="font-family:var(--f-display);margin:0 0 8px">' + esc(titulo) + '</h3>' +
      '<p class="hint" style="margin-bottom:18px;line-height:1.6">' + esc(texto) + '</p>' +
      '<div class="mactions">' +
      '  <button class="btn primary" id="cf-ok">' + esc(rotuloOk) + '</button>' +
      '  <button class="btn" id="cf-no">Cancelar</button>' +
      '</div>';
    modal.classList.remove('hidden');
    const fim = v => { modal.classList.add('hidden'); resolve(v); };
    $('#cf-ok').addEventListener('click', () => fim(true));
    $('#cf-no').addEventListener('click', () => fim(false));
  });
}

function openAgent(id) {
  const a = ROSTER.get(id);
  if (!a) return;
  const ac = actors.get(id);

  mbody.innerHTML = `
    <div class="mhead">
      <canvas id="m-av"></canvas>
      <div>
        <h3>${esc(a.name)} ${a.boss ? '⚡' : ''}</h3>
        <p>${a.emoji || ''} ${esc(a.role)}</p>
        <p style="margin-top:6px;color:var(--alt-1);font-size:12px">${esc(ac ? ac.act : '')}</p>
      </div>
    </div>
    ${a.brief ? `<p class="hint" style="margin-bottom:14px">${esc(a.brief)}</p>` : ''}
    ${a.path ? `<p class="hint" style="font-family:monospace;font-size:11px;margin-bottom:14px">${esc(a.path)}</p>` : ''}

    <div class="frow"><label>Nome exibido</label><input id="f-name" value="${esc(a.name)}"></div>
    <div class="frow"><label>Função</label><input id="f-role" value="${esc(a.role)}"></div>

    <div class="frow"><label>Situação</label>
      <div class="seg" id="f-status">
        <button data-s="trabalhando" class="${a.status === 'trabalhando' ? 'on' : ''}">💻 Trabalhando</button>
        <button data-s="descanso"    class="${a.status === 'descanso' ? 'on' : ''}">🎮 Descanso</button>
        <button data-s="reuniao"     class="${a.status === 'reuniao' ? 'on' : ''}">🗣️ Reunião</button>
        <button data-s="offline"     class="${a.status === 'offline' ? 'on' : ''}">💤 Offline</button>
      </div>
    </div>

    ${a.boss ? '' : `
    <div class="frow"><label>Estação</label>
      <div class="hint" style="padding:6px 0">${a.slotId ? 'Estação ' + esc(a.slotId) + ' — é dela e de mais ninguém' : 'sem estação livre no momento'}</div>
    </div>

    <div class="frow"><label>Horário de trabalho</label>
      <div class="seg" style="gap:6px">
        <input type="time" id="f-h1" value="${esc((a.horario && a.horario.inicio) || '')}" style="flex:1">
        <input type="time" id="f-h2" value="${esc((a.horario && a.horario.fim) || '')}" style="flex:1">
        <button id="f-hoff" title="Sem horário: trabalha sempre">✕</button>
      </div>
    </div>
    <div class="frow"><label>Dias</label>
      <div class="seg" id="f-dias">
        ${['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((n, i) => {
          const dias = (a.horario && a.horario.dias) || [1, 2, 3, 4, 5];
          return `<button data-d="${i}" class="${dias.includes(i) ? 'on' : ''}">${n}</button>`;
        }).join('')}
      </div>
    </div>
    <p class="hint" style="margin:-6px 0 14px">${esc(textoHorario(a))}. Fora do horário ele vai para a sala de jogos sozinho; dentro, volta para a estação.</p>
    `}

    <div class="frow"><label>Visual</label>
      <div class="seg">
        <button id="f-shuffle">🎲 Sortear aparência</button>
      </div>
    </div>

    <button class="btn wide primary" id="f-sis" style="margin-top:6px">🖥️ Abrir o sistema de ${esc(a.name)}</button>

    <div class="mactions">
      <button class="btn primary" id="f-save">Salvar</button>
      <button class="btn" id="f-find">📍 Localizar</button>
      ${a.locked ? '' : '<button class="btn danger" id="f-fire">Desligar</button>'}
    </div>`;

  const cvp = $('#m-av');
  const paint = () => AVATAR.portrait(cvp, a.look, 1.6);
  paint();

  $$('#f-status button').forEach(b => b.addEventListener('click', () => {
    $$('#f-status button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
  }));

  $$('#f-dias button').forEach(b => b.addEventListener('click', () => b.classList.toggle('on')));
  const hoff = $('#f-hoff');
  if (hoff) hoff.addEventListener('click', () => { $('#f-h1').value = ''; $('#f-h2').value = ''; });

  $('#f-shuffle').addEventListener('click', () => {
    const keep = a.look.uniforme;
    a.look = AVATAR.makeLook(a.id + Math.random(), { uniforme: keep });
    paint();
  });
  $('#f-sis').addEventListener('click', () => { closeModal(); abrirMonitor(a); });
  $('#f-find').addEventListener('click', () => {
    const c = actors.get(a.id);
    if (c) { focusTile(c.x, c.y, 0.95); closeModal(); toast(`${a.name}: ${c.act}`); }
  });
  $('#f-save').addEventListener('click', () => {
    a.name = ($('#f-name').value || a.name).slice(0, 22);
    a.role = ($('#f-role').value || a.role).slice(0, 48);
    const ns = $('#f-status button.on').dataset.s;
    const trocouStatus = ns !== a.status;
    if (trocouStatus) setStatus(a, ns);
    if (!a.boss) {
      const i = $('#f-h1').value, f = $('#f-h2').value;
      const dias = $$('#f-dias button.on').map(b => +b.dataset.d);
      // horário só vale com as duas pontas e pelo menos um dia
      a.horario = (i && f && dias.length) ? { inicio: i, fim: f, dias } : null;
      const dentro = dentroDoHorario(a.horario);
      // se ele acabou de escolher a situação na mão, essa ordem vale até a
      // próxima virada; se não mexeu, a agenda já entra em vigor agora
      a._fase = (dentro !== null && trocouStatus)
        ? (dentro ? 'trabalhando' : 'descanso') : null;
    }
    ROSTER.save(); aplicarAgenda(); renderAll(); closeModal();
  });
  const fb = $('#f-fire');
  if (fb) fb.addEventListener('click', async () => {
    if (!await confirmar('Desligar ' + a.name + '?',
        'Ele sai do quadro e a estação fica livre. Dá para contratar de novo depois.',
        'Desligar')) return;
    ROSTER.fire(a.id); syncActors(); renderAll(); closeModal();
    toast(`${a.name} saiu do quadro.`);
  });

  modal.classList.remove('hidden');
}

function openNew() {
  mbody.innerHTML = `
    <h3 style="font-family:var(--f-display);margin:0 0 4px">Cadastrar agente</h3>
    <p class="hint" style="margin-bottom:16px">Ele entra pela recepção e vai até uma estação livre. Se ele tem um sistema,
      cadastre junto: o computador dele passa a abrir esse sistema aqui dentro.</p>
    <div class="frow"><label>Nome</label><input id="n-name" placeholder="ex.: Tati" maxlength="22"></div>
    <div class="frow"><label>Função</label><input id="n-role" placeholder="ex.: Analista de Conteúdo" maxlength="48"></div>
    <div class="frow"><label>Emoji</label><input id="n-emo" placeholder="🤖" maxlength="4" value="🤖"></div>
    <div class="frow"><label>O que ele faz</label><textarea id="n-brief" rows="2" placeholder="Uma frase sobre a função dele."></textarea></div>
    <div class="frow"><label>Sistema do agente</label>
      <div class="seg" id="n-tipo">
        <button data-t="nenhum" class="on">Nenhum</button>
        <button data-t="local">Roda nesta máquina</button>
        <button data-t="web">Site / URL</button>
      </div></div>
    <div id="n-local" class="hidden">
      <div class="frow"><label>Pasta do projeto</label><input id="n-pasta" placeholder="C:\\projetos\\meu-agente"></div>
      <div class="two">
        <div class="frow"><label>Comando</label><input id="n-cmd" value="npm"></div>
        <div class="frow"><label>Argumentos</label><input id="n-args" value="run dev"></div>
      </div>
      <div class="two">
        <div class="frow"><label>Porta</label><input id="n-porta" type="number" min="1024" max="65535"></div>
        <div class="frow"><label>Página inicial</label><input id="n-abre" value="/"></div>
      </div>
      <p class="hint">O escritório sobe o sistema com PORT igual à porta acima. Se o seu projeto escolhe a porta de outro jeito,
        ponha nos argumentos (ex.: <code>run dev -- --port 4402</code>).</p>
    </div>
    <div id="n-web" class="hidden">
      <div class="frow"><label>Endereço</label><input id="n-url" placeholder="https://meu-sistema.com"></div>
      <label class="opt"><input type="checkbox" id="n-esp"> O site recusa abrir dentro do escritório (usar o espelho)</label>
    </div>
    <label class="opt" style="margin-top:8px"><input type="checkbox" id="n-reun" checked> Participa da reunião dos agentes</label>
    <div id="n-msg" class="hint" style="color:#ff7a6b;margin-top:6px"></div>
    <div class="mactions">
      <button class="btn primary" id="n-ok">Contratar</button>
      <button class="btn" id="n-cancel">Cancelar</button>
    </div>`;

  let tipo = 'nenhum';
  $$('#n-tipo button').forEach(b => b.addEventListener('click', () => {
    tipo = b.dataset.t;
    $$('#n-tipo button').forEach(x => x.classList.toggle('on', x === b));
    $('#n-local').classList.toggle('hidden', tipo !== 'local');
    $('#n-web').classList.toggle('hidden', tipo !== 'web');
  }));
  // sugere a primeira porta livre a partir de 4401
  const usadas = SISTEMAS.todos().map(s => s.porta).filter(Boolean);
  let livre = 4401; while (usadas.includes(livre)) livre++;
  $('#n-porta').value = livre;

  $('#n-cancel').addEventListener('click', closeModal);
  $('#n-ok').addEventListener('click', async () => {
    const name = $('#n-name').value.trim();
    if (!name) { $('#n-name').focus(); return; }
    const brief = $('#n-brief').value.trim();
    let sistema = null;
    if (tipo !== 'nenhum') {
      const corpo = tipo === 'web'
        ? { tipo: 'web', nome: name, url: $('#n-url').value.trim(), embutir: $('#n-esp').checked ? 'espelho' : true, sobre: brief }
        : { tipo: 'local', nome: name, pasta: $('#n-pasta').value.trim(), comando: $('#n-cmd').value.trim(),
            args: $('#n-args').value.trim(), porta: Number($('#n-porta').value), abre: $('#n-abre').value.trim() || '/', sobre: brief };
      $('#n-ok').disabled = true;
      const r = await fetch('/api/sistemas', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                                               body: JSON.stringify(corpo) })
        .then(x => x.json()).catch(() => ({ ok: false, motivo: 'o escritório não respondeu' }));
      $('#n-ok').disabled = false;
      if (!r.ok) { $('#n-msg').textContent = r.motivo; return; }
      sistema = r.id;
      await SISTEMAS.atualizar();
    }
    const a = ROSTER.hireCustom({
      name, role: $('#n-role').value.trim() || 'Função a definir',
      emoji: $('#n-emo').value.trim() || '🤖',
      path: tipo === 'local' ? $('#n-pasta').value.trim() : null,
      sistema, reuniao: $('#n-reun').checked, brief
    });
    syncActors(); renderAll(); closeModal();
    toast(`${a.name} entrou no quadro.` + (sistema ? ' Clique no computador dele para abrir o sistema.' : ''));
  });
  modal.classList.remove('hidden');
}

/* ===========================================================
   AÇÕES
   =========================================================== */
function setStatus(a, s) {
  a.status = s;
  const ac = actors.get(a.id);
  if (ac) { ac.releaseSlot(); ac.path = []; ac.fine = null; ac.seated = false; ac.microBreak = 0; ac._break = null; }
  ROSTER.save();
}

function setAll(s) {
  for (const a of ROSTER.all()) { if (!a.boss) setStatus(a, s); }
  renderAll();
}

/* ===========================================================
   AGENDA — horário de trabalho de cada um

   Quem tem horário entra em serviço no começo do expediente e vai para o
   lounge no fim. Só nas viradas: se você mandar alguém descansar no meio
   do turno, ele fica descansando — a agenda não desfaz a sua ordem, ela
   só age quando o horário muda de fase.
   =========================================================== */
const emMinutos = hhmm => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  return m ? (+m[1]) * 60 + (+m[2]) : null;
};

/** dentro do expediente dele agora? null = sem horário, trabalha sempre */
function dentroDoHorario(h, d = new Date()) {
  if (!h || !h.inicio || !h.fim) return null;
  const dias = Array.isArray(h.dias) && h.dias.length ? h.dias : [0, 1, 2, 3, 4, 5, 6];
  if (!dias.includes(d.getDay())) return false;
  const i = emMinutos(h.inicio), f = emMinutos(h.fim);
  if (i == null || f == null) return null;
  const agora = d.getHours() * 60 + d.getMinutes();
  // turno que atravessa a meia-noite (22:00 -> 06:00)
  return i <= f ? (agora >= i && agora < f) : (agora >= i || agora < f);
}

function aplicarAgenda() {
  let mudou = false;
  for (const a of ROSTER.all()) {
    if (a.boss) continue;
    const dentro = dentroDoHorario(a.horario);
    if (dentro === null) { a._fase = null; continue; }
    const fase = dentro ? 'trabalhando' : 'descanso';
    if (a._fase === fase) continue;          // já virou, não insiste
    a._fase = fase;
    if (a.status !== fase && a.status !== 'offline') { setStatus(a, fase); mudou = true; }
  }
  if (mudou) renderAll();
}

/** resumo curto do horário para a lista e a ficha */
function textoHorario(a) {
  const h = a.horario;
  if (!h || !h.inicio || !h.fim) return 'sem horário · sempre em serviço';
  const nomes = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const dias = Array.isArray(h.dias) && h.dias.length ? h.dias : [0, 1, 2, 3, 4, 5, 6];
  const todos = dias.length === 7;
  const util = dias.length === 5 && [1, 2, 3, 4, 5].every(d => dias.includes(d));
  const quais = todos ? 'todo dia' : util ? 'seg a sex' : dias.map(d => nomes[d]).join(', ');
  return `${h.inicio}–${h.fim} · ${quais}`;
}

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hidden'), 3400);
}

/* ===========================================================
   RELATÓRIO DO GERENTE
   =========================================================== */
function buildReport() {
  const team = ROSTER.all();
  const work = team.filter(a => a.status === 'trabalhando');
  const meet = team.filter(a => a.status === 'reuniao');
  const rest = team.filter(a => a.status === 'descanso');
  const off  = team.filter(a => a.status === 'offline');
  const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const linha = a => {
    const ac = actors.get(a.id);
    return `<li><b>${esc(a.name)}</b> — ${esc(a.role)}<br><span style="color:var(--txt-dim);font-size:12px">${esc(ac ? ac.act : '')}</span></li>`;
  };

  const naoContratados = ROSTER.CATALOG.filter(c => c.cat === 'sugerido' && !ROSTER.isHired(c.key)).slice(0, 3);

  const fala = `Relatório das ${hora}. Temos ${work.length + meet.length} em serviço, ` +
    `${rest.length} na sala de jogos e ${off.length} fora do expediente. ` +
    (work.length ? `Trabalhando agora: ${work.map(a => a.name).join(', ')}. ` : 'Ninguém produzindo no momento. ') +
    (rest.length ? `No descanso: ${rest.map(a => a.name).join(', ')}. ` : '') +
    (naoContratados.length ? `Sugiro contratar ${naoContratados.map(c => c.name + ', ' + c.role).join('; ')}.` : '');

  const html = `
    <h3 style="font-family:var(--f-display);margin:0 0 4px">Relatório do gerente</h3>
    <p class="hint" style="margin-bottom:14px">${hora} · ${team.length} no quadro</p>
    <div class="report">
      <div class="big">
        <span style="color:var(--ok)">${work.length + meet.length} em serviço</span> ·
        <span style="color:var(--warn)">${rest.length} na sala de jogos</span> ·
        <span style="color:var(--off)">${off.length} offline</span>
      </div>

      ${work.length ? `<h4>💻 Produzindo</h4><ul>${work.map(linha).join('')}</ul>` : ''}
      ${meet.length ? `<h4>🗣️ Em reunião</h4><ul>${meet.map(linha).join('')}</ul>` : ''}
      ${rest.length ? `<h4>🎮 Sala de jogos</h4><ul>${rest.map(linha).join('')}</ul>` : ''}
      ${off.length  ? `<h4>💤 Fora do expediente</h4><ul>${off.map(a => `<li>${esc(a.name)} — ${esc(a.role)}</li>`).join('')}</ul>` : ''}

      ${naoContratados.length ? `<h4>📌 Quem eu contrataria agora</h4><ul>${naoContratados.map(c =>
        `<li><b>${esc(c.name)}</b> — ${esc(c.role)}<br><span style="color:var(--txt-dim);font-size:12px">${esc(c.why)}</span></li>`).join('')}</ul>` : ''}
    </div>
    <div class="mactions">
      <button class="btn primary" id="r-speak">🔊 Ler em voz alta</button>
      <button class="btn" id="r-close">Fechar</button>
    </div>`;

  return { html, fala };
}

function openReport() {
  const r = buildReport();
  mbody.innerHTML = r.html;
  $('#r-close').addEventListener('click', closeModal);
  $('#r-speak').addEventListener('click', () => speak(r.fala));
  modal.classList.remove('hidden');
}

/* ===========================================================
   MONITOR — clicar no computador do agente abre o sistema dele
   =========================================================== */
const mon = {
  el: $('#monitor'), frame: $('#mon-frame'), vazio: $('#mon-vazio'),
  saida: $('#mon-saida'), id: null, agente: null, timer: null, vendoLog: false
};

/** caixa clicável da mesa, mais justa que a usada no descarte de desenho */
function caixaMesa(o) {
  const w = o.w || 1, d = o.d || 1;
  return {
    x0: ISO.toScreen(o.x, o.y + d).x - 8,
    x1: ISO.toScreen(o.x + w, o.y).x + 8,
    y0: ISO.toScreen(o.x, o.y).y - 68,
    y1: ISO.toScreen(o.x + w, o.y + d).y + 16
  };
}

/** qual estação está sob o cursor, e quem está sentado nela */
function pegaMesa(e) {
  const r = cv.getBoundingClientRect();
  const p = screenToWorld(e.clientX - r.left, e.clientY - r.top);
  for (const slot of FURN.workSlots) {
    const o = slot.obj;
    if (!o) continue;
    const b = caixaMesa(o);
    if (p.x > b.x0 && p.x < b.x1 && p.y > b.y0 && p.y < b.y1) {
      const ac = Array.from(actors.values())
        .find(a => a.slot === slot && a.seated && !a.hidden);
      return { slot, ator: ac || null };
    }
  }
  return null;
}

/** o clique caiu em cima da mesa de reunião? */
function naMesaDeReuniao(e) {
  const mesa = FURN.items.find(o => o.t === 'meetTable');
  if (!mesa) return false;
  const r = cv.getBoundingClientRect();
  const p = screenToWorld(e.clientX - r.left, e.clientY - r.top);
  const b = caixaMesa(mesa);
  return p.x > b.x0 && p.x < b.x1 && p.y > b.y0 && p.y < b.y1;
}

/* ===========================================================
   A REUNIÃO PUXA OS BONECOS

   Enquanto a reunião roda, quem está nela larga a estação e vai para
   a sala de reunião a pé, como todo mundo aqui. Quando acaba, cada um
   volta para o que estava fazendo antes — por isso guardamos o estado
   anterior em vez de assumir "trabalhando".
   =========================================================== */
let reuniaoAtiva = false;

function sincronizaReuniao() {
  if (typeof REUNIAO === 'undefined') return;
  const rolando = REUNIAO.emAndamento();
  const nomes = new Set(REUNIAO.naMesa());
  let mexeu = false;

  if (rolando) {
    for (const a of ROSTER.all()) {
      if (a.boss || !nomes.has(a.name)) continue;
      if (a.status === 'reuniao') continue;
      a._antesDaReuniao = a.status;
      setStatus(a, 'reuniao');
      mexeu = true;
    }
    if (!reuniaoAtiva) toast('Reunião das ' + (REUNIAO.estado ? REUNIAO.estado.hora : '11:00') + ' começou — equipe indo para a mesa.');
  } else if (reuniaoAtiva) {
    for (const a of ROSTER.all()) {
      if (a.status !== 'reuniao') continue;
      setStatus(a, a._antesDaReuniao || 'trabalhando');
      delete a._antesDaReuniao;
      mexeu = true;
    }
    toast('Reunião encerrada. Briefing pronto na mesa.');
  }

  reuniaoAtiva = rolando;
  if (mexeu) { ROSTER.save(); renderAll(); }
}

async function abrirMonitor(agente) {
  if (!agente) return;
  mon.agente = agente;
  mon.id = agente.sistema || null;
  mon.vendoLog = false;

  $('#mon-nome').textContent = agente.name;
  AVATAR.portrait($('#mon-av'), agente.look, 0.85);
  mon.el.classList.remove('hidden');
  mon.saida.classList.add('hidden');
  CONVERSA.fechar();

  await SISTEMAS.atualizar();
  pintarMonitor();
  clearInterval(mon.timer);
  mon.timer = setInterval(async () => {
    if (mon.el.classList.contains('hidden')) return;
    await SISTEMAS.atualizar();
    pintarMonitor(true);
    if (mon.vendoLog) mon.saida.textContent = (await SISTEMAS.log(mon.id)).join(String.fromCharCode(10));
  }, 3000);
}

function fecharMonitor() {
  CONVERSA.fechar();
  mon.el.classList.add('hidden');
  clearInterval(mon.timer);
  mon.frame.src = 'about:blank';
  mon.frame.dataset.url = '';      // senão, reabrir o mesmo sistema deixava a tela em branco
}

function pintarMonitor(soEstado) {
  const s = mon.id ? SISTEMAS.porId(mon.id) : null;
  const luz = $('#mon-luz'), txt = $('#mon-txt');

  if (!s) {
    $('#mon-sis').textContent = mon.agente ? mon.agente.role : '';
    luz.style.background = 'var(--off)';
    $('#mon-ligar').disabled = $('#mon-desligar').disabled = $('#mon-log').disabled = true;
    $('#mon-aba').disabled = $('#mon-chat').disabled = true;
    mon.frame.style.display = 'none';
    mon.frame.dataset.url = '';
    mon.vazio.classList.add('on');
    // tem sistema, mas ele roda na máquina do dono e aqui não há servidor
    // (GitHub Pages): explica em vez de dizer que não existe
    if (mon.id && !SISTEMAS.comServidor()) {
      txt.textContent = 'roda na sua máquina';
      mon.vazio.innerHTML = '<div><b>Esse sistema roda no seu computador</b>' +
        'O sistema <code>' + esc(mon.id) + '</code> é um servidor local, e esta página está aberta sem o servidor do escritório.<br>' +
        '<span class="dica">Abra pelo <b>INICIAR ESCRITORIO</b> (http://localhost:4321) para ligar e ver o painel aqui dentro.</span></div>';
      return;
    }
    txt.textContent = 'sem sistema';
    mon.vazio.innerHTML = '<div><b>Esse agente ainda não tem sistema ligado a ele</b>' +
      'Cadastre em <code>data/sistemas.json</code> e aponte o agente para o id dele.<br>' +
      '<span class="dica">É assim que um agente novo ganha um computador que abre de verdade.</span></div>';
    return;
  }

  $('#mon-sis').textContent = s.nome;
  luz.style.background = SISTEMAS.COR[s.estado] || 'var(--off)';
  luz.style.color = SISTEMAS.COR[s.estado] || 'var(--off)';
  txt.textContent = s.tipo === 'web' ? 'site publicado'
                  : s.tipo === 'embutido' ? 'no ar · embutido'
                  : s.externo ? 'no ar · fora daqui' : s.estado;

  const local = s.tipo === 'local';
  $('#mon-ligar').disabled = !local || s.estado === 'no ar' || s.estado === 'subindo';
  // não derruba processo que você subiu por fora; só o que nasceu aqui
  $('#mon-desligar').disabled = !local || s.estado === 'desligado' || s.externo;
  $('#mon-desligar').title = s.externo
    ? 'Esse servidor foi iniciado fora do escritório — feche no terminal dele'
    : 'Desligar';
  $('#mon-log').disabled = !local;
  $('#mon-aba').disabled = false;
  // dá para conversar mesmo desligado, e mesmo com sistema publicado:
  // o que o agente precisa é da pasta do projeto, não do servidor no ar.
  // Sem o servidor do escritório (GitHub Pages) não há Claude Code para abrir.
  $('#mon-chat').disabled = !s.pasta || !SISTEMAS.comServidor();
  $('#mon-chat').title = SISTEMAS.comServidor() ? 'Conversar com o agente'
    : 'Conversar precisa do escritório rodando na sua máquina (INICIAR ESCRITORIO)';

  // sistema que recusa iframe entra pelo espelho (urlEmbutida); se nem o
  // espelho subiu, não adianta insistir — o quadro ficaria branco
  const noAr = s.tipo === 'web' || s.estado === 'no ar';
  const urlQuadro = s.urlEmbutida || s.url;
  const bloqueado = s.embutir === false || (s.embutir === 'espelho' && !s.urlEmbutida);
  const podeMostrar = noAr && !bloqueado;
  if (soEstado && podeMostrar && mon.frame.dataset.url === urlQuadro) return;

  if (podeMostrar) {
    mon.vazio.classList.remove('on');
    mon.frame.style.display = '';
    if (mon.frame.dataset.url !== urlQuadro) {
      mon.frame.dataset.url = urlQuadro;
      mon.frame.src = urlQuadro;
    }
  } else {
    mon.frame.style.display = 'none';
    mon.frame.dataset.url = '';
    mon.vazio.classList.add('on');
    const dicas = (s.dicas || []).map(d => '• ' + esc(d)).join('<br>');
    const cauda = (s.ultimoLog || []).length
      ? '<pre class="mon-cauda">' + esc(s.ultimoLog.join(String.fromCharCode(10))) + '</pre>'
      : '';
    // no ar mas sem poder embutir: o sistema recusa iframe (X-Frame-Options)
    const foraDoQuadro = bloqueado && noAr;
    const titulo = foraDoQuadro
      ? esc(s.nome) + ' está no ar, mas só abre fora'
      : s.estado === 'caiu'
      ? esc(s.nome) + ' subiu e caiu'
      : esc(s.nome) + ' está desligado';
    const rodape = foraDoQuadro
      ? '<br><span class="dica">Esse sistema recusa ser exibido dentro de outra página — ' +
        'é uma proteção dele, não um defeito. Clique em <b>↗ Nova aba</b> para usá-lo.</span>'
      : '<br><span class="dica">Clique em <b>Ligar</b> — eu subo o servidor e mostro o painel aqui.</span>';
    mon.vazio.innerHTML = '<div><b>' + titulo + '</b>' + (foraDoQuadro ? '' : cauda) +
      esc(s.sobre || '') +
      '<div class="dica">Pasta: <code>' + esc(s.pasta || '—') + '</code><br>' +
      'Porta: ' + (s.porta || '—') + (dicas ? '<br><br>' + dicas : '') +
      (s.aviso ? '<br><br><b style="color:var(--warn)">Atenção:</b> ' + esc(s.aviso) : '') + '</div>' +
      rodape + '</div>';
  }
}

CONVERSA.ligarEventos();
$('#mon-chat').addEventListener('click', () => {
  if (CONVERSA.aberto()) { CONVERSA.fechar(); return; }
  if (!mon.id) { toast('Esse agente não tem sistema para investigar.'); return; }
  mon.saida.classList.add('hidden'); mon.vendoLog = false;
  CONVERSA.abrir(mon.id);
});
$('#mon-x').addEventListener('click', fecharMonitor);
$('#mon-aba').addEventListener('click', () => {
  const s = SISTEMAS.porId(mon.id);
  if (s && s.url) window.open(s.url, '_blank', 'noopener');
});
$('#mon-log').addEventListener('click', async () => {
  mon.vendoLog = !mon.vendoLog;
  if (mon.vendoLog) CONVERSA.fechar();
  mon.saida.classList.toggle('hidden', !mon.vendoLog);
  if (mon.vendoLog) mon.saida.textContent = (await SISTEMAS.log(mon.id)).join(String.fromCharCode(10)) || "(sem saída ainda)";
});
$('#mon-ligar').addEventListener('click', async () => {
  const s = SISTEMAS.porId(mon.id);
  if (!s) return;
  // sistema que age sozinho só sobe depois de você confirmar
  if (s.aviso && !(await confirmar(s.nome, s.aviso, '▶ Ligar mesmo assim'))) return;
  $('#mon-ligar').disabled = true;
  $('#mon-txt').textContent = 'subindo…';
  mon.vazio.innerHTML = '<div><b>Subindo ' + esc(s.nome) + '</b>' +
    'Instalando nada, só rodando <code>' + esc(s.pasta) + '</code>.<br>' +
    '<span class="dica">A primeira vez costuma demorar mais. O log mostra o que está acontecendo.</span></div>';
  const r = await SISTEMAS.ligar(mon.id);
  if (!r.ok) { toast(r.motivo || 'não consegui ligar'); pintarMonitor(); return; }
  const subiu = await SISTEMAS.esperarSubir(mon.id, 90);
  pintarMonitor();
  toast(subiu ? s.nome + ' no ar.' : 'Não subiu no tempo esperado — veja o log.');
});
$('#mon-desligar').addEventListener('click', async () => {
  await SISTEMAS.desligar(mon.id);
  await SISTEMAS.atualizar();
  pintarMonitor();
});

/* ===========================================================
   QUADRO — ideias e agenda que aparecem nas paredes da sala do chefe
   =========================================================== */
function openQuadro() {
  const ideias = QUADRO.ideias(), eventos = QUADRO.eventos();
  mbody.innerHTML = `
    <h3 style="font-family:var(--f-display);margin:0 0 3px">📌 Quadro</h3>
    <p class="hint" style="margin-bottom:14px">O que você anotar aqui aparece no quadro branco e no painel de eventos da sala do chefe.</p>
    <div class="frow"><label>Nova ideia para o quadro branco</label>
      <div class="inline"><input id="q-txt" placeholder="ex.: testar um canal de vendas novo" maxlength="52">
      <button class="mini" id="q-add">anotar</button></div></div>
    <div class="chiplist" id="q-list">${ideias.map((t, i) =>
      `<span class="tagline"><i>${esc(t)}</i><button data-i="${i}" class="x">✕</button></span>`).join('') ||
      '<span class="hint">quadro vazio</span>'}</div>

    <div class="frow" style="margin-top:16px"><label>Novo evento na agenda</label>
      <div class="inline">
        <input id="e-data" placeholder="20/09" maxlength="8" style="max-width:74px">
        <input id="e-nome" placeholder="Reunião com cliente X" maxlength="34">
        <input id="e-tipo" placeholder="Reunião" maxlength="16" style="max-width:110px">
        <button class="mini" id="e-add">marcar</button>
      </div></div>
    <div class="chiplist" id="e-list">${eventos.map((v, i) =>
      `<span class="tagline"><b>${esc(v.data)}</b><i>${esc(v.nome)}</i><em>${esc(v.tipo)}</em><button data-i="${i}" class="x">✕</button></span>`).join('') ||
      '<span class="hint">nenhum evento</span>'}</div>`;

  const addIdeia = () => {
    const v = $('#q-txt').value.trim();
    if (!v) return;
    QUADRO.addIdeia(v); openQuadro(); toast('Anotado no quadro.');
  };
  $('#q-add').addEventListener('click', addIdeia);
  $('#q-txt').addEventListener('keydown', ev => { if (ev.key === 'Enter') addIdeia(); });
  $$('#q-list .x').forEach(b => b.addEventListener('click', () => { QUADRO.delIdeia(+b.dataset.i); openQuadro(); }));
  $('#e-add').addEventListener('click', () => {
    const d = $('#e-data').value.trim(), nm = $('#e-nome').value.trim();
    if (!d || !nm) return;
    QUADRO.addEvento({ data: d, nome: nm, tipo: $('#e-tipo').value.trim() || 'Evento' });
    openQuadro(); toast('Evento marcado.');
  });
  $$('#e-list .x').forEach(b => b.addEventListener('click', () => { QUADRO.delEvento(+b.dataset.i); openQuadro(); }));
  modal.classList.remove('hidden');
}

/* ===========================================================
   VOZ
   =========================================================== */
function speak(txt) {
  if (!('speechSynthesis' in window)) { toast('Este navegador não fala.'); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(txt);
  u.lang = 'pt-BR'; u.rate = 1.05; u.pitch = 1;
  const v = speechSynthesis.getVoices().find(v => /pt[-_]BR/i.test(v.lang));
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}

let rec = null, recOn = false;
function toggleVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('Reconhecimento de voz não disponível neste navegador — use o Chrome.'); return; }
  if (recOn) { rec && rec.stop(); return; }

  rec = new SR();
  rec.lang = 'pt-BR'; rec.interimResults = false; rec.continuous = false;
  rec.onstart = () => { recOn = true; $('#btn-voice').classList.add('rec'); toast('Ouvindo… fale com o gerente.'); };
  rec.onend   = () => { recOn = false; $('#btn-voice').classList.remove('rec'); };
  rec.onerror = () => { recOn = false; $('#btn-voice').classList.remove('rec'); toast('Não consegui ouvir.'); };
  rec.onresult = e => command(e.results[0][0].transcript.toLowerCase());
  rec.start();
}

function command(txt) {
  toast('🎤 ' + txt);

  if (/relat[óo]rio|resumo|situa[çc][ãa]o/.test(txt)) { openReport(); speak(buildReport().fala); return; }

  if (/(quadro|ideia|evento|agenda)/.test(txt)) { openQuadro(); return; }

  if (/(todos|geral).*(trabalh|servi[çc]o)|volta.*trabalh/.test(txt)) {
    setAll('trabalhando'); speak('Todo mundo de volta às estações.'); return;
  }
  if (/(pausa|descanso|lounge|intervalo)/.test(txt) && /(todos|geral)/.test(txt)) {
    setAll('descanso'); speak('Liberei a equipe para a sala de jogos.'); return;
  }
  if (/reuni[ãa]o/.test(txt) && /(todos|chama|convoca)/.test(txt)) {
    setAll('reuniao'); speak('Convocando todo mundo para a sala de reunião.'); return;
  }
  if (/quem.*(trabalh|produz)/.test(txt)) {
    const w = ROSTER.all().filter(a => a.status === 'trabalhando');
    speak(w.length ? `Trabalhando agora: ${w.map(a => a.name).join(', ')}.` : 'Ninguém trabalhando.');
    return;
  }
  if (/quem.*(descans|lounge|parad)/.test(txt)) {
    const w = ROSTER.all().filter(a => a.status === 'descanso');
    speak(w.length ? `Na sala de jogos: ${w.map(a => a.name).join(', ')}.` : 'Sala de jogos vazia.');
    return;
  }
  if (/contrat/.test(txt)) {
    const c = ROSTER.CATALOG.find(c => !ROSTER.isHired(c.key) &&
      (txt.includes(c.name.toLowerCase()) || txt.includes(c.role.toLowerCase().split(' ')[0])));
    if (c) { ROSTER.hire(c.key); syncActors(); renderAll(); speak(`${c.name} contratado como ${c.role}.`); }
    else speak('Não achei esse perfil no banco de talentos.');
    return;
  }
  // "onde está fulano" / "põe fulano pra trabalhar"
  const alvo = ROSTER.all().find(a => txt.includes(a.name.toLowerCase()));
  if (alvo) {
    const ac = actors.get(alvo.id);
    if (/descans|pausa|lounge/.test(txt))      { setStatus(alvo, 'descanso');    speak(`${alvo.name} liberado para a sala de jogos.`); }
    else if (/reuni[ãa]o/.test(txt))           { setStatus(alvo, 'reuniao');     speak(`${alvo.name} indo para a reunião.`); }
    else if (/offline|desliga|encerra/.test(txt)) { setStatus(alvo, 'offline');  speak(`${alvo.name} encerrou o expediente.`); }
    else if (/trabalh|servi[çc]o|volta/.test(txt)) { setStatus(alvo, 'trabalhando'); speak(`${alvo.name} voltou para a estação.`); }
    else if (ac) { focusTile(ac.x, ac.y, 0.95); speak(`${alvo.name} está ${ac.act}.`); }
    renderAll();
    return;
  }
  speak('Não entendi. Tente: relatório, quem está trabalhando, ou todos ao trabalho.');
}

/* ===========================================================
   QUADRO DA BMW — clique na parede da sala do chefe
   =========================================================== */
function noQuadroBmw(e) {
  const r = cv.getBoundingClientRect();
  const w = screenToWorld(e.clientX - r.left, e.clientY - r.top);
  return WORLD.pontoNaPlaca('bmw', w.x, w.y);
}

function abrirBmw() {
  mbody.innerHTML = `
    <div class="mhead" style="margin-bottom:12px"><div>
      <h3>BMW 335i E90 M Sport LCI · 2010</h3>
      <p>O quadro da sala do chefe. Sedã E90 preto já na versão LCI (2009/2010), pacote M Sport e rodas Style 359M de 19" em prata, em pixel art.</p>
    </div></div>
    <canvas class="bmw-tela" id="bmw-tela"></canvas>
    <div class="bmw-ficha">
      <div><b>Motor</b><span>N54 3.0 seis em linha biturbo · 306 cv</span></div>
      <div><b>Rodas</b><span>Style 359M · 19" · prata · Y-spoke</span></div>
      <div><b>LCI 2009/2010</b><span>lanterna LED em "L", seta no retrovisor, capô novo</span></div>
      <div><b>M Sport</b><span>para-choques e saias M, emblema M no para-lama, acabamento Shadowline</span></div>
    </div>`;
  modal.querySelector('.modal-card').classList.add('largo');
  modal.classList.remove('hidden');
  const tela = $('#bmw-tela');
  const pinta = () => {
    const larg = tela.clientWidth || 980;
    const k = Math.min(2, window.devicePixelRatio || 1);
    const W = larg, H = Math.round(larg * .5);
    tela.width = W * k; tela.height = H * k; tela.style.height = H + 'px';
    const c = tela.getContext('2d');
    c.setTransform(k, 0, 0, k, 0, 0);
    // parede de madeira ripada da sala, atrás do quadro
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#4a3220'); g.addColorStop(1, '#2a1c12');
    c.fillStyle = '#120c08'; c.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 14) { c.fillStyle = g; c.fillRect(x + 2, 0, 10, H); }
    const gl = c.createRadialGradient(W / 2, 0, 10, W / 2, H * .3, W * .6);
    gl.addColorStop(0, 'rgba(255,226,170,.28)'); gl.addColorStop(1, 'rgba(255,226,170,0)');
    c.fillStyle = gl; c.fillRect(0, 0, W, H);
    BMW.quadro(c, W * .08, H * .07, W * .84, H * .76, { legenda: true });
  };
  requestAnimationFrame(pinta);
  if (!BMW.pronto) BMW.foto.addEventListener('load', pinta, { once: true });
}
// a ficha comum não usa o modal largo
new MutationObserver(() => {
  if (modal.classList.contains('hidden')) modal.querySelector('.modal-card').classList.remove('largo');
  else modalAbertoEm = performance.now();
}).observe(modal, { attributes: true, attributeFilter: ['class'] });

/* ===========================================================
   ENTRADA — a torre vista da Faria Lima
   =========================================================== */
const entrada = $('#entrada');
function abrirEntrada() {
  entrada.classList.remove('hidden', 'saindo');
  CIDADE.iniciar($('#ent-cidade'));
}
function subirAoAndar() {
  entrada.classList.add('saindo');
  try { sessionStorage.setItem('nassa-entrou', '1'); } catch (e) { /* sem storage */ }
  setTimeout(() => { entrada.classList.add('hidden'); CIDADE.parar(); }, 600);
  NIT.calmaAte = performance.now() + 2500;   // o andar volta a aparecer: caches esquentando
  enquadraInicio();
}
$('#ent-subir').addEventListener('click', subirAoAndar);
$('#btn-predio').addEventListener('click', abrirEntrada);

/* ===========================================================
   RELÓGIO
   =========================================================== */
function tickClock() {
  const d = new Date();
  $('#clock').textContent = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const h = d.getHours();
  $('#shift').textContent = (h >= 8 && h < 18) ? 'expediente' : (h >= 18 && h < 23) ? 'turno da noite' : 'madrugada';
  aplicarAgenda();
}

/* ===========================================================
   LIGAÇÃO DA UI
   =========================================================== */
$$('.tab').forEach(b => b.addEventListener('click', () => {
  $$('.tab').forEach(x => x.classList.remove('active'));
  $$('.tabpane').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  $('#pane-' + b.dataset.tab).classList.add('active');
}));

$$('.chip').forEach(b => b.addEventListener('click', () => {
  $$('.chip').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  hireCat = b.dataset.cat;
  renderHire();
}));

$('#team-search').addEventListener('input', renderTeam);
$('#btn-allwork').addEventListener('click', () => { setAll('trabalhando'); toast('Equipe convocada para as estações.'); });
$('#btn-allrest').addEventListener('click', () => { setAll('descanso'); toast('Equipe liberada para a sala de jogos.'); });
$('#btn-report').addEventListener('click', openReport);
$('#btn-avisos').addEventListener('click', () => AVISOS_UI.abrir());
$('#btn-quadro').addEventListener('click', openQuadro);
$('#btn-voice').addEventListener('click', toggleVoice);
$('#btn-speak').addEventListener('click', () => speak(buildReport().fala));
$('#btn-panel').addEventListener('click', () => $('#panel').classList.toggle('open'));

/* painel da direita: a alça na borda do palco (ou a tecla P) esconde e
   mostra; o escritório passa a ocupar a largura toda. A escolha fica
   guardada neste navegador.                                           */
function painelVisivel(mostrar, guardar = true) {
  $('#app').classList.toggle('sem-painel', !mostrar);
  const alca = $('#btn-painel');
  alca.textContent = mostrar ? '›' : '‹';
  alca.title = (mostrar ? 'Esconder' : 'Mostrar') + ' o painel (tecla P)';
  alca.setAttribute('aria-expanded', String(mostrar));
  resize();
  if (guardar) try { localStorage.setItem('nassa-painel', mostrar ? 'aberto' : 'fechado'); } catch (e) { /* sem storage */ }
}
$('#btn-painel').addEventListener('click', () => painelVisivel($('#app').classList.contains('sem-painel')));
try { if (localStorage.getItem('nassa-painel') === 'fechado') painelVisivel(false, false); } catch (e) { /* sem storage */ }

$('#z-in').addEventListener('click',  () => { cam.ancora = null; cam.tz = limZ(cam.tz * 1.2); });
$('#z-out').addEventListener('click', () => { cam.ancora = null; cam.tz = limZ(cam.tz / 1.2); });
$('#z-fit').addEventListener('click', fit);

$('#opt-rgb').addEventListener('change',    e => opts.rgb = e.target.checked);
$('#opt-names').addEventListener('change',  e => opts.names = e.target.checked);
$('#opt-status').addEventListener('change', e => opts.status = e.target.checked);
$('#opt-paths').addEventListener('change',  e => opts.paths = e.target.checked);

$('#btn-export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ team: ROSTER.all(), v: 1 }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'equipe.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
$('#btn-import').addEventListener('click', () => $('#file-import').click());
$('#file-import').addEventListener('change', e => {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!Array.isArray(d.team)) throw 0;
      localStorage.setItem('escritorio-agentes-v1', JSON.stringify({ team: d.team, v: 1 }));
      // grava o importado no disco antes de recarregar, senão o load()
      // vai buscar no servidor e trazer de volta a equipe antiga
      fetch('/api/equipe', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
                             body: JSON.stringify({ team: d.team, v: 1 }) })
        .catch(() => {})
        .then(() => ROSTER.load())
        .then(() => { syncActors(); renderAll(); toast('Equipe importada.'); });
    } catch (_) { toast('Arquivo inválido.'); }
  };
  r.readAsText(f);
});
$('#btn-reset').addEventListener('click', async () => {
  if (!await confirmar('Restaurar o quadro padrão?',
      'Os agentes que você cadastrou à mão serão perdidos. Exporte antes se quiser guardar.',
      'Restaurar')) return;
  ROSTER.reset(); syncActors(); renderAll(); toast('Quadro restaurado.');
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!entrada.classList.contains('hidden')) subirAoAndar();
    else if (!mon.el.classList.contains('hidden')) fecharMonitor(); else closeModal();
  }
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'r' || e.key === 'R') openReport();
  if (e.key === 'f' || e.key === 'F') fit();
  if (e.key === 'q' || e.key === 'Q') openQuadro();
  // P esconde/mostra o painel; Cmd/Ctrl+P continua sendo imprimir
  if ((e.key === 'p' || e.key === 'P') && !e.ctrlKey && !e.metaKey && !e.altKey)
    painelVisivel($('#app').classList.contains('sem-painel'));
});

/* ===========================================================
   BOOT
   =========================================================== */
/* nome e subtítulo do topo vêm de data/config.json */
(function marca() {
  const E = window.ESCRITORIO || {};
  const local = [E.predio, E.andar ? E.andar + 'º andar' : ''].filter(Boolean).join(' · ');
  if (E.nome) document.title = E.nome + ' · Escritório';
  if (local) $('#brand-nome').textContent = local.toUpperCase();
  if (E.subtitulo !== undefined) $('#brand-sub').textContent = E.subtitulo;
  if (local) $('#ent-titulo').textContent = local;
  if (E.endereco) $('#ent-end').textContent = E.endereco;
  if (E.site) { $('#btn-site').href = E.site; $('#ent-site').href = E.site;
                $('#ent-site').textContent = E.site.replace(/^https?:\/\//, '').replace(/\/$/, '') + ' ↗'; }
})();
SISTEMAS.atualizar();
setInterval(() => SISTEMAS.atualizar(), 15000);
// a equipe vem do disco, então o boot espera por ela antes de montar o andar
ROSTER.load().then(() => { syncActors(); renderAll(); enquadraInicio(); });
syncActors();
{ const m = /[?&]nitidez=([\d.]+)/.exec(location.search); if (m) NIT.fixo = +m[1] || null; }
resize();
enquadraInicio();
NIT.calmaAte = performance.now() + 3000;     // a carga inicial monta todos os caches
renderAll();
tickClock();
setInterval(tickClock, 15000);
REUNIAO.ligarEventos();
setInterval(sincronizaReuniao, 4000);
setInterval(() => { renderStats(); if ($('#pane-equipe').classList.contains('active')) renderTeam(); }, 2500);
setInterval(renderRooms, 4000);
requestAnimationFrame(frame);

// atalho de depuração: __escritorio.olhar('Tati', 2.4) leva a câmera até alguém
window.__escritorio = {
  cam, actors, fit, focusTile, abrirMonitor, fecharMonitor, abrirBmw, abrirEntrada,
  enquadraInicio, zoomEm,
  /** escala de desenho em uso agora (3 = densidade do iPhone) */
  get escala() { return dpr; },
  /** __escritorio.nitidez(2) trava a escala; nitidez(null) volta ao automático.
      Sem argumento só conta como está. Também dá para abrir com ?nitidez=2 */
  nitidez(v) {
    if (v !== undefined) { NIT.fixo = v ? +v : null; NIT.janelas.length = 0; NIT.prova = null; resize(); }
    return { escala: dpr, degraus: NIT.degraus.slice(), degrau: NIT.i, fixo: NIT.fixo,
             telaDpr: window.devicePixelRatio || 1, canvas: [cv.width, cv.height], css: [cw, ch],
             historico: NIT.historico.slice() };
  },
  /** __escritorio.sistema("Tati") abre o monitor do sistema daquele agente */
  sistema(nome) {
    const a = ROSTER.all().find(a => a.name.toLowerCase().includes(String(nome).toLowerCase()));
    if (a) abrirMonitor(a);
    return a ? { nome: a.name, sistema: a.sistema } : null;
  },
  olhar(nome, z) {
    const ac = Array.from(actors.values())
      .find(a => a.a.name.toLowerCase().includes(String(nome).toLowerCase()));
    if (ac) { focusTile(ac.x, ac.y); cam.tz = z || 2.2; }
    return ac ? { nome: ac.a.name, x: ac.x, y: ac.y, sentado: ac.seated, act: ac.act } : null;
  }
};

// primeira visita da sessão: começa na calçada da Faria Lima, olhando a torre
let jaEntrou = false;
try { jaEntrou = sessionStorage.getItem('nassa-entrou') === '1'; } catch (e) { /* sem storage */ }
if (!jaEntrou && !/[?&]direto\b/.test(location.search)) abrirEntrada();
const dedoNaTela = window.matchMedia && matchMedia('(pointer: coarse)').matches;
setTimeout(() => toast(dedoNaTela
  ? 'Toque num boneco para abrir a ficha. Um dedo anda pelo andar, dois dedos dão zoom.'
  : 'Clique num boneco para abrir a ficha, ou no quadro da BMW na sala do chefe. Arraste para andar pelo andar.'), 900);

})();
