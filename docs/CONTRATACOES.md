# Contratações e itens — atualização de 20/11/2026

## Nome e navegação

O módulo antes apresentado como Oportunidades passa a se chamar **Contratações**. As páginas canônicas são `/contratacoes`, `/contratacoes/nova`, `/contratacoes/:id` e `/contratacoes/:id/editar`. As páginas antigas redirecionam para as correspondentes novas. A API de consulta está em `/api/admin/contratacoes`; o endereço antigo permanece como alias autenticado da consulta atualizada.

Neste módulo, contratação é o processo comercial/licitatório acompanhado pela Govnex. Isso não implementa ou substitui os futuros contratos, empenhos, pedidos e fornecimentos.

## Valor estimado exclusivamente pelos itens

O campo **Valor estimado (R$)** é somente leitura. O servidor recebe os itens e calcula o total; não aceita um valor de cabeçalho enviado pelo cliente.

Cada item tem número único dentro da contratação, descrição, unidade, quantidade e valor unitário estimado. Pode ser incluído, editado ou removido junto com a contratação. Os IDs são preservados ao editar, inclusive quando os números dos itens são trocados. As alterações ficam no histórico transacional.

- Quantidade positiva, com até 3 casas decimais; valor unitário não negativo, com até 4.
- Na interface, digite os itens sem separador de milhar e use vírgula nos decimais. O servidor também aceita números decimais canônicos com ponto; sem vírgula, o ponto é separador decimal dos itens.
- Total de cada item = quantidade × valor unitário, arredondado para centavos (meio centavo arredonda para cima).
- Total estimado = soma dos totais arredondados dos itens. Por exemplo, dois itens de R$ 0,0050 resultam em R$ 0,01 por item e R$ 0,02 no total.
- Sem itens ou com algum item sem preço, a estimativa permanece não informada. Não é apresentado um subtotal parcial como se fosse o total definitivo. Preço zero informado explicitamente é diferente de preço desconhecido.
- Limite de 100 itens por contratação, descrição de até 5.000 caracteres, quantidade `numeric(18,3)`, valor unitário `numeric(18,4)` e totais `numeric(18,2)`. Exceder a precisão ou o limite monetário é recusado; não há truncamento silencioso.

Cálculos usam inteiros escalados exatos, sem ponto flutuante. A persistência usa `Prisma.Decimal`. Checks e triggers diferidos do PostgreSQL conferem o total de cada linha e do cabeçalho, inclusive em escritas fora da interface. Cabeçalho e itens são salvos na mesma transação, com versão para evitar sobrescrita concorrente.

## Prazo e links

O ícone de ajuda ao lado de **Prazo de apresentação** mostra: “Data limite para apresentação da proposta e, nas licitações, data e hora da sessão pública.” Funciona por foco do teclado, mouse e toque, e fecha com Escape ou ao sair do controle. O horário continua sendo Brasília (UTC−3).

O antigo campo genérico é substituído por dois campos opcionais e independentes:

1. **Link da plataforma de licitação**.
2. **Pasta na nuvem (anexos da licitação)**.

Ambos aceitam apenas links HTTPS sem usuário/senha na URL. São referências externas; não há integração automática, leitura de anexos ou alteração das permissões da pasta.

## Situações e registros existentes

As opções são exatamente **Cancelada, Suspensa, Homologada, Proposta Cadastrada e Encerrada**. Novos registros começam com Proposta Cadastrada e permitem selecionar qualquer uma das cinco.

Conforme a escolha expressa do responsável (opção 2), a migration converte as situações antigas para **Proposta Cadastrada**, preservando **Cancelada** e **Encerrada** quando já tinham essas situações. A situação antiga também é mantida para rastreabilidade e a conversão recebe evento na auditoria.

Valores manuais antigos e o link genérico anterior são preservados em campos legados e exibidos para conferência. **Nenhum item fictício é criado e o valor manual anterior não é utilizado no total novo.** Para compor a estimativa, cadastre os itens reais. Classifique o link anterior em plataforma ou pasta de anexos ao revisar o cadastro.

O painel de acompanhamento inclui Proposta Cadastrada, Suspensa e Homologada, sempre excluindo arquivadas. Alertas de prazo vencido/próximo se aplicam apenas a **Proposta Cadastrada**; suspensas e homologadas não aparecem como sessões a cumprir. Canceladas e encerradas ficam fora desses indicadores.

## Arquivamento

O botão está tanto na visualização quanto na edição. A confirmação mantém cadastro, itens, valores e histórico. Na edição, o diálogo avisa que alterações não salvas serão descartadas se confirmar o arquivamento. Arquivadas precisam ser restauradas antes de editar.

## Migration e publicação

Migration nova: `20261120000100_contracting_items`. Não remove as colunas anteriores: expande a tabela existente, cria os itens, preserva os dados legados e registra a conversão de situações. O nome técnico da tabela `Opportunity` e a entidade de auditoria são mantidos por compatibilidade; a interface usa Contratações.

Com a nova branch atualizada localmente e as conexões do Neon corretas:

```bash
npm ci
npm run db:migrate
npx prisma migrate status
```

Evite edições durante a transição entre migration e deploy. Aplique a migration com sucesso antes de incorporar a branch à main e atualizar a Vercel. As colunas antigas continuam disponíveis para o deployment anterior durante a preparação, mas ele não conhece os itens, links e situações novos. Um eventual rollback de código exige revisar essa diferença e não deve remover itens ou os dados preservados. Não use reset ou seed em produção.

A integridade dos totais e a unicidade diferida da numeração são definidas em SQL; o schema Prisma não descreve todos os triggers/checks. Preserve esses objetos nas migrations futuras. Não corrija totais manualmente no banco: altere os itens pela aplicação.

## Validação

**84 testes unitários, 35 de integração com PostgreSQL 17 e 7 E2E no Chromium passaram (126 no total)**. TypeScript, lint e build de produção passaram. Os cenários incluem migração dos sete estados antigos, preservação dos registros, arredondamento por item, edição/remoção/renumeração com IDs estáveis, bloqueio de total adulterado, estimativa incompleta, dois links, cinco situações, tooltip por teclado/celular e arquivamento nas duas telas.

As migrations foram aplicadas e reexecutadas somente no banco local isolado. Não houve migration no Neon nem deploy de produção nesta execução. A validação local utilizou os geradores oficiais JavaScript/WASM já documentados, com execução do SQL completo em uma conexão PostgreSQL, sem desativar TLS ou checksums.
