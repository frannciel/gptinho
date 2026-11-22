# Planejamento atualizado do Govnex ERP

## Base entregue e aprovada anteriormente

- Fundação, autenticação e autorização, Neon/Prisma, layout e administração.
- Órgãos, fornecedores, contatos e dados da empresa.
- Contratações, catálogo, itens, arquivamento e exclusão protegida.
- Precificação, ofertas vencedoras e resumo financeiro.
- Preservação do fornecedor histórico em contratações abertas e arquivadas.

## Arquivos — implementação concluída

1. JSON 1.0, exemplos e JSON Schema para catálogo e itens de contratação.
2. Importação em lote com complementos comerciais, prévia, confirmação, transação, auditoria e proteção contra repetição.
3. Vínculo de catálogo por lote/código, sem exigir IDs internos do agente.
4. Exportação privada de dados de proposta em JSON ou Markdown, sem custos internos.
5. Instruções para extração e elaboração externa da proposta.

## Entrega atual — simplificação de Contratos, para validação

1. Listagem de Termos e Empenhos substitutivos independentes; retirada do agrupamento Negócio comercial e do vínculo entre novos instrumentos.
2. Assinatura no Termo, sem Data do instrumento genérica; emissão no Empenho substitutivo.
3. Pedidos com número/emissão do empenho opcionais; preenchimento automático no caso substitutivo.
4. Início automático de execução ao cadastrar Pedido válido, com auditoria e proteção de contratos encerrados/cancelados.
5. Conferência exata entre valor informado e soma dos itens, com alerta de divergência em ambos os tipos, sem impedir cadastros incompletos.
6. Link de publicação com ajuda PNCP/Diários Oficiais e padronização de Link do diretório ou documento em todo o módulo.
7. Chave de Acesso alfanumérica opcional na nota fiscal.
8. Preservação das funções de fornecimento parcial, faturamento, recebimentos, garantias e aditivos.
9. Migração segura dos dados anteriores, mantendo vínculos financeiros e sinalizando agrupamentos legados que exigem revisão.

Detalhes, diagrama e migração: [CONTRATOS.md](CONTRATOS.md).

## Escopo confirmado do MVP

**Não haverá gestão de cotações no sistema.** O agente de IA não será conectado ao ERP. Toda comunicação usa arquivos manipulados pelo usuário. A proposta comercial é elaborada externamente a partir dos dados exportados.

Esta entrega não inclui emissão fiscal, XML/NF-e, gestão documental, execução orçamentária do órgão ou integrações automáticas.

## Ordem dos próximos passos

1. Aplicar a nova migration em homologação e validar Termo, Empenho substitutivo independente, dados do empenho no Pedido, conferência de valores, pedido parcial, nota parcial, recebimento e aditivo com documentos reais.
2. Revisar cadastros legados indicados como incompletos; conferir origem e valores antes de iniciar execução.
3. Concluir a validação dos arquivos de importação e do modelo de proposta com dados reais.
4. Corrigir os apontamentos dessa validação antes de ampliar o sistema.
5. Definir com o usuário eventual próxima etapa financeira (despesas/contas a pagar, estornos, conciliação) e relatórios; não foram implementados por antecipação.
6. Após aprovação, realizar o procedimento autorizado de publicação. Esta implementação não publica produção nem altera o Neon automaticamente.
