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

## Entrega atual — padronização de valores e apresentação, para validação

1. Recálculo do valor atualizado sempre que o original é editado, reaplicando os documentos e preservando os preços e valores históricos dos Pedidos/notas.
2. Quantidades novas inteiras e apresentação sem casas decimais; preservação de frações legadas sem arredondamento silencioso.
3. Destaques de status de Pedidos e Notas Fiscais com badge, cor, borda, ícone e texto.
4. Aditivos registram novos preços unitários absolutos, com Variação para todos (%) apenas como auxílio de preenchimento.
5. Data do aditivo renomeada para Data de Assinatura.
6. Cabeçalho Valor Atualizado do Contrato: zero/vazio calcula o total dos itens; valor positivo representa o total absoluto.
7. Migração compatível com aditivos e apostilamentos anteriores, preservando quantidades e saldos financeiros.

Regras, limites e implantação: [CONTRATOS.md](CONTRATOS.md).

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
