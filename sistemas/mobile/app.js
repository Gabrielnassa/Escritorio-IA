/* ===========================================================
   Laboratório Mobile — a bancada da Bia (Mobile · React Native)

   À esquerda, um celular na tela rodando o app de demonstração da
   Clínica Sorriso (agendar, cancelar, perfil). À direita, o que fica
   por trás de um app: builds de Android e iOS, checklist das lojas e
   push de teste. Tudo é salvo em NT.dados('mobile') e volta no reload.
   =========================================================== */
(() => {
'use strict';

const db = NT.dados('mobile');
const VERSAO_DADOS = 1;          // sobe quando o formato salvo mudar
const ATRASO_REVISAO = 9000;     // a revisão das lojas é simulada: alguns segundos
const CHANCE_FALHA = 0.25;       // uma em cada quatro builds novas quebra num passo
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = NT.esc;

/* ---------- o que o app da clínica oferece ---------- */
const ESPECIALIDADES = [
  { id: 'limpeza', nome: 'Limpeza e prevenção', dentista: 'Dra. Camila Rocha', min: 40, preco: 180 },
  { id: 'clareamento', nome: 'Clareamento', dentista: 'Dra. Júlia Prado', min: 60, preco: 650 },
  { id: 'ortodontia', nome: 'Ortodontia', dentista: 'Dr. Rafael Nunes', min: 30, preco: 220 },
  { id: 'implante', nome: 'Implante', dentista: 'Dr. Henrique Sato', min: 60, preco: 350 },
  { id: 'canal', nome: 'Tratamento de canal', dentista: 'Dra. Beatriz Lemos', min: 50, preco: 480 },
  { id: 'infantil', nome: 'Odontopediatria', dentista: 'Dra. Paula Andrade', min: 40, preco: 200 }
];
const ESP = Object.fromEntries(ESPECIALIDADES.map(e => [e.id, e]));
// almoço das 12h às 13h30; sábado só de manhã; domingo fechado
const HORAS_SEMANA = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'];
const HORAS_SABADO = HORAS_SEMANA.slice(0, 8);
const DICAS = [
  'Troque a escova a cada três meses, ou antes se as cerdas abrirem.',
  'Fio dental todo dia, de preferência antes de dormir.',
  'Café e vinho mancham menos se você beber água logo depois.',
  'Sangramento na gengiva não é normal — vale marcar uma avaliação.'
];
const TEL_CLINICA = '(11) 3456-7890';
const TELAS = {
  inicio: { nome: 'Início', ic: 'inicio' },
  agendar: { nome: 'Agendar', ic: 'agendar' },
  consultas: { nome: 'Consultas', ic: 'consultas' },
  perfil: { nome: 'Perfil', ic: 'perfil' }
};

const PLAT = {
  android: { nome: 'Android', ext: '.aab', loja: 'Google Play', console: 'Google Play Console', revisor: 'Google', aparelho: 'android' },
  ios: { nome: 'iOS', ext: '.ipa', loja: 'App Store', console: 'App Store Connect', revisor: 'Apple', aparelho: 'iphone' }
};
const APARELHO = { iphone: { nome: 'iPhone 16', plat: 'ios' }, android: { nome: 'Pixel 9', plat: 'android' } };

/* ---------- ícones (traço, herdam a cor do texto) ---------- */
const IC = {
  inicio: '<path d="M3.5 10.5 12 4l8.5 6.5V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z"/>',
  agendar: '<rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4M12 13v5M9.5 15.5h5"/>',
  consultas: '<rect x="4.5" y="3.5" width="15" height="17" rx="2.5"/><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4"/>',
  perfil: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1.3-3.8 4.2-5.6 7.5-5.6s6.2 1.8 7.5 5.6"/>',
  fone: '<path d="M6.5 3.5h3l1.6 4.4-2 1.3a10.5 10.5 0 0 0 5.7 5.7l1.3-2 4.4 1.6v3a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z"/>',
  relogio: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  dente: '<path d="M7.6 3.5C5.2 3.5 3.8 5.4 3.8 7.8c0 2.5 1.3 3.8 1.7 6.1.5 2.6.9 6.6 2.6 6.6 1.6 0 1.5-4.8 3.9-4.8s2.3 4.8 3.9 4.8c1.7 0 2.1-4 2.6-6.6.4-2.3 1.7-3.6 1.7-6.1 0-2.4-1.4-4.3-3.8-4.3-1.9 0-2.7.9-4.4.9s-2.5-.9-4.4-.9z"/>',
  luz: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3z"/>'
};
const ic = n => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${IC[n]}</svg>`;

/* ---------- builds: passos, log e erros possíveis ---------- */
const TESTES = { nome: 'Rodando testes', seg: 1.1, log: ['jest --ci --silent', '✓ src/telas/Agendar.test.tsx', '✓ src/telas/Consultas.test.tsx', '✔ 48 testes passaram'] };
const PASSOS = {
  android: [
    { nome: 'Preparando ambiente', seg: 0.9, log: ['Máquina de build Linux · 4 vCPU · 16 GB de RAM', 'Node 20.11 · JDK 17 · Android SDK 34', 'git clone clinica-sorriso-app · main @ {sha}'] },
    { nome: 'Instalando dependências', seg: 1.5, log: ['yarn install --frozen-lockfile', '1.243 pacotes resolvidos pelo yarn.lock', '✔ dependências instaladas em 41,8 s'] },
    TESTES,
    { nome: 'Gerando bundle JS', seg: 1.0, log: ['react-native bundle --platform android --dev false', 'Hermes: compilando para bytecode', '✔ index.android.bundle · 2,4 MB'] },
    { nome: 'Compilando nativo', seg: 2.0, log: ['./gradlew :app:bundleRelease', '> tarefa :app:mergeReleaseResources', '> tarefa :app:compileReleaseKotlin', '✔ Gradle concluiu em 3 min 12 s'] },
    { nome: 'Assinando', seg: 0.8, log: ['Assinando com a chave de upload (upload-keystore.jks)', '✔ assinatura conferida · SHA-256'] },
    { nome: 'Enviando artefato', seg: 0.8, log: ['app-release.aab · {tam} MB', '✔ artefato guardado: clinica-sorriso-{versao}-{num}.aab'] }
  ],
  ios: [
    { nome: 'Preparando ambiente', seg: 0.9, log: ['Máquina de build macOS 14 · Apple M2', 'Xcode 15.4 · Node 20.11 · CocoaPods 1.15', 'git clone clinica-sorriso-app · main @ {sha}'] },
    { nome: 'Instalando dependências', seg: 1.6, log: ['yarn install --frozen-lockfile', 'pod install · 74 pods', '✔ dependências instaladas em 1 min 04 s'] },
    TESTES,
    { nome: 'Gerando bundle JS', seg: 1.0, log: ['react-native bundle --platform ios --dev false', 'Hermes: compilando para bytecode', '✔ main.jsbundle · 2,3 MB'] },
    { nome: 'Compilando nativo', seg: 2.1, log: ['xcodebuild archive -scheme ClinicaSorriso -configuration Release', 'Compilando 312 arquivos Swift e Objective-C', '✔ ClinicaSorriso.xcarchive criado'] },
    { nome: 'Assinando', seg: 0.8, log: ['Certificado Apple Distribution · Nassa Tech Ltda', 'Perfil de provisionamento “Clínica Sorriso App Store”', '✔ assinatura conferida'] },
    { nome: 'Enviando artefato', seg: 0.8, log: ['ClinicaSorriso.ipa · {tam} MB', '✔ artefato guardado: clinica-sorriso-{versao}-{num}.ipa'] }
  ]
};
const ERRO_TESTE = { passo: 2, msg: '1 teste falhou: Agendar › não deixa marcar um horário que já passou.', dica: 'Veja com o Theo (QA) se mudou o teste ou a tela antes de liberar a versão.' };
const ERROS = {
  android: [
    { passo: 4, msg: 'A tarefa :app:mergeReleaseResources falhou: o Gradle ficou sem memória (Java heap space).', dica: 'Suba org.gradle.jvmargs para -Xmx4g no gradle.properties e tente de novo.' },
    { passo: 1, msg: 'Tempo esgotado ao baixar react-native-reanimated do registro do npm.', dica: 'Foi a rede da máquina de build. Tentar de novo costuma resolver.' },
    ERRO_TESTE
  ],
  ios: [
    { passo: 5, msg: 'O perfil de provisionamento “Clínica Sorriso App Store” expirou.', dica: 'Renove o perfil no Apple Developer (a build baixa o novo sozinha) e tente de novo.' },
    { passo: 1, msg: 'O CocoaPods não achou uma versão compatível do pod RNScreens.', dica: 'Rode pod repo update e tente de novo.' },
    ERRO_TESTE
  ]
};

/* ---------- checklist de cada loja ---------- */
// porVersao: precisa ser refeito a cada versão nova (o resto vale para sempre)
const CHECKLIST = {
  ios: [
    { id: 'icone', nome: 'Ícone 1024 × 1024', dica: 'PNG sem transparência e sem cantos arredondados' },
    { id: 'capturas', nome: 'Capturas de tela', dica: 'iPhone 6,9" e 6,5" — pelo menos 3 de cada' },
    { id: 'privacidade', nome: 'Política de privacidade', dica: 'clinicasorriso.com.br/privacidade' },
    { id: 'descricao', nome: 'Descrição e palavras-chave', dica: 'Até 4.000 caracteres; palavras-chave em até 100' },
    { id: 'idade', nome: 'Classificação etária', dica: 'Questionário respondido: 4+' },
    { id: 'rotulos', nome: 'Rótulos de privacidade', dica: 'Coleta nome, telefone e e-mail, sem rastreamento' },
    { id: 'revisor', nome: 'Conta de teste para o revisor', dica: 'revisao@clinicasorriso.com.br com consultas de exemplo' },
    { id: 'testes', nome: 'Testes no TestFlight', dica: 'Build aprovada pela clínica e pelo Theo (QA)', porVersao: true },
    { id: 'notas', nome: 'Notas da versão', dica: 'O que há de novo, em português', porVersao: true }
  ],
  android: [
    { id: 'icone', nome: 'Ícone 512 × 512', dica: 'PNG de 32 bits, até 1 MB' },
    { id: 'destaque', nome: 'Gráfico de recursos 1024 × 500', dica: 'A imagem de capa da página na loja' },
    { id: 'capturas', nome: 'Capturas de tela', dica: 'De 2 a 8 por tipo de aparelho' },
    { id: 'privacidade', nome: 'Política de privacidade', dica: 'clinicasorriso.com.br/privacidade' },
    { id: 'descricao', nome: 'Descrição curta e completa', dica: 'Até 80 e até 4.000 caracteres' },
    { id: 'idade', nome: 'Classificação de conteúdo (IARC)', dica: 'Questionário respondido: Livre' },
    { id: 'seguranca', nome: 'Segurança dos dados', dica: 'O que o app coleta e com quem compartilha' },
    { id: 'testes', nome: 'Teste interno', dica: 'Build instalada pela equipe pelo link do Play', porVersao: true },
    { id: 'notas', nome: 'Notas da versão', dica: 'O que há de novo, em português', porVersao: true }
  ]
};

const MODELOS_PUSH = [
  { nome: 'Lembrete de consulta', titulo: 'Sua consulta está chegando', msg: '{nome}, sua consulta de {esp} é {quando} às {hora}. Toque para ver os detalhes.', abrir: 'consultas' },
  { nome: 'Campanha de clareamento', titulo: 'Outubro do Sorriso', msg: 'Clareamento com 15% de desconto até 31/10. Toque e escolha seu horário.', abrir: 'agendar' },
  { nome: 'Pesquisa de satisfação', titulo: 'Como foi seu atendimento?', msg: 'Dê uma nota de 1 a 5 para a sua última consulta. Leva 10 segundos.', abrir: 'inicio' },
  { nome: 'Atualizar cadastro', titulo: 'Seu cadastro está em dia?', msg: 'Confira telefone e e-mail para não perder os lembretes das consultas.', abrir: 'perfil' }
];

/* ---------- datas ---------- */
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const DIAS_LONGOS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const paraData = iso => new Date(iso + 'T12:00:00');
const dataCurta = iso => { const d = paraData(iso); return `${DIAS[d.getDay()]}., ${d.getDate()} de ${MESES[d.getMonth()]}`; };
const dataLonga = iso => { const d = paraData(iso); return `${DIAS_LONGOS[d.getDay()]}, ${d.getDate()} de ${MESES_LONGOS[d.getMonth()]}`; };
function relativo(iso) {
  const dif = Math.round((paraData(iso) - paraData(NT.hojeISO())) / 864e5);
  if (dif === 0) return 'hoje';
  if (dif === 1) return 'amanhã';
  if (dif === -1) return 'ontem';
  return dif > 1 ? `em ${dif} dias` : `há ${-dif} dias`;
}
const horaCurta = v => new Date(v).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dataHora = v => `${NT.data(v)} ${horaCurta(v)}`;
const mb = n => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/* ===========================================================
   Dados: exemplo inicial, carga e gravação
   =========================================================== */
function exemplo() {
  // dia útil a partir de hoje + n (a clínica não abre domingo)
  const util = n => { while (paraData(NT.hojeISO(n)).getDay() === 0) n++; return NT.hojeISO(n); };
  const em = (dias, h, m) => { const d = new Date(); d.setDate(d.getDate() + dias); d.setHours(h, m, 0, 0); return d.toISOString(); };
  return {
    app: {
      perfil: { nome: 'Mariana Costa', tel: '(11) 98765-4321', email: 'mariana.costa@gmail.com', desde: '2023',
        notif: { permitir: true, lembrete: true, whatsapp: true, ofertas: false } },
      consultas: [
        { id: 'c1', esp: 'limpeza', dia: util(2), hora: '09:30', status: 'confirmada', criada: em(-3, 19, 12) },
        { id: 'c2', esp: 'ortodontia', dia: util(9), hora: '16:00', status: 'confirmada', criada: em(-1, 8, 40) },
        { id: 'c3', esp: 'clareamento', dia: NT.hojeISO(-18), hora: '10:00', status: 'confirmada', criada: em(-30, 14, 5) },
        { id: 'c4', esp: 'canal', dia: NT.hojeISO(-6), hora: '14:30', status: 'cancelada', criada: em(-12, 11, 0) }
      ]
    },
    bancada: { aparelho: 'iphone', tema: 'claro', instalada: { ios: 'b2', android: 'b1' } },
    builds: [
      { id: 'b1', plat: 'android', versao: '1.4.2', num: 57, status: 'ok', tam: 31.8, em: em(-1, 17, 42), sha: '8f3c2a1' },
      { id: 'b2', plat: 'ios', versao: '1.4.2', num: 57, status: 'ok', tam: 46.3, em: em(-1, 18, 6), sha: '8f3c2a1' },
      { id: 'b3', plat: 'ios', versao: '1.4.1', num: 56, status: 'ok', tam: 45.9, em: em(-12, 11, 21), sha: 'c41d9e0' },
      { id: 'b4', plat: 'ios', versao: '1.4.1', num: 55, status: 'falhou', tam: 0, em: em(-12, 10, 48), sha: 'c41d9e0', erro: ERROS.ios[0] },
      { id: 'b5', plat: 'android', versao: '1.4.1', num: 56, status: 'ok', tam: 31.2, em: em(-12, 10, 15), sha: 'c41d9e0' },
      { id: 'b6', plat: 'android', versao: '1.4.0', num: 54, status: 'ok', tam: 30.9, em: em(-26, 15, 3), sha: '27ab5f4' },
      { id: 'b7', plat: 'ios', versao: '1.4.0', num: 54, status: 'ok', tam: 45.1, em: em(-26, 15, 40), sha: '27ab5f4' }
    ],
    lojas: {
      android: { checks: { icone: true, destaque: true, capturas: true, privacidade: true, descricao: true, idade: true },
        status: 'rascunho', buildId: 'b1', enviadoEm: null, noAr: { buildId: 'b5', versao: '1.4.1', num: 56, em: em(-11, 14, 30) } },
      ios: { checks: { icone: true, capturas: true, privacidade: true, descricao: true, idade: true, rotulos: true, revisor: true },
        status: 'rascunho', buildId: 'b2', enviadoEm: null, noAr: { buildId: 'b3', versao: '1.4.1', num: 56, em: em(-10, 9, 12) } }
    },
    push: [
      { id: 'p1', titulo: 'Sua consulta está chegando', msg: 'Mariana, sua limpeza com a Dra. Camila está chegando. Toque para ver dia e horário.', abrir: 'consultas', em: em(-1, 9, 5), aparelho: 'iPhone 16', entregue: true },
      { id: 'p2', titulo: 'Outubro do Sorriso', msg: 'Clareamento com 15% de desconto até 31/10. Toque e escolha seu horário.', abrir: 'agendar', em: em(-2, 18, 30), aparelho: 'Pixel 9', entregue: true }
    ],
    pref: { aba: 'builds', plat: 'android', subida: 'patch', filtro: 'todas' }
  };
}

const CHAVES = ['app', 'bancada', 'builds', 'lojas', 'push', 'pref'];
let S = {};
function carregar() {
  if (db.ler('versao', 0) !== VERSAO_DADOS) semear();
  const ex = exemplo();
  CHAVES.forEach(k => { S[k] = db.ler(k, ex[k]) || ex[k]; });
}
function semear() {
  const ex = exemplo();
  CHAVES.forEach(k => db.gravar(k, ex[k]));
  db.gravar('versao', VERSAO_DADOS);
}
const salvar = (...chaves) => chaves.forEach(k => db.gravar(k, S[k]));

/* ---------- consultas ---------- */
const consulta = id => S.app.consultas.find(c => c.id === id);
const momento = c => new Date(`${c.dia}T${c.hora}:00`).getTime();
const proximas = () => S.app.consultas.filter(c => c.status === 'confirmada' && momento(c) > Date.now()).sort((a, b) => momento(a) - momento(b));
const historico = () => S.app.consultas.filter(c => c.status !== 'confirmada' || momento(c) <= Date.now()).sort((a, b) => momento(b) - momento(a));

// a agenda dos outros pacientes é inventada, mas sempre a mesma para o mesmo dia/hora
function ocupadoPorOutro(dia, hora, esp) {
  let h = 7;
  for (const ch of dia + hora + esp) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 100 < 32;
}
function horarios(dia, esp) {
  const d = paraData(dia);
  if (d.getDay() === 0) return [];
  const agora = new Date(), ehHoje = dia === NT.hojeISO();
  const minAgora = agora.getHours() * 60 + agora.getMinutes() + 30;   // meia hora de antecedência
  return (d.getDay() === 6 ? HORAS_SABADO : HORAS_SEMANA).map(h => {
    const [hh, mm] = h.split(':').map(Number);
    let motivo = '';
    if (ehHoje && hh * 60 + mm <= minAgora) motivo = 'passou';
    else if (S.app.consultas.some(c => c.status === 'confirmada' && c.dia === dia && c.hora === h && c.id !== ag.remarcando)) motivo = 'sua';
    else if (ocupadoPorOutro(dia, h, esp)) motivo = 'ocupado';
    return { h, motivo };
  });
}

/* ---------- builds ---------- */
const build = id => S.builds.find(b => b.id === id);
function cmpVersao(a, b) {
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}
const ultimaVersao = () => S.builds.filter(b => b.status === 'ok').map(b => b.versao).sort(cmpVersao).pop() || '1.0.0';
function subirVersao(v, tipo) {
  const [M, m, p] = v.split('.').map(Number);
  if (tipo === 'major') return `${M + 1}.0.0`;
  if (tipo === 'minor') return `${M}.${m + 1}.0`;
  if (tipo === 'patch') return `${M}.${m}.${p + 1}`;
  return v;
}
const proximoNumero = plat => Math.max(0, ...S.builds.filter(b => b.plat === plat).map(b => b.num)) + 1;
function statusBuild(b) {
  if (b.status === 'falhou') return ['Falhou', 'err'];
  const l = S.lojas[b.plat];
  if (l.status === 'revisao' && l.buildId === b.id) return ['Em revisão', 'warn'];
  if (l.noAr && l.noAr.buildId === b.id) return ['Na loja', 'ok'];
  return ['Pronta', 'acc'];
}
// a build instalada no aparelho; se ela sumiu, vale a mais nova que deu certo
function instalada(plat) {
  const b = build(S.bancada.instalada[plat]);
  if (b && b.status === 'ok') return b;
  return S.builds.filter(x => x.plat === plat && x.status === 'ok').sort((a, b2) => cmpVersao(b2.versao, a.versao) || b2.num - a.num)[0] || null;
}
const rotuloVersao = b => b ? `${b.versao} (${b.num})` : 'versão de desenvolvimento';

/* ===========================================================
   O celular: aparelho, tema, relógio, abertura do app
   =========================================================== */
const tela = $('#tela'), corpo = $('#appCorpo');
let telaAtual = 'inicio';
const pilha = [];                          // para o botão voltar do Android
let ag = { esp: null, dia: null, hora: null, remarcando: null };
let abaConsultas = 'proximas';

function relogio() { $('#stHora').textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }

function renderBancada() {
  const ap = S.bancada.aparelho, plat = APARELHO[ap].plat;
  $('#celular').dataset.aparelho = ap;
  tela.dataset.tema = S.bancada.tema;
  $$('[data-aparelho]', $('.controles')).forEach(b => b.setAttribute('aria-pressed', b.dataset.aparelho === ap));
  $$('[data-tema]', $('.controles')).forEach(b => b.setAttribute('aria-pressed', b.dataset.tema === S.bancada.tema));
  $('#legenda').innerHTML = `Clínica Sorriso <b>${rotuloVersao(instalada(plat))}</b> · ${APARELHO[ap].nome}`;
  $('#pDestino').textContent = `Vai para o ${APARELHO[ap].nome} da bancada`;
}

let tSplash = 0;
function abrirApp(ms = 900) {
  const plat = APARELHO[S.bancada.aparelho].plat;
  const s = $('#splash');
  s.innerHTML = `<div class="s-logo">${ic('dente')}</div><b>Clínica Sorriso</b><small>versão ${rotuloVersao(instalada(plat))}</small>`;
  s.classList.add('on');
  clearTimeout(tSplash);
  tSplash = setTimeout(() => s.classList.remove('on'), ms);
}

function trocarAparelho(ap) {
  if (ap === S.bancada.aparelho) return;
  S.bancada.aparelho = ap; salvar('bancada');
  fecharFolha(); renderBancada(); renderApp(); abrirApp(800);
}
function trocarTema(t) {
  S.bancada.tema = t; salvar('bancada');
  renderBancada();
  const chave = $('#aTema');
  if (chave) chave.checked = t === 'escuro';
}
function reiniciarApp() {
  fecharFolha(); esconderPush();
  telaAtual = 'inicio'; pilha.length = 0;
  ag = { esp: null, dia: null, hora: null, remarcando: null };
  renderApp(); abrirApp();
}

/* ---------- avisos dentro do celular ---------- */
let tToast = 0;
function aToast(msg) {
  const t = $('#aToast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(tToast); tToast = setTimeout(() => t.classList.remove('on'), 2200);
}
let tPush = 0;
function mostrarPush(titulo, msg, abrir) {
  const p = $('#push');
  p.innerHTML = `<span class="p-ic">${ic('dente')}</span><span class="p-txt"><span class="p-app"><span>Clínica Sorriso</span><span>agora</span></span>` +
    `<b>${esc(titulo)}</b><span class="p-msg">${esc(msg)}</span></span>`;
  p.dataset.tela = abrir || 'inicio';
  p.setAttribute('aria-label', `Notificação: ${titulo}. ${msg}. Toque para abrir.`);
  p.hidden = false;
  p.style.animation = 'none'; void p.offsetWidth; p.style.animation = '';   // reinicia a entrada
  clearTimeout(tPush); tPush = setTimeout(esconderPush, 6000);
}
function esconderPush() { $('#push').hidden = true; clearTimeout(tPush); }

let focoAntesFolha = null;
function abrirFolha(html) {
  focoAntesFolha = document.activeElement;
  $('#folha').innerHTML = html;
  $('#folhaFundo').hidden = false;
  const b = $('#folha button');
  if (b) setTimeout(() => b.focus(), 30);
}
function fecharFolha() {
  if ($('#folhaFundo').hidden) return;
  $('#folhaFundo').hidden = true;
  if (focoAntesFolha && document.contains(focoAntesFolha)) focoAntesFolha.focus();
}

/* ===========================================================
   O app da clínica: telas
   =========================================================== */
function irPara(t, voltando) {
  if (!TELAS[t]) t = 'inicio';
  if (t !== telaAtual && !voltando) pilha.push(telaAtual);
  telaAtual = t;
  fecharFolha();
  renderApp();
  corpo.scrollTop = 0;
}

const primeiroNome = () => (S.app.perfil.nome.trim().split(/\s+/)[0] || 'paciente');
const iniciais = () => S.app.perfil.nome.trim().split(/\s+/).filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase() || '?';

function renderApp() {
  const prox = proximas();
  const topos = {
    inicio: [`Olá, ${esc(primeiroNome())}`, 'Como está seu sorriso hoje?'],
    agendar: ['Agendar', 'Especialidade, dia e horário'],
    consultas: ['Minhas consultas', prox.length ? `${prox.length} marcada${prox.length > 1 ? 's' : ''}` : 'Nenhuma marcada'],
    perfil: ['Perfil', 'Seus dados e notificações']
  };
  const [tit, sub] = topos[telaAtual];
  $('#appTopo').innerHTML = `<div><h2>${tit}</h2><p>${sub}</p></div>` +
    (telaAtual === 'inicio' ? `<button type="button" class="a-avatar" data-acao="ir" data-tela="perfil" aria-label="Abrir meu perfil">${esc(iniciais())}</button>` : '');
  $('#appTabs').innerHTML = Object.entries(TELAS).map(([id, t]) =>
    `<button type="button" data-acao="ir" data-tela="${id}"${id === telaAtual ? ' aria-current="page"' : ''}><i>${ic(t.ic)}</i>${t.nome}</button>`).join('');
  corpo.innerHTML = { inicio: telaInicio, agendar: telaAgendar, consultas: telaConsultas, perfil: telaPerfil }[telaAtual]();
}

function telaInicio() {
  const c = proximas()[0];
  const hero = c
    ? `<div class="a-hero"><span class="a-tag">Próxima consulta · ${relativo(c.dia)}</span><b>${esc(ESP[c.esp].nome)}</b>` +
      `<span class="quem">${esc(ESP[c.esp].dentista)}</span>` +
      `<div class="a-quando"><span>${ic('agendar')}${dataCurta(c.dia)}</span><span>${ic('relogio')}${c.hora}</span></div>` +
      `<button type="button" class="a-btn" data-acao="ir" data-tela="consultas">Ver detalhes</button></div>`
    : `<div class="a-hero"><span class="a-tag">Próxima consulta</span><b>Nenhuma consulta marcada</b>` +
      `<span class="quem">Que tal deixar a limpeza em dia?</span>` +
      `<button type="button" class="a-btn" data-acao="ir" data-tela="agendar">Agendar agora</button></div>`;
  const dica = DICAS[new Date().getDate() % DICAS.length];
  return hero +
    `<h3 class="a-sub">Atalhos</h3><div class="a-atalhos">` +
    `<button type="button" data-acao="ir" data-tela="agendar"><i>${ic('agendar')}</i>Agendar consulta</button>` +
    `<button type="button" data-acao="ir" data-tela="consultas"><i>${ic('consultas')}</i>Minhas consultas</button>` +
    `<button type="button" class="urg" data-acao="urgencia"><i>${ic('fone')}</i>Urgência 24h</button>` +
    `<button type="button" data-acao="ir" data-tela="perfil"><i>${ic('perfil')}</i>Meu perfil</button></div>` +
    `<div class="a-card a-dica"><i>${ic('luz')}</i><div><b>Dica da Dra. Camila</b><p>${dica}</p></div></div>`;
}

function telaAgendar() {
  let h = '';
  if (ag.remarcando) {
    const v = consulta(ag.remarcando);
    if (v) h += `<div class="a-aviso">Remarcando ${esc(ESP[v.esp].nome)} de ${dataCurta(v.dia)} às ${v.hora}. ` +
      `<button type="button" class="a-link" data-acao="desistir">Desistir</button></div>`;
  }
  h += `<h3 class="a-sub">1 · Especialidade</h3><div class="a-esps">` + ESPECIALIDADES.map(e =>
    `<button type="button" class="a-esp" data-acao="esp" data-id="${e.id}" aria-pressed="${ag.esp === e.id}"><b>${e.nome}</b><small>${e.dentista}</small></button>`).join('') + '</div>';

  // os próximos 14 dias, de hoje em diante
  const dias = Array.from({ length: 14 }, (_, i) => NT.hojeISO(i));
  const m1 = paraData(dias[0]).getMonth(), m2 = paraData(dias[13]).getMonth();
  const meses = m1 === m2 ? MESES_LONGOS[m1] : `${MESES_LONGOS[m1]} – ${MESES_LONGOS[m2]}`;
  h += `<h3 class="a-sub">2 · Dia <span>${meses}</span></h3><div class="a-cal">` + dias.map((iso, i) => {
    const d = paraData(iso), fechado = d.getDay() === 0;
    const livres = horarios(iso, ag.esp || 'limpeza').filter(x => !x.motivo).length;
    const off = fechado || !livres;
    const rot = `${dataLonga(iso)}${fechado ? ' — fechado' : !livres ? ' — sem horários' : ''}`;
    return `<button type="button" class="a-dia${i === 0 ? ' hoje' : ''}" data-acao="dia" data-dia="${iso}" aria-pressed="${ag.dia === iso}" aria-label="${rot}" title="${rot}"${off ? ' disabled' : ''}>` +
      `<small>${DIAS[d.getDay()]}</small><b>${d.getDate()}</b></button>`;
  }).join('') + '</div>';

  h += `<h3 class="a-sub">3 · Horário${ag.dia ? `<span>${dataCurta(ag.dia)}</span>` : ''}</h3>`;
  if (!ag.esp || !ag.dia) {
    h += `<p class="a-nota" style="text-align:left;margin:0">Escolha a especialidade e o dia para ver os horários livres.</p>`;
  } else {
    h += '<div class="a-slots">' + horarios(ag.dia, ag.esp).map(s => {
      const rot = s.motivo === 'sua' ? 'você' : s.h;
      const tit = { passou: 'Já passou', sua: 'Você já tem consulta neste horário', ocupado: 'Reservado por outro paciente' }[s.motivo] || 'Livre';
      return `<button type="button" class="a-slot${s.motivo === 'sua' ? ' sua' : ''}" data-acao="hora" data-hora="${s.h}" aria-pressed="${ag.hora === s.h}" title="${tit}" aria-label="${s.h} — ${tit}"${s.motivo ? ' disabled' : ''}>${rot}</button>`;
    }).join('') + '</div>';
  }

  const e = ESP[ag.esp];
  const falta = [!ag.esp && 'especialidade', !ag.dia && 'dia', !ag.hora && 'horário'].filter(Boolean);
  h += `<div class="a-card a-resumo">` +
    `<div><small>Especialidade</small><b>${e ? e.nome : '—'}</b></div>` +
    `<div><small>Profissional</small><b>${e ? e.dentista : '—'}</b></div>` +
    `<div><small>Quando</small><b>${ag.dia ? dataCurta(ag.dia) : '—'}${ag.hora ? ' · ' + ag.hora : ''}</b></div>` +
    `<div><small>Duração · valor</small><b>${e ? `${e.min} min · ${NT.brl(e.preco)}` : '—'}</b></div></div>` +
    `<button type="button" class="a-btn" data-acao="confirmar"${falta.length ? ' disabled' : ''}>${ag.remarcando ? 'Confirmar novo horário' : 'Confirmar agendamento'}</button>` +
    `<p class="a-nota">${falta.length ? 'Falta escolher: ' + falta.join(', ') : 'Você recebe a confirmação por WhatsApp.'}</p>`;
  return h;
}

function cartaoConsulta(c, futura) {
  const d = paraData(c.dia), e = ESP[c.esp];
  const pill = futura ? '<span class="a-pill">Confirmada</span>'
    : c.status === 'cancelada' ? `<span class="a-pill verm">${c.nota === 'remarcada' ? 'Remarcada' : 'Cancelada'}</span>`
    : '<span class="a-pill cinza">Realizada</span>';
  return `<article class="a-card a-cons${futura ? '' : ' passada'}">` +
    `<div class="a-cons-data"><b>${d.getDate()}</b><small>${MESES[d.getMonth()]}</small></div>` +
    `<div class="a-cons-info"><b>${esc(e.nome)}</b><small>${esc(e.dentista)}</small><small>${DIAS[d.getDay()]}. · ${c.hora} · ${relativo(c.dia)}</small>${pill}</div>` +
    (futura ? `<div class="a-cons-acoes"><button type="button" class="a-btn mini sec" data-acao="remarcar" data-id="${c.id}">Remarcar</button>` +
      `<button type="button" class="a-btn mini perigo" data-acao="cancelar" data-id="${c.id}">Cancelar</button></div>` : '') +
    '</article>';
}
function telaConsultas() {
  const prox = proximas(), hist = historico();
  const lista = abaConsultas === 'proximas' ? prox : hist;
  let h = `<div class="a-segs" role="group" aria-label="Quais consultas">` +
    `<button type="button" data-acao="aba-consultas" data-aba="proximas" aria-pressed="${abaConsultas === 'proximas'}">Próximas (${prox.length})</button>` +
    `<button type="button" data-acao="aba-consultas" data-aba="historico" aria-pressed="${abaConsultas === 'historico'}">Histórico (${hist.length})</button></div>`;
  if (!lista.length) {
    h += abaConsultas === 'proximas'
      ? `<div class="a-vazio"><b>Nenhuma consulta marcada</b>Escolha um horário em poucos toques.<button type="button" class="a-btn" data-acao="ir" data-tela="agendar">Agendar consulta</button></div>`
      : `<div class="a-vazio"><b>Sem histórico ainda</b>As consultas que passaram aparecem aqui.</div>`;
  } else h += lista.map(c => cartaoConsulta(c, abaConsultas === 'proximas')).join('');
  return h;
}

function telaPerfil() {
  const p = S.app.perfil, n = p.notif, plat = APARELHO[S.bancada.aparelho].plat;
  const chave = (id, tit, sub, marcado, attr) => `<label class="a-chave"><span>${tit}<small>${sub}</small></span>` +
    `<input type="checkbox" role="switch" ${attr}${marcado ? ' checked' : ''}${id !== 'permitir' && attr.startsWith('data-notif') && !n.permitir ? ' disabled' : ''}><i></i></label>`;
  return `<div class="a-perfil"><span class="a-avatar" aria-hidden="true">${esc(iniciais())}</span><div><b>${esc(p.nome)}</b><small>Paciente desde ${p.desde}</small></div></div>` +
    `<form class="a-form" id="aPerfil" novalidate>` +
    `<label for="aNome">Nome completo</label><input class="a-campo" id="aNome" value="${esc(p.nome)}" autocomplete="name" maxlength="60">` +
    `<label for="aTel">Celular (WhatsApp)</label><input class="a-campo" id="aTel" value="${esc(p.tel)}" inputmode="tel" autocomplete="tel" maxlength="15">` +
    `<label for="aEmail">E-mail</label><input class="a-campo" id="aEmail" type="email" value="${esc(p.email)}" autocomplete="email" maxlength="80">` +
    `<p class="a-erro" id="aErro" role="alert" hidden></p>` +
    `<button type="submit" class="a-btn">Salvar alterações</button></form>` +
    `<h3 class="a-sub">Notificações</h3><div class="a-card a-lista">` +
    chave('permitir', 'Permitir notificações', 'Avisos no celular', n.permitir, 'data-notif="permitir"') +
    chave('lembrete', 'Lembrete 1 dia antes', 'Para não esquecer a consulta', n.lembrete, 'data-notif="lembrete"') +
    chave('whatsapp', 'Confirmação por WhatsApp', `No número ${esc(p.tel)}`, n.whatsapp, 'data-notif="whatsapp"') +
    chave('ofertas', 'Ofertas e novidades', 'Campanhas da clínica', n.ofertas, 'data-notif="ofertas"') + '</div>' +
    `<h3 class="a-sub">Aparência</h3><div class="a-card a-lista">` +
    chave('tema', 'Tema escuro', 'Mais confortável à noite', S.bancada.tema === 'escuro', 'id="aTema"') + '</div>' +
    `<p class="a-versao">Clínica Sorriso ${rotuloVersao(instalada(plat))} · ${PLAT[plat].nome}<br>Feito pela Nassa Tech</p>`;
}

/* ---------- ações do app ---------- */
function confirmarAgendamento() {
  const e = ESP[ag.esp];
  if (!e || !ag.dia || !ag.hora) return;
  const livre = horarios(ag.dia, ag.esp).find(s => s.h === ag.hora);
  if (!livre || livre.motivo) { aToast('Esse horário acabou de ser ocupado.'); ag.hora = null; renderApp(); return; }
  const antiga = ag.remarcando && consulta(ag.remarcando);
  if (antiga) { antiga.status = 'cancelada'; antiga.nota = 'remarcada'; }
  const nova = { id: 'c' + NT.id(), esp: ag.esp, dia: ag.dia, hora: ag.hora, status: 'confirmada', criada: new Date().toISOString() };
  S.app.consultas.push(nova);
  salvar('app');
  ag = { esp: null, dia: null, hora: null, remarcando: null };
  abaConsultas = 'proximas';
  renderApp(); renderKpis();
  abrirFolha(`<div class="a-ok" aria-hidden="true">✓</div><h4>${antiga ? 'Consulta remarcada!' : 'Consulta agendada!'}</h4>` +
    `<p>${esc(e.nome)} com ${esc(e.dentista)}.</p>` +
    `<div class="a-card"><b>${dataLonga(nova.dia)}</b> às <b>${nova.hora}</b><br>Rua Augusta, 1520 — Consolação, São Paulo</div>` +
    `<button type="button" class="a-btn" data-acao="ir" data-tela="consultas">Ver minhas consultas</button>` +
    `<button type="button" class="a-btn sec" data-acao="fechar-folha">Fechar</button>`);
  const n = S.app.perfil.notif;
  if (n.permitir && n.lembrete) setTimeout(() => mostrarPush('Consulta confirmada', `${e.nome}, ${dataCurta(nova.dia)} às ${nova.hora}. Avisamos 1 dia antes.`, 'consultas'), 1200);
}

function pedirCancelamento(id) {
  const c = consulta(id); if (!c) return;
  abrirFolha(`<h4>Cancelar consulta?</h4><p>${esc(ESP[c.esp].nome)} com ${esc(ESP[c.esp].dentista)}, ${dataLonga(c.dia)} às ${c.hora}. O horário fica livre para outro paciente.</p>` +
    `<button type="button" class="a-btn perigo" data-acao="cancelar-sim" data-id="${c.id}">Cancelar consulta</button>` +
    `<button type="button" class="a-btn sec" data-acao="fechar-folha">Manter consulta</button>`);
}
function cancelarConsulta(id) {
  const c = consulta(id); if (!c) return;
  c.status = 'cancelada'; c.canceladaEm = new Date().toISOString();
  salvar('app');
  fecharFolha(); renderApp(); renderKpis();
  aToast('Consulta cancelada.');
}

function salvarPerfil(ev) {
  ev.preventDefault();
  const nome = $('#aNome').value.trim().replace(/\s+/g, ' '), tel = $('#aTel').value.trim(), email = $('#aEmail').value.trim();
  const erros = [];
  $$('#aPerfil .a-campo').forEach(i => i.removeAttribute('aria-invalid'));
  if (nome.length < 3) { erros.push('Digite seu nome completo.'); $('#aNome').setAttribute('aria-invalid', 'true'); }
  if (tel.replace(/\D/g, '').length < 10) { erros.push('Celular com DDD, ex.: (11) 98765-4321.'); $('#aTel').setAttribute('aria-invalid', 'true'); }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { erros.push('E-mail inválido.'); $('#aEmail').setAttribute('aria-invalid', 'true'); }
  const el = $('#aErro');
  if (erros.length) { el.textContent = erros.join(' '); el.hidden = false; return; }
  Object.assign(S.app.perfil, { nome, tel, email });
  salvar('app');
  renderApp();
  aToast('Dados salvos.');
}
// máscara do celular: (11) 98765-4321
function mascaraTel(v) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  const meio = d.length === 11 ? 7 : 6;
  return `(${d.slice(0, 2)}) ${d.slice(2, meio)}-${d.slice(meio)}`;
}

tela.addEventListener('click', ev => {
  const b = ev.target.closest('[data-acao]');
  if (!b || b.disabled) return;
  const a = b.dataset.acao;
  if (a === 'ir') irPara(b.dataset.tela);
  else if (a === 'esp') {
    ag.esp = b.dataset.id;
    // o horário escolhido pode estar ocupado na outra especialidade
    if (ag.dia && ag.hora && horarios(ag.dia, ag.esp).find(s => s.h === ag.hora).motivo) ag.hora = null;
    if (ag.dia && !horarios(ag.dia, ag.esp).some(s => !s.motivo)) ag.dia = null;
    manterRolagem(renderApp);
  }
  else if (a === 'dia') { ag.dia = b.dataset.dia; ag.hora = null; manterRolagem(renderApp); }
  else if (a === 'hora') {
    ag.hora = b.dataset.hora;
    manterRolagem(renderApp);
    const conf = $('[data-acao="confirmar"]', corpo);
    if (conf) conf.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  else if (a === 'confirmar') confirmarAgendamento();
  else if (a === 'desistir') { ag = { esp: null, dia: null, hora: null, remarcando: null }; irPara('consultas'); }
  else if (a === 'aba-consultas') { abaConsultas = b.dataset.aba; renderApp(); }
  else if (a === 'cancelar') pedirCancelamento(b.dataset.id);
  else if (a === 'cancelar-sim') cancelarConsulta(b.dataset.id);
  else if (a === 'remarcar') {
    const c = consulta(b.dataset.id);
    ag = { esp: c.esp, dia: null, hora: null, remarcando: c.id };
    irPara('agendar');
  }
  else if (a === 'urgencia') abrirFolha(`<h4>Urgência 24h</h4><p>Dor forte, dente quebrado ou sangramento? O plantão da clínica atende a qualquer hora.</p>` +
    `<div class="a-card"><b>${TEL_CLINICA}</b><br>Rua Augusta, 1520 — Consolação, São Paulo</div>` +
    `<button type="button" class="a-btn" data-acao="copiar-tel">Copiar telefone</button>` +
    `<button type="button" class="a-btn sec" data-acao="fechar-folha">Fechar</button>`);
  else if (a === 'copiar-tel') NT.copiar(TEL_CLINICA).then(ok => { if (ok) aToast('Telefone copiado.'); });
  else if (a === 'fechar-folha') fecharFolha();
  else if (a === 'nav-voltar') {
    if (!$('#folhaFundo').hidden) fecharFolha();
    else if (pilha.length) irPara(pilha.pop(), true);
    else aToast('Você já está no início do app.');
  }
  else if (a === 'nav-inicio') { pilha.length = 0; irPara('inicio', true); }
  else if (a === 'nav-recentes') abrirFolha(`<h4>Apps recentes</h4>` +
    `<button type="button" class="a-recente" data-acao="fechar-folha"><span class="a-avatar" aria-hidden="true">${ic('dente')}</span><span><b>Clínica Sorriso</b><small>Toque para voltar ao app</small></span></button>` +
    `<button type="button" class="a-btn perigo" data-acao="reiniciar">Fechar e abrir de novo</button>`);
  else if (a === 'reiniciar') reiniciarApp();
});
// mantém a posição da rolagem ao redesenhar a tela de agendar
function manterRolagem(fn) { const y = corpo.scrollTop; fn(); corpo.scrollTop = y; }

$('#push').addEventListener('click', () => { const t = $('#push').dataset.tela; esconderPush(); irPara(t); });
tela.addEventListener('submit', ev => { if (ev.target.id === 'aPerfil') salvarPerfil(ev); });
tela.addEventListener('input', ev => {
  if (ev.target.id === 'aTel') ev.target.value = mascaraTel(ev.target.value);
});
tela.addEventListener('change', ev => {
  const i = ev.target;
  if (i.id === 'aTema') { trocarTema(i.checked ? 'escuro' : 'claro'); return; }
  const k = i.dataset.notif;
  if (!k) return;
  S.app.perfil.notif[k] = i.checked;
  salvar('app');
  if (k === 'permitir') {
    manterRolagem(renderApp);
    const de = $('[data-notif="permitir"]', corpo); if (de) de.focus();
  }
  aToast(i.checked ? 'Ativado.' : 'Desativado.');
});

/* ===========================================================
   Painel: números do topo
   =========================================================== */
function renderKpis() {
  const prox = proximas().length;
  const feitas = S.builds.length, ok = S.builds.filter(b => b.status === 'ok').length;
  const loja = p => {
    const l = S.lojas[p];
    const v = l.noAr ? l.noAr.versao : '—';
    const sit = l.status === 'revisao' ? 'em revisão: ' + rotuloVersao(build(l.buildId))
      : l.noAr ? `no ar desde ${NT.data(l.noAr.em)}` : 'ainda não publicado';
    return `<div class="kpi${l.status === 'revisao' ? ' warn' : ' ok'}"><span>${PLAT[p].loja}</span><b>${v}</b><small>${sit}</small></div>`;
  };
  $('#kpis').innerHTML =
    `<div class="kpi acc"><span>Consultas no app</span><b>${prox}</b><small>marcadas pela demo</small></div>` +
    `<div class="kpi"><span>Builds com sucesso</span><b>${feitas ? Math.round(ok / feitas * 100) : 0}%</b><small>${ok} de ${feitas} builds</small></div>` +
    loja('android') + loja('ios');
}

/* ===========================================================
   Builds
   =========================================================== */
function renderFormBuild() {
  $$('#segPlat button').forEach(b => b.setAttribute('aria-pressed', b.dataset.plat === S.pref.plat));
  const base = ultimaVersao();
  const op = [['mesma', 'Mesma versão', 'só build nova'], ['patch', 'Correção', 'patch'], ['minor', 'Melhoria', 'minor'], ['major', 'Grande mudança', 'major']];
  $('#selVersao').innerHTML = op.map(([v, nome, tipo]) =>
    `<option value="${v}"${S.pref.subida === v ? ' selected' : ''}>${subirVersao(base, v)} — ${nome} (${tipo})</option>`).join('');
  $('#bGerar').disabled = !!(job && job.rodando);
}

function renderBuilds() {
  const f = S.pref.filtro;
  $$('#segFiltro button').forEach(b => {
    const n = b.dataset.filtro === 'todas' ? S.builds.length : S.builds.filter(x => x.plat === b.dataset.filtro).length;
    b.textContent = `${{ todas: 'Todas', android: 'Android', ios: 'iOS' }[b.dataset.filtro]} (${n})`;
    b.setAttribute('aria-pressed', b.dataset.filtro === f);
  });
  const lista = S.builds.filter(b => f === 'todas' || b.plat === f).sort((a, b) => new Date(b.em) - new Date(a.em));
  if (!lista.length) { $('#listaBuilds').innerHTML = '<div class="vazio">Nenhuma build por aqui ainda. Gere a primeira acima.</div>'; return; }
  $('#listaBuilds').innerHTML = lista.map(b => {
    const [st, cls] = statusBuild(b);
    const noAparelho = b.status === 'ok' && instalada(b.plat) === b;
    const travada = cls === 'ok' || cls === 'warn';
    const det = b.status === 'falhou' ? `falhou em “${PASSOS[b.plat][b.erro.passo].nome}”` : `${PLAT[b.plat].ext} · ${mb(b.tam)} MB`;
    return `<div class="bld${b.id === ultimaNova ? ' nova' : ''}" data-id="${b.id}">` +
      `<span class="plat ${b.plat}">${PLAT[b.plat].nome}</span>` +
      `<div class="bld-info"><b>${b.versao}</b> <span class="dim">(${b.num})</span>${noAparelho ? '<span class="tag">● no aparelho</span>' : ''}` +
      `<small>${det} · ${dataHora(b.em)}</small></div>` +
      `<span class="badge ${cls}">${st}</span>` +
      `<div class="bld-acoes">` +
      (b.status === 'ok' ? `<button type="button" class="btn mini" data-acao="instalar"${noAparelho ? ' disabled title="Já está no aparelho"' : ''}>Instalar</button>` : '') +
      `<button type="button" class="btn mini ghost" data-acao="log">Log</button>` +
      `<button type="button" class="btn mini ghost danger" data-acao="excluir"${travada ? ` disabled title="${st}: não dá para excluir"` : ''} aria-label="Excluir build ${b.versao} (${b.num}) de ${PLAT[b.plat].nome}">Excluir</button>` +
      `</div></div>`;
  }).join('');
}
let ultimaNova = null;

/* ---------- a build rodando ---------- */
let job = null;
const espera = ms => new Promise(r => setTimeout(r, ms));
const preencher = (txt, j) => txt.replace('{sha}', j.sha).replace('{tam}', mb(j.tam)).replace('{versao}', j.versao).replace('{num}', j.num);
const shaNovo = () => Math.random().toString(16).slice(2, 9).padEnd(7, '0');

function logar(j, txt, cls = '') {
  const linha = [NT.hora(), txt, cls];
  j.log.push(linha);
  if (j !== job) return;
  const el = $('#rodLog');
  if (!el) return;
  const fim = el.scrollHeight - el.scrollTop - el.clientHeight < 30;   // só segue o final se a pessoa não rolou para cima
  el.insertAdjacentHTML('beforeend', linhaLog(linha));
  if (fim) el.scrollTop = el.scrollHeight;
}
const linhaLog = ([h, t, c]) => `<div${c ? ` class="${c}"` : ''}><span class="dim">[${h}]</span> ${esc(t)}</div>`;

function montarRodando() {
  const j = job;
  $('#buildAtual').innerHTML = `<div class="rodando">` +
    `<div class="rod-topo"><span class="plat ${j.plat}">${PLAT[j.plat].nome}</span><b>${j.versao} (${j.num})</b>` +
    `<span class="dim" id="rodStatus" aria-live="polite"></span><span class="rod-pct mono" id="rodPct">0%</span></div>` +
    `<div class="barra" id="rodBarra"><i></i></div>` +
    `<ol class="passos" id="rodPassos">${PASSOS[j.plat].map(p => `<li>${p.nome}</li>`).join('')}</ol>` +
    `<div class="log" id="rodLog" tabindex="0" aria-label="Log da build">${j.log.map(linhaLog).join('')}</div>` +
    `<div id="rodFim"></div><div class="rod-acoes" id="rodAcoes"></div></div>`;
  atualizarRodando();
}
function atualizarRodando() {
  const j = job; if (!j || !$('#rodBarra')) return;
  const pct = Math.round(j.prog * 100);
  $('#rodBarra').className = 'barra' + (j.fim === 'ok' ? ' ok' : j.fim === 'erro' ? ' err' : '');
  $('#rodBarra i').style.width = pct + '%';
  $('#rodPct').textContent = pct + '%';
  $('#rodStatus').textContent = j.fim === 'ok' ? 'Build pronta' : j.fim === 'erro' ? 'Build falhou' : PASSOS[j.plat][j.passo].nome + '…';
  $$('#rodPassos li').forEach((li, i) => {
    li.className = i < j.passo || j.fim === 'ok' ? 'ok' : i === j.passo ? (j.fim === 'erro' ? 'err' : 'vai') : '';
  });
  let fim = '', acoes = '';
  if (j.rodando) acoes = `<button type="button" class="btn mini danger" data-acao="cancelar-build">Cancelar build</button>`;
  else if (j.fim === 'erro') {
    fim = `<div class="rod-erro" role="alert"><b>Falhou em “${PASSOS[j.plat][j.erro.passo].nome}”</b><p>${esc(j.erro.msg)}</p><p class="dim">${esc(j.erro.dica)}</p></div>`;
    acoes = `<button type="button" class="btn mini ghost" data-acao="fechar-build">Fechar</button><button type="button" class="btn primary" data-acao="tentar-de-novo">↻ Tentar de novo</button>`;
  } else if (j.fim === 'ok') {
    fim = `<div class="rod-ok" role="status"><b>Build pronta.</b> ${PLAT[j.plat].ext.slice(1)} de ${mb(j.tam)} MB guardada no histórico.</div>`;
    acoes = `<button type="button" class="btn mini ghost" data-acao="fechar-build">Fechar</button><button type="button" class="btn primary" data-acao="instalar-nova">Instalar no ${APARELHO[PLAT[j.plat].aparelho].nome}</button>`;
  }
  $('#rodFim').innerHTML = fim;
  $('#rodAcoes').innerHTML = acoes;
}

async function gerarBuild(plat, versao, tentativa = 0) {
  if (job && job.rodando) return;
  const j = job = {
    id: 'b' + NT.id(), plat, versao, num: proximoNumero(plat), sha: shaNovo(), log: [], passo: 0, prog: 0, rodando: true, fim: null,
    tam: Math.round((plat === 'ios' ? 44 + Math.random() * 4 : 30 + Math.random() * 3) * 10) / 10
  };
  // uma build nova às vezes quebra; o "tentar de novo" já vem com o problema resolvido
  const falha = !tentativa && Math.random() < CHANCE_FALHA ? ERROS[plat][Math.floor(Math.random() * ERROS[plat].length)] : null;
  renderFormBuild();
  montarRodando();
  logar(j, `Build ${versao} (${j.num}) de ${PLAT[plat].nome} iniciada pela Bia${tentativa ? ' — nova tentativa' : ''}`, 'dim');
  const passos = PASSOS[plat], total = passos.reduce((s, p) => s + p.seg, 0);
  let feito = 0;
  for (let i = 0; i < passos.length; i++) {
    j.passo = i; atualizarRodando();
    const p = passos[i], quebra = falha && falha.passo === i;
    logar(j, `▸ ${p.nome}`, 'acc');
    const linhas = quebra ? p.log.slice(0, Math.max(1, p.log.length - 1)) : p.log;
    for (const l of linhas) {
      await espera(p.seg * 1000 / p.log.length);
      if (j !== job || !j.rodando) return;             // cancelada ou restaurada no meio
      logar(j, preencher(l, j), l.startsWith('✔') ? 'ok' : '');
      feito += p.seg / p.log.length;
      j.prog = feito / total; atualizarRodando();
    }
    if (quebra) {
      await espera(500);
      if (j !== job || !j.rodando) return;
      logar(j, '✖ ' + falha.msg, 'err');
      logar(j, 'Build interrompida. ' + falha.dica, 'warn');
      j.rodando = false; j.fim = 'erro'; j.erro = falha;
      guardarBuild(j, 'falhou');
      return;
    }
  }
  j.prog = 1; j.rodando = false; j.fim = 'ok';
  logar(j, `✔ Build ${versao} (${j.num}) pronta em ${dataHora(Date.now())}`, 'ok');
  guardarBuild(j, 'ok');
}
function guardarBuild(j, status) {
  const b = { id: j.id, plat: j.plat, versao: j.versao, num: j.num, status, tam: status === 'ok' ? j.tam : 0, em: new Date().toISOString(), sha: j.sha, log: j.log };
  if (j.erro) b.erro = j.erro;
  S.builds.push(b);
  // a loja passa a sugerir a build mais nova
  if (status === 'ok' && S.lojas[j.plat].status === 'rascunho') S.lojas[j.plat].buildId = b.id;
  ultimaNova = b.id;
  salvar('builds', 'lojas');
  atualizarRodando(); renderFormBuild(); renderBuilds(); renderKpis(); renderLojas();
  NT.aviso(status === 'ok' ? `Build ${j.versao} (${j.num}) de ${PLAT[j.plat].nome} pronta.` : `A build ${j.versao} (${j.num}) falhou — veja o log.`);
}
function cancelarBuild() {
  if (!job || !job.rodando) return;
  job.rodando = false;
  logar(job, 'Build cancelada pela Bia.', 'warn');
  $('#buildAtual').innerHTML = '';
  job = null;
  renderFormBuild();
  NT.aviso('Build cancelada.');
}

function instalar(id) {
  const b = build(id);
  if (!b || b.status !== 'ok') return;
  S.bancada.instalada[b.plat] = b.id;
  S.bancada.aparelho = PLAT[b.plat].aparelho;
  salvar('bancada');
  fecharFolha(); renderBancada(); renderApp(); renderBuilds(); abrirApp(1100);
  NT.aviso(`Clínica Sorriso ${rotuloVersao(b)} instalada no ${APARELHO[S.bancada.aparelho].nome}.`);
  // no celular o aparelho fica lá em cima: leva a pessoa até ele
  if (window.matchMedia('(max-width:980px)').matches) $('#celular').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// log das builds de exemplo é montado na hora a partir dos passos
function logDe(b) {
  if (b.log) return b.log;
  const j = { sha: b.sha || '0000000', tam: b.tam, versao: b.versao, num: b.num };
  let t = new Date(b.em).getTime() - 9 * 60000;
  const h = () => { t += 4000 + (t % 9) * 3000; return NT.hora(t); };
  const out = [[h(), `Build ${b.versao} (${b.num}) de ${PLAT[b.plat].nome} iniciada pela Bia`, 'dim']];
  for (const [i, p] of PASSOS[b.plat].entries()) {
    out.push([h(), `▸ ${p.nome}`, 'acc']);
    const quebra = b.erro && b.erro.passo === i;
    const linhas = quebra ? p.log.slice(0, Math.max(1, p.log.length - 1)) : p.log;
    linhas.forEach(l => out.push([h(), preencher(l, j), l.startsWith('✔') ? 'ok' : '']));
    if (quebra) { out.push([h(), '✖ ' + b.erro.msg, 'err'], [h(), 'Build interrompida. ' + b.erro.dica, 'warn']); return out; }
  }
  out.push([h(), `✔ Build ${b.versao} (${b.num}) pronta`, 'ok']);
  return out;
}
let logAberto = null;
function abrirLog(id) {
  const b = build(id); if (!b) return;
  logAberto = b;
  $('#mLogTit').textContent = `Log · ${PLAT[b.plat].nome} ${b.versao} (${b.num})`;
  $('#mLogTxt').innerHTML = logDe(b).map(linhaLog).join('');
  abrirModal($('#mLog'));
}

$('#segPlat').addEventListener('click', e => {
  const b = e.target.closest('[data-plat]'); if (!b) return;
  S.pref.plat = b.dataset.plat; salvar('pref'); renderFormBuild();
});
$('#selVersao').addEventListener('change', e => { S.pref.subida = e.target.value; salvar('pref'); });
$('#bGerar').addEventListener('click', () => gerarBuild(S.pref.plat, subirVersao(ultimaVersao(), S.pref.subida)));
$('#segFiltro').addEventListener('click', e => {
  const b = e.target.closest('[data-filtro]'); if (!b) return;
  S.pref.filtro = b.dataset.filtro; salvar('pref'); renderBuilds();
});
$('#buildAtual').addEventListener('click', e => {
  const b = e.target.closest('[data-acao]'); if (!b || !job) return;
  const a = b.dataset.acao;
  if (a === 'cancelar-build') cancelarBuild();
  else if (a === 'fechar-build') { $('#buildAtual').innerHTML = ''; job = null; renderFormBuild(); $('#bGerar').focus(); }
  else if (a === 'tentar-de-novo') gerarBuild(job.plat, job.versao, 1);
  else if (a === 'instalar-nova') instalar(job.id);
});
$('#listaBuilds').addEventListener('click', async e => {
  const bt = e.target.closest('[data-acao]'); if (!bt || bt.disabled) return;
  const id = bt.closest('.bld').dataset.id, b = build(id), a = bt.dataset.acao;
  if (a === 'instalar') instalar(id);
  else if (a === 'log') abrirLog(id);
  else if (a === 'excluir') {
    const ok = await confirmar('Excluir build?', `${PLAT[b.plat].nome} ${rotuloVersao(b)} sai do histórico e o artefato ${PLAT[b.plat].ext} é apagado.`, 'Excluir');
    if (!ok) return;
    S.builds = S.builds.filter(x => x.id !== id);
    if (S.lojas[b.plat].buildId === id) S.lojas[b.plat].buildId = null;
    salvar('builds', 'lojas');
    renderTudo();
    NT.aviso(`Build ${rotuloVersao(b)} excluída.`);
  }
});

/* ===========================================================
   Publicação nas lojas
   =========================================================== */
// builds que podem ir para a loja: deram certo e não são a que já está no ar
function candidatas(p) {
  const l = S.lojas[p];
  return S.builds.filter(b => b.plat === p && b.status === 'ok' && !(l.noAr && l.noAr.buildId === b.id))
    .sort((a, b) => cmpVersao(b.versao, a.versao) || b.num - a.num);
}
function cardLoja(p) {
  const l = S.lojas[p], trav = l.status !== 'rascunho';
  const cands = candidatas(p);
  if (!trav && l.buildId && !cands.some(b => b.id === l.buildId)) l.buildId = cands[0] ? cands[0].id : null;
  const ops = trav ? `<option>${rotuloVersao(build(l.buildId) || l.noAr)}</option>`
    : cands.length ? cands.map(b => `<option value="${b.id}"${b.id === l.buildId ? ' selected' : ''}>${rotuloVersao(b)} · ${NT.data(b.em)}</option>`).join('')
    : '<option value="">Nenhuma build pronta — gere uma na aba Builds</option>';
  const [st, cls] = { rascunho: ['Rascunho', ''], revisao: ['Em revisão', 'warn'], publicado: ['Publicado', 'ok'] }[l.status];
  return `<article class="card loja" data-loja="${p}">` +
    `<div class="loja-topo"><span class="plat ${p}">${PLAT[p].nome}</span><div><h3>${PLAT[p].loja}</h3><small class="dim">${PLAT[p].console} · br.com.clinicasorriso.app</small></div>` +
    `<span class="badge ${cls}">${st}</span></div>` +
    `<p class="loja-noar">${l.noAr ? `No ar: <b>${l.noAr.versao} (${l.noAr.num})</b> desde ${NT.data(l.noAr.em)}` : 'Ainda não publicado nesta loja'}</p>` +
    `<label class="rot" for="bld-${p}">Build para enviar</label>` +
    `<select class="campo" id="bld-${p}" data-campo="build"${trav || !cands.length ? ' disabled' : ''}>${ops}</select>` +
    `<div class="loja-prog" data-parte="prog"></div>` +
    `<ul class="checklist">${CHECKLIST[p].map(i => `<li><label><input type="checkbox" data-item="${i.id}"${l.checks[i.id] ? ' checked' : ''}${trav ? ' disabled' : ''}>` +
      `<span><b>${i.nome}</b><small>${i.dica}</small></span></label></li>`).join('')}</ul>` +
    `<div class="loja-acao" data-parte="acao"></div></article>`;
}
// progresso e botão mudam a cada item marcado; o resto do cartão fica (e o foco não se perde)
function partesLoja(p) {
  const card = $(`.loja[data-loja="${p}"]`); if (!card) return;
  const l = S.lojas[p], itens = CHECKLIST[p], feitos = itens.filter(i => l.checks[i.id]).length, total = itens.length;
  $('[data-parte="prog"]', card).innerHTML = `<div class="barra${feitos === total ? ' ok' : ''}" role="progressbar" aria-label="Checklist ${PLAT[p].loja}" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${feitos}">` +
    `<i style="width:${feitos / total * 100}%"></i></div><small><b>${feitos}</b> de ${total} itens</small>`;
  let h;
  if (l.status === 'revisao') {
    h = `<div class="loja-estado warn" role="status"><b>Em revisão</b> pela ${PLAT[p].revisor} · ${rotuloVersao(build(l.buildId))} enviada às ${horaCurta(l.enviadoEm)}.` +
      `<div class="barra"><i data-revisao="${p}" style="width:${pctRevisao(l)}%"></i></div></div>`;
  } else if (l.status === 'publicado') {
    h = `<div class="loja-estado ok" role="status"><b>Publicado!</b> A versão ${l.noAr.versao} (${l.noAr.num}) já aparece na ${PLAT[p].loja}.</div>` +
      `<button type="button" class="btn" data-acao="nova-versao">Preparar nova versão</button>`;
  } else {
    const falta = total - feitos;
    const msg = !l.buildId ? 'Escolha uma build pronta' : falta ? `Falta${falta > 1 ? 'm' : ''} ${falta} ite${falta > 1 ? 'ns' : 'm'} do checklist` : 'Tudo pronto para enviar';
    h = `<button type="button" class="btn primary" data-acao="enviar"${falta || !l.buildId ? ' disabled' : ''}>Enviar para revisão</button><small class="dim">${msg}</small>`;
  }
  $('[data-parte="acao"]', card).innerHTML = h;
}
const pctRevisao = l => Math.min(100, Math.round((Date.now() - new Date(l.enviadoEm).getTime()) / ATRASO_REVISAO * 100));

function renderLojas() {
  $('#lojas').innerHTML = cardLoja('ios') + cardLoja('android');
  partesLoja('ios'); partesLoja('android');
}

const timersRevisao = {};
function acompanharRevisoes() {
  ['ios', 'android'].forEach(p => {
    const l = S.lojas[p];
    clearTimeout(timersRevisao[p]);
    if (l.status !== 'revisao') return;
    const falta = ATRASO_REVISAO - (Date.now() - new Date(l.enviadoEm).getTime());
    timersRevisao[p] = setTimeout(() => publicar(p), Math.max(0, falta));
  });
}
// barra da revisão andando enquanto a loja não responde
setInterval(() => {
  $$('[data-revisao]').forEach(i => { i.style.width = pctRevisao(S.lojas[i.dataset.revisao]) + '%'; });
}, 400);

function enviarRevisao(p) {
  const l = S.lojas[p];
  if (l.status !== 'rascunho' || !l.buildId || CHECKLIST[p].some(i => !l.checks[i.id])) return;
  l.status = 'revisao'; l.enviadoEm = new Date().toISOString();
  salvar('lojas');
  renderLojas(); renderBuilds(); renderKpis(); acompanharRevisoes();
  NT.aviso(`${rotuloVersao(build(l.buildId))} enviada para a revisão da ${PLAT[p].revisor}.`);
}
function publicar(p) {
  const l = S.lojas[p], b = build(l.buildId);
  if (l.status !== 'revisao') return;
  l.status = 'publicado';
  l.noAr = { buildId: l.buildId, versao: b ? b.versao : '?', num: b ? b.num : 0, em: new Date().toISOString() };
  salvar('lojas');
  renderLojas(); renderBuilds(); renderKpis();
  NT.aviso(`${PLAT[p].loja}: Clínica Sorriso ${l.noAr.versao} publicada.`);
}
function novaVersao(p) {
  const l = S.lojas[p];
  l.status = 'rascunho'; l.enviadoEm = null;
  CHECKLIST[p].filter(i => i.porVersao).forEach(i => { delete l.checks[i.id]; });
  const c = candidatas(p)[0];
  l.buildId = c ? c.id : null;
  salvar('lojas');
  renderLojas(); renderKpis();
}

$('#lojas').addEventListener('change', e => {
  const card = e.target.closest('.loja'); if (!card) return;
  const p = card.dataset.loja, l = S.lojas[p];
  if (l.status !== 'rascunho') return;
  if (e.target.dataset.item) l.checks[e.target.dataset.item] = e.target.checked;
  else if (e.target.dataset.campo === 'build') l.buildId = e.target.value || null;
  salvar('lojas');
  partesLoja(p);
});
$('#lojas').addEventListener('click', e => {
  const b = e.target.closest('[data-acao]'); if (!b || b.disabled) return;
  const p = b.closest('.loja').dataset.loja;
  if (b.dataset.acao === 'enviar') enviarRevisao(p);
  else if (b.dataset.acao === 'nova-versao') novaVersao(p);
});

/* ===========================================================
   Push de teste
   =========================================================== */
function preencherModelo(i) {
  const m = MODELOS_PUSH[i], c = proximas()[0];
  const msg = c ? m.msg.replace('{nome}', primeiroNome()).replace('{esp}', ESP[c.esp].nome).replace('{quando}', relativo(c.dia)).replace('{hora}', c.hora)
    : m.msg.includes('{esp}') ? `${primeiroNome()}, que tal marcar sua próxima limpeza? Toque para ver os horários.` : m.msg;
  $('#pTitulo').value = m.titulo; $('#pMsg').value = msg; $('#pAbrir').value = c || !m.msg.includes('{esp}') ? m.abrir : 'agendar';
  contarPush();
}
function contarPush() {
  $('#cTitulo').textContent = `${$('#pTitulo').value.length}/50`;
  $('#cMsg').textContent = `${$('#pMsg').value.length}/150`;
}
const NOMES_TELA = { inicio: 'Início', agendar: 'Agendar', consultas: 'Minhas consultas', perfil: 'Perfil' };
function renderPush() {
  if (!S.push.length) { $('#listaPush').innerHTML = '<div class="vazio">Nenhuma notificação enviada ainda.</div>'; return; }
  $('#listaPush').innerHTML = S.push.map(p => `<div class="psh" data-id="${p.id}"><div><b>${esc(p.titulo)}</b><p>${esc(p.msg)}</p>` +
    `<small>${dataHora(p.em)} · ${esc(p.aparelho)} · abre ${NOMES_TELA[p.abrir]}</small></div>` +
    `<div class="psh-lado"><span class="badge ${p.entregue ? 'ok' : 'err'}">${p.entregue ? 'Entregue' : 'Bloqueada'}</span>` +
    `<button type="button" class="btn mini ghost" data-acao="reenviar">Reenviar</button></div></div>`).join('');
}
function enviarPush(titulo, msg, abrir) {
  const entregue = S.app.perfil.notif.permitir;
  const ap = APARELHO[S.bancada.aparelho].nome;
  S.push.unshift({ id: 'p' + NT.id(), titulo, msg, abrir, em: new Date().toISOString(), aparelho: ap, entregue });
  S.push = S.push.slice(0, 30);
  salvar('push');
  renderPush();
  if (entregue) { mostrarPush(titulo, msg, abrir); NT.aviso(`Notificação entregue no ${ap}.`); }
  else NT.aviso('Não entregue: as notificações estão desligadas no Perfil do app.');
}
$('#pModelo').innerHTML = MODELOS_PUSH.map((m, i) => `<option value="${i}">${m.nome}</option>`).join('');
$('#pModelo').addEventListener('change', e => preencherModelo(+e.target.value));
$('#pTitulo').addEventListener('input', contarPush);
$('#pMsg').addEventListener('input', contarPush);
$('#fPush').addEventListener('submit', e => {
  e.preventDefault();
  const titulo = $('#pTitulo').value.trim(), msg = $('#pMsg').value.trim();
  const erro = !titulo ? 'Escreva um título.' : !msg ? 'Escreva a mensagem.' : '';
  $('#pErro').textContent = erro; $('#pErro').hidden = !erro;
  if (erro) { (titulo ? $('#pMsg') : $('#pTitulo')).focus(); return; }
  enviarPush(titulo, msg, $('#pAbrir').value);
});
$('#listaPush').addEventListener('click', e => {
  const b = e.target.closest('[data-acao="reenviar"]'); if (!b) return;
  const p = S.push.find(x => x.id === b.closest('.psh').dataset.id);
  if (p) enviarPush(p.titulo, p.msg, p.abrir);
});
$('#bLimparPush').addEventListener('click', async () => {
  if (!S.push.length) { NT.aviso('O histórico já está vazio.'); return; }
  if (!await confirmar('Limpar histórico?', 'As notificações enviadas somem desta lista. O que já chegou no aparelho não muda.', 'Limpar')) return;
  S.push = []; salvar('push'); renderPush();
});

/* ===========================================================
   Modais da página, topo e partida
   =========================================================== */
// abre um modal e devolve o foco a quem abriu quando ele fechar (por botão, Esc ou clique fora)
let resolverConf = null;
function abrirModal(fundo) {
  const antes = document.activeElement;
  NT.modal(fundo, true);
  const ob = new MutationObserver(() => {
    if (!fundo.hidden) return;
    ob.disconnect();
    if (fundo.id === 'mConf' && resolverConf) { resolverConf(false); resolverConf = null; }
    if (antes && document.contains(antes)) antes.focus();
  });
  ob.observe(fundo, { attributes: true, attributeFilter: ['hidden'] });
}
function confirmar(titulo, texto, rotulo) {
  $('#mConfTit').textContent = titulo; $('#mConfTxt').textContent = texto; $('#mConfSim').textContent = rotulo;
  return new Promise(res => { resolverConf = res; abrirModal($('#mConf')); });
}
$('#mConfSim').addEventListener('click', () => { if (resolverConf) { resolverConf(true); resolverConf = null; } $('#mConf').hidden = true; });
$('#mConfNao').addEventListener('click', () => { $('#mConf').hidden = true; });
$('#mLogFechar').addEventListener('click', () => { $('#mLog').hidden = true; });
$('#mLogBaixar').addEventListener('click', () => {
  const b = logAberto; if (!b) return;
  NT.baixar(`build-${b.plat}-${b.versao}-${b.num}.log.txt`, logDe(b).map(([h, t]) => `[${h}] ${t}`).join('\n'));
});

// Esc fecha a folha do app (os modais da página o base.js já fecha)
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!$('#mConf').hidden || !$('#mLog').hidden) return;
  if (!$('#folhaFundo').hidden) { fecharFolha(); e.preventDefault(); }
});
$('#folhaFundo').addEventListener('click', e => { if (e.target.id === 'folhaFundo') fecharFolha(); });

$$('.controles [data-aparelho]').forEach(b => b.addEventListener('click', () => trocarAparelho(b.dataset.aparelho)));
$$('.controles [data-tema]').forEach(b => b.addEventListener('click', () => trocarTema(b.dataset.tema)));
$('#bReiniciar').addEventListener('click', reiniciarApp);

$('#bRestaurar').addEventListener('click', async () => {
  if (!await confirmar('Restaurar o exemplo?', 'Consultas, perfil, builds, checklist das lojas e notificações voltam ao exemplo da Clínica Sorriso. O que você fez aqui se perde.', 'Restaurar')) return;
  if (job) { job.rodando = false; job = null; $('#buildAtual').innerHTML = ''; }
  semear(); carregar();
  telaAtual = 'inicio'; pilha.length = 0; ultimaNova = null;
  ag = { esp: null, dia: null, hora: null, remarcando: null };
  esconderPush(); renderTudo(); acompanharRevisoes(); abrirApp();
  NT.aviso('Exemplo restaurado.');
});

$('#bRelatorio').addEventListener('click', () => {
  const linhas = [
    'Laboratório Mobile — app Clínica Sorriso (br.com.clinicasorriso.app)',
    `Gerado em ${dataHora(Date.now())} · Bia, Mobile · Nassa Tech`, '',
    'LOJAS'
  ];
  ['ios', 'android'].forEach(p => {
    const l = S.lojas[p], feitos = CHECKLIST[p].filter(i => l.checks[i.id]).length;
    linhas.push(`- ${PLAT[p].loja}: ${{ rascunho: 'rascunho', revisao: 'em revisão', publicado: 'publicado' }[l.status]}` +
      ` · no ar ${l.noAr ? rotuloVersao(l.noAr) : '—'} · checklist ${feitos}/${CHECKLIST[p].length}` +
      (l.buildId ? ` · próxima ${rotuloVersao(build(l.buildId))}` : ''));
    const falta = CHECKLIST[p].filter(i => !l.checks[i.id]).map(i => i.nome);
    if (falta.length && l.status === 'rascunho') linhas.push(`  falta: ${falta.join('; ')}`);
  });
  linhas.push('', 'BUILDS');
  [...S.builds].sort((a, b) => new Date(b.em) - new Date(a.em)).forEach(b => {
    linhas.push(`- ${PLAT[b.plat].nome.padEnd(7)} ${rotuloVersao(b).padEnd(11)} ${statusBuild(b)[0].padEnd(10)} ` +
      `${b.status === 'ok' ? (mb(b.tam) + ' MB').padEnd(8) : '—'.padEnd(8)} ${dataHora(b.em)}` + (b.erro ? `  (${b.erro.msg})` : ''));
  });
  const prox = proximas();
  linhas.push('', 'APP DE DEMONSTRAÇÃO', `- ${prox.length} consulta(s) marcada(s), ${historico().length} no histórico`);
  prox.forEach(c => linhas.push(`  ${dataCurta(c.dia)} ${c.hora} · ${ESP[c.esp].nome} · ${ESP[c.esp].dentista}`));
  NT.baixar(`laboratorio-mobile-${NT.hojeISO()}.txt`, linhas.join('\n'));
  NT.aviso('Relatório baixado.');
});

function renderTudo() {
  renderBancada(); renderApp(); renderKpis(); renderFormBuild(); renderBuilds(); renderLojas(); renderPush();
}

carregar();
renderTudo();
relogio(); setInterval(relogio, 10000);
preencherModelo(0);
acompanharRevisoes();
abrirApp(700);

// a aba aberta do painel volta igual no próximo acesso
NT.abas($('.painel'), aba => { S.pref.aba = aba; salvar('pref'); });
const abaSalva = $(`.painel .aba[data-aba="${S.pref.aba}"]`);
if (abaSalva && S.pref.aba !== 'builds') abaSalva.click();
})();
