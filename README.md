# Gynfinance

Gestão financeira simples para MEIs e pequenos negócios. Por [KodeMI](https://kodemi.pt).

Responde todo mês: **quanto entrou, quanto saiu, quanto sobrou para o negócio e quanto dá para tirar para você.**

## Rodar

```bash
npm install
npm run dev      # http://localhost:5173 (só o site, dados no navegador)
npm test         # regras de cálculo (e o servidor, com TEST_DATABASE_URL)
npm run build    # gera dist/
```

Com o servidor (login e banco), num Postgres local:

```bash
DATABASE_URL=postgres://postgres@localhost/gynfinance APP_DB_PASSWORD=senha-local npm run migrar
APP_DATABASE_URL=postgres://gynfinance_app:senha-local@localhost/gynfinance npm run servidor   # http://localhost:3000
TEST_DATABASE_URL=postgres://postgres@localhost/gyn_teste npm test   # banco vazio só para os testes
```

Para instalar numa VPS com Docker, veja [docs/INSTALAR.md](docs/INSTALAR.md).

## O que já tem (módulo inicial)

| Tela | Rota |
|---|---|
| Início (painel do mês) | `#/` |
| Novo lançamento | `#/lancar` |
| Lançamentos (extrato, filtros, CSV) | `#/lancamentos` |
| Contas a pagar e a receber | `#/contas` |
| Meu MEI (limite, DAS, declaração) | `#/mei` |
| Fechamento do mês | `#/fechamento` |
| Fluxo de caixa | `#/fluxo` |
| Relatórios | `#/relatorios` |
| Configurações | `#/configuracoes` |
| Configuração inicial (primeiro acesso) | `#/comecar` |

Sem servidor (o `dist/` sozinho, como na demonstração publicada), o app abre em **modo demonstração** com a "Doces da Ana" vista em 15/10/2026. Os dados ficam no navegador
(localStorage). Em Configurações, Assinatura, dá para restaurar os dados de exemplo antes de uma apresentação.

"Usar com o meu negócio" (menu lateral, Mais ou Configurações) abre a configuração inicial: nome, tipo de negócio,
MEI, mês de abertura, saldo de hoje, pró-labore desejado e, para MEI, o que já vendeu no ano e se os DAS estão em dia.
Ela troca a demonstração por um negócio vazio, com a data de hoje.

Com o servidor, "Usar com o meu negócio" pede primeiro para criar a conta ou entrar. Os dados do negócio ficam no
banco, e cada mudança feita no app vai para o servidor em seguida (`src/data/sincronizar.ts` calcula o que mudou;
sem internet, as mudanças esperam e tentam de novo a cada 5 segundos). A demonstração continua só no navegador.

## Organização

```text
src/
├── domain/        tipos, parâmetros do MEI por ano e regras de cálculo (testadas)
├── data/          estado do app, conversa com o servidor, categorias padrão e dados de demonstração
├── components/
│   ├── ui/        Button, Card, Badge, Field, Tabs, Modal e Toast
│   ├── layout/    Sidebar, Header, MobileNavigation, MainLayout
│   └── financial/ resumo, gráficos e linha de conta
├── pages/         uma por tela
└── styles/        tokens.css (cores, raios e sombras do DESIGN.md)
server/
├── migrations/    tabelas do banco (Postgres), com as regras de acesso por empresa
└── src/           servidor Fastify: conta, dados do negócio e o site (dist/)
```

- Visual: segue o [DESIGN.md](docs/DESIGN.md) e a [imagem de referência](docs/telas-referencia.png). Cores só pelos tokens de `src/styles/tokens.css`; degradês em `grad-primario` e `grad-navy` (`src/index.css`).
- Avisos: `alertas()` em `src/domain/calc.ts` segue a tabela "Alertas" do planejamento. Os marcados `painel` aparecem
  no Início; todos aparecem no sino. O id traz o mês ou a conta, então dispensar um aviso não esconde o do mês seguinte.
- Movimento: as curvas e animações ficam em `src/index.css` (`anim-*`) e somem para quem pede menos movimento no sistema.
  Números contam até o valor (`ValorAnimado`) e os principais têm um "?" (`Explica`) com o que são e a conta do mês.
- Regras: o painel usa regime de caixa (data de pagamento); o faturamento do MEI usa a data da venda.
- Limite do MEI e valor do DAS ficam em `src/domain/parametros.ts`, por ano. **Confirmar os valores de 2026 e 2027.**
- Dinheiro sempre em **centavos inteiros** (`Centavos`). `brl()` formata e `lerValor()` lê o que a pessoa digitou.
- Todo registro tem `empresaId`, para o banco separar os negócios quando vier o login.
- Contas fixas: a regra fica em `Recorrencia` e `src/domain/recorrencia.ts` gera as contas previstas até o fim do
  mês seguinte, sem duplicar (uma por regra e mês). A regra diz o que fazer se vencer no sábado ou domingo
  (manter, antecipar para sexta ou adiar para segunda; feriados ainda não entram) e se o valor varia (luz, água):
  nesse caso a tela mostra "cerca de" e pede o valor real ao pagar.
- O CSV do extrato sai no formato do Excel brasileiro (separador `;`, vírgula decimal, UTF-8 com BOM), via papaparse.
- Ideias vindas do Firefly III foram reescritas do zero: o código do Firefly é AGPL e não é copiado aqui.

## Próximos passos

- Contratar a VPS e o domínio e instalar seguindo [docs/INSTALAR.md](docs/INSTALAR.md).
- Recuperar a senha por e-mail (precisa de um serviço de envio de e-mail).
- Lembretes por e-mail e, depois, WhatsApp.
