/* ===========================================================
   sistemas/qa/app.js — Central de Qualidade (Theo · QA & Testes)

   Duas frentes:
   - Testes: roda de verdade uma bateria de fumaça em cada sistema do
     catálogo (fetch, HTML, iframe com vigia de erros, render e tempo)
     e testes unitários das utilidades NT da base. Guarda o histórico
     das execuções e desenha a tendência da taxa de aprovação.
   - Bugs: o rastreador da equipe, com severidade, situação e dono.
     Um teste que falhou abre o bug já preenchido.
   Tudo fica em NT.dados('qa') e sobrevive ao recarregar.
   =========================================================== */
(() => {
'use strict';

const D = NT.dados('qa');
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = NT.esc;
const espera = ms => new Promise(r => setTimeout(r, ms));
const pad = (n, t = 3) => String(n).padStart(t, '0');

/* ---------- vocabulário ---------- */
const SEV = { critica: 'Crítica', alta: 'Alta', media: 'Média', baixa: 'Baixa' };
const STATUS = { aberto: 'Aberto', correcao: 'Em correção', resolvido: 'Resolvido', fechado: 'Fechado' };
const STATUS_BADGE = { aberto: 'err', correcao: 'warn', resolvido: 'ok', fechado: '' };
const ABERTOS = ['aberto', 'correcao'];
const EQUIPE = ['Theo', 'Lucas', 'Marina', 'Rafa', 'Bia', 'Dani', 'Lia', 'Nico', 'Duda', 'Gabriel'];
// quem responde por cada sistema (o bug que nasce de um teste já vai para o dono)
const DONOS = { frontend: 'Lucas', backend: 'Marina', fullstack: 'Rafa', mobile: 'Bia', devops: 'Dani',
  qa: 'Theo', design: 'Lia', ia: 'Nico', comercial: 'Duda', base: 'Rafa' };
// catálogo de reserva, caso ../catalogo.json não carregue (o teste unitário acusa)
const RESERVA = [
  ['frontend', 'Estúdio de Landing Pages', '🎨'], ['backend', 'Console da API', '🧩'], ['fullstack', 'Gestor de Projetos', '⚙️'],
  ['mobile', 'Laboratório Mobile', '📱'], ['devops', 'Central de Deploy', '🚀'], ['qa', 'Central de Qualidade', '🧪'],
  ['design', 'Design System Nassa', '✏️'], ['ia', 'Central de Agentes', '🧠'], ['comercial', 'CRM & Propostas', '🤝']
].map(([id, nome, emoji]) => ({ id, nome, emoji }));
const BASE = { id: 'base', nome: 'Base compartilhada (base.js)', emoji: '🧰' };

let catalogo = RESERVA.slice();
const sistema = id => id === 'base' ? BASE : (catalogo.find(s => s.id === id) || { id, nome: id, emoji: '❔' });

/* ---------- formatos ---------- */
const fmtMs = n => n == null ? '' : n < 1000 ? Math.round(n) + ' ms' : (n / 1000).toFixed(1).replace('.', ',') + ' s';
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const classeTaxa = t => t >= 95 ? 'ok' : t >= 80 ? 'warn' : 'err';
const dataHora = ts => new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
function atras(ts) {
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 2) return 'agora há pouco';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}

/* ===========================================================
   DADOS DE EXEMPLO
   =========================================================== */
function quando(diasAtras, h, m) {
  const d = new Date(); d.setDate(d.getDate() - diasAtras); d.setHours(h, m, 0, 0);
  return Math.min(d.getTime(), Date.now() - 3 * 3600e3);
}
function bugsExemplo() {
  const b = (n, titulo, sistema, severidade, status, responsavel, dias, passos, esperado, obtido) => ({
    id: 'BUG-' + pad(n), titulo, sistema, severidade, status, responsavel, passos, esperado, obtido,
    criado: quando(dias, 10, 15), atualizado: quando(Math.max(0, dias - 2), 16, 40)
  });
  return [
    b(1, 'POST /pagamentos aceita valor negativo e gera estorno fantasma', 'backend', 'critica', 'aberto', 'Marina', 1,
      '1. No Console da API, escolher POST /pagamentos\n2. Mandar {"cliente":"Clínica Sorriso","valor":-350}\n3. Abrir GET /pagamentos',
      'A API recusa com 422 e a mensagem "valor deve ser maior que zero".', 'Responde 201 e o pagamento aparece como estorno de R$ 350,00 no extrato.'),
    b(2, 'Atendente virtual cita preço do Pet Shop para cliente da Advocacia Duarte', 'ia', 'critica', 'correcao', 'Nico', 3,
      '1. Abrir Central de Agentes › Atendente\n2. Escolher o perfil Advocacia Duarte\n3. Perguntar "quanto custa?"',
      'Responder só com a base de conhecimento da Advocacia Duarte.', 'Responde "Banho e tosa a partir de R$ 60,00" (base do Pet Shop Amigo Fiel).'),
    b(3, 'Proposta da Clínica Sorriso imprime com o total cortado na 2ª página', 'comercial', 'alta', 'aberto', 'Duda', 2,
      '1. CRM & Propostas › Clínica Sorriso\n2. Montar proposta com 9 itens de escopo\n3. Imprimir (Ctrl+P), A4 retrato',
      'Bloco do total inteiro no fim da proposta.', 'A linha do total quebra entre as páginas 1 e 2 e o valor some.'),
    b(4, 'Tela de check-in fica em branco no iPhone SE', 'mobile', 'alta', 'correcao', 'Bia', 4,
      '1. Laboratório Mobile, app da Academia Força Total\n2. Trocar o aparelho para iPhone SE (375 px)\n3. Tocar em Check-in',
      'Mostrar o QR Code e o botão "Confirmar presença".', 'Tela vazia; o QR Code fica fora da área visível.'),
    b(5, 'Depoimentos perdem contraste na landing da Imobiliária Horizonte', 'frontend', 'media', 'aberto', 'Lucas', 5,
      '1. Estúdio de Landing Pages › Imobiliária Horizonte\n2. Ativar a seção Depoimentos com o tema escuro',
      'Texto com contraste mínimo de 4,5:1 (WCAG AA).', 'Cinza #6b7280 sobre #111827 dá 3,9:1.'),
    b(6, 'Cartão movido para Entregue volta para Em andamento ao recarregar', 'fullstack', 'media', 'resolvido', 'Rafa', 7,
      '1. Gestor de Projetos\n2. Arrastar "Site Padaria Pão de Mel" para Entregue\n3. Recarregar a página (F5)',
      'O cartão continua em Entregue.', 'Voltava para Em andamento — a coluna não era gravada depois do arraste.'),
    b(7, 'Alerta de SSL da Imobiliária Horizonte dispara um dia atrasado', 'devops', 'media', 'fechado', 'Dani', 12,
      '1. Central de Deploy › Domínios & SSL\n2. Cadastrar SSL vencendo daqui a 30 dias\n3. Conferir a cor da linha',
      'Linha amarela com 30 dias de antecedência.', 'Ficava verde até o dia 29 (data lida em UTC, não em horário de Brasília).'),
    b(8, 'Token --acc-3 aparece com o nome errado na tabela de cores', 'design', 'baixa', 'aberto', 'Lia', 6,
      '1. Design System Nassa › Cores\n2. Procurar o azul-claro #9fe0ff',
      'Nome do token: --acc-3.', 'Aparece como --acc-2, que é o azul #2f7bff.'),
    b(9, 'Data do gráfico de tendência cortada no celular', 'qa', 'baixa', 'fechado', 'Theo', 9,
      '1. Central de Qualidade num celular (390 px)\n2. Olhar o gráfico de Tendência',
      'Datas da primeira e da última execução legíveis.', 'A data da direita saía da área do gráfico.')
  ];
}
function historicoExemplo() {
  // taxa subindo ao longo da semana, como numa sprint de correção de verdade
  const falhasPossiveis = ['CRM & Propostas › Carrega sem erro de JavaScript', 'Laboratório Mobile › Carrega em menos de 3000 ms',
    'Central de Agentes › Renderiza conteúdo', 'Design System Nassa › Página responde 200', 'Base compartilhada › NT.data não pula dia por causa do fuso',
    'Console da API › Carrega sem erro de JavaScript', 'Gestor de Projetos › Renderiza conteúdo'];
  const linhas = [[9, 10, 12, 6, 3, 9800], [8, 16, 40, 5, 3, 9100], [7, 9, 5, 5, 0, 8700], [6, 14, 22, 3, 0, 8200], [5, 11, 48, 7, 3, 10400],
    [4, 17, 10, 2, 0, 7600], [3, 9, 31, 2, 0, 7900], [2, 15, 2, 1, 0, 7300], [1, 10, 20, 0, 0, 6900], [0, 9, 0, 1, 0, 7100]];
  return linhas.map(([d, h, m, falhou, ignorado, ms], i) => ({
    id: 'ex' + i, quando: quando(d, h, m), total: 60, falhou, ignorado, passou: 60 - falhou - ignorado, ms,
    falhas: falhasPossiveis.slice(i % 3, i % 3 + falhou)
  }));
}
const AJUSTES_PADRAO = { limite: 3000, unit: true, fumaca: true };
function semear() {
  D.gravar('bugs', bugsExemplo());
  D.gravar('seq', 10);
  D.gravar('historico', historicoExemplo());
  D.apagar('ultima');
  D.gravar('ajustes', Object.assign({}, AJUSTES_PADRAO));
  D.gravar('filtros', {});
  D.gravar('semeado', 1);
}
if (!D.ler('semeado', 0)) semear();

let bugs = D.ler('bugs', []);
let historico = D.ler('historico', []);
let ultima = D.ler('ultima', null);
let ajustes = Object.assign({}, AJUSTES_PADRAO, D.ler('ajustes', {}));
let filtros = D.ler('filtros', {});
let rodando = null; // execução em andamento (o mesmo formato de 'ultima')

/* ===========================================================
   TESTES UNITÁRIOS — utilidades NT da base, de verdade
   =========================================================== */
const ver = v => typeof v === 'string'
  ? '"' + v.replace(/ /g, '\\u00a0').replace(/ /g, '\\u202f') + '"' : JSON.stringify(v);
const norm = s => String(s).replace(/[  ]/g, ' ');
function igual(obtido, esperado, rotulo = '') {
  if (obtido !== esperado) throw new Error(`${rotulo}esperado ${ver(esperado)}, obtido ${ver(obtido)}`);
}
function verdade(cond, msg) { if (!cond) throw new Error(msg); }

const UNITARIOS = [
  ['NT.brl(1500) vira "R$ 1.500,00"', 'NT.brl(1500) igual a "R$ 1.500,00" (o espaço depois de R$ pode ser não separável)', () => {
    const v = NT.brl(1500);
    igual(norm(v), 'R$ 1.500,00');
    return ver(v) + (/ /.test(v) ? ' · espaço não separável (U+00A0)' : '');
  }],
  ['NT.brl com centavos e negativo', '"R$ 1.234,50" e "-R$ 89,90"', () => {
    igual(norm(NT.brl(1234.5)), 'R$ 1.234,50');
    const n = norm(NT.brl(-89.9));
    verdade(/^-\s?R\$\s?89,90$/.test(n), `esperado "-R$ 89,90", obtido ${ver(n)}`);
    return 'R$ 1.234,50 · ' + n;
  }],
  ['NT.brl trata entrada inválida como zero', 'NT.brl("abc") e NT.brl(null) dão "R$ 0,00"', () => {
    igual(norm(NT.brl('abc')), 'R$ 0,00', 'NT.brl("abc"): ');
    igual(norm(NT.brl(null)), 'R$ 0,00', 'NT.brl(null): ');
    return 'R$ 0,00 nos dois casos';
  }],
  ['NT.num separa milhar com ponto', 'NT.num(1234567) = "1.234.567" e NT.num("2.5") = "2,5"', () => {
    igual(NT.num(1234567), '1.234.567');
    igual(NT.num('2.5'), '2,5');
    return '1.234.567 · 2,5';
  }],
  ['NT.esc escapa & < > " \'', 'Os cinco caracteres especiais viram entidades HTML', () => {
    igual(NT.esc(`<a href="x">Pão & 'mel'</a>`), '&lt;a href=&quot;x&quot;&gt;Pão &amp; &#39;mel&#39;&lt;/a&gt;');
    return 'sem brecha para injetar HTML';
  }],
  ['NT.esc de null/undefined vira texto vazio', 'null e undefined viram "", 0 vira "0"', () => {
    igual(NT.esc(null), ''); igual(NT.esc(undefined), ''); igual(NT.esc(0), '0');
    return '"" · "" · "0"';
  }],
  ['NT.data não pula dia por causa do fuso', 'NT.data("2026-10-15") = "15/10/2026"', () => {
    igual(NT.data('2026-10-15'), '15/10/2026');
    igual(NT.data('2026-01-01'), '01/01/2026');
    return '15/10/2026 · 01/01/2026';
  }],
  ['NT.data com vazio ou inválido mostra "—"', 'Vazio, null e texto qualquer viram "—"', () => {
    igual(NT.data(''), '—'); igual(NT.data(null), '—'); igual(NT.data('ontem'), '—');
    return '"—" nos três casos';
  }],
  ['NT.hojeISO(1) é o dia seguinte', 'Formato AAAA-MM-DD e diferença de 1 dia', () => {
    const h = NT.hojeISO(), a = NT.hojeISO(1);
    verdade(/^\d{4}-\d{2}-\d{2}$/.test(h), `formato inesperado: ${ver(h)}`);
    igual(Math.round((new Date(a + 'T12:00:00') - new Date(h + 'T12:00:00')) / 864e5), 1, 'diferença em dias: ');
    return `${h} → ${a}`;
  }],
  ['NT.hora no formato HH:MM:SS', 'NT.hora(9h05min07s) = "09:05:07"', () => {
    igual(NT.hora(new Date(2026, 9, 16, 9, 5, 7)), '09:05:07');
    return '09:05:07';
  }],
  ['NT.id gera 500 códigos únicos', '500 chamadas, 500 códigos diferentes', () => {
    const s = new Set();
    for (let i = 0; i < 500; i++) s.add(NT.id());
    igual(s.size, 500, 'códigos únicos: ');
    return '500 únicos, ex.: ' + NT.id();
  }],
  ['NT.dados grava e lê de volta', 'O objeto lido é igual ao gravado e fica no localStorage', () => {
    const d = NT.dados('qa-autoteste');
    const v = { cliente: 'Padaria Pão de Mel', itens: [1, 2, 3], pago: true, valor: 1500.5 };
    d.gravar('ida-volta', v);
    igual(JSON.stringify(d.ler('ida-volta')), JSON.stringify(v));
    let noStorage = false;
    try { noStorage = localStorage.getItem('nt-sis-qa-autoteste:ida-volta') !== null; } catch (e) { /* storage bloqueado */ }
    d.apagar('ida-volta');
    return noStorage ? 'ida e volta pelo localStorage' : 'ida e volta pela memória (localStorage bloqueado)';
  }],
  ['NT.dados apagar volta ao padrão sem vazar mutação', 'Depois de apagar, ler devolve uma cópia do padrão', () => {
    const d = NT.dados('qa-autoteste');
    d.gravar('apagar', 42); d.apagar('apagar');
    const padrao = { lista: [] };
    const a = d.ler('apagar', padrao);
    verdade(a !== padrao, 'ler devolveu o próprio objeto padrão, não uma cópia');
    a.lista.push('x');
    igual(padrao.lista.length, 0, 'itens no padrão depois da mutação: ');
    return 'cópia limpa do padrão';
  }],
  ['NT.abas troca a aba e o painel', 'Clicar na 2ª aba liga o 2º painel e avisa quem ouve', () => {
    const r = document.createElement('div');
    r.innerHTML = '<button class="aba on" data-aba="a"></button><button class="aba" data-aba="b"></button>' +
      '<section class="painel-aba on" data-aba="a"></section><section class="painel-aba" data-aba="b"></section>';
    let avisada = '';
    NT.abas(r, a => { avisada = a; });
    r.querySelectorAll('.aba')[1].click();
    const p = r.querySelectorAll('.painel-aba');
    verdade(p[1].classList.contains('on') && !p[0].classList.contains('on'), 'o painel "b" não ficou ativo');
    igual(r.querySelectorAll('.aba')[1].getAttribute('aria-selected'), 'true', 'aria-selected: ');
    igual(avisada, 'b', 'callback recebeu: ');
    return 'painel e aria-selected corretos';
  }],
  ['NT.sistemas devolve o catálogo completo', 'Lista com id, nome e emoji de cada sistema, incluindo qa', async () => {
    const c = await NT.sistemas();
    verdade(c.length > 0, 'catálogo vazio — ../catalogo.json não carregou');
    const ruins = c.filter(s => !s.id || !s.nome || !s.emoji).map(s => s.id || '?');
    verdade(!ruins.length, 'sem nome ou emoji: ' + ruins.join(', '));
    verdade(c.some(s => s.id === 'qa'), 'a Central de Qualidade não está no catálogo');
    return `${c.length} sistemas`;
  }]
];

/* ===========================================================
   TESTES DE FUMAÇA — cada sistema, de verdade
   =========================================================== */
const FUMACA = [
  { nome: 'Página responde 200', esperado: 'A página responde HTTP 200 OK.', sev: 'critica' },
  { nome: 'HTML tem <title> e cabeçalho .nt-top', esperado: 'HTML com <title> preenchido e o cabeçalho .nt-top com o h1 do sistema.', sev: 'media' },
  { nome: 'Carrega sem erro de JavaScript', esperado: 'A página carrega num iframe sem erro de JavaScript, promise rejeitada, console.error ou arquivo faltando.', sev: 'alta' },
  { nome: 'Renderiza conteúdo (h1 visível e texto no main)', esperado: 'O h1 aparece na tela e o <main> tem conteúdo.', sev: 'alta' },
  { nome: 'Carrega em menos de {N} ms', esperado: 'Carregar em menos de {N} ms (rede + render).', sev: 'baixa' }
];

// vigia injetado antes de qualquer script da página testada: junta erros de JS,
// promises sem catch, console.error e arquivos do próprio site que não carregaram
function vigia() {
  return `(function(){var E=window.__qaErros=[],o=${JSON.stringify(location.origin)};
addEventListener('error',function(e){var t=e.target;if(t&&t!==window&&t.tagName){var u=t.src||t.href||'';
if(u&&u.indexOf(o)===0)E.push('Arquivo não carregou: '+u.slice(o.length));return}
E.push('Erro de JavaScript: '+(e.message||'desconhecido')+(e.filename?' ('+e.filename.split('/').pop()+':'+e.lineno+')':''))},true);
addEventListener('unhandledrejection',function(e){var r=e.reason;E.push('Promise rejeitada sem tratamento: '+(r&&r.message||r))});
var ce=console.error;console.error=function(){E.push('console.error: '+[].map.call(arguments,function(a){return a&&a.message||String(a)}).join(' '));return ce.apply(console,arguments)}})();`;
}

async function buscar(url, limite) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), limite);
  try { return await fetch(url, { cache: 'no-store', signal: ac.signal }); }
  catch (e) { throw new Error(e.name === 'AbortError' ? `sem resposta em ${fmtMs(limite)}` : 'falha de rede: ' + e.message); }
  finally { clearTimeout(t); }
}

// srcdoc com <base> mantém os caminhos relativos e deixa o vigia rodar primeiro
function carregarNoIframe(url, html, limite) {
  return new Promise(resolve => {
    const f = document.createElement('iframe');
    f.className = 'sonda'; f.title = 'Sonda de teste'; f.tabIndex = -1;
    f.setAttribute('aria-hidden', 'true');
    const injecao = `<base href="${esc(url)}"><script>${vigia()}<\/script>`;
    const re = /<head(\s[^>]*)?>/i;
    f.srcdoc = re.test(html) ? html.replace(re, m => m + injecao) : injecao + html;
    const t0 = performance.now();
    let fim = false, ms = 0;
    const acabou = ok => {
      if (fim) return;
      fim = true; clearTimeout(to); ms = performance.now() - t0;
      // um respiro para erros de código que roda logo depois do load
      setTimeout(() => {
        const w = f.contentWindow;
        resolve({ frame: f, ms, ok, doc: ok ? f.contentDocument : null, erros: (w && w.__qaErros) || [] });
      }, 350);
    };
    f.addEventListener('load', () => acabou(true));
    const to = setTimeout(() => acabou(false), Math.max(limite * 2, 8000));
    document.body.appendChild(f);
  });
}

function novaExecucao() {
  const limite = ajustes.limite;
  const suites = [];
  if (ajustes.unit) suites.push({ id: 'unit', sistema: 'base', nome: 'Testes unitários · utilidades NT', emoji: '🧰',
    testes: UNITARIOS.map(([nome, esperado]) => ({ nome, esperado, sev: 'alta', status: 'pendente' })) });
  if (ajustes.fumaca) catalogo.forEach(s => suites.push({ id: 'sis-' + s.id, sistema: s.id, nome: s.nome, emoji: s.emoji,
    url: new URL(`../${s.id}/`, location.href).href,
    testes: FUMACA.map(t => ({ nome: t.nome.replace('{N}', limite), esperado: t.esperado.replace('{N}', limite), sev: t.sev, status: 'pendente' })) }));
  return { id: NT.id(), quando: Date.now(), limite, ms: 0, suites };
}

async function passo(t, fn) {
  t.status = 'rodando'; desenharArvore();
  const t0 = performance.now();
  try { t.det = (await fn()) || ''; t.status = 'passou'; }
  catch (e) { t.status = 'falhou'; t.erro = String(e && e.message || e); }
  t.ms = performance.now() - t0;
  desenharArvore();
  return t.status === 'passou';
}
function ignorar(testes, motivo) { testes.forEach(t => { if (t.status === 'pendente') { t.status = 'ignorado'; t.det = motivo; } }); }

async function suiteUnitaria(su) {
  for (let i = 0; i < UNITARIOS.length; i++) await passo(su.testes[i], UNITARIOS[i][2]);
}

async function suiteSistema(su, limite) {
  const [t1, t2, t3, t4, t5] = su.testes;
  let html = '', tRede = 0, carga = null;

  await passo(t1, async () => {
    const t0 = performance.now();
    const r = await buscar(su.url, Math.max(limite * 2, 8000));
    tRede = performance.now() - t0;
    if (r.status !== 200) throw new Error(`HTTP ${r.status}${r.statusText ? ' ' + r.statusText : ''} em ${su.url.replace(location.origin, '')}`);
    html = await r.text();
    return `HTTP 200 · ${(html.length / 1024).toFixed(1).replace('.', ',')} KB em ${fmtMs(tRede)}`;
  });
  if (t1.status !== 'passou') return ignorar(su.testes, 'depende da página responder');

  await passo(t2, () => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const titulo = (doc.title || '').trim();
    verdade(titulo, 'a página não tem <title> (ou ele está vazio)');
    const topo = doc.querySelector('header.nt-top');
    verdade(topo, 'não achei o cabeçalho <header class="nt-top">');
    const h1 = topo.querySelector('h1');
    verdade(h1 && h1.textContent.trim(), 'o cabeçalho .nt-top não tem h1 com o nome do sistema');
    return `“${titulo}”`;
  });

  try {
    await passo(t3, async () => {
      carga = await carregarNoIframe(su.url, html, limite);
      verdade(carga.ok, `o iframe não terminou de carregar em ${fmtMs(Math.max(limite * 2, 8000))}`);
      const n = carga.erros.length;
      if (n) throw new Error(carga.erros.slice(0, 4).join('\n') + (n > 4 ? `\n… e mais ${n - 4}` : ''));
      return `sem erros · ${carga.doc.scripts.length} scripts carregados`;
    });
    if (!carga || !carga.doc) return ignorar(su.testes, 'depende do iframe carregar');

    await passo(t4, async () => {
      // espera um pouco: muitos sistemas desenham depois de buscar dados
      const doc = carga.doc, w = carga.frame.contentWindow, ate = performance.now() + 2500;
      let falta = '';
      do {
        const h1 = doc.querySelector('h1'), main = doc.querySelector('main');
        const r = h1 && h1.getBoundingClientRect();
        const visivel = r && r.width > 0 && r.height > 0 && w.getComputedStyle(h1).visibility !== 'hidden';
        const texto = main ? (main.innerText || '').replace(/\s+/g, ' ').trim() : '';
        if (!h1) falta = 'a página não tem h1';
        else if (!visivel) falta = 'o h1 existe mas não aparece na tela';
        else if (!main) falta = 'a página não tem <main>';
        else if (texto.length < 30) falta = `o <main> está praticamente vazio (${texto.length} caracteres)`;
        else return `h1 “${h1.textContent.trim()}” · ${NT.num(texto.length)} caracteres no main`;
        await espera(150);
      } while (performance.now() < ate);
      throw new Error(falta);
    });

    await passo(t5, () => {
      const total = tRede + carga.ms;
      if (total > limite) throw new Error(`levou ${fmtMs(total)} (rede ${fmtMs(tRede)} + render ${fmtMs(carga.ms)}); limite de ${fmtMs(limite)}`);
      return `${fmtMs(total)} (rede ${fmtMs(tRede)} + render ${fmtMs(carga.ms)})`;
    });
  } finally {
    if (carga) carga.frame.remove(); // derruba timers e listeners da página testada
  }
}

async function rodarTestes() {
  if (rodando) return;
  const bt = $('#bRodar');
  bt.disabled = true; bt.textContent = '⏳ Rodando…';
  try {
    const c = await NT.sistemas();
    if (c.length) catalogo = c;
    rodando = novaExecucao();
    abertas.clear();
    if (!rodando.suites.length) { NT.aviso('Ligue pelo menos uma bateria nos ajustes.'); return; }
    const t0 = performance.now();
    for (let i = 0; i < rodando.suites.length; i++) {
      const su = rodando.suites[i];
      su.rodando = true;
      $('#rsSub').textContent = `Testando ${su.nome} (${i + 1}/${rodando.suites.length})…`;
      if (su.id === 'unit') await suiteUnitaria(su); else await suiteSistema(su, rodando.limite);
      su.rodando = false;
      desenharArvore();
    }
    rodando.ms = performance.now() - t0;
    concluir(rodando);
  } catch (e) {
    NT.aviso('A bateria parou no meio: ' + e.message);
  } finally {
    rodando = null;
    bt.disabled = false; bt.textContent = '▶ Rodar testes';
    desenharTudo();
  }
}

function contar(ex) {
  const c = { total: 0, passou: 0, falhou: 0, ignorado: 0 };
  ex.suites.forEach(s => s.testes.forEach(t => { c.total++; if (c[t.status] != null) c[t.status]++; }));
  return c;
}

function concluir(ex) {
  const c = contar(ex);
  const falhas = [];
  ex.suites.forEach(s => s.testes.forEach(t => { if (t.status === 'falhou') falhas.push(`${s.nome} › ${t.nome}`); }));
  ultima = ex;
  D.gravar('ultima', ex);
  historico.push(Object.assign({ id: ex.id, quando: ex.quando, ms: Math.round(ex.ms), falhas: falhas.slice(0, 12) }, c));
  historico = historico.slice(-30);
  D.gravar('historico', historico);
  NT.aviso(c.falhou ? `${c.falhou} ${c.falhou === 1 ? 'teste falhou' : 'testes falharam'} — veja os detalhes.` : `Tudo certo: ${c.passou} testes passaram.`);
}

/* ===========================================================
   DESENHO — resumo, árvore, tendência, execuções
   =========================================================== */
const abertas = new Map(); // suíte → aberta? (o que a pessoa escolheu vale mais que o padrão)
const ICONE = { passou: '✓', falhou: '✗', ignorado: '–', pendente: '·', rodando: '…' };
const ROTULO = { passou: 'passou', falhou: 'falhou', ignorado: 'ignorado', pendente: 'na fila', rodando: 'rodando' };

function suiteStatus(s) {
  if (s.testes.some(t => t.status === 'rodando') || s.rodando) return 'rodando';
  if (s.testes.some(t => t.status === 'falhou')) return 'falhou';
  if (s.testes.every(t => t.status === 'pendente')) return 'pendente';
  if (s.testes.every(t => t.status === 'ignorado')) return 'ignorado';
  return s.testes.some(t => t.status === 'pendente') ? 'rodando' : 'passou';
}
const estaAberta = s => abertas.has(s.id) ? abertas.get(s.id) : ['falhou', 'rodando'].includes(suiteStatus(s));
const bugDaOrigem = origem => bugs.find(b => b.origem === origem && ABERTOS.includes(b.status));

function desenharResumo() {
  const ex = rodando || ultima;
  const ponto = $('#rsPonto'), tit = $('#rsTitulo'), sub = $('#rsSub');
  const [bOk, bErr, bIgn] = $$('#rsBarra i');
  ponto.className = 'ponto';
  if (!ex) {
    const h = historico[historico.length - 1];
    tit.textContent = 'Nenhuma execução detalhada ainda';
    sub.textContent = h ? `O histórico de execuções veio do exemplo (última: ${dataHora(h.quando)}). Rode os testes para ver o detalhe de cada sistema.`
      : 'Clique em Rodar testes para conferir cada sistema do escritório.';
    [bOk, bErr, bIgn].forEach(b => { b.style.width = '0'; });
    $('#rsLegenda').innerHTML = '';
    $('#rsBarra').setAttribute('aria-label', 'Sem resultados');
    return;
  }
  const c = contar(ex);
  const feitos = c.passou + c.falhou + c.ignorado;
  if (rodando) { ponto.classList.add('rodando'); tit.textContent = `Rodando… ${feitos} de ${c.total}`; }
  else {
    ponto.classList.add(c.falhou ? 'err' : 'ok');
    tit.textContent = c.falhou ? `${c.falhou} ${c.falhou === 1 ? 'teste falhou' : 'testes falharam'}` : 'Tudo passou';
    sub.textContent = `Última execução ${dataHora(ex.quando)} (${atras(ex.quando)}) · ${ex.suites.length} suítes em ${fmtMs(ex.ms)} · limite de carga ${fmtMs(ex.limite)}`;
  }
  bOk.style.width = pct(c.passou, c.total) + '%';
  bErr.style.width = pct(c.falhou, c.total) + '%';
  bIgn.style.width = pct(c.ignorado, c.total) + '%';
  $('#rsBarra').setAttribute('aria-label', `${c.passou} passaram, ${c.falhou} falharam, ${c.ignorado} ignorados de ${c.total}`);
  $('#rsLegenda').innerHTML = `<span class="ok"><b>${c.passou}</b> ${c.passou === 1 ? 'passou' : 'passaram'}</span><span class="err"><b>${c.falhou}</b> ${c.falhou === 1 ? 'falhou' : 'falharam'}</span>` +
    `<span><b>${c.ignorado}</b> ${c.ignorado === 1 ? 'ignorado' : 'ignorados'}</span><span><b>${c.total}</b> testes</span>` +
    (rodando ? '' : `<span><b>${pct(c.passou, c.total)}%</b> de aprovação</span>`);
}

function desenharArvore() {
  const ex = rodando || ultima, alvo = $('#arvore');
  desenharResumo();
  if (!ex) {
    alvo.innerHTML = `<div class="vazio">Nenhum resultado detalhado ainda.<br><br><button type="button" class="btn primary" data-acao="rodar">▶ Rodar testes agora</button></div>`;
    return;
  }
  const soFalhas = $('#cSoFalhas').checked;
  const suites = soFalhas ? ex.suites.filter(s => s.testes.some(t => t.status === 'falhou')) : ex.suites;
  if (!suites.length) { alvo.innerHTML = '<div class="vazio">Nenhuma falha nesta execução. 🎉</div>'; return; }
  alvo.innerHTML = suites.map(s => {
    const st = suiteStatus(s), aberta = estaAberta(s);
    const ok = s.testes.filter(t => t.status === 'passou').length;
    const ms = s.testes.reduce((a, t) => a + (t.ms || 0), 0);
    const testes = soFalhas ? s.testes.filter(t => t.status === 'falhou') : s.testes;
    return `<div class="suite ${st === 'falhou' ? 'err' : ''}">
      <button type="button" class="suite-cab" aria-expanded="${aberta}" data-suite="${esc(s.id)}">
        <span class="seta" aria-hidden="true">▶</span>
        <span class="ic ${st}" aria-hidden="true">${ICONE[st]}</span>
        <span class="suite-nome">${esc(s.emoji)} ${esc(s.nome)}</span>
        <span class="suite-meta"><span class="dur mono">${ms ? fmtMs(ms) : ''}</span><span class="badge ${st === 'falhou' ? 'err' : st === 'passou' ? 'ok' : ''}">${ok}/${s.testes.length}</span></span>
        <span class="sr">${ROTULO[st]}</span>
      </button>
      ${aberta ? `<ul class="testes">${testes.map(t => linhaTeste(s, t)).join('')}</ul>
        ${s.url ? `<a class="suite-link" href="${esc(s.url)}" target="_blank" rel="noopener">Abrir ${esc(s.nome)} numa aba ↗</a>` : ''}` : ''}
    </div>`;
  }).join('');
}

function linhaTeste(s, t) {
  const i = s.testes.indexOf(t), origem = `${s.id}#${i}`;
  let erro = '';
  if (t.status === 'falhou') {
    const b = bugDaOrigem(origem);
    erro = `<div class="t-erro"><span>${esc(t.erro)}</span>${b
      ? `<button type="button" class="btn mini" data-ver-bug="${esc(b.id)}">Ver ${esc(b.id)}</button>`
      : `<button type="button" class="btn mini danger" data-abrir-bug="${esc(s.id)}" data-i="${i}">🐞 Abrir bug</button>`}</div>`;
  }
  return `<li class="teste"><span class="ic ${t.status}" title="${ROTULO[t.status]}">${ICONE[t.status]}<span class="sr">${ROTULO[t.status]}</span></span>
    <span class="t-nome">${esc(t.nome)}${t.det ? `<span class="t-det">${esc(t.det)}</span>` : ''}</span>
    <span class="t-ms">${t.ms != null && t.status !== 'ignorado' ? fmtMs(t.ms) : ''}</span>${erro}</li>`;
}

function desenharGrafico() {
  const caixa = $('#grafico');
  const pts = historico.slice(-20);
  if (!pts.length) { caixa.innerHTML = '<div class="vazio">Sem execuções ainda.</div>'; $('#tendInfo').textContent = ''; return; }
  const W = Math.max(240, Math.round(caixa.clientWidth || 300)), H = 160, pl = 36, pr = 12, pt = 12, pb = 24;
  const taxas = pts.map(h => pct(h.passou, h.total));
  const yMin = Math.max(0, Math.floor((Math.min(...taxas) - 5) / 10) * 10);
  const x = i => pts.length === 1 ? (pl + W - pr) / 2 : pl + i * (W - pl - pr) / (pts.length - 1);
  const y = v => pt + (100 - v) / (100 - yMin || 1) * (H - pt - pb);
  const marcas = [yMin, Math.round((yMin + 100) / 2), 100];
  const linha = taxas.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${linha} L${x(pts.length - 1).toFixed(1)},${H - pb} L${x(0).toFixed(1)},${H - pb} Z`;
  const cor = { ok: 'var(--ok)', warn: 'var(--warn)', err: 'var(--err)' };
  const dm = ts => new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const ult = taxas[taxas.length - 1], ant = taxas[taxas.length - 2];
  caixa.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img"
      aria-label="Taxa de aprovação nas últimas ${pts.length} execuções, de ${taxas[0]}% a ${ult}%">
    <defs><linearGradient id="gTend" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--acc);stop-opacity:.28"/><stop offset="1" style="stop-color:var(--acc);stop-opacity:0"/></linearGradient></defs>
    ${marcas.map(m => `<line class="grade-l" x1="${pl}" x2="${W - pr}" y1="${y(m)}" y2="${y(m)}"/><text class="eixo" x="${pl - 6}" y="${y(m) + 3.5}" text-anchor="end">${m}%</text>`).join('')}
    ${pts.length > 1 ? `<path d="${area}" fill="url(#gTend)"/><path class="linha-t" d="${linha}"/>` : ''}
    ${taxas.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${i === taxas.length - 1 ? 5 : 3.5}" fill="${cor[classeTaxa(v)]}"><title>${dataHora(pts[i].quando)} · ${v}% (${pts[i].passou}/${pts[i].total})</title></circle>`).join('')}
    <text class="eixo" x="${x(0)}" y="${H - 6}" text-anchor="${pts.length === 1 ? 'middle' : 'start'}">${dm(pts[0].quando)}</text>
    ${pts.length > 1 ? `<text class="eixo" x="${x(pts.length - 1)}" y="${H - 6}" text-anchor="end">${dm(pts[pts.length - 1].quando)}</text>` : ''}
  </svg>`;
  $('#tendInfo').textContent = ant == null ? `${ult}% agora` : `${ult}% · ${ult - ant >= 0 ? '+' : ''}${ult - ant} pts`;
}

function desenharExecucoes() {
  const lista = $('#execucoes');
  if (!historico.length) { lista.innerHTML = '<li class="dim">Nenhuma execução guardada.</li>'; return; }
  lista.innerHTML = historico.slice().reverse().map(h => {
    const t = pct(h.passou, h.total);
    const dica = h.falhas && h.falhas.length ? 'Falhas: ' + h.falhas.join('; ') : 'Sem falhas';
    return `<li title="${esc(dica)}"><span class="taxa ${classeTaxa(t)}">${t}%</span>
      <span><span class="quando">${dataHora(h.quando)}</span><br>${h.passou}/${h.total} passaram${h.falhou ? ` · <span style="color:var(--err)">${h.falhou} ${h.falhou === 1 ? 'falha' : 'falhas'}</span>` : ''}</span>
      <span class="cont-ex">${fmtMs(h.ms)}</span></li>`;
  }).join('');
}

function desenharKpis() {
  const h = historico[historico.length - 1], a = historico[historico.length - 2];
  const taxa = h ? pct(h.passou, h.total) : 0;
  const delta = h && a ? taxa - pct(a.passou, a.total) : null;
  const abertos = bugs.filter(b => ABERTOS.includes(b.status));
  const criticos = abertos.filter(b => b.severidade === 'critica');
  const corr = abertos.filter(b => b.status === 'correcao').length;
  const k = (cls, valor, rot, sub) => `<div class="kpi ${cls}"><b>${valor}</b><span>${rot}</span><small>${sub}</small></div>`;
  $('#kpis').innerHTML =
    k(h ? classeTaxa(taxa) : '', h ? taxa + '%' : '—', 'Taxa de aprovação', delta == null ? (h ? atras(h.quando) : 'rode os testes') : `${delta >= 0 ? '+' : ''}${delta} pts vs. anterior`) +
    k('acc', h ? h.total : '—', 'Testes', h ? `${h.passou} ${h.passou === 1 ? 'passou' : 'passaram'} · ${h.falhou} ${h.falhou === 1 ? 'falhou' : 'falharam'}` : 'nenhuma execução') +
    k(abertos.length ? 'warn' : 'ok', abertos.length, 'Bugs abertos', `${corr} em correção`) +
    k(criticos.length ? 'err' : 'ok', criticos.length, 'Críticos', criticos.length ? 'abertos, prioridade máxima' : 'nenhum em aberto');
  $('#contBugs').textContent = abertos.length || '';
}

function desenharTudo() {
  desenharKpis(); desenharArvore(); desenharGrafico(); desenharExecucoes(); desenharBugs();
}

/* ===========================================================
   BUGS
   =========================================================== */
const ORD_STATUS = { aberto: 0, correcao: 1, resolvido: 2, fechado: 3 };
const ORD_SEV = { critica: 0, alta: 1, media: 2, baixa: 3 };
const opcoes = (obj, sel, vazio) => (vazio ? `<option value="">${vazio}</option>` : '') +
  Object.entries(obj).map(([v, r]) => `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(r)}</option>`).join('');
const mapaSistemas = () => Object.fromEntries([...catalogo, BASE].map(s => [s.id, `${s.emoji} ${s.nome}`]));

function preencherSelects() {
  $('#fSev').innerHTML = opcoes(SEV, filtros.sev, 'Todas');
  $('#fStatus').innerHTML = `<option value="">Todos</option><option value="_abertos"${filtros.status === '_abertos' ? ' selected' : ''}>Abertos + em correção</option>` + opcoes(STATUS, filtros.status);
  $('#fSis').innerHTML = opcoes(mapaSistemas(), filtros.sis, 'Todos');
  $('#fBusca').value = filtros.busca || '';
  $('#bSev').innerHTML = opcoes(SEV);
  $('#bStatus').innerHTML = opcoes(STATUS);
  $('#bSistema').innerHTML = opcoes(mapaSistemas());
  $('#bResp').innerHTML = EQUIPE.map(n => `<option>${n}</option>`).join('');
}

function bugsFiltrados() {
  const q = (filtros.busca || '').trim().toLowerCase();
  return bugs.filter(b =>
    (!filtros.sev || b.severidade === filtros.sev) &&
    (!filtros.status || (filtros.status === '_abertos' ? ABERTOS.includes(b.status) : b.status === filtros.status)) &&
    (!filtros.sis || b.sistema === filtros.sis) &&
    (!q || [b.id, b.titulo, b.passos, b.obtido, b.responsavel].join(' ').toLowerCase().includes(q))
  ).sort((a, b) => ORD_STATUS[a.status] - ORD_STATUS[b.status] || ORD_SEV[a.severidade] - ORD_SEV[b.severidade] || b.criado - a.criado);
}

function desenharBugs() {
  const lista = bugsFiltrados(), alvo = $('#listaBugs');
  const abertos = bugs.filter(b => ABERTOS.includes(b.status)).length;
  $('#bugsInfo').textContent = `${lista.length} de ${bugs.length} ${bugs.length === 1 ? 'bug' : 'bugs'} · ${abertos} em aberto`;
  if (!lista.length) {
    alvo.innerHTML = `<li class="vazio">${bugs.length ? 'Nenhum bug com esses filtros.' : 'Nenhum bug registrado. Bom sinal — ou falta testar.'}</li>`;
    return;
  }
  alvo.innerHTML = lista.map(b => {
    const s = sistema(b.sistema), feito = !ABERTOS.includes(b.status);
    return `<li class="bug sev-${b.severidade}${feito ? ' feito' : ''}">
      <div>
        <div class="bug-tit"><span class="mono">${esc(b.id)}</span><b>${esc(b.titulo)}</b></div>
        <div class="bug-meta">
          <span class="badge sev-${b.severidade}">${SEV[b.severidade]}</span>
          <span class="badge ${STATUS_BADGE[b.status]}">${STATUS[b.status]}</span>
          <span>${esc(s.emoji)} ${esc(s.nome)}</span>
          <span>👤 ${esc(b.responsavel)}</span>
          <span title="Atualizado em ${esc(dataHora(b.atualizado))}">${NT.data(b.criado)}</span>
        </div>
        ${b.obtido ? `<div class="bug-obt"><b>Obtido:</b> ${esc(b.obtido)}</div>` : ''}
      </div>
      <div class="bug-acoes">
        <label class="sr" for="st-${esc(b.id)}">Status de ${esc(b.id)}</label>
        <select class="campo" id="st-${esc(b.id)}" data-status="${esc(b.id)}">${opcoes(STATUS, b.status)}</select>
        <button type="button" class="btn mini" data-editar="${esc(b.id)}">Editar</button>
      </div>
    </li>`;
  }).join('');
}

function salvarBugs() { D.gravar('bugs', bugs); desenharKpis(); desenharBugs(); desenharArvore(); }

/* ---------- modal do bug ---------- */
const mBug = $('#mBug');
let editando = null, origemNova = null, voltarFoco = null;

function abrirBug(bug, pre) {
  voltarFoco = document.activeElement;
  editando = bug ? bug.id : null;
  origemNova = pre && pre.origem || null;
  const v = bug || Object.assign({ titulo: '', sistema: 'frontend', severidade: 'media', status: 'aberto', responsavel: 'Theo',
    passos: '', esperado: '', obtido: '' }, pre);
  $('#mBugTit').textContent = bug ? `Editar ${bug.id}` : 'Novo bug';
  $('#bTitulo').value = v.titulo; $('#bSistema').value = v.sistema; $('#bSev').value = v.severidade;
  $('#bStatus').value = v.status; $('#bResp').value = v.responsavel; $('#bPassos').value = v.passos;
  $('#bEsperado').value = v.esperado; $('#bObtido').value = v.obtido;
  $('#bErro').textContent = '';
  $('#bExcluir').hidden = !bug;
  NT.modal(mBug, true);
}
function fecharBug() {
  NT.modal(mBug, false);
  if (voltarFoco && document.contains(voltarFoco)) voltarFoco.focus();
}

$('#fBug').addEventListener('submit', e => {
  e.preventDefault();
  const titulo = $('#bTitulo').value.trim();
  if (titulo.length < 5) { $('#bErro').textContent = 'Dê um título com pelo menos 5 letras — ele é o que a equipe lê primeiro.'; $('#bTitulo').focus(); return; }
  const dados = { titulo, sistema: $('#bSistema').value, severidade: $('#bSev').value, status: $('#bStatus').value,
    responsavel: $('#bResp').value, passos: $('#bPassos').value.trim(), esperado: $('#bEsperado').value.trim(),
    obtido: $('#bObtido').value.trim(), atualizado: Date.now() };
  let id = editando;
  if (editando) Object.assign(bugs.find(b => b.id === editando), dados);
  else {
    const seq = D.ler('seq', bugs.length + 1);
    id = 'BUG-' + pad(seq);
    D.gravar('seq', seq + 1);
    bugs.push(Object.assign({ id, criado: Date.now(), origem: origemNova || undefined }, dados));
  }
  salvarBugs();
  fecharBug();
  NT.aviso(editando ? `${id} atualizado.` : `${id} registrado para ${dados.responsavel}.`);
});
$('#bCancelar').addEventListener('click', fecharBug);
$('#bExcluir').addEventListener('click', async () => {
  if (!editando) return;
  const alvo = editando;
  if (!await confirmar(`Excluir ${alvo}?`, 'O bug sai do rastreador e isso não tem volta.', 'Excluir')) return;
  bugs = bugs.filter(b => b.id !== alvo);
  salvarBugs(); fecharBug();
  NT.aviso('Bug excluído.');
});
// Esc também devolve o foco para quem abriu (o NT.modal só esconde)
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  // a confirmação pode estar por cima do modal do bug: o Esc fecha só ela
  // (e para aqui, senão o ouvinte do NT.modal fecharia o bug junto)
  if (!mConf.hidden) { responderConf(false); e.stopImmediatePropagation(); }
  else if (!mBug.hidden) fecharBug();
});
// clique no fundo escuro também devolve o foco
mBug.addEventListener('click', e => { if (e.target === mBug) fecharBug(); });

/* ---------- confirmação ---------- */
const mConf = $('#mConf');
let resolverConf = null, focoConf = null;
function confirmar(titulo, texto, rotulo) {
  focoConf = document.activeElement;
  $('#mConfTit').textContent = titulo; $('#mConfTxt').textContent = texto; $('#mConfSim').textContent = rotulo;
  mConf.hidden = false;
  setTimeout(() => $('#mConfNao').focus(), 30);
  return new Promise(res => { resolverConf = res; });
}
function responderConf(sim) {
  mConf.hidden = true;
  if (focoConf && document.contains(focoConf)) focoConf.focus();
  if (resolverConf) { const r = resolverConf; resolverConf = null; r(sim); }
}
$('#mConfSim').addEventListener('click', () => responderConf(true));
$('#mConfNao').addEventListener('click', () => responderConf(false));
mConf.addEventListener('click', e => { if (e.target === mConf) responderConf(false); });

// bug nascido de um teste que falhou: já vai com sistema, dono e o erro
function bugDoTeste(suiteId, i) {
  const ex = ultima; if (!ex) return;
  const s = ex.suites.find(x => x.id === suiteId), t = s && s.testes[i];
  if (!t) return;
  irPara('bugs');
  abrirBug(null, {
    origem: `${s.id}#${i}`,
    titulo: `${s.nome}: falhou em “${t.nome}”`.slice(0, 140),
    sistema: s.sistema, severidade: t.sev, responsavel: DONOS[s.sistema] || 'Theo',
    passos: `1. Abrir a Central de Qualidade\n2. Clicar em Rodar testes\n3. Ver a suíte “${s.nome}” › “${t.nome}”` +
      (s.url ? `\n\nPágina testada: ${s.url.replace(location.origin, '')}` : ''),
    esperado: t.esperado, obtido: t.erro
  });
}

/* ===========================================================
   AÇÕES E EVENTOS
   =========================================================== */
function irPara(aba) {
  const b = $(`.aba[data-aba="${aba}"]`);
  if (b && !b.classList.contains('on')) b.click();
}
NT.abas(document, aba => { D.gravar('aba', aba); if (aba === 'testes') desenharGrafico(); });

$('#bRodar').addEventListener('click', () => { irPara('testes'); rodarTestes(); });

$('#arvore').addEventListener('click', e => {
  const cab = e.target.closest('.suite-cab');
  if (cab) {
    const id = cab.dataset.suite, ex = rodando || ultima, s = ex.suites.find(x => x.id === id);
    abertas.set(id, !estaAberta(s));
    desenharArvore();
    const novo = $(`.suite-cab[data-suite="${CSS.escape(id)}"]`);
    if (novo) novo.focus();
    return;
  }
  const ab = e.target.closest('[data-abrir-bug]');
  if (ab) return bugDoTeste(ab.dataset.abrirBug, +ab.dataset.i);
  const vb = e.target.closest('[data-ver-bug]');
  if (vb) { irPara('bugs'); return abrirBug(bugs.find(b => b.id === vb.dataset.verBug)); }
  if (e.target.closest('[data-acao="rodar"]')) rodarTestes();
});

$('#cSoFalhas').addEventListener('change', e => { D.gravar('soFalhas', e.target.checked); desenharArvore(); });

$('#bExpandir').addEventListener('click', () => {
  const ex = rodando || ultima;
  if (!ex) return NT.aviso('Rode os testes primeiro.');
  const abrir = ex.suites.some(s => !estaAberta(s));
  ex.suites.forEach(s => abertas.set(s.id, abrir));
  $('#bExpandir').textContent = abrir ? 'Recolher tudo' : 'Expandir tudo';
  desenharArvore();
});

$('#bRelatorio').addEventListener('click', () => {
  if (!ultima) return NT.aviso('Ainda não há execução detalhada para baixar.');
  const c = contar(ultima);
  const linhas = [`Central de Qualidade · Nassa Tech`, `Execução de ${new Date(ultima.quando).toLocaleString('pt-BR')}`,
    `${c.passou}/${c.total} passaram (${pct(c.passou, c.total)}%) · ${c.falhou} falharam · ${c.ignorado} ignorados · ${fmtMs(ultima.ms)}`, ''];
  ultima.suites.forEach(s => {
    linhas.push(`${s.emoji} ${s.nome}`);
    s.testes.forEach(t => {
      linhas.push(`  ${ICONE[t.status]} ${t.nome}${t.ms != null && t.status !== 'ignorado' ? ` (${fmtMs(t.ms)})` : ''}${t.det ? ' — ' + t.det : ''}`);
      if (t.erro) linhas.push('      ' + t.erro.replace(/\n/g, '\n      '));
    });
    linhas.push('');
  });
  NT.baixar(`qualidade-${NT.hojeISO()}.txt`, linhas.join('\n'));
  NT.aviso('Relatório baixado.');
});

$('#bLimparHist').addEventListener('click', async () => {
  if (!historico.length) return NT.aviso('O histórico já está vazio.');
  if (!await confirmar('Apagar o histórico?', 'As execuções guardadas e o resultado detalhado da última saem da tela.', 'Apagar')) return;
  historico = []; ultima = null;
  D.gravar('historico', historico); D.apagar('ultima');
  desenharTudo();
  NT.aviso('Histórico apagado.');
});

// ajustes da bateria
$('#aLimite').value = ajustes.limite;
$('#aUnit').checked = ajustes.unit;
$('#aFumaca').checked = ajustes.fumaca;
$('#fAjustes').addEventListener('submit', e => e.preventDefault());
$('#fAjustes').addEventListener('change', () => {
  const n = Math.round(+$('#aLimite').value);
  ajustes.limite = Math.min(20000, Math.max(200, isFinite(n) && n ? n : AJUSTES_PADRAO.limite));
  $('#aLimite').value = ajustes.limite;
  ajustes.unit = $('#aUnit').checked;
  ajustes.fumaca = $('#aFumaca').checked;
  D.gravar('ajustes', ajustes);
  NT.aviso('Ajustes salvos — valem na próxima execução.');
});

// filtros dos bugs
const gravarFiltros = () => { D.gravar('filtros', filtros); desenharBugs(); };
$('#fSev').addEventListener('change', e => { filtros.sev = e.target.value; gravarFiltros(); });
$('#fStatus').addEventListener('change', e => { filtros.status = e.target.value; gravarFiltros(); });
$('#fSis').addEventListener('change', e => { filtros.sis = e.target.value; gravarFiltros(); });
$('#fBusca').addEventListener('input', e => { filtros.busca = e.target.value; gravarFiltros(); });
$('#bLimparFiltros').addEventListener('click', () => { filtros = {}; preencherSelects(); gravarFiltros(); });

$('#bNovoBug').addEventListener('click', () => abrirBug(null));

$('#listaBugs').addEventListener('click', e => {
  const ed = e.target.closest('[data-editar]');
  if (ed) abrirBug(bugs.find(b => b.id === ed.dataset.editar));
});
$('#listaBugs').addEventListener('change', e => {
  const sel = e.target.closest('[data-status]');
  if (!sel) return;
  const b = bugs.find(x => x.id === sel.dataset.status);
  b.status = sel.value; b.atualizado = Date.now();
  salvarBugs();
  const novo = document.getElementById('st-' + b.id); if (novo) novo.focus();
  NT.aviso(`${b.id} agora está ${STATUS[b.status].toLowerCase()}.`);
});

$('#bCsv').addEventListener('click', () => {
  const lista = bugsFiltrados();
  if (!lista.length) return NT.aviso('Nenhum bug para exportar com esses filtros.');
  const cel = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const cab = ['Código', 'Título', 'Sistema', 'Severidade', 'Status', 'Responsável', 'Criado em', 'Passos', 'Esperado', 'Obtido'];
  const linhas = lista.map(b => [b.id, b.titulo, sistema(b.sistema).nome, SEV[b.severidade], STATUS[b.status], b.responsavel,
    NT.data(b.criado), b.passos, b.esperado, b.obtido].map(cel).join(';'));
  // BOM + ponto e vírgula: abre certinho no Excel em português
  NT.baixar(`bugs-nassa-tech-${NT.hojeISO()}.csv`, '﻿' + [cab.map(cel).join(';'), ...linhas].join('\r\n'), 'text/csv;charset=utf-8');
  NT.aviso(`${lista.length} bugs exportados.`);
});

$('#bRestaurar').addEventListener('click', async () => {
  if (rodando) return NT.aviso('Espere a bateria terminar.');
  if (!await confirmar('Restaurar o exemplo?', 'Bugs, histórico de execuções e ajustes atuais voltam aos dados de exemplo. O que você registrou aqui se perde.', 'Restaurar')) return;
  semear();
  bugs = D.ler('bugs', []); historico = D.ler('historico', []); ultima = null;
  ajustes = Object.assign({}, AJUSTES_PADRAO); filtros = {};
  $('#aLimite').value = ajustes.limite; $('#aUnit').checked = true; $('#aFumaca').checked = true;
  abertas.clear();
  preencherSelects(); desenharTudo();
  NT.aviso('Dados de exemplo restaurados.');
});

// o gráfico é desenhado na largura real da caixa (texto nítido, sem esticar)
let largura = 0;
new ResizeObserver(([e]) => {
  const w = Math.round(e.contentRect.width);
  if (w && Math.abs(w - largura) > 4) { largura = w; desenharGrafico(); }
}).observe($('#grafico'));

/* ---------- início ---------- */
$('#cSoFalhas').checked = !!D.ler('soFalhas', false);
preencherSelects();
desenharTudo();
irPara(D.ler('aba', 'testes'));
NT.sistemas().then(c => { if (c.length) { catalogo = c; preencherSelects(); desenharBugs(); } });
})();
