# Planejamento atualizado do Govnex ERP

## Base entregue e aprovada anteriormente

- Fundação, autenticação e autorização, Neon/Prisma, layout e administração.
- Órgãos, fornecedores, contatos e dados da empresa.
- Contratações, catálogo, itens, arquivamento e exclusão protegida.
- Precificação, ofertas vencedoras e resumo financeiro.
- Preservação do fornecedor histórico em contratações abertas e arquivadas.

## Entrega atual — arquivos, para validação do usuário

1. Contratos JSON 1.0, exemplos e JSON Schema para catálogo e itens de contratação.
2. Importação em lote com complementos comerciais, prévia, confirmação, transação, auditoria e proteção contra repetição.
3. Vínculo de catálogo por lote/código, sem exigir IDs internos do agente.
4. Exportação privada de dados de proposta em JSON ou Markdown, com campos comerciais públicos necessários e sem custos internos.
5. Instruções para o agente extrator e para a elaboração externa da proposta.

## Escopo confirmado do MVP

**Não haverá gestão de cotações no sistema.** Essa etapa foi removida do MVP e não é pré-requisito para esta entrega.

O agente de IA não será conectado ao ERP. Importação e exportação usam arquivos entregues manualmente pelo usuário. A exportação do MVP se limita aos dados de apoio à proposta comercial; não é backup geral, exportação financeira ou API de integração com o agente. O documento da proposta será preparado externamente conforme o modelo fornecido.

## Sequência recomendada

Validar os formatos com um termo de referência real e o modelo de proposta, testar a carga em lote e o documento gerado pelo agente. Depois, definir prioridade e escopo de contratos/empenhos, pedidos/fornecimentos e faturamento/recebimentos, já previstos no planejamento anterior. Indicadores e relatórios evoluem conforme esses módulos forem implementados.
