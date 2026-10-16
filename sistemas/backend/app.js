/* ===========================================================
   sistemas/backend/app.js — Console da API (Marina · Back-end)

   A API REST da Nassa Tech simulada no navegador. O roteador segue
   as mesmas regras de uma API Node de verdade (token, validação,
   paginação, códigos HTTP), o banco fica em NT.dados('backend') e
   os webhooks saem de uma fila salva junto, para não se perderem
   se a página recarregar antes de eles dispararem.
   =========================================================== */
(() => {
'use strict';

const D = NT.dados('backend');
const $ = s => document.querySelector(s);
const esc = NT.esc;
const HOST = 'https://api.nassatech.com.br';
const TOKEN_PADRAO = 'nt_demo_8f2c41a9e7b3';
const LIMITE = 60;              // requisições por minuto, igual ao limite de produção
const ATRASO_GATEWAY = 1500;    // o gateway leva ~1,5 s para aprovar ou recusar
const LIMITE_CARTAO = 15000;    // regra do gateway de teste: cartão acima disso é recusado
const COM_CORPO = ['POST', 'PUT', 'PATCH'];
const STATUS_TXT = {
  200: 'OK', 201: 'Criado', 204: 'Sem conteúdo', 400: 'Requisição inválida', 401: 'Não autorizado',
  404: 'Não encontrado', 405: 'Método não permitido', 409: 'Conflito', 415: 'Tipo não suportado',
  422: 'Dados inválidos', 429: 'Muitas requisições', 500: 'Erro interno'
};

const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const agoraISO = () => new Date().toISOString();
const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const cmp = (a, b) => (a == null) - (b == null) ||
  (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'pt-BR'));
const dec = s => { try { return decodeURIComponent(s); } catch (e) { return s; } };
const clone = v => JSON.parse(JSON.stringify(v));

/* ===========================================================
   ESQUEMA — os campos de cada recurso e o que vale em cada um
   =========================================================== */
const ESQ = {
  clientes: {
    nome: 'Cliente', artigo: 'o',
    campos: {
      nome: { tipo: 'texto', obrig: true, max: 80 },
      contato: { tipo: 'texto', max: 80 },
      email: { tipo: 'email', obrig: true },
      telefone: { tipo: 'telefone' },
      cidade: { tipo: 'texto', max: 60 },
      segmento: { tipo: 'texto', max: 40 }
    },
    filtros: ['cidade', 'segmento'], busca: ['nome', 'contato', 'email', 'cidade', 'segmento'],
    filhos: { projetos: 'cliente_id', mensagens: 'cliente_id' }
  },
  projetos: {
    nome: 'Projeto', artigo: 'o',
    campos: {
      cliente_id: { tipo: 'ref', ref: 'clientes', obrig: true },
      nome: { tipo: 'texto', obrig: true, max: 100 },
      tipo: { tipo: 'enum', valores: ['site', 'sistema', 'app', 'automacao', 'agente_ia'], obrig: true },
      valor: { tipo: 'dinheiro', obrig: true },
      status: { tipo: 'enum', valores: ['proposta', 'em_andamento', 'homologacao', 'entregue'], padrao: 'proposta' },
      prazo: { tipo: 'data' },
      responsavel: { tipo: 'texto', max: 40 }
    },
    filtros: ['cliente_id', 'status', 'tipo', 'responsavel'], busca: ['nome', 'responsavel'],
    filhos: { pagamentos: 'projeto_id' }
  },
  pagamentos: {
    nome: 'Pagamento', artigo: 'o',
    campos: {
      projeto_id: { tipo: 'ref', ref: 'projetos', obrig: true },
      valor: { tipo: 'dinheiro', obrig: true },
      metodo: { tipo: 'enum', valores: ['pix', 'boleto', 'cartao'], obrig: true },
      status: { tipo: 'enum', valores: ['pendente', 'aprovado', 'recusado'], padrao: 'pendente' },
      vencimento: { tipo: 'data' },
      descricao: { tipo: 'texto', max: 120 }
    },
    extras: { pago_em: null, motivo_recusa: null },          // quem preenche é o gateway
    filtros: ['projeto_id', 'cliente_id', 'status', 'metodo'], busca: ['descricao']
  },
  mensagens: {
    nome: 'Mensagem', artigo: 'a',
    campos: {
      cliente_id: { tipo: 'ref', ref: 'clientes' },
      para: { tipo: 'telefone' },
      texto: { tipo: 'texto', obrig: true, max: 1000 }
    },
    extras: { status: 'enviada' },                           // quem muda é o WhatsApp
    enumFiltro: { status: ['enviada', 'entregue', 'lida'] },
    filtros: ['cliente_id', 'status'], busca: ['texto', 'para'],
    metodosItem: ['GET', 'DELETE']
  }
};
const LEITURA = ['id', 'criado_em', 'atualizado_em'];

/* ===========================================================
   BANCO DE EXEMPLO — clientes de verdade do tipo que a Nassa atende
   =========================================================== */
function semente() {
  const iso = d => new Date(Date.now() + d * 864e5).toISOString();
  const dia = NT.hojeISO;
  const clientes = [
    ['Padaria Pão de Mel', 'Sônia Ribeiro', 'contato@paodemel.com.br', '+55 11 98765-4321', 'São Paulo', 'Alimentação', -210],
    ['Clínica Sorriso', 'Dr. Marcelo Tavares', 'atendimento@clinicasorriso.com.br', '+55 11 97654-3210', 'Santo André', 'Saúde', -150],
    ['Advocacia Duarte', 'Patrícia Duarte', 'patricia@duarteadvocacia.com.br', '+55 11 99123-4567', 'São Paulo', 'Jurídico', -120],
    ['Academia Força Total', 'Rodrigo Alves', 'rodrigo@forcatotal.com.br', '+55 11 98222-1133', 'Guarulhos', 'Fitness', -95],
    ['Imobiliária Horizonte', 'Carla Menezes', 'carla@horizonteimoveis.com.br', '+55 19 99876-5544', 'Campinas', 'Imobiliário', -80],
    ['Pet Shop Amigo Fiel', 'Juliana Costa', 'contato@amigofielpet.com.br', '+55 11 97777-2020', 'Osasco', 'Pet', -45],
    ['Auto Peças Ribeiro', 'Edson Ribeiro', 'vendas@autopecasribeiro.com.br', '+55 11 98111-4040', 'Jundiaí', 'Varejo', -30],
    ['Escola Pequeno Saber', 'Fernanda Lima', 'secretaria@pequenosaber.com.br', '+55 11 96543-8899', 'São Bernardo do Campo', 'Educação', -20]
  ].map(([nome, contato, email, telefone, cidade, segmento, d], i) =>
    ({ id: i + 1, nome, contato, email, telefone, cidade, segmento, criado_em: iso(d), atualizado_em: iso(d) }));

  const projetos = [
    [1, 'Cardápio digital com pedidos no WhatsApp', 'site', 4800, 'entregue', -40, 'Lucas', -100],
    [2, 'Agendamento online de consultas', 'sistema', 18500, 'em_andamento', 20, 'Marina', -35],
    [2, 'Agente de IA para confirmar consultas', 'agente_ia', 9200, 'proposta', 60, 'Nico', -4],
    [3, 'Portal do cliente com andamento dos processos', 'sistema', 26000, 'em_andamento', 35, 'Rafa', -45],
    [4, 'App de treinos com check-in na catraca', 'app', 32000, 'homologacao', 8, 'Bia', -60],
    [5, 'Site com busca de imóveis por bairro', 'site', 12500, 'entregue', -18, 'Lucas', -75],
    [5, 'Automação dos leads do portal para o CRM', 'automacao', 6400, 'em_andamento', 12, 'Nico', -14],
    [6, 'Loja virtual com agenda de banho e tosa', 'site', 9800, 'proposta', 50, 'Rafa', -6],
    [7, 'Catálogo de peças com consulta de estoque', 'sistema', 21000, 'em_andamento', 40, 'Marina', -10],
    [8, 'Comunicados aos pais pelo WhatsApp', 'automacao', 5600, 'homologacao', 5, 'Nico', -16]
  ].map(([cliente_id, nome, tipo, valor, status, prazo, responsavel, d], i) =>
    ({ id: i + 1, cliente_id, nome, tipo, valor, status, prazo: dia(prazo), responsavel,
       criado_em: iso(d), atualizado_em: iso(Math.min(d + 5, -1)) }));

  const pagamentos = [
    [1, 2400, 'pix', 'aprovado', -70, 'Entrada de 50%'],
    [1, 2400, 'pix', 'aprovado', -25, 'Parcela final'],
    [2, 9250, 'boleto', 'aprovado', -30, 'Entrada de 50%'],
    [2, 9250, 'boleto', 'pendente', 15, 'Parcela final na entrega'],
    [4, 13000, 'boleto', 'aprovado', -40, 'Entrada de 50%'],
    [4, 6500, 'cartao', 'recusado', -3, 'Parcela 2 de 3'],
    [4, 6500, 'pix', 'pendente', 2, 'Parcela 2 de 3 (nova cobrança no Pix)'],
    [5, 16000, 'pix', 'aprovado', -50, 'Entrada de 50%'],
    [5, 16000, 'boleto', 'pendente', 5, 'Saldo na aprovação da homologação'],
    [6, 12500, 'cartao', 'aprovado', -20, 'Pagamento à vista'],
    [7, 3200, 'pix', 'aprovado', -12, 'Entrada de 50%'],
    [9, 10500, 'boleto', 'aprovado', -8, 'Entrada de 50%']
  ].map(([projeto_id, valor, metodo, status, venc, descricao], i) => {
    const criado = iso(Math.min(venc, 0) - 6);
    const fechou = status === 'pendente' ? criado : iso(Math.min(venc, -1) + 0.3);
    return { id: i + 1, projeto_id, valor, metodo, status, vencimento: dia(venc), descricao,
      pago_em: status === 'aprovado' ? fechou : null,
      motivo_recusa: status === 'recusado' ? 'cartão sem limite disponível' : null,
      criado_em: criado, atualizado_em: fechou };
  });

  const mensagens = [
    [1, 'Oi, Sônia! O cardápio novo já está no ar e os pedidos caem direto no WhatsApp da padaria.', 'lida', -24],
    [2, 'Dr. Marcelo, a versão de testes do agendamento está pronta. Mandei o link e o acesso por e-mail.', 'lida', -6],
    [3, 'Patrícia, a parcela 2 voltou recusada no cartão. Gerei um Pix novo com vencimento para depois de amanhã.', 'entregue', -2.8],
    [4, 'Rodrigo, o app já está na loja de testes. É só instalar pelo convite que chegou no seu e-mail.', 'lida', -1.5],
    [5, 'Carla, a automação já está puxando os leads do portal. Amanhã te mostro o painel.', 'entregue', -0.6],
    [8, 'Fernanda, os comunicados de teste chegaram nos três números da coordenação?', 'entregue', -0.2]
  ].map(([cliente_id, texto, status, d], i) => ({ id: i + 1, cliente_id, para: clientes[cliente_id - 1].telefone,
    texto, status, criado_em: iso(d), atualizado_em: iso(d + 0.01) }));

  return { clientes, projetos, pagamentos, mensagens, seq: { clientes: 8, projetos: 10, pagamentos: 12, mensagens: 6 } };
}

/* ===========================================================
   ESTADO SALVO
   =========================================================== */
let banco, token, historico, webhooks, fila, est, ultima;

const salvarBanco = () => D.gravar('banco', banco);
const achar = (rec, id) => banco[rec].find(r => r.id === id);
const cabecalhosPadrao = () => `Authorization: Bearer ${token}\nAccept: application/json`;

function estHoje() {
  const hoje = NT.hojeISO();
  if (!est || est.dia !== hoje) { est = { dia: hoje, total: 0, erros: 0, somaMs: 0, webhooks: 0 }; D.gravar('stats', est); }
  return est;
}

// primeira visita (ou "voltar tudo"): banco de exemplo + algumas chamadas de verdade no histórico
function primeiraCarga() {
  banco = semente(); salvarBanco();
  fila = []; D.gravar('fila', fila);
  webhooks = webhooksIniciais(); D.gravar('webhooks', webhooks);
  historico = []; est = null; ultima = null; D.apagar('ultima');
  // os eventos de exemplo que caíram hoje já contam no número do topo
  estHoje().webhooks = webhooks.filter(w => new Date(w.em).toDateString() === new Date().toDateString()).length;
  const exemplos = [
    ['GET', '/api/v1/status'], ['GET', '/api/v1/clientes'], ['GET', '/api/v1/projetos?status=em_andamento'],
    ['GET', '/api/v1/clientes/3'], ['GET', '/api/v1/pagamentos/99'], ['GET', '/api/v1/pagamentos?status=pendente'],
    ['GET', '/api/v1/mensagens?cliente_id=2']
  ];
  const passo = 3.5 * 60000, t0 = Date.now() - exemplos.length * passo;
  exemplos.forEach(([metodo, caminho], i) => {
    const req = { metodo, caminho, cab: cabecalhosPadrao(), corpo: '' };
    registrar(req, executar(req), t0 + i * passo);
  });
}

function carregar() {
  token = D.ler('token', TOKEN_PADRAO);
  banco = D.ler('banco', null);
  if (!banco || !banco.seq || !Array.isArray(banco.clientes)) return primeiraCarga();
  historico = D.ler('historico', []);
  webhooks = D.ler('webhooks', []);
  fila = D.ler('fila', []);
  est = D.ler('stats', null);
  ultima = D.ler('ultima', null);
}

function registrar(req, r, quando = Date.now()) {
  const s = estHoje();
  s.total++; if (r.status >= 400) s.erros++; s.somaMs += r.ms;
  D.gravar('stats', s);
  historico.unshift({ id: NT.id(), metodo: req.metodo, caminho: req.caminho, cab: req.cab, corpo: req.corpo,
    status: r.status, ms: r.ms, em: new Date(quando).toISOString() });
  historico = historico.slice(0, 30);
  D.gravar('historico', historico);
}

/* ===========================================================
   ROTEADOR — recebe {metodo, caminho, cab, corpo} e devolve a resposta
   =========================================================== */
const falha = (status, erro, detalhe, extra, cab) =>
  ({ status, corpo: Object.assign({ status, erro, detalhe }, extra || {}), cab });
const naoAchado = (rec, id) => falha(404, 'Não encontrado',
  `${ESQ[rec].nome} ${id} não existe. Liste em GET /api/v1/${rec} para ver os ids.`);
const naoPermitido = (m, caminho, aceitos, motivo) => falha(405, 'Método não permitido',
  `${m} não vale para ${caminho}. Aceitos: ${aceitos.join(', ')}.${motivo ? ' ' + motivo : ''}`, null, { Allow: aceitos.join(', ') });

let chamadas = [];   // horários das últimas chamadas, para o limite por minuto

function executar(req) {
  const agora = Date.now();
  chamadas = chamadas.filter(t => agora - t < 60000);
  let r;
  if (chamadas.length >= LIMITE) {
    const espera = Math.max(1, Math.ceil((60000 - (agora - chamadas[0])) / 1000));
    r = falha(429, 'Muitas requisições', `O limite é ${LIMITE} por minuto. Tente de novo em ${espera} s.`, null, { 'Retry-After': String(espera) });
  } else {
    chamadas.push(agora);
    try { r = rotear(req); }
    catch (e) { r = falha(500, 'Erro interno', 'O servidor simulado falhou: ' + e.message); }
  }

  // latência de mentira, mas coerente: erro de auth é rápido, escrita custa mais que leitura
  const escrita = req.metodo !== 'GET' && r.status < 300;
  let ms = r.status === 401 || r.status === 429 ? rand(9, 26) : rand(38, 115) + (escrita ? rand(30, 85) : 0);
  if (r.corpo && Array.isArray(r.corpo.dados)) ms += r.corpo.dados.length * 2;

  const corpo = r.status === 204 ? null : r.corpo;
  const bytes = corpo === null ? 0 : new TextEncoder().encode(JSON.stringify(corpo)).length;
  const cab = {};
  if (corpo !== null) cab['Content-Type'] = 'application/json; charset=utf-8';
  cab['Content-Length'] = String(bytes);
  Object.assign(cab, {
    'Cache-Control': 'no-store',
    'X-Request-Id': 'req_' + NT.id(),
    'X-Response-Time': ms + 'ms',
    'X-RateLimit-Limit': String(LIMITE),
    'X-RateLimit-Remaining': String(Math.max(0, LIMITE - chamadas.length)),
    'Server': 'nassa-api/1.4 (Node 22)'
  }, r.cab || {});
  return { status: r.status, corpo, cab, ms, bytes, jobs: r.jobs || [] };
}

function lerCabecalhos(txt) {
  const lista = [], erros = [];
  String(txt || '').split('\n').forEach((l, i) => {
    const s = l.trim();
    if (!s || s.startsWith('#')) return;
    const p = s.indexOf(':');
    if (p < 1) { erros.push(i + 1); return; }
    lista.push([s.slice(0, p).trim(), s.slice(p + 1).trim()]);
  });
  return { lista, erros };
}

function rotear(req) {
  const { lista, erros } = lerCabecalhos(req.cab);
  if (erros.length) return falha(400, 'Cabeçalho mal formado', `A linha ${erros[0]} dos cabeçalhos não está no formato Nome: valor.`);
  const h = n => { const c = lista.find(([k]) => k.toLowerCase() === n); return c ? c[1] : null; };

  let url;
  try { url = new URL(req.caminho || '/', HOST); }
  catch (e) { return falha(400, 'Caminho inválido', 'Escreva o caminho assim: /api/v1/clientes.'); }
  // URL completa de outro host não pode responder como se fosse a nossa API
  if (url.host !== new URL(HOST).host)
    return falha(400, 'Host desconhecido', `Este console só fala com ${new URL(HOST).host}. Use só o caminho, como /api/v1/clientes.`);
  const caminho = dec(url.pathname);
  const partes = url.pathname.split('/').filter(Boolean).map(dec);
  const m = req.metodo;
  if (partes[0] !== 'api' || partes[1] !== 'v1')
    return falha(404, 'Rota não encontrada', `${caminho} não existe. As rotas começam com /api/v1, por exemplo /api/v1/clientes.`);
  const [, , recurso, idTxt, sub, ...resto] = partes;

  // status e índice ficam abertos, como num health check de verdade
  if (!recurso || recurso === 'status') {
    if (m !== 'GET') return naoPermitido(m, caminho, ['GET']);
    return { status: 200, corpo: recurso ? statusApi() : indiceApi() };
  }
  const negado = autenticar(h('authorization'));
  if (negado) return negado;

  // hasOwn: sem isso /api/v1/constructor achava o construtor do Object e estourava num 500
  const esq = Object.hasOwn(ESQ, recurso) ? ESQ[recurso] : null;
  if (!esq) return falha(404, 'Recurso não encontrado', `"${recurso}" não existe. Os recursos são: ${Object.keys(ESQ).join(', ')}.`);
  if (resto.length) return falha(404, 'Rota não encontrada', `${caminho} não existe.`);
  if (COM_CORPO.includes(m)) {
    const ct = h('content-type');
    if (ct && !/application\/json/i.test(ct))
      return falha(415, 'Tipo não suportado', `A API só aceita JSON. Use Content-Type: application/json (veio "${ct}").`);
  }

  if (idTxt === undefined) {
    if (m === 'GET') return listar(recurso, url);
    if (m === 'POST') return comCorpo(req, c => criar(recurso, c));
    return naoPermitido(m, caminho, ['GET', 'POST']);
  }
  if (!/^\d+$/.test(idTxt)) return falha(400, 'Id inválido', `O id precisa ser um número inteiro (veio "${idTxt}").`);
  const id = Number(idTxt);
  const atual = achar(recurso, id);

  if (sub !== undefined) {
    const campoPai = esq.filhos && Object.hasOwn(esq.filhos, sub) && esq.filhos[sub];
    if (!campoPai) {
      const ok = esq.filhos ? ' Use: ' + Object.keys(esq.filhos).map(f => `/api/v1/${recurso}/${id}/${f}`).join(', ') + '.' : '';
      return falha(404, 'Rota não encontrada', `${caminho} não existe.${ok}`);
    }
    if (m !== 'GET') return naoPermitido(m, caminho, ['GET']);
    if (!atual) return naoAchado(recurso, id);
    return listar(sub, url, { campo: campoPai, valor: id });
  }

  const aceitos = esq.metodosItem || ['GET', 'PUT', 'PATCH', 'DELETE'];
  if (!aceitos.includes(m))
    return naoPermitido(m, caminho, aceitos, recurso === 'mensagens' ? 'Mensagem já enviada no WhatsApp não pode ser editada.' : '');
  if (!atual) return naoAchado(recurso, id);
  if (m === 'GET') return { status: 200, corpo: atual };
  if (m === 'DELETE') return apagar(recurso, atual);
  return comCorpo(req, c => alterar(recurso, atual, c, m === 'PATCH'));
}

function autenticar(valor) {
  const cab = { 'WWW-Authenticate': 'Bearer realm="api.nassatech"' };
  if (!valor) return falha(401, 'Não autorizado',
    'Falta o cabeçalho Authorization: Bearer <token>. O token de demonstração está na documentação.', null, cab);
  const m = /^Bearer\s+(\S+)$/i.exec(valor);
  if (!m) return falha(401, 'Não autorizado', 'Use o formato Authorization: Bearer <token>.', null, cab);
  if (m[1] !== token) return falha(401, 'Token inválido', 'Esse token não existe ou foi revogado. Copie o token atual na documentação.', null, cab);
  return null;
}

function statusApi() {
  return {
    status: 'ok', servico: 'API Nassa Tech', versao: '1.4.2', ambiente: 'simulado no navegador',
    banco: Object.fromEntries(Object.keys(ESQ).map(k => [k, banco[k].length])),
    webhooks_na_fila: fila.length, hora: agoraISO()
  };
}
function indiceApi() {
  return {
    api: 'Nassa Tech', versao: 'v1', autenticacao: 'Authorization: Bearer <token>',
    recursos: Object.fromEntries(Object.keys(ESQ).map(k => [k, `${HOST}/api/v1/${k}`])),
    status: `${HOST}/api/v1/status`, site: 'https://nassatech.com.br/'
  };
}

// traduz o erro do JSON.parse (que vem em inglês) para linha e coluna
function erroJSON(msg, txt) {
  if (/end of (json|data)|unexpected end/i.test(msg)) return { detalhe: 'O JSON acabou antes da hora: falta fechar alguma chave, colchete ou aspas.' };
  let lin, col;
  const lc = /line (\d+) column (\d+)/i.exec(msg), p = /position (\d+)/i.exec(msg);
  if (lc) { lin = +lc[1]; col = +lc[2]; }
  else if (p) { const antes = txt.slice(0, +p[1]).split('\n'); lin = antes.length; col = antes[antes.length - 1].length + 1; }
  return lin
    ? { detalhe: `Erro de sintaxe na linha ${lin}, coluna ${col}. Confira vírgula sobrando, aspas e chaves.`, linha: lin, coluna: col }
    : { detalhe: 'Erro de sintaxe no JSON. Confira vírgula sobrando, aspas e chaves.' };
}

function comCorpo(req, fn) {
  const txt = String(req.corpo || '').trim();
  if (!txt) return falha(400, 'Corpo vazio', 'Mande um objeto JSON no corpo (aba Corpo JSON).');
  let v;
  try { v = JSON.parse(txt); }
  catch (e) { const x = erroJSON(e.message, txt); return falha(400, 'JSON inválido', x.detalhe, x.linha ? { linha: x.linha, coluna: x.coluna } : null); }
  if (!v || typeof v !== 'object' || Array.isArray(v))
    return falha(400, 'JSON inválido', 'O corpo precisa ser um objeto entre chaves, como { "campo": "valor" }.');
  return fn(v);
}

/* ---------- listagem com filtros, busca, ordem e paginação ---------- */
function valorDe(rec, r, campo) {
  if (rec === 'pagamentos' && campo === 'cliente_id') { const p = achar('projetos', r.projeto_id); return p ? p.cliente_id : null; }
  return r[campo];
}
const inteiro = (t, padrao) => t === null || t === '' ? padrao : /^\d+$/.test(t) ? Number(t) : null;

function listar(rec, url, fixo) {
  const esq = ESQ[rec], q = url.searchParams;
  const aceitos = ['pagina', 'por_pagina', 'q', 'ordem', ...esq.filtros];
  for (const k of q.keys())
    if (!aceitos.includes(k)) return falha(400, 'Parâmetro desconhecido', `"${k}" não é aceito em /${rec}. Use: ${aceitos.join(', ')}.`);

  let itens = banco[rec].slice();
  const filtros = {};
  if (fixo) { itens = itens.filter(r => r[fixo.campo] === fixo.valor); filtros[fixo.campo] = fixo.valor; }
  for (const f of esq.filtros) {
    const bruto = q.get(f);
    if (bruto === null || bruto === '') continue;
    const vals = bruto.split(',').map(s => s.trim()).filter(Boolean);
    const lista = (esq.campos[f] && esq.campos[f].valores) || (esq.enumFiltro && esq.enumFiltro[f]);
    if (f.endsWith('_id')) {
      const ns = vals.map(Number);
      if (ns.some(n => !Number.isInteger(n))) return falha(400, 'Filtro inválido', `${f} precisa ser um id numérico.`);
      itens = itens.filter(r => ns.includes(valorDe(rec, r, f)));
      filtros[f] = ns.length > 1 ? ns : ns[0];
    } else if (lista) {
      const ruim = vals.find(v => !lista.includes(v));
      if (ruim) return falha(400, 'Filtro inválido', `"${ruim}" não é um ${f} válido. Use: ${lista.join(', ')}.`);
      itens = itens.filter(r => vals.includes(r[f]));
      filtros[f] = vals.length > 1 ? vals : vals[0];
    } else {
      const ns = vals.map(norm);
      itens = itens.filter(r => ns.includes(norm(r[f])));
      filtros[f] = vals.length > 1 ? vals : vals[0];
    }
  }
  const busca = q.get('q');
  if (busca) { const n = norm(busca); itens = itens.filter(r => esq.busca.some(c => norm(r[c]).includes(n))); filtros.q = busca; }

  const ordem = q.get('ordem');
  if (ordem) {
    const desc = ordem.startsWith('-'), c = ordem.replace(/^-/, '');
    const validos = ['id', ...Object.keys(esq.campos), ...Object.keys(esq.extras || {}), 'criado_em', 'atualizado_em'];
    if (!validos.includes(c)) return falha(400, 'Ordem inválida', `Não dá para ordenar por "${c}". Use um destes (com - na frente para decrescente): ${validos.join(', ')}.`);
    itens.sort((a, b) => cmp(a[c], b[c]) * (desc ? -1 : 1));
  }

  const pg = inteiro(q.get('pagina'), 1), pp = inteiro(q.get('por_pagina'), 10);
  if (!pg || pg < 1) return falha(400, 'Paginação inválida', 'pagina precisa ser um número inteiro a partir de 1.');
  if (!pp || pp < 1 || pp > 50) return falha(400, 'Paginação inválida', 'por_pagina vai de 1 a 50.');
  const total = itens.length, totalPag = Math.max(1, Math.ceil(total / pp));
  const cab = { 'X-Total-Count': String(total) };
  const link = n => { const u = new URL(url.href); u.searchParams.set('pagina', n); u.searchParams.set('por_pagina', pp); return `<${HOST}${u.pathname}${u.search}>`; };
  const links = [];
  if (pg < totalPag) links.push(link(pg + 1) + '; rel="next"');
  if (pg > 1) links.push(link(pg - 1) + '; rel="prev"');
  if (links.length) cab.Link = links.join(', ');
  return {
    status: 200, cab,
    corpo: { dados: itens.slice((pg - 1) * pp, pg * pp), meta: { total, pagina: pg, por_pagina: pp, total_paginas: totalPag, filtros } }
  };
}

/* ---------- validação dos campos ---------- */
function fmtTel(d) {
  const n = d.slice(4);
  return `+55 ${d.slice(2, 4)} ${n.length === 9 ? n.slice(0, 5) + '-' + n.slice(5) : n.slice(0, 4) + '-' + n.slice(4)}`;
}
function converter(def, v) {
  switch (def.tipo) {
    case 'texto':
      if (typeof v !== 'string') return { erro: 'precisa ser um texto' };
      if (def.max && v.trim().length > def.max) return { erro: `no máximo ${def.max} caracteres` };
      return { v: v.trim() };
    case 'email':
      if (typeof v !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())) return { erro: 'e-mail inválido' };
      return { v: v.trim().toLowerCase() };
    case 'telefone': {
      if (typeof v !== 'string') return { erro: 'precisa ser um texto, como "+55 11 98765-4321"' };
      let d = v.replace(/\D/g, '');
      if (d.length === 10 || d.length === 11) d = '55' + d;
      if (!/^55\d{10,11}$/.test(d)) return { erro: 'telefone inválido: use +55, DDD e número' };
      return { v: fmtTel(d) };
    }
    case 'dinheiro':
      if (typeof v !== 'number' || !isFinite(v)) return { erro: 'precisa ser um número, como 1500.50 (sem aspas)' };
      if (v <= 0) return { erro: 'precisa ser maior que zero' };
      if (v > 1e7) return { erro: 'acima do limite de R$ 10 milhões' };
      return { v: Math.round(v * 100) / 100 };
    case 'data': {
      const m = typeof v === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
      const d = m && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
      if (!m || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return { erro: 'data no formato AAAA-MM-DD' };
      return { v };
    }
    case 'enum':
      if (!def.valores.includes(v)) return { erro: `use um destes: ${def.valores.join(', ')}` };
      return { v };
    case 'ref':
      if (!Number.isInteger(v)) return { erro: 'precisa ser o id numérico (sem aspas)' };
      if (!achar(def.ref, v)) return { erro: `${ESQ[def.ref].nome.toLowerCase()} ${v} não existe` };
      return { v };
  }
  return { v };
}

// modo: criar | substituir (PUT, manda tudo) | atualizar (PATCH, só o que veio)
function validar(rec, corpo, modo) {
  const esq = ESQ[rec], campos = {}, dados = {};
  const parcial = modo === 'atualizar';
  for (const k of Object.keys(corpo))
    if (!LEITURA.includes(k) && !(esq.extras && Object.hasOwn(esq.extras, k)) && !Object.hasOwn(esq.campos, k))
      campos[k] = 'campo desconhecido neste recurso';
  for (const [k, def] of Object.entries(esq.campos)) {
    const v = corpo[k];
    const vazio = v === undefined || v === null || (typeof v === 'string' && !v.trim());
    if (vazio) {
      if (parcial && v === undefined) continue;
      if (def.obrig) campos[k] = 'obrigatório';
      else dados[k] = def.padrao !== undefined ? def.padrao : null;
      continue;
    }
    const r = converter(def, v);
    if (r.erro) campos[k] = r.erro; else dados[k] = r.v;
  }
  // regras de negócio que não cabem num campo só
  if (rec === 'pagamentos') {
    if (modo === 'criar' && corpo.status !== undefined && dados.status !== 'pendente' && !campos.status)
      campos.status = 'na criação é sempre "pendente": o gateway aprova ou recusa logo depois';
  }
  if (rec === 'mensagens' && !dados.para && !campos.para && !campos.cliente_id) {
    const c = dados.cliente_id && achar('clientes', dados.cliente_id);
    if (c && c.telefone) dados.para = c.telefone;
    else campos.para = dados.cliente_id ? 'o cliente não tem telefone: informe "para"' : 'informe o telefone em "para" ou um cliente_id';
  }
  return { campos, dados };
}
const invalido = campos => falha(422, 'Dados inválidos', 'Corrija os campos abaixo e mande de novo.', { campos });

/* ---------- escrita ---------- */
function criar(rec, corpo) {
  const { campos, dados } = validar(rec, corpo, 'criar');
  if (Object.keys(campos).length) return invalido(campos);
  const t = agoraISO();
  const reg = Object.assign({ id: ++banco.seq[rec] }, dados, ESQ[rec].extras || {}, { criado_em: t, atualizado_em: t });
  banco[rec].push(reg);
  salvarBanco();
  const jobs = [];
  if (rec === 'pagamentos') jobs.push({ tipo: 'gateway', ref: reg.id, atraso: ATRASO_GATEWAY });
  if (rec === 'mensagens') jobs.push(
    { tipo: 'evento', evento: 'whatsapp.enviado', dados: payloadMensagem(reg), atraso: 500 },
    { tipo: 'entrega', ref: reg.id, atraso: ATRASO_GATEWAY + 400 });
  return { status: 201, corpo: reg, cab: { Location: `${HOST}/api/v1/${rec}/${reg.id}` }, jobs };
}

function alterar(rec, atual, corpo, parcial) {
  const { campos, dados } = validar(rec, corpo, parcial ? 'atualizar' : 'substituir');
  // pagamento que já passou pelo gateway fica congelado, menos a descrição
  if (rec === 'pagamentos' && atual.status !== 'pendente')
    for (const k of Object.keys(dados))
      if (k !== 'descricao' && dados[k] !== atual[k] && !campos[k]) campos[k] = `pagamento já ${atual.status}: só a descrição pode mudar`;
  if (Object.keys(campos).length) return invalido(campos);
  if (parcial && !Object.keys(dados).length)
    return falha(400, 'Nada para atualizar', `Mande ao menos um destes campos: ${Object.keys(ESQ[rec].campos).join(', ')}.`);
  const antes = atual.status;
  Object.assign(atual, dados, { atualizado_em: agoraISO() });
  const jobs = [];
  if (rec === 'pagamentos' && antes === 'pendente' && atual.status !== 'pendente') {
    if (atual.status === 'aprovado') atual.pago_em = atual.atualizado_em;
    else atual.motivo_recusa = 'recusado manualmente pela equipe';
    jobs.push({ tipo: 'evento', evento: 'pagamento.' + atual.status, dados: payloadPagamento(atual), atraso: ATRASO_GATEWAY });
  }
  salvarBanco();
  return { status: 200, corpo: atual, jobs };
}

function apagar(rec, atual) {
  const vinc = { clientes: ['projetos', 'cliente_id'], projetos: ['pagamentos', 'projeto_id'] }[rec];
  if (vinc) {
    const ids = banco[vinc[0]].filter(r => r[vinc[1]] === atual.id).map(r => r.id);
    if (ids.length) return falha(409, 'Conflito', rec === 'clientes'
      ? `O cliente ${atual.id} tem ${ids.length} projeto(s). Apague ou passe os projetos para outro cliente antes.`
      : `O projeto ${atual.id} tem ${ids.length} pagamento(s). Apague os pagamentos antes.`, { vinculados: { [vinc[0]]: ids } });
  }
  banco[rec] = banco[rec].filter(r => r !== atual);
  // as conversas do WhatsApp ficam no histórico, só perdem o vínculo
  if (rec === 'clientes') banco.mensagens.forEach(m => { if (m.cliente_id === atual.id) m.cliente_id = null; });
  salvarBanco();
  return { status: 204, corpo: null };
}

/* ===========================================================
   FILA DE WEBHOOKS — gateway de pagamento e entrega do WhatsApp
   =========================================================== */
let timers = [];

function payloadPagamento(p) {
  const pr = achar('projetos', p.projeto_id), c = pr && achar('clientes', pr.cliente_id);
  return { pagamento: clone(p), projeto: pr ? { id: pr.id, nome: pr.nome } : null, cliente: c ? { id: c.id, nome: c.nome } : null };
}
function payloadMensagem(m) {
  const c = m.cliente_id && achar('clientes', m.cliente_id);
  return { mensagem: clone(m), cliente: c ? { id: c.id, nome: c.nome } : null, canal: 'whatsapp' };
}
function montarEvento(evento, dados, em = agoraISO()) {
  const id = 'evt_' + NT.id();
  return { id, evento, em, resposta: 200, ms: rand(70, 240),
    destino: 'https://nassatech.com.br/webhooks/' + (evento.startsWith('pagamento') ? 'pagamentos' : 'whatsapp'),
    payload: { id, evento, criado_em: em, dados } };
}
function webhooksIniciais() {
  const pags = banco.pagamentos.filter(p => p.status !== 'pendente').sort((a, b) => cmp(b.atualizado_em, a.atualizado_em)).slice(0, 3);
  const msgs = banco.mensagens.slice(-2);
  return [
    ...pags.map(p => montarEvento('pagamento.' + p.status, payloadPagamento(p), p.atualizado_em)),
    ...msgs.map(m => montarEvento('whatsapp.entregue', payloadMensagem(m), m.atualizado_em))
  ].sort((a, b) => cmp(b.em, a.em));
}

function agendarJobs(jobs, base) {
  for (const j of jobs) {
    const job = Object.assign({ id: NT.id(), quando: base + j.atraso }, j);
    delete job.atraso;
    fila.push(job);
    programar(job);
  }
  D.gravar('fila', fila);
}
function programar(job) {
  timers.push(setTimeout(() => rodarJob(job.id), Math.max(0, job.quando - Date.now())));
}
function cancelarFila() {
  timers.forEach(clearTimeout); timers = [];
  fila = []; D.gravar('fila', fila);
}
function rodarJob(id) {
  const i = fila.findIndex(j => j.id === id);
  if (i < 0) return;
  const [job] = fila.splice(i, 1);
  D.gravar('fila', fila);
  if (job.tipo === 'gateway') {
    // se alguém aprovou ou recusou à mão antes, o gateway não mexe mais
    const p = achar('pagamentos', job.ref);
    if (p && p.status === 'pendente') {
      const recusa = p.metodo === 'cartao' && p.valor > LIMITE_CARTAO;
      p.status = recusa ? 'recusado' : 'aprovado';
      p.atualizado_em = agoraISO();
      if (recusa) p.motivo_recusa = 'limite do cartão excedido (acima de R$ 15.000,00)';
      else p.pago_em = p.atualizado_em;
      salvarBanco();
      emitir('pagamento.' + p.status, payloadPagamento(p));
    }
  } else if (job.tipo === 'entrega') {
    const m = achar('mensagens', job.ref);
    if (m && m.status === 'enviada') {
      m.status = 'entregue'; m.atualizado_em = agoraISO();
      salvarBanco();
      emitir('whatsapp.entregue', payloadMensagem(m));
    }
  } else if (job.tipo === 'evento') emitir(job.evento, job.dados);
  renderBanco(); renderKpis();
}

let novosWh = 0, abaLado = 'wh';
function emitir(evento, dados) {
  const ev = montarEvento(evento, dados);
  webhooks.unshift(ev);
  webhooks = webhooks.slice(0, 60);
  D.gravar('webhooks', webhooks);
  estHoje().webhooks++; D.gravar('stats', est);
  if (abaLado !== 'wh') novosWh++;
  renderWebhooks(ev.id); renderContador(); renderKpis();
  NT.aviso(`Webhook ${evento} recebido.`);
}

/* ===========================================================
   INTERFACE
   =========================================================== */
const el = {
  kpis: $('#kpis'), docsLista: $('#docsLista'), filtroDocs: $('#filtroDocs'), tokenTxt: $('#tokenTxt'), rotas: $('#rotas'),
  form: $('#formReq'), metodo: $('#metodo'), caminho: $('#caminho'), cab: $('#cabecalhos'), corpo: $('#corpo'),
  estadoJson: $('#estadoJson'), curl: $('#curl'), btnEnviar: $('#btnEnviar'), console: $('#console'),
  resposta: $('#resposta'), resMeta: $('#resMeta'), resEco: $('#resEco'), resNota: $('#resNota'), resVazio: $('#resVazio'),
  resCorpo: $('#resCorpo'), resCab: $('#resCab'), lado: $('#lado'), listaWh: $('#listaWh'), listaHist: $('#listaHist'),
  tabBanco: $('#tabBanco'), resumoBanco: $('#resumoBanco'), novosWh: $('#novosWh'), modal: $('#modalRestaurar'), chkTudo: $('#chkTudo')
};
const estreito = () => matchMedia('(max-width: 820px)').matches;
const trocarAba = (raiz, aba) => { const b = raiz.querySelector(`.aba[data-aba="${aba}"]`); if (b && !b.classList.contains('on')) b.click(); };

/* ---------- JSON com cor (tokeniza o texto cru e escapa pedaço por pedaço) ---------- */
const RE_JSON = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
function realcar(txt) {
  let out = '', i = 0;
  txt.replace(RE_JSON, (m, str, doisPontos, lit, pos) => {
    out += esc(txt.slice(i, pos));
    if (str) out += doisPontos ? `<span class="j-k">${esc(str)}</span>${doisPontos}` : `<span class="j-s">${esc(str)}</span>`;
    else out += `<span class="${lit ? 'j-l' : 'j-n'}">${m}</span>`;
    i = pos + m.length;
    return m;
  });
  return out + esc(txt.slice(i));
}
const quando = iso => {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString() ? NT.hora(d)
    : NT.data(iso) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};
const tamanho = b => b < 1024 ? `${b} B` : `${(b / 1024).toFixed(1).replace('.', ',')} KB`;

/* ---------- documentação ---------- */
const ex = {
  cliente: { nome: 'Barbearia Navalha de Ouro', contato: 'Anderson Souza', email: 'contato@navalhadeouro.com.br',
    telefone: '+55 11 98888-1212', cidade: 'São Paulo', segmento: 'Beleza' },
  clienteTroca: { nome: 'Padaria Pão de Mel', contato: 'Sônia Ribeiro', email: 'financeiro@paodemel.com.br',
    telefone: '+55 11 98765-4321', cidade: 'São Paulo', segmento: 'Alimentação' }
};
const DOCS = [
  { grupo: 'Geral', itens: [
    { m: 'GET', p: '/api/v1/status', d: 'Saúde da API, versão e fila de webhooks. Não pede token.', semToken: true },
    { m: 'GET', p: '/api/v1', d: 'Índice com o link de cada recurso.', semToken: true }
  ]},
  { grupo: 'Clientes', itens: [
    { m: 'GET', p: '/api/v1/clientes', d: 'Lista os clientes, 10 por página.', q: 'filtros: cidade, segmento · q, ordem, pagina, por_pagina' },
    { m: 'GET', p: '/api/v1/clientes?cidade=São Paulo', d: 'Só os clientes de uma cidade.' },
    { m: 'GET', p: '/api/v1/clientes?q=clínica', d: 'Busca por texto no nome, contato, e-mail e cidade.' },
    { m: 'GET', p: '/api/v1/clientes/:id', d: 'Um cliente pelo id.' },
    { m: 'GET', p: '/api/v1/clientes/:id/projetos', d: 'Os projetos de um cliente.', id: c => banco.projetos.some(p => p.cliente_id === c.id) },
    { m: 'GET', p: '/api/v1/clientes/:id/mensagens', d: 'As mensagens de WhatsApp trocadas com o cliente.', id: c => banco.mensagens.some(m => m.cliente_id === c.id) },
    { m: 'POST', p: '/api/v1/clientes', d: 'Cadastra um cliente. nome e email são obrigatórios. Responde 201.', b: ex.cliente },
    { m: 'PUT', p: '/api/v1/clientes/:id', d: 'Troca o cadastro inteiro: o que não vier fica vazio.', b: ex.clienteTroca },
    { m: 'PATCH', p: '/api/v1/clientes/:id', d: 'Altera só os campos enviados.', b: { telefone: '+55 11 99999-0000', cidade: 'Barueri' } },
    { m: 'DELETE', p: '/api/v1/clientes/:id', d: 'Apaga o cliente (204). Dá 409 se ele ainda tiver projetos.', id: c => !banco.projetos.some(p => p.cliente_id === c.id), ultimo: true }
  ]},
  { grupo: 'Projetos', itens: [
    { m: 'GET', p: '/api/v1/projetos', d: 'Lista os projetos.', q: 'filtros: cliente_id, status, tipo, responsavel · q, ordem, pagina, por_pagina' },
    { m: 'GET', p: '/api/v1/projetos?status=em_andamento', d: 'Projetos em andamento. status: proposta, em_andamento, homologacao, entregue.' },
    { m: 'GET', p: '/api/v1/projetos?cliente_id=2', d: 'Projetos de um cliente pelo filtro.' },
    { m: 'GET', p: '/api/v1/projetos?ordem=-valor&por_pagina=3', d: 'Os três maiores projetos em valor.' },
    { m: 'GET', p: '/api/v1/projetos/:id', d: 'Um projeto pelo id.' },
    { m: 'GET', p: '/api/v1/projetos/:id/pagamentos', d: 'Os pagamentos de um projeto.', id: p => banco.pagamentos.some(x => x.projeto_id === p.id) },
    { m: 'POST', p: '/api/v1/projetos', d: 'Cria um projeto ligado a um cliente. tipo: site, sistema, app, automacao, agente_ia.',
      b: () => ({ cliente_id: banco.clientes[0] ? banco.clientes[0].id : 1, nome: 'Encomendas de bolos para festas', tipo: 'sistema', valor: 7500, prazo: NT.hojeISO(45), responsavel: 'Rafa' }) },
    { m: 'PATCH', p: '/api/v1/projetos/:id', d: 'Muda o status ou o prazo.', b: { status: 'homologacao' }, id: p => p.status === 'em_andamento' },
    { m: 'DELETE', p: '/api/v1/projetos/:id', d: 'Apaga o projeto. Dá 409 se tiver pagamentos.', id: p => !banco.pagamentos.some(x => x.projeto_id === p.id), ultimo: true }
  ]},
  { grupo: 'Pagamentos', itens: [
    { m: 'GET', p: '/api/v1/pagamentos', d: 'Lista os pagamentos.', q: 'filtros: projeto_id, cliente_id, status, metodo · q, ordem, pagina, por_pagina' },
    { m: 'GET', p: '/api/v1/pagamentos?status=aprovado', d: 'Só os aprovados. status: pendente, aprovado, recusado.' },
    { m: 'GET', p: '/api/v1/pagamentos?status=pendente,recusado', d: 'Vários valores de uma vez, separados por vírgula.' },
    { m: 'GET', p: '/api/v1/pagamentos?pagina=2&por_pagina=5', d: 'Paginação: veja meta e o cabeçalho Link.' },
    { m: 'GET', p: '/api/v1/pagamentos/:id', d: 'Um pagamento pelo id.' },
    { m: 'POST', p: '/api/v1/pagamentos', d: 'Cria pendente; ~1,5 s depois o gateway aprova e dispara o webhook pagamento.aprovado.',
      b: () => ({ projeto_id: (banco.projetos.find(p => p.status === 'em_andamento') || banco.projetos[0] || { id: 1 }).id, valor: 9250, metodo: 'pix', vencimento: NT.hojeISO(7), descricao: 'Parcela 2 de 2' }) },
    { m: 'POST', p: '/api/v1/pagamentos', d: 'Cartão acima de R$ 15.000 é recusado pelo gateway de teste: webhook pagamento.recusado.',
      b: () => ({ projeto_id: (banco.projetos.find(p => p.tipo === 'app') || banco.projetos[0] || { id: 1 }).id, valor: 16000, metodo: 'cartao', descricao: 'Entrada no cartão' }) },
    { m: 'PATCH', p: '/api/v1/pagamentos/:id', d: 'Aprova à mão um pagamento pendente (também dispara webhook).', b: { status: 'aprovado' }, id: p => p.status === 'pendente' },
    { m: 'DELETE', p: '/api/v1/pagamentos/:id', d: 'Apaga o pagamento.', ultimo: true }
  ]},
  { grupo: 'Mensagens (WhatsApp)', itens: [
    { m: 'GET', p: '/api/v1/mensagens', d: 'Lista as mensagens enviadas.', q: 'filtros: cliente_id, status · q, ordem, pagina, por_pagina' },
    { m: 'GET', p: '/api/v1/mensagens?status=entregue', d: 'status: enviada, entregue, lida.' },
    { m: 'GET', p: '/api/v1/mensagens/:id', d: 'Uma mensagem pelo id.' },
    { m: 'POST', p: '/api/v1/mensagens', d: 'Envia para o telefone do cliente. Gera whatsapp.enviado e depois whatsapp.entregue.',
      b: () => ({ cliente_id: (banco.clientes.find(c => c.id === 2) || banco.clientes[0] || { id: 1 }).id, texto: 'Olá! A agenda online já está no ar para testes. Qualquer dúvida, é só responder aqui.' }) },
    { m: 'POST', p: '/api/v1/mensagens', d: 'Envia para um número avulso, sem cliente.', b: { para: '+55 11 91234-5678', texto: 'Oi! Aqui é a Duda, da Nassa Tech. Recebemos seu pedido de orçamento pelo site.' } },
    { m: 'DELETE', p: '/api/v1/mensagens/:id', d: 'Apaga do histórico. Mensagem não aceita PUT nem PATCH.', ultimo: true }
  ]},
  { grupo: 'Erros comuns', itens: [
    { m: 'POST', p: '/api/v1/clientes', d: 'Sem os campos obrigatórios: 422 com o erro de cada campo.', b: { contato: 'Sem nome', email: 'isso-nao-e-email' }, cod: 422 },
    { m: 'POST', p: '/api/v1/clientes', d: 'Vírgula sobrando no fim: 400 JSON inválido.', bTxt: '{\n  "nome": "Padaria Pão de Mel",\n}', cod: 400 },
    { m: 'GET', p: '/api/v1/clientes', d: 'Sem o cabeçalho Authorization: 401.', semToken: true, cod: 401 },
    { m: 'GET', p: '/api/v1/projetos/999', d: 'Id que não existe: 404.', cod: 404 },
    { m: 'DELETE', p: '/api/v1/clientes/1', d: 'Cliente com projetos: 409 com os ids vinculados.', cod: 409 },
    { m: 'PUT', p: '/api/v1/mensagens/1', d: 'Método que a rota não aceita: 405 com o cabeçalho Allow.', b: { texto: 'Editar mensagem' }, cod: 405 },
    { m: 'GET', p: '/api/v1/pagamentos?status=pago', d: 'Filtro com valor que não existe: 400.', cod: 400 }
  ]}
];
const corpoDoc = it => it.bTxt !== undefined ? it.bTxt : it.b ? JSON.stringify(typeof it.b === 'function' ? it.b() : it.b, null, 2) : '';
function caminhoDoc(it) {
  if (!it.p.includes(':id')) return it.p;
  const lista = banco[it.p.split('/')[3]] || [];
  const alvo = (it.id && (it.ultimo ? lista.slice().reverse() : lista).find(it.id)) || (it.ultimo ? lista[lista.length - 1] : lista[0]);
  return it.p.replace(':id', alvo ? alvo.id : 1);
}

function montarDocs() {
  const fechar = estreito();
  el.docsLista.innerHTML = DOCS.map((g, gi) => `
    <details class="grupo"${fechar && gi > 1 ? '' : ' open'}>
      <summary><span>${esc(g.grupo)}</span><span class="qtd">${g.itens.length}</span></summary>
      <ul>${g.itens.map((it, ii) => {
        const corpo = it.bTxt !== undefined ? it.bTxt : it.b && typeof it.b !== 'function' ? JSON.stringify(it.b, null, 2) : '';
        return `<li class="ep" data-busca="${esc(norm([it.m, it.p, it.d, it.cod || '', g.grupo].join(' ')))}">
          <button type="button" class="ep-btn" data-ep="${gi}.${ii}" title="Preencher o console com este endpoint">
            <span class="met m-${it.m}">${it.m}</span>
            <span class="ep-txt"><span class="ep-path mono">${esc(it.p)}</span><span class="ep-desc">${esc(it.d)}</span>${
              it.q ? `<span class="ep-q mono">${esc(it.q)}</span>` : ''}${
              it.cod ? `<span class="badge err ep-cod">responde ${it.cod}</span>` : ''}</span>
          </button>${corpo || typeof it.b === 'function' ? `
          <details class="ep-ex"><summary>Exemplo de corpo</summary><pre class="json" data-ex="${gi}.${ii}">${corpo ? realcar(corpo) : ''}</pre></details>` : ''}
        </li>`; }).join('')}</ul>
    </details>`).join('');
  // datalist do caminho: as rotas mais usadas, sem repetir
  const vistos = new Set();
  el.rotas.innerHTML = DOCS.flatMap(g => g.itens).map(it => it.p.replace(':id', '1'))
    .filter(p => !vistos.has(p) && vistos.add(p)).map(p => `<option value="${esc(p)}">`).join('');
}
function itemDoc(chave) { const [g, i] = chave.split('.').map(Number); return DOCS[g].itens[i]; }

function usarDoc(it) {
  const corpo = corpoDoc(it);
  let cab = el.cab.value;
  cab = it.semToken ? tirarCab(cab, 'Authorization') : porCab(cab, 'Authorization', 'Bearer ' + token);
  if (corpo) cab = porCab(cab, 'Content-Type', 'application/json', false);
  preencher({ metodo: it.m, caminho: caminhoDoc(it), cab, corpo });
  trocarAba(el.console, corpo ? 'corpo' : 'cab');
  el.console.classList.remove('realce'); void el.console.offsetWidth; el.console.classList.add('realce');
  if (estreito()) el.console.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---------- cabeçalhos do console ---------- */
function porCab(txt, nome, valor, trocar = true) {
  const linhas = txt.split('\n').filter(l => l.trim());
  const i = linhas.findIndex(l => l.split(':')[0].trim().toLowerCase() === nome.toLowerCase());
  if (i >= 0) { if (trocar) linhas[i] = `${nome}: ${valor}`; }
  else nome === 'Authorization' ? linhas.unshift(`${nome}: ${valor}`) : linhas.push(`${nome}: ${valor}`);
  return linhas.join('\n');
}
const tirarCab = (txt, nome) => txt.split('\n').filter(l => l.trim() && l.split(':')[0].trim().toLowerCase() !== nome.toLowerCase()).join('\n');

/* ---------- console ---------- */
const lerConsole = () => ({ metodo: el.metodo.value, caminho: el.caminho.value.trim(), cab: el.cab.value, corpo: el.corpo.value });
function preencher(req) {
  el.metodo.value = req.metodo; el.caminho.value = req.caminho; el.cab.value = req.cab; el.corpo.value = req.corpo || '';
  aoEditar();
}
function aoEditar() {
  el.metodo.dataset.m = el.metodo.value;
  estadoJson();
  el.curl.textContent = gerarCurl(lerConsole());
  D.gravar('rascunho', lerConsole());
}
function estadoJson() {
  const txt = el.corpo.value.trim(), m = el.metodo.value;
  let cls = 'dim', msg = 'Sem corpo.';
  if (!COM_CORPO.includes(m)) msg = txt ? `${m} não leva corpo: o que está aqui é ignorado.` : `${m} não leva corpo.`;
  else if (txt) {
    try { JSON.parse(txt); cls = 'ok'; msg = 'JSON válido.'; }
    catch (e) { cls = 'err'; msg = 'JSON inválido. ' + erroJSON(e.message, txt).detalhe; }
  }
  el.estadoJson.className = 'pequeno ' + cls;
  el.estadoJson.textContent = msg;
}
function gerarCurl(req) {
  const sh = s => "'" + String(s).replace(/'/g, "'\\''") + "'";
  let url;
  try { const u = new URL(req.caminho || '/', HOST); url = HOST + u.pathname + u.search; } catch (e) { url = HOST + req.caminho; }
  const linhas = [`curl${req.metodo === 'GET' ? '' : ' -X ' + req.metodo} ${sh(url)}`];
  lerCabecalhos(req.cab).lista.forEach(([n, v]) => linhas.push(`  -H ${sh(n + ': ' + v)}`));
  if (COM_CORPO.includes(req.metodo) && req.corpo.trim()) {
    let c = req.corpo.trim();
    try { c = JSON.stringify(JSON.parse(c)); } catch (e) { /* vai do jeito que está, para reproduzir o 400 */ }
    linhas.push(`  --data ${sh(c)}`);
  }
  return linhas.join(' \\\n');
}

let enviando = false;
async function enviar() {
  if (enviando) return;
  const req = lerConsole();
  if (!req.caminho) { NT.aviso('Escreva o caminho, por exemplo /api/v1/clientes.'); el.caminho.focus(); return; }
  enviando = true;
  el.btnEnviar.disabled = true; el.btnEnviar.textContent = 'Enviando…';
  el.resMeta.innerHTML = '<span class="girando" aria-hidden="true"></span><span>Aguardando resposta…</span>';
  const r = executar(req);
  await new Promise(ok => setTimeout(ok, r.ms));
  if (r.jobs.length) agendarJobs(r.jobs, Date.now());
  registrar(req, r);
  ultima = { metodo: req.metodo, caminho: req.caminho, status: r.status, ms: r.ms, bytes: r.bytes, corpo: r.corpo, cab: r.cab,
    agendados: r.jobs.map(j => j.tipo === 'gateway' ? 'pagamento.aprovado ou pagamento.recusado' : j.tipo === 'entrega' ? 'whatsapp.entregue' : j.evento),
    em: agoraISO() };
  D.gravar('ultima', ultima);
  desenharResposta(); renderHistorico(); renderKpis(); renderBanco();
  enviando = false;
  el.btnEnviar.disabled = false; el.btnEnviar.textContent = 'Enviar';
}

function desenharResposta() {
  const u = ultima;
  if (!u) {
    el.resMeta.innerHTML = '<span>Nada enviado ainda</span>';
    el.resEco.innerHTML = ''; el.resNota.hidden = true;
    el.resVazio.hidden = false; el.resCorpo.hidden = true;
    el.resCab.innerHTML = '<tr><td class="dim">Os cabeçalhos aparecem depois do primeiro envio.</td></tr>';
    return;
  }
  el.resMeta.innerHTML = `<span class="st ${u.status < 300 ? 'ok' : 'erro'}">${u.status} ${STATUS_TXT[u.status] || ''}</span>` +
    `<span><b>${u.ms}</b> ms</span><span>${tamanho(u.bytes)}</span>`;
  el.resEco.innerHTML = `<span class="met m-${esc(u.metodo)}">${esc(u.metodo)}</span><span class="mono">${esc(u.caminho)}</span><span class="dim">às ${NT.hora(u.em)}</span>`;
  el.resVazio.hidden = true; el.resCorpo.hidden = false;
  el.resCorpo.innerHTML = u.corpo === null
    ? '<span class="j-l">// 204: apagado com sucesso, a resposta não tem corpo</span>'
    : realcar(JSON.stringify(u.corpo, null, 2));
  el.resCab.innerHTML = Object.entries(u.cab).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('');
  const recente = Date.now() - new Date(u.em).getTime() < 15000;
  el.resNota.hidden = !(u.agendados && u.agendados.length && recente);
  if (!el.resNota.hidden)
    el.resNota.innerHTML = `<span>Webhook agendado: <b class="mono">${u.agendados.map(esc).join('</b> e <b class="mono">')}</b> em ~1,5 s.</span>` +
      '<button type="button" class="btn mini" id="btnVerLog">Ver log</button>';
}

/* ---------- números do topo ---------- */
function renderKpis() {
  const s = estHoje();
  const taxa = s.total ? s.erros / s.total * 100 : 0;
  const reg = Object.keys(ESQ).reduce((n, k) => n + banco[k].length, 0);
  const k = (cls, valor, rot, titulo) => `<div class="kpi ${cls}" title="${esc(titulo)}"><b>${valor}</b><span>${rot}</span></div>`;
  el.kpis.innerHTML =
    k('acc', NT.num(s.total), 'Requisições hoje', 'Tudo o que passou pelo console hoje') +
    k(!s.total ? '' : taxa < 10 ? 'ok' : taxa < 25 ? 'warn' : 'err', taxa.toFixed(1).replace('.', ',').replace(',0', '') + '%', 'Taxa de erro',
      `${s.erros} de ${s.total} com código 4xx ou 5xx`) +
    k('', s.total ? Math.round(s.somaMs / s.total) + ' ms' : '—', 'Latência média', 'Média do tempo de resposta de hoje') +
    k('', NT.num(s.webhooks), 'Webhooks hoje', 'Eventos entregues hoje em nassatech.com.br/webhooks') +
    k('', NT.num(reg), 'Registros no banco', 'Clientes, projetos, pagamentos e mensagens');
}

/* ---------- painel lateral ---------- */
function renderHistorico() {
  el.listaHist.innerHTML = historico.length ? historico.map(h => `<li>
    <button type="button" class="hist-btn" data-h="${h.id}" aria-label="Repetir ${h.metodo} ${esc(h.caminho)} (deu ${h.status})">
      <span class="met m-${esc(h.metodo)}">${esc(h.metodo)}</span><span class="hist-path">${esc(h.caminho)}</span>
      <span class="st mini ${h.status < 300 ? 'ok' : 'erro'}">${h.status}</span>
      <span class="hist-info">${h.ms} ms · ${quando(h.em)}</span>
    </button></li>`).join('')
    : '<li class="vazio">Nenhuma requisição ainda. As que você mandar aparecem aqui.</li>';
}

const abertos = new Set();
function resumoEvento(w) {
  const d = w.payload.dados;
  if (d.pagamento) {
    const p = d.pagamento;
    return `Pagamento #${p.id} · ${NT.brl(p.valor)} no ${p.metodo === 'cartao' ? 'cartão' : p.metodo}` +
      (d.cliente ? ` · ${d.cliente.nome}` : '') + (p.status === 'recusado' && p.motivo_recusa ? ` — ${p.motivo_recusa}` : '');
  }
  const m = d.mensagem || {};
  return `Mensagem #${m.id} para ${m.para}` + (d.cliente ? ` · ${d.cliente.nome}` : '');
}
const corEvento = e => /aprovado/.test(e) ? 'ok' : /recusado/.test(e) ? 'err' : /entregue/.test(e) ? 'roxo' : 'acc';
function renderWebhooks(novo) {
  el.listaWh.innerHTML = webhooks.length ? webhooks.map(w => {
    const aberto = abertos.has(w.id);
    return `<li class="wh${w.id === novo ? ' chegou' : ''}">
      <div class="wh-topo"><span class="badge ev ${corEvento(w.evento)}">${esc(w.evento)}</span><span class="pequeno dim">${quando(w.em)}</span></div>
      <div class="wh-res">${esc(resumoEvento(w))}</div>
      <div class="wh-dest mono" title="${esc(w.destino)}">POST ${esc(w.destino.replace(/^https:\/\/[^/]+/, ''))} → ${w.resposta} em ${w.ms} ms</div>
      <div class="linha wh-acoes">
        <button type="button" class="btn mini ghost" data-wh="ver" data-id="${w.id}" aria-expanded="${aberto}">${aberto ? 'Esconder payload' : 'Ver payload'}</button>
        <button type="button" class="btn mini ghost" data-wh="copiar" data-id="${w.id}">Copiar</button>
      </div>
      ${aberto ? `<pre class="json" tabindex="0">${realcar(JSON.stringify(w.payload, null, 2))}</pre>` : ''}
    </li>`; }).join('')
    : '<li class="vazio">Nenhum webhook ainda. Crie um pagamento ou mande uma mensagem pela API e ele aparece aqui.</li>';
}
function renderContador() {
  el.novosWh.hidden = !novosWh;
  el.novosWh.textContent = novosWh;
  el.novosWh.setAttribute('aria-label', `${novosWh} novos`);
}

function renderBanco() {
  el.tabBanco.innerHTML = Object.keys(ESQ).map(k => `<tr><td class="mono">${k}</td><td>${banco[k].length}</td>` +
    `<td class="dim">${banco.seq[k] + 1}</td><td><button type="button" class="btn mini" data-listar="${k}">Listar</button></td></tr>`).join('');
  const soma = st => banco.pagamentos.filter(p => p.status === st).reduce((n, p) => n + p.valor, 0);
  const qtd = st => banco.pagamentos.filter(p => p.status === st).length;
  const item = (rot, valor) => `<div class="item"><span class="dim">${rot}</span><b>${valor}</b></div>`;
  el.resumoBanco.innerHTML =
    item(`Recebido (${qtd('aprovado')} aprovados)`, NT.brl(soma('aprovado'))) +
    item(`A receber (${qtd('pendente')} pendentes)`, NT.brl(soma('pendente'))) +
    item(`Recusado (${qtd('recusado')})`, NT.brl(soma('recusado'))) +
    item('Webhooks na fila', fila.length);
}

const renderToken = () => { el.tokenTxt.textContent = token; };
function renderTudo() {
  renderToken(); renderKpis(); renderHistorico(); renderWebhooks(); renderContador(); renderBanco(); desenharResposta();
}

/* ---------- ações ---------- */
function restaurar(tudo) {
  cancelarFila();
  if (tudo) { primeiraCarga(); novosWh = 0; abertos.clear(); }
  else { banco = semente(); salvarBanco(); }
  renderTudo();
  NT.aviso(tudo ? 'Banco, histórico, webhooks e métricas voltaram ao exemplo.' : 'Banco restaurado com os dados de exemplo.');
}
function novoToken() {
  const antigo = token;
  token = 'nt_demo_' + Array.from({ length: 12 }, () => '0123456789abcdef'[rand(0, 15)]).join('');
  D.gravar('token', token);
  // o histórico guarda o token antigo de propósito: repetir uma chamada velha dá 401, como em produção
  el.cab.value = el.cab.value.split(antigo).join(token);
  aoEditar(); renderToken();
  NT.aviso('Token novo gerado. O anterior foi revogado.');
}

function ligar() {
  NT.abas(el.console);
  NT.abas(el.resposta);
  NT.abas(el.lado, aba => {
    abaLado = aba;
    if (aba === 'wh') { novosWh = 0; renderContador(); }
    D.gravar('abaLado', aba);
  });

  el.form.addEventListener('submit', e => { e.preventDefault(); enviar(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && el.modal.hidden) { e.preventDefault(); enviar(); }
  });
  [el.metodo, el.caminho, el.cab, el.corpo].forEach(c => c.addEventListener('input', aoEditar));
  el.metodo.addEventListener('change', aoEditar);

  $('#btnPorToken').addEventListener('click', () => { el.cab.value = porCab(el.cab.value, 'Authorization', 'Bearer ' + token); aoEditar(); });
  $('#btnTirarToken').addEventListener('click', () => { el.cab.value = tirarCab(el.cab.value, 'Authorization'); aoEditar(); NT.aviso('Sem o token, as rotas protegidas respondem 401.'); });
  $('#btnFormatar').addEventListener('click', () => {
    try { el.corpo.value = JSON.stringify(JSON.parse(el.corpo.value), null, 2); aoEditar(); }
    catch (e) { NT.aviso(el.corpo.value.trim() ? 'Não dá para formatar: o JSON tem erro.' : 'O corpo está vazio.'); }
  });
  $('#btnLimparCorpo').addEventListener('click', () => { el.corpo.value = ''; aoEditar(); el.corpo.focus(); });
  $('#btnCopiarCurl').addEventListener('click', () => NT.copiar(el.curl.textContent));
  $('#btnCopiarRes').addEventListener('click', () => {
    if (!ultima) return NT.aviso('Mande uma requisição primeiro.');
    NT.copiar(ultima.corpo === null ? '' : JSON.stringify(ultima.corpo, null, 2));
  });
  el.resNota.addEventListener('click', e => {
    if (!e.target.closest('#btnVerLog')) return;
    trocarAba(el.lado, 'wh');
    if (matchMedia('(max-width: 1240px)').matches) el.lado.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // documentação
  el.docsLista.addEventListener('click', e => {
    const b = e.target.closest('.ep-btn');
    if (b) usarDoc(itemDoc(b.dataset.ep));
  });
  el.docsLista.addEventListener('toggle', e => {
    // exemplos que dependem do banco (ids de agora) são montados toda vez que abrem
    const d = e.target;
    if (!d.classList || !d.classList.contains('ep-ex') || !d.open) return;
    const pre = d.querySelector('pre[data-ex]'), it = itemDoc(pre.dataset.ex);
    if (typeof it.b === 'function') pre.innerHTML = realcar(corpoDoc(it));
  }, true);   // toggle não borbulha: só a captura chega aqui
  el.filtroDocs.addEventListener('input', () => {
    const n = norm(el.filtroDocs.value);
    el.docsLista.querySelectorAll('.grupo').forEach(g => {
      let algum = false;
      g.querySelectorAll('.ep').forEach(li => { const ok = !n || li.dataset.busca.includes(n); li.hidden = !ok; algum = algum || ok; });
      g.hidden = !algum;
      if (n && algum) g.open = true;
    });
  });

  // painel lateral
  el.listaHist.addEventListener('click', e => {
    const b = e.target.closest('.hist-btn');
    const h = b && historico.find(x => x.id === b.dataset.h);
    if (!h) return;
    preencher(h);
    trocarAba(el.console, COM_CORPO.includes(h.metodo) && h.corpo.trim() ? 'corpo' : 'cab');
    if (estreito()) el.console.scrollIntoView({ behavior: 'smooth', block: 'start' });
    enviar();
  });
  el.listaWh.addEventListener('click', e => {
    const b = e.target.closest('[data-wh]');
    const w = b && webhooks.find(x => x.id === b.dataset.id);
    if (!w) return;
    if (b.dataset.wh === 'copiar') return NT.copiar(JSON.stringify(w.payload, null, 2));
    abertos.has(w.id) ? abertos.delete(w.id) : abertos.add(w.id);
    renderWebhooks();
    const volta = el.listaWh.querySelector(`[data-wh="ver"][data-id="${w.id}"]`);
    if (volta) volta.focus();
  });
  el.tabBanco.addEventListener('click', e => {
    const b = e.target.closest('[data-listar]');
    if (!b) return;
    preencher({ metodo: 'GET', caminho: '/api/v1/' + b.dataset.listar, cab: porCab(el.cab.value, 'Authorization', 'Bearer ' + token), corpo: el.corpo.value });
    trocarAba(el.console, 'cab');
    if (matchMedia('(max-width: 1240px)').matches) el.console.scrollIntoView({ behavior: 'smooth', block: 'start' });
    enviar();
  });
  $('#btnLimparWh').addEventListener('click', () => {
    if (!webhooks.length) return NT.aviso('O log já está vazio.');
    webhooks = []; abertos.clear(); D.gravar('webhooks', webhooks); renderWebhooks(); NT.aviso('Log de webhooks limpo.');
  });
  $('#btnLimparHist').addEventListener('click', () => {
    if (!historico.length) return NT.aviso('O histórico já está vazio.');
    historico = []; D.gravar('historico', historico); renderHistorico(); NT.aviso('Histórico limpo. As métricas de hoje continuam.');
  });

  // topo
  const copiarToken = () => NT.copiar(token);
  $('#btnToken').addEventListener('click', copiarToken);
  $('#btnCopiarToken').addEventListener('click', copiarToken);
  $('#btnNovoToken').addEventListener('click', novoToken);
  $('#btnExportar').addEventListener('click', () => {
    NT.baixar(`banco-api-nassatech-${NT.hojeISO()}.json`, JSON.stringify(banco, null, 2), 'application/json;charset=utf-8');
    NT.aviso('Banco exportado em JSON.');
  });
  const btnRest = $('#btnRestaurar');
  btnRest.addEventListener('click', () => { el.chkTudo.checked = false; NT.modal(el.modal, true); });
  $('#btnCancelarRest').addEventListener('click', () => { NT.modal(el.modal, false); btnRest.focus(); });
  $('#btnConfirmarRest').addEventListener('click', () => { const tudo = el.chkTudo.checked; NT.modal(el.modal, false); restaurar(tudo); btnRest.focus(); });
}

/* ---------- partida ---------- */
carregar();
montarDocs();
ligar();
const rasc = D.ler('rascunho', null);
preencher(rasc && rasc.metodo ? rasc : { metodo: 'GET', caminho: '/api/v1/clientes', cab: cabecalhosPadrao(), corpo: '' });
renderTudo();
const abaSalva = D.ler('abaLado', 'wh');
if (abaSalva !== 'wh') trocarAba(el.lado, abaSalva);
fila.forEach(programar);   // webhooks que ficaram pendentes antes de recarregar
})();
