/* ===========================================================
   pedidos-ui.js — a tela do pedido do cliente (botão 📥 Pedido)

   Você escreve (ou cola, ou anexa em .txt/.md) o que o cliente pediu.
   Duda e Rafa planejam, você aprova, cada agente faz a parte dele e o
   Theo testa. Você revisa a entrega e aprova. Tudo isso roda no servidor
   do escritório (pedidos.js); esta tela só mostra e manda as ordens.

   Enquanto um agente trabalha num pedido, o balão dele no andar diz em
   que tarefa está (app.js lê PEDIDOS_UI.tarefaDe).
   =========================================================== */
const PEDIDOS_UI = (() => {

  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const quando = ms => ms ? new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
  const dolar = v => 'US$ ' + (+v || 0).toFixed(2);

  const ROTULO = {
    'planejando':         ['🧠', 'Planejando',          'warn'],
    'aguardando-plano':   ['✋', 'Aprove o plano',       'acc'],
    'executando':         ['⚙️', 'Em produção',          'warn'],
    'pausado':            ['⏸', 'Pausado',              'off'],
    'aguardando-entrega': ['✋', 'Revise a entrega',     'acc'],
    'aprovado':           ['✅', 'Entregue',             'ok'],
    'erro':               ['⚠️', 'Parado',               'err'],
    'cancelado':          ['✕', 'Cancelado',            'off']
  };

  let el = null, aberto = false, timer = null, atual = null, ativos = [], servidor = null;

  async function api(url, corpo) {
    const r = await fetch(url, corpo === undefined ? {} :
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
    if (!r.ok && r.status === 404 && !url.includes('/api/pedidos/')) throw new Error('sem servidor');
    return r.json();
  }

  /* quem está trabalhando em qual pedido, para o balão no andar */
  async function vigiar() {
    try { const d = await api('/api/pedidos'); servidor = true;
          ativos = d.pedidos.filter(p => p.agora); }
    catch (e) { servidor = false; ativos = []; }
  }
  setInterval(vigiar, 5000); vigiar();
  function tarefaDe(chave) {
    const p = ativos.find(p => p.agora && p.agora.agente === chave);
    return p ? p.cliente + ': ' + p.agora.titulo : null;
  }

  function montar() {
    el = document.createElement('div');
    el.id = 'pedidos'; el.className = 'hidden';
    el.innerHTML = `<div class="rn-card pd-card" role="dialog" aria-label="Pedidos de clientes">
      <header class="rn-top">
        <div><h2>📥 PEDIDOS DE CLIENTES</h2><div class="quando" id="pd-sub">você aprova, a equipe faz</div></div>
        <div class="rn-acoes">
          <button class="btn primary" id="pd-novo">＋ Novo pedido</button>
          <button class="btn ghost" id="pd-x" aria-label="Fechar">✕</button>
        </div>
      </header>
      <div class="pd-corpo">
        <aside class="pd-lista" id="pd-lista"></aside>
        <section class="pd-det" id="pd-det"></section>
      </div>
    </div>`;
    document.body.appendChild(el);
    $('#pd-x').addEventListener('click', fechar);
    $('#pd-novo').addEventListener('click', () => { atual = null; formNovo(); });
    el.addEventListener('click', e => { if (e.target === el) fechar(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && aberto) fechar(); });
  }

  async function abrir(id) {
    if (!el) montar();
    aberto = true; el.classList.remove('hidden');
    await vigiar();
    if (!servidor) { semServidor(); return; }
    if (id) atual = id;
    await pintar();
    clearInterval(timer);
    timer = setInterval(() => { if (aberto) pintar(true); }, 3000);
  }
  function fechar() { aberto = false; el && el.classList.add('hidden'); clearInterval(timer); }

  function semServidor() {
    $('#pd-lista').innerHTML = '';
    $('#pd-det').innerHTML = `<div class="pd-vazio"><b>Os pedidos rodam no seu computador</b>
      <p>Aqui é a versão publicada no GitHub, que não tem como executar os agentes.
      Abra o escritório pelo seu Mac (<code>npm start</code> na pasta do projeto, depois
      <code>http://localhost:4321</code>), com o Claude Code instalado e logado.</p>
      <p>Lá você sobe o pedido do cliente, aprova o plano e os agentes fazem o projeto
      numa pasta em <code>~/NassaTech/clientes</code>.</p></div>`;
    $('#pd-novo').style.display = 'none';      // sem servidor não há como criar pedido
  }

  let ultimaLista = '', ultimoDet = '';
  async function pintar(soAtualizar) {
    let d;
    try { d = await api('/api/pedidos'); } catch (e) { semServidor(); return; }
    $('#pd-novo').style.display = '';
    $('#pd-sub').textContent = 'projetos em ' + d.pasta;
    const lista = d.pedidos.map(p => {
      const [ic, txt, cls] = ROTULO[p.estado] || ['•', p.estado, 'off'];
      return `<button class="pd-item ${p.id === atual ? 'on' : ''}" data-id="${esc(p.id)}">
        <b>${esc(p.cliente)}</b>
        <span class="pd-tag ${cls}">${ic} ${txt}</span>
        <small>${p.total ? p.feitas + '/' + p.total + ' tarefas · ' : ''}${quando(p.criado)}</small>
      </button>`;
    }).join('') || '<p class="pd-dica">Nenhum pedido ainda. Clique em <b>＋ Novo pedido</b>.</p>';
    if (lista !== ultimaLista) {
      ultimaLista = lista;
      $('#pd-lista').innerHTML = lista;
      $('#pd-lista').querySelectorAll('.pd-item').forEach(b =>
        b.addEventListener('click', () => { atual = b.dataset.id; ultimoDet = ''; pintar(); }));
    }
    if (!atual && !soAtualizar) {
      if (d.pedidos.length) atual = d.pedidos[0].id; else { formNovo(); return; }
    }
    if (atual) await detalhe();
  }

  function formNovo() {
    ultimoDet = '';
    $('#pd-lista').querySelectorAll('.pd-item').forEach(b => b.classList.remove('on'));
    $('#pd-det').innerHTML = `<form class="pd-form" id="pd-form">
      <h3>Novo pedido</h3>
      <label>Cliente<input id="pd-cli" maxlength="60" placeholder="Ex.: Padaria Pão de Mel" required></label>
      <label>O que o cliente pediu
        <textarea id="pd-txt" rows="9" placeholder="Cole aqui a mensagem, o briefing ou a transcrição da conversa. Quanto mais detalhe (público, páginas, cores, referências, prazo), melhor o plano."></textarea></label>
      <label class="pd-anexo">Anexar texto (.txt, .md) <input type="file" id="pd-arq" accept=".txt,.md,.csv,.json,text/plain" multiple></label>
      <p class="pd-dica">Duda e Rafa montam o plano e o escritório te avisa. Nada é feito antes de você aprovar.</p>
      <div class="pd-botoes"><button class="btn primary" type="submit" id="pd-enviar">Enviar para a equipe</button></div>
      <p class="pd-erro" id="pd-erro"></p>
    </form>`;
    $('#pd-arq').addEventListener('change', async e => {
      for (const f of e.target.files) {
        if (f.size > 200000) { $('#pd-erro').textContent = f.name + ' é grande demais (máx. 200 KB).'; continue; }
        $('#pd-txt').value += (($('#pd-txt').value ? '\n\n' : '') + '--- ' + f.name + ' ---\n' + await f.text());
      }
    });
    $('#pd-form').addEventListener('submit', async e => {
      e.preventDefault();
      $('#pd-enviar').disabled = true; $('#pd-erro').textContent = '';
      const r = await api('/api/pedidos', { cliente: $('#pd-cli').value, texto: $('#pd-txt').value });
      $('#pd-enviar').disabled = false;
      if (!r.ok) { $('#pd-erro').textContent = r.motivo || 'não consegui criar o pedido'; return; }
      atual = r.pedido.id; ultimaLista = ''; pintar();
    });
    setTimeout(() => $('#pd-cli') && $('#pd-cli').focus(), 30);
  }

  async function detalhe() {
    const p = await api('/api/pedidos/' + atual);
    if (!p || !p.id) { atual = null; return; }
    // não repinta se nada mudou: senão o texto que você está digitando some
    const chave = p.atualizado + '|' + p.estado;
    if (chave === ultimoDet) return;
    ultimoDet = chave;
    const [ic, txt, cls] = ROTULO[p.estado] || ['•', p.estado, 'off'];
    const pl = p.plano;
    const tarefas = pl ? pl.tarefas.map((t, i) => `<li class="pd-t ${t.estado}">
        <span class="pd-n">${i + 1}</span>
        <div><b>${esc(t.titulo)}</b> <small>· ${esc(t.quem)}</small>
          <p>${esc(t.descricao)}</p>
          ${t.resumo ? `<p class="pd-res">✔ ${esc(t.resumo)}</p>` : ''}
          ${t.erro ? `<p class="pd-erro">${esc(t.erro)}</p>` : ''}</div>
        <span class="pd-st">${{ pendente: '·', fazendo: '⚙️', feita: '✅', falhou: '⚠️', interrompida: '✕' }[t.estado] || ''}</span>
      </li>`).join('') : '';
    const caixa = (rot, id, acao, botao, extra) => `<div class="pd-ceo">
        <b>${rot}</b>
        <textarea id="${id}" rows="2" placeholder="${extra}"></textarea>
        <div class="pd-botoes">${botao}<button class="btn" data-acao="${acao}" data-campo="${id}">Pedir ajuste</button></div></div>`;
    let ceo = '';
    if (p.estado === 'aguardando-plano')
      ceo = caixa('Você aprova este plano?', 'pd-aj', 'ajustar-plano',
        '<button class="btn primary" data-acao="aprovar-plano">✔ Aprovar e começar</button>',
        'Ex.: tirar a página de blog, incluir botão de WhatsApp, usar as cores verde e branco…');
    else if (p.estado === 'aguardando-entrega')
      ceo = caixa('Revise a entrega', 'pd-aj', 'ajustar-entrega',
        '<button class="btn primary" data-acao="aprovar-entrega">✔ Aprovar entrega</button>',
        'O que precisa mudar antes de ir para o cliente?');
    else if (['pausado', 'erro'].includes(p.estado))
      ceo = `<div class="pd-ceo"><b>${esc(p.erro || 'Pausado')}</b><div class="pd-botoes">
        <button class="btn primary" data-acao="continuar">▶ Continuar</button>
        ${p.estado === 'erro' && pl ? '<button class="btn" data-acao="ajustar-plano" data-campo="pd-aj">Refazer o plano</button><textarea id="pd-aj" rows="2" placeholder="Orientação para o novo plano (opcional)"></textarea>' : ''}</div></div>`;
    const ver = p.temIndex ? `<a class="btn" href="/pedidos/${esc(p.id)}/" target="_blank" rel="noopener">👁 Ver o resultado</a>` : '';
    $('#pd-det').innerHTML = `
      <div class="pd-cab">
        <div><h3>${esc(p.cliente)}</h3><span class="pd-tag ${cls}">${ic} ${txt}</span>
          <small class="pd-dica">${dolar(p.custo)} de IA (limite ${dolar(p.limiteUSD)}) · <code>${esc(p.pasta)}</code></small></div>
        <div class="pd-botoes">${ver}
          ${['aprovado', 'cancelado'].includes(p.estado) ? '' : '<button class="btn ghost danger" data-acao="cancelar">Cancelar pedido</button>'}</div>
      </div>
      ${ceo}
      ${pl ? `<div class="pd-plano"><p>${esc(pl.resumo)}</p>
        <div class="pd-kv"><span>Prazo<b>${esc(pl.prazo || '—')}</b></span><span>Orçamento sugerido<b>${esc(pl.orcamento || '—')}</b></span></div>
        ${pl.perguntas && pl.perguntas.length ? `<p class="pd-dica"><b>Confirmar com o cliente:</b> ${pl.perguntas.map(esc).join(' · ')}</p>` : ''}
        <ol class="pd-tarefas">${tarefas}</ol></div>` : `<div class="pd-vazio"><b>${p.estado === 'planejando' ? 'Duda e Rafa estão lendo o pedido…' : 'Sem plano'}</b><p>Isso leva de 1 a 3 minutos. Pode fechar: o escritório te avisa.</p></div>`}
      <details class="pd-hist"><summary>O pedido e o histórico</summary>
        <pre>${esc(p.texto)}</pre>
        <ul>${p.historico.slice().reverse().map(h => `<li><small>${quando(h.quando)}</small> ${esc(h.txt)}</li>`).join('')}</ul>
      </details>`;
    $('#pd-det').querySelectorAll('[data-acao]').forEach(b => b.addEventListener('click', async () => {
      const a = b.dataset.acao;
      if (a === 'cancelar' && !confirm('Cancelar este pedido? O que já foi feito fica na pasta.')) return;
      const campo = b.dataset.campo ? $('#' + b.dataset.campo) : null;
      b.disabled = true;
      const r = await api('/api/pedidos/' + p.id + '/' + a, { texto: campo ? campo.value : '' });
      b.disabled = false;
      if (!r.ok) { alert(r.motivo || 'não deu certo'); return; }
      ultimoDet = ''; ultimaLista = ''; pintar();
    }));
  }

  return { abrir, tarefaDe, ativos: () => ativos.slice() };
})();
