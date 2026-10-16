/* ===========================================================
   sistemas/base.js — utilidades comuns dos sistemas da equipe

   NT.dados('frontend')   guarda e lê o que é do sistema (localStorage,
                          com um espelho em memória se o navegador bloquear)
   NT.aviso('salvo')      aviso rápido no rodapé
   NT.brl(1500)           R$ 1.500,00
   NT.data('2026-10-15')  15/10/2026
   NT.esc(txt)            texto seguro para innerHTML
   NT.id()                identificador curto
   NT.baixar(nome, txt)   baixa um arquivo
   NT.copiar(txt)         copia para a área de transferência
   NT.abas(raiz)          liga botões .aba[data-aba] aos .painel-aba[data-aba]
   NT.modal(el)           abre/fecha um .modal-fundo
   NT.sistemas()          catálogo dos sistemas do escritório (catalogo.json)
   =========================================================== */
const NT = (() => {

  /* ---------- dados do sistema ---------- */
  const memoria = new Map();
  function dados(sistema) {
    const pre = 'nt-sis-' + sistema + ':';
    return {
      ler(chave, padrao) {
        try {
          const v = localStorage.getItem(pre + chave);
          if (v !== null) return JSON.parse(v);
        } catch (e) { /* storage bloqueado ou valor estragado */ }
        return memoria.has(pre + chave) ? memoria.get(pre + chave) : clonar(padrao);
      },
      gravar(chave, valor) {
        memoria.set(pre + chave, valor);
        try { localStorage.setItem(pre + chave, JSON.stringify(valor)); } catch (e) { /* fica na memória */ }
        return valor;
      },
      apagar(chave) {
        memoria.delete(pre + chave);
        try { localStorage.removeItem(pre + chave); } catch (e) { /* nada a fazer */ }
      }
    };
  }
  const clonar = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));

  /* ---------- formatos ---------- */
  const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const brl = n => fmtBRL.format(Number(n) || 0);
  const num = n => new Intl.NumberFormat('pt-BR').format(Number(n) || 0);
  function data(v) {
    if (!v) return '—';
    const d = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + 'T12:00:00') : new Date(v);
    return isNaN(d) ? '—' : d.toLocaleDateString('pt-BR');
  }
  const hora = v => new Date(v || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const hojeISO = (somaDias = 0) => {
    const d = new Date(); d.setDate(d.getDate() + somaDias);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const id = () => Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 6);

  /* ---------- aviso rápido ---------- */
  let elAviso = null, tAviso = 0;
  function aviso(msg) {
    if (!elAviso) {
      elAviso = document.createElement('div');
      elAviso.className = 'nt-toast';
      elAviso.setAttribute('role', 'status');
      document.body.appendChild(elAviso);
    }
    elAviso.textContent = msg;
    elAviso.classList.add('on');
    clearTimeout(tAviso);
    tAviso = setTimeout(() => elAviso.classList.remove('on'), 2600);
  }

  /* ---------- arquivos e área de transferência ---------- */
  function baixar(nome, conteudo, tipo = 'text/plain;charset=utf-8') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
    a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  async function copiar(txt) {
    try { await navigator.clipboard.writeText(txt); aviso('Copiado.'); return true; }
    catch (e) {
      // iframe sem permissão de clipboard: cai no jeito antigo
      const t = document.createElement('textarea');
      t.value = txt; t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
      t.remove();
      aviso(ok ? 'Copiado.' : 'Não consegui copiar — selecione e copie à mão.');
      return ok;
    }
  }

  /* ---------- abas ---------- */
  function abas(raiz = document, aoTrocar) {
    const botoes = raiz.querySelectorAll('.aba[data-aba]');
    botoes.forEach(b => b.addEventListener('click', () => {
      botoes.forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); });
      raiz.querySelectorAll('.painel-aba[data-aba]').forEach(p => p.classList.toggle('on', p.dataset.aba === b.dataset.aba));
      if (aoTrocar) aoTrocar(b.dataset.aba);
    }));
  }

  /* ---------- janela modal ---------- */
  /* Esc fecha só a janela de cima, e o foco volta para quem a abriu */
  const abertos = [];
  function fechar(fundo) {
    fundo.hidden = true;
    const i = abertos.findIndex(x => x.fundo === fundo);
    if (i >= 0) {
      const { origem } = abertos.splice(i, 1)[0];
      if (origem && document.contains(origem)) origem.focus();
    }
  }
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    while (abertos.length && abertos[abertos.length - 1].fundo.hidden) abertos.pop();
    if (abertos.length) fechar(abertos[abertos.length - 1].fundo);
  });
  function modal(fundo, abrir = true) {
    if (!abrir) { fechar(fundo); return; }
    fundo.hidden = false;
    if (!abertos.some(x => x.fundo === fundo)) abertos.push({ fundo, origem: document.activeElement });
    const primeiro = fundo.querySelector('input,select,textarea,button');
    if (primeiro) setTimeout(() => primeiro.focus(), 30);
    if (!fundo.dataset.ligado) {
      fundo.dataset.ligado = '1';
      fundo.addEventListener('click', e => { if (e.target === fundo) fechar(fundo); });
    }
  }

  /* ---------- catálogo dos sistemas do escritório ---------- */
  let catalogo = null;
  async function sistemas() {
    if (catalogo) return catalogo;
    try {
      const d = await (await fetch('../catalogo.json', { cache: 'no-store' })).json();
      catalogo = Object.entries(d).filter(([k]) => !k.startsWith('_')).map(([k, v]) => Object.assign({ id: k }, v));
    } catch (e) { catalogo = []; }
    return catalogo;
  }

  return { dados, brl, num, data, hora, hojeISO, esc, id, aviso, baixar, copiar, abas, modal, sistemas };
})();
