# Gynfinance

Gestão financeira simples para MEIs e pequenos negócios. Por [KodeMI](https://kodemi.pt).

Responde todo mês: **quanto entrou, quanto saiu, quanto sobrou para o negócio e quanto dá para tirar para você.**

## Rodar

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # regras de cálculo
npm run build    # gera dist/, que roda em qualquer hospedagem estática
```

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

O app abre em **modo demonstração** com a "Doces da Ana" vista em 15/10/2026. Os dados ficam no navegador
(localStorage). Em Configurações, Assinatura, dá para restaurar os dados de exemplo antes de uma apresentação.

## Organização

```text
src/
├── domain/        tipos, parâmetros do MEI por ano e regras de cálculo (testadas)
├── data/          estado do app, categorias padrão e dados de demonstração
├── components/
│   ├── ui/        Button, Card, Badge, Field, Tabs, Modal e Toast
│   ├── layout/    Sidebar, Header, MobileNavigation, MainLayout
│   └── financial/ resumo, gráficos e linha de conta
├── pages/         uma por tela
└── styles/        tokens.css (cores, raios e sombras do DESIGN.md)
```

- Visual: segue o [DESIGN.md](docs/DESIGN.md). Cores só pelos tokens de `src/styles/tokens.css`.
- Regras: o painel usa regime de caixa (data de pagamento); o faturamento do MEI usa a data da venda.
- Limite do MEI e valor do DAS ficam em `src/domain/parametros.ts`, por ano. **Confirmar os valores de 2026 e 2027.**

## Próximos passos

- Login e banco de dados (as ações em `src/data/store.tsx` são o contrato para o back-end).
- Configuração inicial do negócio (primeiro acesso).
- Lembretes por e-mail e, depois, WhatsApp.
