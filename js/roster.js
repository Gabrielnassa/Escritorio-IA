/* ===========================================================
   roster.js — quem trabalha aqui.
   BOSSES  : o Gabriel (sempre em serviço, na sala do chefe)
   CATALOG : o agente de exemplo + vagas sugeridas para começar
   =========================================================== */
const ROSTER = (() => {

  const KEY = 'escritorio-agentes-v1';

  /* ===========================================================
     O DONO — o nome vem de data/config.json ("dono")
     O computador da mesa dele abre o site da Nassa Tech.
     =========================================================== */
  const E = window.ESCRITORIO || {};
  const BOSSES = [
    {
      id: 'boss-1', name: E.dono || 'Gabriel',
      role: (E.cargo || 'CEO & Fundador') + ' · ' + (E.nome || 'Nassa Tech'),
      emoji: '⭐', boss: true, dept: 'diretoria', slotId: 'DIR-1',
      status: 'trabalhando', locked: true,
      source: 'Sala do chefe', sistema: 'site',
      brief: 'Dono da Nassa Tech. Fica na sala do chefe, com o quadro da BMW atrás da mesa. O computador dele abre o site da empresa.',
      look: {
        skin: '#d9a17a', hair: '#1c140e', style: 'fade',
        shirt: '#0b1220', pants: '#1e293b', shoes: '#15181f',
        glasses: null, beard: null, tattoo: false, cap: false,
        uniforme: false
      }
    }
  ];

  /* ===========================================================
     BANCO DE TALENTOS — o time de uma software house
     'detectado' = tem sistema no registro (data/sistemas.json)
     'sugerido'  = vaga sugerida pelo gerente. Cada uma já vem com um
                   sistema embutido (sistemas/catalogo.json, pasta
                   sistemas/<key>/), que abre no computador dela
     =========================================================== */
  const CATALOG = [
    {
      key: 'exemplo', name: 'EXEMPLO', role: 'Agente de demonstração', emoji: '🤖',
      cat: 'detectado', system: 'Agente de exemplo', sistema: 'exemplo',
      desc: 'Um sistema mínimo que vem junto, na pasta exemplo-agente: sobe na porta 4401 e mostra uma página.',
      why: 'Serve de molde. Clique no computador dele para ver o escritório ligar, embutir e conversar com um sistema. Depois cadastre os seus.',
      look: { skin: '#c9854f', hair: '#140f0c', style: 'cacheado', shirt: '#00b3ff', pants: '#26304a', glasses: null, beard: null }
    },
    {
      key: 'frontend', name: 'Lucas', role: 'Front-end · React & Next.js', emoji: '🎨', cat: 'sugerido', system: 'Estúdio de Landing Pages', sistema: 'frontend',
      desc: 'Constrói as telas: sites, landing pages e painéis, do Figma ao deploy.',
      why: 'É a parte que o cliente vê. Interface rápida e bonita vende o projeto.',
      look: { skin: '#f0c29b', hair: '#241a13', style: 'fade', shirt: '#2f7bff', pants: '#1b2030', glasses: null, beard: null }
    },
    {
      key: 'backend', name: 'Marina', role: 'Back-end · Node & APIs', emoji: '🧩', cat: 'sugerido', system: 'Console da API', sistema: 'backend',
      desc: 'APIs, banco de dados, integrações de pagamento e WhatsApp.',
      why: 'Todo sistema precisa de um motor confiável por trás da tela.',
      look: { skin: '#7a4a2c', hair: '#140f0c', style: 'coque', shirt: '#14b8a6', pants: '#1b2030', glasses: 'redondo', beard: null }
    },
    {
      key: 'fullstack', name: 'Rafa', role: 'Full-stack', emoji: '⚙️', cat: 'sugerido', system: 'Gestor de Projetos', sistema: 'fullstack',
      desc: 'Pega a funcionalidade de ponta a ponta: banco, API e tela.',
      why: 'Quem enxerga o fluxo inteiro entrega mais rápido e com menos retrabalho.',
      look: { skin: '#c9854f', hair: '#1a120d', style: 'curto', shirt: '#334155', pants: '#26304a', glasses: 'retangular', beard: 'cheia' }
    },
    {
      key: 'mobile', name: 'Bia', role: 'Mobile · React Native', emoji: '📱', cat: 'sugerido', system: 'Laboratório Mobile', sistema: 'mobile',
      desc: 'Apps para Android e iOS a partir da mesma base de código.',
      why: 'Muito cliente quer o app na loja. Uma base só reduz custo e prazo.',
      look: { skin: '#e0a878', hair: '#5a3a22', style: 'longo', shirt: '#f472b6', pants: '#26304a', glasses: null, beard: null }
    },
    {
      key: 'devops', name: 'Dani', role: 'DevOps & Cloud', emoji: '🚀', cat: 'sugerido', system: 'Central de Deploy', sistema: 'devops',
      desc: 'Deploy, CI/CD, servidores, domínios e monitoramento.',
      why: 'Código que não chega em produção não gera valor. É quem mantém tudo no ar.',
      look: { skin: '#f7d7bd', hair: '#8e8e93', style: 'curto', shirt: '#0ea5e9', pants: '#1b2030', glasses: 'redondo', beard: null }
    },
    {
      key: 'qa', name: 'Theo', role: 'QA & Testes', emoji: '🧪', cat: 'sugerido', system: 'Central de Qualidade', sistema: 'qa',
      desc: 'Roda build, typecheck e teste antes de qualquer deploy.',
      why: 'Com várias pessoas e agentes mexendo em código, alguém precisa ser o freio antes de subir.',
      look: { skin: '#f0c29b', hair: '#241a13', style: 'ondulado', shirt: '#22c55e', pants: '#26304a', glasses: null, beard: 'cavanhaque' }
    },
    {
      key: 'design', name: 'Lia', role: 'UI/UX Design', emoji: '✏️', cat: 'sugerido', system: 'Design System Nassa', sistema: 'design',
      desc: 'Pesquisa, protótipo e design system de cada projeto.',
      why: 'Um bom fluxo evita código jogado fora. Desenha antes de programar.',
      look: { skin: '#f7d7bd', hair: '#8b5a2b', style: 'rabo', shirt: '#a855f7', pants: '#1b2030', glasses: 'retangular', beard: null }
    },
    {
      key: 'ia', name: 'Nico', role: 'Agentes de IA & Automação', emoji: '🧠', cat: 'sugerido', system: 'Central de Agentes', sistema: 'ia',
      desc: 'Cria agentes com o Claude, automações e integrações com IA.',
      why: 'É o produto que mais cresce: atendimento, vendas e operação rodando sozinhos.',
      look: { skin: '#c9854f', hair: '#140f0c', style: 'cacheado', shirt: '#00b3ff', pants: '#1b2030', glasses: null, beard: null }
    },
    {
      key: 'comercial', name: 'Duda', role: 'Comercial & Propostas', emoji: '🤝', cat: 'sugerido', system: 'CRM & Propostas', sistema: 'comercial',
      desc: 'Atende quem chega pelo site, entende o projeto e monta a proposta.',
      why: 'Sem entrada de projeto novo, o time de desenvolvimento fica parado.',
      look: { skin: '#e0a878', hair: '#241a13', style: 'longo', shirt: '#f59e0b', pants: '#26304a', glasses: null, beard: null }
    }
  ];

  /* quem já começa contratado: um time pequeno de software house */
  const TIME_INICIAL = ['frontend', 'backend', 'fullstack', 'mobile', 'devops', 'qa', 'design', 'ia', 'exemplo'];

  /* ===========================================================
     ESTADO
     =========================================================== */
  let team = [];

  function defaults() {
    const base = BOSSES.map(b => Object.assign({}, b, { look: Object.assign({}, b.look) }));
    // começa com o time da Nassa Tech e o agente de exemplo, que mostra
    // como ligar um sistema de verdade num computador
    for (const k of TIME_INICIAL) {
      const c = CATALOG.find(c => c.key === k);
      base.push(fromCatalog(c));
    }
    return base;
  }

  function fromCatalog(c) {
    return {
      id: 'ag-' + c.key,
      key: c.key,
      name: c.name,
      role: c.role,
      emoji: c.emoji,
      system: c.system || null,
      sistema: c.sistema || null,
      path: c.path || null,
      brief: c.desc,
      dept: 'servico',
      slotId: null,
      status: 'trabalhando',
      boss: false,
      locked: false,
      look: AVATAR.makeLook(c.key, c.look)
    };
  }

  /* ===========================================================
     PERSISTÊNCIA

     O disco manda. A equipe já morava só no localStorage do navegador
     e um dia voltou inteira ao padrão: nome que você deu, contratação,
     estação, horário — tudo perdido de uma vez, sem aviso. O navegador
     limpa storage quando quer. Agora o arquivo é data/equipe.json, no
     servidor, e o localStorage é só um espelho para quando ele estiver
     fora do ar.
     =========================================================== */
  const doLocal = () => {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || 'null');
      return d && Array.isArray(d.team) && d.team.length ? d.team : null;
    } catch (e) { return null; }
  };

  async function load() {
    let vindoDoDisco = null;
    try {
      const d = await (await fetch('/api/equipe')).json();
      if (d && Array.isArray(d.team) && d.team.length) vindoDoDisco = d.team;
    } catch (e) { /* servidor fora: vale o que o navegador tiver */ }

    team = vindoDoDisco || doLocal() || defaults();
    recompor();              // equipe salva antes pode não ter os campos novos
    if (!vindoDoDisco) save();   // primeira vez ou migração: carimba no disco
  }

  /** reencaixa campos que chegaram depois de a equipe já ter sido salva,
      como o id do sistema que o agente opera */
  function recompor() {
    for (const a of team) {
      const c = CATALOG.find(c => c.key === a.key);
      if (c) {
        if (!a.sistema && c.sistema) a.sistema = c.sistema;
        if (c.path && a.path !== c.path) a.path = c.path;
      }
      const b = BOSSES.find(b => b.id === a.id);
      if (b && !a.sistema && b.sistema) a.sistema = b.sistema;
      // sem look o boneco não é desenhado: fica um funcionário invisível na
      // mesa. Reconstrói a partir da key, que é determinística — o mesmo
      // agente volta com a mesma cara de sempre.
      if (!a.look || !a.look.skin) {
        const base = (c && c.look) || (b && b.look) || {};
        a.look = AVATAR.makeLook(a.key || a.id, Object.assign({}, base));
      }
    }
  }

  let gravando = null;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ team, v: 1 })); }
    catch (e) { /* storage bloqueado: o disco ainda pega */ }
    // junta as chamadas seguidas num POST só — arrastar um agente dispara
    // save() várias vezes por segundo
    clearTimeout(gravando);
    gravando = setTimeout(() => {
      fetch('/api/equipe', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team, v: 1 })
      }).catch(() => { /* offline: fica o espelho do navegador */ });
    }, 300);
  }

  function reset() { team = defaults(); save(); }

  /* ---------- operações ---------- */
  function hire(key) {
    const c = CATALOG.find(c => c.key === key);
    if (!c || team.some(a => a.key === key)) return null;
    const a = fromCatalog(c);
    team.push(a); save();
    return a;
  }

  function hireCustom(data) {
    const key = 'custom-' + Date.now().toString(36);
    const a = {
      id: 'ag-' + key, key,
      name: data.name || 'Novo agente',
      role: data.role || 'Função a definir',
      emoji: data.emoji || '🤖',
      system: data.system || null, path: data.path || null,
      sistema: data.sistema || null, reuniao: data.reuniao !== false,
      brief: data.brief || '',
      dept: 'servico', slotId: null, status: 'trabalhando',
      boss: false, locked: false, custom: true,
      look: AVATAR.makeLook(key, data.look || {})
    };
    team.push(a); save();
    return a;
  }

  function fire(id) {
    const i = team.findIndex(a => a.id === id);
    if (i < 0 || team[i].locked) return false;
    team.splice(i, 1); save();
    return true;
  }

  const get = (id) => team.find(a => a.id === id);
  const all = () => team;
  const isHired = (key) => team.some(a => a.key === key);
  const count = (st) => team.filter(a => a.status === st).length;

  return { BOSSES, CATALOG, load, save, reset, hire, hireCustom, fire,
           get, all, isHired, count, fromCatalog };
})();
