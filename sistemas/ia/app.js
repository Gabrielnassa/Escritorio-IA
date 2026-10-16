/* ===========================================================
   sistemas/ia/app.js — Central de Agentes (Nico)

   Três partes, todas salvas em NT.dados('ia'):
   - Automações: gatilho → condição → ações, com execução simulada
     passo a passo e histórico das últimas 50 execuções.
   - Atendente: a Nassa, que responde pela base de conhecimento
     (palavras-chave com tolerância a acento, plural e erro de digitação).
   - Base de conhecimento: intenções editáveis e as perguntas que a
     Nassa não soube responder, para virar intenção nova.
   =========================================================== */
(() => {
  const D = NT.dados('ia');
  const $ = s => document.querySelector(s);
  const esc = NT.esc;
  const MAX_HIST = 50;
  const LIMIAR = 0.45; // abaixo disso a Nassa admite que não sabe (melhor que chutar)

  /* ---------- sorteio: Math.random ao vivo, semente fixa no exemplo ---------- */
  let R = Math.random;
  function semente(a) { // mulberry32: o exemplo sai igual em toda máquina
    return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const entre = (a, b) => Math.round(a + R() * (b - a));
  const um = lista => lista[Math.floor(R() * lista.length)];

  /* ---------- quem aparece nos logs ---------- */
  const CLIENTES = [
    { nome: 'Padaria Pão de Mel', contato: 'Sr. Antônio', dominio: 'paodemel.com.br' },
    { nome: 'Clínica Sorriso', contato: 'Dra. Fernanda', dominio: 'clinicasorriso.com.br' },
    { nome: 'Advocacia Duarte', contato: 'Dr. Ricardo Duarte', dominio: 'duarteadvocacia.adv.br' },
    { nome: 'Academia Força Total', contato: 'Juliana', dominio: 'forcatotal.fit' },
    { nome: 'Imobiliária Horizonte', contato: 'Marcos', dominio: 'horizonteimoveis.com.br' },
    { nome: 'Pet Shop Amigo Fiel', contato: 'Carla', dominio: 'amigofielpet.com.br' },
    { nome: 'Restaurante Sabor Mineiro', contato: 'Seu Zé', dominio: 'sabormineiro.com.br' },
    { nome: 'Escola Pequeno Saber', contato: 'Profa. Helena', dominio: 'pequenosaber.edu.br' }
  ];
  const SERVICOS = ['landing page', 'site institucional', 'loja virtual', 'sistema de agendamento', 'app de delivery', 'agente de IA no WhatsApp'];
  function contexto() {
    const c = um(CLIENTES);
    return Object.assign({}, c, {
      servico: um(SERVICOS), valor: um([2500, 4800, 7900, 12500, 18000, 390, 790]),
      meio: um(['Pix', 'cartão de crédito', 'boleto']), projeto: um(['portal-duarte', 'app-forcatotal', 'site-horizonte', 'agenda-sorriso']),
      dias: entre(5, 15), n: entre(1200, 1899), lead: entre(300, 999)
    });
  }

  /* ---------- catálogo de gatilhos e ações ---------- */
  const GATILHOS = [
    { id: 'lead_site', nome: 'Novo lead no site', p: c => `formulário de orçamento do nassatech.com.br — ${c.nome} (${c.contato}), quer ${c.servico}` },
    { id: 'form_contato', nome: 'Formulário de contato enviado', p: c => `${c.contato}, de ${c.nome}, escreveu pelo site` },
    { id: 'pagamento', nome: 'Pagamento aprovado', p: c => `${c.nome} pagou ${NT.brl(c.valor)} via ${c.meio}` },
    { id: 'seg9', nome: 'Toda segunda às 9h', p: () => 'agendamento semanal disparado (segunda, 09:00, horário de Brasília)' },
    { id: 'dia18', nome: 'Todo dia às 18h', p: () => 'agendamento diário disparado (18:00, fim do expediente)' },
    { id: 'deploy_erro', nome: 'Erro no deploy', p: c => `pipeline de ${c.projeto} falhou na etapa “testes” (exit code 1)` },
    { id: 'whats_msg', nome: 'Mensagem recebida no WhatsApp', p: c => `${c.contato} (${c.nome}) mandou mensagem às ${NT.hora().slice(0, 5)}` },
    { id: 'contrato', nome: 'Contrato assinado', p: c => `${c.nome} assinou o contrato de ${c.servico} (${NT.brl(c.valor)})` },
    { id: 'ssl', nome: 'Certificado SSL vencendo', p: c => `certificado de ${c.dominio} vence em ${c.dias} dias` },
    { id: 'chamado', nome: 'Chamado de suporte aberto', p: c => `${c.nome} abriu chamado: “site fora do ar desde cedo”` }
  ];
  const ACOES = [
    { id: 'crm', nome: 'Criar lead no CRM', f: .04, ok: c => `lead #${c.lead} “${c.nome}” criado na etapa Novo`, err: () => 'CRM recusou o cadastro: telefone em formato inválido' },
    { id: 'whats_duda', nome: 'WhatsApp para a Duda', f: .06, ok: c => `mensagem entregue à Duda: “Novo lead — ${c.nome}, quer ${c.servico}”`, err: () => 'WhatsApp Business respondeu 429 (limite de envios por minuto)' },
    { id: 'whats_cliente', nome: 'Responder cliente no WhatsApp', f: .05, ok: c => `resposta enviada para ${c.contato}`, err: () => 'número sem WhatsApp ativo' },
    { id: 'nassa', nome: 'Responder com a Nassa (IA)', f: .03, ok: () => `a Nassa respondeu em ${entre(11, 29) / 10} s com confiança de ${entre(72, 96)}%`.replace('.', ','), err: () => 'pergunta fora da base — encaminhada para humano' },
    { id: 'email_cliente', nome: 'E-mail para o cliente', f: .04, ok: c => `e-mail entregue para contato@${c.dominio}`, err: () => 'servidor SMTP não respondeu em 10 s' },
    { id: 'email_gabriel', nome: 'E-mail para o Gabriel', f: .02, ok: () => 'e-mail entregue para gabriel@nassatech.com.br', err: () => 'caixa de saída bloqueada pelo provedor (cota diária)' },
    { id: 'nf', nome: 'Emitir nota fiscal', f: .08, ok: c => `NFS-e nº ${c.n} emitida na Prefeitura de São Paulo — ${NT.brl(c.valor)}`, err: () => 'Prefeitura de São Paulo fora do ar (timeout na emissão da NFS-e)' },
    { id: 'planilha', nome: 'Lançar na planilha financeira', f: .02, ok: c => `recebimento de ${c.nome} lançado na planilha Financeiro 2026`, err: () => 'planilha em uso por outra pessoa, tente de novo' },
    { id: 'relatorio', nome: 'Gerar relatório da semana (PDF)', f: .03, ok: () => `relatório gerado: ${entre(6, 19)} leads, ${entre(4, 9)} projetos em andamento, ${NT.brl(entre(18, 64) * 1000)} faturado`, err: () => 'falta o fechamento do CRM desta semana' },
    { id: 'push_dani', nome: 'Alerta no celular do Dani', f: .03, ok: () => 'notificação push entregue no celular do Dani (prioridade alta)', err: () => 'celular do Dani sem conexão — alerta ficou na fila' },
    { id: 'grupo', nome: 'Avisar no grupo da equipe', f: .02, ok: () => 'mensagem postada no grupo #operacao', err: () => 'token do grupo expirado' },
    { id: 'rollback', nome: 'Voltar para a última versão estável', f: .1, ok: c => `rollback concluído: ${c.projeto} voltou para a versão anterior`, err: () => 'imagem anterior não encontrada no registro' },
    { id: 'resumo_ia', nome: 'Resumir com agente de IA', f: .04, ok: c => `agente classificou: interesse em ${c.servico}, urgência média; resumo anexado`, err: () => 'texto vazio — nada para resumir' },
    { id: 'tarefa', nome: 'Criar tarefa no Gestor de Projetos', f: .03, ok: c => `tarefa criada no backlog de ${c.nome} (responsável: Rafa)`, err: () => 'projeto do cliente não encontrado no quadro' }
  ];
  const gat = id => GATILHOS.find(g => g.id === id) || { id, nome: 'Gatilho removido', p: () => '' };
  const acao = id => ACOES.find(a => a.id === id) || { id, nome: 'Ação removida', f: 1, ok: () => '', err: () => 'ação não existe mais' };

  /* ---------- simulação: a mesma usada no exemplo e no “Executar agora” ---------- */
  function simular(a) {
    const c = contexto(), passos = [];
    passos.push({ txt: `Gatilho “${gat(a.gatilho).nome}”: ${gat(a.gatilho).p(c)}`, ok: true, ms: entre(90, 260) });
    if (a.condicao) passos.push({ txt: `Condição “${a.condicao}” → verdadeira`, ok: true, ms: entre(40, 140) });
    let falhou = false;
    a.acoes.forEach((id, i) => {
      const x = acao(id);
      if (falhou) { passos.push({ txt: `${i + 1}. ${x.nome}: não executada (passo anterior falhou)`, ok: null, ms: 0 }); return; }
      const ok = R() >= x.f;
      passos.push({ txt: `${i + 1}. ${x.nome}: ${ok ? x.ok(c) : x.err(c)}`, ok, ms: entre(280, 1400) });
      if (!ok) falhou = true;
    });
    return { status: falhou ? 'erro' : 'ok', passos, duracao: passos.reduce((s, p) => s + p.ms, 0) };
  }

  /* ---------- exemplo inicial ---------- */
  const EX_AUTOS = [
    { nome: 'Lead do site → WhatsApp da Duda', gatilho: 'lead_site', condicao: 'orçamento estimado acima de R$ 2.000', acoes: ['crm', 'whats_duda', 'email_cliente'], ativa: true, execucoes: 214, sucessos: 209 },
    { nome: 'Pagamento aprovado → nota fiscal + e-mail', gatilho: 'pagamento', condicao: '', acoes: ['nf', 'email_cliente', 'planilha'], ativa: true, execucoes: 96, sucessos: 90 },
    { nome: 'Formulário de contato → CRM', gatilho: 'form_contato', condicao: '', acoes: ['crm', 'resumo_ia'], ativa: true, execucoes: 158, sucessos: 156 },
    { nome: 'Toda segunda 9h → relatório para o Gabriel', gatilho: 'seg9', condicao: '', acoes: ['relatorio', 'email_gabriel'], ativa: true, execucoes: 41, sucessos: 41 },
    { nome: 'Erro no deploy → alerta no celular do Dani', gatilho: 'deploy_erro', condicao: 'ambiente = produção', acoes: ['push_dani', 'grupo', 'rollback'], ativa: true, execucoes: 12, sucessos: 11 },
    { nome: 'WhatsApp fora do horário → Nassa responde', gatilho: 'whats_msg', condicao: 'fora do horário comercial (antes das 9h ou depois das 18h)', acoes: ['nassa', 'crm'], ativa: true, execucoes: 530, sucessos: 514 },
    { nome: 'SSL vencendo → tarefa para a equipe', gatilho: 'ssl', condicao: 'faltam 15 dias ou menos', acoes: ['tarefa', 'push_dani'], ativa: false, execucoes: 3, sucessos: 3 }
  ];

  const EX_INTENTS = [
    { nome: 'saudação', palavras: ['oi', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'e ai', 'tudo bem', 'opa'],
      resposta: 'Oi! Eu sou a Nassa, atendente virtual da Nassa Tech. Posso te contar sobre nossos serviços, preços, prazos ou onde ficamos. Como posso ajudar?',
      sugestoes: ['Quais serviços vocês fazem?', 'Quanto custa um site?', 'Onde fica o escritório?'] },
    { nome: 'serviços', palavras: ['servico', 'fazem', 'trabalham', 'oferecem', 'site', 'sistema', 'aplicativo', 'app', 'desenvolvimento', 'landing page', 'loja virtual', 'ecommerce'],
      resposta: 'A Nassa Tech é uma software house: criamos sites e landing pages, sistemas web sob medida, aplicativos Android e iOS, automações e agentes de IA para atendimento. Tudo feito pela nossa equipe em São Paulo.',
      sugestoes: ['Quanto custa?', 'Qual o prazo de entrega?', 'Como funcionam os agentes de IA?'] },
    { nome: 'preços e orçamento', palavras: ['preco', 'quanto custa', 'valor', 'orcamento', 'custo', 'investimento', 'cobram', 'parcelar', 'pagamento'],
      resposta: 'Cada projeto tem orçamento próprio, mas para ter uma ideia: landing page a partir de R$ 2.500, site institucional a partir de R$ 4.800, sistemas web a partir de R$ 18.000 e apps a partir de R$ 25.000. Parcelamos em até 6x. Quer que a Duda, do comercial, monte uma proposta sem compromisso?',
      sugestoes: ['Quero falar com a Duda', 'Qual o prazo de entrega?', 'Vocês fazem manutenção?'] },
    { nome: 'prazo', palavras: ['prazo', 'demora', 'quanto tempo', 'entrega', 'pronto', 'rapido', 'urgente', 'semanas'],
      resposta: 'Landing pages ficam prontas em 7 a 10 dias úteis; sites institucionais em 3 a 4 semanas; sistemas e apps entre 6 e 12 semanas, com entregas parciais a cada 15 dias para você acompanhar tudo.',
      sugestoes: ['Quanto custa?', 'Falar com um humano'] },
    { nome: 'localização', palavras: ['onde', 'endereco', 'localizacao', 'fica', 'faria lima', 'escritorio', 'visitar', 'sao paulo', 'chegar'],
      resposta: 'Estamos na Torre B32, Av. Brigadeiro Faria Lima, em São Paulo. Recebemos clientes com hora marcada e também atendemos o Brasil inteiro por videochamada.',
      sugestoes: ['Qual o horário de atendimento?', 'Falar com um humano'] },
    { nome: 'horário', palavras: ['horario', 'abre', 'fecha', 'funcionamento', 'expediente', 'sabado', 'domingo', 'feriado', 'que horas'],
      resposta: 'Atendemos de segunda a sexta, das 9h às 18h. Fora desse horário eu continuo por aqui e a equipe responde no próximo dia útil. Clientes com contrato de manutenção têm plantão para urgências.',
      sugestoes: ['Onde fica o escritório?', 'Vocês fazem manutenção?'] },
    { nome: 'falar com humano', palavras: ['humano', 'pessoa', 'atendente', 'falar com alguem', 'vendedor', 'comercial', 'telefone', 'whatsapp', 'contato', 'duda', 'ligar'],
      resposta: 'Claro! Vou passar seu contato para a Duda, do nosso comercial. Ela responde pelo WhatsApp em horário comercial, normalmente em menos de 1 hora. Se preferir, deixe aqui seu nome e telefone.',
      sugestoes: ['Quanto custa um site?', 'Onde fica o escritório?'] },
    { nome: 'agentes de IA', palavras: ['ia', 'inteligencia artificial', 'agente', 'chatbot', 'robo', 'bot', 'automacao', 'automatizar', 'gpt', 'atendimento automatico'],
      resposta: 'Criamos agentes de IA que atendem seus clientes no WhatsApp e no site 24 horas, respondem com base nas informações do seu negócio, agendam horários e passam para um humano quando precisa. Eu mesma sou um exemplo! Também automatizamos tarefas repetitivas, como emitir nota fiscal e mandar relatórios.',
      sugestoes: ['Quanto custa um agente de IA?', 'Qual o prazo de entrega?'] },
    { nome: 'manutenção', palavras: ['manutencao', 'suporte', 'atualizacao', 'bug', 'erro', 'problema', 'quebrou', 'fora do ar', 'saiu do ar', 'caiu', 'travou', 'nao funciona', 'hospedagem', 'backup', 'seguranca'],
      resposta: 'Temos planos de manutenção a partir de R$ 390 por mês: hospedagem, backups diários, atualizações de segurança, monitoramento 24h e pequenos ajustes. Se algo estiver com problema agora, me conte o que aconteceu que eu aviso o Dani, nosso DevOps.',
      sugestoes: ['Falar com um humano', 'Quanto custa um site?'] },
    { nome: 'portfólio', palavras: ['portfolio', 'clientes', 'trabalhos', 'exemplos', 'cases', 'projetos feitos'],
      resposta: 'Já entregamos projetos para a Padaria Pão de Mel (cardápio e pedidos online), Clínica Sorriso (agendamento com lembrete no WhatsApp), Advocacia Duarte (portal do cliente), Academia Força Total (app de treinos) e Imobiliária Horizonte (site com busca de imóveis). Veja mais em nassatech.com.br.',
      sugestoes: ['Quanto custa?', 'Quais serviços vocês fazem?'] },
    { nome: 'agradecimento', palavras: ['obrigado', 'obrigada', 'valeu', 'agradeco', 'tchau', 'ate mais', 'perfeito'],
      resposta: 'Eu que agradeço! Se surgir qualquer dúvida, é só chamar. Até mais!',
      sugestoes: ['Quais serviços vocês fazem?'] }
  ];
  const USOS_EX = [41, 63, 88, 37, 22, 15, 29, 34, 18, 9, 26];

  const EX_PEND = [
    { texto: 'Vocês fazem integração com o iFood?', vezes: 3, h: 5 },
    { texto: 'Aceitam pagamento em criptomoeda?', vezes: 1, h: 20 },
    { texto: 'Tem vaga de estágio aí?', vezes: 2, h: 30 },
    { texto: 'Fazem gestão de tráfego pago no Instagram?', vezes: 4, h: 52 }
  ];

  function semear() {
    R = semente(2026);
    const autos = EX_AUTOS.map((a, i) => Object.assign({ id: 'a' + (i + 1), ultima: null }, JSON.parse(JSON.stringify(a))));
    const hist = [];
    const agora = Date.now();
    // execuções espalhadas nas últimas ~40 h, mais vezes nas automações que rodam muito
    const peso = ['a1', 'a1', 'a1', 'a2', 'a2', 'a3', 'a3', 'a6', 'a6', 'a6', 'a6', 'a5'];
    let t = agora - entre(4, 18) * 60e3;
    for (let i = 0; i < 44; i++) {
      const alvo = um(peso), a = autos.find(x => x.id === alvo);
      hist.push(Object.assign({ id: 'h' + i, autoId: a.id, nome: a.nome, quando: t, origem: 'automática' }, simular(a)));
      t -= entre(20, 70) * 60e3;
    }
    // o relatório roda de verdade na segunda às 9h
    const seg = new Date(); seg.setHours(9, 0, 0, 0);
    while (seg.getDay() !== 1 || seg.getTime() > agora) seg.setDate(seg.getDate() - 1);
    hist.push(Object.assign({ id: 'hs', autoId: 'a4', nome: autos[3].nome, quando: seg.getTime(), origem: 'automática' }, simular(autos[3])));
    hist.sort((x, y) => y.quando - x.quando);
    autos.forEach(a => {
      const h = hist.find(x => x.autoId === a.id);
      a.ultima = h ? h.quando : agora - entre(6, 12) * 86400e3;
    });
    R = Math.random;
    D.gravar('autos', autos);
    D.gravar('hist', hist.slice(0, MAX_HIST));
    D.gravar('intents', EX_INTENTS.map((x, i) => Object.assign({ id: 'i' + (i + 1), usos: USOS_EX[i] || 0 }, JSON.parse(JSON.stringify(x)))));
    D.gravar('pend', EX_PEND.map((p, i) => ({ id: 'p' + i, texto: p.texto, vezes: p.vezes, quando: agora - p.h * 3600e3 })));
    D.gravar('conversas', 128);
    D.gravar('conversa', []);
    D.gravar('contada', false);
    D.gravar('versao', 1);
  }
  if (!D.ler('versao', 0)) semear();

  /* ---------- estado ---------- */
  let autos = D.ler('autos', []), hist = D.ler('hist', []), intents = D.ler('intents', []), pend = D.ler('pend', []);
  let conversa = D.ler('conversa', []);
  const salvar = () => { D.gravar('autos', autos); D.gravar('hist', hist); };
  const salvarBase = () => { D.gravar('intents', intents); D.gravar('pend', pend); };
  const rodando = new Set();
  let filtro = 'todas';

  /* ---------- formatos ---------- */
  const hm = ms => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const mesmoDia = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
  function quando(ms) {
    if (!ms) return 'nunca';
    const d = Date.now() - ms;
    if (d < 60e3) return 'agora há pouco';
    if (d < 3600e3) return `há ${Math.floor(d / 60e3)} min`;
    if (mesmoDia(ms, Date.now())) return 'hoje, ' + hm(ms);
    if (mesmoDia(ms, Date.now() - 86400e3)) return 'ontem, ' + hm(ms);
    return new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ', ' + hm(ms);
  }
  const seg = ms => (ms / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' s';
  const pct = (a, b) => b ? a / b * 100 : 0;
  const pctTxt = v => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';

  /* ---------- KPIs ---------- */
  function renderKpis() {
    const ativas = autos.filter(a => a.ativa).length;
    const hoje = hist.filter(h => mesmoDia(h.quando, Date.now()));
    const exe = autos.reduce((s, a) => s + a.execucoes, 0), suc = autos.reduce((s, a) => s + a.sucessos, 0);
    const taxa = pct(suc, exe);
    const errHoje = hoje.filter(h => h.status === 'erro').length;
    $('#kpis').innerHTML = `
      <div class="kpi acc"><span>Automações ativas</span><b>${ativas}</b><small>de ${autos.length} cadastradas</small></div>
      <div class="kpi"><span>Execuções hoje</span><b>${hoje.length}</b><small>${errHoje ? errHoje + ' com erro' : 'nenhuma com erro'}</small></div>
      <div class="kpi ${taxa >= 95 ? 'ok' : taxa >= 85 ? 'warn' : 'err'}"><span>Taxa de sucesso</span><b>${exe ? pctTxt(taxa) : '—'}</b><small>${NT.num(exe)} execuções no total</small></div>
      <div class="kpi"><span>Conversas</span><b>${NT.num(D.ler('conversas', 0))}</b><small>${pend.length} pergunta${pend.length === 1 ? '' : 's'} sem resposta</small></div>`;
    $('#contPend').textContent = pend.length || '';
    $('#infoIntents').textContent = intents.length;
    $('#infoPend').textContent = pend.length;
  }

  /* ---------- automações ---------- */
  function fluxoHTML(a) {
    const nos = [`<span class="no gat"><i>Quando</i>${esc(gat(a.gatilho).nome)}</span>`];
    if (a.condicao) nos.push(`<span class="no cond"><i>Se</i>${esc(a.condicao)}</span>`);
    a.acoes.forEach((id, i) => nos.push(`<span class="no acao"><i>${i + 1}</i>${esc(acao(id).nome)}</span>`));
    return nos.join('<span class="seta" aria-hidden="true">→</span>');
  }

  function renderAutos() {
    const q = $('#buscaAuto').value.trim().toLowerCase();
    const lista = autos.filter(a => (filtro === 'todas' || (filtro === 'ligadas') === a.ativa) &&
      (!q || [a.nome, a.condicao, gat(a.gatilho).nome, ...a.acoes.map(x => acao(x).nome)].join(' ').toLowerCase().includes(q)));
    const el = $('#listaAuto');
    if (!lista.length) {
      el.innerHTML = `<div class="vazio">${autos.length ? 'Nenhuma automação com esse filtro.' : 'Nenhuma automação ainda. Crie a primeira em “Nova automação”.'}</div>`;
      return;
    }
    el.innerHTML = lista.map(a => {
      const t = pct(a.sucessos, a.execucoes), roda = rodando.has(a.id);
      return `<article class="card auto${a.ativa ? '' : ' desligada'}${roda ? ' rodando' : ''}" data-id="${a.id}">
        <div class="auto-cab">
          <div style="flex:1;min-width:0"><h3>${esc(a.nome)}</h3>
            <div class="sub">${roda ? '<span class="badge acc">executando…</span>' : a.ativa ? '<span class="ponto ok"></span> ligada' : '<span class="ponto"></span> desligada'}</div></div>
          <button type="button" class="chave" role="switch" aria-checked="${a.ativa}" aria-label="${a.ativa ? 'Desligar' : 'Ligar'} ${esc(a.nome)}" data-acao="toggle"></button>
        </div>
        <div class="fluxo">${fluxoHTML(a)}</div>
        <div class="auto-stats">
          <div><span>Última execução</span><b>${quando(a.ultima)}</b></div>
          <div><span>Execuções</span><b>${NT.num(a.execucoes)}</b></div>
          <div><span>Sucesso</span><b>${a.execucoes ? pctTxt(t) : '—'}</b>
            <div class="taxa ${t >= 95 ? '' : t >= 85 ? 'meio' : 'ruim'}"><i style="width:${a.execucoes ? t : 0}%"></i></div></div>
        </div>
        <div class="auto-acoes">
          <button type="button" class="btn mini primary" data-acao="exec"${roda ? ' disabled' : ''}>▶ Executar agora</button>
          <button type="button" class="btn mini" data-acao="edit">Editar</button>
          <button type="button" class="btn mini danger" data-acao="del">Excluir</button>
        </div>
      </article>`;
    }).join('');
  }

  $('#listaAuto').addEventListener('click', e => {
    const b = e.target.closest('[data-acao]'); if (!b) return;
    const id = b.closest('[data-id]').dataset.id, a = autos.find(x => x.id === id);
    if (!a) return;
    if (b.dataset.acao === 'toggle') {
      a.ativa = !a.ativa; salvar(); tudo();
      NT.aviso(`“${a.nome}” ${a.ativa ? 'ligada' : 'desligada'}.`);
      const nova = $(`#listaAuto [data-id="${id}"] .chave`); if (nova) nova.focus();
    } else if (b.dataset.acao === 'exec') executar(id);
    else if (b.dataset.acao === 'edit') abrirConstrutor(a);
    else if (b.dataset.acao === 'del') {
      if (!confirm(`Excluir a automação “${a.nome}”?\nO histórico de execuções dela continua na tabela.`)) return;
      autos = autos.filter(x => x.id !== id); salvar(); tudo();
      NT.aviso('Automação excluída.');
    }
  });

  document.querySelectorAll('.seg [data-filtro]').forEach(b => b.addEventListener('click', () => {
    filtro = b.dataset.filtro;
    document.querySelectorAll('.seg [data-filtro]').forEach(x => x.classList.toggle('on', x === b));
    renderAutos();
  }));
  $('#buscaAuto').addEventListener('input', renderAutos);

  /* ---------- executar agora: log aparece passo a passo ---------- */
  const espera = ms => new Promise(r => setTimeout(r, ms));
  let execVisivel = null; // qual execução o modal está mostrando
  let ultimaExecAuto = null;

  function linhaLog(p, t0) {
    const cls = p.ok === true ? 'passo-ok' : p.ok === false ? 'passo-err err' : 'dim';
    return `<div class="${cls}"><span class="dim">+${seg(t0)}</span> ${esc(p.txt)}</div>`;
  }
  function statusExec(h, nome, emAndamento) {
    $('#execStatus').innerHTML = `<b>${esc(nome)}</b>` + (emAndamento
      ? '<span class="badge acc">executando…</span>'
      : `<span class="badge ${h.status === 'ok' ? 'ok' : 'err'}">${h.status === 'ok' ? 'sucesso' : 'erro'}</span><span class="dim pequeno">${seg(h.duracao)} · ${quando(h.quando)} · ${esc(h.origem || 'manual')}</span>`);
  }

  async function executar(id) {
    const a = autos.find(x => x.id === id);
    if (!a || rodando.has(id)) return;
    const res = simular(a), marca = NT.id(), inicio = Date.now();
    rodando.add(id); renderAutos();
    execVisivel = marca; ultimaExecAuto = id;
    $('#tExec').textContent = 'Executando automação';
    statusExec(null, a.nome, true);
    $('#execLog').innerHTML = `<div class="dim">${a.ativa ? 'Execução manual iniciada por Nico.' : 'Automação desligada — execução manual só para teste.'}</div>`;
    $('#bRepetir').disabled = true;
    NT.modal($('#mExec'), true);
    let t = 0;
    for (const p of res.passos) {
      await espera(p.ok === null ? 120 : Math.min(900, Math.max(320, p.ms * .6)));
      t += p.ms;
      if (execVisivel === marca) { $('#execLog').insertAdjacentHTML('beforeend', linhaLog(p, t)); $('#execLog').scrollTop = 1e6; }
    }
    const reg = Object.assign({ id: NT.id(), autoId: id, nome: a.nome, quando: inicio, origem: 'manual' }, res);
    const atual = autos.find(x => x.id === id); // pode ter sido editada ou excluída no meio
    if (atual) { atual.execucoes++; if (res.status === 'ok') atual.sucessos++; atual.ultima = inicio; }
    hist.unshift(reg); hist = hist.slice(0, MAX_HIST);
    salvar(); rodando.delete(id); tudo();
    if (execVisivel === marca) {
      $('#tExec').textContent = 'Execução concluída';
      statusExec(reg, a.nome, false);
      $('#execLog').insertAdjacentHTML('beforeend', `<div class="${res.status === 'ok' ? 'ok' : 'err'}">${res.status === 'ok' ? 'Concluída com sucesso' : 'Parou com erro'} em ${seg(res.duracao)}.</div>`);
      $('#execLog').scrollTop = 1e6;
      $('#bRepetir').disabled = !atual;
    }
    NT.aviso(res.status === 'ok' ? `“${a.nome}” executada com sucesso.` : `“${a.nome}” parou com erro — veja o log.`);
  }

  function verLog(hid) {
    const h = hist.find(x => x.id === hid); if (!h) return;
    execVisivel = hid; ultimaExecAuto = h.autoId;
    $('#tExec').textContent = 'Log da execução';
    statusExec(h, h.nome, false);
    let t = 0;
    $('#execLog').innerHTML = h.passos.map(p => { t += p.ms; return linhaLog(p, t); }).join('') +
      `<div class="${h.status === 'ok' ? 'ok' : 'err'}">${h.status === 'ok' ? 'Concluída com sucesso' : 'Parou com erro'} em ${seg(h.duracao)}.</div>`;
    $('#bRepetir').disabled = !autos.some(a => a.id === h.autoId) || rodando.has(h.autoId);
    NT.modal($('#mExec'), true);
  }
  $('#bRepetir').addEventListener('click', () => { if (ultimaExecAuto) executar(ultimaExecAuto); });

  /* ---------- histórico ---------- */
  function renderHist() {
    const f = $('#filtroHist').value;
    const lista = hist.filter(h => !f || h.status === f);
    $('#corpoHist').innerHTML = lista.length ? lista.map(h => {
      const feitos = h.passos.filter(p => p.ok !== null).length;
      return `<tr>
        <td>${quando(h.quando)}</td>
        <td class="nome-auto">${esc(h.nome)}<div class="dim pequeno">${esc(h.origem || 'manual')}</div></td>
        <td><span class="badge ${h.status === 'ok' ? 'ok' : 'err'}">${h.status === 'ok' ? 'sucesso' : 'erro'}</span></td>
        <td class="mono c-opc">${seg(h.duracao)}</td>
        <td class="mono c-opc">${feitos}/${h.passos.length}</td>
        <td><button type="button" class="btn mini ghost" data-log="${h.id}">Ver log</button></td></tr>`;
    }).join('') : `<tr><td colspan="6"><div class="vazio">${hist.length ? 'Nenhuma execução com esse status.' : 'Nenhuma execução registrada ainda.'}</div></td></tr>`;
  }
  $('#corpoHist').addEventListener('click', e => { const b = e.target.closest('[data-log]'); if (b) verLog(b.dataset.log); });
  $('#filtroHist').addEventListener('change', renderHist);
  $('#bLimparHist').addEventListener('click', () => {
    if (!hist.length) { NT.aviso('O histórico já está vazio.'); return; }
    if (!confirm('Limpar todo o histórico de execuções?\nOs contadores de cada automação continuam.')) return;
    hist = []; salvar(); tudo(); NT.aviso('Histórico limpo.');
  });
  $('#bExportHist').addEventListener('click', () => {
    if (!hist.length) { NT.aviso('Nada para exportar.'); return; }
    const cel = v => `"${String(v).replace(/"/g, '""')}"`;
    const linhas = [['Data', 'Hora', 'Automação', 'Origem', 'Status', 'Duração (s)', 'Passos'].map(cel).join(';')]
      .concat(hist.map(h => [new Date(h.quando).toLocaleDateString('pt-BR'), hm(h.quando), h.nome, h.origem || 'manual',
        h.status === 'ok' ? 'sucesso' : 'erro', (h.duracao / 1000).toFixed(1).replace('.', ','), h.passos.length].map(cel).join(';')));
    NT.baixar('execucoes-automacoes.csv', '﻿' + linhas.join('\n'), 'text/csv;charset=utf-8');
  });

  /* ---------- construtor de automação ---------- */
  let rasc = null; // { id, acoes[] } da automação em edição
  $('#aGatilho').innerHTML = GATILHOS.map(g => `<option value="${g.id}">${esc(g.nome)}</option>`).join('');
  $('#aAcaoSel').innerHTML = ACOES.map(a => `<option value="${a.id}">${esc(a.nome)}</option>`).join('');

  function abrirConstrutor(a) {
    rasc = { id: a ? a.id : null, acoes: a ? a.acoes.slice() : [] };
    $('#tAuto').textContent = a ? 'Editar automação' : 'Nova automação';
    $('#aNome').value = a ? a.nome : '';
    $('#aGatilho').value = a ? a.gatilho : 'lead_site';
    $('#aCond').value = a ? a.condicao : '';
    $('#aErro').textContent = '';
    renderRasc();
    NT.modal($('#mAuto'), true);
  }
  function renderRasc() {
    $('#aAcoes').innerHTML = rasc.acoes.length ? rasc.acoes.map((id, i) => `<li><span>${esc(acao(id).nome)}</span>
      <button type="button" class="btn mini ghost icone" data-mov="${i}" data-d="-1" aria-label="Subir ${esc(acao(id).nome)}"${i ? '' : ' disabled'}>↑</button>
      <button type="button" class="btn mini ghost icone" data-mov="${i}" data-d="1" aria-label="Descer ${esc(acao(id).nome)}"${i < rasc.acoes.length - 1 ? '' : ' disabled'}>↓</button>
      <button type="button" class="btn mini danger icone" data-tira="${i}" aria-label="Remover ${esc(acao(id).nome)}">✕</button></li>`).join('')
      : '<li class="vazio">Nenhuma ação ainda — escolha na lista e clique em Adicionar.</li>';
    $('#aPrevia').innerHTML = fluxoHTML({ gatilho: $('#aGatilho').value, condicao: $('#aCond').value.trim(), acoes: rasc.acoes }) +
      (rasc.acoes.length ? '' : '<span class="seta">→</span><span class="dim pequeno">…</span>');
  }
  $('#bAddAcao').addEventListener('click', () => {
    if (rasc.acoes.length >= 8) { $('#aErro').textContent = 'Até 8 ações por automação.'; return; }
    rasc.acoes.push($('#aAcaoSel').value); $('#aErro').textContent = ''; renderRasc();
  });
  $('#aAcoes').addEventListener('click', e => {
    const m = e.target.closest('[data-mov]'), t = e.target.closest('[data-tira]');
    if (m) {
      const i = +m.dataset.mov, j = i + +m.dataset.d;
      [rasc.acoes[i], rasc.acoes[j]] = [rasc.acoes[j], rasc.acoes[i]]; renderRasc();
      const alvo = $(`#aAcoes [data-mov="${j}"][data-d="${m.dataset.d}"]`);
      (alvo && !alvo.disabled ? alvo : $('#aAcaoSel')).focus();
    } else if (t) { rasc.acoes.splice(+t.dataset.tira, 1); renderRasc(); $('#aAcaoSel').focus(); }
  });
  $('#aGatilho').addEventListener('change', renderRasc);
  $('#aCond').addEventListener('input', renderRasc);
  $('#formAuto').addEventListener('submit', e => {
    e.preventDefault();
    const nome = $('#aNome').value.trim();
    if (!nome) { $('#aErro').textContent = 'Dê um nome para a automação.'; $('#aNome').focus(); return; }
    if (!rasc.acoes.length) { $('#aErro').textContent = 'Adicione pelo menos uma ação.'; $('#aAcaoSel').focus(); return; }
    const dados = { nome, gatilho: $('#aGatilho').value, condicao: $('#aCond').value.trim(), acoes: rasc.acoes.slice() };
    const a = rasc.id && autos.find(x => x.id === rasc.id);
    if (a) Object.assign(a, dados);
    else autos.unshift(Object.assign({ id: NT.id(), ativa: true, execucoes: 0, sucessos: 0, ultima: null }, dados));
    salvar(); NT.modal($('#mAuto'), false); tudo();
    NT.aviso(a ? 'Automação atualizada.' : 'Automação criada e ligada.');
  });
  $('#bNovaTopo').addEventListener('click', () => abrirConstrutor(null));
  document.querySelectorAll('[data-fechar]').forEach(b => b.addEventListener('click', () => NT.modal(b.closest('.modal-fundo'), false)));

  /* ===========================================================
     Atendente: reconhecimento de intenção por palavras-chave
     =========================================================== */
  const STOP = new Set(('a o as os e de da do das dos um uma uns umas que pra para pro com no na nos nas em ao aos por pelo pela ' +
    'eu voce voces vc vcs me te se meu minha seu sua isso esse essa este esta ai aqui la tem ter ser sao ' +
    'qual quais como mais muito gostaria queria quero saber poderia pode sobre tipo entao ja so nao sim tambem ou mas').split(' '));
  const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = s => norm(s).split(' ').filter(t => t && !STOP.has(t));

  function lev(a, b) { // distância de edição com troca de vizinhas: aguenta “orcamneto”, “endereso”
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i].concat(Array(b.length).fill(0)));
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[a.length][b.length];
  }
  function parecida(tok, kw) { // 0..1: o quanto uma palavra da frase lembra a palavra-chave
    if (tok === kw) return 1;
    if (kw.length < 4 || tok.length < 4) return 0; // “ia”, “app”, “oi” só valem iguais
    // plural, gênero: preço/preços, fica/ficam — só diferença curta (senão “vende” viraria “vendedor”)
    if ((tok.startsWith(kw) || kw.startsWith(tok)) && Math.abs(tok.length - kw.length) <= 2) return .85;
    const s = 1 - lev(tok, kw) / Math.max(tok.length, kw.length);
    return s >= .75 ? s * .85 : 0;
  }
  function pontuar(texto) {
    const n = ' ' + norm(texto) + ' ', toks = tokens(texto);
    return intents.map(it => {
      const achou = [];
      let resto = 1;
      it.palavras.forEach(p => {
        const kw = norm(p); if (!kw) return;
        let m = 0;
        if (kw.includes(' ')) { // frase: vale se aparece inteira ou se todas as palavras aparecem
          if (n.includes(' ' + kw + ' ')) m = 1.15; // frase inteira é mais específica que palavra solta
          else {
            const ps = kw.split(' ').filter(w => !STOP.has(w));
            const sims = ps.map(w => Math.max(0, ...toks.map(t => parecida(t, w))));
            if (ps.length && sims.every(s => s > 0)) m = sims.reduce((s, x) => s + x, 0) / ps.length * .9;
          }
        } else m = Math.max(0, ...toks.map(t => parecida(t, kw)));
        if (m > 0) { achou.push(p); resto *= 1 - .72 * m; }
      });
      return { it, conf: Math.min(.99, 1 - resto), achou };
    }).sort((a, b) => b.conf - a.conf);
  }

  function analiseHTML(texto, pts) {
    const top = pts.filter(p => p.conf > 0).slice(0, 4);
    const venceu = pts[0] && pts[0].conf >= LIMIAR;
    return `<p class="frase">“${esc(texto)}” → ${venceu ? `<b style="color:var(--acc-3)">${esc(pts[0].it.nome)}</b>` : '<b style="color:var(--warn)">sem resposta</b>'}</p>` +
      (top.length ? top.map((p, i) => `<div class="barra-int${i === 0 && venceu ? ' venceu' : ''}">
        <span class="nome">${esc(p.it.nome)}</span><span class="pct">${Math.round(p.conf * 100)}%</span>
        <span class="trilho"><i style="width:${Math.round(p.conf * 100)}%"></i></span>
        <span class="pal">palavras: ${esc(p.achou.join(', '))}</span></div>`).join('')
        : '<p class="dim pequeno">Nenhuma palavra-chave reconhecida.</p>');
  }

  /* ---------- chat ---------- */
  const SAUDACAO = { de: 'bot', txt: 'Oi! Eu sou a Nassa, atendente virtual da Nassa Tech. Pode perguntar sobre serviços, preços, prazos, endereço, horário ou agentes de IA.', sug: ['Quais serviços vocês fazem?', 'Quanto custa um site?', 'Onde fica o escritório?', 'Falar com um humano'] };
  const FALLBACK = 'Desculpe, ainda não sei responder isso. Anotei sua pergunta para a equipe me ensinar. Enquanto isso, posso falar de serviços, preços, prazos, endereço ou horário — ou te passar para um humano.';
  let digitando = false;
  const debugOn = () => D.ler('debug', false);

  function msgHTML(m) {
    let meta = '';
    if (m.de === 'bot' && debugOn() && m.conf !== undefined) {
      meta = m.intent
        ? `<span class="depura">intenção: ${esc(m.intent)} · confiança ${Math.round(m.conf * 100)}%</span>`
        : `<span class="depura fora">sem intenção · ${m.conf > 0 ? `melhor palpite ${esc(m.palpite)} (${Math.round(m.conf * 100)}%)` : 'nenhuma palavra-chave reconhecida'}</span>`;
    }
    return `<div class="msg ${m.de === 'eu' ? 'eu' : 'bot'}"><div class="bolha">${esc(m.txt)}</div>${meta}${m.quando ? `<span class="meta">${m.de === 'eu' ? 'você' : 'Nassa'} · ${hm(m.quando)}</span>` : ''}</div>`;
  }
  function renderChat() {
    const lista = [SAUDACAO].concat(conversa);
    $('#mensagens').innerHTML = lista.map(msgHTML).join('') +
      (digitando ? '<div class="msg bot digitando" aria-label="Nassa está digitando"><div class="bolha"><i></i><i></i><i></i></div></div>' : '');
    const ult = lista.filter(m => m.de === 'bot').pop();
    $('#chips').innerHTML = digitando ? '' : (ult.sug || []).map(s => `<button type="button" class="chip">${esc(s)}</button>`).join('');
    $('#mensagens').scrollTop = 1e6;
    const ch = $('#chDebug'); ch.setAttribute('aria-checked', debugOn());
  }

  async function perguntar(texto) {
    texto = texto.trim();
    if (!texto || digitando) return;
    conversa.push({ de: 'eu', txt: texto, quando: Date.now() });
    if (!D.ler('contada', false)) { D.gravar('contada', true); D.gravar('conversas', D.ler('conversas', 0) + 1); }
    D.gravar('conversa', conversa);
    const pts = pontuar(texto), best = pts[0];
    $('#analise').innerHTML = analiseHTML(texto, pts);
    digitando = true; renderChat(); renderKpis();
    const ok = best && best.conf >= LIMIAR;
    const resposta = ok ? best.it.resposta : FALLBACK;
    await espera(Math.min(1800, 550 + resposta.length * 4));
    if (ok) {
      best.it.usos = (best.it.usos || 0) + 1;
      conversa.push({ de: 'bot', txt: resposta, sug: best.it.sugestoes, intent: best.it.nome, conf: best.conf, quando: Date.now() });
    } else {
      registrarPend(texto);
      conversa.push({ de: 'bot', txt: resposta, sug: ['Quais serviços vocês fazem?', 'Falar com um humano'], intent: null, palpite: best && best.conf > 0 ? best.it.nome : '—', conf: best ? best.conf : 0, quando: Date.now() });
    }
    conversa = conversa.slice(-80); // conversa de teste não precisa crescer sem fim
    D.gravar('conversa', conversa); salvarBase();
    digitando = false; renderChat(); renderKpis(); renderBase();
    $('#txtChat').focus();
  }
  function registrarPend(texto) {
    const n = norm(texto), p = pend.find(x => norm(x.texto) === n);
    if (p) { p.vezes++; p.quando = Date.now(); pend = [p].concat(pend.filter(x => x !== p)); }
    else pend.unshift({ id: NT.id(), texto, vezes: 1, quando: Date.now() });
    pend = pend.slice(0, 40);
  }

  $('#formChat').addEventListener('submit', e => {
    e.preventDefault();
    const t = $('#txtChat').value; if (!t.trim() || digitando) return;
    $('#txtChat').value = ''; perguntar(t);
  });
  $('#chips').addEventListener('click', e => { const c = e.target.closest('.chip'); if (c) perguntar(c.textContent); });
  $('#chDebug').addEventListener('click', () => {
    D.gravar('debug', !debugOn()); renderChat();
    NT.aviso(debugOn() ? 'Modo depuração ligado.' : 'Modo depuração desligado.');
  });
  $('#bNovaConversa').addEventListener('click', () => {
    if (digitando) return;
    conversa = []; D.gravar('conversa', conversa); D.gravar('contada', false);
    $('#analise').innerHTML = '<p class="dim pequeno">Mande uma mensagem para ver como a Nassa pontua cada intenção.</p>';
    renderChat(); $('#txtChat').focus();
    NT.aviso('Conversa nova começada.');
  });

  /* ===========================================================
     Base de conhecimento
     =========================================================== */
  let editIntent = null, pendOrigem = null;
  function renderBase() {
    const q = norm($('#buscaIntent').value);
    const lista = intents.filter(it => !q || norm([it.nome, it.resposta, ...it.palavras].join(' ')).includes(q));
    $('#qtdIntents').textContent = `(${intents.length})`;
    $('#listaIntents').innerHTML = lista.length ? lista.map(it => `<article class="intent" data-id="${it.id}">
      <div class="intent-cab"><b>${esc(it.nome)}</b><span class="badge">${NT.num(it.usos || 0)} uso${it.usos === 1 ? '' : 's'}</span>
        <div class="acoes"><button type="button" class="btn mini" data-ed="${it.id}">Editar</button><button type="button" class="btn mini danger" data-ex="${it.id}">Excluir</button></div></div>
      <p class="resp">${esc(it.resposta)}</p>
      <div class="tags">${it.palavras.map(p => `<span class="tag">${esc(p)}</span>`).join('')}</div>
      ${it.sugestoes.length ? `<div class="tags" style="margin-top:6px">${it.sugestoes.map(s => `<span class="tag sug">↳ ${esc(s)}</span>`).join('')}</div>` : ''}
    </article>`).join('') : `<div class="vazio">${intents.length ? 'Nenhuma intenção encontrada.' : 'A base está vazia. Crie a primeira intenção.'}</div>`;
    $('#listaPend').innerHTML = pend.length ? pend.map(p => `<div class="pend" data-id="${p.id}">
      <div class="txt">“${esc(p.texto)}”<small>${p.vezes}× · ${quando(p.quando)}</small></div>
      <div class="acoes"><button type="button" class="btn mini primary" data-cria="${p.id}">Criar intenção</button><button type="button" class="btn mini ghost" data-desc="${p.id}">Descartar</button></div>
    </div>`).join('') : '<div class="vazio">Nada pendente — a Nassa respondeu tudo.</div>';
  }

  function abrirIntent(it, pre) {
    editIntent = it ? it.id : null;
    pendOrigem = pre ? pre.id : null;
    $('#tIntent').textContent = it ? 'Editar intenção' : 'Nova intenção';
    // palavras de 3 a 30 letras: uma “palavra” colada de 400 caracteres não serve de palavra-chave
    const palpite = pre ? [...new Set(tokens(pre.texto).filter(t => t.length >= 3 && t.length <= 30))].slice(0, 8) : [];
    $('#iNome').value = it ? it.nome : palpite.slice(0, 2).join(' ').slice(0, 40);
    $('#iPalavras').value = it ? it.palavras.join(', ') : palpite.join(', ');
    $('#iResp').value = it ? it.resposta : '';
    $('#iSug').value = it ? it.sugestoes.join('\n') : '';
    $('#iErro').textContent = '';
    NT.modal($('#mIntent'), true);
    if (pre) setTimeout(() => $('#iResp').focus(), 40); // o resto já veio preenchido da pergunta
  }
  $('#bNovaIntent').addEventListener('click', () => abrirIntent(null));
  $('#buscaIntent').addEventListener('input', renderBase);
  $('#listaIntents').addEventListener('click', e => {
    const ed = e.target.closest('[data-ed]'), ex = e.target.closest('[data-ex]');
    if (ed) abrirIntent(intents.find(x => x.id === ed.dataset.ed));
    if (ex) {
      const it = intents.find(x => x.id === ex.dataset.ex);
      if (!it || !confirm(`Excluir a intenção “${it.nome}”?\nA Nassa deixa de responder sobre isso.`)) return;
      intents = intents.filter(x => x !== it); salvarBase(); renderBase(); renderKpis();
      NT.aviso('Intenção excluída.');
    }
  });
  $('#listaPend').addEventListener('click', e => {
    const c = e.target.closest('[data-cria]'), d = e.target.closest('[data-desc]');
    if (c) abrirIntent(null, pend.find(x => x.id === c.dataset.cria));
    if (d) { pend = pend.filter(x => x.id !== d.dataset.desc); salvarBase(); renderBase(); renderKpis(); NT.aviso('Pergunta descartada.'); }
  });
  $('#formIntent').addEventListener('submit', e => {
    e.preventDefault();
    const nome = $('#iNome').value.trim();
    const palavras = [...new Set($('#iPalavras').value.split(/[,;\n]/).map(s => s.trim().toLowerCase()).filter(Boolean))];
    const resposta = $('#iResp').value.trim();
    const sugestoes = $('#iSug').value.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 4);
    const erro = !nome ? 'Dê um nome para a intenção.' : !palavras.length ? 'Coloque pelo menos uma palavra-chave.' : !resposta ? 'Escreva a resposta da Nassa.' :
      intents.some(x => x.id !== editIntent && norm(x.nome) === norm(nome)) ? 'Já existe uma intenção com esse nome.' : '';
    if (erro) { $('#iErro').textContent = erro; return; }
    const it = editIntent && intents.find(x => x.id === editIntent);
    if (it) Object.assign(it, { nome, palavras, resposta, sugestoes });
    else intents.push({ id: NT.id(), nome, palavras, resposta, sugestoes, usos: 0 });
    if (pendOrigem) pend = pend.filter(x => x.id !== pendOrigem);
    salvarBase(); NT.modal($('#mIntent'), false); renderBase(); renderKpis();
    NT.aviso(it ? 'Intenção atualizada.' : pendOrigem ? 'A Nassa aprendeu uma resposta nova.' : 'Intenção criada.');
    pendOrigem = null;
  });
  $('#formTeste').addEventListener('submit', e => {
    e.preventDefault();
    const t = $('#txtTeste').value.trim(); if (!t) { $('#txtTeste').focus(); return; }
    $('#resTeste').innerHTML = analiseHTML(t, pontuar(t)); // só mede, não conta como conversa
  });

  /* ---------- geral ---------- */
  function tudo() { renderKpis(); renderAutos(); renderHist(); }
  $('#bRestaurar').addEventListener('click', () => {
    if (rodando.size || digitando) { NT.aviso('Espere a execução terminar.'); return; }
    if (!confirm('Restaurar o exemplo?\nAutomações, histórico, base de conhecimento e conversa voltam ao padrão.')) return;
    semear();
    autos = D.ler('autos', []); hist = D.ler('hist', []); intents = D.ler('intents', []); pend = D.ler('pend', []); conversa = [];
    $('#analise').innerHTML = '<p class="dim pequeno">Mande uma mensagem para ver como a Nassa pontua cada intenção.</p>';
    $('#resTeste').innerHTML = '';
    tudo(); renderChat(); renderBase();
    NT.aviso('Exemplo restaurado.');
  });

  NT.abas(document, aba => { D.gravar('aba', aba); if (aba === 'chat') { $('#mensagens').scrollTop = 1e6; } });
  tudo(); renderChat(); renderBase();
  const abaSalva = D.ler('aba', 'auto');
  if (abaSalva !== 'auto') { const b = document.querySelector(`.aba[data-aba="${abaSalva}"]`); if (b) b.click(); }
  // “há 3 min” não fica parado; não redesenha se o foco estiver num cartão (perderia o foco do teclado)
  setInterval(() => { if (!rodando.size && !$('#listaAuto').contains(document.activeElement)) { renderAutos(); renderKpis(); } }, 60e3);
})();
