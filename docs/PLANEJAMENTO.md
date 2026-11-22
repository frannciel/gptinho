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

## Entrega atual — Contratos e Fornecimento, para validação

1. Escolha de Termo de Contrato ou Nota de Empenho, com atributos específicos.
2. Negócio comercial único para um Termo e seus empenhos ou múltiplos empenhos sem Termo; saldos compartilhados sem duplicar valores.
3. Origem opcional na contratação, órgão herdado e cópia dos itens vencedores; cadastro manual sem licitação.
4. Abas Dados gerais, Pedidos, Notas Fiscais, Garantias e, exclusivamente no Termo, Aditivos.
5. Pedido com prazo e controle direto de quantidade fornecida acumulada; situação e pendência calculadas. **Não há Entrega, evento ou comprovante de Entrega.**
6. Faturamento parcial por item, com pedido opcional, e recebimentos parciais no contexto da nota fiscal.
7. Garantias opcionais e aditivos que preservam originais e snapshots anteriores.
8. Saldos exatos, limites de quantidade/valor, transações, concorrência e auditoria.
9. Dashboard com valores contratados, faturados, recebidos e a receber reais, sem dupla contagem dos instrumentos.
10. Migração expansiva, preservação dos contratos antigos e indicação de complementação cadastral.

Detalhes, diagrama e regras: [CONTRATOS.md](CONTRATOS.md).

## Escopo confirmado do MVP

**Não haverá gestão de cotações no sistema.** O agente de IA não será conectado ao ERP. Toda comunicação usa arquivos manipulados pelo usuário. A proposta comercial é elaborada externamente a partir dos dados exportados.

Esta entrega não inclui emissão fiscal, XML/NF-e, gestão documental, execução orçamentária do órgão ou integrações automáticas.

## Ordem dos próximos passos

1. Aplicar a nova migration em homologação e validar Termo, empenhos relacionados, pedido parcial, nota parcial, recebimento e aditivo com documentos reais.
2. Revisar cadastros legados indicados como incompletos; conferir origem e valores antes de iniciar execução.
3. Concluir a validação dos arquivos de importação e do modelo de proposta com dados reais.
4. Corrigir os apontamentos dessa validação antes de ampliar o sistema.
5. Definir com o usuário eventual próxima etapa financeira (despesas/contas a pagar, estornos, conciliação) e relatórios; não foram implementados por antecipação.
6. Após aprovação, realizar o procedimento autorizado de publicação. Esta implementação não publica produção nem altera o Neon automaticamente.
