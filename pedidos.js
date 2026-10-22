/* ===========================================================
   pedidos.js — o pedido do cliente, do briefing à entrega

   Você (o CEO) sobe o que o cliente pediu. O escritório:
     1. cria a pasta do projeto (~/NassaTech/clientes/<cliente>, com git);
     2. reunião de planejamento: Duda e Rafa leem o pedido e montam o plano
        (tarefas por agente, prazo, orçamento) — só leem, não mexem em nada;
     3. espera você aprovar o plano (ou pedir ajuste);
     4. cada agente faz a sua tarefa, um depois do outro, na mesma pasta;
     5. o Theo testa no fim; o pedido fica "aguardando entrega";
     6. você recebe o aviso no celular e aprova a entrega (ou pede ajuste).

   Cada etapa é uma sessão do Claude Code (claude -p) rodando dentro da
   pasta do projeto. Publicar para o cliente, cobrar ou mandar mensagem
   continua com você: os agentes não têm como fazer isso daqui.

   O estado de cada pedido fica em data/pedidos/<id>.json, então um
   escritório reiniciado no meio do trabalho retoma de onde parou.
   =========================================================== */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

let dep = null;                 // { ROOT, CLAUDE_BIN, config, equipe, avisar }
const rodando = new Map();      // id do pedido -> processo do claude em andamento

const CFG = () => Object.assign({
  pasta: path.join(os.homedir(), 'NassaTech', 'clientes'),
  limiteUSD: 5,                 // gasto máximo por pedido antes de pausar e te perguntar
  modelo: null,                 // null = o padrão do seu Claude Code
  minutosPorTarefa: 20
}, dep.config().pedidos || {});

const DIR = () => path.join(dep.ROOT, 'data', 'pedidos');
const arq = id => path.join(DIR(), id + '.json');
const agora = () => Date.now();
const slug = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'cliente';

/* ---------------- disco ---------------- */
function gravar(p) {
  fs.mkdirSync(DIR(), { recursive: true });
  p.atualizado = agora();
  fs.writeFileSync(arq(p.id), JSON.stringify(p, null, 2));
}
function ler(id) {
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  try { return JSON.parse(fs.readFileSync(arq(id), 'utf8')); } catch (e) { return null; }
}
function todos() {
  let nomes = [];
  try { nomes = fs.readdirSync(DIR()).filter(n => n.endsWith('.json')); } catch (e) { return []; }
  return nomes.map(n => ler(n.slice(0, -5))).filter(Boolean).sort((a, b) => b.criado - a.criado);
}

/* ---------------- quem está na equipe ---------------- */
/* o time que vem com o escritório (js/roster.js), para quando a equipe
   ainda não foi gravada em data/equipe.json (o navegador é quem grava) */
const TIME_PADRAO = [
  ['frontend', 'Lucas', 'Front-end · React & Next.js'], ['backend', 'Marina', 'Back-end · Node & APIs'],
  ['fullstack', 'Rafa', 'Full-stack'], ['mobile', 'Bia', 'Mobile · React Native'],
  ['devops', 'Dani', 'DevOps & Cloud'], ['qa', 'Theo', 'QA & Testes'],
  ['design', 'Lia', 'UI/UX Design'], ['ia', 'Nico', 'Agentes de IA & Automação']
].map(([key, name, role]) => ({ key, name, role }));

function time() {
  const salva = dep.equipe() || [];
  return (salva.length ? salva : TIME_PADRAO).filter(a => !a.boss && a.key !== 'exemplo').map(a => ({
    chave: a.key || a.id, nome: a.name, cargo: a.role || ''
  }));
}
const membro = chave => time().find(m => m.chave === chave) || null;

/* ---------------- uma sessão do Claude Code ---------------- */
function claude(p, { prompt, papel, modo, maxTurnos, minutos }) {
  return new Promise(resolve => {
    const args = ['-p', '--output-format', 'json', '--permission-mode', modo,
                  '--max-turns', String(maxTurnos), '--append-system-prompt', papel];
    if (modo === 'acceptEdits') {
      // fora editar arquivo, só os comandos de quem monta um projeto web
      args.push('--allowedTools', 'Bash(npm:*)', 'Bash(npx:*)', 'Bash(node:*)', 'Bash(git:*)',
                'Bash(ls:*)', 'Bash(mkdir:*)', 'Bash(cat:*)');
    }
    if (CFG().modelo) args.push('--model', CFG().modelo);
    let proc;
    try { proc = spawn(dep.CLAUDE_BIN, args, { cwd: p.pasta, env: process.env, stdio: ['pipe', 'pipe', 'pipe'] }); }
    catch (e) { return resolve({ texto: null, erro: 'não consegui executar o claude: ' + e.message, custo: 0 }); }
    rodando.set(p.id, proc);
    let saida = '', erro = '';
    const prazo = setTimeout(() => { try { proc.kill(); } catch (e) { /* já saiu */ } }, minutos * 60000);
    proc.stdin.on('error', () => {});
    proc.stdin.end(prompt, 'utf8');
    proc.stdout.on('data', d => { saida += d; });
    proc.stderr.on('data', d => { erro += d; });
    proc.on('error', e => { clearTimeout(prazo); rodando.delete(p.id); resolve({ texto: null, erro: e.message, custo: 0 }); });
    proc.on('exit', code => {
      clearTimeout(prazo); rodando.delete(p.id);
      let j = null;
      try { j = JSON.parse(saida); } catch (e) { /* não veio JSON */ }
      if (!j) return resolve({ texto: null, custo: 0,
        erro: code === null ? 'passou do tempo e foi interrompido' : (erro || saida || 'sem resposta').slice(0, 400) });
      const texto = String(j.result || '').trim();
      if (/not logged in|please run \/login/i.test(texto))
        return resolve({ texto: null, custo: 0, erro: 'O Claude Code não está logado nesta máquina (rode "claude" no terminal e faça login).' });
      resolve({ texto, custo: +j.total_cost_usd || 0, erro: j.is_error ? (texto || 'erro do claude').slice(0, 400) : null });
    });
  });
}

const empresa = () => {
  const c = dep.config();
  return (c.nome || 'Nassa Tech') + (c.empresa ? ' (' + c.empresa + ')' : '');
};

/* ---------------- 1. criar ---------------- */
function criar({ cliente, texto }) {
  cliente = String(cliente || '').trim().slice(0, 60);
  texto = String(texto || '').trim().slice(0, 20000);
  if (!cliente) return { ok: false, motivo: 'diga o nome do cliente' };
  if (texto.length < 15) return { ok: false, motivo: 'descreva o que o cliente pediu (pelo menos uma frase)' };
  if (!time().length) return { ok: false, motivo: 'não há agentes contratados para trabalhar no pedido' };

  const base = slug(cliente);
  let pasta = path.join(CFG().pasta, base), n = 2;
  while (fs.existsSync(path.join(pasta, 'PEDIDO.md'))) pasta = path.join(CFG().pasta, base + '-' + n++);
  try {
    fs.mkdirSync(pasta, { recursive: true });
    fs.writeFileSync(path.join(pasta, 'PEDIDO.md'),
      `# Pedido de ${cliente}\n\nRecebido em ${new Date().toLocaleString('pt-BR')}.\n\n${texto}\n`);
    if (!fs.existsSync(path.join(pasta, '.git')))
      spawn('git', ['init', '-q'], { cwd: pasta, stdio: 'ignore' }).on('error', () => {});
  } catch (e) { return { ok: false, motivo: 'não consegui criar a pasta ' + pasta + ': ' + e.message }; }

  const id = base + '-' + agora().toString(36);
  const p = { id, cliente, texto, pasta, criado: agora(), estado: 'planejando', custo: 0,
              limiteUSD: CFG().limiteUSD, plano: null, ajustes: [], historico: [], erro: null };
  marca(p, 'Pedido recebido. Duda e Rafa estão montando o plano.');
  gravar(p);
  planejar(p);
  return { ok: true, pedido: p };
}

function marca(p, txt) { p.historico.push({ quando: agora(), txt }); }

/* ---------------- 2. planejar ---------------- */
async function planejar(p, ajuste) {
  p.estado = 'planejando'; p.erro = null; gravar(p);
  const equipe = time();
  const lista = equipe.map(m => `- ${m.chave}: ${m.nome} — ${m.cargo}`).join('\n');
  const prompt =
`PEDIDO DO CLIENTE "${p.cliente}":
"""
${p.texto}
"""
${ajuste ? `\nO CEO pediu este ajuste no plano anterior:\n"""\n${ajuste}\n"""\nPlano anterior: ${JSON.stringify(p.plano)}\n` : ''}
EQUIPE DISPONÍVEL (use só estas chaves):
${lista}

Monte o plano de execução. Regras:
- de 2 a 7 tarefas, na ordem em que devem ser feitas; cada uma com UM responsável da equipe;
- tarefas concretas e verificáveis, que um agente de IA consiga fazer sozinho nesta pasta (código, textos, design em CSS);
- se o projeto for web, a entrega precisa abrir com um index.html na raiz da pasta (sem precisar de servidor);
- se houver alguém de QA, a última tarefa é dele: testar tudo e corrigir o que estiver quebrado;
- nada de publicar, cobrar, mandar e-mail ou mensagem: isso é com o CEO.

Responda SÓ com um bloco \`\`\`json neste formato:
{"resumo": "o que vamos entregar, em 2 frases",
 "prazo": "estimativa em dias úteis para uma equipe humana",
 "orcamento": "faixa de preço sugerida em R$ para o cliente",
 "perguntas": ["dúvidas para confirmar com o cliente, se houver"],
 "tarefas": [{"agente": "chave", "titulo": "curto", "descricao": "o que fazer, com critério de pronto"}]}`;
  const papel = `Você é a Duda (comercial) junto com o Rafa (full-stack) da ${empresa()}, numa reunião de planejamento. ` +
    'Responda em português do Brasil. Você não altera nenhum arquivo: só lê a pasta (PEDIDO.md) e planeja.';
  const r = await claude(p, { prompt, papel, modo: 'plan', maxTurnos: 6, minutos: 8 });
  p = ler(p.id) || p;
  if (p.estado === 'cancelado') return;
  p.custo += r.custo;
  if (r.erro || !r.texto) return falhou(p, 'O planejamento falhou: ' + (r.erro || 'sem resposta'));
  const m = r.texto.match(/```json\s*([\s\S]*?)```/) || r.texto.match(/(\{[\s\S]*\})/);
  let plano = null;
  try { plano = JSON.parse(m ? m[1] : r.texto); } catch (e) { /* tratado abaixo */ }
  const validas = plano && Array.isArray(plano.tarefas)
    ? plano.tarefas.filter(t => t && membro(t.agente) && t.titulo).slice(0, 8) : [];
  if (!validas.length) return falhou(p, 'O plano veio num formato que não entendi. Peça um ajuste ou tente de novo.');
  p.plano = {
    resumo: String(plano.resumo || ''), prazo: String(plano.prazo || ''), orcamento: String(plano.orcamento || ''),
    perguntas: (plano.perguntas || []).map(String).slice(0, 6),
    tarefas: validas.map(t => ({ agente: t.agente, quem: membro(t.agente).nome, titulo: String(t.titulo).slice(0, 90),
      descricao: String(t.descricao || '').slice(0, 1500), estado: 'pendente', resumo: null, custo: 0 }))
  };
  p.estado = 'aguardando-plano';
  marca(p, 'Plano pronto: ' + p.plano.tarefas.length + ' tarefas. Aguardando a sua aprovação.');
  gravar(p);
  dep.avisar('Plano pronto · ' + p.cliente, 'O plano do pedido de ' + p.cliente + ' está pronto para você aprovar no escritório.', 'normal');
}

function falhou(p, motivo) {
  p.estado = 'erro'; p.erro = motivo; marca(p, motivo); gravar(p);
  dep.avisar('Pedido parado · ' + p.cliente, motivo, 'alta');
}

/* ---------------- 4. executar ---------------- */
async function executar(id) {
  let p = ler(id);
  if (!p || rodando.has(id)) return;
  p.estado = 'executando'; p.erro = null; gravar(p);
  for (let i = 0; i < p.plano.tarefas.length; i++) {
    p = ler(id);
    if (!p || p.estado !== 'executando') return;            // cancelado ou pausado no meio
    const t = p.plano.tarefas[i];
    if (t.estado === 'feita') continue;
    if (p.custo >= p.limiteUSD) {
      p.estado = 'pausado';
      p.erro = `Chegou no limite de gasto deste pedido (US$ ${p.limiteUSD.toFixed(2)}). Continue para liberar mais US$ ${CFG().limiteUSD.toFixed(2)}.`;
      marca(p, p.erro); gravar(p);
      dep.avisar('Pedido pausado · ' + p.cliente, p.erro, 'alta');
      return;
    }
    const m = membro(t.agente) || { nome: t.quem, cargo: '' };
    t.estado = 'fazendo'; t.inicio = agora(); marca(p, `${m.nome} começou: ${t.titulo}`); gravar(p);

    const feitas = p.plano.tarefas.slice(0, i).filter(x => x.resumo)
      .map(x => `- ${x.quem} (${x.titulo}): ${x.resumo}`).join('\n') || '- (você é o primeiro)';
    const prompt =
`PEDIDO DO CLIENTE "${p.cliente}" (também em PEDIDO.md):
"""
${p.texto}
"""
PLANO APROVADO PELO CEO: ${p.plano.resumo}
${p.ajustes.length ? 'AJUSTES PEDIDOS PELO CEO:\n' + p.ajustes.map(a => '- ' + a).join('\n') + '\n' : ''}
O QUE OS COLEGAS JÁ FIZERAM:
${feitas}

SUA TAREFA (${i + 1} de ${p.plano.tarefas.length}): ${t.titulo}
${t.descricao}

Faça a tarefa de verdade, nesta pasta. Quando terminar, acrescente ao ENTREGA.md uma seção
"## ${m.nome} — ${t.titulo}" dizendo o que fez e como conferir, e responda com um resumo de 2 a 4 linhas.`;
    const papel = `Você é ${m.nome}, ${m.cargo}, da ${empresa()}. Trabalhe só dentro desta pasta. ` +
      'Português do Brasil. Faça um trabalho profissional e completo, sem placeholders nem lorem ipsum. ' +
      'Não publique nada na internet, não mande mensagens e não instale programas globais.';
    const r = await claude(p, { prompt, papel, modo: 'acceptEdits', maxTurnos: 40, minutos: CFG().minutosPorTarefa });

    p = ler(id);
    if (!p) return;
    const tt = p.plano.tarefas[i];
    p.custo += r.custo; tt.custo = r.custo; tt.fim = agora();
    if (p.estado === 'cancelado') { tt.estado = 'interrompida'; gravar(p); return; }
    if (r.erro || !r.texto) {
      tt.estado = 'falhou'; tt.resumo = null; tt.erro = r.erro || 'sem resposta';
      return falhou(p, `${m.nome} não conseguiu terminar "${tt.titulo}": ${tt.erro}`);
    }
    tt.estado = 'feita'; tt.resumo = r.texto.slice(0, 1200);
    marca(p, `${m.nome} terminou: ${tt.titulo}`);
    gravar(p);
  }
  p = ler(id);
  if (!p || p.estado !== 'executando') return;
  p.estado = 'aguardando-entrega';
  marca(p, 'Tudo pronto. Aguardando você revisar e aprovar a entrega.');
  gravar(p);
  dep.avisar('Entrega pronta · ' + p.cliente,
    `O projeto de ${p.cliente} está pronto para você revisar no escritório (US$ ${p.custo.toFixed(2)} de IA).`, 'normal');
}

/* ---------------- ações do CEO ---------------- */
function acao(id, nome, texto) {
  const p = ler(id);
  if (!p) return { ok: false, motivo: 'pedido não encontrado' };
  texto = String(texto || '').trim().slice(0, 4000);
  const ocupado = rodando.has(id);

  if (nome === 'aprovar-plano') {
    if (p.estado !== 'aguardando-plano') return { ok: false, motivo: 'o plano não está esperando aprovação' };
    marca(p, 'O CEO aprovou o plano.'); p.estado = 'executando'; gravar(p);
    executar(id); return { ok: true };
  }
  if (nome === 'ajustar-plano') {
    if (!['aguardando-plano', 'erro'].includes(p.estado) || ocupado) return { ok: false, motivo: 'agora não dá para ajustar o plano' };
    if (!texto) return { ok: false, motivo: 'diga o que mudar no plano' };
    marca(p, 'O CEO pediu ajuste no plano: ' + texto); gravar(p);
    planejar(p, texto); return { ok: true };
  }
  if (nome === 'continuar') {
    if (!['pausado', 'erro'].includes(p.estado) || ocupado) return { ok: false, motivo: 'não há o que continuar' };
    if (!p.plano) { planejar(p); return { ok: true }; }
    if (p.custo >= p.limiteUSD) p.limiteUSD = p.custo + CFG().limiteUSD;
    p.plano.tarefas.forEach(t => { if (t.estado !== 'feita') t.estado = 'pendente'; });
    marca(p, 'O CEO mandou continuar.'); p.estado = 'executando'; gravar(p);
    executar(id); return { ok: true };
  }
  if (nome === 'ajustar-entrega') {
    if (p.estado !== 'aguardando-entrega') return { ok: false, motivo: 'a entrega ainda não está pronta' };
    if (!texto) return { ok: false, motivo: 'diga o que precisa mudar' };
    p.ajustes.push(texto);
    // o ajuste vai para quem construiu: quem tem mais tarefas e, no empate, o
    // dono da última tarefa que não é de teste (quem montou o que você está vendo)
    const conta = {};
    p.plano.tarefas.forEach(t => { conta[t.agente] = (conta[t.agente] || 0) + 1; });
    const max = Math.max(...Object.values(conta));
    const obra = p.plano.tarefas.filter(t => t.agente !== 'qa' && conta[t.agente] === max);
    const quem = (obra.length ? obra[obra.length - 1] : p.plano.tarefas[p.plano.tarefas.length - 1]).agente;
    p.plano.tarefas.push({ agente: quem, quem: (membro(quem) || {}).nome || quem, titulo: 'Ajuste pedido pelo CEO',
      descricao: texto, estado: 'pendente', resumo: null, custo: 0 });
    marca(p, 'O CEO pediu ajuste na entrega: ' + texto);
    p.estado = 'executando'; gravar(p);
    executar(id); return { ok: true };
  }
  if (nome === 'aprovar-entrega') {
    if (p.estado !== 'aguardando-entrega') return { ok: false, motivo: 'a entrega ainda não está pronta' };
    p.estado = 'aprovado'; marca(p, 'O CEO aprovou a entrega.'); gravar(p);
    // fotografa a entrega no git do projeto; sem nome configurado no git, assina como o escritório
    const commit = extra => spawn('git', [...extra, 'commit', '-q', '-m', 'Entrega aprovada pelo CEO'],
      { cwd: p.pasta, stdio: 'ignore' }).on('error', () => {});
    spawn('git', ['add', '-A'], { cwd: p.pasta, stdio: 'ignore' }).on('error', () => {}).on('exit', () =>
      commit([]).on('exit', code => { if (code) commit(['-c', 'user.name=Escritório Nassa Tech', '-c', 'user.email=escritorio@localhost']); }));
    return { ok: true };
  }
  if (nome === 'cancelar') {
    if (['aprovado', 'cancelado'].includes(p.estado)) return { ok: false, motivo: 'esse pedido já terminou' };
    p.estado = 'cancelado'; marca(p, 'O CEO cancelou o pedido.'); gravar(p);
    const proc = rodando.get(id); if (proc) { try { proc.kill(); } catch (e) { /* já saiu */ } }
    return { ok: true };
  }
  return { ok: false, motivo: 'ação desconhecida' };
}

/* o que a tela recebe: sem o texto inteiro do pedido na lista */
function resumo(p) {
  const tarefas = p.plano ? p.plano.tarefas : [];
  const atual = tarefas.find(t => t.estado === 'fazendo');
  return { id: p.id, cliente: p.cliente, estado: p.estado, criado: p.criado, atualizado: p.atualizado,
           custo: p.custo, feitas: tarefas.filter(t => t.estado === 'feita').length, total: tarefas.length,
           agora: atual ? { quem: atual.quem, agente: atual.agente, titulo: atual.titulo } : null };
}
function detalhe(id) {
  const p = ler(id);
  if (!p) return null;
  return Object.assign({}, p, { temIndex: fs.existsSync(path.join(p.pasta, 'index.html')),
                                rodando: rodando.has(id) });
}

/** arquivo da entrega, para ver no navegador (só leitura, só dentro da pasta do pedido) */
function arquivoDaEntrega(id, rel) {
  const p = ler(id);
  if (!p) return null;
  const alvo = path.resolve(p.pasta, '.' + path.sep + (rel || 'index.html'));
  if (!alvo.startsWith(path.resolve(p.pasta) + path.sep) || alvo.includes(path.sep + '.git' + path.sep)) return null;
  return alvo;
}

/* escritório reiniciado no meio de uma etapa: o processo morreu junto */
function retomar() {
  for (const p of todos()) {
    if (p.estado === 'planejando') { marca(p, 'O escritório reiniciou durante o planejamento; recomeçando.'); gravar(p); planejar(p); }
    else if (p.estado === 'executando') {
      p.plano.tarefas.forEach(t => { if (t.estado === 'fazendo') t.estado = 'pendente'; });
      p.estado = 'pausado'; p.erro = 'O escritório reiniciou no meio do trabalho. Clique em Continuar.';
      marca(p, p.erro); gravar(p);
    }
  }
}

module.exports = {
  init(d) { dep = d; setTimeout(retomar, 2000); return module.exports; },
  criar, acao, detalhe, arquivoDaEntrega,
  lista: () => todos().map(resumo),
  ativos: () => todos().filter(p => ['planejando', 'executando'].includes(p.estado)).map(resumo),
  pasta: () => CFG().pasta
};
