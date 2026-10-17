/* ===========================================================
   quadro.js — ideias e agenda que aparecem nas paredes da Diretoria.
   Ficam no navegador (localStorage): são lembretes, não registro.
   =========================================================== */
const QUADRO = (() => {
  const K = 'escritorio-quadro-v1';
  let q = null;
  // os quadros da parede ficam em cache e só se repintam quando este número
  // muda: comparar a lista inteira a cada quadro seria trabalho à toa
  let ver = 0;
  const ler = () => {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(K) || 'null'); } catch (e) { /* storage bloqueado */ }
    q = (d && Array.isArray(d.ideias) && Array.isArray(d.eventos)) ? d : { ideias: [], eventos: [] };
  };
  ler();
  const salvar = () => { ver++; try { localStorage.setItem(K, JSON.stringify(q)); } catch (e) {} };
  // anotou em outra aba: a parede desta acompanha
  try { addEventListener('storage', e => { if (e.key === K) { ler(); ver++; } }); } catch (e) {}

  return {
    ideias:  () => q.ideias.slice(),
    eventos: () => q.eventos.slice(),
    versao:  () => ver,
    addIdeia(t) {
      q.ideias.unshift(String(t).slice(0, 52));
      q.ideias = q.ideias.slice(0, 6); salvar();
    },
    delIdeia(i) { q.ideias.splice(i, 1); salvar(); },
    addEvento(e) {
      q.eventos.push({ data: String(e.data).slice(0, 8), nome: String(e.nome).slice(0, 34), tipo: String(e.tipo || 'Evento').slice(0, 16) });
      q.eventos = q.eventos.slice(0, 6); salvar();
    },
    delEvento(i) { q.eventos.splice(i, 1); salvar(); }
  };
})();
