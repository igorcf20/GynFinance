# GYNFINANCE — DESIGN.md
**Design System e Especificação de Interface**

Versão: 1.0  
Produto: Gynfinance  
Desenvolvido por: KodeMI  
Plataforma: Web responsiva (Desktop, Tablet e Mobile)  
Idioma: Português do Brasil (pt-BR)

> Enviado pelo Igor no chat do projeto em 2026-10-15. Imagem de referência das telas: [telas-referencia.png](telas-referencia.png)

---

## 1. VISÃO DO PRODUTO

O Gynfinance é uma plataforma de gestão financeira desenvolvida para microempreendedores individuais (MEIs) e pequenos negócios brasileiros.

**Proposta central:** permitir que qualquer empreendedor entenda quanto dinheiro entrou, quanto saiu, quanto sobrou para o negócio e quanto pode retirar para uso pessoal.

O sistema deve transmitir:

- Simplicidade
- Profissionalismo
- Segurança e confiança
- Organização
- Tecnologia moderna
- Facilidade de utilização
- Clareza financeira

O utilizador não deve precisar de conhecimentos de contabilidade para utilizar o sistema.

### Princípio fundamental

**A interface deve parecer um software financeiro profissional, mas funcionar com a simplicidade de uma aplicação de uso diário.**

Evitar interfaces visualmente carregadas, excesso de indicadores, gráficos desnecessários e cores intensas.

---

## 2. DIREÇÃO VISUAL

### Conceito

**Modern Light Fintech — Minimal Enterprise**

A interface utiliza uma base predominantemente clara, superfícies brancas, tons azul-acinzentados, sombras suaves e detalhes tecnológicos discretos.

A aparência deve transmitir a qualidade de um produto SaaS financeiro premium.

### Características

- Interface predominantemente branca.
- Fundo geral cinza-azulado muito claro.
- Navegação lateral clara.
- Cartões brancos com cantos arredondados.
- Sombras suaves e difusas.
- Bordas discretas.
- Azul utilizado de forma seletiva.
- Gráficos simples, elegantes e legíveis.
- Ícones lineares.
- Tipografia geométrica.
- Espaçamentos generosos.
- Hierarquia visual evidente.
- Microinterações discretas.
- Layout modular e consistente.

### Evitar

- Sidebar azul-marinho escura.
- Gradientes fortes e saturados.
- Cartões com cores intensas.
- Ícones coloridos sem necessidade.
- Muitas informações no mesmo cartão.
- Bordas grossas.
- Sombras pesadas.
- Botões excessivamente grandes.
- Efeitos neon.
- Glassmorphism exagerado.
- Excesso de elementos decorativos.

O objetivo não é uma interface futurista chamativa, mas uma aplicação moderna com acabamento sofisticado.

---

## 3. PALETA DE CORES

### Cores principais

| Token | HEX | Utilização |
|---|---|---|
| Background | `#F5F7FA` | Fundo geral |
| Surface | `#FFFFFF` | Cartões e painéis |
| Sidebar | `#F8FAFC` | Navegação lateral |
| Primary | `#3478F6` | Ações principais |
| Primary Hover | `#2463D9` | Hover de botões |
| Primary Soft | `#EAF2FF` | Seleções e destaques |
| Slate Blue | `#6F8FAF` | Elementos secundários |
| Text Primary | `#172B4D` | Títulos e valores |
| Text Secondary | `#64748B` | Descrições |
| Text Muted | `#94A3B8` | Informações auxiliares |
| Border | `#E8EDF3` | Divisórias |
| Success | `#168653` | Entradas e pagamentos |
| Danger | `#D9485A` | Saídas e atrasos |
| Warning | `#D99432` | Avisos e pendências |

### Regra de distribuição visual

- 75% a 85% de branco e tons neutros.
- 10% a 20% de azul-acinzentado.
- Até 5% de cores de estado.

Verde, vermelho e âmbar devem aparecer apenas quando transmitirem informação financeira ou operacional.

---

## 4. TIPOGRAFIA

### Família principal

**Inter**

Alternativa: Plus Jakarta Sans.

A interface deve utilizar uma única família tipográfica de forma consistente.

### Escala

| Elemento | Tamanho | Peso |
|---|---|---|
| Título principal | 26px | 700 |
| Título de página | 22px | 650 |
| Título de cartão | 16px | 600 |
| Valor principal | 36px | 700 |
| Valor secundário | 23px | 700 |
| Texto padrão | 14px | 400 |
| Texto auxiliar | 12px | 400 |
| Menu lateral | 14px | 500 |
| Botões | 13px | 600 |

Utilizar números tabulares nos valores financeiros para facilitar a leitura.

### Formatação brasileira

- `R$ 2.480`
- `R$ 350,00`
- `18%`
- `24/10/2026`

Valores monetários devem ser formatados com `Intl.NumberFormat('pt-BR')`.

---

## 5. ESTRUTURA GLOBAL

### Desktop

A aplicação utiliza um layout de duas áreas:

**Sidebar fixa + Área principal de conteúdo.**

Sidebar:

- Largura: 232px.
- Fundo claro.
- Altura total da janela.
- Separador vertical discreto.
- Logotipo no topo.
- Menu principal.
- Identificação da empresa no rodapé.

Área principal:

- Fundo `#F5F7FA`.
- Padding horizontal de 28px a 32px.
- Largura fluida.
- Conteúdo organizado em grids.
- Espaçamento entre cartões de 16px a 20px.

### Navegação

Itens:

1. Início
2. Lançamentos
3. Contas
4. Meu MEI
5. Relatórios
6. Mais

Configurações disponíveis através de Mais e do perfil da empresa.

### Item ativo

- Fundo `#EAF2FF`.
- Texto azul.
- Ícone azul.
- Cantos arredondados de 9px.
- Sem efeitos excessivos.

### Cabeçalho

Incluir:

- Título da página.
- Subtítulo contextual, quando necessário.
- Seletor de período.
- Notificações.
- Avatar do utilizador.

---

## 6. CARTÕES E SUPERFÍCIES

Os cartões são os principais elementos estruturais da interface.

### Padrão

- Fundo branco.
- Border radius: 16px.
- Borda: 1px sólida `#E8EDF3`.
- Padding: 20px a 24px.
- Sombra suave.
- Sem gradientes intensos.

### Sombra

```css
box-shadow:
  0 4px 18px rgba(30, 55, 90, 0.035),
  0 1px 3px rgba(30, 55, 90, 0.025);
```

### Hover

```css
transition:
  transform 180ms ease,
  box-shadow 180ms ease,
  border-color 180ms ease;
```

No hover, aumentar discretamente a sombra e destacar a borda.

Evitar movimentos exagerados.

---

## 7. COMPONENTES

### Botão primário

- Fundo azul `#3478F6`.
- Texto branco.
- Altura: 40px.
- Radius: 10px.
- Ícone opcional.
- Hover com azul mais escuro.

### Botão secundário

- Fundo branco.
- Borda cinza.
- Texto azul-acinzentado.
- Mesmo tamanho do primário.

### Botão discreto

Utilizado em tabelas e cartões.

- Fundo transparente.
- Ícone e texto.
- Hover com fundo cinza muito claro.

### Campos de formulário

- Altura: 42px.
- Fundo branco.
- Borda `#E8EDF3`.
- Radius: 9px.
- Foco com borda azul e halo muito suave.
- Label acima do campo.

### Badges

Estados:

- Recebido: verde suave.
- Pago: verde suave.
- Pendente: cinza-azulado.
- Atrasado: vermelho suave.
- Atenção: âmbar suave.

Os badges devem utilizar cores de fundo muito claras e texto com contraste adequado.

### Ícones

Biblioteca recomendada: **Lucide React**.

Padrão:

- 18px a 20px.
- Stroke 1.7.
- Cor azul-acinzentada.
- Sem preenchimentos decorativos.
- Consistência em toda a aplicação.

---

## 8. TELAS DO SISTEMA

### 8.1 Início — Dashboard

Objetivo: mostrar rapidamente a situação financeira do negócio.

#### Cabeçalho

- Olá, Ana
- Doces da Ana · MEI
- Outubro 2026

#### Cartão principal

**Sobrou no mês**

R$ 2.480

Indicador: +18% vs. setembro

Descrição: Bom mês. Dá para guardar R$ 500 de reserva.

Gráfico simples dos últimos cinco meses.

#### Resumo financeiro

Três cartões:

- Entrou: R$ 6.320
- Saiu: R$ 3.840
- Retirei: R$ 1.500

Cada cartão deve conter um valor, uma descrição curta e um ícone discreto.

#### Saldo

Saldo do caixa hoje: R$ 4.150.

#### Próximos 7 dias

- Aluguel — R$ 1.200 — vence amanhã.
- João Silva — R$ 350 — a receber, atrasado desde 02/10.

#### Alertas

O DAS de outubro vence dia 20.

Apresentar avisos como cartões compactos e discretos.

**Importante:** não transformar o dashboard numa página que contenha todas as funcionalidades do sistema. Informações detalhadas pertencem às suas próprias seções.

---

### 8.2 Novo lançamento

Objetivo: registar uma movimentação financeira com o mínimo de esforço.

Layout limpo, centrado e organizado.

#### Tipo de lançamento

Controlo segmentado:

- Entrou dinheiro.
- Saiu dinheiro.

#### Valor

Campo monetário em destaque.

Exemplo: R$ 350,00.

#### Categoria

- Vendas.
- Serviços prestados.
- Outras entradas.

#### Informações

- Data: Hoje.
- Forma de pagamento: Pix.
- Situação: Recebido.

#### Campos opcionais

- Descrição.
- Cliente.
- Foto do comprovante.

#### Nota fiscal

Pergunta: Nota emitida?

- Sim.
- Não.

Link: Emitir nota no portal.

#### Ação principal

Salvar lançamento.

#### Atalhos

- Retirada para mim.
- Paguei com dinheiro pessoal.

A interface deve ser progressiva: mostrar inicialmente apenas o necessário e revelar campos adicionais conforme a ação do utilizador.

---

### 8.3 Contas

Organizar em duas abas:

**A pagar | A receber**

#### A pagar

Grupos:

Atrasadas:

- Internet — R$ 99,90 — atrasada há 3 dias.

Vencem esta semana:

- Aluguel — R$ 1.200 — vence amanhã.

Mais para frente:

- Fornecedor de embalagens — R$ 380 — vence 24/10.

Cada linha inclui:

- Ícone.
- Descrição.
- Data.
- Valor.
- Estado.
- Botão Paguei.

#### A receber

- João Silva — R$ 350 — atrasado desde 02/10.
- Buffet Estrela — R$ 900 — vence 28/10.

Ação:

Cobrar no WhatsApp.

Utilizar tabelas ou listas compactas no desktop e cartões adaptados no mobile.

---

### 8.4 Meu MEI

Objetivo: facilitar o acompanhamento das obrigações do microempreendedor.

#### Faturamento anual

R$ 52.400 de R$ 81.000.

Progresso: 65%.

Texto: Ainda pode faturar R$ 28.600 este ano.

#### Projeção

No ritmo atual, você fecha o ano com R$ 62.880.

#### DAS de outubro

- Vencimento: dia 20.
- Situação: Não pago.
- Pagar no portal.
- Marcar como pago.

#### Histórico do DAS

Janeiro a setembro: pagos.

Outubro: pendente.

Novembro e dezembro: futuros.

#### Declaração anual

Declaração anual (DASN-SIMEI) até 31 de maio.

O limite anual e as regras fiscais devem ser parametrizados por ano e situação do MEI, e não fixados permanentemente no código.

---

### 8.5 Fechamento do mês

Título: Setembro fechou.

Valor: Sobrou R$ 2.100.

#### Resumo

- Entrou.
- Saiu.
- Retirei.
- Ficou na empresa.

#### Onde mais gastou

Gráfico horizontal por categoria:

- Mercadoria e matéria-prima.
- Aluguel.
- Embalagem.

#### Alertas

2 vendas do mês estão sem nota.

#### Reserva

Separe R$ 300 para a reserva.

Botão: Separar.

#### Partilha

Compartilhar resumo no WhatsApp.

Os números históricos de setembro devem ser mantidos num conjunto de dados próprio e não misturados com os dados de outubro.

---

### 8.6 Fluxo de caixa

Gráfico principal com:

- Entradas.
- Saídas.
- Evolução por mês.

Filtros:

- Últimos 3 meses.
- Últimos 6 meses.
- Últimos 12 meses.
- Período personalizado.

Abaixo, apresentar tabela com:

- Mês.
- Entradas.
- Saídas.
- Resultado.

Gráficos devem utilizar tons de azul e azul-acinzentado, com contraste e legenda clara.

---

### 8.7 Lançamentos

Página de histórico financeiro.

Elementos:

- Pesquisa.
- Filtro de período.
- Filtro de categoria.
- Entradas.
- Saídas.
- Situação.
- Novo lançamento.

Tabela:

- Data.
- Descrição.
- Categoria.
- Forma.
- Valor.
- Situação.
- Ações.

Suportar paginação, ordenação, edição e exclusão com confirmação.

---

### 8.8 Relatórios

Organizar os relatórios em categorias:

- Resumo financeiro.
- Fluxo de caixa.
- Despesas por categoria.
- Receitas por categoria.
- Pró-labore e retiradas.
- Contas em atraso.
- Fechamento mensal.

Oferecer exportação em PDF e CSV quando a funcionalidade estiver implementada.

Evitar gráficos redundantes.

Cada gráfico deve responder a uma pergunta concreta do empreendedor.

---

### 8.9 Configurações

Organizar em menu interno:

- Empresa.
- Categorias.
- Contas bancárias.
- Notificações.
- Utilizadores.
- Assinatura.

Formulários claros e divididos por secções.

Não colocar todas as configurações numa única página extensa.

---

## 9. RESPONSIVIDADE

### Desktop — acima de 1200px

- Sidebar expandida.
- Grids com 2 a 3 colunas.
- Tabelas completas.
- Gráficos horizontais.
- Espaçamento generoso.

### Tablet — 768px a 1199px

- Sidebar compacta.
- Grids de 2 colunas quando possível.
- Redução moderada dos espaçamentos.
- Tabelas com scroll horizontal quando necessário.

### Mobile — abaixo de 768px

- Sidebar substituída por navegação inferior.
- Cartões empilhados.
- Gráficos adaptados.
- Formulários em coluna única.
- Botões com área de toque confortável.
- Ação de novo lançamento sempre acessível.

Navegação mobile:

- Início.
- Lançamentos.
- Botão central de lançar.
- Contas.
- Meu MEI.

---

## 10. MICROINTERAÇÕES

Utilizar animações discretas para melhorar a perceção de qualidade.

### Padrões

- Hover: 150–180ms.
- Abertura de modal: 180–220ms.
- Transição de abas: 150–200ms.
- Feedback de botão: imediato.
- Skeleton loading para carregamentos.
- Toast para confirmação de ações.

### Exemplos

Ao salvar lançamento:

1. Desativar temporariamente o botão.
2. Mostrar indicador de processamento.
3. Confirmar o sucesso.
4. Atualizar os dados financeiros.
5. Permitir novo lançamento.

Não utilizar animações decorativas sem função.

Respeitar a preferência `prefers-reduced-motion`.

---

## 11. ACESSIBILIDADE

- Contraste mínimo WCAG AA.
- Labels visíveis.
- Navegação por teclado.
- Estados de foco claros.
- Áreas clicáveis adequadas.
- Não comunicar estados apenas por cor.
- Mensagens de erro objetivas.
- Suporte a leitores de ecrã.
- Formatação monetária consistente.
- Tabelas semanticamente corretas.

---

## 12. ARQUITETURA VISUAL

Estrutura sugerida:

```text
src/
├── components/
│   ├── ui/
│   │   ├── Button
│   │   ├── Card
│   │   ├── Badge
│   │   ├── Input
│   │   ├── Select
│   │   ├── Modal
│   │   ├── Tabs
│   │   └── DataTable
│   ├── layout/
│   │   ├── Sidebar
│   │   ├── Header
│   │   ├── MainLayout
│   │   └── MobileNavigation
│   ├── financial/
│   │   ├── FinancialSummary
│   │   ├── BalanceCard
│   │   ├── CashFlowChart
│   │   ├── TransactionRow
│   │   ├── AccountRow
│   │   └── MonthlyClosing
│   └── mei/
│       ├── RevenueLimit
│       ├── DASCard
│       └── DASTimeline
├── pages/
│   ├── Dashboard
│   ├── Transactions
│   ├── NewTransaction
│   ├── Accounts
│   ├── MEI
│   ├── Reports
│   └── Settings
└── styles/
    ├── tokens.css
    └── globals.css
```

---

## 13. TECNOLOGIAS RECOMENDADAS

Para uma implementação React:

- Next.js e TypeScript.
- Tailwind CSS.
- shadcn/ui como base de componentes.
- Lucide React para ícones.
- Recharts para gráficos.
- React Hook Form.
- Zod para validação.
- TanStack Table para tabelas.
- TanStack Query para estado assíncrono.

A biblioteca de componentes deve ser personalizada com os tokens do Gynfinance.

Não utilizar o tema visual padrão do shadcn/ui sem adaptação.

---

## 14. REGRAS DE CONSISTÊNCIA

1. Todas as telas devem partilhar a mesma sidebar, cabeçalho, tipografia e tokens.
2. Não criar novos estilos de cartões sem necessidade.
3. Manter os mesmos padrões de botões em toda a aplicação.
4. Não utilizar cores arbitrárias.
5. Valores financeiros devem ser obtidos de dados partilhados, e não duplicados manualmente nas páginas.
6. Os estados vazios devem explicar ao utilizador o que fazer.
7. As ações financeiras devem fornecer confirmação clara.
8. Não apresentar botões sem funcionalidade real como se estivessem operacionais.
9. As datas e os dados demonstrativos devem ser separados dos dados reais.
10. A experiência mobile deve ser concebida como parte do produto, não como adaptação secundária.

---

## 15. CRITÉRIOS DE ACEITAÇÃO VISUAL

Antes de considerar uma tela concluída, verificar:

- O fundo é predominantemente claro?
- O azul é utilizado de forma moderada?
- Os cartões têm espaçamentos consistentes?
- Os valores principais destacam-se?
- Existe uma hierarquia clara?
- Os ícones seguem o mesmo estilo?
- Os botões têm estados coerentes?
- O utilizador identifica a ação principal rapidamente?
- A página funciona em desktop e mobile?
- O resultado parece um software financeiro profissional e confiável?

Se uma tela parecer demasiado colorida, densa ou decorativa, simplificá-la.

---

## 16. INSTRUÇÃO FINAL PARA IMPLEMENTAÇÃO

Implementar o Gynfinance seguindo rigorosamente este documento como referência visual.

A direção aprovada é uma interface SaaS clara, moderna, minimalista, com superfícies brancas, detalhes azul-acinzentados, cantos arredondados e sombras discretas.

Priorizar a experiência de um microempreendedor que necessita de respostas simples sobre o dinheiro do negócio.

**Não regressar à direção anterior com sidebar azul-marinho escura, cartões excessivamente coloridos e dashboard sobrecarregado.**

Criar componentes reutilizáveis, preservar a consistência entre telas e manter uma linguagem visual empresarial, tecnológica e acessível.

**Objetivo final: um produto que transmita confiança à primeira vista e simplicidade desde o primeiro clique.**
