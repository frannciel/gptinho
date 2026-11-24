# Contatos, calendário e tarefas

## Entrega

Rotas privadas: `/contatos`, `/tarefas` e `/calendario`. Todas as páginas, consultas de vínculos e Server Actions exigem administrador ativo. O financeiro permanece fora desta entrega.

## Contatos

Cadastro independente com nome, cargo/função, telefone e e-mail opcionais e organização opcional, pesquisável entre órgãos e fornecedores. E-mail preenchido continua único no sistema, normalizado em minúsculas; vários contatos podem não ter e-mail. Lista paginada de 20 registros, pesquisa por nome/e-mail/telefone/cargo, filtro de organização ou sem vínculo, ordenação decrescente de criação.

As telas de organizações usam os mesmos registros e conservam seus IDs. Remover uma pessoa da lista da organização apenas desvincula o contato. Excluir uma organização também preserva os contatos, sem vínculo. A exclusão definitiva de uma pessoa ocorre na tela Contatos, com confirmação, e é bloqueada quando houver tarefas associadas. Edições independentes atualizam a versão da organização para invalidar formulários antigos. Operações são transacionais e auditadas.

A migration preserva todas as pessoas existentes. Os novos campos de criação/atualização dos contatos legados recebem a data da migration, pois o modelo anterior não registrava essas datas. A edição embutida admite até 1.000 contatos por submissão; a gestão independente permite consultar e editar sem carregar toda a lista na tela.

## Tarefas e compromissos

Título e data/prazo obrigatórios; descrição, responsável e vínculos opcionais a organização, contato, contratação e contrato. Responsável selecionado entre administradores ativos. Prioridades baixa, normal e alta. Situações pendente, em andamento, concluída e cancelada. Atraso é calculado pelo prazo e situação, sem acrescentar um estado editável.

Cadastro, edição, exclusão confirmada, busca, filtros de situação/atraso e paginação. Controle de versão evita sobrescrever edições concorrentes e a auditoria conserva as alterações.

Compromissos manuais são tarefas e têm data de dia inteiro nesta entrega. Não há recorrência nem agendamento de horário para tarefas.

## Calendário

Visualização mensal no desktop; lista disponível em todas as telas e usada no celular. Filtros de mês, tipo, organização e situação (todos, pendentes, vencidos ou alertas não lidos). Ao clicar, abre o cadastro de origem.

| Evento               | Fonte da data                                      | Regra de pendência                                                     |
| -------------------- | -------------------------------------------------- | ---------------------------------------------------------------------- |
| Sessão / proposta    | Prazo de apresentação da contratação               | Em Análise ou Proposta Cadastrada; arquivadas ficam fora do calendário |
| Entrega              | Prazo do Pedido                                    | Não cancelado e com quantidade ainda não fornecida                     |
| Fim da vigência      | Período vigente calculado pelas regras contratuais | Contrato não encerrado/cancelado                                       |
| Garantia             | Vencimento cadastrado                              | Garantia ativa e contrato não encerrado/cancelado                      |
| Tarefa / compromisso | Data/prazo da tarefa                               | Pendente ou em andamento                                               |

A sessão e a apresentação usam o campo já existente, conforme a regra vigente do sistema. Eventos automáticos não são cópias persistidas: alterar datas de origem, concluir fornecimento, prorrogar ou renovar o contrato atualiza a consulta. Contratos usam a mesma reconstrução de vigência da tela de detalhe; atos cancelados são ignorados. Eventos finalizados continuam consultáveis pelo filtro Todos, sem destaque de prazo vencido.

Prazos de dia inteiro são preservados sem conversão de fuso. Horários de sessão são exibidos em America/Sao_Paulo. O filtro de organização das tarefas usa o vínculo explicitamente cadastrado na própria tarefa.

O dashboard apresenta pendências vencidas e compromissos de hoje e dos próximos seis dias, até cinco eventos em cada coluna. A consulta limita cada tipo de evento operacional/tarefa a 1.000 registros por intervalo, com aviso quando excedido; contratos são selecionados pelas datas candidatas e conferidos pela vigência efetiva. Índices de prazo auxiliam essas consultas. O resumo consulta passado e próximos dias separadamente para que o histórico não oculte eventos futuros.

## Alertas internos

Cada usuário pode marcar um alerta como lido. Isso não muda situação, vencimento, fornecimento ou vigência. A chave inclui a origem e a data: mover um prazo cria outro alerta não lido. Não há envio externo, e-mail, SMS, push, integração com agenda externa ou tarefas automáticas em segundo plano.

## Implantação e validação

1. Fazer backup e aplicar primeiro em homologação a migration `202611240001_contacts_calendar_tasks` com `npm run db:migrate`.
2. Regenerar Prisma com `npm run db:generate` durante a instalação/build.
3. Validar contato com e sem organização, e-mail duplicado, desvinculação, tarefa relacionada, alerta lido, pedido fornecido e contrato prorrogado/renovado.
4. Publicar a versão da aplicação conforme o fluxo de implantação aprovado. A entrega de código não aplica a migration no Neon nem publica produção.

Não há novas variáveis de ambiente. Usam-se as credenciais de banco e autenticação já existentes. Para rollback, voltar a aplicação para a versão anterior após avaliar os contatos sem organização e os novos vínculos; não remover as tabelas para retornar o código. A versão anterior recriava contatos em cada edição de organização e não é compatível com novos vínculos de tarefas: suspender essas edições ou corrigir a versão antes de liberar o rollback. Não converter o vínculo em obrigatório enquanto existirem pessoas independentes.

Testes abrangem normalização/validação, datas em Brasília, autenticação das operações, migração com pessoas legadas, concorrência, preservação de IDs/vínculos, alertas individuais, prorrogação/renovação, fornecimento completo e fluxo web responsivo.

## Verificação desta entrega

TypeScript, lint, formatação e build de produção passaram. Foram executados 179 testes unitários, 127 de integração em PostgreSQL local e 19 cenários de navegador. Os testes incluem telefones adicionais, WhatsApp, preservação de dados, endereço do órgão e alternância Mensal/Lista com conservação da visualização ao limpar filtros.

A cadeia de migrations foi validada executando seu SQL em um schema isolado do PostgreSQL de testes, inclusive com um contato legado antes da nova migration. O motor de schema do Prisma não pôde ser baixado neste ambiente (HTTP 403 em binaries.prisma.sh); por isso, a aplicação local da migration usou SQL transacional. O cliente Prisma foi gerado e utilizado nos testes. Não houve conexão nem aplicação de migrations no Neon nesta entrega.

## Ajustes de telefones, endereço e visualização

Contatos aceitam até 20 telefones, cada um com indicação opcional de WhatsApp. Os números são normalizados e não podem se repetir dentro do mesmo contato. A listagem apresenta todos os números e o link `wa.me` apenas nos marcados como WhatsApp; para números brasileiros sem prefixo internacional, o link acrescenta o código 55. Abrir o link é uma ação do usuário; o sistema não envia mensagens.

Observações e Perfil no LinkedIn são opcionais. Perfis aceitam HTTPS no domínio LinkedIn, no caminho `/in/`. A edição embutida nas organizações preserva os telefones adicionais, as indicações de WhatsApp, as observações e o LinkedIn. O link Telefones e detalhes leva ao cadastro completo do contato. Alterar o número principal não presume que o novo número também tenha WhatsApp.

A migration `202611240002_contact_phones_profile` adiciona os novos campos e migra o telefone existente como primeiro número, com WhatsApp desmarcado. O campo anterior permanece como representação do primeiro número para compatibilidade. As alterações são auditadas e continuam sujeitas a controle de versão.

Órgãos públicos exibem o mesmo bloco de endereço dos fornecedores, com CEP, cidade, UF e endereço separados, utilizando os campos já existentes no banco. Não há consulta externa automática de CEP.

O calendário oferece botões Mensal e Lista fora do formulário de filtros. A mudança de visualização conserva os filtros; Filtrar e Limpar conservam a visualização escolhida. Em celular, o conteúdo permanece em lista para facilitar a leitura.

Para disponibilizar este ajuste, aplicar a nova migration em homologação com `npm run db:migrate`, validar os telefones legados e então seguir o procedimento de deploy aprovado. Não há novas variáveis de ambiente.
