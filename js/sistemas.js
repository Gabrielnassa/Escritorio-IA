/* ===========================================================
   sistemas.js — a ponte entre o boneco e o sistema que ele opera.

   Cada agente pode ter um `sistema` (id em data/sistemas.json).
   Clicando no computador dele, abre o monitor: liga o servidor local
   se preciso e mostra o painel do sistema dentro da tela, para você
   configurar ou conversar com ele sem sair do escritório.

   Os funcionários do banco de talentos já vêm com um sistema embutido
   (sistemas/catalogo.json), que abre mesmo sem o servidor.
   =========================================================== */
const SISTEMAS = (() => {

  let lista = [];          // último estado vindo do servidor
  let aoMudar = [];

  const porId = id => lista.find(s => s.id === id) || null;
  const todos = () => lista.slice();
  const onChange = fn => aoMudar.push(fn);
  const avisar = () => aoMudar.forEach(f => { try { f(); } catch (e) { /* ignora */ } });

  /* Sem o servidor (GitHub Pages, ou o index.html aberto direto) não há
     API: valem só os sistemas embutidos, que são páginas em sistemas/<id>/
     e rodam no próprio navegador.                                      */
  let embutidos = null;
  async function lerEmbutidos() {
    if (embutidos) return embutidos;
    try {
      const d = await (await fetch('sistemas/catalogo.json', { cache: 'no-store' })).json();
      embutidos = Object.entries(d).filter(([id]) => !id.startsWith('_')).map(([id, x]) => ({
        id, nome: x.nome, tipo: 'embutido', estado: 'no ar', url: 'sistemas/' + id + '/',
        sobre: x.sobre || '', dicas: x.dicas || [], emoji: x.emoji || null, agente: x.agente || null,
        pasta: x.pasta || null, embutir: true
      }));
    } catch (e) { embutidos = []; }
    return embutidos;
  }

  let servidor = false;    // true quando a API do escritório respondeu
  async function atualizar() {
    try {
      const r = await fetch('/api/sistemas');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      lista = await r.json();
      servidor = true;
    } catch (e) {
      lista = await lerEmbutidos();
      servidor = false;
    }
    avisar();
    return lista;
  }
  const comServidor = () => servidor;

  const ligar    = id => fetch(`/api/sistemas/${id}/ligar`,    { method: 'POST' }).then(r => r.json());
  const desligar = id => fetch(`/api/sistemas/${id}/desligar`, { method: 'POST' }).then(r => r.json());
  const log      = id => fetch(`/api/sistemas/${id}/log?n=160`).then(r => r.json()).then(d => d.linhas || []);

  /** espera a porta responder depois de mandar ligar */
  async function esperarSubir(id, segundos = 60) {
    const ate = Date.now() + segundos * 1000;
    while (Date.now() < ate) {
      await new Promise(r => setTimeout(r, 1200));
      await atualizar();
      const s = porId(id);
      if (!s) return false;
      if (s.estado === 'no ar') return true;
      if (s.estado === 'caiu') return false;
    }
    return false;
  }

  const COR = {
    'no ar':   'var(--ok)',
    'subindo': 'var(--warn)',
    'caiu':    '#ff7a6b',
    'desligado': 'var(--off)',
    'web':     'var(--alt-1)'
  };

  return { atualizar, todos, porId, ligar, desligar, log, esperarSubir, onChange, COR, comServidor };
})();
