/* ===========================================================
   sistemas/devops/app.js — Central de Deploy (Dani · DevOps & Cloud)

   Três frentes:
   - Saúde: faz fetch de verdade em cada sistema do catálogo, mede a
     latência com performance.now() e guarda os últimos 30 testes.
   - Pipeline: roda as etapas do deploy dos projetos dos clientes com
     log ao vivo e histórico (com rollback da versão que está no ar).
   - Domínios: vencimento de domínio e SSL dos clientes.
   Tudo fica em NT.dados('devops') e sobrevive ao recarregar.
   =========================================================== */
(() => {
'use strict';

const D = NT.dados('devops');
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = NT.esc;
const espera = ms => new Promise(r => setTimeout(r, ms));
const sorteio = (a, b) => a + Math.random() * (b - a);
const hash = () => Array.from({ length: 7 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');

// quem cuida de cada sistema no escritório (para o cartão dizer de quem é)
const DONOS = {
  frontend: 'Lucas · Front-end', backend: 'Marina · Back-end', fullstack: 'Rafa · Full-stack',
  mobile: 'Bia · Mobile', devops: 'Dani · DevOps', qa: 'Theo · QA', design: 'Lia · UI/UX',
  ia: 'Nico · IA & automação', comercial: 'Duda · Comercial'
};
const LENTO_MS = 1000;      // acima disso o sistema responde, mas fica amarelo
const LIMITE_MS = 8000;     // sem resposta até aqui = fora do ar
const INTERVALO = 60;       // segundos entre as verificações automáticas

/* ---------- projetos dos clientes que passam pelo pipeline ---------- */
const PROJETOS = [
  { id: 'site-pao-de-mel', nome: 'Site Padaria Pão de Mel', cliente: 'Padaria Pão de Mel', stack: 'Next.js 14', pm: 'npm', alvo: 'Vercel', host: 'padariapaodemel.com.br', testes: 38,
    msgs: ['feat: botão de encomenda pelo WhatsApp', 'fix: horário de domingo no rodapé', 'perf: fotos do cardápio em WebP'] },
  { id: 'agenda-sorriso', nome: 'Agenda online Clínica Sorriso', cliente: 'Clínica Sorriso', stack: 'Node 20 + PostgreSQL', pm: 'npm', alvo: 'AWS ECS (sa-east-1)', host: 'agenda.clinicasorriso.com.br', testes: 142, api: true,
    msgs: ['feat: lembrete de consulta 24 h antes', 'fix: fuso horário dos lembretes', 'feat: encaixe de horário pela recepção'] },
  { id: 'portal-duarte', nome: 'Portal do cliente Advocacia Duarte', cliente: 'Advocacia Duarte', stack: 'Laravel 11', pm: 'composer', alvo: 'VPS Hostinger (Docker)', host: 'portal.advocaciaduarte.adv.br', testes: 96, api: true,
    msgs: ['feat: upload de documentos do processo', 'fix: paginação das movimentações', 'chore: atualiza dependências'] },
  { id: 'app-forca-total', nome: 'API do app Academia Força Total', cliente: 'Academia Força Total', stack: 'NestJS + Prisma', pm: 'npm', alvo: 'Railway', host: 'api.academiaforcatotal.com.br', testes: 211, api: true,
    msgs: ['feat: check-in por QR Code', 'fix: mensalidade proporcional no 1º mês', 'feat: ranking de frequência do mês'] },
  { id: 'vitrine-horizonte', nome: 'Vitrine de imóveis Horizonte', cliente: 'Imobiliária Horizonte', stack: 'Astro + Strapi', pm: 'npm', alvo: 'Cloudflare Pages', host: 'imobiliariahorizonte.com.br', testes: 57,
    msgs: ['feat: filtro por bairro e faixa de preço', 'fix: mapa no celular', 'feat: botão agendar visita'] },
  { id: 'bot-amigo-fiel', nome: 'Atendente IA Pet Shop Amigo Fiel', cliente: 'Pet Shop Amigo Fiel', stack: 'Python 3.12 + FastAPI', pm: 'pip', alvo: 'Google Cloud Run', host: 'bot.petshopamigofiel.com.br', testes: 64, api: true,
    msgs: ['feat: responde preço de banho e tosa', 'fix: agenda de vacinas no sábado', 'feat: passa para humano depois de 3 tentativas'] },
  { id: 'site-nassa', nome: 'Site Nassa Tech', cliente: 'Nassa Tech', stack: 'HTML estático', pm: 'nenhum', alvo: 'GitHub Pages', host: 'nassatech.com.br', testes: 12,
    msgs: ['feat: case da Clínica Sorriso', 'fix: formulário de contato no iPhone', 'chore: novo endereço na Faria Lima'] }
];
const projeto = id => PROJETOS.find(p => p.id === id) || PROJETOS[0];
const ETAPAS = ['Checkout', 'Instalar', 'Lint', 'Testes', 'Build', 'Deploy', 'Smoke test'];
const AMB = { homolog: 'Homologação', prod: 'Produção' };

/* ---------- dados de exemplo ---------- */
function quando(diasAtras, h, m) {
  const d = new Date(); d.setDate(d.getDate() - diasAtras); d.setHours(h, m, 0, 0);
  // o de "hoje" não pode ficar no futuro se a página abrir de madrugada
  return Math.min(d.getTime(), Date.now() - (20 + diasAtras) * 60000);
}
// etapas com tempos plausíveis; 'ate' = índice da etapa que falhou/parou
function etapasExemplo(status, ate) {
  return ETAPAS.map((_, i) => {
    const ms = Math.round(sorteio([700, 1800, 900, 2300, 1900, 1800, 900][i], [1100, 2600, 1300, 3200, 2600, 2600, 1300][i]));
    if (status === 'sucesso' || status === 'revertido' || i < ate) return [ms, 'ok'];
    if (i === ate) return [ms, 'err'];
    return [0, 'pulada'];
  });
}
function deploysExemplo() {
  const L = [
    ['site-pao-de-mel', 'homolog', 'sucesso', 0, 10, 42, 0],
    ['agenda-sorriso', 'prod', 'sucesso', 1, 17, 15, 0],
    ['agenda-sorriso', 'homolog', 'sucesso', 1, 16, 50, 0],
    ['app-forca-total', 'prod', 'falhou', 3, 11, 20, 1],
    ['portal-duarte', 'prod', 'sucesso', 3, 10, 5, 0],
    ['vitrine-horizonte', 'prod', 'sucesso', 6, 15, 30, 0],
    ['agenda-sorriso', 'prod', 'sucesso', 8, 9, 12, 1],
    ['bot-amigo-fiel', 'homolog', 'cancelado', 12, 14, 48, 0],
    ['site-nassa', 'prod', 'sucesso', 15, 18, 3, 0],
    ['app-forca-total', 'prod', 'sucesso', 20, 11, 40, 2],
    ['portal-duarte', 'prod', 'sucesso', 24, 16, 22, 1],
    ['vitrine-horizonte', 'prod', 'sucesso', 34, 10, 10, 1]
  ];
  return L.map(([pid, amb, status, dias, h, m, msg]) => {
    const etapas = etapasExemplo(status, status === 'falhou' ? 3 : 5);
    return {
      id: NT.id(), projeto: pid, amb, status, tipo: 'deploy', commit: hash(), msg: projeto(pid).msgs[msg],
      inicio: quando(dias, h, m), dur: etapas.reduce((s, e) => s + e[0], 0) + 400, quem: 'Dani', etapas
    };
  });
}
function dominiosExemplo() {
  const L = [
    ['padariapaodemel.com.br', 'Padaria Pão de Mel', 'Registro.br', 212, 18, "Let's Encrypt", true],
    ['clinicasorriso.com.br', 'Clínica Sorriso', 'Registro.br', 95, 61, "Let's Encrypt", true],
    ['advocaciaduarte.adv.br', 'Advocacia Duarte', 'Registro.br', 12, 74, 'Sectigo', true],
    ['academiaforcatotal.com.br', 'Academia Força Total', 'Hostinger', 340, -3, "Let's Encrypt", true],
    ['imobiliariahorizonte.com.br', 'Imobiliária Horizonte', 'GoDaddy', 150, 27, 'Cloudflare', false],
    ['petshopamigofiel.com.br', 'Pet Shop Amigo Fiel', 'Registro.br', -5, 40, "Let's Encrypt", false],
    ['nassatech.com.br', 'Nassa Tech', 'Registro.br', 410, 83, "Let's Encrypt", true],
    ['mercadinhobompreco.com.br', 'Mercadinho Bom Preço', 'Locaweb', 58, 88, "Let's Encrypt", true],
    ['contabilidadeexata.com.br', 'Contabilidade Exata', 'HostGator', 180, 45, 'Sectigo', true]
  ];
  return L.map(([dominio, cliente, reg, dv, ds, emissor, dns]) =>
    ({ id: NT.id(), dominio, cliente, reg, venc: NT.hojeISO(dv), ssl: NT.hojeISO(ds), emissor, dns }));
}
function semear() {
  D.gravar('deploys', deploysExemplo());
  D.gravar('dominios', dominiosExemplo());
}
if (D.ler('deploys', null) === null) semear();

/* ---------- formatos ---------- */
function fmtDur(ms) {
  const s = ms / 1000;
  if (s < 60) return s.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' s';
  return Math.floor(s / 60) + ' min ' + String(Math.round(s % 60)).padStart(2, '0') + ' s';
}
function fmtQuando(t, seg = false) {
  const d = new Date(t), hoje = new Date();
  const h = seg ? NT.hora(t) : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dias = Math.round((new Date(hoje.toDateString()) - new Date(d.toDateString())) / 864e5);
  if (dias === 0) return 'hoje ' + h;
  if (dias === 1) return 'ontem ' + h;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + h;
}
function diasAte(iso) {
  if (!iso) return null;
  return Math.round((new Date(iso + 'T12:00:00') - new Date(NT.hojeISO() + 'T12:00:00')) / 864e5);
}
function badgeDias(iso) {
  const d = diasAte(iso);
  if (d === null) return '<span class="badge">sem data</span>';
  if (d < 0) return `<span class="badge err">venceu há ${-d} dia${d === -1 ? '' : 's'}</span>`;
  if (d === 0) return '<span class="badge err">vence hoje</span>';
  if (d < 30) return `<span class="badge warn">${d} dia${d === 1 ? '' : 's'}</span>`;
  return `<span class="badge ok">${d} dias</span>`;
}

/* ===========================================================
   SAÚDE — health check de verdade
   =========================================================== */
let catalogo = [];
let verificando = false;
let proxima = 0;          // quando roda a próxima verificação automática
const saude = () => D.ler('saude', {});
const ultimoDe = id => { const h = saude()[id]; return h && h.length ? h[h.length - 1] : null; };

async function sondar(url) {
  const ctrl = new AbortController();
  const tempo = setTimeout(() => ctrl.abort(), LIMITE_MS);
  const t0 = performance.now();
  try {
    const r = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
    const corpo = await r.text();     // conta o tempo até a página chegar inteira
    const ms = Math.round(performance.now() - t0);
    return { http: r.status, ok: r.ok, ms, corpo, lm: r.headers.get('last-modified') };
  } catch (e) {
    return { http: 0, ok: false, ms: Math.round(performance.now() - t0), erro: e.name === 'AbortError' ? 'tempo esgotado' : 'sem resposta' };
  } finally { clearTimeout(tempo); }
}
const classe = r => !r.ok ? 'err' : r.ms >= LENTO_MS ? 'warn' : 'ok';
function semServidor(pagEsc) {
  try { if (window.parent !== window && window.parent.ESCRITORIO) return false; } catch (e) { /* outra origem */ }
  return !!(pagEsc && pagEsc.lm);
}

async function verificar() {
  if (verificando) return;
  verificando = true;
  const bot = $('#bVerificar');
  bot.disabled = true; bot.textContent = '⟳ Verificando…';
  $$('.sis').forEach(c => c.classList.add('verificando'));
  try {
    if (!catalogo.length) catalogo = await NT.sistemas();
    const agora = Date.now();
    const alvos = catalogo.map(s => ({ id: s.id, url: '../' + s.id + '/' }))
      .concat([{ id: '_escritorio', url: '../../index.html' }]);
    const res = await Promise.all(alvos.map(a => sondar(a.url)));
    // A API só existe com o server.js, que nunca manda Last-Modified; GitHub Pages
    // e servidores estáticos mandam. Se a página do escritório veio com ele, nem
    // pergunta pela API: o 404 sujaria o console à toa e o resultado já se sabe.
    const pagEsc = res[res.length - 1];
    alvos.push({ id: '_api', url: '/api/sistemas' });
    res.push(semServidor(pagEsc) ? { http: 0, ok: false, ms: 0, erro: 'sem servidor' } : await sondar('/api/sistemas'));
    const hist = saude();
    alvos.forEach((a, i) => {
      const r = res[i];
      const reg = { t: agora, s: classe(r), ms: r.ms, http: r.http };
      if (r.erro) reg.erro = r.erro;
      // a API do escritório só existe com o server.js ligado; guarda quantos sistemas ele conhece
      if (a.id === '_api' && r.ok) {
        try { const j = JSON.parse(r.corpo); reg.n = Array.isArray(j) ? j.length : null; } catch (e) { reg.s = 'err'; }
      }
      hist[a.id] = (hist[a.id] || []).concat(reg).slice(-30);
    });
    D.gravar('saude', hist);
    D.gravar('ultimo', agora);
    registrar(agora);
  } finally {
    verificando = false;
    bot.disabled = false; bot.textContent = '⟳ Verificar agora';
    if (D.ler('auto', false)) proxima = Date.now() + INTERVALO * 1000;
    renderSaude(); renderKpis();
  }
}

// uma linha por rodada no registro, para enxergar quando algo caiu
function registrar(t) {
  const ult = catalogo.map(s => ultimoDe(s.id)).filter(Boolean);
  const noAr = ult.filter(u => u.s !== 'err');
  const fora = catalogo.filter(s => (ultimoDe(s.id) || {}).s === 'err').map(s => s.id);
  const lentos = ult.filter(u => u.s === 'warn').length;
  const media = noAr.length ? Math.round(noAr.reduce((s, u) => s + u.ms, 0) / noAr.length) : 0;
  let txt = `${catalogo.length} sistemas · ${noAr.length} no ar`;
  if (lentos) txt += ` · ${lentos} lento${lentos > 1 ? 's' : ''}`;
  if (fora.length) txt += ` · fora do ar: ${fora.join(', ')}`;
  txt += ` · média ${media} ms`;
  const linhas = D.ler('registro', []);
  linhas.unshift({ t, txt, cls: fora.length ? (noAr.length ? 'warn' : 'err') : 'ok' });
  D.gravar('registro', linhas.slice(0, 40));
}

function barraUptime(h) {
  const cel = [];
  for (let i = 0; i < 30 - h.length; i++) cel.push('<i title="sem teste"></i>');
  h.forEach(x => cel.push(`<i class="${x.s}" title="${esc(NT.hora(x.t))} · ${x.http || '—'} · ${x.ms} ms"></i>`));
  return `<div class="uptime" role="img" aria-label="${h.filter(x => x.s !== 'err').length} de ${h.length} testes no ar">${cel.join('')}</div>`;
}
const pct = h => h.length ? Math.round(100 * h.filter(x => x.s !== 'err').length / h.length) + '% no ar' : 'sem testes';
const rotulo = u => !u ? 'Não verificado' : u.s === 'ok' ? 'No ar' : u.s === 'warn' ? 'Lento' : 'Fora do ar';
const textoHttp = u => !u ? '—' : u.http ? String(u.http) : (u.erro || 'erro');

function renderSaude() {
  const hist = saude();
  // escritório: página principal e API do server.js
  const esc1 = ultimoDe('_escritorio'), api = ultimoDe('_api');
  const itemEsc = !esc1
    ? `<div class="infra-item"><span class="ic">🏢</span><div><b>Página do escritório</b><span class="dim">Ainda não verificada.</span></div></div>`
    : `<div class="infra-item"><span class="ic">🏢</span><div><b><span class="ponto ${esc1.s}"></span> Página do escritório: ${esc1.s === 'err' ? 'fora do ar' : 'no ar'}</b>
       <span class="dim mono">index.html · HTTP ${esc(textoHttp(esc1))} · ${esc1.ms} ms</span></div></div>`;
  let itemApi;
  if (!api) itemApi = `<div class="infra-item"><span class="ic">🖥️</span><div><b>Servidor do escritório</b><span class="dim">Ainda não verificado.</span></div></div>`;
  else if (api.s !== 'err') itemApi = `<div class="infra-item"><span class="ic">🖥️</span><div><b><span class="ponto ok"></span> Servidor do escritório: online</b>
       <span class="dim mono">/api/sistemas · ${api.ms} ms${api.n != null ? ' · ' + api.n + ' sistemas registrados' : ''}</span></div></div>`;
  else itemApi = `<div class="infra-item info"><span class="ic">ℹ️</span><div><b>Servidor do escritório: offline — página publicada no GitHub Pages</b>
       <span class="dim">Sem o server.js os sistemas abrem direto do navegador; isso é esperado e não conta como falha.</span></div></div>`;
  $('#infra').innerHTML = itemEsc + itemApi;

  if (!catalogo.length) { $('#gradeSis').innerHTML = '<div class="vazio">Não consegui ler o catálogo dos sistemas (../catalogo.json).</div>'; }
  else $('#gradeSis').innerHTML = catalogo.map(s => {
    const h = hist[s.id] || [], u = h[h.length - 1];
    const cls = u ? u.s : '';
    return `<article class="sis ${cls}">
      <div class="sis-topo">
        <div class="sis-emoji" aria-hidden="true">${esc(s.emoji || '•')}</div>
        <div class="sis-nome"><b title="${esc(s.nome)}">${esc(s.nome)}</b><span>${esc(DONOS[s.id] || s.agente || '')}</span></div>
        <span class="badge ${cls}"><span class="ponto ${cls}"></span>${rotulo(u)}</span>
      </div>
      <div class="sis-dados">
        <div><span>HTTP</span><b>${esc(textoHttp(u))}</b></div>
        <div><span>Latência</span><b>${u ? u.ms + ' ms' : '—'}</b></div>
        <div><span>Verificado</span><b>${u ? NT.hora(u.t) : '—'}</b></div>
      </div>
      ${barraUptime(h)}
      <div class="uptime-leg"><span>últimos 30 testes</span><span>${pct(h)}</span></div>
      <div class="sis-pe"><span class="mono">sistemas/${esc(s.id)}/</span><a href="../${esc(s.id)}/" target="_blank" rel="noopener">Abrir ↗</a></div>
    </article>`;
  }).join('');

  // resumo no topo da aba
  const ult = catalogo.map(s => ultimoDe(s.id));
  const feitos = ult.filter(Boolean);
  const fora = feitos.filter(u => u.s === 'err').length;
  const quando = D.ler('ultimo', 0);
  $('#pontoGeral').className = 'ponto ' + (!feitos.length ? '' : fora === 0 ? 'ok' : fora === feitos.length ? 'err' : 'warn');
  $('#resumoGeral').textContent = !feitos.length ? 'Ainda não verifiquei'
    : fora === 0 ? 'Todos os sistemas respondendo' : `${fora} de ${catalogo.length} sistemas fora do ar`;
  $('#ultimaVerif').textContent = quando ? 'Última verificação: ' + fmtQuando(quando, true) : 'Clique em Verificar agora para testar todos os sistemas.';

  const linhas = D.ler('registro', []);
  $('#logChecks').innerHTML = linhas.length
    ? linhas.map(l => `<span class="t">[${fmtQuando(l.t, true)}]</span> <span class="${l.cls}">${esc(l.txt)}</span>`).join('\n')
    : '<span class="dim">Nenhuma verificação registrada.</span>';
}

// verificação automática: um relógio só, que também mostra a contagem
function ligarAuto(on) {
  D.gravar('auto', on);
  $('#cAuto').checked = on;
  proxima = on ? Date.now() + INTERVALO * 1000 : 0;
  atualizarContagem();
}
function atualizarContagem() {
  const b = $('#contagem');
  if (!proxima) { b.hidden = true; return; }
  const s = Math.max(0, Math.ceil((proxima - Date.now()) / 1000));
  b.hidden = false;
  b.className = 'badge acc';
  b.textContent = verificando ? 'verificando…' : `próxima em ${s} s`;
}
setInterval(() => {
  if (proxima && !verificando && Date.now() >= proxima) verificar();
  atualizarContagem();
}, 1000);

/* ===========================================================
   PIPELINE
   =========================================================== */
const deploys = () => D.ler('deploys', []);
let rodando = null;        // execução atual: { cancelar: bool }
let mostrar = 10;          // linhas do histórico na tela; o resto vem no Mostrar mais

// versão no ar = deploy com sucesso mais recente daquele projeto/ambiente
function versaoNoAr(pid, amb, lista = deploys()) {
  return lista.find(d => d.projeto === pid && d.amb === amb && d.status === 'sucesso') || null;
}
function alvoRollback(d, lista = deploys()) {
  const i = lista.indexOf(d);
  return lista.slice(i + 1).find(x => x.projeto === d.projeto && x.amb === d.amb && x.status === 'sucesso' && x.commit !== d.commit) || null;
}

// o que cada etapa escreve no log, conforme a stack do projeto
function linhasEtapa(i, p, amb, ctx) {
  const host = (amb === 'prod' ? '' : 'homolog.') + p.host;
  const branch = amb === 'prod' ? 'main' : 'develop';
  const instalar = { npm: ['$ npm ci', `${800 + p.testes * 3} pacotes instalados, ${820 + p.testes * 3} auditados em 14 s`, '0 vulnerabilidades encontradas'],
    composer: ['$ composer install --no-dev --optimize-autoloader', '92 pacotes instalados a partir do composer.lock', 'autoload otimizado gerado'],
    pip: ['$ pip install -r requirements.txt', 'instalados fastapi, uvicorn, openai e pydantic (31 pacotes)'],
    nenhum: ['site estático: nada para instalar'] }[p.pm];
  const lint = { npm: '$ npx eslint . --max-warnings 0', composer: '$ vendor/bin/phpstan analyse --level=6', pip: '$ ruff check .', nenhum: '$ npx htmlhint "**/*.html"' }[p.pm];
  const testes = { npm: '$ npm test -- --ci', composer: '$ php artisan test --parallel', pip: '$ pytest -q', nenhum: '$ npx linkinator . --recurse' }[p.pm];
  const build = { npm: ['$ npm run build', `build concluído · ${(1.2 + p.testes / 120).toFixed(1).replace('.', ',')} MB`],
    composer: [`$ docker build -t nassatech/${p.id}:${ctx.commit} .`, 'imagem pronta · 214 MB'],
    pip: [`$ docker build -t gcr.io/nassatech/${p.id}:${ctx.commit} .`, 'imagem pronta · 168 MB'],
    nenhum: ['$ cp -r site/ dist/', 'dist/ com 14 arquivos · 2,3 MB'] }[p.pm];
  switch (i) {
    case 0: return [[`$ git clone git@github.com:nassatech/${p.id}.git`], [`branch ${branch} · commit ${ctx.commit}`, 'acc'], [`"${ctx.msg}"`, 'dim']];
    case 1: return instalar.map((l, k) => [l, k === instalar.length - 1 ? 'ok' : '']);
    case 2: return [[lint], ['✓ 0 problemas encontrados', 'ok']];
    case 3:
      if (ctx.falhar) return [[testes], [`✗ ${p.nome.split(' ')[0].toLowerCase()} › ${ctx.msg.replace(/^\w+: /, '')}`, 'err'],
        ['  esperado: "09:00"  recebido: "12:00"', 'err'], [`Testes: 1 falhou, ${p.testes - 1} passaram, ${p.testes} no total`, 'err']];
      return [[testes], [`✓ ${p.testes} testes passaram`, 'ok'], [`cobertura ${78 + (p.testes % 15)}%`, 'dim']];
    case 4: return build.map((l, k) => [l, k === build.length - 1 ? 'ok' : '']);
    case 5: return [[`publicando em ${p.alvo} · ${AMB[amb]}`], ['upload 100%'],
      amb === 'prod' ? ['trocando o tráfego: 0% → 100% (sem derrubar ninguém)', 'warn'] : ['ambiente de homologação atualizado'],
      [`nova versão ativa: https://${host}/`, 'ok']];
    case 6: {
      const l = [[`GET https://${host}/ → 200 (${Math.round(sorteio(90, 260))} ms)`, 'ok']];
      if (p.api) l.push([`GET https://${host}/api/saude → 200 (${Math.round(sorteio(40, 140))} ms)`, 'ok']);
      l.push([`certificado SSL válido · ${host}`, 'ok']);
      return l;
    }
  }
  return [];
}

const logEl = () => $('#logPipe');
function escreverLog(ctx, txt, cls = '') {
  const t = NT.hora();
  ctx.log.push([t, txt, cls]);
  const el = logEl();
  if (ctx.log.length === 1) el.innerHTML = '';
  el.insertAdjacentHTML('beforeend', `<span class="t">[${t}]</span> <span class="${cls}">${esc(txt)}</span>\n`);
  el.scrollTop = el.scrollHeight;
}
function renderEtapas(etapas, atual = -1) {
  $('#etapas').innerHTML = ETAPAS.map((n, i) => {
    const e = etapas ? etapas[i] : null;
    const st = i === atual ? 'rodando' : e ? e[1] : '';
    const tempo = i === atual ? 'rodando…' : !e ? 'pendente' : e[1] === 'pulada' ? 'pulada' : fmtDur(e[0]);
    return `<li class="${st}"><b><span class="ponto"></span>${n}</b><span>${tempo}</span></li>`;
  }).join('');
}
function statusExec(txt, cls) { const b = $('#exStatus'); b.className = 'badge ' + (cls || ''); b.textContent = txt; }

// roda o pipeline; rollback pula as etapas de instalar, lint, testes e build
async function executar({ p, amb, msg, commit, falhar = false, rollbackDe = null }) {
  const ctx = { commit, msg, falhar, log: [], cancelar: false };
  rodando = ctx;
  travarPipeline(true);
  $('#exTitulo').textContent = (rollbackDe ? 'Rollback · ' : 'Deploy · ') + p.nome + ' → ' + AMB[amb];
  statusExec('rodando', 'acc');
  const etapas = [];
  const t0 = performance.now();
  let status = 'sucesso';
  escreverLog(ctx, rollbackDe ? `rollback solicitado por Dani: ${rollbackDe.commit} → ${commit}` : `deploy iniciado por Dani · ${p.stack}`, 'acc');
  for (let i = 0; i < ETAPAS.length; i++) {
    if (status !== 'sucesso' || (rollbackDe && i >= 1 && i <= 4)) { etapas[i] = [0, 'pulada']; continue; }
    renderEtapas(etapas, i);
    escreverLog(ctx, `▸ ${ETAPAS[i]}`, 'acc');
    const linhas = rollbackDe && i === 0 ? [[`$ git checkout ${commit}`], [`versão estável: "${msg}"`, 'dim']] : linhasEtapa(i, p, amb, ctx);
    const total = sorteio([700, 1800, 900, 2300, 1900, 1800, 900][i], [1100, 2600, 1300, 3200, 2600, 2600, 1300][i]);
    const ti = performance.now();
    for (const [txt, cls] of linhas) {
      await espera(total / linhas.length);
      if (ctx.cancelar) break;
      escreverLog(ctx, txt, cls);
    }
    const ms = Math.round(performance.now() - ti);
    if (ctx.cancelar) { etapas[i] = [ms, 'err']; status = 'cancelado'; escreverLog(ctx, 'pipeline cancelado por Dani', 'warn'); continue; }
    if (i === 3 && falhar) { etapas[i] = [ms, 'err']; status = 'falhou'; escreverLog(ctx, 'testes falharam: nada foi publicado', 'err'); continue; }
    etapas[i] = [ms, 'ok'];
  }
  const dur = Math.round(performance.now() - t0);
  renderEtapas(etapas);
  if (status === 'sucesso') escreverLog(ctx, `✓ ${rollbackDe ? 'rollback concluído' : 'deploy concluído'} em ${fmtDur(dur)}`, 'ok');
  statusExec(status, status === 'sucesso' ? 'ok' : status === 'falhou' ? 'err' : 'warn');

  const lista = deploys();
  if (rollbackDe && status === 'sucesso') {
    const orig = lista.find(d => d.id === rollbackDe.id);
    if (orig) orig.status = 'revertido';
  }
  lista.unshift({ id: NT.id(), projeto: p.id, amb, status, tipo: rollbackDe ? 'rollback' : 'deploy', commit, msg,
    inicio: Date.now() - dur, dur, quem: 'Dani', etapas, log: ctx.log.slice(-80) });
  D.gravar('deploys', lista.slice(0, 40));
  rodando = null;
  travarPipeline(false);
  NT.aviso(status === 'sucesso' ? (rollbackDe ? 'Rollback concluído.' : `Deploy em ${AMB[amb].toLowerCase()} concluído.`)
    : status === 'falhou' ? 'Deploy falhou nos testes.' : 'Deploy cancelado.');
  if (!rollbackDe) $('#dMsg').value = sugerirMsg(p);
  renderHist(); renderNoAr(); renderKpis();
}
function travarPipeline(on) {
  $('#bRodar').disabled = on;
  $('#bCancelar').hidden = !on;
  $('#bCancelar').disabled = false;
  $('#dProjeto').disabled = on;
  $$('#fDeploy input').forEach(i => { i.disabled = on; });
  $$('[data-rollback]').forEach(b => { b.disabled = on; });
}
const sugerirMsg = p => p.msgs[Math.floor(Math.random() * p.msgs.length)];

async function pedirDeploy(e) {
  e.preventDefault();
  if (rodando) return;
  const p = projeto($('#dProjeto').value);
  const amb = $('input[name=amb]:checked').value;
  const msg = $('#dMsg').value.trim() || sugerirMsg(p);
  if (amb === 'prod') {
    const atual = versaoNoAr(p.id, 'prod');
    const ok = await confirmar({
      titulo: 'Publicar em produção?',
      html: `<p><b>${esc(p.nome)}</b> vai para <b>https://${esc(p.host)}/</b>.</p>
             <p>Commit: <span class="mono">${esc(msg)}</span></p>
             <p>${atual ? `Hoje está no ar a versão <span class="mono">${esc(atual.commit)}</span>, publicada ${esc(fmtQuando(atual.inicio))}. ` : ''}Os clientes da ${esc(p.cliente)} veem a mudança assim que o pipeline terminar.</p>`,
      sim: 'Publicar em produção', perigo: true
    });
    if (!ok) { NT.aviso('Deploy em produção cancelado.'); return; }
  }
  executar({ p, amb, msg, commit: hash(), falhar: $('#dFalha').checked });
}

async function pedirRollback(id) {
  if (rodando) return;
  const lista = deploys();
  const d = lista.find(x => x.id === id);
  const alvo = d && alvoRollback(d, lista);
  if (!alvo) { NT.aviso('Não há versão anterior estável para voltar.'); return; }
  const p = projeto(d.projeto);
  const ok = await confirmar({
    titulo: 'Fazer rollback?',
    html: `<p><b>${esc(p.nome)}</b> em ${AMB[d.amb].toLowerCase()} volta de <span class="mono">${esc(d.commit)}</span> para <span class="mono">${esc(alvo.commit)}</span>.</p>
           <p class="dim">Versão de destino: "${esc(alvo.msg)}", publicada ${esc(fmtQuando(alvo.inicio))}.</p>`,
    sim: 'Voltar versão', perigo: true
  });
  if (!ok) return;
  NT.aviso('Rollback em andamento…');
  $('#logPipe').scrollIntoView({ behavior: 'smooth', block: 'center' });
  executar({ p, amb: d.amb, msg: alvo.msg, commit: alvo.commit, rollbackDe: d });
}

function renderNoAr() {
  const p = projeto($('#dProjeto').value);
  const amb = $('input[name=amb]:checked').value;
  $('#dProjInfo').textContent = `${p.cliente} · ${p.stack} · publica em ${p.alvo}`;
  const v = versaoNoAr(p.id, amb);
  $('#dNoAr').innerHTML = v
    ? `No ar em ${AMB[amb].toLowerCase()}: <span class="mono commit">${esc(v.commit)}</span> · ${esc(v.msg)} (${esc(fmtQuando(v.inicio))})`
    : `Ainda não há versão publicada em ${AMB[amb].toLowerCase()}.`;
}

function renderHist() {
  const filtro = $('#hFiltro').value;
  const lista = deploys();
  const todas = lista.filter(d => !filtro || d.projeto === filtro);
  const linhas = todas.slice(0, mostrar);
  $('#hMais').hidden = todas.length <= mostrar;
  $('#bMais').textContent = `Mostrar mais (${todas.length - mostrar} restantes)`;
  const tb = $('#tHist tbody');
  if (!linhas.length) { tb.innerHTML = '<tr><td colspan="8"><div class="vazio">Nenhum deploy deste projeto ainda.</div></td></tr>'; return; }
  const BADGE = { sucesso: 'ok', falhou: 'err', cancelado: '', revertido: 'roxo' };
  tb.innerHTML = linhas.map(d => {
    const p = projeto(d.projeto);
    const vivo = versaoNoAr(d.projeto, d.amb, lista) === d;
    const podeVoltar = vivo && alvoRollback(d, lista);
    return `<tr>
      <td data-r="Quando">${esc(fmtQuando(d.inicio))}</td>
      <td data-r="Projeto"><div>${esc(p.nome)}<span class="msg-commit">${esc(p.cliente)}</span></div></td>
      <td data-r="Ambiente"><span class="badge ${d.amb === 'prod' ? 'warn' : 'acc'}">${AMB[d.amb]}</span></td>
      <td data-r="Commit"><div><span class="mono commit">${esc(d.commit)}</span><span class="msg-commit" title="${esc(d.msg)}">${esc(d.msg)}</span></div></td>
      <td data-r="Status"><div class="linha st">${d.tipo === 'rollback' ? '<span class="badge roxo">rollback</span>' : ''}<span class="badge ${BADGE[d.status]}">${d.status}</span>${vivo ? '<span class="badge ok">no ar</span>' : ''}</div></td>
      <td data-r="Duração" class="mono">${fmtDur(d.dur)}</td>
      <td data-r="Quem">${esc(d.quem)}</td>
      <td class="so-acoes"><div class="acoes-linha">
        <button type="button" class="btn mini ghost" data-log="${d.id}">Ver log</button>
        ${podeVoltar ? `<button type="button" class="btn mini danger" data-rollback="${d.id}" ${rodando ? 'disabled' : ''} title="Voltar para ${esc(podeVoltar.commit)}">↶ Rollback</button>` : ''}
      </div></td>
    </tr>`;
  }).join('');
}

function verLog(id) {
  const d = deploys().find(x => x.id === id);
  if (!d) return;
  const p = projeto(d.projeto);
  // deploys antigos (exemplo) não têm o log inteiro: monta o resumo pelas etapas
  const linhas = d.log && d.log.length ? d.log
    : [['', `${d.tipo === 'rollback' ? 'rollback' : 'deploy'} de ${p.nome} · ${AMB[d.amb]} · commit ${d.commit}`, 'acc'], ['', `"${d.msg}"`, 'dim']]
      .concat(d.etapas.map((e, i) => ['', `${e[1] === 'ok' ? '✓' : e[1] === 'err' ? '✗' : '–'} ${ETAPAS[i]}${e[1] === 'pulada' ? ' (pulada)' : ' · ' + fmtDur(e[0])}`, e[1] === 'ok' ? 'ok' : e[1] === 'err' ? 'err' : 'dim']))
      .concat([['', `resultado: ${d.status} em ${fmtDur(d.dur)}`, d.status === 'sucesso' ? 'ok' : 'warn']]);
  $('#mLogTit').textContent = `Log · ${p.nome} · ${d.commit}`;
  $('#mLogTxt').innerHTML = linhas.map(([t, txt, cls]) => (t ? `<span class="t">[${t}]</span> ` : '') + `<span class="${cls}">${esc(txt)}</span>`).join('\n');
  $('#mLogTxt').dataset.texto = linhas.map(([t, txt]) => (t ? `[${t}] ` : '') + txt).join('\n');
  NT.modal($('#mLog'), true);
}

/* ===========================================================
   DOMÍNIOS & SSL
   =========================================================== */
const dominios = () => D.ler('dominios', []);
let editando = null;

function renderDom() {
  const busca = $('#domBusca').value.trim().toLowerCase();
  const filtro = $('#domFiltro').value;
  const pior = d => Math.min(diasAte(d.venc), diasAte(d.ssl));
  const lista = dominios()
    .filter(d => !busca || (d.dominio + ' ' + d.cliente + ' ' + d.reg).toLowerCase().includes(busca))
    .filter(d => !filtro || (filtro === 'atencao' && pior(d) >= 0 && pior(d) < 30) || (filtro === 'vencido' && pior(d) < 0) || (filtro === 'dns' && !d.dns))
    .sort((a, b) => pior(a) - pior(b));
  const tb = $('#tDom tbody');
  if (!lista.length) { tb.innerHTML = `<tr><td colspan="7"><div class="vazio">${dominios().length ? 'Nenhum domínio com esse filtro.' : 'Nenhum domínio cadastrado. Clique em + Novo domínio.'}</div></td></tr>`; return; }
  tb.innerHTML = lista.map(d => {
    const dv = diasAte(d.venc), ds = diasAte(d.ssl);
    return `<tr>
      <td data-r="Domínio"><span class="mono">${esc(d.dominio)}</span></td>
      <td data-r="Cliente">${esc(d.cliente)}</td>
      <td data-r="Registrador">${esc(d.reg)}</td>
      <td data-r="Domínio vence"><div>${NT.data(d.venc)}<span class="dias">${badgeDias(d.venc)}</span></div></td>
      <td data-r="SSL vence"><div>${NT.data(d.ssl)} <span class="dim pequeno">${esc(d.emissor || '')}</span><span class="dias">${badgeDias(d.ssl)}</span></div></td>
      <td data-r="DNS">${d.dns ? '<span class="badge ok">✓ ok</span>' : '<span class="badge err">✗ problema</span>'}</td>
      <td class="so-acoes"><div class="acoes-linha">
        ${ds < 30 ? `<button type="button" class="btn mini" data-renovar-ssl="${d.id}">Renovar SSL</button>` : ''}
        ${dv < 30 ? `<button type="button" class="btn mini" data-renovar-dom="${d.id}">Renovar domínio</button>` : ''}
        <button type="button" class="btn mini ghost" data-editar="${d.id}" aria-label="Editar ${esc(d.dominio)}">Editar</button>
        <button type="button" class="btn mini danger" data-excluir="${d.id}" aria-label="Excluir ${esc(d.dominio)}">Excluir</button>
      </div></td>
    </tr>`;
  }).join('');
}

function abrirDom(id) {
  const d = id ? dominios().find(x => x.id === id) : null;
  editando = d ? d.id : null;
  $('#mDomTit').textContent = d ? 'Editar domínio' : 'Novo domínio';
  $('#fdDominio').value = d ? d.dominio : '';
  $('#fdCliente').value = d ? d.cliente : '';
  $('#fdReg').value = d ? d.reg : 'Registro.br';
  $('#fdEmissor').value = d ? d.emissor : "Let's Encrypt";
  $('#fdVenc').value = d ? d.venc : NT.hojeISO(365);
  $('#fdSsl').value = d ? d.ssl : NT.hojeISO(90);
  $('#fdDns').checked = d ? d.dns : true;
  $('#fdErro').textContent = '';
  const clientes = new Set(PROJETOS.map(p => p.cliente).concat(dominios().map(x => x.cliente)));
  $('#lClientes').innerHTML = [...clientes].sort().map(c => `<option value="${esc(c)}">`).join('');
  NT.modal($('#mDom'), true);
}

function salvarDom(e) {
  e.preventDefault();
  const dominio = $('#fdDominio').value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
  const cliente = $('#fdCliente').value.trim();
  const venc = $('#fdVenc').value, ssl = $('#fdSsl').value;
  const erro = msg => { $('#fdErro').textContent = msg; };
  if (!/^[a-z0-9à-ú]([a-z0-9à-ú-]*[a-z0-9à-ú])?(\.[a-z0-9-]+)+$/.test(dominio)) { erro('Informe um domínio válido, como clientenovo.com.br.'); $('#fdDominio').focus(); return; }
  if (!cliente) { erro('Diga de qual cliente é o domínio.'); $('#fdCliente').focus(); return; }
  if (!venc || !ssl) { erro('Preencha as duas datas de vencimento.'); return; }
  const lista = dominios();
  if (lista.some(x => x.dominio === dominio && x.id !== editando)) { erro('Esse domínio já está cadastrado.'); $('#fdDominio').focus(); return; }
  const dado = { dominio, cliente, reg: $('#fdReg').value, emissor: $('#fdEmissor').value, venc, ssl, dns: $('#fdDns').checked };
  if (editando) Object.assign(lista.find(x => x.id === editando), dado);
  else lista.push(Object.assign({ id: NT.id() }, dado));
  D.gravar('dominios', lista);
  NT.modal($('#mDom'), false);
  NT.aviso(editando ? 'Domínio atualizado.' : 'Domínio cadastrado.');
  renderDom(); renderKpis();
}

async function acaoDom(alvo) {
  const lista = dominios();
  const id = alvo.dataset.editar || alvo.dataset.excluir || alvo.dataset.renovarSsl || alvo.dataset.renovarDom;
  const d = lista.find(x => x.id === id);
  if (!d) return;
  if (alvo.dataset.editar) return abrirDom(id);
  if (alvo.dataset.excluir) {
    const ok = await confirmar({ titulo: 'Excluir domínio?', html: `<p><b class="mono">${esc(d.dominio)}</b> (${esc(d.cliente)}) sai da lista de acompanhamento.</p>`, sim: 'Excluir', perigo: true });
    if (!ok) return;
    D.gravar('dominios', lista.filter(x => x.id !== id));
    NT.aviso('Domínio excluído.');
  } else if (alvo.dataset.renovarSsl) {
    // Let's Encrypt e Cloudflare emitem por 90 dias; os pagos, por um ano
    const dias = /Let's|Cloudflare/.test(d.emissor) ? 90 : 365;
    d.ssl = NT.hojeISO(dias);
    D.gravar('dominios', lista);
    NT.aviso(`SSL de ${d.dominio} renovado até ${NT.data(d.ssl)}.`);
  } else {
    // renova por um ano a partir do vencimento (ou de hoje, se já venceu)
    const base = diasAte(d.venc) < 0 ? NT.hojeISO() : d.venc;
    const nova = new Date(base + 'T12:00:00'); nova.setFullYear(nova.getFullYear() + 1);
    d.venc = nova.toISOString().slice(0, 10);
    D.gravar('dominios', lista);
    NT.aviso(`${d.dominio} renovado até ${NT.data(d.venc)}.`);
  }
  renderDom(); renderKpis();
}

/* ===========================================================
   KPIs, confirmação e ligações
   =========================================================== */
function renderKpis() {
  const ult = catalogo.map(s => ultimoDe(s.id)).filter(Boolean);
  const noAr = ult.filter(u => u.s !== 'err');
  const media = noAr.length ? Math.round(noAr.reduce((s, u) => s + u.ms, 0) / noAr.length) : null;
  const hoje = new Date();
  const doMes = deploys().filter(d => { const x = new Date(d.inicio); return d.tipo === 'deploy' && x.getMonth() === hoje.getMonth() && x.getFullYear() === hoje.getFullYear(); });
  const falhas = doMes.filter(d => d.status === 'falhou').length;
  const certs = dominios().filter(d => diasAte(d.ssl) < 30);
  const vencidos = certs.filter(d => diasAte(d.ssl) < 0).length;
  const clsAr = !ult.length ? '' : noAr.length === catalogo.length ? 'ok' : noAr.length ? 'warn' : 'err';
  $('#kpis').innerHTML = `
    <div class="kpi ${clsAr}"><b>${ult.length ? noAr.length + '/' + catalogo.length : '—'}</b><span>Sistemas no ar</span><small>${ult.length ? (catalogo.length - noAr.length) + ' fora do ar' : 'aguardando verificação'}</small></div>
    <div class="kpi ${media === null ? '' : media < LENTO_MS ? 'acc' : 'warn'}"><b>${media === null ? '—' : media + ' ms'}</b><span>Latência média</span><small>só de quem respondeu</small></div>
    <div class="kpi"><b>${doMes.length}</b><span>Deploys no mês</span><small>${falhas ? falhas + ' com falha' : 'nenhuma falha'}</small></div>
    <div class="kpi ${certs.length ? (vencidos ? 'err' : 'warn') : 'ok'}"><b>${certs.length}</b><span>Certificados vencendo</span><small>${vencidos ? vencidos + ' já vencido' + (vencidos > 1 ? 's' : '') : 'nos próximos 30 dias'}</small></div>`;
}

// confirmação em modal (Esc, clique fora e Cancelar respondem "não")
let respostaConf = null, valorConf = false;
function confirmar({ titulo, html, sim = 'Confirmar', perigo = false }) {
  $('#mConfTit').textContent = titulo;
  $('#mConfTxt').innerHTML = html;
  const b = $('#mConfSim');
  b.textContent = sim;
  b.className = 'btn ' + (perigo ? 'primary perigo' : 'primary');
  return new Promise(res => { valorConf = false; respostaConf = res; NT.modal($('#mConf'), true); });
}
$('#mConfSim').addEventListener('click', () => { valorConf = true; NT.modal($('#mConf'), false); });
$('#mConfNao').addEventListener('click', () => NT.modal($('#mConf'), false));

// todo modal devolve o foco a quem abriu; o de confirmação também responde a promessa
$$('.modal-fundo').forEach(fundo => {
  let antes = null, aberto = !fundo.hidden;
  new MutationObserver(() => {
    // o Esc do NT.modal regrava hidden em todos os modais já usados; só vale a troca de estado
    if (aberto === !fundo.hidden) return;
    aberto = !fundo.hidden;
    if (aberto) { antes = document.activeElement; return; }
    if (fundo.id === 'mConf' && respostaConf) { const r = respostaConf; respostaConf = null; r(valorConf); }
    if (antes && document.contains(antes)) antes.focus();
    antes = null;
  }).observe(fundo, { attributes: true, attributeFilter: ['hidden'] });
  fundo.addEventListener('click', e => { if (e.target.closest('[data-fechar]')) NT.modal(fundo, false); });
});

/* ---------- ligações ---------- */
$('#bVerificar').addEventListener('click', () => verificar());
$('#cAuto').addEventListener('change', e => { ligarAuto(e.target.checked); NT.aviso(e.target.checked ? 'Verificação automática ligada (a cada 60 s).' : 'Verificação automática desligada.'); });
$('#bLimparHist').addEventListener('click', async () => {
  const ok = await confirmar({ titulo: 'Limpar histórico?', html: '<p>Apaga as barrinhas dos últimos 30 testes e o registro das verificações. Os sistemas não são afetados.</p>', sim: 'Limpar', perigo: true });
  if (!ok) return;
  D.apagar('saude'); D.apagar('registro'); D.apagar('ultimo');
  renderSaude(); renderKpis();
  NT.aviso('Histórico de verificações apagado.');
});

$('#dProjeto').innerHTML = PROJETOS.map(p => `<option value="${p.id}">${esc(p.nome)}</option>`).join('');
$('#hFiltro').insertAdjacentHTML('beforeend', PROJETOS.map(p => `<option value="${p.id}">${esc(p.nome)}</option>`).join(''));
const sel = D.ler('pipeSel', { projeto: PROJETOS[0].id, amb: 'homolog' });
$('#dProjeto').value = projeto(sel.projeto).id;
$(`input[name=amb][value=${sel.amb === 'prod' ? 'prod' : 'homolog'}]`).checked = true;
$('#dMsg').value = sugerirMsg(projeto(sel.projeto));
$('#hFiltro').value = D.ler('hFiltro', '');
const guardarSel = () => D.gravar('pipeSel', { projeto: $('#dProjeto').value, amb: $('input[name=amb]:checked').value });
$('#dProjeto').addEventListener('change', () => { $('#dMsg').value = sugerirMsg(projeto($('#dProjeto').value)); guardarSel(); renderNoAr(); });
$$('input[name=amb]').forEach(r => r.addEventListener('change', () => { guardarSel(); renderNoAr(); }));
$('#fDeploy').addEventListener('submit', pedirDeploy);
$('#bCancelar').addEventListener('click', () => { if (rodando) { rodando.cancelar = true; $('#bCancelar').disabled = true; } });
$('#bMais').addEventListener('click', () => { mostrar += 10; renderHist(); });
$('#hFiltro').addEventListener('change', () => { mostrar = 10; D.gravar('hFiltro', $('#hFiltro').value); renderHist(); });
$('#tHist').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.log) verLog(b.dataset.log);
  if (b.dataset.rollback) pedirRollback(b.dataset.rollback);
});
$('#mLogCopiar').addEventListener('click', () => NT.copiar($('#mLogTxt').dataset.texto || ''));

$('#bNovoDom').addEventListener('click', () => abrirDom(null));
$('#fDom').addEventListener('submit', salvarDom);
$('#domBusca').addEventListener('input', renderDom);
$('#domFiltro').addEventListener('change', renderDom);
$('#tDom').addEventListener('click', e => { const b = e.target.closest('button'); if (b) acaoDom(b); });

$('#bRestaurar').addEventListener('click', async () => {
  if (rodando) { NT.aviso('Espere o pipeline terminar.'); return; }
  const ok = await confirmar({ titulo: 'Restaurar exemplo?', html: '<p>O histórico de deploys e a lista de domínios voltam aos dados de exemplo. O que você cadastrou ou publicou aqui será perdido.</p><p class="dim">O histórico das verificações de saúde é real e continua.</p>', sim: 'Restaurar', perigo: true });
  if (!ok) return;
  semear();
  renderHist(); renderNoAr(); renderDom(); renderKpis();
  NT.aviso('Dados de exemplo restaurados.');
});

// a aba aberta volta como estava
NT.abas(document, aba => D.gravar('aba', aba));
const abaSalva = D.ler('aba', 'saude');
if (abaSalva !== 'saude') { const b = $(`.aba[data-aba="${abaSalva}"]`); if (b) b.click(); }

/* ---------- partida ---------- */
renderEtapas(null);
renderHist(); renderNoAr(); renderDom(); renderKpis();
$('#cAuto').checked = D.ler('auto', false);
if ($('#cAuto').checked) proxima = Date.now() + INTERVALO * 1000;
NT.sistemas().then(c => {
  catalogo = c;
  renderSaude(); renderKpis();
  verificar();              // abre já com o retrato de agora
});
})();
