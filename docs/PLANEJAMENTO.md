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

## Padronização de valores e apresentação — entrega anterior

1. Recálculo do valor atualizado sempre que o original é editado, reaplicando os documentos e preservando os preços e valores históricos dos Pedidos/notas.
2. Quantidades novas inteiras e apresentação sem casas decimais; preservação de frações legadas sem arredondamento silencioso.
3. Destaques de status de Pedidos e Notas Fiscais com badge, cor, borda, ícone e texto.
4. Aditivos registram novos preços unitários absolutos, com Variação para todos (%) apenas como auxílio de preenchimento.
5. Data do aditivo renomeada para Data de Assinatura.
6. Cabeçalho Valor Atualizado do Contrato: zero/vazio calcula o total dos itens; valor positivo representa o total absoluto.
7. Migração compatível com aditivos e apostilamentos anteriores, preservando quantidades e saldos financeiros.

Regras, limites e implantação: [CONTRATOS.md](CONTRATOS.md).

## Entrega atual — Contatos, Calendário e tarefas

1. Tela independente de Contatos, com vínculo opcional à organização, pesquisa, filtros e exclusão protegida.
2. Preservação dos IDs e contatos desvinculados, mantendo as relações com tarefas.
3. Tarefas e compromissos com responsáveis, prioridade, prazo e vínculos opcionais.
4. Calendário mensal/lista com sessões, propostas, Pedidos, vigências efetivas, garantias e tarefas.
5. Alertas internos individuais e resumo de prazos no dashboard.
6. Migration sem apagar pessoas existentes, índices, auditoria, controle de versão e testes.

Detalhes e implantação: [CONTATOS_AGENDA.md](CONTATOS_AGENDA.md). Aguardando validação do usuário em homologação; nenhuma publicação em produção faz parte desta implementação.

## Escopo confirmado do MVP

**Não haverá gestão de cotações no sistema.** O agente de IA não será conectado ao ERP. Toda comunicação usa arquivos manipulados pelo usuário. A proposta comercial é elaborada externamente a partir dos dados exportados.

Esta entrega não inclui emissão fiscal, XML/NF-e, gestão documental, execução orçamentária do órgão ou integrações automáticas.

## Ordem dos próximos passos

1. Aplicar a migration de Contatos/Agenda em homologação e validar contatos independentes, tarefas, prazos, alertas e alterações de vigência.
2. Revisar cadastros legados indicados como incompletos; conferir origem e valores antes de iniciar execução.
3. Concluir a validação dos arquivos de importação e do modelo de proposta com dados reais.
4. Corrigir os apontamentos dessa validação antes de ampliar o sistema.
5. Próxima etapa: definir o escopo financeiro com o usuário (custos realizados, despesas/contas a pagar, estornos, conciliação e relatórios). A parte financeira foi expressamente adiada nesta entrega.
6. Após aprovação, realizar o procedimento autorizado de publicação. Esta implementação não publica produção nem altera o Neon automaticamente.

### Ajustes solicitados — Contatos, Órgãos e Calendário

- Múltiplos telefones por contato com indicação e link individual de WhatsApp.
- Observações e perfil no LinkedIn opcionais.
- Preservação dos telefones adicionais ao editar organizações.
- Bloco de endereço dos órgãos públicos no mesmo padrão dos fornecedores.
- Botões Mensal/Lista separados dos filtros do calendário.
- Nova migration de telefones/perfil; financeiro permanece para a próxima etapa.
