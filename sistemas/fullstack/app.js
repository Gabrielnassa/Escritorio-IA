/* ===========================================================
   sistemas/fullstack/app.js — Gestor de Projetos (Rafa · Full-stack)

   Kanban dos projetos dos clientes, do backlog à entrega. Tudo fica em
   NT.dados('fullstack'): a lista de projetos, os filtros e a aba aberta.
   Projeto que já está no quadro salva a cada alteração (como um Trello,
   para ninguém perder um check fechando a janela); projeto novo só entra
   no quadro quando clica em Criar.
   =========================================================== */
(() => {
'use strict';

const D = NT.dados('fullstack');
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = NT.esc;

const COLUNAS = [
  { id: 'backlog', nome: 'Backlog' },
  { id: 'dev', nome: 'Em desenvolvimento' },
  { id: 'revisao', nome: 'Revisão' },
  { id: 'entregue', nome: 'Entregue' }
];
const TIPOS = { site: 'Site', sistema: 'Sistema', app: 'App', automacao: 'Automação', agente: 'Agente de IA' };
const PRIOS = { urgente: 'Urgente', alta: 'Alta', media: 'Média', baixa: 'Baixa' };
const PESO_PRIO = { urgente: 0, alta: 1, media: 2, baixa: 3 };
const BADGE_PRIO = { urgente: 'err', alta: 'warn', media: 'acc', baixa: '' };
// o time da Nassa Tech; a cor é a da camisa de cada um no escritório
const EQUIPE = [
  { nome: 'Gabriel', cargo: 'CEO', cor: '#ffd166' },
  { nome: 'Lucas', cargo: 'Front-end', cor: '#5b95ff' },
  { nome: 'Marina', cargo: 'Back-end', cor: '#2dd4bf' },
  { nome: 'Rafa', cargo: 'Full-stack', cor: '#94a3c8' },
  { nome: 'Bia', cargo: 'Mobile', cor: '#f472b6' },
  { nome: 'Dani', cargo: 'DevOps', cor: '#38bdf8' },
  { nome: 'Theo', cargo: 'QA', cor: '#4ade80' },
  { nome: 'Lia', cargo: 'UI/UX', cor: '#c084fc' },
  { nome: 'Nico', cargo: 'IA & automação', cor: '#ff8a65' },
  { nome: 'Duda', cargo: 'Comercial', cor: '#fbbf24' }
];
const JANELA_ANTES = 7, JANELA_DEPOIS = 60;   // linha do tempo: uma semana para trás dá contexto aos atrasados

/* ---------- datas: tudo em dias inteiros (UTC), sem susto com horário de verão ---------- */
const dia = iso => { const [a, m, d] = String(iso).split('-').map(Number); return Math.round(Date.UTC(a, m - 1, d) / 864e5); };
const isoDe = n => new Date(n * 864e5).toISOString().slice(0, 10);
const hoje = () => dia(NT.hojeISO());
const dm = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '—';
const ehData = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);

const fmt0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtCurto = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
const brl0 = n => fmt0.format(Number(n) || 0);
const brlCurto = n => (Number(n) || 0) < 10000 ? brl0(n) : fmtCurto.format(n);
const soma = lista => lista.reduce((s, p) => s + (Number(p.valor) || 0), 0);
const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const pessoa = nome => EQUIPE.find(e => e.nome === nome) || { nome: nome || '—', cargo: '', cor: '#8a95ad' };
const nomeCol = id => (COLUNAS.find(c => c.id === id) || COLUNAS[0]).nome;
const iniciais = nome => String(nome || '?').slice(0, 2).toUpperCase();
const avatar = (nome, cls = '') => `<span class="avatar ${cls}" style="--cor:${pessoa(nome).cor}" aria-hidden="true">${esc(iniciais(nome))}</span>`;

/* ===========================================================
   DADOS
   =========================================================== */
function novoProjeto(o) {
  return Object.assign({
    id: NT.id(), nome: '', cliente: '', tipo: 'site', resp: 'Rafa', valor: 0,
    inicio: NT.hojeISO(), prazo: NT.hojeISO(30), prio: 'media', coluna: 'backlog', ordem: 0,
    tarefas: [], tags: [], comentarios: [], desc: '', entregueEm: null, criadoEm: new Date().toISOString()
  }, o);
}

// exemplo com datas relativas a hoje, para ter atrasado, entrega na semana e entregue no mês
function exemplo() {
  const H = hoje();
  const d = n => isoDe(H + n);
  const primeiroDoMes = dia(NT.hojeISO().slice(0, 8) + '01');
  const noMes = n => isoDe(Math.max(H - n, primeiroDoMes));      // nunca escapa para o mês passado
  const mesPassado = isoDe(primeiroDoMes - 9);
  const tarefas = l => l.map(t => ({ id: NT.id(), txt: t.replace(/^x /, ''), feito: t.startsWith('x ') }));
  const coments = l => l.map(([autor, txt, h]) => ({ id: NT.id(), autor, txt, em: new Date(Date.now() - h * 36e5).toISOString() }));
  const L = [
    { nome: 'Agendamento online de consultas', cliente: 'Clínica Sorriso', tipo: 'sistema', resp: 'Marina', valor: 24500,
      inicio: d(-38), prazo: d(-3), prio: 'alta', coluna: 'dev', tags: ['agenda', 'whatsapp', 'lgpd'],
      desc: 'Paciente escolhe dentista, dia e horário pelo site; a recepção confirma num painel e o lembrete sai pelo WhatsApp 24 h antes.',
      tarefas: tarefas(['x Levantamento com a recepção', 'x Banco de pacientes, dentistas e horários', 'x API de horários livres', 'Lembrete automático no WhatsApp', 'Tela de remarcação pelo paciente', 'Termo de consentimento (LGPD)']),
      comentarios: coments([['Marina', 'A Dra. Paula pediu bloqueio de horário de almoço por dentista. Ajustei a regra da agenda.', 52], ['Gabriel', 'A clínica perguntou do prazo. Combinei que o lembrete no WhatsApp entra até sexta.', 20]]) },
    { nome: 'Portal de imóveis com busca no mapa', cliente: 'Imobiliária Horizonte', tipo: 'sistema', resp: 'Rafa', valor: 42000,
      inicio: d(-30), prazo: d(21), prio: 'alta', coluna: 'dev', tags: ['mapa', 'seo', 'painel'],
      desc: 'Site novo da imobiliária com busca por bairro, preço e quartos, mapa, página de cada imóvel e painel para os corretores.',
      tarefas: tarefas(['x Importar imóveis do CRM antigo', 'x Busca por bairro, preço e quartos', 'Mapa com os imóveis', 'Página do imóvel com galeria', 'Painel do corretor', 'Integração com o portal ZAP']),
      comentarios: coments([['Rafa', 'Importação concluída: 1.284 imóveis, 37 sem foto. Mandei a lista para a Carla revisar.', 70]]) },
    { nome: 'Cardápio digital com pedido no WhatsApp', cliente: 'Padaria Pão de Mel', tipo: 'site', resp: 'Lucas', valor: 6800,
      inicio: d(-12), prazo: d(6), prio: 'media', coluna: 'dev', tags: ['cardápio', 'whatsapp'],
      desc: 'Cardápio por categoria com fotos e um carrinho que monta a mensagem do pedido no WhatsApp da padaria.',
      tarefas: tarefas(['x Fotos dos produtos', 'x Cardápio por categoria', 'Carrinho que monta a mensagem do pedido', 'Horário de funcionamento e área de entrega']),
      comentarios: coments([['Lucas', 'Seu Joaquim mandou as fotos novas dos pães de fermentação natural. Já estão na prévia.', 5]]) },
    { nome: 'Migração dos servidores para a nuvem', cliente: 'Contabilidade Exata', tipo: 'sistema', resp: 'Dani', valor: 11000,
      inicio: d(-10), prazo: d(12), prio: 'alta', coluna: 'dev', tags: ['nuvem', 'backup'],
      desc: 'Sair do servidor físico do escritório: backup, ambiente na nuvem, virada num fim de semana e alertas.',
      tarefas: tarefas(['x Inventário dos servidores', 'x Backup completo dos clientes', 'Subir o ambiente na nuvem', 'Virada no fim de semana', 'Monitoramento e alertas']),
      comentarios: coments([['Dani', 'Backup de 640 GB conferido. Virada marcada para o sábado depois do fechamento do mês.', 26]]) },
    { nome: 'App do aluno (treinos e check-in)', cliente: 'Academia Força Total', tipo: 'app', resp: 'Bia', valor: 38000,
      inicio: d(-20), prazo: d(34), prio: 'alta', coluna: 'dev', tags: ['react native', 'push', 'pix'],
      desc: 'App Android e iOS com ficha de treino, check-in por QR code na catraca e mensalidade no Pix.',
      tarefas: tarefas(['x Protótipo aprovado', 'x Login e cadastro do aluno', 'Ficha de treino com vídeos', 'Check-in por QR code na catraca', 'Mensalidade no Pix', 'Publicar na Play Store e na App Store']),
      comentarios: coments([['Bia', 'A catraca é da Henry. Pedi a documentação da integração ao fornecedor.', 28]]) },
    { nome: 'Lembretes de banho e vacina', cliente: 'Pet Shop Amigo Fiel', tipo: 'automacao', resp: 'Nico', valor: 4500,
      inicio: d(-14), prazo: d(-1), prio: 'urgente', coluna: 'revisao', tags: ['whatsapp', 'n8n'],
      desc: 'Robô que lê a agenda do pet shop e avisa o tutor no WhatsApp do banho marcado e da vacina vencendo.',
      tarefas: tarefas(['x Ler a agenda do sistema do pet shop', 'x Lembrete 2 dias antes do banho', 'x Aviso de vacina vencendo', 'Teste com 20 clientes reais']),
      comentarios: coments([['Nico', 'Fluxo pronto. Falta a dona liberar o número oficial do WhatsApp para o teste.', 30], ['Duda', 'Ela liberou hoje cedo, pode seguir com o teste.', 3]]) },
    { nome: 'Loja virtual com provador de armações', cliente: 'Ótica Visão Clara', tipo: 'sistema', resp: 'Rafa', valor: 19500,
      inicio: d(-40), prazo: d(9), prio: 'alta', coluna: 'revisao', tags: ['e-commerce', 'pix'],
      desc: 'Loja com catálogo de armações, frete, Pix e cartão, e um provador que usa a câmera do celular.',
      tarefas: tarefas(['x Catálogo de armações', 'x Carrinho e cálculo de frete', 'x Pagamento no Pix e no cartão', 'Provador pela câmera', 'Compra de teste real']),
      comentarios: coments([['Theo', 'Achei 2 bugs no frete para CEP de Santa Catarina. Registrei na Central de Qualidade.', 6]]) },
    { nome: 'Site institucional com blog', cliente: 'Advocacia Duarte', tipo: 'site', resp: 'Lucas', valor: 9200,
      inicio: d(-25), prazo: d(2), prio: 'media', coluna: 'revisao', tags: ['seo', 'blog'],
      desc: 'Site com as áreas de atuação, equipe, blog de artigos e formulário de contato, dentro das regras da OAB.',
      tarefas: tarefas(['x Textos das áreas de atuação', 'x Blog com categorias', 'x Formulário de contato', 'Conferir regras de publicidade da OAB', 'Publicar no domínio']),
      comentarios: coments([['Theo', 'Testei no celular e no Safari: formulário ok. Falta o aviso de cookies.', 8]]) },
    { nome: 'Protótipo do app de fidelidade', cliente: 'Farmácia Bem Estar', tipo: 'app', resp: 'Lia', valor: 8500,
      inicio: d(2), prazo: d(18), prio: 'media', coluna: 'backlog', tags: ['figma', 'protótipo'],
      desc: 'Protótipo navegável das telas de pontos, cupons e lembrete de remédio, para validar antes do desenvolvimento.',
      tarefas: tarefas(['x Briefing com o dono', 'Paleta e tipografia', 'Protótipo das 8 telas principais', 'Teste com 5 clientes da farmácia']),
      comentarios: [] },
    { nome: 'Agente de IA para atender leads', cliente: 'Imobiliária Horizonte', tipo: 'agente', resp: 'Nico', valor: 15000,
      inicio: d(5), prazo: d(45), prio: 'media', coluna: 'backlog', tags: ['claude', 'whatsapp'],
      desc: 'Atendente no WhatsApp que responde dúvidas, sugere imóveis do estoque e passa o lead quente para o corretor.',
      tarefas: tarefas(['Base de perguntas frequentes dos corretores', 'Ligar o agente ao estoque de imóveis', 'Passar o lead quente para o corretor']),
      comentarios: coments([['Duda', 'Proposta aprovada junto com o portal. Começa quando o mapa estiver no ar.', 96]]) },
    { nome: 'Cardápio QR e painel da cozinha', cliente: 'Restaurante Sabor Mineiro', tipo: 'sistema', resp: 'Rafa', valor: 12800,
      inicio: d(10), prazo: d(52), prio: 'baixa', coluna: 'backlog', tags: ['qr code', 'painel'],
      desc: 'Cliente pede pelo QR code da mesa, o pedido cai no painel da cozinha e o garçom fecha a conta por mesa.',
      tarefas: tarefas(['Cardápio por QR code na mesa', 'Pedido no painel da cozinha', 'Fechamento da conta por mesa']),
      comentarios: [] },
    { nome: 'Portal dos pais e boletim online', cliente: 'Escola Pequenos Gênios', tipo: 'sistema', resp: 'Marina', valor: 28000,
      inicio: d(14), prazo: d(75), prio: 'media', coluna: 'backlog', tags: ['portal', 'notas'],
      desc: 'Área dos pais com boletim, frequência e recados da coordenação.',
      tarefas: tarefas(['Reunião com a coordenação', 'Importar alunos e turmas', 'Boletim e frequência', 'Recados para os pais']),
      comentarios: [] },
    { nome: 'Landing page do Residencial Ipê', cliente: 'Construtora Alicerce', tipo: 'site', resp: 'Lucas', valor: 5400,
      inicio: d(-24), prazo: d(1), prio: 'alta', coluna: 'entregue', entregueEm: noMes(3), tags: ['lançamento', 'google ads'],
      desc: 'Página do lançamento com plantas, tour virtual e formulário ligado ao CRM da construtora.',
      tarefas: tarefas(['x Plantas e tour virtual', 'x Formulário ligado ao CRM', 'x Pixel e Google Ads', 'x Publicação']),
      comentarios: coments([['Gabriel', 'Cliente adorou: 112 leads na primeira semana de campanha.', 40]]) },
    { nome: 'Robô de conciliação bancária', cliente: 'Contabilidade Exata', tipo: 'automacao', resp: 'Nico', valor: 7900,
      inicio: d(-35), prazo: d(-6), prio: 'media', coluna: 'entregue', entregueEm: noMes(8), tags: ['ofx', 'planilhas'],
      desc: 'Lê os extratos OFX dos clientes e concilia com os lançamentos, marcando só o que precisa de olho humano.',
      tarefas: tarefas(['x Leitura dos extratos OFX', 'x Regras de conciliação', 'x Relatório das pendências']),
      comentarios: [] },
    { nome: 'Landing page de clareamento', cliente: 'Clínica Sorriso', tipo: 'site', resp: 'Lucas', valor: 3800,
      inicio: isoDe(dia(mesPassado) - 15), prazo: mesPassado, prio: 'media', coluna: 'entregue', entregueEm: mesPassado, tags: ['campanha'],
      desc: 'Página da campanha de clareamento com agendamento pelo WhatsApp.',
      tarefas: tarefas(['x Textos e fotos', 'x Botão de agendamento', 'x Publicação']),
      comentarios: [] }
  ];
  const ordem = {};
  return L.map(o => novoProjeto(Object.assign(o, { ordem: (ordem[o.coluna] = (ordem[o.coluna] ?? -1) + 1) })));
}

// conserta o que vier estragado do armazenamento em vez de quebrar o quadro
function normalizar(p) {
  const r = Object.assign(novoProjeto(), p && typeof p === 'object' ? p : {});
  if (!TIPOS[r.tipo]) r.tipo = 'site';
  if (!PRIOS[r.prio]) r.prio = 'media';
  if (!COLUNAS.some(c => c.id === r.coluna)) r.coluna = 'backlog';
  if (!ehData(r.prazo)) r.prazo = NT.hojeISO(30);
  if (!ehData(r.inicio)) r.inicio = NT.hojeISO();
  r.valor = Math.max(0, Number(r.valor) || 0);
  r.ordem = Number(r.ordem) || 0;
  r.nome = String(r.nome || 'Projeto sem nome');
  r.cliente = String(r.cliente || 'Cliente');
  r.tags = Array.isArray(r.tags) ? r.tags.map(String).filter(Boolean) : [];
  r.tarefas = Array.isArray(r.tarefas) ? r.tarefas.filter(t => t && t.txt).map(t => ({ id: t.id || NT.id(), txt: String(t.txt), feito: !!t.feito })) : [];
  r.comentarios = Array.isArray(r.comentarios) ? r.comentarios.filter(c => c && c.txt) : [];
  return r;
}

let projetos = D.ler('projetos', null);
if (!Array.isArray(projetos)) { projetos = exemplo(); D.gravar('projetos', projetos); }
else projetos = projetos.map(normalizar);

const FILTRO_VAZIO = { busca: '', resp: '', tipo: '', atrasados: false };
let filtros = Object.assign({}, FILTRO_VAZIO, D.ler('filtros', {}));

const salvar = () => D.gravar('projetos', projetos);
const salvarFiltros = () => D.gravar('filtros', filtros);
const achar = id => projetos.find(p => p.id === id);
const daColuna = col => projetos.filter(p => p.coluna === col).sort((a, b) => a.ordem - b.ordem);
const atrasado = p => p.coluna !== 'entregue' && dia(p.prazo) < hoje();
const progresso = p => {
  const n = p.tarefas.length, f = p.tarefas.filter(t => t.feito).length;
  return { n, f, pct: n ? Math.round(f / n * 100) : 0 };
};

function passa(p) {
  if (filtros.resp && p.resp !== filtros.resp) return false;
  if (filtros.tipo && p.tipo !== filtros.tipo) return false;
  if (filtros.atrasados && !atrasado(p)) return false;
  if (filtros.busca.trim()) {
    const alvo = norm([p.nome, p.cliente, p.resp, TIPOS[p.tipo], p.tags.join(' '), p.tarefas.map(t => t.txt).join(' '), p.desc].join(' '));
    return norm(filtros.busca).split(/\s+/).filter(Boolean).every(w => alvo.includes(w));
  }
  return true;
}
const temFiltro = () => !!(filtros.busca.trim() || filtros.resp || filtros.tipo || filtros.atrasados);

/* ---------- mover: muda de coluna e/ou de posição ---------- */
function registrar(p, txt) {
  p.comentarios.push({ id: NT.id(), autor: '', txt, em: new Date().toISOString(), sis: true });
}
function mudarColuna(p, col) {
  const de = p.coluna;
  if (de === col) return;
  p.coluna = col;
  p.entregueEm = col === 'entregue' ? NT.hojeISO() : null;
  registrar(p, `Movido de ${nomeCol(de)} para ${nomeCol(col)}`);
}
// antesId: o cartão que fica logo depois; null = fim da coluna
function mover(id, col, antesId) {
  const p = achar(id);
  if (!p) return;
  const de = p.coluna;
  const lista = daColuna(col).filter(x => x !== p);
  let i = antesId ? lista.findIndex(x => x.id === antesId) : -1;
  if (i < 0) i = lista.length;
  lista.splice(i, 0, p);
  lista.forEach((x, k) => { x.ordem = k; });
  mudarColuna(p, col);
  salvar();
  render();
  if (de !== col) {
    const { n, f } = progresso(p);
    const falta = col === 'entregue' && f < n ? ` Ainda ${n - f === 1 ? 'falta 1 tarefa' : `faltam ${n - f} tarefas`} do checklist.` : '';
    NT.aviso(`“${p.nome}” foi para ${nomeCol(col)}.${falta}`);
  }
}
// sobe ou desce em relação ao vizinho visível (com filtro ligado, o vizinho escondido não conta)
function reordenar(id, passo) {
  const p = achar(id);
  const vis = daColuna(p.coluna).filter(passa);
  const i = vis.indexOf(p), alvo = vis[i + passo];
  if (!alvo) return false;
  if (passo < 0) mover(id, p.coluna, alvo.id);
  else {
    const todos = daColuna(p.coluna).filter(x => x !== p);
    const depois = todos[todos.indexOf(alvo) + 1];
    mover(id, p.coluna, depois ? depois.id : null);
  }
  return true;
}
function colunaVizinha(id, passo) {
  const p = achar(id);
  const i = COLUNAS.findIndex(c => c.id === p.coluna) + passo;
  if (i < 0 || i >= COLUNAS.length) return false;
  mover(id, COLUNAS[i].id, null);
  return true;
}

/* ===========================================================
   TELA PRINCIPAL
   =========================================================== */
const el = {
  kpis: $('#kpis'), quadro: $('#quadro'), atalhos: $('#atalhos'), tempo: $('#tempo'), tempoResumo: $('#tempoResumo'),
  busca: $('#fBusca'), resp: $('#fResp'), tipo: $('#fTipo'), atrasados: $('#fAtrasados'), conta: $('#fConta'), limpar: $('#fLimpar'),
  menu: $('#menuMover'), mProj: $('#mProj'), mConf: $('#mConf')
};
const opcoes = (obj, primeiro) => (primeiro ? `<option value="">${primeiro}</option>` : '') +
  Object.entries(obj).map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('');
const opEquipe = primeiro => opcoes(Object.fromEntries(EQUIPE.map(e => [e.nome, `${e.nome} · ${e.cargo}`])), primeiro);

function render() {
  renderKpis();
  renderQuadro();
  renderTempo();
  renderFiltros();
}

function renderKpis() {
  const ativos = projetos.filter(p => p.coluna !== 'entregue');
  const atrasados = projetos.filter(atrasado);
  const mes = NT.hojeISO().slice(0, 7);
  const entregues = projetos.filter(p => p.coluna === 'entregue' && String(p.entregueEm || '').startsWith(mes));
  const nomeMes = new Date().toLocaleDateString('pt-BR', { month: 'long' });
  const n = col => projetos.filter(p => p.coluna === col).length;
  const dicaAtraso = !atrasados.length ? 'Nenhum prazo estourado'
    : filtros.atrasados ? 'Filtrando · clique para ver todos' : 'Clique para ver só eles';
  el.kpis.innerHTML = `
    <div class="kpi acc"><span>Projetos ativos</span><b>${ativos.length}</b><small>${n('backlog')} no backlog · ${n('dev')} em dev · ${n('revisao')} em revisão</small></div>
    <div class="kpi"><span>Valor em andamento</span><b>${brl0(soma(ativos))}</b><small>contratado e ainda não entregue</small></div>
    <button type="button" class="kpi kpi-botao ${atrasados.length ? 'err' : 'ok'}" id="kAtrasados" aria-pressed="${filtros.atrasados}">
      <span>Atrasados</span><b>${atrasados.length}</b><small>${dicaAtraso}</small></button>
    <div class="kpi ok"><span>Entregues no mês</span><b>${entregues.length}</b><small>${brl0(soma(entregues))} em ${nomeMes}</small></div>`;
}

function textoPrazo(p) {
  if (p.coluna === 'entregue') return { txt: `Entregue em ${dm(p.entregueEm)}`, cls: 'ok' };
  const r = dia(p.prazo) - hoje();
  if (r < 0) return { txt: `Prazo ${dm(p.prazo)} · ${plural(-r, 'dia', 'dias')} de atraso`, cls: 'err' };
  if (r === 0) return { txt: 'Vence hoje', cls: 'warn' };
  if (r === 1) return { txt: `Vence amanhã · ${dm(p.prazo)}`, cls: 'warn' };
  return { txt: `${dm(p.prazo)} · faltam ${r} dias`, cls: r <= 7 ? 'warn' : '' };
}

function cartao(p) {
  const pr = progresso(p), pz = textoPrazo(p), atr = atrasado(p);
  return `<article class="cartao${atr ? ' atrasado' : ''}" draggable="true" data-id="${p.id}">
    <div class="c-topo">
      <div class="c-etiquetas">
        <span class="tipo t-${p.tipo}">${TIPOS[p.tipo]}</span>
        <span class="badge ${BADGE_PRIO[p.prio]}">${PRIOS[p.prio]}</span>
        ${atr ? '<span class="badge err">Atrasado</span>' : ''}
      </div>
      <button type="button" class="c-mover" aria-haspopup="menu" aria-expanded="false" aria-label="Mover “${esc(p.nome)}”" title="Mover">⇄</button>
    </div>
    <h3 class="c-titulo"><button type="button" class="c-abrir" aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown">${esc(p.nome)}</button></h3>
    <div class="c-cliente">${esc(p.cliente)}</div>
    ${p.tags.length ? `<div class="c-tags">${p.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
    ${pr.n ? `<div class="c-prog" title="${pr.f} de ${pr.n} tarefas feitas"><div class="barra${pr.pct === 100 ? ' cheia' : ''}"><i style="width:${pr.pct}%"></i></div><span>${pr.f}/${pr.n}</span></div>` : ''}
    <div class="c-prazo ${pz.cls}">${esc(pz.txt)}</div>
    <div class="c-pe">${avatar(p.resp)}<span class="c-resp">${esc(p.resp)}</span><b class="c-valor">${brl0(p.valor)}</b></div>
  </article>`;
}

function renderQuadro() {
  el.quadro.innerHTML = COLUNAS.map(c => {
    const todos = daColuna(c.id), vis = todos.filter(passa);
    const vazio = todos.length ? 'Nenhum projeto com esses filtros' : c.id === 'entregue' ? 'Solte aqui o que foi entregue' : 'Solte um projeto aqui';
    return `<section class="coluna col-${c.id}" data-col="${c.id}" aria-labelledby="h-${c.id}">
      <header class="col-topo">
        <span class="col-ponto" aria-hidden="true"></span>
        <h2 id="h-${c.id}">${c.nome}</h2>
        <span class="col-conta" title="${vis.length} de ${todos.length}">${vis.length}${vis.length !== todos.length ? `<small>/${todos.length}</small>` : ''}</span>
        <span class="col-soma">${vis.length ? `${brlCurto(soma(vis))} em ${plural(vis.length, 'projeto', 'projetos')}` : 'nenhum projeto'}</span>
      </header>
      <div class="col-lista" data-col="${c.id}">${vis.map(cartao).join('') || `<div class="col-vazia">${vazio}</div>`}</div>
      ${c.id !== 'entregue' ? `<button type="button" class="col-add" data-add="${c.id}">+ Adicionar em ${c.nome}</button>` : ''}
    </section>`;
  }).join('');
  el.atalhos.innerHTML = COLUNAS.map(c =>
    `<button type="button" class="atalho col-${c.id}" data-ir="${c.id}"><span class="col-ponto" aria-hidden="true"></span>${c.nome} <b>${daColuna(c.id).filter(passa).length}</b></button>`).join('');
  marcarAtalho();
}

function renderFiltros() {
  const vis = projetos.filter(passa).length;
  el.conta.textContent = temFiltro() ? `Mostrando ${vis} de ${plural(projetos.length, 'projeto', 'projetos')}` : plural(projetos.length, 'projeto', 'projetos');
  el.limpar.disabled = !temFiltro();
  el.atrasados.setAttribute('aria-pressed', filtros.atrasados);
  if (el.busca.value !== filtros.busca) el.busca.value = filtros.busca;
  el.resp.value = filtros.resp;
  el.tipo.value = filtros.tipo;
}

/* ---------- linha do tempo (gantt simples) ---------- */
function renderTempo() {
  const H = hoje(), ini = H - JANELA_ANTES, fim = H + JANELA_DEPOIS, total = fim - ini + 1;
  const pos = n => ((n - ini) / total * 100).toFixed(3) + '%';
  const lista = projetos.filter(p => p.coluna !== 'entregue' && passa(p))
    .sort((a, b) => a.prazo.localeCompare(b.prazo) || PESO_PRIO[a.prio] - PESO_PRIO[b.prio]);
  const semana = lista.filter(p => { const r = dia(p.prazo) - H; return r >= 0 && r <= 7; }).length;
  const atr = lista.filter(atrasado).length;
  const depois = lista.filter(p => dia(p.prazo) > fim).length;
  el.tempoResumo.textContent = lista.length
    ? [plural(lista.length, 'projeto ativo', 'projetos ativos'), `${semana} com entrega nos próximos 7 dias`,
       atr ? plural(atr, 'atrasado', 'atrasados') : 'nenhum atrasado', depois ? `${depois} com prazo depois de ${JANELA_DEPOIS} dias` : ''].filter(Boolean).join(' · ')
    : '';
  if (!lista.length) {
    el.tempo.innerHTML = `<div class="vazio">${temFiltro() ? 'Nenhum projeto ativo com esses filtros.' : 'Nenhum projeto ativo. Crie um em “+ Novo projeto”.'}</div>`;
    return;
  }

  // fundo: fins de semana, semanas e a linha de hoje, desenhados uma vez para todas as linhas
  let fundo = '', escala = '';
  for (let n = ini; n <= fim; n++) {
    const sem = new Date(n * 864e5).getUTCDay();
    if (sem === 0 && n === ini) fundo += `<i class="tl-fds" style="left:0;width:${pos(ini + 1)}"></i>`;
    if (sem === 6) fundo += `<i class="tl-fds" style="left:${pos(n)};width:${pos(ini + Math.min(2, fim - n + 1))}"></i>`;
    const iso = isoDe(n);
    if (iso.endsWith('-01') && n > ini) {
      const mes = new Date(n * 864e5).toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '');
      escala += `<span class="tl-mes" style="left:${pos(n)}">${esc(mes)}</span>`;
      fundo += `<i class="tl-virada" style="left:${pos(n)}"></i>`;
    }
  }
  // no celular só cabe uma data a cada duas semanas: as de semana ímpar ganham .alt e somem lá
  for (let n = H + 7, k = 0; n <= fim; n += 7, k++) {
    escala += `<span class="tl-marco${k % 2 ? '' : ' alt'}" style="left:${pos(n)}">${dm(isoDe(n))}</span>`;
    fundo += `<i class="tl-semana" style="left:${pos(n)}"></i>`;
  }
  escala += `<span class="tl-marco tl-marco-hoje" style="left:${pos(H)}">Hoje</span>`;
  fundo += `<i class="tl-hoje" style="left:${pos(H)};width:${pos(ini + 1)}"></i>`;

  const linhas = lista.map(p => {
    const a = dia(p.inicio), b = dia(p.prazo), pr = progresso(p), atr = atrasado(p);
    const de = Math.max(Math.min(a, b), ini), ate = Math.min(Math.max(a, b), fim);
    let barra = '';
    if (ate >= de) {
      const esq = (de - ini) / total * 100, larg = (ate - de + 1) / total * 100;
      // rótulo do lado de fora, onde houver espaço; só entra na barra se ela ocupar quase tudo
      const lado = esq + larg <= 84 ? 'depois' : esq >= 18 ? 'antes' : 'dentro';
      const txt = `${pr.n ? pr.pct + '% · ' : ''}${b > fim ? 'prazo ' : ''}${dm(p.prazo)}`;
      barra = `<div class="tl-barra b-${p.coluna}${atr ? ' b-atrasada' : ''}${b > fim ? ' segue' : ''}${a < ini ? ' vem' : ''}" style="left:${esq.toFixed(3)}%;width:${larg.toFixed(3)}%">
        <i class="tl-feito" style="width:${pr.pct}%"></i>${atr ? '' : `<span class="tl-txt ${lado}">${txt}</span>`}</div>`;
    } else if (Math.min(a, b) > fim) {
      barra = `<span class="tl-fora direita">começa em ${dm(p.inicio)} ▶</span>`;
    }
    // atraso: tracejado do prazo até hoje, com o rótulo logo depois de hoje
    const desde = Math.max(b + 1, ini);
    const quando = atr ? `${dm(p.prazo)} · ${plural(H - b, 'dia', 'dias')} de atraso` : `${dm(p.prazo)}${pr.n ? ` · ${pr.pct}%` : ''}`;
    const atraso = atr ? `<div class="tl-atraso" style="left:${pos(desde)};width:${((H - desde + 1) / total * 100).toFixed(3)}%"></div>
      <span class="tl-txt atraso" style="left:calc(${pos(H + 1)} + 8px)">prazo ${dm(p.prazo)} · ${plural(H - b, 'dia', 'dias')} de atraso${pr.n ? ` · ${pr.pct}%` : ''}</span>` : '';
    return `<div class="tl-linha${atr ? ' atrasada' : ''}" data-id="${p.id}">
      <button type="button" class="tl-rot" data-abrir="${p.id}" title="${esc(p.nome)} — ${esc(p.cliente)}">
        <span class="tl-nome">${esc(p.nome)}</span>
        <span class="tl-sub">${avatar(p.resp, 'mini')}${esc(p.cliente)}</span>
        <span class="tl-quando${atr ? ' err' : ''}">${quando}</span>
      </button>
      <div class="tl-trilho" data-abrir="${p.id}" title="${esc(p.nome)} · ${NT.data(p.inicio)} a ${NT.data(p.prazo)}">${atraso}${barra}</div>
    </div>`;
  }).join('');

  el.tempo.innerHTML = `<div class="tl">
    <div class="tl-fundo" aria-hidden="true">${fundo}</div>
    <div class="tl-cab"><div class="tl-rot-cab">Projeto · prazo</div><div class="tl-escala" aria-hidden="true">${escala}</div></div>
    ${linhas}
  </div>`;
}

/* ---------- atalhos de coluna no celular ---------- */
function marcarAtalho() {
  const q = el.quadro, cols = $$('.coluna', q);
  if (!cols.length) return;
  const meio = q.scrollLeft + q.clientWidth / 3;
  let atual = cols[0];
  cols.forEach(c => { if (c.offsetLeft - q.offsetLeft <= meio) atual = c; });
  $$('.atalho', el.atalhos).forEach(b => {
    const sim = b.dataset.ir === atual.dataset.col;
    b.setAttribute('aria-current', sim);
    // mantém o atalho da coluna atual à vista (sem scrollIntoView, que puxaria a página)
    const a = el.atalhos;
    if (sim && (b.offsetLeft < a.scrollLeft || b.offsetLeft + b.offsetWidth > a.scrollLeft + a.clientWidth)) a.scrollLeft = b.offsetLeft - a.offsetLeft - 4;
  });
}
el.quadro.addEventListener('scroll', () => requestAnimationFrame(marcarAtalho), { passive: true });
el.atalhos.addEventListener('click', e => {
  const b = e.target.closest('[data-ir]');
  if (!b) return;
  const col = $(`.coluna[data-col="${b.dataset.ir}"]`, el.quadro);
  el.quadro.scrollTo({ left: col.offsetLeft - el.quadro.offsetLeft, behavior: 'smooth' });
});

/* ---------- filtros ---------- */
el.resp.innerHTML = opEquipe('Todos');
el.tipo.innerHTML = opcoes(TIPOS, 'Todos');
let tBusca = 0;
el.busca.addEventListener('input', () => {
  clearTimeout(tBusca);
  tBusca = setTimeout(() => { filtros.busca = el.busca.value; salvarFiltros(); render(); }, 120);
});
el.resp.addEventListener('change', () => { filtros.resp = el.resp.value; salvarFiltros(); render(); });
el.tipo.addEventListener('change', () => { filtros.tipo = el.tipo.value; salvarFiltros(); render(); });
function alternarAtrasados() { filtros.atrasados = !filtros.atrasados; salvarFiltros(); render(); }
el.atrasados.addEventListener('click', alternarAtrasados);
el.kpis.addEventListener('click', e => {
  if (!e.target.closest('#kAtrasados')) return;
  alternarAtrasados();
  $('#kAtrasados').focus();
});
el.limpar.addEventListener('click', () => {
  filtros = Object.assign({}, FILTRO_VAZIO);
  salvarFiltros(); render();
  el.busca.focus();
});

/* ---------- abas ---------- */
NT.abas(document, aba => D.gravar('aba', aba));
if (D.ler('aba', 'quadro') === 'tempo') $('#abaTempo').click();
// setas trocam de aba, como pede o padrão de tablist
$('.abas').addEventListener('keydown', e => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const outra = e.target.id === 'abaQuadro' ? $('#abaTempo') : $('#abaQuadro');
  outra.click(); outra.focus();
});
el.tempo.addEventListener('click', e => {
  const alvo = e.target.closest('[data-abrir]');
  if (alvo) abrirProjeto(alvo.dataset.abrir, alvo.closest('.tl-linha').querySelector('.tl-rot'));
});

/* ===========================================================
   QUADRO: clique, teclado e arrastar
   =========================================================== */
function focarCartao(id) {
  const b = $(`.cartao[data-id="${id}"] .c-abrir`, el.quadro);
  if (!b) return;
  b.focus({ preventScroll: true });
  b.closest('.cartao').scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
}

el.quadro.addEventListener('click', e => {
  const add = e.target.closest('[data-add]');
  if (add) return abrirNovo(add.dataset.add, add);
  const c = e.target.closest('.cartao');
  if (!c) return;
  const mov = e.target.closest('.c-mover');
  if (mov) return el.menu.hidden || menuId !== c.dataset.id ? abrirMenu(mov, c.dataset.id) : fecharMenu(true);
  abrirProjeto(c.dataset.id, $('.c-abrir', c));
});

el.quadro.addEventListener('keydown', e => {
  if (!e.altKey || !e.target.classList.contains('c-abrir')) return;
  const id = e.target.closest('.cartao').dataset.id;
  const acao = { ArrowLeft: () => colunaVizinha(id, -1), ArrowRight: () => colunaVizinha(id, 1),
    ArrowUp: () => reordenar(id, -1), ArrowDown: () => reordenar(id, 1) }[e.key];
  if (!acao) return;
  e.preventDefault();
  if (acao()) focarCartao(id);
});

// arrastar com o mouse (HTML5 drag and drop); a marca mostra onde o cartão vai cair
let arrastado = null;
const marca = document.createElement('div');
marca.className = 'marca-solta';
function limparArrasto() {
  arrastado = null;
  marca.remove();
  $$('.arrastando', el.quadro).forEach(c => c.classList.remove('arrastando'));
  $$('.coluna.alvo', el.quadro).forEach(c => c.classList.remove('alvo'));
  el.quadro.classList.remove('em-arrasto');
}
el.quadro.addEventListener('dragstart', e => {
  const c = e.target.closest && e.target.closest('.cartao');
  if (!c) return;
  fecharMenu();
  arrastado = c.dataset.id;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', arrastado);
  // a classe entra no quadro seguinte, senão a "foto" do arrasto sai apagada
  requestAnimationFrame(() => { c.classList.add('arrastando'); el.quadro.classList.add('em-arrasto'); });
});
el.quadro.addEventListener('dragover', e => {
  if (!arrastado) return;
  const col = e.target.closest('.coluna');
  if (!col) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const lista = $('.col-lista', col);
  const depois = $$('.cartao:not(.arrastando)', lista).find(c => {
    const r = c.getBoundingClientRect();
    return e.clientY < r.top + r.height / 2;
  });
  if (depois) { if (marca.nextElementSibling !== depois) lista.insertBefore(marca, depois); }
  else if (lista.lastElementChild !== marca) lista.appendChild(marca);
  $$('.coluna.alvo', el.quadro).forEach(c => c !== col && c.classList.remove('alvo'));
  col.classList.add('alvo');
});
el.quadro.addEventListener('dragleave', e => {
  const col = e.target.closest && e.target.closest('.coluna');
  if (col && !col.contains(e.relatedTarget)) { col.classList.remove('alvo'); if (col.contains(marca)) marca.remove(); }
});
el.quadro.addEventListener('drop', e => {
  if (!arrastado) return;
  const col = e.target.closest('.coluna');
  if (!col) return;
  e.preventDefault();
  let n = marca.parentNode ? marca.nextElementSibling : null;
  while (n && (!n.classList.contains('cartao') || n.dataset.id === arrastado)) n = n.nextElementSibling;
  const id = arrastado;
  limparArrasto();
  mover(id, col.dataset.col, n ? n.dataset.id : null);
});
el.quadro.addEventListener('dragend', limparArrasto);

/* ---------- menu Mover (toque e teclado) ---------- */
let menuId = null, menuBotao = null;
function abrirMenu(botao, id) {
  fecharMenu();
  const p = achar(id);
  const vis = daColuna(p.coluna).filter(passa), i = vis.indexOf(p);
  menuId = id; menuBotao = botao;
  el.menu.innerHTML = `<div class="menu-tit">Mover para</div>` +
    COLUNAS.filter(c => c.id !== p.coluna).map(c =>
      `<button type="button" role="menuitem" class="col-${c.id}" data-col="${c.id}"><span class="col-ponto" aria-hidden="true"></span>${c.nome}</button>`).join('') +
    `<hr><button type="button" role="menuitem" data-passo="-1"${i <= 0 ? ' disabled' : ''}>↑ Subir na coluna</button>
     <button type="button" role="menuitem" data-passo="1"${i >= vis.length - 1 ? ' disabled' : ''}>↓ Descer na coluna</button>
     <hr><button type="button" role="menuitem" data-abrir="1">Abrir detalhes…</button>`;
  el.menu.hidden = false;
  botao.setAttribute('aria-expanded', 'true');
  posicionarMenu();
  $('button:not([disabled])', el.menu).focus({ preventScroll: true });
}
// o menu é fixo na tela: acompanha o botão quando a página ou o quadro rolam
function posicionarMenu() {
  if (el.menu.hidden || !menuBotao) return;
  const r = menuBotao.getBoundingClientRect(), w = el.menu.offsetWidth, h = el.menu.offsetHeight;
  if (!menuBotao.isConnected || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return fecharMenu();
  let top = r.bottom + 6;
  if (top + h > innerHeight - 8) top = Math.max(8, r.top - h - 6);
  el.menu.style.top = top + 'px';
  el.menu.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + 'px';
}
function fecharMenu(voltarFoco) {
  if (el.menu.hidden) return;
  el.menu.hidden = true;
  if (menuBotao) {
    menuBotao.setAttribute('aria-expanded', 'false');
    if (voltarFoco && menuBotao.isConnected) menuBotao.focus();
  }
  menuId = null; menuBotao = null;
}
el.menu.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  const id = menuId, botao = menuBotao;
  fecharMenu();
  if (b.dataset.col) mover(id, b.dataset.col, null);
  else if (b.dataset.passo) reordenar(id, Number(b.dataset.passo));
  else if (b.dataset.abrir) return abrirProjeto(id, botao);
  focarCartao(id);
});
el.menu.addEventListener('keydown', e => {
  const itens = $$('button:not([disabled])', el.menu);
  const i = itens.indexOf(document.activeElement);
  const vai = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: itens.length - 1 }[e.key];
  if (vai === undefined) { if (e.key === 'Tab') fecharMenu(); return; }
  e.preventDefault();
  itens[(vai + itens.length) % itens.length].focus();
});
document.addEventListener('pointerdown', e => {
  if (!el.menu.hidden && !el.menu.contains(e.target) && !e.target.closest('.c-mover')) fecharMenu();
});
addEventListener('resize', posicionarMenu);
addEventListener('scroll', posicionarMenu, { passive: true });
el.quadro.addEventListener('scroll', posicionarMenu, { passive: true });

/* ===========================================================
   JANELA DO PROJETO
   =========================================================== */
const F = {
  form: $('#fProj'), tit: $('#mTit'), estado: $('#mEstado'), erro: $('#mErro'),
  tarefas: $('#listaTarefas'), novaTarefa: $('#novaTarefa'), tConta: $('#tarefasConta'), tBarra: $('#tarefasBarra'),
  coment: $('#listaComent'), cConta: $('#comentConta'), autor: $('#cAutor'), texto: $('#cTexto'),
  excluir: $('#mExcluir'), cancelar: $('#mCancelar'), ok: $('#mOk')
};
$('#cTipo').innerHTML = opcoes(TIPOS);
$('#cPrio').innerHTML = opcoes(PRIOS);
$('#cResp').innerHTML = opEquipe();
$('#cColuna').innerHTML = opcoes(Object.fromEntries(COLUNAS.map(c => [c.id, c.nome])));
F.autor.innerHTML = opEquipe();
F.autor.value = D.ler('autor', 'Rafa');

let atual = null, ehNovo = false, focoVolta = null, tSalvar = 0;

function abrirProjeto(id, origem) {
  const p = achar(id);
  if (!p) return;
  atual = p; ehNovo = false;
  abrirJanela(origem);
}
function abrirNovo(col = 'backlog', origem) {
  atual = novoProjeto({ coluna: col });
  ehNovo = true;
  abrirJanela(origem);
}
function abrirJanela(origem) {
  fecharMenu();
  focoVolta = origem || document.activeElement;
  $('#listaClientes').innerHTML = [...new Set(projetos.map(p => p.cliente))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .map(c => `<option value="${esc(c)}">`).join('');
  preencher();
  el.mProj.hidden = false;
  document.body.classList.add('travado');
  $('.m-corpo', el.mProj).scrollTop = 0;
  setTimeout(() => (ehNovo ? $('#cNome') : F.ok).focus(), 30);
}
function preencher() {
  const p = atual;
  $$('[data-campo]', F.form).forEach(c => {
    const k = c.dataset.campo;
    c.value = k === 'tags' ? p.tags.join(', ') : k === 'valor' ? (p.valor || '') : p[k];
    c.removeAttribute('aria-invalid');
  });
  F.erro.hidden = true;
  F.tit.textContent = ehNovo ? 'Novo projeto' : 'Editar projeto';
  F.estado.textContent = ehNovo ? 'Preencha e clique em Criar projeto' : 'As alterações são salvas na hora';
  F.excluir.hidden = ehNovo;
  F.cancelar.hidden = !ehNovo;
  F.ok.textContent = ehNovo ? 'Criar projeto' : 'Fechar';
  F.novaTarefa.value = ''; F.texto.value = '';
  renderTarefas(); renderComentarios();
}

function mostrarErro(campo, msg) {
  F.erro.textContent = msg;
  F.erro.hidden = false;
  campo.setAttribute('aria-invalid', 'true');
  campo.dataset.erro = msg;
}
function limparErro(campo) {
  if (campo) campo.removeAttribute('aria-invalid');
  if (!$('[aria-invalid]', F.form)) F.erro.hidden = true;
}
const lerTags = v => [...new Set(String(v).split(',').map(t => t.trim().toLowerCase()).filter(Boolean))].slice(0, 6);

// cada campo escreve direto no projeto; no projeto existente já salva
function aplicarCampo(c) {
  const k = c.dataset.campo;
  let v = c.value;
  if (k === 'nome' || k === 'cliente') {
    v = v.trim();
    if (!v) return mostrarErro(c, k === 'nome' ? 'Dê um nome ao projeto.' : 'Informe o cliente.');
  } else if (k === 'valor') {
    v = Math.max(0, Math.round((Number(v) || 0) * 100) / 100);
  } else if (k === 'tags') {
    v = lerTags(v);
  } else if (k === 'inicio' || k === 'prazo') {
    // as duas datas andam juntas: lê as duas da tela para não guardar um par trocado
    const ci = $('#cInicio'), cp = $('#cPrazo');
    if (!ehData(v)) return mostrarErro(c, 'Escolha uma data válida.');
    limparErro(c);
    if (!ehData(ci.value) || !ehData(cp.value)) return;
    if (ci.value > cp.value) return mostrarErro(c, 'O início precisa ser antes do prazo de entrega.');
    limparErro(ci); limparErro(cp);
    atual.inicio = ci.value; atual.prazo = cp.value;
    if (!ehNovo) agendarSalvar();
    return;
  }
  limparErro(c);
  if (k === 'coluna' && !ehNovo) {
    if (v === atual.coluna) return;
    mover(atual.id, v, null);   // vai para o fim da etapa nova e registra no histórico
    renderComentarios();
    F.estado.textContent = 'Salvo às ' + NT.hora().slice(0, 5);
    return;
  }
  atual[k] = v;
  if (!ehNovo) agendarSalvar();
}
function agendarSalvar() {
  F.estado.textContent = 'Salvando…';
  clearTimeout(tSalvar);
  tSalvar = setTimeout(salvarAgora, 250);
}
function salvarAgora() {
  clearTimeout(tSalvar); tSalvar = 0;
  salvar(); render();
  F.estado.textContent = 'Salvo às ' + NT.hora().slice(0, 5);
}
F.form.addEventListener('input', e => { if (e.target.dataset.campo) aplicarCampo(e.target); });
F.form.addEventListener('change', e => {
  const c = e.target;
  if (!c.dataset.campo || ehNovo) return;
  // campo obrigatório que ficou vazio volta ao valor salvo ao sair dele
  if ((c.dataset.campo === 'nome' || c.dataset.campo === 'cliente') && !c.value.trim()) { c.value = atual[c.dataset.campo]; limparErro(c); }
  if (c.dataset.campo === 'tags') c.value = atual.tags.join(', ');
});
F.form.addEventListener('submit', e => { e.preventDefault(); F.ok.click(); });

/* ---------- checklist ---------- */
function renderTarefas() {
  const pr = progresso(atual);
  F.tConta.textContent = pr.n ? `${pr.f} de ${pr.n} · ${pr.pct}%` : 'nenhuma tarefa';
  F.tBarra.style.width = pr.pct + '%';
  F.tBarra.parentNode.classList.toggle('cheia', pr.n > 0 && pr.pct === 100);
  F.tarefas.innerHTML = atual.tarefas.map(t => `<li class="tarefa${t.feito ? ' feita' : ''}">
      <input type="checkbox" id="t-${t.id}" data-t="${t.id}"${t.feito ? ' checked' : ''}>
      <label for="t-${t.id}">${esc(t.txt)}</label>
      <button type="button" class="x" data-del-t="${t.id}" aria-label="Remover a tarefa “${esc(t.txt)}”">✕</button>
    </li>`).join('') || '<li class="lista-vazia dim">Quebre o projeto em tarefas para acompanhar o progresso.</li>';
}
function mexeuNoProjeto() { if (!ehNovo) salvarAgora(); }
F.tarefas.addEventListener('change', e => {
  const t = atual.tarefas.find(x => x.id === e.target.dataset.t);
  if (!t) return;
  t.feito = e.target.checked;
  renderTarefas();
  $(`#t-${t.id}`).focus();
  mexeuNoProjeto();
});
F.tarefas.addEventListener('click', e => {
  const b = e.target.closest('[data-del-t]');
  if (!b) return;
  const i = atual.tarefas.findIndex(x => x.id === b.dataset.delT);
  atual.tarefas.splice(i, 1);
  renderTarefas();
  const resto = $$('[data-del-t]', F.tarefas);
  (resto[Math.min(i, resto.length - 1)] || F.novaTarefa).focus();
  mexeuNoProjeto();
});
$('#fTarefa').addEventListener('submit', e => {
  e.preventDefault();
  const txt = F.novaTarefa.value.trim();
  if (!txt) { F.novaTarefa.focus(); return NT.aviso('Escreva a tarefa antes de adicionar.'); }
  atual.tarefas.push({ id: NT.id(), txt, feito: false });
  F.novaTarefa.value = '';
  renderTarefas();
  F.tarefas.lastElementChild.scrollIntoView({ block: 'nearest' });
  F.novaTarefa.focus();
  mexeuNoProjeto();
});

/* ---------- comentários e histórico ---------- */
function quando(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const min = Math.round((Date.now() - d) / 6e4);
  const rel = min < 1 ? 'agora' : min < 60 ? `há ${min} min` : min < 1440 ? `há ${Math.round(min / 60)} h` : '';
  const abs = d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return rel ? `${rel} · ${abs}` : abs;
}
function renderComentarios() {
  const lista = [...atual.comentarios].sort((a, b) => String(b.em).localeCompare(String(a.em)));
  const n = lista.filter(c => !c.sis).length;
  F.cConta.textContent = plural(n, 'comentário', 'comentários');
  F.coment.innerHTML = lista.map(c => c.sis
    ? `<li class="evento"><span class="ev-ponto" aria-hidden="true"></span><span>${esc(c.txt)}</span><time datetime="${esc(c.em)}">${quando(c.em)}</time></li>`
    : `<li class="coment">${avatar(c.autor)}<div class="coment-corpo">
        <div class="coment-cab"><b>${esc(c.autor)}</b><time datetime="${esc(c.em)}">${quando(c.em)}</time>
          <button type="button" class="x" data-del-c="${c.id}" aria-label="Apagar comentário de ${esc(c.autor)}">✕</button></div>
        <p>${esc(c.txt)}</p></div></li>`).join('') ||
    '<li class="lista-vazia dim">Nenhum comentário ainda. Registre combinados com o cliente, bloqueios e decisões.</li>';
}
$('#fComent').addEventListener('submit', e => {
  e.preventDefault();
  const txt = F.texto.value.trim();
  if (!txt) { F.texto.focus(); return NT.aviso('Escreva o comentário antes de enviar.'); }
  atual.comentarios.push({ id: NT.id(), autor: F.autor.value, txt, em: new Date().toISOString() });
  D.gravar('autor', F.autor.value);
  F.texto.value = '';
  renderComentarios();
  F.texto.focus();
  mexeuNoProjeto();
});
F.texto.addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); $('#fComent').requestSubmit(); }
});
F.coment.addEventListener('click', async e => {
  const b = e.target.closest('[data-del-c]');
  if (!b) return;
  const c = atual.comentarios.find(x => x.id === b.dataset.delC);
  if (!c || !await confirmar('Apagar este comentário?', `“${c.txt.slice(0, 120)}${c.txt.length > 120 ? '…' : ''}” — de ${c.autor}.`, 'Apagar')) return;
  atual.comentarios = atual.comentarios.filter(x => x !== c);
  renderComentarios();
  F.texto.focus();
  mexeuNoProjeto();
});

/* ---------- criar, fechar, excluir ---------- */
function criar() {
  const campos = $$('[data-campo]', F.form);
  campos.forEach(aplicarCampo);
  const ruim = $('[aria-invalid="true"]', F.form);
  if (ruim) { mostrarErro(ruim, ruim.dataset.erro); ruim.focus(); return; }
  const p = atual;
  if (p.coluna === 'entregue') p.entregueEm = NT.hojeISO();
  // projeto novo entra no topo da etapa, onde a gente olha primeiro
  daColuna(p.coluna).forEach(x => { x.ordem += 1; });
  p.ordem = 0;
  registrar(p, `Projeto criado em ${nomeCol(p.coluna)}`);
  projetos.push(p);
  salvar();
  fecharJanela(true);
  render();
  NT.aviso(`Projeto “${p.nome}” criado.`);
  if ($('#abaQuadro').classList.contains('on')) {
    const c = $(`.cartao[data-id="${p.id}"]`, el.quadro);
    if (c) { c.classList.add('novo'); focarCartao(p.id); }
  }
}
function fecharJanela(sair) {
  if (!sair) {
    if (ehNovo && (atual.nome || atual.cliente || atual.tarefas.length || atual.comentarios.length)) {
      return confirmar('Descartar o projeto novo?', 'O que você preencheu ainda não foi salvo no quadro.', 'Descartar')
        .then(sim => sim && fecharJanela(true));
    }
    if (tSalvar) salvarAgora();
  }
  el.mProj.hidden = true;
  document.body.classList.remove('travado');
  const id = atual && !ehNovo ? atual.id : null;
  atual = null;
  if (id && focoVolta && !focoVolta.isConnected) focarCartao(id);
  else if (focoVolta && focoVolta.isConnected) focoVolta.focus({ preventScroll: true });
}
F.ok.addEventListener('click', () => ehNovo ? criar() : fecharJanela());
F.cancelar.addEventListener('click', () => fecharJanela());
$('#mX').addEventListener('click', () => fecharJanela());
el.mProj.addEventListener('mousedown', e => { if (e.target === el.mProj) fecharJanela(); });
F.excluir.addEventListener('click', async () => {
  const p = atual, pr = progresso(p);
  const n = p.comentarios.filter(c => !c.sis).length;
  if (!await confirmar(`Excluir “${p.nome}”?`,
    `O projeto de ${p.cliente}, com ${plural(pr.n, 'tarefa', 'tarefas')} e ${plural(n, 'comentário', 'comentários')}, sai do quadro. Isso não pode ser desfeito.`,
    'Excluir projeto')) return;
  clearTimeout(tSalvar); tSalvar = 0;
  projetos = projetos.filter(x => x !== p);
  salvar();
  ehNovo = true;          // não tenta voltar o foco para um cartão que não existe mais
  fecharJanela(true);
  render();
  NT.aviso(`“${p.nome}” foi excluído.`);
  $('#bNovo').focus();
});

/* ---------- confirmação ---------- */
let resolverConf = null, focoConf = null;
function confirmar(titulo, texto, rotulo = 'Confirmar') {
  if (resolverConf) resolverConf(false);
  $('#confTit').textContent = titulo;
  $('#confTxt').textContent = texto;
  $('#confSim').textContent = rotulo;
  focoConf = document.activeElement;
  el.mConf.hidden = false;
  setTimeout(() => $('#confNao').focus(), 30);
  return new Promise(res => { resolverConf = res; });
}
function fecharConf(resposta) {
  if (!resolverConf) return;
  el.mConf.hidden = true;
  const r = resolverConf;
  resolverConf = null;
  if (focoConf && focoConf.isConnected) focoConf.focus({ preventScroll: true });
  r(resposta);
}
$('#confSim').addEventListener('click', () => fecharConf(true));
$('#confNao').addEventListener('click', () => fecharConf(false));
el.mConf.addEventListener('mousedown', e => { if (e.target === el.mConf) fecharConf(false); });

/* ---------- teclado: Esc fecha o que estiver por cima; Tab não foge da janela ---------- */
function prenderFoco(e, caixa) {
  const f = $$('button:not([disabled]), input:not([disabled]), select, textarea, [tabindex="0"]', caixa).filter(x => x.offsetParent !== null);
  if (!f.length) return;
  const pri = f[0], ult = f[f.length - 1], at = document.activeElement;
  if (!caixa.contains(at)) { e.preventDefault(); pri.focus(); }
  else if (e.shiftKey && at === pri) { e.preventDefault(); ult.focus(); }
  else if (!e.shiftKey && at === ult) { e.preventDefault(); pri.focus(); }
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!el.menu.hidden) { e.preventDefault(); return fecharMenu(true); }
    if (!el.mConf.hidden) { e.preventDefault(); return fecharConf(false); }
    if (!el.mProj.hidden) { e.preventDefault(); return fecharJanela(); }
  }
  if (e.key === 'Tab') {
    if (!el.mConf.hidden) prenderFoco(e, $('.modal', el.mConf));
    else if (!el.mProj.hidden) prenderFoco(e, $('.modal', el.mProj));
  }
});

/* ===========================================================
   TOPO: novo, exportar, restaurar
   =========================================================== */
$('#bNovo').addEventListener('click', e => abrirNovo('backlog', e.currentTarget));

$('#bCsv').addEventListener('click', () => {
  const cel = v => { const s = String(v == null ? '' : v); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const cab = ['Projeto', 'Cliente', 'Tipo', 'Etapa', 'Responsável', 'Prioridade', 'Valor (R$)', 'Início', 'Prazo', 'Entregue em', 'Tarefas feitas', 'Tarefas', 'Atrasado', 'Tags'];
  const ordem = c => COLUNAS.findIndex(x => x.id === c);
  const linhas = [...projetos].sort((a, b) => ordem(a.coluna) - ordem(b.coluna) || a.ordem - b.ordem).map(p => {
    const pr = progresso(p);
    return [p.nome, p.cliente, TIPOS[p.tipo], nomeCol(p.coluna), p.resp, PRIOS[p.prio], String(p.valor).replace('.', ','),
      NT.data(p.inicio), NT.data(p.prazo), p.entregueEm ? NT.data(p.entregueEm) : '', pr.f, pr.n, atrasado(p) ? 'sim' : 'não', p.tags.join(', ')];
  });
  // ponto e vírgula e BOM: é o que o Excel em português abre sem bagunçar acentos e colunas
  const csv = '﻿' + [cab, ...linhas].map(l => l.map(cel).join(';')).join('\r\n');
  NT.baixar(`projetos-nassa-tech-${NT.hojeISO()}.csv`, csv, 'text/csv;charset=utf-8');
  NT.aviso(`${plural(projetos.length, 'projeto exportado', 'projetos exportados')} para CSV.`);
});

$('#bRestaurar').addEventListener('click', async () => {
  if (!await confirmar('Restaurar o exemplo?',
    `Os ${plural(projetos.length, 'projeto', 'projetos')} atuais, com tarefas e comentários, serão trocados pelos projetos de exemplo da Nassa Tech. Isso não pode ser desfeito.`,
    'Restaurar exemplo')) return;
  projetos = exemplo();
  filtros = Object.assign({}, FILTRO_VAZIO);
  salvar(); salvarFiltros();
  render();
  NT.aviso('Projetos de exemplo restaurados.');
});

// outra aba (ou o escritório) mexeu nos dados: recarrega para não sobrescrever
addEventListener('storage', e => {
  if (e.key !== 'nt-sis-fullstack:projetos' || !el.mProj.hidden) return;
  const novos = D.ler('projetos', null);
  if (Array.isArray(novos)) { projetos = novos.map(normalizar); render(); }
});

render();
})();
