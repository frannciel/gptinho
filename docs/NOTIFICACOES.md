# Central de notificações

## Entrega e canais

O sino na barra superior apresenta a contagem individual de avisos não lidos, os cinco mais recentes e acesso à central `/notificacoes`. A central possui histórico paginado, filtros por tipo, situação, leitura e período, ações de marcar como lida/não lida e marcar todas como lidas. As páginas e APIs exigem administrador ativo.

No MVP, o canal ativo é o próprio sistema. E-mail e WhatsApp estão globalmente desativados: nenhum envio externo é executado. A estrutura inclui tipos de canal, preferências/destino/consentimento por usuário, contrato de adaptador de provedor e registros de entrega com estado, tentativas, próxima tentativa, bloqueio de processamento e identificador do provedor. Destinos externos ficam vazios, as preferências ficam desativadas e as entregas ficam DISABLED. Não há cópia automática de telefones dos contatos.

Para ativar envios em outra etapa será necessário implementar/configurar o adaptador do provedor, obter os destinos e consentimentos, habilitar as preferências e o canal global e adicionar o processamento das entregas. Nenhum endereço, telefone de destino ou credencial de provedor é inventado nesta entrega. Credenciais futuras devem ficar no ambiente.

## Matriz aprovada

| Evento                                    | Antecedência              | Na data / horário     | Após o prazo                                         |
| ----------------------------------------- | ------------------------- | --------------------- | ---------------------------------------------------- |
| Sessão pública / apresentação da proposta | 1 dia, 1 hora, 15 minutos | Alerta de início      | Sem repetição de atraso                              |
| Entrega de pedido                         | 7, 3 e 1 dia              | Aviso do prazo        | Diário enquanto houver quantidade pendente           |
| Fim da vigência do contrato               | 90, 30 e 7 dias           | Aviso de encerramento | Indicação mantida enquanto a obrigação estiver ativa |
| Fim da validade da ata                    | 30 e 7 dias               | Aviso de encerramento | Indicação mantida de ata vencida                     |
| Garantia contratual                       | 30, 7 e 1 dia             | Aviso do vencimento   | Indicação mantida enquanto ativa                     |
| Tarefa / compromisso                      | 7 e 1 dia                 | Aviso do prazo        | Diário enquanto pendente ou em andamento             |

Sessão pública e apresentação da proposta são um único evento, baseado no campo existente de prazo de apresentação. Não há criação de outra data nem duplicação de avisos.

Datas de dia inteiro geram avisos às 8h de Brasília. Sessões usam o instante cadastrado. Todas as apresentações de horário usam America/Sao_Paulo. A vigência dos contratos é obtida pela mesma reconstrução utilizada na tela contratual, incluindo prorrogações e renovações.

Os avisos são destinados a todos os administradores ativos, incluindo o responsável por uma tarefa quando for administrador. A leitura é individual. Usuários sem perfil administrador não recebem acesso à central. A seleção exclusiva de destinatários por responsabilidade será uma evolução das preferências.

## Alertas de sessão

Com a aplicação aberta, um aviso destacado aparece nos quinze minutos anteriores à sessão e outro no início. O aviso de início permanece disponível por até dez minutos. Fechar o aviso dos quinze minutos não fecha o aviso de início: são registros distintos. O relógio da interface é ajustado pelo horário retornado pelo servidor e os marcos futuros já planejados permitem a exibição no horário, sem esperar uma nova execução do cron.

A barra consulta o servidor a cada trinta segundos e ao retornar à aba. Os alertas são visuais dentro da aplicação; não são push do navegador, som, notificação do sistema operacional ou mensagens externas. Com o navegador fechado, os registros continuam sendo planejados pelo agendamento configurado e serão consultáveis no próximo acesso.

## Regras e persistência

- `NotificationEvent`: origem, vencimento, revisão e atividade da obrigação.
- `Notification`: destinatário, tipo, marco, conteúdo, data de disponibilidade, leitura, fechamento do alerta e resolução/cancelamento.
- `NotificationDelivery`: estrutura de entregas externas e processamento futuro, desativada no MVP.
- `NotificationPreference`: destino e consentimento futuros por usuário/canal, desativados por padrão.
- `NotificationSyncState`: controle da última sincronização.

Uma chave única por destinatário/origem/revisão/marco impede duplicações. Um bloqueio transacional no PostgreSQL impede execuções concorrentes do gerador. As consultas das origens usam lotes com cursor, sem truncar silenciosamente o conjunto de prazos. A operação é atômica; falhas não confirmam planejamento parcial.

O primeiro processamento cria apenas o aviso correspondente à condição atual e os próximos marcos. Não cria uma sequência de avisos retroativos de 90, 30 e 7 dias para um cadastro incluído já perto do vencimento. Avisos futuros ficam planejados, fora do contador e da listagem até a data de disponibilidade. Isso permite acompanhar prazos sem manter um processo Node.js contínuo na Vercel.

Mudar a data cancela a revisão antiga e prepara uma nova sequência. Concluir, cancelar ou remover uma obrigação resolve os avisos em acompanhamento. Arquivar uma contratação encerra seus avisos de sessão e atas. Tarefas abertas e pedidos ainda pendentes continuam sujeitos à sua própria situação. Reabrir uma obrigação prepara uma nova revisão. Ler ou fechar um alerta não altera a origem.

O histórico mantém avisos que chegaram a ficar disponíveis, com a leitura separada da resolução. Marcos futuros cancelados antes da disponibilidade não aparecem como avisos entregues. O registro EventRead usado no calendário permanece independente: a leitura de um evento de calendário não equivale à leitura de todos os marcos da central.

Mudanças nas origens são reconciliadas no próximo ciclo. A sincronização pela interface tem intervalo mínimo global de trinta segundos; o cron deve executar a cada minuto.

## Agendamento com a aplicação fechada

O endpoint `GET /api/cron/notificacoes` (também aceita POST) executa o gerador sem sessão de usuário. Exige o header `Authorization: Bearer <CRON_SECRET>` e um segredo de pelo menos 32 caracteres. Não aceita segredo na URL. A resposta contém apenas contagens e informação de execução, sem dados de destinatários.

1. Gerar um segredo aleatório exclusivo, por exemplo com `openssl rand -base64 48`.
2. Configurar `CRON_SECRET` no ambiente do projeto de homologação e, quando autorizado, de produção.
3. Configurar um agendador HTTP para chamar `https://SEU-DOMINIO/api/cron/notificacoes` a cada minuto com o header acima.
4. Conferir resposta 200 e funcionamento da central. Resposta 503 por agendamento não configurado indica segredo ausente ou curto; 401 indica credencial inválida.
5. Monitorar execuções com falha e repetir a chamada após a correção; o processamento é idempotente.

Pode ser usado um agendador HTTP externo, inclusive quando o plano da Vercel não oferece cron a cada minuto. Há um exemplo de configuração em [cron/vercel-pro.example.json](cron/vercel-pro.example.json), para planos que aceitem essa frequência: integrar o bloco `crons` ao `vercel.json` do projeto. A Vercel envia o CRON_SECRET configurado na autorização. O exemplo não é ativado automaticamente para evitar impor um cron incompatível com o plano do projeto.

O sistema também sincroniza ao consultar a central ou a barra, mas isso não substitui o agendamento para operar sem usuários conectados. O código foi preparado; configurar o agendador no serviço de hospedagem faz parte da implantação e não foi executado nesta entrega.

Para processamento operacional em um servidor com acesso ao banco, existe `npm run notifications:sync`, com DATABASE_URL no ambiente. O comando mostra somente as contagens e não envia mensagens externas.

## Implantação e rollback

Aplicar a migration `202611250002_notifications` primeiro em homologação com `npm run db:migrate`, gerar o cliente Prisma durante a instalação e executar build. A migration acrescenta estruturas sem apagar ou transformar as obrigações existentes.

Configurar o segredo e o agendamento conforme acima, validar os seis tipos de prazo, leitura por dois administradores, alteração de data, conclusão, arquivamento e os dois alertas de sessão. Conferir que EMAIL/WHATSAPP permanecem DISABLED.

Não houve aplicação de migration no Neon, publicação em produção, contratação de provedor nem envio de e-mail/WhatsApp nesta implementação. Em rollback, suspender o agendamento antes de voltar a uma versão sem o endpoint. Manter as tabelas e o histórico no banco; não executar remoção destrutiva de dados.

## Validação desta entrega

TypeScript, lint, formatação e build de produção passaram. Foram executados 200 testes unitários, 150 de integração em PostgreSQL local e 21 cenários de navegador. A suíte verifica a matriz, geração idempotente, concorrência, leitura individual, propriedade do destinatário, fechamento independente dos alertas de quinze minutos/início, vigência após prorrogação, arquivamento, fornecimento completo, mudança de prazo, histórico, reabertura, atraso diário e canais externos desativados.

O teste de migration aplica a cadeia completa sobre um schema isolado com usuário e tarefa legados e confirma a preservação dos dados. O fluxo no navegador verifica o alerta no horário de início com registros reais do banco, o contador, leitura, filtros, ações e apresentação em celular. A validação da origem das mutações cobre o host público atrás do endereço interno do Next.js e rejeita origens externas.
