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

## Entrega atual — alterações contratuais e renovação, para validação

1. Valor original editável com auditoria e valor atualizado de execução separado e persistido.
2. Campo Continuado e períodos de execução: renovação repõe o quantitativo atualizado completo sem transportar saldo não pedido.
3. Pesquisa remota paginada de contratação de origem e órgão, com preenchimento automático do órgão e carregamento dos itens da origem.
4. Nota fiscal simplificada por Pedido, com valor e dados do documento, sem cadastro operacional de itens.
5. Tipos estruturados de aditivo e regras para Acréscimo, Supressão, Prorrogação, Renovação e Múltiplas Alterações.
6. Tipos legais de garantia em lista.
7. Apostilamento com Reajuste/Repactuação, cálculo bidirecional de preço/percentual e aplicação percentual para todos, persistindo só os novos preços.
8. Exclusões confirmadas e auditadas de Contrato, Pedido, Nota Fiscal, Aditivo e Apostilamento, com alertas de dependentes e proteção de alterações posteriores.
9. Migração expansiva com preservação de notas, recebimentos, itens antigos e documentos anteriores.

Regras, diagrama, limites e implantação: [CONTRATOS.md](CONTRATOS.md).

## Escopo confirmado do MVP

**Não haverá gestão de cotações no sistema.** O agente de IA não será conectado ao ERP. Toda comunicação usa arquivos manipulados pelo usuário. A proposta comercial é elaborada externamente a partir dos dados exportados.

Esta entrega não inclui emissão fiscal, XML/NF-e, gestão documental, execução orçamentária do órgão ou integrações automáticas.

## Ordem dos próximos passos

1. Aplicar a nova migration em homologação e validar os valores original/atualizado, a renovação continuada, os apostilamentos, as buscas, a nota simples por Pedido e as exclusões com documentos reais em homologação.
2. Revisar cadastros legados indicados como incompletos; conferir origem e valores antes de iniciar execução.
3. Concluir a validação dos arquivos de importação e do modelo de proposta com dados reais.
4. Corrigir os apontamentos dessa validação antes de ampliar o sistema.
5. Definir com o usuário eventual próxima etapa financeira (despesas/contas a pagar, estornos, conciliação) e relatórios; não foram implementados por antecipação.
6. Após aprovação, realizar o procedimento autorizado de publicação. Esta implementação não publica produção nem altera o Neon automaticamente.
