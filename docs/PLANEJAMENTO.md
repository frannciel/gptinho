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

## Contatos, Calendário e tarefas — entrega anterior

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
5. Validar a gestão de usuários, o próprio perfil, a troca de senha e a navegação pelos submenus. A ampliação financeira está fora do MVP.
6. Após aprovação, realizar o procedimento autorizado de publicação. Esta implementação não publica produção nem altera o Neon automaticamente.

### Ajustes solicitados — Contatos, Órgãos e Calendário

- Múltiplos telefones por contato com indicação e link individual de WhatsApp.
- Observações e perfil no LinkedIn opcionais.
- Preservação dos telefones adicionais ao editar organizações.
- Bloco de endereço dos órgãos públicos no mesmo padrão dos fornecedores.
- Botões Mensal/Lista separados dos filtros do calendário.
- Nova migration de telefones/perfil; financeiro permanece para a próxima etapa.

### Registro de Preços (SRP)

- Indicador SRP na contratação e identificação do gerenciador.
- Guias Registros de preços e Participantes.
- Várias atas por contratação, com itens copiados e histórico preservado.
- Órgãos participantes distintos do gerenciador, sem duplicações.
- Cadastro, edição e exclusão protegida de atas; auditoria e controle de versão.
- Disponível inicialmente igual à quantidade da ata; baixas por contratos, pedidos e adesões ficam para definição posterior.
- Migration e regras em [REGISTRO_PRECOS.md](REGISTRO_PRECOS.md). A ampliação financeira está fora do MVP.

### Central de notificações — matriz aprovada

- Sino na barra superior com contador e leitura individual.
- Central com filtros, histórico e ações de leitura sem alterar a obrigação.
- Sessão pública e apresentação da proposta tratadas como um único evento, com alertas de quinze minutos e início.
- Prazos de Pedidos, vigências efetivas, atas, garantias e tarefas, conforme a matriz em [NOTIFICACOES.md](NOTIFICACOES.md).
- Datas alteradas geram nova sequência; conclusão/arquivamento resolvem avisos; atrasos de entregas e tarefas geram aviso diário.
- Estrutura de canais, preferências e entregas para e-mail/WhatsApp preparada, com envios desativados no MVP.
- Endpoint e exemplo de cron preparados para operar com a aplicação fechada. Ativação depende de CRON_SECRET e de um agendador a cada minuto na implantação.
- Migration apenas aditiva, testada localmente. A ampliação financeira está fora do MVP.

## Entrega atual — Usuários e Agenda operacional

1. Usuários: listar, pesquisar, cadastrar, editar e ativar/desativar, com acesso de administrador para todas as contas gerenciadas.
2. Meu perfil: alterar nome e e-mail; acesso também pela identificação na barra superior.
3. Trocar senha: senha atual, nova senha e confirmação; encerramento das sessões após a troca.
4. Proteção do último administrador ativo, e-mail único, hash seguro, auditoria sem credenciais e versões contra sobrescrita concorrente.
5. Submenu Administração com as três telas de conta e submenu Agenda operacional com Calendário, Tarefas e Notificações. Sino preservado na barra superior.
6. Migration aditiva, testes e procedimento de implantação em [USUARIOS_AGENDA.md](USUARIOS_AGENDA.md).

As funcionalidades solicitadas ficam prontas para validação em homologação. O fechamento do MVP depende dessa validação, dos apontamentos restantes e da configuração operacional das notificações. A ampliação financeira não compõe o MVP.
