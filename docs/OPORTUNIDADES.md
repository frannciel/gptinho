# Módulo de oportunidades

## Escopo entregue

A carteira de oportunidades inicia o fluxo comercial vinculado aos órgãos públicos. Não representa ainda o módulo completo de licitações, itens/lotes, cotações, precificação, propostas, contratos ou financeiro.

Rotas: `/oportunidades`, `/oportunidades/nova`, `/oportunidades/:id` e `/oportunidades/:id/editar`. O menu lateral e o dashboard dão acesso ao módulo. A consulta JSON protegida está em `GET /api/admin/oportunidades`; a escrita usa Server Actions com autorização de administrador.

## Cadastro e acompanhamento

- Identificação obrigatória, única no sistema, normalizada para maiúsculas; exemplo `OP-2026-001`.
- Órgão público obrigatório, objeto, modalidade, número do processo, valor estimado, prazo de apresentação, situação, link da fonte/edital e observações.
- Apenas órgãos públicos ativos podem receber novos vínculos. Um vínculo existente com órgão posteriormente desativado é preservado e pode continuar sendo editado, com aviso na interface.
- Modalidades: a definir, pregão eletrônico/presencial, dispensa eletrônica, dispensa de licitação, inexigibilidade, concorrência e outra modalidade.
- Situações: rascunho, aberta, em análise, em cotação, em elaboração de proposta, encerrada e cancelada. Nesta entrega elas são atualizadas manualmente e registradas na auditoria. Não criam cotações/propostas automaticamente nem declaram vitória/perda de itens.
- Mesmo órgão e processo em outra oportunidade geram aviso no detalhe para conferência, sem mesclar registros nem impedir processos legítimos com escopos diferentes. Só a identificação é única.
- Links devem ser HTTPS e não podem conter usuário/senha. São referências externas, sem consulta ou integração automática com portais.

Busca por identificação, objeto, processo, nome ou sigla do órgão; filtros por órgão, situação, prazo e arquivamento; ordenação por prazo, data de cadastro, valor ou identificação; paginação de 20 registros. Os filtros de prazo da tabela são independentes da situação selecionada, permitindo consultar prazos de registros encerrados também.

## Valores, datas e indicadores

O valor estimado usa PostgreSQL `numeric(18,2)` e `Prisma.Decimal`. A entrada aceita reais no formato brasileiro ou decimal canônico e rejeita valores negativos, mais de duas casas ou mais de 16 dígitos inteiros. Nenhuma conversão para ponto flutuante é usada para persistir, somar ou exibir valores recebidos como strings.

Ausência de valor permanece `NULL`, diferente de zero. A API transmite decimais como strings. A interface apresenta `Não informado` quando o valor ou o prazo ainda são desconhecidos. O valor estimado não é receita, valor contratado, faturamento ou saldo a receber.

O prazo é informado em **Brasília, UTC−3**, mesmo se o navegador ou servidor usar outro fuso. É persistido como `timestamptz`. Datas de calendário inválidas são recusadas. Prazos passados são permitidos para registrar e revisar demandas existentes; geram alerta, sem bloquear cadastro/edição.

Os indicadores do dashboard e da carteira incluem somente oportunidades **não arquivadas** nas situações aberta, em análise, em cotação ou em elaboração de proposta:

- Quantidade em acompanhamento.
- Quantidade com prazo anterior ao momento da consulta.
- Quantidade com prazo entre o momento da consulta e os próximos sete dias.
- Soma decimal dos valores informados, com contagem dos registros que têm valor.

Rascunhos, encerradas e canceladas não entram nesses indicadores. O dashboard mostra até cinco prazos mais próximos nos próximos sete dias. Os números são consultados no PostgreSQL, sem valores fictícios. As estatísticas são gerais; os filtros afetam a tabela. Não há rotina de notificações externas.

## Histórico e integridade

Cadastro, alterações de situação/dados, arquivamento e restauração gravam auditoria na mesma transação que a operação. O detalhe mostra as dez últimas alterações com autor e horário. O histórico completo permanece no banco.

A edição usa versão inteira para impedir sobrescrita silenciosa. Arquivadas ficam fora da carteira padrão e dos indicadores; precisam ser restauradas antes de editar. Arquivar não muda a situação comercial e não apaga o registro.

Não há exclusão definitiva de oportunidades nesta entrega. Órgãos com oportunidades, inclusive arquivadas, não podem ser excluídos nem perder o papel de órgão público; podem ser desativados. Chave estrangeira restritiva e locks transacionais protegem os vínculos, inclusive quando duas operações ocorrem simultaneamente.

## Migration e implantação

Migration nova: `20261119000200_opportunities`. Cria enums, tabela, índices e restrições; não apaga nem altera os cadastros existentes. Não precisa de novas variáveis de ambiente.

Com a branch atualizada localmente e as conexões Neon corretas no `.env`:

```bash
npm ci
npm run db:migrate
npx prisma migrate status
```

Aplique a migration com sucesso **antes de incorporar a branch à main e atualizar a Vercel**: o código novo consulta a tabela Opportunity inclusive no dashboard. O código anterior continua compatível durante essa preparação. Não execute seed, reset ou alterações destrutivas para instalar este módulo.

Após o deploy, valide login, cadastro vinculado a um órgão, edição, busca/filtros, prazo e valor persistidos, atualização do dashboard, arquivamento e restauração. Confirme também o redirecionamento ao login quando não há sessão. Em rollback de código, a tabela nova pode permanecer; não remova oportunidades reais para reverter a interface.

## Validação executada

- TypeScript, lint, formatação e build de produção.
- **68 testes unitários**, incluindo 30 testes novos de valores decimais, horários, enums, URLs e validação de entrada.
- **28 testes em PostgreSQL real**, incluindo 12 testes novos de CRUD/auditoria, precisão, filtros/paginação, concorrência, arquivamento, indicadores, integridade dos órgãos e restrições do banco.
- **7 testes E2E no Chromium**, incluindo os fluxos de oportunidades no desktop e no celular, API autenticada e recusas 401/403, sessão revogada e tentativa de repetir uma Server Action sem autenticação.
- Migration aplicada no PostgreSQL 17 local isolado; segunda aplicação sem migrations pendentes.

Total: **103 testes passaram**. Nenhuma migration foi aplicada ao Neon da aplicação e nenhum deploy de produção foi realizado nesta execução. O cliente Prisma e as migrations locais foram validados com os geradores oficiais JavaScript/WASM, preservando integridade/TLS, como no incremento anterior; a CLI nativa continua dependendo do acesso a `binaries.prisma.sh` neste ambiente.

A próxima etapa recomendada, após validação publicada deste módulo, é a cotação com fornecedores vinculada à oportunidade. Itens de catálogo, precificação e propostas devem ser introduzidos por incrementos próprios, preservando estes vínculos e o uso de valores decimais.
