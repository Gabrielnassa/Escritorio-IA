/* ===========================================================
   sistemas/design/app.js — Design System Nassa (Lia · UI/UX Design)

   A marca da Nassa Tech documentada e testável:
   - Cores: paleta fixa da marca + cores que a equipe cria para clientes,
     com contraste WCAG calculado de verdade (luminância relativa).
   - Contraste: verificador de qualquer par, com sugestão de tom acessível.
   - Tipografia, componentes, espaçamento, ícones e exportação de tokens.
   O que muda (cores próprias, ajustes, formato) fica em NT.dados('design').
   =========================================================== */
(() => {
'use strict';

const D = NT.dados('design');
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = NT.esc;

/* ---------- paleta da marca (fixa: é a identidade, não se apaga) ---------- */
const MARCA = [
  { slug: 'fundo', nome: 'Fundo Noite', hex: '#05070D', grupo: 'marca', uso: 'Fundo de todas as telas e do escritório' },
  { slug: 'branco', nome: 'Branco Gelo', hex: '#F2F6FF', grupo: 'marca', uso: 'Texto principal sobre o fundo escuro' },
  { slug: 'ciano', nome: 'Ciano Nassa', hex: '#00B3FF', grupo: 'marca', uso: 'Destaques, links e aba ativa' },
  { slug: 'azul', nome: 'Azul Elétrico', hex: '#2F5BFF', grupo: 'marca', uso: 'Fim do gradiente do botão primário' },
  { slug: 'painel', nome: 'Painel', hex: '#0C1019', grupo: 'neutro', uso: 'Cartões e blocos' },
  { slug: 'painel-2', nome: 'Painel elevado', hex: '#121826', grupo: 'neutro', uso: 'Botões secundários e caixas internas' },
  { slug: 'linha', nome: 'Linha', hex: '#1F2840', grupo: 'neutro', uso: 'Bordas e divisórias' },
  { slug: 'linha-forte', nome: 'Linha forte', hex: '#2C3757', grupo: 'neutro', uso: 'Borda de campos e botões' },
  { slug: 'texto-2', nome: 'Texto secundário', hex: '#8A95AD', grupo: 'neutro', uso: 'Legendas, rótulos e descrições' },
  { slug: 'texto-3', nome: 'Texto apagado', hex: '#5F6A85', grupo: 'neutro', uso: 'Só para detalhes grandes ou decorativos' },
  { slug: 'ok', nome: 'Sucesso', hex: '#23E08A', grupo: 'semantica', uso: 'Pago, no ar, aprovado' },
  { slug: 'aviso', nome: 'Aviso', hex: '#FFB020', grupo: 'semantica', uso: 'Prazo perto, aguardando cliente' },
  { slug: 'erro', nome: 'Erro', hex: '#FF6B6B', grupo: 'semantica', uso: 'Falha, atrasado, campo inválido' },
  { slug: 'roxo', nome: 'Roxo informativo', hex: '#9D8CFF', grupo: 'semantica', uso: 'Propostas e itens de IA' }
];
const GRUPOS = { marca: 'Marca', neutro: 'Neutros', semantica: 'Semânticas', pers: 'Personalizadas · cores de clientes' };
const FUNDO = '#05070D', BRANCO = '#F2F6FF';

// cores de projetos de clientes que a Lia já cadastrou (exemplo)
const EXEMPLO_PERS = [
  { id: 'p-mel', slug: 'mel', nome: 'Mel dourado', hex: '#E0A030', uso: 'Padaria Pão de Mel — botão de encomenda' },
  { id: 'p-sorriso', slug: 'verde-sorriso', nome: 'Verde Sorriso', hex: '#12A88A', uso: 'Clínica Sorriso — agenda online' },
  { id: 'p-duarte', slug: 'vinho-duarte', nome: 'Vinho Duarte', hex: '#7A1F33', uso: 'Advocacia Duarte — portal do cliente' }
];
const EXEMPLO_TIPO = { base: 16, razao: 1.25, amostra: 'A Nassa Tech transforma ideias em sites, sistemas e apps que vendem.' };

const ESPACOS = [['1', 4], ['2', 8], ['3', 12], ['4', 16], ['5', 24], ['6', 32], ['7', 48], ['8', 64]];
const RAIOS = [['sm', 4], ['md', 8], ['lg', 12], ['xl', 16], ['pill', 999]];
const SOMBRA = '0 14px 38px rgba(0, 0, 0, .55)';
const FONTES = {
  display: "'Barlow', 'Segoe UI', system-ui, sans-serif",
  ui: "'Barlow Semi Condensed', 'Segoe UI', system-ui, sans-serif",
  mono: "'JetBrains Mono', Consolas, monospace"
};
// níveis da escala: expoente aplicado à razão a partir do corpo
const NIVEIS = [
  { id: 'display', nome: 'Display', exp: 5, lh: 1.05, peso: 700, fonte: 'display', uso: 'Capa do site e números de destaque' },
  { id: 'h1', nome: 'Título 1', exp: 4, lh: 1.15, peso: 700, fonte: 'display', uso: 'Título da página' },
  { id: 'h2', nome: 'Título 2', exp: 3, lh: 1.2, peso: 700, fonte: 'display', uso: 'Seções' },
  { id: 'h3', nome: 'Título 3', exp: 2, lh: 1.25, peso: 600, fonte: 'display', uso: 'Cartões e janelas' },
  { id: 'h4', nome: 'Título 4', exp: 1, lh: 1.3, peso: 600, fonte: 'ui', uso: 'Subtítulos e grupos de campos' },
  { id: 'corpo', nome: 'Corpo', exp: 0, lh: 1.5, peso: 500, fonte: 'ui', uso: 'Parágrafos e interface' },
  { id: 'legenda', nome: 'Legenda', exp: -1, lh: 1.4, peso: 500, fonte: 'ui', uso: 'Rótulos, datas e notas' }
];
const DONOS = {
  frontend: 'Lucas', backend: 'Marina', fullstack: 'Rafa', mobile: 'Bia', devops: 'Dani',
  qa: 'Theo', design: 'Lia', ia: 'Nico', comercial: 'Duda'
};

/* ---------- estado salvo ---------- */
let pers, ctr, tipo, tk, chaves;
function carregar() {
  pers = D.ler('personalizadas', EXEMPLO_PERS);
  ctr = D.ler('contraste', { fg: '#00B3FF', bg: FUNDO, alvo: 'fg' });
  tipo = Object.assign({}, EXEMPLO_TIPO, D.ler('tipo', {}));
  tk = Object.assign({ fmt: 'css', prefixo: 'nt' }, D.ler('tokens', {}));
  chaves = D.ler('chaves', { lembrete: true });
}
carregar();

const todas = () => MARCA.concat(pers.map(p => Object.assign({ grupo: 'pers' }, p)));
const varNome = slug => '--' + (tk.prefixo ? tk.prefixo + '-' : '') + slug;

/* ===========================================================
   matemática de cor (WCAG 2.1)
   =========================================================== */
function normHex(v) {
  v = String(v || '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(v)) v = v.replace(/./g, c => c + c);
  return /^[0-9a-f]{6}$/i.test(v) ? '#' + v.toUpperCase() : null;
}
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function lum(h) {
  const [r, g, b] = rgb(h).map(c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function razao(a, b) {
  const la = lum(a), lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
// trunca em vez de arredondar: 4,499 não pode aparecer como "4,50" e reprovar
const fmtR = r => (Math.floor(r * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function nivel(r) {
  if (r >= 7) return { txt: 'AAA', cls: 'ok' };
  if (r >= 4.5) return { txt: 'AA', cls: 'ok' };
  if (r >= 3) return { txt: 'AA grande', cls: 'warn' };
  return { txt: 'Falha', cls: 'err' };
}
const badgeNivel = r => { const n = nivel(r); return `<span class="badge ${n.cls}">${n.txt}</span>`; };
// texto legível em cima de uma amostra de cor
const tinta = h => razao(h, '#FFFFFF') >= razao(h, FUNDO) ? '#FFFFFF' : FUNDO;

function hsl(h) {
  let [r, g, b] = rgb(h).map(c => c / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let hh = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hh *= 60;
  }
  return [hh, s * 100, l * 100];
}
function hslHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}
// anda na luminosidade mantendo matiz e saturação até bater o alvo;
// tenta primeiro o sentido natural (fundo escuro → clarear o texto)
function ajustar(fg, bg, alvo) {
  const [h, s, l] = hsl(fg);
  const sentidos = lum(bg) < 0.18 ? [1, -1] : [-1, 1];
  for (const dir of sentidos) {
    for (let x = l; x >= 0 && x <= 100; x += dir * 0.5) {
      const c = hslHex(h, s, x);
      if (razao(c, bg) >= alvo) return c;
    }
  }
  return null;
}
const slugify = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'cor';

/* ===========================================================
   resumo do topo
   =========================================================== */
function renderKpis() {
  const cs = todas();
  const aa = cs.filter(c => razao(c.hex, FUNDO) >= 4.5).length;
  $('#kpis').innerHTML = `
    <div class="kpi acc"><b>${cs.length}</b><span>Cores na paleta</span></div>
    <div class="kpi ok"><b>${aa} de ${cs.length}</b><span>Passam AA no fundo</span></div>
    <div class="kpi"><b>${pers.length}</b><span>Cores de clientes</span></div>
    <div class="kpi"><b>${contarTokens()}</b><span>Tokens exportáveis</span></div>`;
}

/* ===========================================================
   cores
   =========================================================== */
function renderPaleta() {
  const cs = todas();
  $('#paleta').innerHTML = Object.keys(GRUPOS).map(g => {
    const lista = cs.filter(c => c.grupo === g);
    const corpo = lista.length ? lista.map(cartaoCor).join('')
      : '<div class="vazio">Nenhuma cor de cliente ainda. Use “Nova cor” para cadastrar a primeira.</div>';
    return `<h2 class="titulo-secao">${GRUPOS[g]} <span class="dim">· ${lista.length}</span></h2>
      <div class="grade-cores${lista.length ? '' : ' so-vazio'}">${corpo}</div>`;
  }).join('');
  renderKpis();
}
function cartaoCor(c) {
  const rB = razao(c.hex, BRANCO), rF = razao(c.hex, FUNDO);
  const v = varNome(c.slug);
  return `<article class="cor">
    <button type="button" class="cor-amostra" style="background:${c.hex};color:${tinta(c.hex)}" data-copiar="${c.hex}" aria-label="Copiar ${c.hex} (${esc(c.nome)})">
      <span class="mono">${c.hex}</span><small>copiar</small></button>
    <div class="cor-info">
      <b>${esc(c.nome)}</b>
      ${c.uso ? `<div class="cor-uso">${esc(c.uso)}</div>` : ''}
      <dl class="cor-cod">
        <div><dt>RGB</dt><dd class="mono">${rgb(c.hex).join(', ')}</dd></div>
        <div><dt>CSS</dt><dd><button type="button" class="link mono" data-copiar="var(${v})" title="Copiar var(${v})">${v}</button></dd></div>
      </dl>
      <div class="cor-ctr">
        <div><span>Com branco</span><b class="mono">${fmtR(rB)}</b>${badgeNivel(rB)}</div>
        <div><span>No fundo</span><b class="mono">${fmtR(rF)}</b>${badgeNivel(rF)}</div>
      </div>
      <div class="cor-acoes">
        <button type="button" class="btn mini ghost" data-testar="${c.hex}">Testar contraste</button>
        ${c.grupo === 'pers' ? `<button type="button" class="btn mini danger" data-apagar="${esc(c.id)}">Excluir</button>` : ''}
      </div>
    </div>
  </article>`;
}

$('#paleta').addEventListener('click', e => {
  const t = e.target.closest('[data-testar]');
  if (t) { definirPar(t.dataset.testar, FUNDO); irPara('contraste'); return; }
  const a = e.target.closest('[data-apagar]');
  if (a) {
    const c = pers.find(p => p.id === a.dataset.apagar);
    if (!c || !confirm(`Excluir a cor “${c.nome}” (${c.hex}) da paleta?\nEla também sai dos tokens exportados.`)) return;
    pers = pers.filter(p => p !== c);
    D.gravar('personalizadas', pers);
    tudo();
    NT.aviso(`Cor “${c.nome}” excluída.`);
  }
});

/* ---------- janela: nova cor ---------- */
const mCor = $('#mCor'), fCor = $('#fCor');
function abrirNovaCor() {
  fCor.reset();
  $('#fPick').value = '#ff7a1a'; $('#fHex').value = '#FF7A1A';
  $('#fErro').textContent = '';
  previaNova();
  NT.modal(mCor, true);
}
function previaNova() {
  const h = normHex($('#fHex').value);
  if (!h) { $('#fPrevia').innerHTML = '<span class="dim">Digite um hexadecimal como #FF7A1A.</span>'; return; }
  const rB = razao(h, BRANCO), rF = razao(h, FUNDO);
  $('#fPrevia').innerHTML = `<i style="background:${h};color:${tinta(h)}">Aa</i>
    <div><span>Com branco <b class="mono">${fmtR(rB)}</b> ${badgeNivel(rB)}</span>
    <span>No fundo <b class="mono">${fmtR(rF)}</b> ${badgeNivel(rF)}</span></div>`;
}
$('#bNovaCor').addEventListener('click', abrirNovaCor);
// ao fechar, o foco volta para quem abriu a janela (teclado não se perde)
const fecharNovaCor = () => { NT.modal(mCor, false); $('#bNovaCor').focus(); };
$('#bCancelarCor').addEventListener('click', fecharNovaCor);
$('#fPick').addEventListener('input', e => { $('#fHex').value = e.target.value.toUpperCase(); previaNova(); });
$('#fHex').addEventListener('input', () => { const h = normHex($('#fHex').value); if (h) $('#fPick').value = h.toLowerCase(); previaNova(); });
fCor.addEventListener('submit', e => {
  e.preventDefault();
  const nome = $('#fNome').value.trim(), hex = normHex($('#fHex').value), uso = $('#fUso').value.trim();
  const erro = msg => { $('#fErro').textContent = msg; };
  if (!nome) return erro('Dê um nome para a cor.'), $('#fNome').focus();
  if (!hex) return erro('O hexadecimal precisa ter 3 ou 6 dígitos, como #FF7A1A.'), $('#fHex').focus();
  if (todas().some(c => c.nome.toLowerCase() === nome.toLowerCase())) return erro(`Já existe uma cor chamada “${nome}”.`), $('#fNome').focus();
  // a variável CSS precisa ser única mesmo que dois nomes deem o mesmo slug
  const usados = new Set(todas().map(c => c.slug));
  let slug = slugify(nome), n = 2;
  while (usados.has(slug)) slug = slugify(nome) + '-' + n++;
  pers.push({ id: NT.id(), slug, nome, hex, uso });
  D.gravar('personalizadas', pers);
  fecharNovaCor();
  tudo();
  NT.aviso(`Cor “${nome}” adicionada · ${varNome(slug)}`);
});

/* ===========================================================
   verificador de contraste
   =========================================================== */
function definirPar(fg, bg) {
  ctr.fg = normHex(fg) || ctr.fg;
  ctr.bg = normHex(bg) || ctr.bg;
  D.gravar('contraste', ctr);
  renderContraste();
}
function renderContraste() {
  const { fg, bg } = ctr;
  // não reescreve o campo que a pessoa está digitando
  if (document.activeElement !== $('#cTxtHex')) $('#cTxtHex').value = fg;
  if (document.activeElement !== $('#cFundoHex')) $('#cFundoHex').value = bg;
  $('#cTxtPick').value = fg.toLowerCase();
  $('#cFundoPick').value = bg.toLowerCase();
  const pv = $('#previa');
  pv.style.background = bg; pv.style.color = fg;
  pv.style.setProperty('--fg', fg); pv.style.setProperty('--bg', bg);
  const r = razao(fg, bg);
  $('#razao').textContent = fmtR(r) + ':1';
  $('#razao').className = nivel(r).cls;
  $('#razaoTxt').textContent = r >= 7 ? 'Nível AAA — serve para qualquer texto.'
    : r >= 4.5 ? 'Nível AA — aprovado para texto normal.'
    : r >= 3 ? 'Só para texto grande, ícones e bordas.'
    : 'Reprovado — não use este par para texto.';
  const crit = [
    ['AA', 'Texto normal', 4.5], ['AA', 'Texto grande', 3],
    ['AAA', 'Texto normal', 7], ['AAA', 'Texto grande', 4.5]
  ];
  $('#criterios').innerHTML = crit.map(([n, t, min]) => {
    const ok = r >= min;
    return `<div class="crit ${ok ? 'ok' : 'err'}"><b>${n}</b><span>${t}<small>mínimo ${String(min).replace('.', ',')}:1</small></span>
      <span class="badge ${ok ? 'ok' : 'err'}">${ok ? '✓ Passa' : '✕ Falha'}</span></div>`;
  }).join('');
  $$('[data-alvo]').forEach(b => b.setAttribute('aria-pressed', b.dataset.alvo === (ctr.alvo || 'fg')));
}
function renderChips() {
  $('#chipsPaleta').innerHTML = todas().map(c =>
    `<button type="button" class="chip" data-cor="${c.hex}" title="${c.hex}"><i style="background:${c.hex}"></i>${esc(c.nome)}</button>`).join('');
}
function renderMatriz() {
  const fundos = [MARCA[0], MARCA[4], MARCA[5], MARCA[1]];
  const textos = todas().filter(c => !['fundo', 'painel', 'painel-2', 'linha', 'linha-forte'].includes(c.slug));
  $('#matriz').innerHTML = `<thead><tr><th>Texto \\ fundo</th>${fundos.map(f =>
    `<th><span class="amostrinha" style="background:${f.hex}"></span>${esc(f.nome)}</th>`).join('')}</tr></thead>
    <tbody>${textos.map(t => `<tr><th scope="row"><span class="amostrinha" style="background:${t.hex}"></span>${esc(t.nome)}</th>${fundos.map(f => {
      if (t.hex === f.hex) return '<td class="dim">—</td>';
      const r = razao(t.hex, f.hex);
      return `<td><button type="button" class="celula" data-fg="${t.hex}" data-bg="${f.hex}" aria-label="${esc(t.nome)} sobre ${esc(f.nome)}: ${fmtR(r)} para 1">
        <i style="background:${f.hex};color:${t.hex}">Aa</i><span class="mono">${fmtR(r)}</span>${badgeNivel(r)}</button></td>`;
    }).join('')}</tr>`).join('')}</tbody>`;
}

function ligarHex(txt, pick, chave) {
  $(pick).addEventListener('input', e => definirPar(chave === 'fg' ? e.target.value : ctr.fg, chave === 'bg' ? e.target.value : ctr.bg));
  $(txt).addEventListener('input', e => {
    const h = normHex(e.target.value);
    $(txt).classList.toggle('erro', !h && e.target.value.length >= 4);
    if (h) definirPar(chave === 'fg' ? h : ctr.fg, chave === 'bg' ? h : ctr.bg);
  });
  $(txt).addEventListener('blur', e => { e.target.classList.remove('erro'); e.target.value = ctr[chave]; });
}
ligarHex('#cTxtHex', '#cTxtPick', 'fg');
ligarHex('#cFundoHex', '#cFundoPick', 'bg');
$('#bInverter').addEventListener('click', () => { definirPar(ctr.bg, ctr.fg); NT.aviso('Texto e fundo trocados.'); });
$('#bSugerir').addEventListener('click', () => {
  const r = razao(ctr.fg, ctr.bg);
  if (r >= 7) return NT.aviso('Este par já passa no AAA. Nada a ajustar.');
  const alvo = r >= 4.5 ? 7 : 4.5;
  const novo = ajustar(ctr.fg, ctr.bg, alvo);
  if (!novo) return NT.aviso('Não achei um tom desse matiz que passe — tente outro fundo.');
  const antes = ctr.fg;
  definirPar(novo, ctr.bg);
  NT.aviso(`${antes} → ${novo}: ${fmtR(razao(novo, ctr.bg))}:1, passa no ${alvo === 7 ? 'AAA' : 'AA'}.`);
});
$$('[data-alvo]').forEach(b => b.addEventListener('click', () => {
  ctr.alvo = b.dataset.alvo; D.gravar('contraste', ctr); renderContraste();
}));
$('#chipsPaleta').addEventListener('click', e => {
  const c = e.target.closest('[data-cor]');
  if (!c) return;
  if ((ctr.alvo || 'fg') === 'bg') definirPar(ctr.fg, c.dataset.cor); else definirPar(c.dataset.cor, ctr.bg);
});
$('#matriz').addEventListener('click', e => {
  const c = e.target.closest('.celula');
  if (!c) return;
  definirPar(c.dataset.fg, c.dataset.bg);
  $('#formContraste').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

/* ===========================================================
   tipografia
   =========================================================== */
function escala() {
  return NIVEIS.map(n => Object.assign({}, n, { px: Math.round(tipo.base * Math.pow(tipo.razao, n.exp)) }));
}
function renderTipo() {
  $('#tBase').value = String(tipo.base);
  $('#tRazao').value = String(tipo.razao);
  if (document.activeElement !== $('#tAmostra')) $('#tAmostra').value = tipo.amostra;
  const txt = esc(tipo.amostra.trim() || EXEMPLO_TIPO.amostra);
  $('#escala').innerHTML = escala().map(n => {
    const fam = n.fonte === 'display' ? 'Barlow' : 'Barlow Semi Condensed';
    return `<article class="nivel">
      <div class="nivel-meta">
        <div class="linha-t"><b>${n.nome}</b><span class="badge">${n.id}</span></div>
        <div class="mono dim">${n.px} px · ${(n.px / 16).toFixed(3).replace(/\.?0+$/, '').replace('.', ',')} rem</div>
        <div class="dim pequeno">altura ${String(n.lh).replace('.', ',')} · peso ${n.peso} · ${fam}</div>
        <div class="dim pequeno">${n.uso}</div>
        <button type="button" class="btn mini ghost" data-copiar="font: ${n.peso} ${n.px}px/${n.lh} ${FONTES[n.fonte]};">⧉ Copiar CSS</button>
      </div>
      <p class="nivel-amostra" style="font-family:var(--f-${n.fonte === 'display' ? 'display' : 'ui'});font-size:${n.px}px;line-height:${n.lh};font-weight:${n.peso}">${txt}</p>
    </article>`;
  }).join('');
}
function salvarTipo() { D.gravar('tipo', tipo); renderTipo(); renderKpis(); renderTokens(); }
$('#tAmostra').addEventListener('input', e => { tipo.amostra = e.target.value; salvarTipo(); });
$('#tBase').addEventListener('change', e => { tipo.base = +e.target.value; salvarTipo(); NT.aviso(`Corpo em ${tipo.base} px — escala recalculada.`); });
$('#tRazao').addEventListener('change', e => { tipo.razao = +e.target.value; salvarTipo(); NT.aviso('Razão da escala atualizada.'); });

/* ===========================================================
   componentes
   =========================================================== */
const CSS_BTN = `.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;
  border-radius:10px;border:1px solid var(--line-2);background:var(--panel-2);
  color:var(--txt);font-weight:600;font-size:14px;cursor:pointer}
.btn:hover{border-color:#3d477a;background:#16203a}
.btn:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
.btn:disabled{opacity:.45;cursor:not-allowed}
.btn.primary{background:linear-gradient(135deg,#00b3ff,#2f5bff);border-color:transparent;color:#fff}
.btn.primary:hover{filter:brightness(1.08)}
.btn.ghost{background:transparent}
.btn.danger{color:#ff8a7d;border-color:rgba(255,90,70,.35)}`;

const VARIANTES = [['primary', 'Primário', 'Salvar'], ['', 'Secundário', 'Cancelar'], ['ghost', 'Fantasma', 'Ver mais'], ['danger', 'Perigo', 'Excluir']];

const COMPONENTES = [
  {
    id: 'botoes', titulo: 'Botões', desc: 'Um primário por tela. Perigo só para ação que apaga algo, sempre com confirmação.',
    demo: () => `<div class="rolagem"><div class="btn-grade">
      <span class="canto"></span><span class="rot">Normal</span><span class="rot">Hover</span><span class="rot">Desabilitado</span>
      ${VARIANTES.map(([c, nome, rot]) => `<span class="rot v-nome">${nome}</span>
        <button type="button" class="btn ${c}" data-demo="${nome}">${rot}</button>
        <button type="button" class="btn ${c} f-hover" data-demo="${nome} (hover)">${rot}</button>
        <button type="button" class="btn ${c}" disabled>${rot}</button>`).join('')}
    </div></div>`,
    nota: () => `Rótulo branco: ${fmtR(razao('#FFFFFF', '#2F5BFF'))}:1 no azul, mas só ${fmtR(razao('#FFFFFF', '#00B3FF'))}:1 no ciano — o primário usa sempre o gradiente inteiro; nunca ponha texto branco sobre ciano puro.`,
    html: `<button type="button" class="btn primary">Salvar</button>
<button type="button" class="btn">Cancelar</button>
<button type="button" class="btn ghost">Ver mais</button>
<button type="button" class="btn danger">Excluir</button>
<button type="button" class="btn primary" disabled>Salvar</button>`,
    css: CSS_BTN
  },
  {
    id: 'campos', titulo: 'Campos', desc: 'Rótulo sempre visível acima do campo; o placeholder é só exemplo, nunca instrução.',
    demo: () => `<div class="campos-demo">
      <div><label class="rot" for="dNormal">Normal</label><input class="campo" id="dNormal" placeholder="Padaria Pão de Mel"></div>
      <div><label class="rot" for="dFoco">Foco</label><input class="campo f-foco" id="dFoco" value="Clínica Sorriso"></div>
      <div><label class="rot" for="dErro">Erro</label><input class="campo erro" id="dErro" value="contato@academiaforca" aria-invalid="true" aria-describedby="dErroMsg">
        <p class="msg-erro" id="dErroMsg">Informe um e-mail válido, como contato@academiaforcatotal.com.br.</p></div>
    </div>`,
    nota: () => `Borda de erro ${fmtR(razao('#FF6B6B', '#0A0D16'))}:1 sobre o campo — a mensagem em texto é obrigatória, a cor sozinha não basta.`,
    html: `<label class="rot" for="email">E-mail</label>
<input class="campo" id="email" type="email" placeholder="contato@padariapaodemel.com.br">

<!-- com erro: cada campo tem o próprio id -->
<label class="rot" for="email-cobranca">E-mail de cobrança</label>
<input class="campo erro" id="email-cobranca" type="email" aria-invalid="true" aria-describedby="email-cobranca-erro">
<p class="msg-erro" id="email-cobranca-erro">Informe um e-mail válido.</p>`,
    css: `.rot{display:block;font-size:12px;color:var(--txt-dim);margin:0 0 5px}
.campo{width:100%;padding:9px 11px;border-radius:9px;border:1px solid var(--line-2);
  background:var(--bg-2);color:var(--txt);font-size:14px;outline:none}
.campo:focus{border-color:var(--acc);box-shadow:0 0 0 3px rgba(0,179,255,.18)}
.campo.erro{border-color:var(--err)}
.msg-erro{color:var(--err);font-size:12.5px;margin:5px 0 0}`
  },
  {
    id: 'badges', titulo: 'Etiquetas', desc: 'Situação de um item. Texto curto, em maiúsculas, sempre com a palavra — não só a cor.',
    demo: () => `<div class="linha">
      <span class="badge ok">Pago</span><span class="badge warn">Aguardando cliente</span><span class="badge err">Atrasado</span>
      <span class="badge acc">Em produção</span><span class="badge roxo">Proposta enviada</span><span class="badge">Rascunho</span></div>`,
    nota: () => `Menor contraste do grupo: roxo ${fmtR(razao('#9D8CFF', '#0C1019'))}:1 sobre o painel — passa AA.`,
    html: `<span class="badge ok">Pago</span>
<span class="badge warn">Aguardando cliente</span>
<span class="badge err">Atrasado</span>
<span class="badge acc">Em produção</span>
<span class="badge roxo">Proposta enviada</span>
<span class="badge">Rascunho</span>`,
    css: `.badge{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;
  letter-spacing:.5px;text-transform:uppercase;padding:3px 8px;border-radius:999px;
  background:var(--panel-2);color:var(--txt-dim);border:1px solid var(--line)}
.badge.ok{color:var(--ok);background:rgba(35,224,138,.1);border-color:rgba(35,224,138,.25)}
.badge.warn{color:var(--warn);background:rgba(255,176,32,.1);border-color:rgba(255,176,32,.25)}
.badge.err{color:var(--err);background:rgba(255,107,107,.1);border-color:rgba(255,107,107,.25)}
.badge.acc{color:var(--acc);background:rgba(0,179,255,.1);border-color:rgba(0,179,255,.25)}
.badge.roxo{color:var(--roxo);background:rgba(157,140,255,.1);border-color:rgba(157,140,255,.25)}`
  },
  {
    id: 'cards', titulo: 'Cartões', desc: 'Agrupam um assunto. Título em Barlow, ação no rodapé, número de destaque no KPI.',
    demo: () => `<div class="cards-demo">
      <div class="card"><div class="linha entre"><h3>Site Imobiliária Horizonte</h3><span class="badge acc">Em produção</span></div>
        <p class="dim pequeno">Busca de imóveis por bairro e WhatsApp do corretor. Entrega prevista para ${NT.data(NT.hojeISO(12))}.</p>
        <button type="button" class="btn mini" data-demo="Abrir projeto">Abrir projeto</button></div>
      <div class="kpi ok"><b>${NT.brl(18400)}</b><span>Recebido no mês</span></div>
    </div>`,
    nota: () => `Texto secundário sobre o painel: ${fmtR(razao('#8A95AD', '#0C1019'))}:1 — AA para descrições.`,
    html: `<div class="card">
  <h3>Site Imobiliária Horizonte</h3>
  <p class="dim">Busca de imóveis por bairro e WhatsApp do corretor.</p>
  <button type="button" class="btn mini">Abrir projeto</button>
</div>

<div class="kpi ok"><b>R$ 18.400,00</b><span>Recebido no mês</span></div>`,
    css: `.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px}
.card h3{margin:0 0 10px;font-family:var(--f-display);font-size:16px}
.kpi{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.kpi b{display:block;font-family:var(--f-display);font-size:24px;line-height:1.1}
.kpi span{font-size:12px;color:var(--txt-dim);text-transform:uppercase;letter-spacing:.4px}
.kpi.ok b{color:var(--ok)}`
  },
  {
    id: 'toggle', titulo: 'Interruptor', desc: 'Liga e desliga na hora, sem botão de salvar. Por baixo é um checkbox, então funciona no teclado.',
    demo: () => `<div class="toggles">
      <label class="chave" for="tgLembrete"><input type="checkbox" id="tgLembrete" ${chaves.lembrete ? 'checked' : ''}><span class="trilho" aria-hidden="true"></span><span>Lembrete por WhatsApp</span></label>
      <label class="chave" for="tgDesl"><input type="checkbox" id="tgDesl" ${chaves.relatorio ? 'checked' : ''}><span class="trilho" aria-hidden="true"></span><span>Relatório semanal por e-mail</span></label>
      <label class="chave off" for="tgDes"><input type="checkbox" id="tgDes" disabled><span class="trilho" aria-hidden="true"></span><span>Cobrança automática (desabilitado)</span></label>
    </div>`,
    nota: () => `Trilho ligado: ciano ${fmtR(razao('#00B3FF', '#0C1019'))}:1 contra o painel — acima dos 3:1 pedidos para componentes.`,
    html: `<label class="chave" for="lembrete">
  <input type="checkbox" id="lembrete" checked>
  <span class="trilho" aria-hidden="true"></span>
  <span>Lembrete por WhatsApp</span>
</label>`,
    css: `.chave{display:inline-flex;align-items:center;gap:9px;cursor:pointer;font-weight:600}
.chave input{position:absolute;opacity:0;width:1px;height:1px}
.chave .trilho{width:38px;height:22px;border-radius:99px;background:var(--panel-3);
  border:1px solid var(--line-2);position:relative;transition:.15s}
.chave .trilho::after{content:"";position:absolute;top:3px;left:3px;width:14px;height:14px;
  border-radius:50%;background:var(--txt-dim);transition:.15s}
.chave input:checked + .trilho{background:rgba(0,179,255,.25);border-color:var(--acc)}
.chave input:checked + .trilho::after{left:19px;background:var(--acc)}
.chave input:focus-visible + .trilho{outline:2px solid var(--acc);outline-offset:2px}
.chave input:disabled + .trilho{opacity:.45}`
  }
];

function renderComps() {
  $('#comps').innerHTML = COMPONENTES.map(c => `<article class="card comp" id="comp-${c.id}">
    <div class="comp-topo"><div><h3>${c.titulo}</h3><p class="dim pequeno">${c.desc}</p></div></div>
    <div class="comp-demo">${c.demo()}</div>
    <p class="comp-nota"><span aria-hidden="true">♿</span> ${c.nota()}</p>
    <div class="codigo">
      <div class="codigo-topo"><span class="rot">HTML + CSS</span><button type="button" class="btn mini" data-codigo="${c.id}">⧉ Copiar</button></div>
      <pre class="log" tabindex="0" aria-label="Código de ${c.titulo}">${esc(c.html)}\n\n<span class="dim">/* CSS */</span>\n${esc(c.css)}</pre>
    </div>
  </article>`).join('');
}
$('#comps').addEventListener('click', e => {
  const b = e.target.closest('[data-codigo]');
  if (b) {
    const c = COMPONENTES.find(x => x.id === b.dataset.codigo);
    NT.copiar(c.html + '\n\n<style>\n' + c.css + '\n</style>\n').then(ok => ok && NT.aviso(`Código de ${c.titulo.toLowerCase()} copiado.`));
    return;
  }
  const d = e.target.closest('[data-demo]');
  if (d) NT.aviso(`${d.dataset.demo}: clique recebido — é só a demonstração do componente.`);
});
$('#comps').addEventListener('change', e => {
  const map = { tgLembrete: ['lembrete', 'Lembrete por WhatsApp'], tgDesl: ['relatorio', 'Relatório semanal'] };
  const m = map[e.target.id];
  if (!m) return;
  chaves[m[0]] = e.target.checked;
  D.gravar('chaves', chaves);
  NT.aviso(`${m[1]} ${e.target.checked ? 'ligado' : 'desligado'}.`);
});

/* ===========================================================
   espaçamento, raios e ícones
   =========================================================== */
function renderEspaco() {
  $('#espacos').innerHTML = ESPACOS.map(([n, px]) => {
    const v = varNome('espaco-' + n);
    return `<button type="button" class="espaco" data-copiar="var(${v})" aria-label="Copiar var(${v}), ${px} pixels">
      <span class="mono">${v}</span><i style="width:${px * 3}px"></i><b class="mono">${px} px</b></button>`;
  }).join('');
  $('#raios').innerHTML = RAIOS.map(([n, px]) => {
    const v = varNome('raio-' + n);
    return `<button type="button" class="raio" data-copiar="var(${v})" aria-label="Copiar var(${v})">
      <i style="border-radius:${px === 999 ? '999px' : px + 'px'}"></i><b>${n}</b><span class="mono">${px === 999 ? '999 px' : px + ' px'}</span></button>`;
  }).join('') + `<button type="button" class="raio sombra" data-copiar="var(${varNome('sombra')})" aria-label="Copiar var(${varNome('sombra')})">
      <i style="box-shadow:${SOMBRA}"></i><b>sombra</b><span class="mono">janelas</span></button>`;
}

const SIMBOLOS = [
  ['＋', 'Adicionar', 'Nova cor, novo lead, novo cartão'], ['↺', 'Restaurar', 'Volta aos dados de exemplo'],
  ['⟳', 'Atualizar', 'Verificar agora, recarregar'], ['⧉', 'Copiar', 'Copia código ou texto'],
  ['⬇', 'Baixar', 'Exporta um arquivo'], ['⇅', 'Inverter', 'Troca duas coisas de lugar'],
  ['✕', 'Fechar ou falha', 'Fecha janela; marca o que reprovou'], ['✓', 'Concluído', 'Passou, pago, entregue'],
  ['✦', 'Sugestão automática', 'A ferramenta resolve sozinha'], ['⚠', 'Atenção', 'Prazo perto, contraste no limite']
];
async function renderIcones() {
  $('#simbolos').innerHTML = `<thead><tr><th>Símbolo</th><th>Significa</th><th>Onde usar</th></tr></thead><tbody>${SIMBOLOS.map(([s, n, u]) =>
    `<tr><td><button type="button" class="simbolo" data-copiar="${s}" aria-label="Copiar o símbolo ${n}">${s}</button></td><td><b>${n}</b></td><td class="dim">${u}</td></tr>`).join('')}</tbody>`;
  const sis = await NT.sistemas();
  $('#emojisSis').innerHTML = sis.length ? sis.map(s => `<button type="button" class="emoji-sis" data-copiar="${esc(s.emoji)}" aria-label="Copiar o emoji de ${esc(s.nome)}">
      <span class="nt-emoji-caixa">${esc(s.emoji)}</span><span><b>${esc(s.nome)}</b><small>${esc(DONOS[s.id] || s.agente || '')}</small></span></button>`).join('')
    : '<div class="vazio">Não consegui ler o catálogo dos sistemas agora.</div>';
}

/* ===========================================================
   tokens
   =========================================================== */
function contarTokens() { return todas().length + ESPACOS.length + RAIOS.length + 3 + NIVEIS.length * 3 + 1; }
function gerar(fmt) {
  const p = tk.prefixo, pre = p ? p + '-' : '';
  const cs = todas(), esc_ = escala();
  const data = NT.data(new Date());
  if (fmt === 'css') {
    const l = [`/* Design System Nassa — tokens gerados em ${data} */`, ':root {', '  /* cores */'];
    cs.forEach(c => l.push(`  --${pre}${c.slug}: ${c.hex};`));
    l.push('', '  /* espaçamento */');
    ESPACOS.forEach(([n, px]) => l.push(`  --${pre}espaco-${n}: ${px}px;`));
    l.push('', '  /* raios e sombra */');
    RAIOS.forEach(([n, px]) => l.push(`  --${pre}raio-${n}: ${px}px;`));
    l.push(`  --${pre}sombra: ${SOMBRA};`, '', '  /* tipografia */');
    Object.entries(FONTES).forEach(([n, f]) => l.push(`  --${pre}fonte-${n}: ${f};`));
    esc_.forEach(n => l.push(`  --${pre}texto-${n.id}: ${n.px}px;`, `  --${pre}texto-${n.id}-altura: ${n.lh};`, `  --${pre}texto-${n.id}-peso: ${n.peso};`));
    l.push('}');
    return l.join('\n');
  }
  if (fmt === 'json') {
    const o = {
      nome: 'Design System Nassa', gerado: NT.hojeISO(), prefixo: p,
      cor: Object.fromEntries(cs.map(c => [c.slug, c.hex])),
      espaco: Object.fromEntries(ESPACOS.map(([n, px]) => [n, px + 'px'])),
      raio: Object.fromEntries(RAIOS.map(([n, px]) => [n, px + 'px'])),
      sombra: SOMBRA,
      fonte: FONTES,
      texto: Object.fromEntries(esc_.map(n => [n.id, { tamanho: n.px + 'px', alturaLinha: n.lh, peso: n.peso, fonte: n.fonte }]))
    };
    return JSON.stringify(o, null, 2);
  }
  // Tailwind: o prefixo vira namespace das cores (bg-nt-ciano) e das demais chaves
  const k = s => /^[a-z_$][\w$]*$/i.test(s) ? s : `'${s}'`;
  const ind = '        ';
  const cores = cs.map(c => `${ind}  ${k(c.slug)}: '${c.hex}',`).join('\n');
  const bloco = (nome, pares) => `${ind.slice(2)}${nome}: {\n${pares.map(([a, b]) => `${ind}${k(pre + a)}: ${b},`).join('\n')}\n${ind.slice(2)}},`;
  return [
    `/** tailwind.config.js — Design System Nassa (${data}) */`,
    'module.exports = {',
    '  theme: {',
    '    extend: {',
    p ? `      colors: {\n${ind}${k(p)}: {\n${cores}\n${ind}},\n      },`
      : `      colors: {\n${cs.map(c => `${ind}${k(c.slug)}: '${c.hex}',`).join('\n')}\n      },`,
    bloco('spacing', ESPACOS.map(([n, px]) => [n, `'${px}px'`])),
    bloco('borderRadius', RAIOS.map(([n, px]) => [n, `'${px}px'`])),
    `      boxShadow: { ${k(p || 'padrao')}: '${SOMBRA}' },`,
    bloco('fontFamily', Object.entries(FONTES).map(([n, f]) => [n, '[' + f.split(', ').map(x => `"${x.replace(/'/g, '')}"`).join(', ') + ']'])),
    bloco('fontSize', esc_.map(n => [n.id, `['${n.px}px', { lineHeight: '${n.lh}', fontWeight: '${n.peso}' }]`])),
    '    },',
    '  },',
    '};'
  ].join('\n');
}
const ARQ = { css: ['nassa-tokens.css', 'text/css;charset=utf-8'], json: ['nassa-tokens.json', 'application/json;charset=utf-8'], tailwind: ['tailwind.config.js', 'text/javascript;charset=utf-8'] };
function renderTokens() {
  $$('[data-fmt]').forEach(b => b.setAttribute('aria-pressed', b.dataset.fmt === tk.fmt));
  if (document.activeElement !== $('#kPrefixo')) $('#kPrefixo').value = tk.prefixo;
  $('#tkSaida').textContent = gerar(tk.fmt);
  $('#tkInfo').textContent = `${contarTokens()} tokens · ${todas().length} cores (${pers.length} de clientes) · escala de texto com corpo de ${tipo.base} px · arquivo ${ARQ[tk.fmt][0]}`;
}
$$('[data-fmt]').forEach(b => b.addEventListener('click', () => { tk.fmt = b.dataset.fmt; D.gravar('tokens', tk); renderTokens(); }));
$('#kPrefixo').addEventListener('input', e => {
  // só letras minúsculas, números e hífen: vira nome de variável CSS
  const limpo = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (limpo !== e.target.value) e.target.value = limpo;
  tk.prefixo = limpo.replace(/^-+|-+$/g, '');
  D.gravar('tokens', tk);
  renderTokens(); renderPaleta(); renderEspaco();
});
$('#bCopiarTk').addEventListener('click', () => NT.copiar(gerar(tk.fmt)).then(ok => ok && NT.aviso(`Tokens em ${tk.fmt.toUpperCase()} copiados.`)));
$('#bBaixarTk').addEventListener('click', () => {
  const [nome, tipoArq] = ARQ[tk.fmt];
  NT.baixar(nome, gerar(tk.fmt) + '\n', tipoArq);
  NT.aviso(`Baixando ${nome}.`);
});

/* ===========================================================
   geral: copiar, abas, restaurar
   =========================================================== */
document.addEventListener('click', e => {
  const c = e.target.closest('[data-copiar]');
  if (!c) return;
  const v = c.dataset.copiar;
  NT.copiar(v).then(ok => ok && NT.aviso(v.length > 40 ? 'CSS copiado.' : `Copiado: ${v}`));
});

function irPara(aba) {
  const b = $(`.aba[data-aba="${aba}"]`);
  if (b) { b.click(); b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
}
NT.abas(document, aba => {
  D.gravar('aba', aba);
  window.scrollTo({ top: 0 });
});
$('#bExportar').addEventListener('click', () => irPara('tokens'));

$('#bRestaurar').addEventListener('click', () => {
  if (!confirm('Restaurar o exemplo?\nAs cores de clientes, a escala de texto, o par do verificador e as preferências de exportação voltam ao padrão.')) return;
  ['personalizadas', 'contraste', 'tipo', 'tokens', 'chaves'].forEach(k => D.apagar(k));
  carregar();
  tudo();
  NT.aviso('Exemplo restaurado.');
});

function tudo() {
  renderPaleta(); renderChips(); renderContraste(); renderMatriz();
  renderTipo(); renderComps(); renderEspaco(); renderTokens();
}
tudo();
renderIcones();
const abaSalva = D.ler('aba', 'cores');
if (abaSalva !== 'cores') irPara(abaSalva);
})();
