// Textos, imagens e contatos do site de venda (site/index.html) que o superadmin pode trocar.
// Cada campo tem uma chave (a mesma do atributo data-cms / data-cms-img / data-contato no HTML)
// e um padrão igual ao texto que já está no HTML: sem nenhuma edição, o site fica idêntico.

export type TipoCampo = 'texto' | 'texto-longo' | 'imagem' | 'link' | 'telefone' | 'email'

export interface CampoSite {
  chave: string
  rotulo: string
  tipo: TipoCampo
  padrao: string
  ajuda?: string
}

export interface SecaoSite {
  id: string
  titulo: string
  descricao?: string
  campos: CampoSite[]
}

const AJUDA_IMAGEM = 'Use uma imagem larga (print da tela do computador). Deixe em branco para usar a imagem original.'

export const SECOES_SITE: SecaoSite[] = [
  {
    id: 'contato',
    titulo: 'Empresa e atendimento',
    descricao: 'Quem está por trás do Gynfinance, horário de atendimento e contatos. Aparecem no rodapé do site e na tela de suporte do sistema.',
    campos: [
      { chave: 'empresa.nome', rotulo: 'Nome da empresa', tipo: 'texto', padrao: 'KodeMI', ajuda: 'Aparece no rodapé, em "© 2026 KodeMI".' },
      { chave: 'empresa.cnpj', rotulo: 'CNPJ', tipo: 'texto', padrao: '', ajuda: 'Ex.: 12.345.678/0001-90. Deixe em branco para não mostrar.' },
      { chave: 'empresa.responsavel', rotulo: 'Responsável (gestor)', tipo: 'texto', padrao: '', ajuda: 'Nome de quem responde pelo Gynfinance. Deixe em branco para não mostrar.' },
      { chave: 'empresa.endereco', rotulo: 'Cidade ou endereço', tipo: 'texto', padrao: '', ajuda: 'Ex.: Goiânia, GO. Deixe em branco para não mostrar.' },
      { chave: 'atendimento.horario', rotulo: 'Horário de atendimento', tipo: 'texto', padrao: 'Segunda a sexta, em horário comercial', ajuda: 'Ex.: Segunda a sexta, das 9h às 18h. Sábado, das 9h às 12h.' },
      { chave: 'contato.whatsapp', rotulo: 'Número do WhatsApp', tipo: 'telefone', padrao: '', ajuda: 'Só números com DDD, ex.: 62999990000. Os botões de WhatsApp do site usam este número.' },
      { chave: 'contato.whatsapp_mensagem', rotulo: 'Mensagem que já vem escrita no WhatsApp', tipo: 'texto', padrao: 'Olá! Quero saber mais sobre o Gynfinance.', ajuda: 'O cliente pode mudar a mensagem antes de enviar.' },
      { chave: 'lista.botao', rotulo: 'Botão da lista de espera', tipo: 'texto', padrao: 'Quero ser avisado', ajuda: 'Com os cadastros fechados (Superadmin > Sistema), os botões "Criar minha conta" mostram este texto e abrem o WhatsApp.' },
      { chave: 'lista.mensagem', rotulo: 'Mensagem da lista de espera', tipo: 'texto-longo', padrao: 'Olá! Quero entrar na lista de espera do Gynfinance e ser avisado quando abrir.\nNome:\nNegócio:\nCidade:\nComo conheci o Gynfinance:', ajuda: 'Vem escrita no WhatsApp de quem clica em "Quero ser avisado". Se o link tiver ?origem=instagram (ou outro canal), o site acrescenta "Vim por: instagram".' },
      { chave: 'lista.oferta', rotulo: 'Oferta de lançamento', tipo: 'texto', padrao: 'Os 10 primeiros assinantes ganham 3 meses grátis.', ajuda: 'Aparece abaixo dos botões do topo enquanto os cadastros estão fechados. Os 3 meses se dão em Superadmin > Assinantes, pondo o próximo vencimento 3 meses à frente.' },
      { chave: 'contato.email', rotulo: 'E-mail de contato', tipo: 'email', padrao: '', ajuda: 'Aparece no rodapé do site. Deixe em branco para não mostrar.' },
      { chave: 'contato.instagram', rotulo: 'Link do Instagram', tipo: 'link', padrao: '', ajuda: 'Ex.: https://instagram.com/gynfinance. Aparece no rodapé. Deixe em branco para não mostrar.' },
    ],
  },
  {
    id: 'hero',
    titulo: 'Topo da página',
    descricao: 'A primeira coisa que o visitante vê.',
    campos: [
      { chave: 'hero.selo', rotulo: 'Selo acima do título', tipo: 'texto', padrao: 'Para MEI e pequenas empresas' },
      { chave: 'hero.titulo_antes', rotulo: 'Título principal (começo)', tipo: 'texto', padrao: 'Saiba quanto', ajuda: 'O título é montado em três partes: começo, palavra em destaque (azul) e final.' },
      { chave: 'hero.titulo_destaque', rotulo: 'Título principal (palavra em azul)', tipo: 'texto', padrao: 'sobrou' },
      { chave: 'hero.titulo_depois', rotulo: 'Título principal (final)', tipo: 'texto', padrao: 'no fim do mês.' },
      { chave: 'hero.subtitulo', rotulo: 'Texto abaixo do título', tipo: 'texto-longo', padrao: 'O Gynfinance organiza o dinheiro do seu negócio: o que entrou, o que saiu, as contas para pagar e receber e o limite do MEI. Você anota, ele faz as contas.' },
      { chave: 'hero.botao_principal', rotulo: 'Botão azul', tipo: 'texto', padrao: 'Testar a demonstração', ajuda: 'Abre a demonstração do sistema.' },
      { chave: 'hero.botao_secundario', rotulo: 'Botão branco', tipo: 'texto', padrao: 'Criar minha conta', ajuda: 'Abre o cadastro.' },
      { chave: 'hero.nota', rotulo: 'Frase abaixo dos botões', tipo: 'texto', padrao: 'A demonstração abre na hora, sem cadastro.' },
      { chave: 'hero.imagem', rotulo: 'Imagem do painel', tipo: 'imagem', padrao: 'img/tela-painel.webp', ajuda: 'Print da tela do computador, de preferência no formato 16:10 (ex.: 1440 × 900).' },
    ],
  },
  {
    id: 'problemas',
    titulo: 'Problemas que resolve',
    descricao: 'Os quatro cartões logo abaixo do topo.',
    campos: [
      { chave: 'problemas.titulo', rotulo: 'Título da seção', tipo: 'texto', padrao: 'O mês acaba e o dinheiro some?' },
      { chave: 'problemas.subtitulo', rotulo: 'Texto abaixo do título', tipo: 'texto-longo', padrao: 'Quem toca um pequeno negócio conhece bem esses problemas. O Gynfinance foi feito para resolver cada um deles, sem você precisar entender de contabilidade.' },
      { chave: 'problemas.card1.titulo', rotulo: 'Cartão 1: título', tipo: 'texto', padrao: 'Dinheiro da casa misturado com o da empresa' },
      { chave: 'problemas.card1.texto', rotulo: 'Cartão 1: texto', tipo: 'texto-longo', padrao: 'O mercado de casa sai do caixa da loja e ninguém sabe mais o que é de quem.' },
      { chave: 'problemas.card2.titulo', rotulo: 'Cartão 2: título', tipo: 'texto', padrao: 'Não sabe quanto sobrou no mês' },
      { chave: 'problemas.card2.texto', rotulo: 'Cartão 2: texto', tipo: 'texto-longo', padrao: 'Vendeu bem, mas no fim do mês a conta não fecha e fica a dúvida: o negócio dá lucro?' },
      { chave: 'problemas.card3.titulo', rotulo: 'Cartão 3: título', tipo: 'texto', padrao: 'Conta esquecida, juros pagos' },
      { chave: 'problemas.card3.texto', rotulo: 'Cartão 3: texto', tipo: 'texto-longo', padrao: 'O boleto venceu, o cliente não pagou e você só lembrou depois.' },
      { chave: 'problemas.card4.titulo', rotulo: 'Cartão 4: título', tipo: 'texto', padrao: 'Limite do MEI e DAS no escuro' },
      { chave: 'problemas.card4.texto', rotulo: 'Cartão 4: texto', tipo: 'texto-longo', padrao: 'Sem acompanhar o faturamento, dá para estourar o limite anual ou atrasar o DAS.' },
    ],
  },
  {
    id: 'recursos',
    titulo: 'Como funciona',
    descricao: 'Abertura da parte que mostra as telas do sistema.',
    campos: [
      { chave: 'recursos.titulo', rotulo: 'Título da seção', tipo: 'texto', padrao: 'Tudo o que o seu negócio precisa, em telas simples' },
      { chave: 'recursos.subtitulo', rotulo: 'Texto abaixo do título', tipo: 'texto-longo', padrao: 'Nada de planilha complicada nem termo de contador. Cada tela responde a uma pergunta sobre o seu dinheiro.' },
    ],
  },
  {
    id: 'lancamentos',
    titulo: 'Tela 1: Lançamentos',
    campos: [
      { chave: 'lancamentos.selo', rotulo: 'Nome pequeno acima do título', tipo: 'texto', padrao: 'Lançamentos' },
      { chave: 'lancamentos.titulo', rotulo: 'Título', tipo: 'texto', padrao: 'Entrou ou saiu dinheiro? Anote em segundos.' },
      { chave: 'lancamentos.texto', rotulo: 'Texto', tipo: 'texto-longo', padrao: 'Escolha se entrou ou saiu, digite o valor e a categoria. Pronto. O resto o Gynfinance calcula sozinho.' },
      { chave: 'lancamentos.imagem', rotulo: 'Imagem', tipo: 'imagem', padrao: 'img/celular-lancar.webp', ajuda: 'Esta imagem aparece dentro de um celular: use um print da tela do celular (em pé).' },
    ],
  },
  {
    id: 'pessoal',
    titulo: 'Tela 2: Pessoal x empresa',
    campos: [
      { chave: 'pessoal.selo', rotulo: 'Nome pequeno acima do título', tipo: 'texto', padrao: 'Pessoal x empresa' },
      { chave: 'pessoal.titulo', rotulo: 'Título', tipo: 'texto', padrao: 'Quanto sobrou, quanto você tirou e quanto ficou na empresa.' },
      { chave: 'pessoal.texto', rotulo: 'Texto', tipo: 'texto-longo', padrao: 'No fechamento do mês você vê o resultado do negócio sem confundir com o seu salário. E recebe uma sugestão de quanto guardar de reserva.' },
      { chave: 'pessoal.imagem', rotulo: 'Imagem', tipo: 'imagem', padrao: 'img/tela-fechamento.webp', ajuda: AJUDA_IMAGEM },
    ],
  },
  {
    id: 'contas',
    titulo: 'Tela 3: Contas a pagar e a receber',
    campos: [
      { chave: 'contas.selo', rotulo: 'Nome pequeno acima do título', tipo: 'texto', padrao: 'Contas a pagar e a receber' },
      { chave: 'contas.titulo', rotulo: 'Título', tipo: 'texto', padrao: 'Nenhuma conta esquecida. Nenhum cliente sem cobrança.' },
      { chave: 'contas.texto', rotulo: 'Texto', tipo: 'texto-longo', padrao: 'As contas aparecem separadas por atrasadas, desta semana e mais para frente. Para o cliente que está devendo, a cobrança sai pronta pelo WhatsApp.' },
      { chave: 'contas.imagem', rotulo: 'Imagem', tipo: 'imagem', padrao: 'img/tela-contas.webp', ajuda: AJUDA_IMAGEM },
    ],
  },
  {
    id: 'mei',
    titulo: 'Tela 4: Meu MEI',
    campos: [
      { chave: 'mei.selo', rotulo: 'Nome pequeno acima do título', tipo: 'texto', padrao: 'Meu MEI' },
      { chave: 'mei.titulo', rotulo: 'Título', tipo: 'texto', padrao: 'O limite do MEI e o DAS sempre à vista.' },
      { chave: 'mei.texto', rotulo: 'Texto', tipo: 'texto-longo', padrao: 'O Gynfinance soma o que você faturou no ano e mostra quanto ainda pode faturar. Se o ritmo das vendas passar do limite, você fica sabendo antes.' },
      { chave: 'mei.imagem', rotulo: 'Imagem', tipo: 'imagem', padrao: 'img/tela-mei.webp', ajuda: AJUDA_IMAGEM },
    ],
  },
  {
    id: 'fluxo',
    titulo: 'Tela 5: Fluxo de caixa e relatórios',
    campos: [
      { chave: 'fluxo.selo', rotulo: 'Nome pequeno acima do título', tipo: 'texto', padrao: 'Fluxo de caixa e relatórios' },
      { chave: 'fluxo.titulo', rotulo: 'Título', tipo: 'texto', padrao: 'Veja se o negócio está crescendo, mês a mês.' },
      { chave: 'fluxo.texto', rotulo: 'Texto', tipo: 'texto-longo', padrao: 'Compare as entradas e as saídas dos últimos meses e descubra para onde está indo o dinheiro. Quando o contador pedir, é só exportar.' },
      { chave: 'fluxo.imagem', rotulo: 'Imagem', tipo: 'imagem', padrao: 'img/tela-fluxo.webp', ajuda: AJUDA_IMAGEM },
    ],
  },
  {
    id: 'preco',
    titulo: 'Preço',
    descricao: 'Os planos, valores e módulos vêm da tela de Planos. Aqui ficam só os textos em volta.',
    campos: [
      { chave: 'preco.titulo', rotulo: 'Título (quando há um plano só)', tipo: 'texto', padrao: 'Um plano só, com tudo incluído' },
      { chave: 'preco.subtitulo', rotulo: 'Texto abaixo do título (quando há um plano só)', tipo: 'texto-longo', padrao: 'Assinatura mensal, sem planos complicados para comparar.' },
      { chave: 'preco.titulo_varios', rotulo: 'Título (quando há dois ou mais planos)', tipo: 'texto', padrao: 'Escolha o plano para o seu negócio' },
      { chave: 'preco.subtitulo_varios', rotulo: 'Texto abaixo do título (quando há dois ou mais planos)', tipo: 'texto-longo', padrao: 'Assinatura mensal. Compare o que vem em cada plano e comece pelo que precisa hoje.' },
      { chave: 'preco.nota_demo', rotulo: 'Frase antes do link da demonstração', tipo: 'texto', padrao: 'Prefere ver antes?' },
      { chave: 'preco.contato_texto', rotulo: 'Frase acima do botão do WhatsApp', tipo: 'texto', padrao: 'Ficou com alguma dúvida? A gente responde.' },
    ],
  },
  {
    id: 'faq',
    titulo: 'Dúvidas frequentes',
    campos: [
      { chave: 'faq.1.pergunta', rotulo: 'Pergunta 1', tipo: 'texto', padrao: 'Preciso instalar alguma coisa?' },
      { chave: 'faq.1.resposta', rotulo: 'Resposta 1', tipo: 'texto-longo', padrao: 'Não. O Gynfinance abre no navegador, no celular ou no computador. É só entrar com o seu e-mail e senha.' },
      { chave: 'faq.2.pergunta', rotulo: 'Pergunta 2', tipo: 'texto', padrao: 'Meus dados ficam seguros?' },
      { chave: 'faq.2.resposta', rotulo: 'Resposta 2', tipo: 'texto-longo', padrao: 'Sim. A sua senha é guardada cifrada, a conexão com o site é protegida (HTTPS) e cada empresa só vê os próprios dados.' },
      { chave: 'faq.3.pergunta', rotulo: 'Pergunta 3', tipo: 'texto', padrao: 'Serve para quem não é MEI?' },
      { chave: 'faq.3.resposta', rotulo: 'Resposta 3', tipo: 'texto-longo', padrao: 'Serve. Pequenas empresas também usam o Gynfinance para controlar entradas, saídas, contas e o fechamento do mês. As telas do limite e do DAS são as únicas pensadas só para o MEI.' },
      { chave: 'faq.4.pergunta', rotulo: 'Pergunta 4', tipo: 'texto', padrao: 'O Gynfinance emite nota fiscal?' },
      { chave: 'faq.4.resposta', rotulo: 'Resposta 4', tipo: 'texto-longo', padrao: 'Ainda não, a emissão de nota chega em breve. Hoje cada venda tem o campo "nota emitida" e um atalho para o portal oficial da nota (NFS-e), e o fechamento do mês avisa quantas vendas ficaram sem nota.' },
      { chave: 'faq.5.pergunta', rotulo: 'Pergunta 5', tipo: 'texto', padrao: 'Como faço para testar antes de assinar?' },
      { chave: 'faq.5.resposta', rotulo: 'Resposta 5', tipo: 'texto-longo', padrao: 'Clique em "Testar a demonstração". O sistema abre na hora com os dados de exemplo da Doces da Ana, sem cadastro. O que você mexer na demonstração não fica salvo.' },
      { chave: 'faq.6.pergunta', rotulo: 'Pergunta 6', tipo: 'texto', padrao: 'Consigo mandar os números para o meu contador?' },
      { chave: 'faq.6.resposta', rotulo: 'Resposta 6', tipo: 'texto-longo', padrao: 'Sim. Na tela de lançamentos você exporta os lançamentos do mês em CSV, um arquivo que abre no Excel ou em qualquer planilha.' },
    ],
  },
  {
    id: 'chamada',
    titulo: 'Chamada final',
    descricao: 'O quadro azul-escuro no fim da página.',
    campos: [
      { chave: 'chamada.titulo', rotulo: 'Título', tipo: 'texto', padrao: 'Comece o próximo mês sabendo para onde vai o seu dinheiro.' },
      { chave: 'chamada.texto', rotulo: 'Texto', tipo: 'texto-longo', padrao: 'Teste agora com dados de exemplo ou crie sua conta e configure o seu negócio em 2 minutos.' },
    ],
  },
  {
    id: 'rodape',
    titulo: 'Rodapé',
    campos: [
      { chave: 'rodape.texto', rotulo: 'Frase do rodapé', tipo: 'texto', padrao: 'Controle financeiro simples para MEI e pequenas empresas.', ajuda: 'Aparece embaixo do logo, no rodapé.' },
    ],
  },
]

/** Todas as chaves válidas, para o servidor recusar chave desconhecida. */
export const CHAVES_SITE: Set<string> = new Set(SECOES_SITE.flatMap((s) => s.campos.map((c) => c.chave)))

const PADROES = new Map<string, string>(SECOES_SITE.flatMap((s) => s.campos.map((c) => [c.chave, c.padrao] as [string, string])))

export function valorPadrao(chave: string): string | undefined {
  return PADROES.get(chave)
}
