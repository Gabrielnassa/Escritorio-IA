/* ===========================================================
   sistemas/comercial/app.js — CRM & Propostas (Duda)

   Funil de leads em seis etapas e gerador de propostas com a
   tabela de preços da casa. Tudo fica em NT.dados('comercial'):
     leads      os cartões do funil, com o histórico de cada um
     propostas  as propostas salvas (com o formulário que as gerou)
     precos     a tabela de preços editável em Configurações
     form       o rascunho aberto no gerador (volta igual depois do F5)
     seq        último número de proposta usado
   =========================================================== */
(() => {
const db = NT.dados('comercial');
const $ = s => document.querySelector(s);
const esc = NT.esc;

/* ---------- vocabulário fixo do funil ---------- */
const ETAPAS = [
  { id: 'novo', nome: 'Novo lead', cor: '#8a95ad' },
  { id: 'contato', nome: 'Contato feito', cor: 'var(--acc)' },
  { id: 'proposta', nome: 'Proposta enviada', cor: 'var(--roxo)' },
  { id: 'negociacao', nome: 'Negociação', cor: 'var(--warn)' },
  { id: 'fechado', nome: 'Fechado', cor: 'var(--ok)' },
  { id: 'perdido', nome: 'Perdido', cor: 'var(--err)' }
];
const ETAPA = Object.fromEntries(ETAPAS.map((e, i) => [e.id, Object.assign({ i }, e)]));
const ABERTAS = ['novo', 'contato', 'proposta', 'negociacao'];
const ORIGENS = { site: 'Site', indicacao: 'Indicação', instagram: 'Instagram', whatsapp: 'WhatsApp' };
const TEMPS = { quente: ['🔥', 'Quente', 'err'], morno: ['☀️', 'Morno', 'warn'], frio: ['❄️', 'Frio', 'acc'] };
const MOTIVOS = ['Preço acima do orçamento', 'Fechou com concorrente', 'Projeto adiado', 'Parou de responder',
  'Fora do perfil da Nassa Tech', 'Outro motivo'];
const STATUS = { rascunho: ['Rascunho', ''], enviada: ['Enviada', 'acc'], aceita: ['Aceita', 'ok'], recusada: ['Recusada', 'err'] };

/* ---------- tabela de preços padrão (valores de mercado em SP, 2026) ---------- */
const PRECOS_PADRAO = {
  tipos: {
    site: { nome: 'Site institucional', preco: 4800, semanas: 4, itens: ['Até 6 páginas com layout exclusivo', 'Versão para celular e tablet', 'Formulário de contato e botão de WhatsApp', 'SEO básico (títulos, descrições e sitemap)', 'Google Analytics e Search Console configurados'] },
    landing: { nome: 'Landing page', preco: 2400, semanas: 2, itens: ['Página única focada em conversão', 'Estrutura de texto persuasiva', 'Formulário integrado ao e-mail ou CRM', 'Pixel do Meta e tag do Google Ads', 'Carregamento rápido (nota 90+ no PageSpeed)'] },
    loja: { nome: 'Loja virtual', preco: 9800, semanas: 7, itens: ['Catálogo com até 200 produtos', 'Carrinho e checkout com Pix, cartão e boleto', 'Cálculo de frete pelos Correios e transportadora', 'Painel de pedidos e estoque', 'E-mails automáticos de pedido'] },
    sistema: { nome: 'Sistema sob medida', preco: 24000, semanas: 12, itens: ['Levantamento de requisitos com a equipe', 'Banco de dados e API próprios', 'Login com níveis de acesso', 'Relatórios e exportação para Excel', 'Homologação com usuários reais'] },
    app: { nome: 'App mobile', preco: 32000, semanas: 14, itens: ['App para Android e iOS', 'Design das telas no Figma', 'Notificações push', 'Publicação na Play Store e App Store', 'Painel web para gerenciar o conteúdo'] },
    automacao: { nome: 'Automação', preco: 3600, semanas: 3, itens: ['Mapeamento do processo atual', 'Integração entre planilhas, CRM e e-mail', 'Rotinas agendadas sem intervenção manual', 'Alertas quando algo sai do esperado', 'Documentação do fluxo'] },
    ia: { nome: 'Agente de IA', preco: 7500, semanas: 5, itens: ['Base de conhecimento com os documentos do cliente', 'Atendimento 24h no WhatsApp e no site', 'Passagem para atendente humano', 'Painel com o histórico das conversas', '30 dias de ajustes finos após a entrega'] }
  },
  addons: {
    dominio: { nome: 'Domínio + hospedagem (12 meses)', preco: 690, semanas: 0 },
    manutencao: { nome: 'Manutenção mensal', preco: 390, semanas: 0, mensal: true },
    seo: { nome: 'SEO avançado', preco: 1800, semanas: 1 },
    whatsapp: { nome: 'Integração com WhatsApp', preco: 1200, semanas: 1 },
    painel: { nome: 'Painel administrativo', preco: 3500, semanas: 2 },
    treinamento: { nome: 'Treinamento da equipe', preco: 600, semanas: 0 }
  },
  complex: {
    simples: { nome: 'Simples', mult: 1, prazo: 1 },
    medio: { nome: 'Médio', mult: 1.3, prazo: 1.25 },
    complexo: { nome: 'Complexo', mult: 1.7, prazo: 1.6 }
  },
  urgencia: 25, urgPrazo: 30, descAvista: 5, descMax: 20, maxParcelas: 12, validade: 15
};

/* ---------- formatos ---------- */
const fmt0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const brl0 = n => fmt0.format(Math.round(Number(n) || 0));
const brl = NT.brl;
const multTxt = m => '×' + Number(m).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
const pad = n => String(n).padStart(2, '0');
const agora = () => { const d = new Date(); return NT.hojeISO() + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const dataLonga = iso => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
const somaDiasISO = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const clamp = (v, a, b) => Math.min(b, Math.max(a, Number(v) || 0));
const r2 = n => Math.round(n * 100) / 100;
const copia = v => JSON.parse(JSON.stringify(v));
const nomeLead = l => l.empresa || l.nome;

// "hoje", "amanhã", "há 2 dias"... — o próximo passo lido de relance no cartão
function quando(iso) {
  if (!iso) return '';
  const dias = Math.round((new Date(iso + 'T12:00:00') - new Date(NT.hojeISO() + 'T12:00:00')) / 864e5);
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'amanhã';
  if (dias === -1) return 'ontem';
  if (dias < 0) return 'há ' + -dias + ' dias';
  if (dias < 7) return 'em ' + dias + ' dias';
  return NT.data(iso).slice(0, 5);
}

/* ===========================================================
   DADOS DE EXEMPLO — clientes de bairro e PMEs de São Paulo
   =========================================================== */
function formPadrao() {
  return { leadId: '', empresa: '', cliente: '', descricao: '', tipo: 'site', addons: { dominio: true },
    complex: 'medio', urgente: false, desconto: 0, pagamento: 'parcelado', parcelas: 6, editando: '' };
}

function exemplo() {
  // [nome, empresa, tel, origem, tipo, detalhe, valor, temp, etapa, passo, diasPasso, criadoHá, notas[[diasAtrás, hora, texto]]]
  const base = [
    ['Marcos Lima', 'Padaria Pão de Mel', '(11) 98432-1170', 'whatsapp', 'site', 'cardápio online e encomendas de bolos', 5200, 'morno', 'novo', 'Ligar para entender o cardápio e as encomendas', 1, 2,
      [[2, '09:12', 'Mandou mensagem no WhatsApp pedindo orçamento de site com cardápio.']]],
    ['Felipe Sato', 'Pet Shop Amigo Fiel', '(11) 97120-4455', 'instagram', 'loja', 'ração e acessórios com entrega no bairro', 11500, 'quente', 'novo', 'Primeiro contato pelo WhatsApp', 0, 1,
      [[1, '18:40', 'Comentou no post de cases do Instagram: "quero uma loja assim".']]],
    ['Carla Menezes', 'Estética Bella Pele', '(11) 99803-2210', 'whatsapp', 'ia', 'agendamento automático de procedimentos', 7500, 'frio', 'novo', 'Retomar contato depois da Black Friday', 12, 6,
      [[6, '14:05', 'Gostou da ideia do agente, mas só quer investir em dezembro.']]],
    ['Tiago Moura', 'Academia Força Total', '(11) 98877-6020', 'instagram', 'app', 'app de treinos e check-in dos alunos', 38000, 'quente', 'contato', 'Enviar cases de apps fitness', 0, 8,
      [[8, '10:30', 'Chamou no direct depois do reels do app da academia de Moema.'], [5, '16:00', 'Videochamada de 40 min: 3 unidades, ~1.200 alunos, quer app próprio até março.']]],
    ['Juliana Prado', 'Escola Pequeno Saber', '(11) 3871-4420', 'indicacao', 'landing', 'matrículas 2027 com tour virtual', 2900, 'morno', 'contato', 'Mandar briefing para a coordenação', 2, 7,
      [[7, '11:20', 'Indicação da Advocacia Duarte. Campanha de matrículas começa em novembro.'], [4, '15:45', 'Pediu briefing por e-mail para mostrar à direção.']]],
    ['Larissa Fontes', 'Hotel Serra Azul', '(12) 3662-1900', 'site', 'site', 'site com motor de reservas', 8900, 'frio', 'contato', 'Confirmar se o orçamento foi aprovado pelo dono', -2, 15,
      [[15, '08:55', 'Preencheu o formulário do site: quer sair da dependência do Booking.'], [10, '17:10', 'Primeira conversa feita. Aguardando aprovação do proprietário.']]],
    ['Dr. Henrique Duarte', 'Advocacia Duarte', '(11) 3045-7788', 'site', 'site', 'site com área de artigos jurídicos', 6400, 'morno', 'proposta', 'Cobrar retorno da proposta', 1, 12,
      [[12, '13:30', 'Contato pelo site. Escritório de direito trabalhista com 4 advogados.'], [9, '10:00', 'Reunião presencial na Faria Lima. Quer artigos para atrair clientes no Google.']]],
    ['Renata Alves', 'Imobiliária Horizonte', '(11) 94512-3388', 'site', 'sistema', 'gestão de locações e repasses', 28000, 'quente', 'proposta', 'Apresentar a proposta por vídeo', 3, 20,
      [[20, '09:40', 'Hoje controla 380 contratos em planilha. Quer portal do proprietário.'], [14, '14:20', 'Levantamento com a equipe financeira (2h).']]],
    ['Dra. Camila Rocha', 'Clínica Sorriso', '(11) 99231-5566', 'indicacao', 'ia', 'agendamento e confirmação de consultas no WhatsApp', 9800, 'quente', 'negociacao', 'Reunião de fechamento com as sócias', 2, 25,
      [[25, '10:15', 'Indicação do Dr. Paulo (Oficina Turbo Car é paciente).'], [18, '16:30', 'Demonstração do agente respondendo dúvidas sobre clareamento.'], [3, '11:00', 'Pediram 5% de desconto para fechar em 6x.']]],
    ['Roberto Nunes', 'Construtora Alicerce', '(11) 97660-1234', 'site', 'automacao', 'relatórios diários de obra automáticos', 4800, 'morno', 'negociacao', 'Ajustar escopo da integração com as planilhas', 1, 16,
      [[16, '08:30', 'Engenheiros perdem 1h por dia montando relatório de obra.'], [6, '15:00', 'Quer incluir aviso no WhatsApp quando faltar material.']]],
    ['Ana Beatriz Costa', 'Café Grão Paulista', '(11) 98111-0909', 'instagram', 'landing', 'lançamento do clube de assinatura de cafés', 2400, 'quente', 'fechado', 'Kickoff com o Lucas (front-end)', 4, 30,
      [[30, '12:00', 'Veio pelo Instagram. Lançamento do clube em novembro.'], [18, '17:30', 'Proposta aceita, pagamento à vista via Pix.']]],
    ['Paulo Mendes', 'Oficina Turbo Car', '(11) 2954-3030', 'whatsapp', 'sistema', 'ordens de serviço e orçamento pelo WhatsApp', 18000, 'quente', 'fechado', 'Primeira entrega parcial', 10, 45,
      [[45, '09:00', 'Quer largar o caderno de ordens de serviço.'], [28, '14:00', 'Contrato assinado em 12x.']]],
    ['Sérgio Tavares', 'Distribuidora Bom Preço', '(11) 4412-8800', 'site', 'loja', 'loja B2B para mercados da região', 14000, 'morno', 'perdido', '', 0, 35,
      [[35, '10:10', 'Loja B2B com tabela de preço por cliente.'], [20, '16:45', 'Achou caro; vai usar uma plataforma pronta.']], 'Preço acima do orçamento'],
    ['Gustavo Reis', 'Contabilidade Exata', '(11) 3256-1414', 'indicacao', 'automacao', 'captura automática de notas fiscais', 3600, 'frio', 'perdido', '', 0, 40,
      [[40, '11:30', 'Indicação do Roberto (Construtora Alicerce).'], [22, '09:20', 'Sócio pediu para retomar só em 2027.']], 'Projeto adiado']
  ];
  const leads = base.map(b => {
    const [nome, empresa, tel, origem, tipo, detalhe, valor, temp, etapa, passo, diasPasso, criadoHa, notas, motivo] = b;
    const l = { id: NT.id(), nome, empresa, tel, email: '', origem, tipo, detalhe, valor, temp, etapa,
      passo, passoData: passo ? NT.hojeISO(diasPasso) : '', criado: NT.hojeISO(-criadoHa),
      notas: notas.map(([d, h, t]) => ({ quando: NT.hojeISO(-d) + 'T' + h, texto: t })).reverse() };
    if (etapa === 'fechado') l.fechado = NT.hojeISO(-notas[notas.length - 1][0]);
    if (motivo) { l.motivo = motivo; l.etapaAntes = 'proposta'; }
    return l;
  });
  const acha = emp => leads.find(l => l.empresa === emp);
  // [número, empresa, status, diasAtrás, ajustes no formulário]
  const props = [
    [24, 'Oficina Turbo Car', 'aceita', 30, { tipo: 'sistema', complex: 'simples', addons: { treinamento: true, manutencao: true }, parcelas: 12 }],
    [25, 'Distribuidora Bom Preço', 'recusada', 26, { tipo: 'loja', complex: 'complexo', addons: { dominio: true, painel: true }, parcelas: 10 }],
    [27, 'Café Grão Paulista', 'aceita', 18, { tipo: 'landing', complex: 'simples', addons: { dominio: true }, pagamento: 'avista' }],
    [29, 'Clínica Sorriso', 'enviada', 9, { tipo: 'ia', complex: 'medio', addons: { whatsapp: true, treinamento: true, manutencao: true }, desconto: 5, parcelas: 6 }],
    [31, 'Advocacia Duarte', 'enviada', 4, { tipo: 'site', complex: 'simples', addons: { dominio: true, seo: true }, pagamento: 'avista' }],
    [32, 'Imobiliária Horizonte', 'enviada', 2, { tipo: 'sistema', complex: 'medio', addons: { treinamento: true, manutencao: true }, parcelas: 10 }],
    [33, 'Construtora Alicerce', 'rascunho', 1, { tipo: 'automacao', complex: 'medio', addons: { whatsapp: true }, parcelas: 3 }]
  ];
  const ano = new Date().getFullYear();
  const propostas = props.map(([n, emp, status, dias, ajuste]) => {
    const l = acha(emp);
    const f = Object.assign(formPadrao(), { leadId: l.id, empresa: l.empresa, cliente: l.nome,
      descricao: objetivoPadrao(PRECOS_PADRAO.tipos[ajuste.tipo].nome, l.empresa, l.detalhe) }, ajuste);
    const c = calcular(f, PRECOS_PADRAO);
    l.valor = Math.round(c.total);
    return montarProposta(f, c, 'NT-' + ano + '-' + String(n).padStart(3, '0'), NT.hojeISO(-dias), status);
  }).reverse();
  return { leads, propostas, seq: 33 };
}

function objetivoPadrao(tipoNome, empresa, detalhe) {
  return 'Desenvolvimento de ' + tipoNome.toLowerCase() + (empresa ? ' para ' + empresa : '') +
    (detalhe ? ', com foco em ' + detalhe : '') + '.';
}

/* ---------- carga inicial ---------- */
let precos = db.ler('precos', null) || db.gravar('precos', copia(PRECOS_PADRAO));
let leads = db.ler('leads', null);
let propostas = db.ler('propostas', null);
let seq = db.ler('seq', 0);
if (!leads || !propostas) {
  const ex = exemplo();
  leads = db.gravar('leads', ex.leads); propostas = db.gravar('propostas', ex.propostas); seq = db.gravar('seq', ex.seq);
}
let form = Object.assign(formPadrao(), db.ler('form', {}));
const salvarLeads = () => db.gravar('leads', leads);
const salvarProps = () => db.gravar('propostas', propostas);
const salvarForm = () => db.gravar('form', form);
const salvarPrecos = () => db.gravar('precos', precos);

/* ===========================================================
   CÁLCULO DA PROPOSTA
   A complexidade multiplica só o projeto-base; adicionais têm preço
   fechado. Urgência entra sobre o subtotal e os descontos vêm depois.
   =========================================================== */
function calcular(f, p = precos) {
  const t = p.tipos[f.tipo] || Object.values(p.tipos)[0];
  const cx = p.complex[f.complex] || p.complex.medio;
  const itens = [{ nome: t.nome + ' — nível ' + cx.nome.toLowerCase() + (cx.mult !== 1 ? ' (' + multTxt(cx.mult) + ')' : ''), valor: r2(t.preco * cx.mult) }];
  let semanas = t.semanas * cx.prazo, mensal = 0;
  const mensais = [], extras = [];
  Object.entries(p.addons).forEach(([k, a]) => {
    if (!f.addons || !f.addons[k]) return;
    if (a.mensal) { mensal += a.preco; mensais.push(a); return; }
    itens.push({ nome: a.nome, valor: a.preco }); extras.push(a); semanas += a.semanas;
  });
  const subtotal = itens.reduce((s, i) => s + i.valor, 0);
  const urg = f.urgente ? r2(subtotal * p.urgencia / 100) : 0;
  const descPct = clamp(f.desconto, 0, p.descMax);
  const desc = r2((subtotal + urg) * descPct / 100);
  const avista = f.pagamento === 'avista' ? r2((subtotal + urg - desc) * p.descAvista / 100) : 0;
  const total = r2(subtotal + urg - desc - avista);
  const parcelas = f.pagamento === 'avista' ? 1 : clamp(Math.round(f.parcelas) || 1, 1, p.maxParcelas);
  if (f.urgente) semanas *= 1 - p.urgPrazo / 100;
  semanas = Math.max(1, Math.ceil(semanas - 0.01));
  return { t, cx, itens, extras, mensais, mensal, subtotal, urg, descPct, desc, avista, total, parcelas,
    parcela: r2(total / parcelas), semanas };
}

function montarProposta(f, c, numero, criada, status) {
  return { id: NT.id(), numero, criada, status, leadId: f.leadId, empresa: f.empresa, cliente: f.cliente,
    tipoNome: c.t.nome, total: c.total, parcelas: c.parcelas, semanas: c.semanas, mensal: c.mensal,
    form: Object.assign(copia(f), { editando: '' }) };
}

/* ===========================================================
   KPIs
   =========================================================== */
function renderKpis() {
  const abertos = leads.filter(l => ABERTAS.includes(l.etapa));
  const quentes = abertos.filter(l => l.temp === 'quente').length;
  const negoc = leads.filter(l => l.etapa === 'proposta' || l.etapa === 'negociacao');
  const fech = leads.filter(l => l.etapa === 'fechado');
  const perd = leads.filter(l => l.etapa === 'perdido');
  const encerrados = fech.length + perd.length;
  const taxa = encerrados ? Math.round(fech.length / encerrados * 100) : 0;
  const somaFech = fech.reduce((s, l) => s + (+l.valor || 0), 0);
  const mes = NT.hojeISO().slice(0, 7);
  const doMes = propostas.filter(p => p.criada.slice(0, 7) === mes);
  const k = (cls, v, rot, sub) => `<div class="kpi ${cls}"><span>${rot}</span><b>${v}</b><small>${sub}</small></div>`;
  $('#kpis').innerHTML =
    k('acc', abertos.length, 'Leads no funil', quentes + (quentes === 1 ? ' quente' : ' quentes')) +
    k('warn', brl0(negoc.reduce((s, l) => s + (+l.valor || 0), 0)), 'Valor em negociação', negoc.length + ' em proposta ou negociação') +
    k('ok', taxa + '%', 'Taxa de conversão', encerrados ? fech.length + ' fechados de ' + encerrados + ' encerrados' : 'nenhum lead encerrado ainda') +
    k('', fech.length ? brl0(somaFech / fech.length) : '—', 'Ticket médio', brl0(somaFech) + ' fechados') +
    k('', doMes.length, 'Propostas no mês', (n => n + (n === 1 ? ' aceita · ' : ' aceitas · '))(doMes.filter(p => p.status === 'aceita').length) + brl0(doMes.reduce((s, p) => s + p.total, 0)));
  $('#nSalvas').textContent = propostas.length;
}

/* ===========================================================
   FUNIL
   =========================================================== */
const elFunil = $('#funil');
function passaFiltro(l) {
  const q = $('#fBusca').value.trim().toLowerCase();
  if ($('#fTemp').value && l.temp !== $('#fTemp').value) return false;
  if ($('#fOrigem').value && l.origem !== $('#fOrigem').value) return false;
  if (!q) return true;
  const t = precos.tipos[l.tipo];
  return [l.nome, l.empresa, l.detalhe, t && t.nome].join(' ').toLowerCase().includes(q);
}

function cartao(l) {
  const e = ETAPA[l.etapa], [ic, tn, tc] = TEMPS[l.temp] || TEMPS.morno;
  const t = precos.tipos[l.tipo];
  const ant = ETAPAS[e.i - 1], prox = ETAPAS[e.i + 1];
  const atrasado = ABERTAS.includes(l.etapa) && l.passoData && l.passoData < NT.hojeISO();
  let rodape = '';
  if (l.etapa === 'perdido') rodape = `<div class="lead-passo perdeu">✕ ${esc(l.motivo || 'Sem motivo')}</div>`;
  else if (l.passo) rodape = `<div class="lead-passo${atrasado ? ' atrasado' : ''}"><span>➜ ${esc(l.passo)}</span>${l.passoData ? `<time datetime="${l.passoData}">${quando(l.passoData)}</time>` : ''}</div>`;
  let acoes;
  if (l.etapa === 'perdido') acoes = `<button type="button" class="btn mini ghost" data-acao="reabrir">↺ Reabrir</button>`;
  else acoes =
    `<button type="button" class="btn mini ghost seta" data-acao="voltar" ${ant ? '' : 'disabled'} aria-label="Voltar para ${ant ? ant.nome : ''}" title="${ant ? 'Voltar para ' + ant.nome : ''}">◀</button>` +
    (l.etapa !== 'fechado' ? `<button type="button" class="btn mini ghost perder" data-acao="perder" title="Marcar como perdido">✕ Perdido</button>` : '<span class="ganho">✓ Ganho</span>') +
    `<button type="button" class="btn mini ghost seta" data-acao="avancar" ${prox && prox.id !== 'perdido' ? '' : 'disabled'} aria-label="Avançar para ${prox ? prox.nome : ''}" title="${prox ? 'Avançar para ' + prox.nome : ''}">▶</button>`;
  return `<article class="lead" draggable="true" data-id="${l.id}" aria-label="${esc(l.nome)}, ${esc(l.empresa)}">
    <div class="lead-topo"><button type="button" class="lead-nome" data-acao="abrir">${esc(l.nome)}</button>
      <span class="badge ${tc}" title="Temperatura">${ic} ${tn}</span></div>
    <div class="lead-emp">${esc(l.empresa || '—')}</div>
    <div class="lead-int">${esc(t ? t.nome : 'Projeto')}${l.detalhe ? ` <span class="dim">· ${esc(l.detalhe)}</span>` : ''}</div>
    <div class="lead-meta"><span class="origem o-${l.origem}">${ORIGENS[l.origem] || '—'}</span><b>${brl0(l.valor)}</b></div>
    ${rodape}
    <div class="lead-acoes">${acoes}</div>
  </article>`;
}

function renderFunil() {
  let vis = 0;
  elFunil.innerHTML = ETAPAS.map(e => {
    const todos = leads.filter(l => l.etapa === e.id);
    const lista = todos.filter(passaFiltro);
    vis += lista.length;
    // dentro da coluna: atrasados e mais próximos primeiro
    lista.sort((a, b) => (a.passoData || '9999').localeCompare(b.passoData || '9999'));
    const soma = todos.reduce((s, l) => s + (+l.valor || 0), 0);
    return `<section class="coluna" data-etapa="${e.id}" style="--cor:${e.cor}" aria-labelledby="col-${e.id}">
      <header class="col-topo"><h2 id="col-${e.id}">${e.nome}</h2><span class="col-conta">${todos.length}</span><span class="col-soma">${brl0(soma)}</span></header>
      <div class="col-lista">${lista.map(cartao).join('') || `<p class="col-vazia">${todos.length ? 'Nenhum lead neste filtro' : 'Solte um lead aqui'}</p>`}</div>
    </section>`;
  }).join('');
  $('#fConta').textContent = vis === leads.length ? leads.length + ' leads' : vis + ' de ' + leads.length + ' leads';
}

function nota(l, texto) { (l.notas = l.notas || []).unshift({ quando: agora(), texto }); }

// toda troca de etapa deixa rastro no histórico do lead
function moverLead(id, etapa, silencioso) {
  const l = leads.find(x => x.id === id);
  if (!l || l.etapa === etapa) return;
  if (etapa === 'perdido') { abrirPerdido(id); return; }
  const de = ETAPA[l.etapa].nome;
  if (l.etapa === 'perdido') { delete l.motivo; delete l.motivoDet; }
  l.etapa = etapa;
  if (etapa === 'fechado') l.fechado = NT.hojeISO();
  nota(l, 'Etapa: ' + de + ' → ' + ETAPA[etapa].nome + '.');
  salvarLeads(); tudo();
  if (!silencioso) NT.aviso(nomeLead(l) + ' foi para ' + ETAPA[etapa].nome + '.');
}

elFunil.addEventListener('click', e => {
  const b = e.target.closest('[data-acao]'); if (!b) return;
  const card = b.closest('.lead'), l = leads.find(x => x.id === card.dataset.id); if (!l) return;
  const i = ETAPA[l.etapa].i, a = b.dataset.acao;
  if (a === 'abrir') abrirLead(l.id);
  else if (a === 'voltar' && i > 0) moverLead(l.id, ETAPAS[i - 1].id);
  else if (a === 'avancar' && i < 4) moverLead(l.id, ETAPAS[i + 1].id);
  else if (a === 'perder') abrirPerdido(l.id);
  else if (a === 'reabrir') moverLead(l.id, l.etapaAntes || 'contato');
  // devolve o foco ao cartão movido, para quem usa teclado não se perder
  const de = elFunil.querySelector(`.lead[data-id="${l.id}"] [data-acao="${a}"]:not(:disabled)`) || elFunil.querySelector(`.lead[data-id="${l.id}"] .lead-nome`);
  if (de && a !== 'abrir' && a !== 'perder') de.focus();
});

/* arrastar e soltar entre colunas */
let arrastando = null;
elFunil.addEventListener('dragstart', e => {
  const c = e.target.closest('.lead'); if (!c) return;
  arrastando = c.dataset.id; c.classList.add('voando');
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', arrastando); } catch (err) { /* alguns navegadores reclamam */ }
});
elFunil.addEventListener('dragend', () => {
  arrastando = null;
  elFunil.querySelectorAll('.voando,.alvo').forEach(x => x.classList.remove('voando', 'alvo'));
});
elFunil.addEventListener('dragover', e => {
  const col = e.target.closest('.coluna'); if (!col || !arrastando) return;
  e.preventDefault(); e.dataTransfer.dropEffect = 'move';
  elFunil.querySelectorAll('.alvo').forEach(x => x !== col && x.classList.remove('alvo'));
  col.classList.add('alvo');
});
elFunil.addEventListener('drop', e => {
  const col = e.target.closest('.coluna'); if (!col || !arrastando) return;
  e.preventDefault();
  const id = arrastando; arrastando = null;
  col.classList.remove('alvo');
  moverLead(id, col.dataset.etapa);
});

['#fBusca', '#fTemp', '#fOrigem'].forEach(s => $(s).addEventListener('input', renderFunil));
$('#fLimpar').addEventListener('click', () => { $('#fBusca').value = $('#fTemp').value = $('#fOrigem').value = ''; renderFunil(); });

/* ===========================================================
   MODAL DO LEAD
   =========================================================== */
const mLead = $('#mLead'), fLead = $('#fLead');
let leadAberto = null; // id, ou '' para lead novo

function opcoesTipos(sel) {
  sel.innerHTML = Object.entries(precos.tipos).map(([k, t]) => `<option value="${k}">${esc(t.nome)}</option>`).join('');
}

function abrirLead(id) {
  const l = id ? leads.find(x => x.id === id) : null;
  leadAberto = l ? l.id : '';
  opcoesTipos($('#lTipo'));
  // "Perdido" só entra pelo botão próprio, que pede o motivo
  $('#lEtapa').innerHTML = ETAPAS.filter(e => e.id !== 'perdido' || (l && l.etapa === 'perdido'))
    .map(e => `<option value="${e.id}">${e.nome}</option>`).join('');
  const v = l || { nome: '', empresa: '', tel: '', email: '', origem: 'site', temp: 'morno', tipo: 'site', valor: '', detalhe: '',
    passo: 'Fazer o primeiro contato', passoData: NT.hojeISO(1), etapa: 'novo' };
  ['nome', 'empresa', 'tel', 'email', 'origem', 'temp', 'tipo', 'valor', 'detalhe', 'passo', 'passoData', 'etapa']
    .forEach(c => { fLead.elements[c].value = v[c] == null ? '' : v[c]; });
  if (!l) fLead.elements.valor.value = precos.tipos.site.preco;
  $('#mLeadTit').textContent = l ? nomeLead(l) : 'Novo lead';
  $('#lNota').value = '';
  $('#lHist').hidden = !l;
  ['#lExcluir', '#lGerar'].forEach(s => { $(s).hidden = !l; });
  $('#lPerder').hidden = !l || l.etapa === 'perdido';
  const info = $('#lPerdidoInfo');
  info.hidden = !(l && l.etapa === 'perdido');
  if (l && l.etapa === 'perdido') info.textContent = 'Perdido: ' + (l.motivo || '—') + (l.motivoDet ? ' — ' + l.motivoDet : '');
  if (l) renderHistorico(l);
  NT.modal(mLead, true);
}

function renderHistorico(l) {
  $('#lHistLista').innerHTML = (l.notas || []).map(n =>
    `<li><time datetime="${n.quando}">${NT.data(n.quando.slice(0, 10))} · ${n.quando.slice(11, 16)}</time><p>${esc(n.texto)}</p></li>`).join('') ||
    '<li class="dim">Nenhuma interação registrada ainda.</li>';
  const ps = propostas.filter(p => p.leadId === l.id);
  $('#lProps').innerHTML = ps.length ? `<h4>Propostas</h4><ul class="lead-props">${ps.map(p =>
    `<li><span class="mono">${p.numero}</span><span>${esc(p.tipoNome)}</span><b>${brl0(p.total)}</b><span class="badge ${STATUS[p.status][1]}">${STATUS[p.status][0]}</span></li>`).join('')}</ul>` : '';
}

function lerLead() {
  const g = c => fLead.elements[c].value.trim();
  return { nome: g('nome'), empresa: g('empresa'), tel: g('tel'), email: g('email'), origem: g('origem'), temp: g('temp'),
    tipo: g('tipo'), valor: Math.min(99999999, Math.max(0, Number(g('valor')) || 0)), detalhe: g('detalhe'), passo: g('passo'), passoData: g('passoData'), etapa: g('etapa') };
}

$('#lSalvar').addEventListener('click', () => {
  const d = lerLead();
  if (!d.nome && !d.empresa) { NT.aviso('Informe pelo menos o nome do contato ou a empresa.'); fLead.elements.nome.focus(); return; }
  if (!d.nome) d.nome = d.empresa;
  if (leadAberto) {
    const l = leads.find(x => x.id === leadAberto);
    const etapaNova = d.etapa; delete d.etapa;
    Object.assign(l, d);
    salvarLeads();
    if (etapaNova !== l.etapa) moverLead(l.id, etapaNova, true);
    NT.aviso('Lead atualizado.');
  } else {
    const l = Object.assign({ id: NT.id(), criado: NT.hojeISO(), notas: [] }, d);
    if (l.etapa === 'fechado') l.fechado = NT.hojeISO();
    nota(l, 'Lead cadastrado (origem: ' + (ORIGENS[l.origem] || '—') + ').');
    leads.push(l);
    salvarLeads();
    NT.aviso(nomeLead(l) + ' entrou no funil.');
  }
  NT.modal(mLead, false); tudo();
});

$('#lAddNota').addEventListener('click', () => {
  const l = leads.find(x => x.id === leadAberto), t = $('#lNota').value.trim();
  if (!l) return;
  if (!t) { NT.aviso('Escreva a anotação antes de adicionar.'); $('#lNota').focus(); return; }
  nota(l, t); salvarLeads(); renderHistorico(l);
  $('#lNota').value = ''; NT.aviso('Anotação registrada.');
});

$('#lExcluir').addEventListener('click', () => {
  const l = leads.find(x => x.id === leadAberto); if (!l) return;
  if (!confirm('Excluir o lead ' + nomeLead(l) + '? O histórico some junto. As propostas salvas continuam na lista.')) return;
  leads = leads.filter(x => x !== l);
  if (form.leadId === l.id) { form.leadId = ''; salvarForm(); }
  salvarLeads(); NT.modal(mLead, false); tudo(); NT.aviso('Lead excluído.');
});

$('#lPerder').addEventListener('click', () => { const id = leadAberto; NT.modal(mLead, false); abrirPerdido(id); });

$('#lGerar').addEventListener('click', () => {
  const l = leads.find(x => x.id === leadAberto); if (!l) return;
  NT.modal(mLead, false);
  carregarLeadNoForm(l, true);
  irPara('propostas');
});

/* ---------- perdido com motivo ---------- */
const mPerdido = $('#mPerdido');
let perdendo = null;
$('#perdMotivo').innerHTML = MOTIVOS.map(m => `<option>${m}</option>`).join('');
function abrirPerdido(id, motivo) {
  const l = leads.find(x => x.id === id); if (!l) return;
  perdendo = id;
  $('#mPerdQuem').textContent = l.nome + ' · ' + (l.empresa || '') + ' — ' + brl0(l.valor);
  $('#perdMotivo').value = motivo || MOTIVOS[0];
  $('#perdDet').value = '';
  NT.modal(mPerdido, true);
}
$('#perdOk').addEventListener('click', () => {
  const l = leads.find(x => x.id === perdendo); if (!l) return;
  const m = $('#perdMotivo').value, det = $('#perdDet').value.trim();
  if (l.etapa !== 'perdido') l.etapaAntes = l.etapa;
  l.etapa = 'perdido'; l.motivo = m; l.motivoDet = det;
  nota(l, 'Marcado como perdido: ' + m + (det ? ' — ' + det : '') + '.');
  salvarLeads(); NT.modal(mPerdido, false); tudo();
  NT.aviso(nomeLead(l) + ' marcado como perdido.');
});

/* fecha qualquer modal pelos botões "Cancelar" / ✕ */
document.querySelectorAll('[data-fechar]').forEach(b => b.addEventListener('click', () => NT.modal(b.closest('.modal-fundo'), false)));

$('#bNovoLead').addEventListener('click', () => abrirLead(''));

/* ===========================================================
   GERADOR DE PROPOSTAS
   =========================================================== */
const fProp = $('#fProp');

function renderGerador() {
  // lead do funil: abertos primeiro, perdidos não entram
  const grupos = ETAPAS.filter(e => e.id !== 'perdido').map(e => {
    const ls = leads.filter(l => l.etapa === e.id);
    return ls.length ? `<optgroup label="${e.nome}">${ls.map(l => `<option value="${l.id}">${esc(nomeLead(l))} — ${esc(l.nome)}</option>`).join('')}</optgroup>` : '';
  }).join('');
  $('#pLead').innerHTML = '<option value="">Outro cliente (digitar abaixo)</option>' + grupos;
  $('#pTipos').innerHTML = Object.entries(precos.tipos).map(([k, t]) =>
    `<label class="opcao"><input type="radio" class="sr" name="tipo" value="${k}"><span class="opcao-corpo"><b>${esc(t.nome)}</b><small>a partir de ${brl0(t.preco)}</small><small class="dim">${t.semanas} semana${t.semanas == 1 ? '' : 's'}</small></span></label>`).join('');
  $('#pAddons').innerHTML = Object.entries(precos.addons).map(([k, a]) =>
    `<label class="check-linha addon"><input type="checkbox" name="addon" value="${k}"><span>${esc(a.nome)}${a.semanas ? ` <small class="dim">+${a.semanas} sem.</small>` : ''}</span><b>${brl0(a.preco)}${a.mensal ? '<small>/mês</small>' : ''}</b></label>`).join('');
  $('#pComplex').innerHTML = Object.entries(precos.complex).map(([k, c]) =>
    `<label class="opcao"><input type="radio" class="sr" name="complex" value="${k}"><span class="opcao-corpo"><b>${esc(c.nome)}</b><small>preço ${multTxt(c.mult)} · prazo ${multTxt(c.prazo)}</small></span></label>`).join('');
  $('#pUrgTxt').innerHTML = `Entrega urgente <small class="dim">(+${precos.urgencia}% no valor, prazo ${precos.urgPrazo}% menor)</small>`;
  $('#pAvistaTxt').textContent = 'Pix ou boleto, ' + precos.descAvista + '% de desconto';
  $('#pParcTxt').textContent = 'Em até ' + precos.maxParcelas + 'x sem juros';
  $('#pParcelas').innerHTML = Array.from({ length: precos.maxParcelas }, (_, i) => `<option value="${i + 1}">${i + 1}x</option>`).join('');
  $('#pDesconto').max = precos.descMax;
  preencherForm();
}

// joga o estado do rascunho nos campos (sem recriar o HTML, para não perder o foco)
function preencherForm() {
  if (form.leadId && !leads.some(l => l.id === form.leadId)) form.leadId = '';
  if (!precos.tipos[form.tipo]) form.tipo = Object.keys(precos.tipos)[0];
  if (!precos.complex[form.complex]) form.complex = 'medio';
  form.parcelas = clamp(form.parcelas, 1, precos.maxParcelas);
  const el = fProp.elements;
  el.leadId.value = form.leadId;
  el.empresa.value = form.empresa; el.cliente.value = form.cliente; el.descricao.value = form.descricao;
  fProp.querySelectorAll('[name=tipo]').forEach(r => { r.checked = r.value === form.tipo; });
  fProp.querySelectorAll('[name=complex]').forEach(r => { r.checked = r.value === form.complex; });
  fProp.querySelectorAll('[name=pagamento]').forEach(r => { r.checked = r.value === form.pagamento; });
  fProp.querySelectorAll('[name=addon]').forEach(c => { c.checked = !!form.addons[c.value]; });
  el.urgente.checked = !!form.urgente;
  el.desconto.value = form.desconto || 0;
  el.parcelas.value = form.parcelas;
  el.parcelas.disabled = form.pagamento === 'avista';
  const ed = propostas.find(p => p.id === form.editando);
  if (!ed) form.editando = '';
  $('#editando').hidden = !ed;
  if (ed) $('#editando').innerHTML = `Editando a proposta <b class="mono">${ed.numero}</b>. Salvar atualiza esta mesma proposta. <button type="button" class="btn mini ghost" id="bSoltar">Salvar como nova</button>`;
  renderTipoInclui();
  atualizarPreview();
}

function renderTipoInclui() {
  const t = precos.tipos[form.tipo];
  $('#pInclui').innerHTML = `<span class="rot">Incluso em ${esc(t.nome)}</span><ul>${t.itens.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`;
}

function carregarLeadNoForm(l, tudoDoLead) {
  form.leadId = l.id; form.empresa = l.empresa || l.nome; form.cliente = l.nome;
  if (tudoDoLead || !form.descricao) {
    if (precos.tipos[l.tipo]) form.tipo = l.tipo;
    form.descricao = objetivoPadrao(precos.tipos[form.tipo].nome, form.empresa, l.detalhe);
  }
  form.editando = '';
  salvarForm(); preencherForm();
}

fProp.addEventListener('input', e => {
  const t = e.target, el = fProp.elements;
  if (t.name === 'leadId') {
    const l = leads.find(x => x.id === t.value);
    if (l) { carregarLeadNoForm(l, true); NT.aviso('Dados de ' + nomeLead(l) + ' carregados.'); return; }
    form.leadId = '';
  }
  if (['empresa', 'cliente', 'descricao'].includes(t.name)) form[t.name] = t.value;
  if (t.name === 'tipo') {
    // troca a frase de objetivo só se ela ainda é a gerada automaticamente
    const antigo = objetivoPadrao(precos.tipos[form.tipo].nome, form.empresa, '');
    if (!form.descricao || form.descricao.startsWith(antigo.slice(0, -1))) {
      const l = leads.find(x => x.id === form.leadId);
      form.descricao = objetivoPadrao(precos.tipos[t.value].nome, form.empresa, l && l.tipo === t.value ? l.detalhe : '');
      el.descricao.value = form.descricao;
    }
    form.tipo = t.value; renderTipoInclui();
  }
  if (t.name === 'complex') form.complex = t.value;
  if (t.name === 'addon') form.addons[t.value] = t.checked;
  if (t.name === 'urgente') form.urgente = t.checked;
  if (t.name === 'desconto') form.desconto = clamp(t.value, 0, precos.descMax);
  if (t.name === 'parcelas') form.parcelas = +t.value;
  if (t.name === 'pagamento') { form.pagamento = t.value; el.parcelas.disabled = t.value === 'avista'; if (t.value === 'parcelado' && form.parcelas < 2) { form.parcelas = 6; el.parcelas.value = 6; } }
  salvarForm(); atualizarPreview();
});
// desconto acima do teto volta para o teto quando sai do campo
fProp.elements.desconto.addEventListener('change', e => {
  if (Number(e.target.value) > precos.descMax) NT.aviso('Desconto máximo permitido: ' + precos.descMax + '%.');
  e.target.value = form.desconto;
});
fProp.addEventListener('submit', e => e.preventDefault());
fProp.addEventListener('click', e => {
  if (e.target.id === 'bSoltar') { form.editando = ''; salvarForm(); preencherForm(); NT.aviso('Ao salvar, esta proposta ganha um número novo.'); }
});

/* ---------- resumo ao vivo ---------- */
function numeroAtual() {
  const ed = propostas.find(p => p.id === form.editando);
  return ed ? ed.numero : 'NT-' + new Date().getFullYear() + '-' + String(seq + 1).padStart(3, '0');
}

function atualizarPreview() {
  const c = calcular(form);
  const linha = (n, v, cls = '') => `<div class="r-linha ${cls}"><span>${n}</span><b>${v}</b></div>`;
  let h = c.itens.map(i => linha(esc(i.nome), brl(i.valor))).join('');
  h += linha('Subtotal', brl(c.subtotal), 'sub');
  if (c.urg) h += linha('Taxa de urgência (+' + precos.urgencia + '%)', '+ ' + brl(c.urg), 'mais');
  if (c.desc) h += linha('Desconto negociado (' + c.descPct + '%)', '− ' + brl(c.desc), 'menos');
  if (c.avista) h += linha('Desconto à vista (' + precos.descAvista + '%)', '− ' + brl(c.avista), 'menos');
  h += `<div class="r-total"><span>Total</span><b>${brl(c.total)}</b></div>`;
  h += `<div class="r-cond">${c.parcelas > 1 ? `<b>${c.parcelas}x de ${brl(c.parcela)}</b> sem juros` : '<b>À vista</b> via Pix ou boleto'}</div>`;
  if (c.mensal) h += `<div class="r-cond">+ ${c.mensais.map(a => esc(a.nome.toLowerCase())).join(', ')}: <b>${brl(c.mensal)}/mês</b> após a entrega</div>`;
  h += `<div class="r-prazo"><span>Prazo estimado</span><b>${c.semanas} semana${c.semanas > 1 ? 's' : ''}</b><small>entrega prevista até ${NT.data(somaDiasISO(NT.hojeISO(), c.semanas * 7))}</small></div>`;
  $('#resumoCorpo').innerHTML = h;
  $('#doc').innerHTML = docHTML(form, c, numeroAtual(), NT.hojeISO());
}

/* ---------- documento da proposta ---------- */
function condicoes(c) {
  if (c.parcelas === 1) return 'Pagamento à vista via Pix ou boleto, com ' + precos.descAvista + '% de desconto já aplicado, na assinatura do contrato.';
  return 'Em ' + c.parcelas + ' parcelas mensais de ' + brl(c.parcela) + ' sem juros, no boleto ou cartão de crédito. A primeira vence na assinatura do contrato.';
}
const NOTAS_FIXAS = ['Início em até 5 dias úteis após a assinatura e o recebimento dos acessos e materiais.',
  'Duas rodadas de ajustes por etapa estão incluídas; mudanças de escopo são orçadas à parte.',
  '30 dias de garantia para correções após a entrega.'];

function docHTML(f, c, numero, dataISO) {
  const val = somaDiasISO(dataISO, precos.validade);
  const empresa = f.empresa || 'Cliente';
  const desc = f.descricao || objetivoPadrao(c.t.nome, f.empresa, '');
  const lin = (n, v, cls = '') => `<tr class="${cls}"><td>${n}</td><td>${v}</td></tr>`;
  let inv = c.itens.map(i => lin(esc(i.nome), brl(i.valor))).join('');
  if (c.urg || c.desc || c.avista) inv += lin('Subtotal', brl(c.subtotal), 'sub');
  if (c.urg) inv += lin('Taxa de urgência (+' + precos.urgencia + '%)', '+ ' + brl(c.urg));
  if (c.desc) inv += lin('Desconto negociado (' + c.descPct + '%)', '− ' + brl(c.desc));
  if (c.avista) inv += lin('Desconto para pagamento à vista (' + precos.descAvista + '%)', '− ' + brl(c.avista));
  inv += lin('Investimento total', brl(c.total), 'tot');
  return `<header class="doc-topo">
      <img src="../../assets/nassatech-logo-transparente.png" alt="Nassa Tech">
      <div class="doc-num"><b>Proposta comercial</b><span>Nº ${numero}</span><span>São Paulo, ${dataLonga(dataISO)}</span></div>
    </header>
    <div class="doc-corpo">
      <div class="doc-para"><span>Para</span><b>${esc(empresa)}</b>${f.cliente ? `<span>A/C ${esc(f.cliente)}</span>` : ''}</div>
      <h2>1. Objetivo</h2><p>${esc(desc)}</p>
      <h2>2. Escopo</h2>
      <h3>${esc(c.t.nome)} <small>· nível ${esc(c.cx.nome.toLowerCase())}</small></h3>
      <ul>${c.t.itens.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
      ${c.extras.length || c.mensais.length ? `<h3>Adicionais</h3><ul>${c.extras.concat(c.mensais).map(a => `<li>${esc(a.nome)}</li>`).join('')}</ul>` : ''}
      <h2>3. Investimento</h2>
      <table class="doc-inv">${inv}</table>
      ${c.mensal ? `<p class="doc-obs">Recorrente após a entrega: ${c.mensais.map(a => esc(a.nome.toLowerCase())).join(', ')} por <b>${brl(c.mensal)}/mês</b>, sem fidelidade.</p>` : ''}
      <h2>4. Prazo</h2>
      <p>Prazo estimado de <b>${c.semanas} semana${c.semanas > 1 ? 's' : ''}</b>${f.urgente ? ' (entrega urgente, com equipe dedicada)' : ''} a partir da aprovação, com entrega prevista até <b>${NT.data(somaDiasISO(dataISO, c.semanas * 7))}</b>.</p>
      <h2>5. Condições</h2>
      <ul><li>${condicoes(c)}</li>${NOTAS_FIXAS.map(n => `<li>${n}</li>`).join('')}</ul>
      <h2>6. Validade</h2>
      <p>Esta proposta é válida por ${precos.validade} dias, até <b>${NT.data(val)}</b>.</p>
      <div class="doc-assina">
        <div><span class="ass-linha"></span><b>Duda</b><span>Comercial &amp; Propostas · Nassa Tech</span><span>comercial@nassatech.com.br</span></div>
        <div><span class="ass-linha"></span><b>De acordo</b><span>${esc(f.cliente || 'Responsável')} · ${esc(empresa)}</span><span>Data: ____/____/______</span></div>
      </div>
    </div>
    <footer class="doc-rodape">Nassa Tech · Torre B32, Av. Brigadeiro Faria Lima, São Paulo – SP · nassatech.com.br</footer>`;
}

function docTexto(f, c, numero, dataISO) {
  const empresa = f.empresa || 'Cliente';
  const L = [];
  const pontilhado = (n, v) => { const p = Math.max(3, 58 - n.length - v.length); return n + ' ' + '.'.repeat(p) + ' ' + v; };
  L.push('PROPOSTA COMERCIAL Nº ' + numero, 'Nassa Tech · São Paulo, ' + dataLonga(dataISO), '',
    'Para: ' + empresa + (f.cliente ? ' — A/C ' + f.cliente : ''), '',
    '1. OBJETIVO', f.descricao || objetivoPadrao(c.t.nome, f.empresa, ''), '',
    '2. ESCOPO', c.t.nome + ' (nível ' + c.cx.nome.toLowerCase() + ')');
  c.t.itens.forEach(i => L.push('• ' + i));
  if (c.extras.length || c.mensais.length) { L.push('Adicionais:'); c.extras.concat(c.mensais).forEach(a => L.push('• ' + a.nome)); }
  L.push('', '3. INVESTIMENTO');
  c.itens.forEach(i => L.push(pontilhado(i.nome, brl(i.valor))));
  if (c.urg) L.push(pontilhado('Taxa de urgência (+' + precos.urgencia + '%)', '+ ' + brl(c.urg)));
  if (c.desc) L.push(pontilhado('Desconto negociado (' + c.descPct + '%)', '- ' + brl(c.desc)));
  if (c.avista) L.push(pontilhado('Desconto à vista (' + precos.descAvista + '%)', '- ' + brl(c.avista)));
  L.push(pontilhado('INVESTIMENTO TOTAL', brl(c.total)));
  if (c.mensal) L.push('Recorrente após a entrega: ' + brl(c.mensal) + '/mês (' + c.mensais.map(a => a.nome.toLowerCase()).join(', ') + ').');
  L.push('', '4. PRAZO', 'Cerca de ' + c.semanas + ' semana' + (c.semanas > 1 ? 's' : '') + ' após a aprovação — entrega prevista até ' + NT.data(somaDiasISO(dataISO, c.semanas * 7)) + '.',
    '', '5. CONDIÇÕES', '• ' + condicoes(c));
  NOTAS_FIXAS.forEach(n => L.push('• ' + n));
  L.push('', '6. VALIDADE', 'Válida por ' + precos.validade + ' dias, até ' + NT.data(somaDiasISO(dataISO, precos.validade)) + '.',
    '', 'Duda', 'Comercial & Propostas · Nassa Tech', 'comercial@nassatech.com.br · https://nassatech.com.br/');
  return L.join('\n');
}

$('#bCopiar').addEventListener('click', () => NT.copiar(docTexto(form, calcular(form), numeroAtual(), NT.hojeISO())));
$('#bImprimir').addEventListener('click', () => {
  if (!form.empresa.trim()) NT.aviso('Dica: preencha o cliente antes de imprimir.');
  window.print();
});
$('#bLimparProp').addEventListener('click', () => {
  form = formPadrao(); salvarForm(); preencherForm();
  fProp.elements.leadId.focus();
  NT.aviso('Proposta em branco.');
});

/* ---------- salvar proposta ---------- */
const mSalvar = $('#mSalvar');
$('#svStatus').innerHTML = Object.entries(STATUS).map(([k, s]) => `<option value="${k}">${s[0]}</option>`).join('');

function textoOpcaoLead() {
  const l = leads.find(x => x.id === form.leadId), st = $('#svStatus').value;
  const linha = $('#svLeadLinha'), cb = $('#svLead');
  if (l) {
    const podeAvancar = ['novo', 'contato'].includes(l.etapa);
    linha.hidden = !podeAvancar && l.etapa !== 'proposta';
    $('#svLeadTxt').innerHTML = podeAvancar
      ? `Mover <b>${esc(nomeLead(l))}</b> para <b>Proposta enviada</b> e atualizar o valor estimado`
      : `Atualizar o valor estimado de <b>${esc(nomeLead(l))}</b> no funil`;
    cb.checked = st !== 'rascunho';
  } else {
    linha.hidden = !form.empresa.trim();
    $('#svLeadTxt').innerHTML = `Cadastrar <b>${esc(form.empresa || 'o cliente')}</b> no funil, na etapa <b>${st === 'rascunho' ? 'Novo lead' : 'Proposta enviada'}</b>`;
    cb.checked = true;
  }
}
$('#svStatus').addEventListener('input', textoOpcaoLead);

$('#bSalvarProp').addEventListener('click', () => {
  if (!form.empresa.trim()) { NT.aviso('Informe o cliente da proposta.'); fProp.elements.empresa.focus(); return; }
  const c = calcular(form), ed = propostas.find(p => p.id === form.editando);
  $('#mSalvTit').textContent = ed ? 'Atualizar proposta ' + ed.numero : 'Salvar proposta ' + numeroAtual();
  $('#mSalvResumo').innerHTML = `<b>${esc(form.empresa)}</b><span>${esc(c.t.nome)} · ${c.semanas} semanas</span><strong>${brl(c.total)}</strong>`;
  $('#svStatus').value = ed ? ed.status : 'enviada';
  textoOpcaoLead();
  NT.modal(mSalvar, true);
});

$('#svOk').addEventListener('click', () => {
  const c = calcular(form), st = $('#svStatus').value, mexeLead = $('#svLead').checked && !$('#svLeadLinha').hidden;
  let p = propostas.find(x => x.id === form.editando);
  if (p) {
    Object.assign(p, montarProposta(form, c, p.numero, p.criada, st), { id: p.id });
  } else {
    seq += 1; db.gravar('seq', seq);
    p = montarProposta(form, c, numeroAtual().replace(/\d+$/, String(seq).padStart(3, '0')), NT.hojeISO(), st);
    propostas.unshift(p);
  }
  // amarra a proposta ao funil: cria o lead ou empurra para "Proposta enviada"
  let l = leads.find(x => x.id === form.leadId);
  if (mexeLead) {
    if (!l) {
      l = { id: NT.id(), nome: form.cliente || form.empresa, empresa: form.empresa, tel: '', email: '', origem: 'site', tipo: form.tipo,
        detalhe: '', valor: 0, temp: 'morno', etapa: st === 'rascunho' ? 'novo' : 'proposta', passo: 'Cobrar retorno da proposta',
        passoData: NT.hojeISO(3), criado: NT.hojeISO(), notas: [] };
      nota(l, 'Lead cadastrado a partir da proposta ' + p.numero + '.');
      leads.push(l); form.leadId = l.id; p.leadId = l.id; p.form.leadId = l.id;
    } else if (['novo', 'contato'].includes(l.etapa)) {
      nota(l, 'Etapa: ' + ETAPA[l.etapa].nome + ' → Proposta enviada.');
      l.etapa = 'proposta'; l.passo = 'Cobrar retorno da proposta'; l.passoData = NT.hojeISO(3);
    }
    l.valor = Math.round(c.total);
  }
  if (l) nota(l, 'Proposta ' + p.numero + ' salva como ' + STATUS[st][0].toLowerCase() + ' (' + brl(c.total) + ').');
  form.editando = p.id;
  salvarProps(); salvarLeads(); salvarForm();
  NT.modal(mSalvar, false); tudo();
  NT.aviso('Proposta ' + p.numero + ' salva' + (mexeLead && l ? ' e funil atualizado.' : '.'));
});

/* ===========================================================
   PROPOSTAS SALVAS
   =========================================================== */
$('#sStatus').innerHTML = '<option value="">Todos os status</option>' + Object.entries(STATUS).map(([k, s]) => `<option value="${k}">${s[0]}</option>`).join('');
$('#sStatus').addEventListener('input', renderSalvas);

function renderSalvas() {
  const f = $('#sStatus').value;
  const lista = propostas.filter(p => !f || p.status === f);
  const tab = $('#tSalvas');
  if (!lista.length) { tab.innerHTML = `<tbody><tr><td><div class="vazio">${propostas.length ? 'Nenhuma proposta com este status.' : 'Nenhuma proposta salva ainda. Monte uma na aba Nova proposta.'}</div></td></tr></tbody>`; return; }
  tab.innerHTML = `<thead><tr><th>Nº</th><th>Cliente</th><th>Projeto</th><th class="num">Total</th><th>Prazo</th><th>Criada</th><th>Status</th><th><span class="sr">Ações</span></th></tr></thead><tbody>` +
    lista.map(p => `<tr data-id="${p.id}">
      <td class="mono">${p.numero}</td>
      <td><b>${esc(p.empresa)}</b><div class="dim pequeno">${esc(p.cliente || '')}</div></td>
      <td>${esc(p.tipoNome)}</td>
      <td class="num"><b>${brl(p.total)}</b><div class="dim pequeno">${p.parcelas > 1 ? p.parcelas + 'x de ' + brl0(p.total / p.parcelas) : 'à vista'}</div></td>
      <td>${p.semanas} sem.</td>
      <td>${NT.data(p.criada)}</td>
      <td><label class="sr" for="st-${p.id}">Status de ${p.numero}</label><select class="campo status-sel st-${p.status}" id="st-${p.id}" data-st>${Object.entries(STATUS).map(([k, s]) => `<option value="${k}"${k === p.status ? ' selected' : ''}>${s[0]}</option>`).join('')}</select></td>
      <td class="acoes"><button type="button" class="btn mini" data-acao="abrir">Abrir</button><button type="button" class="btn mini ghost" data-acao="copiar">Copiar</button><button type="button" class="btn mini ghost danger" data-acao="excluir" aria-label="Excluir ${p.numero}">Excluir</button></td>
    </tr>`).join('') + '</tbody>';
}

$('#tSalvas').addEventListener('click', e => {
  const b = e.target.closest('[data-acao]'); if (!b) return;
  const p = propostas.find(x => x.id === b.closest('tr').dataset.id); if (!p) return;
  if (b.dataset.acao === 'abrir') {
    form = Object.assign(formPadrao(), copia(p.form), { editando: p.id });
    salvarForm(); preencherForm(); irPara('propostas');
    if (Math.abs(calcular(form).total - p.total) > 0.01) NT.aviso('A tabela de preços mudou: os valores foram recalculados.');
  } else if (b.dataset.acao === 'copiar') {
    NT.copiar(docTexto(p.form, calcular(p.form), p.numero, p.criada));
  } else if (b.dataset.acao === 'excluir') {
    if (!confirm('Excluir a proposta ' + p.numero + ' de ' + p.empresa + '?')) return;
    propostas = propostas.filter(x => x !== p);
    if (form.editando === p.id) { form.editando = ''; salvarForm(); }
    salvarProps(); tudo(); NT.aviso('Proposta ' + p.numero + ' excluída.');
  }
});

$('#tSalvas').addEventListener('change', e => {
  if (!e.target.matches('[data-st]')) return;
  const p = propostas.find(x => x.id === e.target.closest('tr').dataset.id); if (!p) return;
  const st = e.target.value; p.status = st; salvarProps();
  const l = leads.find(x => x.id === p.leadId);
  if (l) nota(l, 'Proposta ' + p.numero + ' marcada como ' + STATUS[st][0].toLowerCase() + '.');
  salvarLeads(); tudo();
  NT.aviso('Proposta ' + p.numero + ': ' + STATUS[st][0].toLowerCase() + '.');
  // o status da proposta costuma decidir a etapa do lead; pergunta antes de mexer
  if (!l) return;
  if (st === 'aceita' && l.etapa !== 'fechado' && confirm('Proposta aceita! Mover ' + nomeLead(l) + ' para Fechado no funil?')) { l.valor = Math.round(p.total); moverLead(l.id, 'fechado'); }
  else if (st === 'enviada' && ['novo', 'contato'].includes(l.etapa) && confirm('Mover ' + nomeLead(l) + ' para Proposta enviada?')) moverLead(l.id, 'proposta');
  else if (st === 'recusada' && ABERTAS.includes(l.etapa) && confirm('Proposta recusada. Marcar ' + nomeLead(l) + ' como perdido?')) abrirPerdido(l.id, 'Preço acima do orçamento');
});

/* ===========================================================
   CONFIGURAÇÕES — tabela de preços
   =========================================================== */
function renderConfig() {
  const n = (path, v, extra = '') => `<input class="campo" type="number" data-cfg="${path}" value="${v}" ${extra}>`;
  $('#cfgTipos').innerHTML = Object.entries(precos.tipos).map(([k, t]) => `<div class="cfg-tipo">
      <div><label class="rot" for="cfg-${k}-nome">Nome</label><input class="campo" id="cfg-${k}-nome" data-cfg="tipos.${k}.nome" value="${esc(t.nome)}"></div>
      <div class="par">
        <div><label class="rot" for="cfg-${k}-preco">Preço base (R$)</label>${n('tipos.' + k + '.preco', t.preco, `id="cfg-${k}-preco" min="0" step="100"`)}</div>
        <div><label class="rot" for="cfg-${k}-sem">Semanas</label>${n('tipos.' + k + '.semanas', t.semanas, `id="cfg-${k}-sem" min="1" step="1"`)}</div>
      </div>
      <div><label class="rot" for="cfg-${k}-itens">Itens inclusos (um por linha)</label><textarea class="campo" rows="5" id="cfg-${k}-itens" data-cfg="tipos.${k}.itens">${esc(t.itens.join('\n'))}</textarea></div>
    </div>`).join('');
  $('#cfgAddons').innerHTML = '<thead><tr><th>Adicional</th><th>Preço (R$)</th><th>+ Semanas</th></tr></thead><tbody>' +
    Object.entries(precos.addons).map(([k, a]) => `<tr><td><label class="sr" for="cfg-a-${k}">Nome do adicional</label><input class="campo" id="cfg-a-${k}" data-cfg="addons.${k}.nome" value="${esc(a.nome)}">${a.mensal ? '<small class="dim">cobrado por mês</small>' : ''}</td>
      <td><label class="sr" for="cfg-a-${k}-p">Preço de ${esc(a.nome)}</label>${n('addons.' + k + '.preco', a.preco, `id="cfg-a-${k}-p" min="0" step="10"`)}</td>
      <td><label class="sr" for="cfg-a-${k}-s">Semanas extras de ${esc(a.nome)}</label>${n('addons.' + k + '.semanas', a.semanas, `id="cfg-a-${k}-s" min="0" step="0.5"`)}</td></tr>`).join('') + '</tbody>';
  $('#cfgComplex').innerHTML = '<thead><tr><th>Complexidade</th><th>× Preço</th><th>× Prazo</th></tr></thead><tbody>' +
    Object.entries(precos.complex).map(([k, c]) => `<tr><td>${esc(c.nome)}</td>
      <td><label class="sr" for="cfg-c-${k}-m">Multiplicador de preço ${esc(c.nome)}</label>${n('complex.' + k + '.mult', c.mult, `id="cfg-c-${k}-m" min="0.5" step="0.05"`)}</td>
      <td><label class="sr" for="cfg-c-${k}-p">Multiplicador de prazo ${esc(c.nome)}</label>${n('complex.' + k + '.prazo', c.prazo, `id="cfg-c-${k}-p" min="0.5" step="0.05"`)}</td></tr>`).join('') + '</tbody>';
  const cond = [['urgencia', 'Taxa de urgência (%)', 'min="0" step="1"'], ['urgPrazo', 'Redução de prazo na urgência (%)', 'min="0" max="80" step="5"'],
    ['descAvista', 'Desconto à vista (%)', 'min="0" max="50" step="1"'], ['descMax', 'Desconto negociado máximo (%)', 'min="0" max="80" step="1"'],
    ['maxParcelas', 'Parcelas sem juros (máx.)', 'min="1" max="24" step="1"'], ['validade', 'Validade da proposta (dias)', 'min="1" step="1"']];
  $('#cfgCond').innerHTML = cond.map(([k, r, a]) => `<div><label class="rot" for="cfg-${k}">${r}</label>${n(k, precos[k], `id="cfg-${k}" ${a}`)}</div>`).join('');
}

// cada campo diz em data-cfg onde mora o valor dentro de "precos"
$('#pConfig').addEventListener('change', e => {
  const path = e.target.dataset.cfg; if (!path) return;
  const partes = path.split('.'), chave = partes.pop();
  const alvo = partes.reduce((o, k) => o[k], precos);
  let v = e.target.value;
  if (chave === 'itens') {
    v = v.split('\n').map(s => s.trim()).filter(Boolean);
    // proposta sem escopo não faz sentido: lista vazia volta ao que era
    if (!v.length) { e.target.value = alvo.itens.join('\n'); NT.aviso('Deixe pelo menos um item incluso.'); return; }
  }
  else if (chave === 'nome') { v = v.trim(); if (!v) { e.target.value = alvo.nome; NT.aviso('O nome não pode ficar vazio.'); return; } }
  else {
    v = Number(v);
    const min = e.target.min === '' ? 0 : Number(e.target.min), max = e.target.max === '' ? Infinity : Number(e.target.max);
    if (!isFinite(v) || e.target.value === '') { e.target.value = alvo[chave]; NT.aviso('Digite um número válido.'); return; }
    v = Math.min(max, Math.max(min, v));
    if (['maxParcelas', 'validade', 'semanas'].includes(chave) && partes[0] !== 'addons') v = Math.round(v) || 1;
    e.target.value = v;
  }
  alvo[chave] = v;
  salvarPrecos(); renderGerador(); renderFunil();
  $('#cfgSalvo').textContent = 'Tabela salva às ' + NT.hora().slice(0, 5) + '.';
});

$('#bPrecosPadrao').addEventListener('click', () => {
  if (!confirm('Voltar a tabela de preços para os valores padrão da Nassa Tech?')) return;
  precos = copia(PRECOS_PADRAO); salvarPrecos();
  renderConfig(); renderGerador(); renderFunil();
  NT.aviso('Tabela de preços restaurada.');
});

/* ===========================================================
   TOPO, ABAS E INICIALIZAÇÃO
   =========================================================== */
$('#bRestaurar').addEventListener('click', () => {
  if (!confirm('Restaurar os dados de exemplo? Leads, propostas e preços atuais serão substituídos.')) return;
  precos = db.gravar('precos', copia(PRECOS_PADRAO));
  const ex = exemplo();
  leads = db.gravar('leads', ex.leads); propostas = db.gravar('propostas', ex.propostas); seq = db.gravar('seq', ex.seq);
  form = formPadrao(); salvarForm();
  ['#fBusca', '#fTemp', '#fOrigem', '#sStatus'].forEach(s => { $(s).value = ''; });
  renderConfig(); renderGerador(); tudo();
  NT.aviso('Dados de exemplo restaurados.');
});

$('#bCsv').addEventListener('click', () => {
  const cel = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const cab = ['Nome', 'Empresa', 'Telefone', 'E-mail', 'Origem', 'Interesse', 'Detalhe', 'Valor estimado', 'Temperatura', 'Etapa', 'Próximo passo', 'Data do próximo passo', 'Motivo da perda', 'Criado em'];
  const linhas = leads.map(l => [l.nome, l.empresa, l.tel, l.email, ORIGENS[l.origem], (precos.tipos[l.tipo] || {}).nome, l.detalhe,
    String(l.valor).replace('.', ','), (TEMPS[l.temp] || [])[1], ETAPA[l.etapa].nome, l.passo, NT.data(l.passoData), l.motivo || '', NT.data(l.criado)].map(cel).join(';'));
  // BOM no começo para o Excel abrir os acentos certos
  NT.baixar('leads-nassatech-' + NT.hojeISO() + '.csv', '﻿' + [cab.map(cel).join(';')].concat(linhas).join('\r\n'), 'text/csv;charset=utf-8');
  NT.aviso('CSV com ' + leads.length + ' leads baixado.');
});

function irPara(aba) { const b = document.querySelector(`.aba[data-aba="${aba}"]`); if (b) b.click(); window.scrollTo(0, 0); }
NT.abas(document, aba => db.gravar('aba', aba));

function tudo() { renderKpis(); renderFunil(); renderGerador(); renderSalvas(); }

$('#fOrigem').innerHTML = '<option value="">Todas</option>' + Object.entries(ORIGENS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
$('#lOrigem').innerHTML = Object.entries(ORIGENS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
renderConfig(); tudo();
const abaSalva = db.ler('aba', 'funil'); if (abaSalva !== 'funil') irPara(abaSalva);
})();
