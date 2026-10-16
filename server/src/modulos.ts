// Catálogo de módulos que o servidor conhece. Cópia de MODULOS em src/domain/planos.ts (a imagem
// do servidor não leva a pasta src); o teste admin.test confere que as duas listas batem.
export const MODULOS_SERVIDOR = [
  { id: 'financeiro', nome: 'Financeiro', descricao: 'Painel, lançamentos, contas a pagar e a receber, relatórios, fluxo de caixa e fechamento do mês.', pronto: true, base: true },
  { id: 'mei', nome: 'Meu MEI', descricao: 'Limite anual do MEI e controle do DAS.', pronto: true },
  { id: 'agenda', nome: 'Agenda', descricao: 'Atendimentos com clientes e contas no calendário.', pronto: true },
  { id: 'extrato', nome: 'Importar extrato', descricao: 'Traz o extrato do banco (OFX ou CSV) e dá baixa nas contas.', pronto: true },
  { id: 'comprovantes', nome: 'Comprovantes', descricao: 'Anexar foto ou PDF do comprovante em cada pagamento.', pronto: true },
  { id: 'estoque', nome: 'Estoque', descricao: 'Produtos, entradas e saídas de estoque.', pronto: false },
  { id: 'clientes', nome: 'Clientes e fornecedores', descricao: 'Ficha de cada cliente e fornecedor, com quanto você ganhou e gastou com cada um.', pronto: true },
  { id: 'nota', nome: 'Nota fiscal', descricao: 'Emissão de nota fiscal pelo sistema.', pronto: false },
  { id: 'pix', nome: 'Pix integrado', descricao: 'Cobrança por Pix com baixa automática.', pronto: false },
]
