/* ===========================================================
   Estúdio de Landing Pages — sistema do Lucas (Front-end)

   Monta a landing page de um cliente por seções: liga, desliga,
   reordena e edita os textos; escolhe cor, fundo e fonte; parte de
   um modelo pronto. A prévia é um <iframe srcdoc> que muda de
   largura (desktop, tablet, celular). O mesmo gerador produz a
   prévia e o HTML exportado: o que aparece aqui é o que vai ao ar.
   Tudo fica salvo no navegador via NT.dados('frontend').
   =========================================================== */
(() => {
'use strict';

const D = NT.dados('frontend');
const $ = (s, r = document) => r.querySelector(s);
const esc = NT.esc;
const clonar = o => JSON.parse(JSON.stringify(o));

/* ---------- tipos de seção: o formulário do editor é montado daqui ---------- */
const MENU = ['menu', 'Nome no menu (vazio = fora do menu)'];
const TIT = ['titulo', 'Título', 'tit'];
const SUB = ['subtitulo', 'Subtítulo', 'area'];
const TIPOS = {
  topo: { nome: 'Topo com chamada', ico: '🏁', fixo: 1, campos: [['marca', 'Nome da marca'], ['selo', 'Selo acima do título'],
    ['titulo', 'Título principal', 'tit'], SUB, ['botao', 'Botão principal'], ['link', 'Link do botão principal (#contato, https://…)'],
    ['botao2', 'Botão secundário (opcional)'], ['link2', 'Link do botão secundário'], ['emoji', 'Ilustração (um emoji)']] },
  servicos: { nome: 'Serviços', ico: '🧰', campos: [MENU, TIT, SUB],
    itens: { nome: 'Serviço', plural: 'Serviços', novo: { icone: '⭐', titulo: 'Novo serviço', texto: 'Descreva o serviço em uma ou duas frases.' },
      campos: [['icone', 'Ícone (emoji)'], ['titulo', 'Nome'], ['texto', 'Descrição', 'area']] } },
  sobre: { nome: 'Sobre', ico: '📖', campos: [MENU, TIT, ['texto', 'Texto (linha em branco separa parágrafos)', 'area']],
    itens: { nome: 'Número', plural: 'Números em destaque', novo: { valor: '100%', rotulo: 'nova legenda' },
      campos: [['valor', 'Número'], ['rotulo', 'Legenda']] } },
  depoimentos: { nome: 'Depoimentos', ico: '💬', campos: [MENU, TIT],
    itens: { nome: 'Depoimento', plural: 'Depoimentos', novo: { nome: 'Nome do cliente', detalhe: 'bairro ou profissão', texto: 'O que o cliente disse sobre o serviço.', nota: 5 },
      campos: [['nome', 'Nome'], ['detalhe', 'Detalhe (bairro, profissão…)'], ['texto', 'Depoimento', 'area'], ['nota', 'Estrelas', 'nota']] } },
  precos: { nome: 'Preços e planos', ico: '🏷️', campos: [MENU, TIT, SUB],
    itens: { nome: 'Plano', plural: 'Planos', novo: { nome: 'Novo plano', preco: 'R$ 0,00', periodo: '/mês', recursos: 'Primeiro benefício\nSegundo benefício', botao: 'Quero este', destaque: false },
      campos: [['nome', 'Nome do plano'], ['preco', 'Preço'], ['periodo', 'Período ou detalhe'], ['recursos', 'O que inclui (um por linha)', 'area'],
        ['botao', 'Texto do botão'], ['destaque', 'Destacar como o mais escolhido', 'check']] } },
  faq: { nome: 'Perguntas frequentes', ico: '❓', campos: [MENU, TIT],
    itens: { nome: 'Pergunta', plural: 'Perguntas', novo: { pergunta: 'Nova pergunta?', resposta: 'Resposta curta e direta.' },
      campos: [['pergunta', 'Pergunta'], ['resposta', 'Resposta', 'area']] } },
  contato: { nome: 'Contato com formulário', ico: '✉️', campos: [MENU, TIT, SUB, ['telefone', 'Telefone'],
    ['whatsapp', 'WhatsApp (DDI + DDD + número, só dígitos)'], ['email', 'E-mail'], ['endereco', 'Endereço'],
    ['horario', 'Horário de atendimento'], ['botao', 'Botão do formulário'], ['flutuante', 'Botão flutuante do WhatsApp', 'check']] },
  rodape: { nome: 'Rodapé', ico: '🔻', fixo: 1, campos: [['texto', 'Texto do rodapé', 'area'], ['instagram', 'Instagram (@usuário)'],
    ['facebook', 'Facebook (link)'], ['linkedin', 'LinkedIn (link)'], ['credito', 'Mostrar “Site feito pela Nassa Tech”', 'check']] }
};
const ORDEM = Object.keys(TIPOS);

/* ---------- tema ---------- */
// Só fontes do sistema: a página exportada abre na hora e não depende de serviço externo
const SANS = "system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
const FONTES = {
  moderna: { nome: 'Moderna (sem serifa)', corpo: SANS, tit: SANS },
  amigavel: { nome: 'Amigável (arredondada)', corpo: "'Trebuchet MS',Ubuntu,'Segoe UI',sans-serif", tit: "'Trebuchet MS',Ubuntu,'Segoe UI',sans-serif" },
  elegante: { nome: 'Elegante (títulos com serifa)', corpo: SANS, tit: "Georgia,'Times New Roman',serif" },
  classica: { nome: 'Clássica (toda com serifa)', corpo: "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif", tit: "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif" },
  forte: { nome: 'Forte (títulos condensados)', corpo: SANS, tit: "Impact,'Arial Narrow Bold','Arial Narrow',sans-serif", caixa: 1 }
};
const CORES = ['#d97706', '#b91c1c', '#db2777', '#7c3aed', '#2563eb', '#0891b2', '#0d9488', '#16a34a', '#f97316', '#b08d57', '#334155'];
const LARGURAS = { desktop: 1280, tablet: 768, celular: 375 };

/* ---------- modelos de partida (clientes reais da casa) ---------- */
const MODELOS = {
  padaria: {
    cliente: 'Padaria Pão de Mel', nome: 'Site principal', resumo: 'Comércio de bairro · claro e acolhedor',
    tema: { cor: '#d97706', modo: 'claro', fonte: 'amigavel', cantos: 'redondo' },
    pagina: { titulo: 'Padaria Pão de Mel — pães artesanais na Vila Mariana', descricao: 'Pão quentinho a cada hora, bolos sob encomenda e cestas de café da manhã com entrega na Vila Mariana e região. Peça pelo WhatsApp.' },
    secoes: {
      topo: { marca: 'Padaria Pão de Mel', selo: 'Fornada nova a cada hora', titulo: 'O pão quentinho do *seu bairro*, desde 1998', subtitulo: 'Pães de fermentação natural, bolos caseiros e cestas de café da manhã feitas na hora, com entrega na Vila Mariana e região.', botao: 'Pedir pelo WhatsApp', link: '#contato', botao2: 'Ver as cestas', link2: '#precos', emoji: '🥐' },
      servicos: { menu: 'Produtos', titulo: 'Feito aqui, todo dia', subtitulo: 'Tudo sai do nosso forno — nada de massa congelada.', itens: [
        { icone: '🥖', titulo: 'Pães artesanais', texto: 'Francês, italiano, australiano e de fermentação natural, assados de hora em hora das 6h às 20h.' },
        { icone: '🎂', titulo: 'Bolos sob encomenda', texto: 'Bolos de aniversário e de festa com os recheios da casa. Encomende com 48 horas de antecedência.' },
        { icone: '☕', titulo: 'Café da manhã', texto: 'Salão com 30 lugares, pão na chapa, tapioca e café coado na hora.' },
        { icone: '🛵', titulo: 'Entrega rápida', texto: 'Entregamos em até 40 minutos num raio de 4 km, pelo WhatsApp ou pelo iFood.' }] },
      sobre: { menu: 'Nossa história', titulo: 'Uma padaria de *família*', texto: 'A Pão de Mel nasceu em 1998, quando seu Antônio e dona Lurdes abriram um balcão pequeno na Rua Domingos de Morais.\n\nHoje a segunda geração cuida do forno, mas a receita do pão de mel que deu nome à casa continua a mesma: mel de laranjeira, especiarias e cobertura de chocolate meio amargo.', itens: [
        { valor: '27 anos', rotulo: 'de forno aceso' }, { valor: '1.200', rotulo: 'pães por dia' }, { valor: '4,9 ★', rotulo: 'de nota no Google' }] },
      depoimentos: { menu: 'Clientes', titulo: 'Quem prova, *volta*', itens: [
        { nome: 'Fernanda Lima', detalhe: 'Vila Mariana', texto: 'O pão de fermentação natural é o melhor da região. Encomendei o bolo do aniversário da minha filha e chegou perfeito.', nota: 5 },
        { nome: 'Roberto Alves', detalhe: 'cliente desde 2005', texto: 'Tomo café ali todo dia antes do trabalho. Padaria de bairro de verdade: todo mundo te conhece pelo nome.', nota: 5 },
        { nome: 'Camila Souza', detalhe: 'Saúde', texto: 'A cesta de café da manhã foi o presente de Dia das Mães mais elogiado da família. Pontual e caprichada.', nota: 5 }] },
      precos: { menu: 'Cestas', titulo: 'Cestas de café da manhã', subtitulo: 'Montadas na hora e entregues com cartão personalizado.', itens: [
        { nome: 'Cesta Simples', preco: 'R$ 89,90', periodo: 'para 2 pessoas', recursos: 'Pães sortidos\nGeleia artesanal\nSuco de laranja 500 ml\nFatia de bolo caseiro', botao: 'Encomendar', destaque: false },
        { nome: 'Cesta Família', preco: 'R$ 149,90', periodo: 'para 4 pessoas', recursos: 'Tudo da Cesta Simples\nFrios selecionados\nFrutas da estação\nPão de mel da casa (4 un.)', botao: 'Encomendar', destaque: true },
        { nome: 'Cesta Especial', preco: 'R$ 219,90', periodo: 'para presentear', recursos: 'Tudo da Cesta Família\nEspumante sem álcool\nCesta de vime\nEntrega com hora marcada', botao: 'Encomendar', destaque: false }] },
      faq: { menu: 'Dúvidas', titulo: 'Perguntas frequentes', itens: [
        { pergunta: 'Com quanto tempo de antecedência preciso encomendar?', resposta: 'Cestas pedem 24 horas e bolos de festa, 48 horas. Para o mesmo dia, chame no WhatsApp que a gente vê o que dá para fazer.' },
        { pergunta: 'Vocês entregam em quais bairros?', resposta: 'Vila Mariana, Saúde, Paraíso, Aclimação e Moema. Para outros bairros, a taxa é calculada pelo endereço.' },
        { pergunta: 'Tem opções sem glúten ou sem lactose?', resposta: 'Sim. Temos pão sem glúten às terças e sextas, e bolos sem lactose sob encomenda.' },
        { pergunta: 'Quais formas de pagamento vocês aceitam?', resposta: 'Pix, cartão de crédito e débito, vale-refeição e dinheiro.' }] },
      contato: { menu: 'Contato', titulo: 'Faça sua encomenda', subtitulo: 'Mande uma mensagem e respondemos em poucos minutos no horário de funcionamento.', telefone: '(11) 5571-2398', whatsapp: '5511987654321', email: 'contato@paodemel.com.br', endereco: 'Rua Domingos de Morais, 1.482 — Vila Mariana, São Paulo/SP', horario: 'Todos os dias, das 6h às 21h', botao: 'Enviar encomenda', flutuante: true },
      rodape: { texto: '© 2026 Padaria Pão de Mel. Feito com farinha, tempo e carinho.', instagram: '@padariapaodemel', facebook: '', linkedin: '', credito: true }
    }
  },
  clinica: {
    cliente: 'Clínica Sorriso', nome: 'Site institucional', resumo: 'Saúde · claro e limpo',
    tema: { cor: '#0d9488', modo: 'claro', fonte: 'moderna', cantos: 'redondo' },
    pagina: { titulo: 'Clínica Sorriso — dentistas em Moema', descricao: 'Clínica odontológica em Moema: clareamento, implantes, ortodontia e prevenção. Primeira avaliação sem custo e atendimento até as 20h.' },
    secoes: {
      topo: { marca: 'Clínica Sorriso', selo: 'Primeira avaliação sem custo', titulo: 'Seu sorriso em *boas mãos*, do check-up ao implante', subtitulo: 'Clínica odontológica em Moema com dentistas especialistas, atendimento sem pressa e horários até as 20h.', botao: 'Agendar avaliação', link: '#contato', botao2: 'Conhecer tratamentos', link2: '#servicos', emoji: '🦷' },
      servicos: { menu: 'Tratamentos', titulo: 'Tratamentos', subtitulo: 'Especialistas para cada etapa do cuidado com a sua boca.', itens: [
        { icone: '✨', titulo: 'Clareamento', texto: 'Clareamento a laser no consultório ou caseiro com moldeira, sempre com acompanhamento do dentista.' },
        { icone: '🦷', titulo: 'Implantes', texto: 'Implantes com planejamento digital e carga imediata quando o caso permite.' },
        { icone: '😁', titulo: 'Ortodontia', texto: 'Aparelho fixo, autoligado ou alinhadores transparentes, para adultos e crianças.' },
        { icone: '🪥', titulo: 'Limpeza e prevenção', texto: 'Profilaxia, aplicação de flúor e check-up completo a cada seis meses.' }] },
      sobre: { menu: 'A clínica', titulo: 'Cuidado que começa na *escuta*', texto: 'A Clínica Sorriso foi fundada pela Dra. Helena Prado em 2012 com uma ideia simples: ninguém deveria ter medo de ir ao dentista.\n\nCada consulta começa com conversa, o plano de tratamento vem por escrito com valores claros e você decide o ritmo. Atendemos adultos e crianças a partir de 3 anos.', itens: [
        { valor: '12 anos', rotulo: 'cuidando de sorrisos' }, { valor: '8', rotulo: 'dentistas especialistas' }, { valor: '+9 mil', rotulo: 'pacientes atendidos' }] },
      depoimentos: { menu: 'Pacientes', titulo: 'O que dizem nossos pacientes', itens: [
        { nome: 'Juliana Martins', detalhe: 'ortodontia', texto: 'Fiz o tratamento com alinhadores em 14 meses. Equipe atenciosa e sempre pontual nas consultas.', nota: 5 },
        { nome: 'Marcos Oliveira', detalhe: 'implante', texto: 'Morria de medo de implante. A Dra. Helena explicou cada etapa e não senti nada. Recomendo de olhos fechados.', nota: 5 },
        { nome: 'Patrícia Gomes', detalhe: 'mãe do Pedro, 6 anos', texto: 'Meu filho adora ir à clínica. A sala infantil e a paciência da equipe fazem toda a diferença.', nota: 5 }] },
      precos: { menu: 'Planos', titulo: 'Planos de cuidado contínuo', subtitulo: 'Mensalidade fixa, sem carência para limpeza e urgência.', itens: [
        { nome: 'Essencial', preco: 'R$ 59,90', periodo: '/mês', recursos: 'Duas limpezas por ano\nCheck-up com radiografia\nUrgência 24 horas\n10% de desconto em tratamentos', botao: 'Assinar', destaque: false },
        { nome: 'Completo', preco: 'R$ 99,90', periodo: '/mês', recursos: 'Tudo do Essencial\nClareamento caseiro anual\nPlaca para bruxismo\n25% de desconto em tratamentos', botao: 'Assinar', destaque: true },
        { nome: 'Família', preco: 'R$ 149,90', periodo: '/mês, até 4 pessoas', recursos: 'Tudo do Essencial para todos\nFlúor para as crianças\nAgenda prioritária\n20% de desconto em tratamentos', botao: 'Assinar', destaque: false }] },
      faq: { menu: 'Dúvidas', titulo: 'Perguntas frequentes', itens: [
        { pergunta: 'Vocês aceitam convênio?', resposta: 'Atendemos Amil Dental, OdontoPrev e SulAmérica Odonto. Para os demais, emitimos recibo para reembolso.' },
        { pergunta: 'A primeira avaliação é mesmo sem custo?', resposta: 'Sim. Ela inclui exame clínico e plano de tratamento por escrito, sem compromisso.' },
        { pergunta: 'Atendem urgência?', resposta: 'Sim. Pacientes dos planos têm atendimento de urgência 24 horas pelo telefone de plantão.' },
        { pergunta: 'Tem estacionamento?', resposta: 'Temos convênio com o estacionamento ao lado, com 2 horas grátis.' }] },
      contato: { menu: 'Agendar', titulo: 'Agende sua avaliação', subtitulo: 'Diga o melhor horário e confirmamos pelo WhatsApp.', telefone: '(11) 5051-7720', whatsapp: '5511991234567', email: 'agenda@clinicasorriso.com.br', endereco: 'Av. Ibirapuera, 2.120, conj. 54 — Moema, São Paulo/SP', horario: 'Segunda a sexta, 8h às 20h · sábado, 8h às 13h', botao: 'Solicitar horário', flutuante: true },
      rodape: { texto: '© 2026 Clínica Sorriso · Responsável técnica: Dra. Helena Prado — CRO-SP 98.765', instagram: '@clinicasorriso', facebook: '', linkedin: '', credito: true }
    }
  },
  advocacia: {
    cliente: 'Advocacia Duarte', nome: 'Site do escritório', resumo: 'Serviços profissionais · escuro e sóbrio',
    tema: { cor: '#b08d57', modo: 'escuro', fonte: 'elegante', cantos: 'reto' },
    pagina: { titulo: 'Advocacia Duarte — família, trabalhista e empresarial', descricao: 'Escritório com 20 anos de atuação em direito de família, trabalhista, empresarial e do consumidor. Atendimento nos Jardins e on-line.' },
    // OAB não permite divulgar honorários nem depoimentos: essas seções começam desligadas
    ocultas: ['depoimentos', 'precos'],
    secoes: {
      topo: { marca: 'Advocacia Duarte', selo: 'OAB/SP · desde 2005', titulo: 'Orientação jurídica *clara* para decisões que não podem esperar', subtitulo: 'Atuação em direito de família, trabalhista e empresarial, com atendimento presencial nos Jardins e on-line para todo o Brasil.', botao: 'Agendar consulta', link: '#contato', botao2: 'Áreas de atuação', link2: '#servicos', emoji: '⚖️' },
      servicos: { menu: 'Áreas', titulo: 'Áreas de atuação', subtitulo: 'Um advogado responsável acompanha o seu caso do início ao fim.', itens: [
        { icone: '👨‍👩‍👧', titulo: 'Família e sucessões', texto: 'Divórcio, guarda, pensão alimentícia, inventário e planejamento sucessório.' },
        { icone: '💼', titulo: 'Trabalhista', texto: 'Assessoria a empresas e trabalhadores em rescisões, acordos e ações trabalhistas.' },
        { icone: '🏢', titulo: 'Empresarial', texto: 'Contratos, abertura de empresas, acordos de sócios e recuperação de créditos.' },
        { icone: '🛡️', titulo: 'Consumidor', texto: 'Cobranças indevidas e problemas com bancos, planos de saúde e companhias aéreas.' }] },
      sobre: { menu: 'O escritório', titulo: 'Advocacia Duarte', texto: 'Fundado em 2005 pelo Dr. Ricardo Duarte, o escritório reúne seis advogados e uma equipe de apoio dedicada a explicar cada etapa do processo sem juridiquês.\n\nAcreditamos que um bom acordo vale mais que uma longa disputa — mas, quando o caminho é o tribunal, estamos preparados.', itens: [
        { valor: '20 anos', rotulo: 'de atuação' }, { valor: '3.400', rotulo: 'casos conduzidos' }, { valor: '6', rotulo: 'advogados associados' }] },
      depoimentos: { menu: 'Clientes', titulo: 'Depoimentos de clientes', itens: [
        { nome: 'Ana Beatriz R.', detalhe: 'inventário', texto: 'Resolveram o inventário da minha família em menos tempo do que imaginávamos, sempre explicando tudo com paciência.', nota: 5 },
        { nome: 'Carlos Henrique M.', detalhe: 'empresário', texto: 'Cuidam da parte jurídica da minha empresa há seis anos. Respostas rápidas e contratos sem surpresa.', nota: 5 }] },
      precos: { menu: 'Atendimento', titulo: 'Formas de atendimento', subtitulo: 'Honorários conforme a tabela da OAB/SP, apresentados por escrito antes de começar.', itens: [
        { nome: 'Consulta', preco: 'Sob consulta', periodo: 'presencial ou on-line', recursos: 'Análise do caso e dos documentos\nOrientação por escrito\nReunião de até 1 hora', botao: 'Agendar', destaque: false },
        { nome: 'Assessoria mensal', preco: 'Sob consulta', periodo: 'para empresas', recursos: 'Contratos e notificações\nAtendimento prioritário\nRelatório mensal dos processos', botao: 'Falar com um advogado', destaque: true }] },
      faq: { menu: 'Dúvidas', titulo: 'Perguntas frequentes', itens: [
        { pergunta: 'A primeira consulta é cobrada?', resposta: 'A consulta segue a tabela de honorários da OAB/SP. Em casos trabalhistas, a primeira análise é feita sem custo.' },
        { pergunta: 'Vocês atendem on-line?', resposta: 'Sim. Fazemos reuniões por videochamada e assinatura digital de documentos para clientes de todo o Brasil.' },
        { pergunta: 'Quanto tempo leva um processo?', resposta: 'Depende da área e da vara. Na primeira reunião apresentamos uma estimativa realista e os possíveis atalhos, como acordo e mediação.' },
        { pergunta: 'Meus dados ficam protegidos?', resposta: 'Sim. Todo atendimento é sigiloso por lei, e seguimos a LGPD no tratamento das suas informações.' }] },
      contato: { menu: 'Contato', titulo: 'Agende uma conversa', subtitulo: 'Conte brevemente o seu caso. Um advogado retorna em até um dia útil.', telefone: '(11) 3062-4410', whatsapp: '5511976543210', email: 'contato@advocaciaduarte.com.br', endereco: 'Rua Oscar Freire, 379, 8º andar — Jardins, São Paulo/SP', horario: 'Segunda a sexta, das 9h às 18h', botao: 'Enviar mensagem', flutuante: false },
      rodape: { texto: '© 2026 Advocacia Duarte · Sociedade de advogados inscrita na OAB/SP', instagram: '', facebook: '', linkedin: 'linkedin.com/company/advocacia-duarte', credito: true }
    }
  },
  academia: {
    cliente: 'Academia Força Total', nome: 'Matrícula de verão', resumo: 'Fitness · escuro e enérgico',
    tema: { cor: '#f97316', modo: 'escuro', fonte: 'forte', cantos: 'reto' },
    pagina: { titulo: 'Academia Força Total — musculação e lutas 24h na Mooca', descricao: 'Academia 24 horas na Mooca com musculação, funcional, muay thai e avaliação física. Matrícula de verão com taxa zero.' },
    secoes: {
      topo: { marca: 'Academia Força Total', selo: 'Matrícula de verão: taxa zero até 30/11', titulo: 'Treine *forte*. Treine perto. Treine 24 horas.', subtitulo: 'Musculação, funcional e lutas com professor no salão o dia inteiro, na Rua da Mooca. Comece com uma aula experimental grátis.', botao: 'Agendar aula grátis', link: '#contato', botao2: 'Ver planos', link2: '#precos', emoji: '🏋️' },
      servicos: { menu: 'Modalidades', titulo: 'Modalidades', subtitulo: 'Mais de 40 aulas por semana, incluídas em todos os planos.', itens: [
        { icone: '🏋️', titulo: 'Musculação', texto: 'Mais de 120 aparelhos, área de peso livre e professor acompanhando o seu treino.' },
        { icone: '🔥', titulo: 'Funcional', texto: 'Aulas de 45 minutos em grupo para queimar calorias e ganhar condicionamento.' },
        { icone: '🥊', titulo: 'Muay thai', texto: 'Turmas para iniciantes e avançados, de manhã e à noite.' },
        { icone: '📋', titulo: 'Avaliação física', texto: 'Bioimpedância e ficha de treino revisada todo mês.' }] },
      sobre: { menu: 'Estrutura', titulo: 'Estrutura para quem leva o treino a sério', texto: 'São 1.800 m² na Mooca, com vestiários completos, estacionamento próprio e ar-condicionado em todas as salas.\n\nDesde 2015, a Força Total já tirou milhares de alunos do sedentarismo — sem julgamento e com acompanhamento de verdade.', itens: [
        { valor: '24h', rotulo: 'aberta todos os dias' }, { valor: '1.800 m²', rotulo: 'de área de treino' }, { valor: '+2.500', rotulo: 'alunos ativos' }] },
      depoimentos: { menu: 'Alunos', titulo: 'Resultado de quem treina aqui', itens: [
        { nome: 'Thiago Ramos', detalhe: 'aluno há 3 anos', texto: 'Perdi 18 kg no primeiro ano. Os professores montam o treino e cobram de verdade.', nota: 5 },
        { nome: 'Aline Costa', detalhe: 'muay thai', texto: 'As aulas de muay thai são o ponto alto do meu dia. Turma animada e professor excelente.', nota: 5 },
        { nome: 'Jorge Nunes', detalhe: 'treina às 5h', texto: 'Ser 24 horas faz toda a diferença para quem trabalha em turno. Sempre limpa e organizada.', nota: 4 }] },
      precos: { menu: 'Planos', titulo: 'Planos *sem fidelidade*', subtitulo: 'Cancele quando quiser. Matrícula grátis até 30 de novembro.', itens: [
        { nome: 'Mensal', preco: 'R$ 129,90', periodo: '/mês', recursos: 'Musculação e funcional\nAcesso 24 horas\nAvaliação física na entrada', botao: 'Começar', destaque: false },
        { nome: 'Trimestral', preco: 'R$ 109,90', periodo: '/mês', recursos: 'Tudo do Mensal\nMuay thai incluído\nAvaliação física todo mês\n1 convidado por mês', botao: 'Começar agora', destaque: true },
        { nome: 'Anual', preco: 'R$ 89,90', periodo: '/mês', recursos: 'Tudo do Trimestral\nCamiseta oficial\nCongelamento de até 60 dias', botao: 'Começar', destaque: false }] },
      faq: { menu: 'Dúvidas', titulo: 'Perguntas frequentes', itens: [
        { pergunta: 'Posso fazer uma aula experimental?', resposta: 'Pode, sim. Agende pelo formulário ou pelo WhatsApp e venha com roupa de treino.' },
        { pergunta: 'Preciso de atestado médico?', resposta: 'Pedimos o questionário PAR-Q na matrícula. Acima de 60 anos ou com alguma restrição, solicitamos atestado.' },
        { pergunta: 'Como funciona o acesso 24 horas?', resposta: 'Pela biometria na catraca. Das 23h às 5h, um segurança fica no salão.' }] },
      contato: { menu: 'Contato', titulo: 'Agende sua aula grátis', subtitulo: 'Deixe seu contato e um professor chama você para marcar o melhor horário.', telefone: '(11) 2694-3301', whatsapp: '5511965432109', email: 'matriculas@forcatotal.com.br', endereco: 'Rua da Mooca, 2.330 — Mooca, São Paulo/SP', horario: 'Aberta 24 horas, todos os dias', botao: 'Quero minha aula grátis', flutuante: true },
      rodape: { texto: '© 2026 Academia Força Total · Responsável técnico: CREF 012345-G/SP', instagram: '@forcatotalmooca', facebook: '', linkedin: '', credito: true }
    }
  }
};

/* ---------- cores: contraste calculado para o texto sempre ficar legível ---------- */
const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
const misturar = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const lum = c => { const f = v => (v /= 255) <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
const contraste = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const corValida = c => /^#[0-9a-f]{6}$/i.test(c || '');
// texto na cor da marca: escurece (fundo claro) ou clareia (fundo escuro) até passar de 4,5:1
function legivel(c, fundo) {
  const alvo = lum(fundo) > .4 ? [0, 0, 0] : [255, 255, 255];
  for (let i = 0; i < 24 && contraste(c, fundo) < 4.5; i++) c = misturar(c, alvo, .1);
  return hex(c);
}
// botão: texto branco se der; cor clara ganha texto escuro; senão escurece o fundo do botão
function corBotao(c) {
  const branco = [255, 255, 255], preto = [17, 19, 24];
  if (contraste(c, branco) >= 4.5) return { fundo: hex(c), txt: '#ffffff' };
  if (lum(c) > .25 && contraste(c, preto) >= 4.5) return { fundo: hex(c), txt: '#111318' };
  let x = c;
  for (let i = 0; i < 20 && contraste(x, branco) < 4.5; i++) x = misturar(x, [0, 0, 0], .07);
  return { fundo: hex(x), txt: '#ffffff' };
}
function paleta(t) {
  const escuro = t.modo === 'escuro', cor = corValida(t.cor) ? t.cor.toLowerCase() : '#00b3ff', c = rgb(cor);
  const fundo = escuro ? '#0f1217' : '#ffffff';
  const fundo2 = hex(misturar(rgb(fundo), c, escuro ? .07 : .06));
  const cartao = escuro ? '#171b23' : '#ffffff';
  const b = corBotao(c);
  return {
    escuro, cor, fundo, fundo2, cartao, btn: b.fundo, btnTxt: b.txt, contrasteBtn: contraste(rgb(b.fundo), rgb(b.txt)),
    // a cor de destaque é medida contra a superfície mais difícil (fundo alternado ou cartão)
    dest: legivel(c, rgb(escuro ? '#1d222c' : fundo2)),
    txt: escuro ? '#eef1f6' : '#1a1d24', dim: escuro ? '#a9b1bf' : '#535c6b',
    linha: escuro ? 'rgba(255,255,255,.11)' : 'rgba(20,24,33,.11)'
  };
}

/* ---------- gerador da página (prévia e exportação usam o mesmo) ---------- */
// *palavra* vira destaque na cor da marca
const fmt = s => esc(s).replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
const paragrafos = s => String(s || '').split(/\n\s*\n/).map(x => x.trim()).filter(Boolean)
  .map(x => '<p>' + esc(x).replace(/\n/g, '<br>') + '</p>').join('');
const digitos = s => String(s || '').replace(/\D/g, '');
// só deixa passar âncora, http(s), mailto e tel — nada de javascript: na página do cliente
function href(l) {
  l = String(l || '').trim();
  if (!l) return '#contato';
  if (/^(#|https?:\/\/|mailto:|tel:)/i.test(l)) return l;
  if (/^[\w-]+(\.[\w-]+)+(\/|$)/.test(l)) return 'https://' + l;
  return '#' + l.replace(/[^\w-]/g, '');
}
function fmtZap(n) {
  const m = n.replace(/^55/, '');
  return m.length === 11 ? `(${m.slice(0, 2)}) ${m.slice(2, 7)}-${m.slice(7)}` : m.length === 10 ? `(${m.slice(0, 2)}) ${m.slice(2, 6)}-${m.slice(6)}` : n;
}
const iniciais = s => String(s || '?').trim().split(/\s+/).slice(0, 2).map(x => x.charAt(0)).join('').toUpperCase();
const cab = d => `<div class="cab"><h2>${fmt(d.titulo)}</h2>${d.subtitulo ? `<p>${esc(d.subtitulo)}</p>` : ''}</div>`;
const ICONE_ZAP = '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3 1 2.5c.1.2 1.6 2.5 4 3.5 1.5.6 2.1.7 2.8.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z"/></svg>';

const R = {
  topo(d, a, alt, ctx) {
    const links = ctx.ativas.filter(s => s.dados.menu && !TIPOS[s.tipo].fixo)
      .map(s => `<a href="#${s.tipo}">${esc(s.dados.menu)}</a>`).join('');
    const menu = links ? `<nav class="links" id="menu" aria-label="Menu principal">${links}</nav>` : '';
    return `<header class="nav"${a}><div class="cx">
<a class="marca" href="#topo"><i aria-hidden="true">${esc(iniciais(d.marca).charAt(0))}</i>${esc(d.marca)}</a>
${menu}${d.botao ? `<a class="btn peq" href="${esc(href(d.link))}">${esc(d.botao)}</a>` : ''}${links ? '<button class="menu-btn" type="button" aria-label="Abrir menu" aria-expanded="false" aria-controls="menu">☰</button>' : ''}
</div></header>
<section class="hero${d.emoji ? '' : ' so-texto'}" id="topo"${a}><div class="cx">
<div>${d.selo ? `<span class="selo">${esc(d.selo)}</span>` : ''}<h1>${fmt(d.titulo)}</h1>${d.subtitulo ? `<p class="sub">${esc(d.subtitulo)}</p>` : ''}
<div class="acoes">${d.botao ? `<a class="btn" href="${esc(href(d.link))}">${esc(d.botao)}</a>` : ''}${d.botao2 ? `<a class="btn sec" href="${esc(href(d.link2))}">${esc(d.botao2)}</a>` : ''}</div></div>
${d.emoji ? `<div class="arte" aria-hidden="true"><span>${esc(d.emoji)}</span></div>` : ''}
</div></section>`;
  },
  servicos(d, a, alt) {
    return `<section id="servicos" class="${alt}"${a}><div class="cx">${cab(d)}<div class="grade">
${(d.itens || []).map(i => `<article class="cartao"><div class="ico" aria-hidden="true">${esc(i.icone)}</div><h3>${esc(i.titulo)}</h3><p>${esc(i.texto)}</p></article>`).join('\n')}
</div></div></section>`;
  },
  sobre(d, a, alt) {
    const n = d.itens || [];
    return `<section id="sobre" class="sobre ${alt}${n.length ? '' : ' so-texto'}"${a}><div class="cx">
<div><h2>${fmt(d.titulo)}</h2>${paragrafos(d.texto)}</div>
${n.length ? `<div class="numeros">${n.map(i => `<div class="numero"><b>${esc(i.valor)}</b><span>${esc(i.rotulo)}</span></div>`).join('')}</div>` : ''}
</div></section>`;
  },
  depoimentos(d, a, alt) {
    return `<section id="depoimentos" class="${alt}"${a}><div class="cx">${cab(d)}<div class="grade">
${(d.itens || []).map(i => { const n = Math.max(1, Math.min(5, +i.nota || 5)); return `<figure class="cartao dep">
<div class="estrelas" role="img" aria-label="Nota ${n} de 5">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</div>
<blockquote>“${esc(i.texto)}”</blockquote>
<figcaption class="quem"><i aria-hidden="true">${esc(iniciais(i.nome))}</i><span><b>${esc(i.nome)}</b>${i.detalhe ? `<small>${esc(i.detalhe)}</small>` : ''}</span></figcaption></figure>`; }).join('\n')}
</div></div></section>`;
  },
  precos(d, a, alt) {
    return `<section id="precos" class="${alt}"${a}><div class="cx">${cab(d)}<div class="grade planos">
${(d.itens || []).map(i => `<article class="cartao plano${i.destaque ? ' top' : ''}">${i.destaque ? '<span class="tag">Mais escolhido</span>' : ''}
<h3>${esc(i.nome)}</h3><div class="preco">${esc(i.preco)} ${i.periodo ? `<small>${esc(i.periodo)}</small>` : ''}</div>
<ul>${String(i.recursos || '').split('\n').map(x => x.trim()).filter(Boolean).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
${i.botao ? `<a class="btn${i.destaque ? '' : ' sec'}" href="#contato">${esc(i.botao)}</a>` : ''}</article>`).join('\n')}
</div></div></section>`;
  },
  faq(d, a, alt, ctx, s) {
    // na prévia, com a seção aberta no editor, as respostas ficam visíveis enquanto você digita
    const abrir = ctx.previa && ctx.sel === s.id ? ' open' : '';
    return `<section id="faq" class="faq ${alt}"${a}><div class="cx">${cab(d)}
${(d.itens || []).map(i => `<details${abrir}><summary>${esc(i.pergunta)}</summary>${paragrafos(i.resposta)}</details>`).join('\n')}
</div></section>`;
  },
  contato(d, a, alt) {
    const z = digitos(d.whatsapp), tel = digitos(d.telefone);
    const info = (ico, rot, html) => `<li><span class="i" aria-hidden="true">${ico}</span><div><small>${rot}</small>${html}</div></li>`;
    const infos = [
      d.telefone && info('📞', 'Telefone', `<a href="tel:+${tel.length > 11 && tel.startsWith('55') ? tel : '55' + tel}">${esc(d.telefone)}</a>`),
      z && info('💬', 'WhatsApp', `<a href="https://wa.me/${z}" target="_blank" rel="noopener">${esc(fmtZap(z))}</a>`),
      d.email && info('✉️', 'E-mail', `<a href="mailto:${esc(d.email)}">${esc(d.email)}</a>`),
      d.endereco && info('📍', 'Endereço', `<span>${esc(d.endereco)}</span>`),
      d.horario && info('🕘', 'Horário', `<span>${esc(d.horario)}</span>`)
    ].filter(Boolean).join('');
    return `<section id="contato" class="contato ${alt}"${a}><div class="cx">
<div><h2>${fmt(d.titulo)}</h2>${d.subtitulo ? `<p class="sub">${esc(d.subtitulo)}</p>` : ''}<ul class="infos">${infos}</ul></div>
<form class="cartao" data-contato data-whats="${z}" data-email="${esc(d.email || '')}">
<label>Seu nome<input name="nome" required autocomplete="name"></label>
<label>E-mail ou telefone<input name="contato" required autocomplete="email"></label>
<label>Mensagem<textarea name="mensagem" rows="4" required></textarea></label>
<button class="btn" type="submit">${esc(d.botao || 'Enviar')}</button>
<p class="ok" role="status" hidden>Obrigado! Sua mensagem foi preparada${z ? ' no WhatsApp — é só tocar em enviar' : ''}.</p>
</form></div></section>`;
  },
  rodape(d, a, alt, ctx) {
    const arroba = String(d.instagram || '').replace(/^@/, '').trim();
    const redes = [
      arroba && `<a href="https://www.instagram.com/${esc(encodeURIComponent(arroba))}/" target="_blank" rel="noopener">Instagram</a>`,
      d.facebook && `<a href="${esc(href(d.facebook))}" target="_blank" rel="noopener">Facebook</a>`,
      d.linkedin && `<a href="${esc(href(d.linkedin))}" target="_blank" rel="noopener">LinkedIn</a>`,
      d.credito && '<a href="https://nassatech.com.br/" target="_blank" rel="noopener">Site feito pela Nassa Tech</a>'
    ].filter(Boolean).join('');
    return `<footer${a}><div class="cx"><div><b class="marca-rod">${esc(ctx.marca)}</b>${d.texto ? `<p>${esc(d.texto)}</p>` : ''}</div>
${redes ? `<nav aria-label="Redes e créditos">${redes}</nav>` : ''}</div></footer>`;
  }
};

function estilo(t, c, previa) {
  const f = FONTES[t.fonte] || FONTES.moderna, reto = t.cantos === 'reto';
  return `
:root{--cor:${c.cor};--dest:${c.dest};--btn:${c.btn};--btn-txt:${c.btnTxt};--fundo:${c.fundo};--fundo-2:${c.fundo2};--cartao:${c.cartao};
  --txt:${c.txt};--dim:${c.dim};--linha:${c.linha};--raio:${reto ? '4px' : '16px'};--raio-btn:${reto ? '4px' : '999px'};
  --corpo:${f.corpo};--tit:${f.tit};color-scheme:${c.escuro ? 'dark' : 'light'}}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--fundo);color:var(--txt);font:17px/1.65 var(--corpo);-webkit-font-smoothing:antialiased}
a{color:var(--dest)}
h1,h2,h3{font-family:var(--tit);line-height:1.15;margin:0;${f.caixa ? 'text-transform:uppercase;letter-spacing:.01em;font-weight:400' : 'font-weight:800'}}
h1 em,h2 em{font-style:normal;color:var(--dest)}
.cx{width:min(1120px,100% - 40px);margin-inline:auto}
section{padding:84px 0;scroll-margin-top:68px}
section.alt{background:var(--fundo-2)}
.cab{max-width:680px;margin:0 auto 44px;text-align:center}
h2{font-size:clamp(28px,3.6vw,42px)}
.cab p,.sub{color:var(--dim);font-size:18px;margin:12px 0 0}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:14px 26px;border-radius:var(--raio-btn);
  background:var(--btn);color:var(--btn-txt);font:700 16px/1.2 var(--corpo);text-decoration:none;border:2px solid var(--btn);
  cursor:pointer;transition:transform .15s,filter .15s;text-align:center}
.btn:hover{filter:brightness(1.08);transform:translateY(-1px)}
.btn.sec{background:transparent;color:var(--txt);border-color:color-mix(in srgb,var(--txt) 28%,transparent)}
.btn.peq{padding:10px 18px;font-size:15px}
a:focus-visible,button:focus-visible,input:focus-visible,textarea:focus-visible,summary:focus-visible{outline:3px solid var(--dest);outline-offset:3px}
.nav{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--fundo) 96%,transparent);border-bottom:1px solid var(--linha)}
.nav .cx{display:flex;align-items:center;gap:24px;height:68px;position:relative}
.marca{display:flex;align-items:center;gap:10px;font-family:var(--tit);font-weight:800;font-size:20px;color:var(--txt);text-decoration:none;white-space:nowrap;min-width:0}
.marca i{width:34px;height:34px;border-radius:${reto ? '4px' : '10px'};display:grid;place-items:center;background:var(--btn);color:var(--btn-txt);font-style:normal;font-size:17px;flex:0 0 auto}
.links{display:flex;gap:26px;margin-left:auto}
.links a{color:var(--dim);text-decoration:none;font-weight:600;font-size:15px}
.links a:hover{color:var(--txt)}
.links+.btn,.marca+.btn{margin-left:auto}
.links+.btn{margin-left:0}
.menu-btn{display:none;margin-left:auto;background:none;border:1px solid var(--linha);color:var(--txt);border-radius:10px;width:44px;height:44px;font-size:20px;cursor:pointer}
.hero{padding:88px 0 96px;background:radial-gradient(900px 480px at 85% 0%,color-mix(in srgb,var(--cor) 20%,transparent),transparent 70%),var(--fundo)}
.hero .cx{display:grid;grid-template-columns:1.25fr .75fr;gap:56px;align-items:center}
.hero.so-texto .cx{grid-template-columns:1fr;max-width:820px}
.selo{display:inline-block;padding:7px 14px;border-radius:999px;background:color-mix(in srgb,var(--cor) 15%,transparent);color:var(--dest);font-weight:700;font-size:14px;margin-bottom:18px}
.hero h1{font-size:clamp(36px,5.2vw,62px);letter-spacing:-.015em}
.hero .sub{font-size:clamp(17px,1.7vw,20px);margin:20px 0 32px;max-width:580px}
.acoes{display:flex;gap:12px;flex-wrap:wrap}
.arte{aspect-ratio:1;border-radius:${reto ? '6px' : '36px'};display:grid;place-items:center;font-size:clamp(84px,12vw,160px);position:relative;overflow:hidden;
  background:linear-gradient(140deg,var(--cor),color-mix(in srgb,var(--cor) 45%,#000));box-shadow:0 30px 60px -24px color-mix(in srgb,var(--cor) 60%,transparent)}
.arte::after{content:'';position:absolute;right:-22%;bottom:-38%;width:80%;height:80%;border-radius:50%;background:rgba(255,255,255,.13)}
.arte span{position:relative;z-index:1;filter:drop-shadow(0 12px 18px rgba(0,0,0,.25))}
.grade{display:grid;gap:20px;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr))}
.cartao{background:var(--cartao);border:1px solid var(--linha);border-radius:var(--raio);padding:28px}
.cartao h3{font-size:20px;margin:16px 0 8px}
.cartao p{margin:0;color:var(--dim)}
.ico{width:54px;height:54px;border-radius:${reto ? '4px' : '14px'};display:grid;place-items:center;font-size:27px;background:color-mix(in srgb,var(--cor) 15%,transparent)}
.sobre .cx{display:grid;grid-template-columns:1.1fr .9fr;gap:56px;align-items:center}
.sobre.so-texto .cx{grid-template-columns:1fr;max-width:820px}
.sobre p{color:var(--dim);margin:16px 0 0}
.numeros{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px}
.numero{background:var(--cartao);border:1px solid var(--linha);border-radius:var(--raio);padding:24px}
.numero b{display:block;font-family:var(--tit);font-weight:800;font-size:clamp(28px,3vw,38px);line-height:1.1;color:var(--dest)}
.numero span{color:var(--dim);font-size:15px}
figure{margin:0}
.dep{display:flex;flex-direction:column;gap:16px}
.estrelas{color:#f5a524;letter-spacing:3px;font-size:18px}
.dep blockquote{margin:0;font-size:17px}
.quem{display:flex;align-items:center;gap:12px;margin-top:auto}
.quem i{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-weight:700;flex:0 0 auto;background:color-mix(in srgb,var(--cor) 18%,transparent);color:var(--dest)}
.quem b{display:block;font-size:16px}
.quem small{color:var(--dim);font-size:14px}
.plano{display:flex;flex-direction:column;position:relative}
.plano h3{margin:0 0 6px}
.plano.top{border:2px solid var(--cor);box-shadow:0 24px 48px -26px color-mix(in srgb,var(--cor) 70%,transparent)}
.tag{position:absolute;top:-14px;left:24px;background:var(--btn);color:var(--btn-txt);font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:4px 12px;border-radius:999px}
.preco{font-family:var(--tit);font-weight:800;font-size:36px;line-height:1.15}
.preco small{font:500 15px var(--corpo);color:var(--dim)}
.plano ul{list-style:none;padding:0;margin:16px 0 24px;display:grid;gap:8px;flex:1;align-content:start}
.plano li{padding-left:26px;position:relative;color:var(--dim)}
.plano li::before{content:'✓';position:absolute;left:0;color:var(--dest);font-weight:800}
.faq .cx{max-width:820px}
details{border:1px solid var(--linha);border-radius:var(--raio);background:var(--cartao);margin-bottom:12px}
summary{cursor:pointer;list-style:none;padding:20px 58px 20px 22px;font-weight:700;font-size:17px;position:relative}
summary::-webkit-details-marker{display:none}
summary::after{content:'+';position:absolute;right:22px;top:50%;transform:translateY(-50%);font-size:26px;font-weight:400;color:var(--dest);transition:transform .2s}
details[open] summary::after{transform:translateY(-50%) rotate(45deg)}
details p{margin:0;padding:0 22px 20px;color:var(--dim)}
.contato .cx{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:start}
.infos{list-style:none;padding:0;margin:28px 0 0;display:grid;gap:16px}
.infos li{display:flex;gap:14px;align-items:flex-start}
.infos .i{width:42px;height:42px;border-radius:${reto ? '4px' : '12px'};display:grid;place-items:center;flex:0 0 auto;background:color-mix(in srgb,var(--cor) 15%,transparent)}
.infos small{display:block;color:var(--dim);font-size:13px;text-transform:uppercase;letter-spacing:.06em}
.infos a,.infos span{color:var(--txt);text-decoration:none;font-weight:600}
form{display:grid;gap:16px}
label{display:grid;gap:6px;font-weight:600;font-size:15px}
input,textarea{font:inherit;font-size:16px;color:var(--txt);background:var(--fundo);border:1px solid color-mix(in srgb,var(--txt) 24%,transparent);border-radius:${reto ? '4px' : '10px'};padding:12px 14px;width:100%}
textarea{resize:vertical;min-height:110px}
.ok{margin:0;padding:12px 14px;border-radius:10px;background:color-mix(in srgb,#16a34a 16%,transparent);color:var(--txt);font-weight:600}
.ok[hidden]{display:none}
footer{padding:44px 0;border-top:1px solid var(--linha);color:var(--dim);font-size:15px}
footer .cx{display:flex;gap:18px 32px;flex-wrap:wrap;align-items:center;justify-content:space-between}
footer p{margin:6px 0 0}
.marca-rod{font-family:var(--tit);font-size:18px;color:var(--txt)}
footer nav{display:flex;gap:10px 20px;flex-wrap:wrap}
footer a{color:var(--dim)}
footer a:hover{color:var(--txt)}
.zap{position:fixed;right:20px;bottom:20px;width:60px;height:60px;border-radius:50%;background:#25d366;color:#fff;display:grid;place-items:center;box-shadow:0 10px 26px rgba(0,0,0,.3);z-index:30}
@media (max-width:980px){
  .links{display:none;position:absolute;top:68px;left:-20px;right:-20px;flex-direction:column;gap:0;padding:6px 20px 14px;background:var(--fundo);border-bottom:1px solid var(--linha);box-shadow:0 16px 30px rgba(0,0,0,.15)}
  .links.aberto{display:flex}
  .links a{padding:12px 0;border-bottom:1px solid var(--linha);font-size:16px}
  .menu-btn{display:grid;place-items:center}
  .links+.btn{margin-left:auto}
  .links+.btn+.menu-btn{margin-left:0}
}
@media (max-width:880px){
  .hero .cx,.sobre .cx,.contato .cx{grid-template-columns:1fr;gap:36px}
  .arte{width:min(260px,70%);margin:0 auto}
}
@media (max-width:760px){
  body{font-size:16px}
  .nav .btn{display:none}
  .menu-btn{margin-left:auto!important}
  section{padding:60px 0}
  .hero{padding:48px 0 64px}
  .cab{margin-bottom:32px}
  .cartao{padding:22px}
  .acoes .btn{flex:1 1 100%}
}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}.btn{transition:none}}
${previa ? `[data-sec]{cursor:pointer}
section[data-sec],footer[data-sec]{position:relative}
[data-sec]:hover{outline:2px dashed color-mix(in srgb,var(--cor) 75%,transparent);outline-offset:-3px}
section[data-sec]:hover::before,footer[data-sec]:hover::before{content:'✏️ ' attr(data-rot);position:absolute;top:8px;left:8px;z-index:5;font:600 12px/1 system-ui,sans-serif;padding:6px 9px;border-radius:6px;background:#0b0f19;color:#fff;pointer-events:none}
.nt-realce{animation:ntRealce 1.6s ease}
@keyframes ntRealce{0%,55%{box-shadow:inset 0 0 0 4px var(--cor)}100%{box-shadow:inset 0 0 0 0 transparent}}
.nt-toast{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:#0b0f19;color:#fff;padding:10px 16px;border-radius:10px;font:14px/1.4 system-ui,sans-serif;z-index:99;width:max-content;max-width:calc(100% - 32px);box-shadow:0 10px 30px rgba(0,0,0,.35)}
.nt-toast[hidden]{display:none}` : ''}
`;
}

// comportamento da página: menu no celular e formulário que vira mensagem de WhatsApp/e-mail.
// Na prévia (P=1) nada navega: links mostram um aviso e clicar numa seção abre ela no editor.
function roteiro(previa) {
  return `(function(){var P=${previa ? 1 : 0};
function aviso(m){var t=document.querySelector('.nt-toast');if(!t){t=document.createElement('div');t.className='nt-toast';t.setAttribute('role','status');document.body.appendChild(t)}t.textContent=m;t.hidden=false;clearTimeout(t.tm);t.tm=setTimeout(function(){t.hidden=true},3200)}
document.addEventListener('click',function(e){
var m=document.getElementById('menu'),b=e.target.closest('.menu-btn');
if(b&&m){var ab=m.classList.toggle('aberto');b.setAttribute('aria-expanded',ab);return}
var a=e.target.closest('a[href]');
if(a){if(m)m.classList.remove('aberto');if(!P)return;e.preventDefault();var h=a.getAttribute('href');
if(h.charAt(0)==='#'){var alvo=h.length>1&&document.getElementById(h.slice(1));if(alvo)alvo.scrollIntoView({behavior:'smooth'});else aviso('A seção '+h+' está desligada nesta página.');return}
aviso('Na página publicada, este link abre: '+h);return}
if(P){var s=e.target.closest('[data-sec]');if(s&&!e.target.closest('input,textarea,button,summary,label'))parent.postMessage({ntLp:'secao',id:s.getAttribute('data-sec')},'*')}
});
document.addEventListener('submit',function(e){var f=e.target;if(!f.matches('form[data-contato]'))return;e.preventDefault();
var d=new FormData(f),txt='Olá! Meu nome é '+d.get('nome')+'.\\n'+d.get('mensagem')+'\\nContato: '+d.get('contato'),w=f.getAttribute('data-whats'),em=f.getAttribute('data-email'),url='';
if(w)url='https://wa.me/'+w+'?text='+encodeURIComponent(txt);else if(em)url='mailto:'+em+'?subject='+encodeURIComponent('Contato pelo site')+'&body='+encodeURIComponent(txt);
if(P)aviso('Prévia: no site publicado, a mensagem vai para '+(w?'o WhatsApp':em?'o e-mail '+em:'o atendimento')+'.');else if(url)window.open(url,'_blank');
f.reset();var ok=f.querySelector('.ok');if(ok)ok.hidden=false});
})();`;
}

function montar(p, previa, sel) {
  const c = paleta(p.tema), ativas = p.secoes.filter(s => s.ativo);
  const topo = p.secoes.find(s => s.tipo === 'topo');
  const ctx = { ativas, previa, sel, marca: (topo && topo.dados.marca) || p.cliente };
  let n = 0;
  const corpo = ativas.map(s => {
    // seções do meio alternam o fundo para a página ter ritmo
    const alt = !TIPOS[s.tipo].fixo && n++ % 2 === 1 ? 'alt' : '';
    const a = previa ? ` data-sec="${esc(s.id)}" data-rot="${esc(TIPOS[s.tipo].nome)}"` : '';
    return R[s.tipo](s.dados || {}, a, alt, ctx, s);
  }).join('\n');
  const ct = ativas.find(s => s.tipo === 'contato');
  const z = ct && ct.dados.flutuante && digitos(ct.dados.whatsapp);
  const zap = z ? `\n<a class="zap" href="https://wa.me/${z}" target="_blank" rel="noopener" aria-label="Conversar no WhatsApp">${ICONE_ZAP}</a>` : '';
  return { css: estilo(p.tema, c, previa), corpo: corpo + zap, titulo: (p.pagina && p.pagina.titulo) || ctx.marca, descricao: (p.pagina && p.pagina.descricao) || '', cor: c.cor, fundo: c.fundo };
}

function documento(p, previa, sel) {
  const m = montar(p, previa, sel);
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(m.titulo)}</title>
<meta name="description" content="${esc(m.descricao)}">
<meta name="theme-color" content="${m.cor}">
${previa ? '' : `<!-- Feita no Estúdio de Landing Pages da Nassa Tech em ${NT.data(new Date())} · https://nassatech.com.br/ -->\n`}<style id="lp-css">${m.css}</style>
<script>${roteiro(previa)}<\/script>
</head>
<body>
${m.corpo}
</body>
</html>
`;
}

/* ---------- estado salvo ---------- */
let projetos = D.ler('projetos', null);
let ui = {};

function criar(chave, extra = {}) {
  const M = MODELOS[chave] || MODELOS.padaria, agora = Date.now();
  let p = {
    id: NT.id(), cliente: M.cliente, nome: M.nome, modelo: chave, tema: clonar(M.tema), pagina: clonar(M.pagina),
    secoes: ORDEM.map(tipo => ({ id: NT.id(), tipo, ativo: !(M.ocultas || []).includes(tipo), dados: clonar(M.secoes[tipo] || {}) })),
    criado: agora, atualizado: agora
  };
  // modelo usado para outro cliente: o nome do cliente do modelo vira o do novo
  if (extra.cliente && extra.cliente !== M.cliente) p = trocarNome(p, M.cliente, extra.cliente);
  return Object.assign(p, extra);
}
const trocarNome = (p, de, para) => JSON.parse(JSON.stringify(p), (k, v) => typeof v === 'string' ? v.split(de).join(para) : v);

function semear() {
  const natal = criar('padaria', { nome: 'Campanha de Natal' });
  Object.assign(natal.tema, { cor: '#b91c1c' });
  Object.assign(natal.pagina, { titulo: 'Natal na Pão de Mel — panetones artesanais e cestas', descricao: 'Panetones de fermentação natural, chocotones trufados e cestas de Natal com entrega na Vila Mariana. Encomendas até 20 de dezembro.' });
  const muda = {
    topo: { selo: 'Encomendas até 20/12', titulo: 'Panetone artesanal com *48 horas* de fermentação', subtitulo: 'Feitos um a um no nosso forno, com frutas cristalizadas de verdade ou gotas de chocolate belga. Garanta o seu antes que esgote.', botao: 'Encomendar pelo WhatsApp', botao2: 'Ver opções', emoji: '🎄' },
    servicos: { menu: 'Para a ceia', titulo: 'Para a sua ceia', subtitulo: 'Retire na loja ou receba em casa.', itens: [
      { icone: '🍞', titulo: 'Panetone tradicional', texto: '750 g de massa de fermentação natural, frutas cristalizadas e uvas-passas.' },
      { icone: '🍫', titulo: 'Chocotone trufado', texto: 'Gotas de chocolate belga e recheio de trufa ao leite.' },
      { icone: '🥧', titulo: 'Tortas e rabanadas', texto: 'Rabanada assada, torta de nozes e pavê sob encomenda para a ceia.' }] },
    precos: { menu: 'Encomendas', titulo: 'Encomendas de Natal', subtitulo: 'Pagamento via Pix ou cartão na encomenda. Retirada a partir de 18/12.', itens: [
      { nome: 'Panetone tradicional', preco: 'R$ 79,90', periodo: '750 g', recursos: 'Fermentação natural\nEmbalagem para presente\nValidade de 30 dias', botao: 'Encomendar', destaque: false },
      { nome: 'Cesta de Natal', preco: 'R$ 289,90', periodo: 'para a família', recursos: 'Panetone e chocotone\nVinho tinto suave\nCastanhas e frutas secas\nCartão personalizado', botao: 'Encomendar', destaque: true },
      { nome: 'Chocotone trufado', preco: 'R$ 89,90', periodo: '750 g', recursos: 'Chocolate belga\nRecheio de trufa\nEmbalagem para presente', botao: 'Encomendar', destaque: false }] }
  };
  natal.secoes.forEach(s => {
    if (muda[s.tipo]) Object.assign(s.dados, muda[s.tipo]);
    if (s.tipo === 'sobre' || s.tipo === 'depoimentos') s.ativo = false;
  });
  // datas espaçadas para a lista de projetos parecer um histórico de verdade
  const lista = [criar('padaria'), natal, criar('clinica'), criar('advocacia'), criar('academia')];
  const dias = [12, 1, 6, 20, 3];
  lista.forEach((p, i) => { p.criado = Date.now() - (dias[i] + 9) * 864e5; p.atualizado = Date.now() - dias[i] * 864e5 - i * 37e5; });
  projetos = lista;
  D.gravar('projetos', projetos);
}

function carregar() {
  if (!Array.isArray(projetos) || !projetos.length) semear();
  ui = Object.assign({ aba: 'secoes', disp: 'desktop', vista: 'editar' }, D.ler('ui', {}));
  if (!projetos.some(p => p.id === ui.atual)) { ui.atual = projetos[0].id; ui.secao = null; }
}
const atual = () => projetos.find(p => p.id === ui.atual) || projetos[0];
const secaoSel = () => { const p = atual(); return p.secoes.find(s => s.id === ui.secao) || p.secoes[0]; };
const salvarUi = () => D.gravar('ui', ui);
function salvar() {
  atual().atualizado = Date.now();
  D.gravar('projetos', projetos);
  mostrarSalvo();
}
function mostrarSalvo() {
  const p = atual(), d = new Date(p.atualizado);
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  $('#salvo').textContent = '✓ Salvo neste navegador · ' + (NT.data(d) === NT.data(new Date()) ? 'hoje' : NT.data(d)) + ' às ' + hora;
}

/* ---------- prévia ---------- */
const frame = $('#frame'), palco = $('#palco'), moldura = $('#moldura'), estudio = $('#estudio');
let pronta = false, tPrevia = 0;

function atualizarPrevia(doTopo) {
  clearTimeout(tPrevia);
  const p = atual(), sel = ui.secao;
  const doc = pronta && frame.contentDocument;
  const css = doc && doc.getElementById('lp-css');
  moldura.style.background = paleta(p.tema).fundo;
  $('#previaNome').textContent = p.cliente + ' · ' + p.nome;
  // com a prévia já aberta, troca só o estilo e o corpo: sem piscar e sem perder a rolagem
  if (css) {
    const m = montar(p, true, sel);
    css.textContent = m.css;
    doc.body.innerHTML = m.corpo;
    doc.title = m.titulo;
    if (doTopo) doc.documentElement.scrollTop = 0;
    return;
  }
  pronta = false;
  frame.srcdoc = documento(p, true, sel);
}
const previaDepois = () => { clearTimeout(tPrevia); tPrevia = setTimeout(atualizarPrevia, 140); };
frame.addEventListener('load', () => { pronta = true; });

function rolarPrevia(id) {
  const doc = pronta && frame.contentDocument;
  const el = doc && doc.querySelector('[data-sec="' + id + '"]');
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el.classList.remove('nt-realce'); void el.offsetWidth; el.classList.add('nt-realce');
}

// a moldura simula a largura do aparelho e encolhe (scale) quando não cabe no palco
function ajustarFrame() {
  const W = LARGURAS[ui.disp] || 1280, pad = ui.disp === 'desktop' ? 28 : 36;
  moldura.className = 'moldura ' + ui.disp;
  const cw = palco.clientWidth - pad, ch = palco.clientHeight - pad;
  if (cw <= 0 || ch <= 0) return;
  const s = Math.min(1, cw / W);
  frame.style.width = W + 'px';
  frame.style.height = Math.round(ch / s) + 'px';
  frame.style.transform = s < 1 ? `scale(${s})` : '';
  // o iframe escalado escapa do overflow:hidden arredondado no Chrome: ele mesmo arredonda os cantos
  frame.style.borderRadius = ({ desktop: 8, tablet: 14, celular: 22 })[ui.disp] / s + 'px';
  moldura.style.width = Math.floor(W * s) + 'px';
  moldura.style.height = ch + 'px';
  $('#tam').textContent = W + ' px' + (s < 1 ? ' · ' + Math.round(s * 100) + '%' : '');
}
function medir() {
  const larga = innerWidth > 900;
  const topo = estudio.getBoundingClientRect().top + scrollY;
  const alto = Math.max(larga ? 520 : 420, innerHeight - topo - (larga ? 16 : 96));
  estudio.style.setProperty('--alto', alto + 'px');
  ajustarFrame();
}
function trocarDisp(d) {
  ui.disp = LARGURAS[d] ? d : 'desktop'; salvarUi();
  document.querySelectorAll('[data-disp]').forEach(b => b.setAttribute('aria-pressed', b.dataset.disp === ui.disp));
  ajustarFrame();
}
function trocarVista(v) {
  ui.vista = v === 'visualizar' ? 'visualizar' : 'editar'; salvarUi();
  estudio.dataset.vista = ui.vista;
  document.querySelectorAll('[data-vista]').forEach(b => b.setAttribute('aria-pressed', b.dataset.vista === ui.vista));
  medir();
}

/* ---------- lista de seções ---------- */
const listaSec = $('#listaSec'), formSec = $('#formSec');

function renderSecoes() {
  const p = atual(), sel = secaoSel(), ult = p.secoes.length - 1;
  $('#contaSec').textContent = `${p.secoes.filter(s => s.ativo).length} de ${p.secoes.length} na página`;
  listaSec.innerHTML = p.secoes.map((s, i) => {
    const T = TIPOS[s.tipo], nome = esc(T.nome);
    const podeSubir = !T.fixo && i > 1, podeDescer = !T.fixo && i < ult - 1;
    return `<li class="sec-linha${s.id === sel.id ? ' sel' : ''}${s.ativo ? '' : ' off'}${T.fixo ? ' fixa' : ''}" data-id="${s.id}" draggable="${T.fixo ? 'false' : 'true'}">
<span class="alca" aria-hidden="true" title="${T.fixo ? 'Posição fixa' : 'Arraste para reordenar'}">${T.fixo ? '📌' : '⠿'}</span>
<label class="chave" title="Mostrar na página"><input type="checkbox" data-acao="ligar" ${s.ativo ? 'checked' : ''} aria-label="Mostrar ${nome} na página"><span></span></label>
<button type="button" class="sec-nome" data-acao="selecionar" aria-current="${s.id === sel.id}">${T.ico} ${nome}${s.ativo ? '' : '<small>oculta</small>'}</button>
<button type="button" class="btn mini ghost" data-acao="subir" aria-label="Subir ${nome}" ${podeSubir ? '' : 'disabled'}>↑</button>
<button type="button" class="btn mini ghost" data-acao="descer" aria-label="Descer ${nome}" ${podeDescer ? '' : 'disabled'}>↓</button>
</li>`;
  }).join('');
}

function selecionar(id, rolar) {
  ui.secao = id; salvarUi();
  renderSecoes(); renderForm();
  atualizarPrevia();
  if (rolar) setTimeout(() => rolarPrevia(id), 60);
}

// move dentro do miolo: topo fica em 0 e rodapé no fim
function mover(id, destino) {
  const arr = atual().secoes, i = arr.findIndex(s => s.id === id);
  if (i < 0 || TIPOS[arr[i].tipo].fixo) return false;
  const [s] = arr.splice(i, 1);
  destino = Math.max(1, Math.min(arr.length - 1, destino));
  arr.splice(destino, 0, s);
  salvar(); renderSecoes(); atualizarPrevia();
  return true;
}

listaSec.addEventListener('change', e => {
  const cb = e.target.closest('[data-acao="ligar"]'); if (!cb) return;
  const id = cb.closest('li').dataset.id, s = atual().secoes.find(x => x.id === id);
  s.ativo = cb.checked; salvar();
  renderSecoes(); if (s.id === secaoSel().id) renderForm();
  atualizarPrevia();
  listaSec.querySelector(`li[data-id="${id}"] [data-acao="ligar"]`).focus();
  NT.aviso(`${TIPOS[s.tipo].nome}: ${s.ativo ? 'aparece na página' : 'oculta da página'}.`);
});
listaSec.addEventListener('click', e => {
  const b = e.target.closest('button[data-acao]'); if (!b) return;
  const id = b.closest('li').dataset.id, acao = b.dataset.acao;
  if (acao === 'selecionar') return selecionar(id, true);
  const i = atual().secoes.findIndex(s => s.id === id);
  if (mover(id, acao === 'subir' ? i - 1 : i + 1)) {
    const novo = listaSec.querySelector(`li[data-id="${id}"] [data-acao="${acao}"]`);
    (novo && !novo.disabled ? novo : listaSec.querySelector(`li[data-id="${id}"] .sec-nome`)).focus();
  }
});

// arrastar e soltar (o teclado continua com ↑ ↓)
let arrastando = null;
const limparAlvos = () => listaSec.querySelectorAll('.alvo-cima,.alvo-baixo,.arrastando').forEach(x => x.classList.remove('alvo-cima', 'alvo-baixo', 'arrastando'));
listaSec.addEventListener('dragstart', e => {
  const li = e.target.closest('li[data-id]');
  if (!li || li.classList.contains('fixa')) { e.preventDefault(); return; }
  arrastando = li.dataset.id;
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', arrastando); } catch (err) { /* alguns navegadores recusam */ }
  li.classList.add('arrastando');
});
listaSec.addEventListener('dragover', e => {
  const li = e.target.closest('li[data-id]'); if (!arrastando || !li) return;
  e.preventDefault();
  const r = li.getBoundingClientRect(), cima = e.clientY < r.top + r.height / 2;
  listaSec.querySelectorAll('.alvo-cima,.alvo-baixo').forEach(x => x.classList.remove('alvo-cima', 'alvo-baixo'));
  li.classList.add(cima ? 'alvo-cima' : 'alvo-baixo');
});
listaSec.addEventListener('drop', e => {
  const li = e.target.closest('li[data-id]'); if (!arrastando || !li) return;
  e.preventDefault();
  const cima = li.classList.contains('alvo-cima'), id = arrastando;
  limparAlvos(); arrastando = null;
  if (li.dataset.id === id) return;
  const arr = atual().secoes, alvo = arr.findIndex(s => s.id === li.dataset.id), de = arr.findIndex(s => s.id === id);
  // posição depois de tirar o item arrastado da lista
  let destino = (cima ? alvo : alvo + 1) - (de < alvo ? 1 : 0);
  mover(id, destino);
});
listaSec.addEventListener('dragend', () => { limparAlvos(); arrastando = null; });

/* ---------- formulário da seção ---------- */
function campo(def, valor, cam) {
  const [, rot, tipo] = def, id = 'c-' + cam.replace(/\./g, '-');
  if (tipo === 'check') return `<label class="marcar" for="${id}"><input type="checkbox" id="${id}" data-cam="${cam}" ${valor ? 'checked' : ''}> ${esc(rot)}</label>`;
  if (tipo === 'nota') return `<div><label class="rot" for="${id}">${esc(rot)}</label><select class="campo" id="${id}" data-cam="${cam}">${[5, 4, 3, 2, 1]
    .map(n => `<option value="${n}" ${+valor === n ? 'selected' : ''}>${'★'.repeat(n)} ${n} de 5</option>`).join('')}</select></div>`;
  const ctl = tipo === 'area'
    ? `<textarea class="campo" id="${id}" data-cam="${cam}" rows="3">${esc(valor)}</textarea>`
    : `<input class="campo" id="${id}" data-cam="${cam}" value="${esc(valor)}" autocomplete="off">`;
  return `<div><label class="rot" for="${id}">${esc(rot)}</label>${ctl}${tipo === 'tit' ? '<small class="dica">Use *asteriscos* para pintar palavras com a cor principal.</small>' : ''}</div>`;
}

function renderForm() {
  const s = secaoSel(), T = TIPOS[s.tipo], d = s.dados;
  let h = `<div class="form-cab"><h2>${T.ico} ${esc(T.nome)}</h2>${s.ativo ? '<span class="badge ok">Na página</span>' : '<span class="badge warn">Oculta</span>'}</div>`;
  if (!s.ativo) h += `<p class="aviso-off">Esta seção está desligada e não aparece na página.<button type="button" class="btn mini" data-item="ligar">Mostrar na página</button></p>`;
  h += `<div class="form">${T.campos.map(c => campo(c, d[c[0]], c[0])).join('')}</div>`;
  if (T.itens) {
    const I = T.itens, itens = d.itens || [];
    h += `<p class="titulo-secao itens-tit">${I.plural} <span class="conta">${itens.length}</span></p>`;
    h += itens.map((it, i) => `<div class="item" role="group" aria-label="${I.nome} ${i + 1}"><div class="item-cab"><b>${I.nome} ${i + 1}</b>
<button type="button" class="btn mini ghost" data-item="subir" data-i="${i}" aria-label="Subir ${I.nome.toLowerCase()} ${i + 1}" ${i ? '' : 'disabled'}>↑</button>
<button type="button" class="btn mini ghost" data-item="descer" data-i="${i}" aria-label="Descer ${I.nome.toLowerCase()} ${i + 1}" ${i < itens.length - 1 ? '' : 'disabled'}>↓</button>
<button type="button" class="btn mini danger" data-item="remover" data-i="${i}" aria-label="Remover ${I.nome.toLowerCase()} ${i + 1}">Remover</button></div>
${I.campos.map(c => campo(c, it[c[0]], `itens.${i}.${c[0]}`)).join('')}</div>`).join('');
    h += itens.length >= 12 ? '<p class="dica">Limite de 12 itens por seção.</p>' : `<button type="button" class="btn mini" data-item="adicionar">+ Adicionar ${I.nome.toLowerCase()}</button>`;
  }
  formSec.innerHTML = h;
}

function gravarCampo(el) {
  const s = secaoSel(), partes = el.dataset.cam.split('.');
  let alvo = s.dados;
  while (partes.length > 1) alvo = alvo[partes.shift()];
  alvo[partes[0]] = el.type === 'checkbox' ? el.checked : el.tagName === 'SELECT' ? Number(el.value) : el.value;
  salvar(); previaDepois();
}
formSec.addEventListener('input', e => { if (e.target.dataset.cam) gravarCampo(e.target); });
formSec.addEventListener('change', e => { if (e.target.dataset.cam && (e.target.type === 'checkbox' || e.target.tagName === 'SELECT')) gravarCampo(e.target); });
formSec.addEventListener('click', e => {
  const b = e.target.closest('[data-item]'); if (!b) return;
  const s = secaoSel(), I = TIPOS[s.tipo].itens, acao = b.dataset.item, i = +b.dataset.i;
  if (acao === 'ligar') { s.ativo = true; salvar(); renderSecoes(); renderForm(); atualizarPrevia(); setTimeout(() => rolarPrevia(s.id), 60); return; }
  const itens = s.dados.itens = s.dados.itens || [];
  let foco = null;
  if (acao === 'adicionar') { itens.push(clonar(I.novo)); foco = `[data-cam="itens.${itens.length - 1}.${I.campos[0][0] === 'icone' ? 'titulo' : I.campos[0][0]}"]`; }
  if (acao === 'remover') {
    const nome = itens[i] && (itens[i].titulo || itens[i].nome || itens[i].pergunta || itens[i].valor) || '';
    if (!confirm(`Remover ${I.nome.toLowerCase()} ${i + 1}${nome ? ` (“${nome}”)` : ''}?`)) return;
    itens.splice(i, 1); foco = '[data-item="adicionar"]';
  }
  if (acao === 'subir' || acao === 'descer') {
    const j = acao === 'subir' ? i - 1 : i + 1;
    if (j < 0 || j >= itens.length) return;
    [itens[i], itens[j]] = [itens[j], itens[i]];
    foco = `[data-item="${acao}"][data-i="${j}"]`;
  }
  salvar(); renderForm(); atualizarPrevia();
  const f = foco && formSec.querySelector(foco);
  if (f && !f.disabled) { f.focus(); if (acao === 'adicionar') { f.select(); f.scrollIntoView({ block: 'center' }); } }
});

/* ---------- tema ---------- */
const painelTema = $('#painelTema');
function infoContraste(c) {
  const r = c.contrasteBtn.toFixed(1).replace('.', ',');
  return `<span class="amostra-btn" style="background:${c.btn};color:${c.btnTxt}">Botão</span>
<span>Texto do botão com contraste <b>${r}:1</b> ${c.contrasteBtn >= 4.5 ? '— passa no WCAG AA ✓' : '— abaixo do recomendado'}${c.btn !== c.cor ? '. O botão foi escurecido para o texto ficar legível.' : ''}</span>`;
}
function renderTema() {
  const p = atual(), t = p.tema, c = paleta(t), pg = p.pagina || (p.pagina = {});
  const seg = (grupo, rot, ops, val) => `<div><span class="rot" id="r-${grupo}">${rot}</span><div class="seg" role="group" aria-labelledby="r-${grupo}">${ops
    .map(([v, txt]) => `<button type="button" data-${grupo}="${v}" aria-pressed="${v === val}">${txt}</button>`).join('')}</div></div>`;
  painelTema.innerHTML = `
<p class="titulo-secao">Modelos de partida</p>
<div class="modelos">${Object.entries(MODELOS).map(([k, m]) => `<button type="button" class="modelo" data-modelo="${k}">
<span class="emo" style="background:${m.tema.cor}" aria-hidden="true">${m.secoes.topo.emoji}</span>
<span><b>${esc(m.cliente)}</b><small>${esc(m.resumo)}</small></span>${p.modelo === k ? '<span class="badge acc">Base atual</span>' : ''}</button>`).join('')}</div>
<p class="dica">Aplicar um modelo troca textos, seções e tema deste projeto pelo do modelo.</p>
<p class="titulo-secao">Cores e fonte</p>
<div class="form">
  <div><label class="rot" for="tCor">Cor principal</label>
    <div class="cor-linha"><input type="color" id="tCor" class="cor-input" value="${c.cor}"><input class="campo mono" id="tHex" value="${c.cor}" maxlength="7" aria-label="Código hexadecimal da cor principal" spellcheck="false"></div>
    <div class="amostras">${CORES.map(x => `<button type="button" class="amostra-cor" data-cor="${x}" style="background:${x}" aria-label="Usar a cor ${x}" aria-pressed="${x === c.cor}"></button>`).join('')}</div></div>
  <div class="par">
    ${seg('modo', 'Fundo da página', [['claro', '☀️ Claro'], ['escuro', '🌙 Escuro']], t.modo === 'escuro' ? 'escuro' : 'claro')}
    ${seg('cantos', 'Cantos', [['redondo', 'Arredondados'], ['reto', 'Retos']], t.cantos === 'reto' ? 'reto' : 'redondo')}
  </div>
  <div><label class="rot" for="tFonte">Fonte</label><select class="campo" id="tFonte">${Object.entries(FONTES)
    .map(([k, x]) => `<option value="${k}" ${k === t.fonte ? 'selected' : ''}>${x.nome}</option>`).join('')}</select></div>
  <div class="contraste" id="tContraste">${infoContraste(c)}</div>
</div>
<p class="titulo-secao">Página nos buscadores</p>
<div class="form">
  <div><label class="rot" for="pgTitulo">Título da aba e do Google</label><input class="campo" id="pgTitulo" data-pg="titulo" value="${esc(pg.titulo)}" maxlength="90"></div>
  <div><label class="rot" for="pgDesc">Descrição <span class="conta-txt" id="pgConta"></span></label><textarea class="campo" id="pgDesc" data-pg="descricao" rows="3" maxlength="300">${esc(pg.descricao)}</textarea></div>
</div>`;
  contarDesc();
}
function contarDesc() {
  const n = ($('#pgDesc') || { value: '' }).value.length, el = $('#pgConta');
  if (el) el.textContent = `· ${n} caracteres ${n > 160 ? '(o Google corta depois de ~160)' : n < 70 ? '(curta demais)' : '(bom tamanho)'}`;
}
// troca de cor sem redesenhar o painel, para não fechar o seletor nativo
function aplicarCor(cor, deOnde) {
  const p = atual(); p.tema.cor = cor.toLowerCase();
  const c = paleta(p.tema);
  if (deOnde !== 'hex') $('#tHex').value = c.cor;
  if (deOnde !== 'cor') $('#tCor').value = c.cor;
  painelTema.querySelectorAll('[data-cor]').forEach(b => b.setAttribute('aria-pressed', b.dataset.cor === c.cor));
  $('#tContraste').innerHTML = infoContraste(c);
  salvar(); previaDepois(); renderProjetos();
}
painelTema.addEventListener('input', e => {
  const el = e.target, p = atual();
  if (el.id === 'tCor') aplicarCor(el.value, 'cor');
  else if (el.id === 'tHex') { const v = el.value.trim().replace(/^#?/, '#'); if (corValida(v)) aplicarCor(v, 'hex'); }
  else if (el.dataset.pg) { p.pagina[el.dataset.pg] = el.value; contarDesc(); salvar(); previaDepois(); }
});
painelTema.addEventListener('change', e => {
  if (e.target.id === 'tFonte') { atual().tema.fonte = e.target.value; salvar(); atualizarPrevia(); }
  if (e.target.id === 'tHex') e.target.value = atual().tema.cor;
});
painelTema.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const p = atual();
  if (b.dataset.cor) return aplicarCor(b.dataset.cor);
  if (b.dataset.modo || b.dataset.cantos) {
    const chave = b.dataset.modo ? 'modo' : 'cantos';
    p.tema[chave] = b.dataset[chave];
    b.parentNode.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    $('#tContraste').innerHTML = infoContraste(paleta(p.tema));
    salvar(); atualizarPrevia(); return;
  }
  if (b.dataset.modelo) {
    const M = MODELOS[b.dataset.modelo];
    if (!confirm(`Aplicar o modelo “${M.cliente}” em “${p.nome}”?\nOs textos, as seções e o tema atuais serão substituídos.`)) return;
    const n = criar(b.dataset.modelo, { cliente: p.cliente, nome: p.nome });
    Object.assign(p, { modelo: n.modelo, tema: n.tema, pagina: n.pagina, secoes: n.secoes });
    ui.secao = p.secoes[0].id; salvarUi(); salvar();
    renderTudo(true);
    NT.aviso(`Modelo “${M.cliente}” aplicado.`);
  }
});

/* ---------- projetos ---------- */
const painelProj = $('#painelProj');
let busca = '';
const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const clientes = () => [...new Set(projetos.map(p => p.cliente))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

function renderSelProj() {
  $('#selProj').innerHTML = clientes().map(c => `<optgroup label="${esc(c)}">${projetos.filter(p => p.cliente === c)
    .map(p => `<option value="${p.id}" ${p.id === ui.atual ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</optgroup>`).join('');
  $('#contaProj').textContent = `(${projetos.length})`;
}
function renderProjetos() {
  const q = semAcento(busca);
  const vis = projetos.filter(p => !q || semAcento(p.cliente + ' ' + p.nome).includes(q));
  const grupos = clientes().filter(c => vis.some(p => p.cliente === c));
  const quando = t => NT.data(t) + ' às ' + new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  painelProj.innerHTML = `<div class="proj-busca"><input class="campo" type="search" id="buscaProj" placeholder="Buscar cliente ou projeto" aria-label="Buscar cliente ou projeto" value="${esc(busca)}">
<button type="button" class="btn mini primary" data-proj="novo">+ Novo projeto</button></div>
${grupos.length ? grupos.map(c => { const ps = vis.filter(p => p.cliente === c); return `<div class="cliente">
<div class="cliente-cab"><h3>${esc(c)}<small>${ps.length} projeto${ps.length > 1 ? 's' : ''}</small></h3><button type="button" class="btn mini ghost" data-proj="novo" data-cliente="${esc(c)}" aria-label="Novo projeto para ${esc(c)}">+ Projeto</button></div>
${ps.map(p => `<div class="proj${p.id === ui.atual ? ' atual' : ''}"><div class="proj-info"><b><span class="ponto-cor" style="background:${esc(p.tema.cor)}"></span>${esc(p.nome)}</b>
<small>${p.secoes.filter(s => s.ativo).length} seções · editado em ${quando(p.atualizado)}</small></div>
<div class="proj-acoes">${p.id === ui.atual ? '<span class="badge acc">Aberto</span>' : `<button type="button" class="btn mini" data-proj="abrir" data-id="${p.id}">Abrir</button>`}
<button type="button" class="btn mini ghost" data-proj="duplicar" data-id="${p.id}" aria-label="Duplicar ${esc(p.nome)}">Duplicar</button>
<button type="button" class="btn mini ghost" data-proj="renomear" data-id="${p.id}" aria-label="Renomear ${esc(p.nome)}">Renomear</button>
<button type="button" class="btn mini danger" data-proj="excluir" data-id="${p.id}" aria-label="Excluir ${esc(p.nome)}">Excluir</button></div></div>`).join('')}</div>`; }).join('')
    : `<div class="vazio">Nenhum projeto com “${esc(busca)}”.</div>`}`;
}

function abrir(id) {
  ui.atual = id; ui.secao = null; salvarUi();
  renderTudo(true);
}
function duplicar(id) {
  const o = projetos.find(p => p.id === id), c = clonar(o);
  c.id = NT.id(); c.nome = o.nome + ' (cópia)'; c.criado = c.atualizado = Date.now();
  c.secoes.forEach(s => { s.id = NT.id(); });
  projetos.splice(projetos.indexOf(o) + 1, 0, c);
  ui.atual = c.id; ui.secao = null; salvarUi(); salvar();
  renderTudo(true);
  NT.aviso(`Cópia criada: “${c.nome}”.`);
}
function excluir(id) {
  const p = projetos.find(x => x.id === id);
  if (projetos.length === 1) return NT.aviso('Mantenha pelo menos um projeto no estúdio.');
  if (!confirm(`Excluir o projeto “${p.nome}” de ${p.cliente}?\nIsso não pode ser desfeito.`)) return;
  projetos.splice(projetos.indexOf(p), 1);
  D.gravar('projetos', projetos);
  if (ui.atual === id) { ui.atual = projetos[0].id; ui.secao = null; salvarUi(); renderTudo(true); }
  else { renderSelProj(); renderProjetos(); }
  NT.aviso(`Projeto “${p.nome}” excluído.`);
}
painelProj.addEventListener('input', e => {
  if (e.target.id !== 'buscaProj') return;
  busca = e.target.value; renderProjetos();
  const b = $('#buscaProj'); b.focus(); b.setSelectionRange(busca.length, busca.length);
});
painelProj.addEventListener('click', e => {
  const b = e.target.closest('[data-proj]'); if (!b) return;
  const id = b.dataset.id;
  ({ novo: () => abrirModal('novo', null, b.dataset.cliente), abrir: () => abrir(id), duplicar: () => duplicar(id),
    renomear: () => abrirModal('editar', id), excluir: () => excluir(id) })[b.dataset.proj]();
});
$('#selProj').addEventListener('change', e => abrir(e.target.value));
$('#bNovo').addEventListener('click', () => abrirModal('novo'));

/* ---------- modal: novo projeto / renomear ---------- */
const mProj = $('#mProj'), fProj = $('#fProj');
let modo = null, voltarFoco = null;
$('#mModelosOp').innerHTML = Object.entries(MODELOS).map(([k, m], i) => `<label class="modelo-op"><input type="radio" name="modelo" value="${k}" ${i ? '' : 'checked'}>
<span class="emo" style="background:${m.tema.cor}" aria-hidden="true">${m.secoes.topo.emoji}</span><span><b>${esc(m.cliente)}</b><small>${esc(m.resumo)}</small></span></label>`).join('');

function abrirModal(tipo, id, cliente) {
  const p = id && projetos.find(x => x.id === id);
  modo = { tipo, id };
  voltarFoco = document.activeElement;
  $('#mProjTit').textContent = tipo === 'novo' ? 'Novo projeto' : 'Renomear projeto';
  $('#bProjOk').textContent = tipo === 'novo' ? 'Criar projeto' : 'Salvar';
  $('#mModelos').hidden = tipo !== 'novo';
  $('#pCli').value = p ? p.cliente : (cliente || '');
  $('#pNome').value = p ? p.nome : '';
  $('#pErro').hidden = true;
  $('#listaCli').innerHTML = clientes().map(c => `<option value="${esc(c)}">`).join('');
  NT.modal(mProj, true);
  // com o cliente já escolhido, o cursor vai direto para o nome
  if (cliente || p) setTimeout(() => $('#pNome').focus(), 40);
}
function fecharModal() {
  NT.modal(mProj, false);
  if (voltarFoco && document.contains(voltarFoco)) voltarFoco.focus();
}
$('#bProjCancelar').addEventListener('click', fecharModal);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !mProj.hidden) { e.preventDefault(); fecharModal(); } });
fProj.addEventListener('submit', e => {
  e.preventDefault();
  const cliente = $('#pCli').value.trim().replace(/\s+/g, ' '), nome = $('#pNome').value.trim().replace(/\s+/g, ' ');
  if (!cliente || !nome) {
    $('#pErro').textContent = !cliente ? 'Informe o nome do cliente.' : 'Dê um nome ao projeto (ex.: Site principal).';
    $('#pErro').hidden = false; $(!cliente ? '#pCli' : '#pNome').focus(); return;
  }
  if (modo.tipo === 'novo') {
    const chave = (fProj.querySelector('input[name="modelo"]:checked') || {}).value || 'padaria';
    const p = criar(chave, { cliente, nome });
    projetos.push(p);
    ui.atual = p.id; ui.secao = null; salvarUi(); salvar();
    NT.modal(mProj, false);
    renderTudo(true);
    NT.aviso(`Projeto “${nome}” criado para ${cliente}.`);
  } else {
    const p = projetos.find(x => x.id === modo.id);
    p.cliente = cliente; p.nome = nome;
    D.gravar('projetos', projetos);
    fecharModal();
    renderSelProj(); renderProjetos(); atualizarPrevia();
    NT.aviso('Projeto renomeado.');
  }
});

/* ---------- topo: exportar, copiar, restaurar ---------- */
const slug = s => semAcento(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pagina';
$('#bExportar').addEventListener('click', () => {
  const p = atual(), nome = slug(p.cliente + '-' + p.nome) + '.html';
  NT.baixar(nome, documento(p, false), 'text/html;charset=utf-8');
  NT.aviso(`Baixando ${nome} — é só publicar.`);
});
$('#bCopiar').addEventListener('click', () => NT.copiar(documento(atual(), false)));
$('#bAba').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([documento(atual(), false)], { type: 'text/html;charset=utf-8' }));
  const w = window.open(url, '_blank');
  if (!w) NT.aviso('O navegador bloqueou a nova aba. Use Exportar HTML.');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
});
$('#bRestaurar').addEventListener('click', () => {
  if (!confirm('Restaurar os projetos de exemplo?\nTodos os projetos e alterações deste estúdio serão substituídos.')) return;
  semear();
  ui = { aba: ui.aba, disp: ui.disp, vista: ui.vista, atual: projetos[0].id, secao: null };
  salvarUi(); busca = '';
  renderTudo(true);
  NT.aviso('Projetos de exemplo restaurados.');
});

/* ---------- ligações gerais ---------- */
document.querySelectorAll('[data-disp]').forEach(b => b.addEventListener('click', () => trocarDisp(b.dataset.disp)));
document.querySelectorAll('[data-vista]').forEach(b => b.addEventListener('click', () => trocarVista(b.dataset.vista)));
NT.abas($('#editor'), aba => { ui.aba = aba; salvarUi(); $('#editorCorpo').scrollTop = 0; });

// clique numa seção da prévia abre ela no editor
addEventListener('message', e => {
  if (e.source !== frame.contentWindow || !e.data || e.data.ntLp !== 'secao') return;
  if (!atual().secoes.some(s => s.id === e.data.id)) return;
  if (ui.aba !== 'secoes') $('.aba[data-aba="secoes"]').click();
  selecionar(e.data.id, false);
  const f = formSec.querySelector('.form-cab');
  if (f && innerWidth > 900) $('#editorCorpo').scrollTo({ top: f.offsetTop - 10, behavior: 'smooth' });
  if (innerWidth <= 900) NT.aviso(`${TIPOS[secaoSel().tipo].nome} selecionada — toque em Editar para alterar.`);
});

addEventListener('resize', medir);
// a altura do topo muda quando as fontes chegam: mede de novo
if (document.fonts && document.fonts.ready) document.fonts.ready.then(medir);
addEventListener('load', medir);
if ('ResizeObserver' in window) new ResizeObserver(() => ajustarFrame()).observe(palco);

function renderTudo(doTopo) {
  if (!atual().secoes.some(s => s.id === ui.secao)) ui.secao = atual().secoes[0].id;
  renderSelProj(); renderSecoes(); renderForm(); renderTema(); renderProjetos(); mostrarSalvo();
  atualizarPrevia(doTopo);
}

carregar();
renderTudo(true);
const abaSalva = $(`.aba[data-aba="${ui.aba}"]`);
if (abaSalva && ui.aba !== 'secoes') abaSalva.click();
trocarDisp(ui.disp);
trocarVista(ui.vista);
})();
