/* ===========================================================
   bmw.js — o quadro da sala do chefe
   BMW 335i E90 M Sport LCI (2009/2010), preto, com as rodas
   Style 359M de 19" em prata, em pixel art.

   A foto fica em assets/bmw-e90-335i.webp. O mesmo desenho serve
   para o quadro na parede do escritório e para a versão grande que
   abre ao clicar nele.
   =========================================================== */
const BMW = (() => {

  const foto = new Image();
  foto.src = 'assets/bmw-e90-335i.webp';
  const pronto = () => foto.complete && foto.naturalWidth > 0;
  const ouvintes = [];
  foto.addEventListener('load', () => ouvintes.forEach(f => f()));

  /* onde o carro está na foto (fração da imagem): o recorte do quadro
     sempre mantém o carro inteiro, de para-choque a para-choque */
  const CARRO = { x0: .04, x1: .96, y0: .27, y1: .77 };

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);         ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /** a foto preenchendo (fx, fy, fw, fh) sem cortar o carro */
  function pintaFoto(ctx, fx, fy, fw, fh) {
    if (!pronto()) {
      ctx.fillStyle = '#15181d'; ctx.fillRect(fx, fy, fw, fh);
      return;
    }
    const iw = foto.naturalWidth, ih = foto.naturalHeight;
    // cobre a área sem faixa nas laterais; o formato do quadro já é o
    // do carro, então o recorte vertical não chega a cortar teto nem roda
    const k = Math.max(fw / iw, Math.min(Math.max(fw / iw, fh / ih),
                                         fh / (ih * (CARRO.y1 - CARRO.y0 + .06))));
    const sw = fw / k, sh = fh / k;
    const cx = iw * (CARRO.x0 + CARRO.x1) / 2, cy = ih * (CARRO.y0 + CARRO.y1) / 2;
    const sx = Math.max(0, Math.min(iw - sw, cx - sw / 2));
    const sy = Math.max(0, Math.min(ih - sh, cy - sh / 2));
    ctx.save();
    // pixel art ampliada fica com o pixel nítido; reduzida, suaviza
    ctx.imageSmoothingEnabled = k < 1;
    ctx.fillStyle = '#2b2f35'; ctx.fillRect(fx, fy, fw, fh);
    ctx.drawImage(foto, sx, sy, Math.min(sw, iw), Math.min(sh, ih),
                  fx, fy + Math.max(0, (sh - ih) * k / 2), Math.min(sw, iw) * k, Math.min(sh, ih) * k);
    ctx.restore();
  }

  /**
   * Quadro emoldurado: moldura preta, paspatur branco e a foto.
   * (x, y, w, h) é a caixa externa da moldura.
   * opt.legenda = desenha a plaqueta com o nome do carro.
   */
  function quadro(ctx, x, y, w, h, opt = {}) {
    const m = Math.max(2, Math.min(w, h) * .045);     // moldura
    const pp = Math.max(2, Math.min(w, h) * .06);     // paspatur

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    rr(ctx, x + m * .6, y + m * 1.2, w, h, m * .6); ctx.fill();
    const gmo = ctx.createLinearGradient(x, y, x + w, y + h);
    gmo.addColorStop(0, '#2a2d33'); gmo.addColorStop(.5, '#0c0d10'); gmo.addColorStop(1, '#1e2025');
    ctx.fillStyle = gmo;
    rr(ctx, x, y, w, h, m * .5); ctx.fill();
    ctx.fillStyle = '#eceae4';
    ctx.fillRect(x + m, y + m, w - 2 * m, h - 2 * m);
    const fx = x + m + pp, fy = y + m + pp, fw = w - 2 * (m + pp), fh = h - 2 * (m + pp);
    ctx.beginPath(); ctx.rect(fx, fy, fw, fh); ctx.clip();
    pintaFoto(ctx, fx, fy, fw, fh);
    // sombra interna do paspatur
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = Math.max(1, m * .5);
    ctx.strokeRect(fx, fy, fw, fh);
    ctx.restore();

    // vidro do quadro: um reflexo diagonal leve
    ctx.save();
    ctx.beginPath(); ctx.rect(x + m, y + m, w - 2 * m, h - 2 * m); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,.07)';
    ctx.beginPath(); ctx.moveTo(x + w * .55, y); ctx.lineTo(x + w * .70, y);
    ctx.lineTo(x + w * .52, y + h); ctx.lineTo(x + w * .37, y + h); ctx.closePath(); ctx.fill();
    ctx.restore();

    if (opt.legenda) {
      const lw = Math.min(w * .5, 300), lh = Math.max(8, h * .075);
      const lx = x + w / 2 - lw / 2, ly = y + h + lh * .5;
      ctx.fillStyle = '#b9a46a';
      rr(ctx, lx, ly, lw, lh, lh * .2); ctx.fill();
      ctx.fillStyle = '#2a2414';
      ctx.font = `700 ${lh * .52}px 'Barlow Semi Condensed', sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('BMW 335i E90 M SPORT LCI · 2010', lx + lw / 2, ly + lh / 2 + .5);
    }
  }

  /** só o carro, recortado da foto (miniatura na estante) */
  function miniatura(ctx, x, y, w) {
    if (!pronto()) return;
    const iw = foto.naturalWidth, ih = foto.naturalHeight;
    const sx = iw * CARRO.x0, sy = ih * (CARRO.y0 + .01);
    const sw = iw * (CARRO.x1 - CARRO.x0), sh = ih * (CARRO.y1 - CARRO.y0);
    const h = w * sh / sw;
    ctx.save();
    ctx.fillStyle = '#2b2f35'; ctx.fillRect(x - 1, y - h - 1, w + 2, h + 2);
    ctx.drawImage(foto, sx, sy, sw, sh, x, y - h, w, h);
    ctx.restore();
  }

  return { foto, quadro, miniatura, get pronto() { return pronto(); }, onPronto: f => ouvintes.push(f) };
})();
