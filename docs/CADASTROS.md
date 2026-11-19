# Atualização de cadastros — endereços, máscaras e contatos

## Comportamento

- Órgãos públicos e fornecedores: CNPJ e telefone com máscara tanto no cadastro quanto na edição. Contatos e configurações da Govnex também usam máscara de telefone; o CNPJ da empresa usa a mesma máscara. Colagem, edição no meio do campo e exclusão junto aos separadores são suportadas. CNPJ alfanumérico mantém letras maiúsculas; telefones internacionais explícitos são preservados.
- Govnex e fornecedores: endereço (rua, número, complemento e bairro), CEP, cidade e estado (UF) em campos separados. CEP tem máscara `00000-000`, é persistido com oito dígitos e UF é validada entre os estados brasileiros. Os campos são opcionais. Não há consulta automática a serviços de CEP.
- O endereço livre já cadastrado da Govnex é preservado integralmente. Não é dividido por heurísticas: revise e preencha CEP/cidade/UF na edição, se necessário.
- Na tela de fornecedores, Código UASG fica oculto no cadastro e na edição. Uma organização compartilhada que já tenha UASG mantém esse valor; ele continua editável pela tela de órgãos públicos.
- Cada e-mail não vazio de pessoa de contato é único **em todo o sistema**, inclusive entre órgãos e fornecedores. Maiúsculas/minúsculas e espaços externos não distinguem pessoas. A edição do próprio contato com o mesmo e-mail continua permitida. Contatos sem e-mail continuam possíveis; a unicidade de e-mail não identifica pessoas sem esse dado.
- Duplicidade dentro do mesmo formulário é indicada no campo do contato. Duplicidade em outro cadastro recebe mensagem própria, sem ser confundida com CNPJ duplicado. A restrição também existe no PostgreSQL, incluindo gravações simultâneas.

## Aplicar no Neon antes do deploy

A migration `20261119000100_cadastros_enderecos_contatos` adiciona colunas opcionais, normaliza e-mails existentes e cria o índice único e uma restrição de formato normalizado. Não exclui pessoas, organizações ou endereços.

Com esta branch atualizada na máquina de administração e o `.env` apontando para o banco de destino correto:

```bash
npm ci
npm run contacts:check
npm run db:migrate
npx prisma migrate status
```

`contacts:check` é somente leitura. Informa a quantidade de grupos duplicados e retorna erro se houver algum, sem imprimir e-mails nem alterar dados. Faça essa verificação **antes** de iniciar a migration. Para localizar os cadastros a revisar, um operador autorizado pode consultar os registros no Neon SQL Editor:

```sql
SELECT c.id, c."organizationId", c.name, c.email
FROM "Contact" c
WHERE NULLIF(lower(btrim(c.email)), '') IN (
  SELECT lower(btrim(email)) FROM "Contact"
  WHERE NULLIF(lower(btrim(email)), '') IS NOT NULL
  GROUP BY lower(btrim(email)) HAVING count(*) > 1
)
ORDER BY lower(btrim(c.email)), c."organizationId";
```

Revise os resultados no ambiente administrativo autorizado. Corrija os cadastros repetidos ou seus e-mails após conferir cada pessoa; não remova contatos automaticamente nem compartilhe os resultados com dados pessoais no chat.

A migration também verifica duplicidades sob lock antes de modificar qualquer registro. Se encontrar conflito, interrompe e reverte a transação inteira. Se uma tentativa já tiver sido registrada pelo Prisma como falha, confirme primeiro que foi essa validação e que a transação reverteu; depois de revisar as duplicidades, marque **apenas essa tentativa falha** como revertida e tente novamente:

```bash
npx prisma migrate resolve --rolled-back 20261119000100_cadastros_enderecos_contatos
npm run db:migrate
```

Não use `migrate reset`, `db push --accept-data-loss` ou seed no banco de produção. O código novo consulta as novas colunas: aplique a migration com sucesso **antes de incorporar a branch à main e atualizar a Vercel**. Os campos opcionais são compatíveis com a versão anterior da aplicação durante essa transição.

## Validação deste incremento

Verificações executadas em PostgreSQL 17 local e isolado; nenhuma conexão de produção foi usada. O cliente Prisma foi gerado com o gerador JavaScript oficial, pois o download nativo do Prisma continuou bloqueado por HTTP 403 neste ambiente. Não foram desativados TLS ou checksums.

As migrations foram aplicadas e reexecutadas no banco de testes. Os testes de migração também executam o SQL completo via `pg`, comprovando rollback quando há duplicidades, normalização, múltiplos e-mails nulos e preservação do endereço antigo. Na validação do engine WASM, o executor SQL do adaptador local foi ajustado para enviar o script inteiro em uma conexão, pois a implementação padrão divide scripts por ponto e vírgula e não suporta blocos `DO`. Esse auxiliar fica fora do repositório; o fluxo de produção permanece `prisma migrate deploy` pela CLI oficial.

Testes cobrem máscaras completas/parciais, CNPJ alfanumérico, telefones, CEP/UF, validação de contatos repetidos, persistência/edição de endereço, concorrência, rollback e interface real no Chromium. O registro geral da primeira entrega continua em [VALIDACAO.md](VALIDACAO.md).

Resultado final deste incremento: **38 testes unitários, 16 de integração PostgreSQL e 5 E2E passaram (59 no total)**. TypeScript, lint, formatação e build de produção passaram. O comando `contacts:check` foi executado com sucesso no banco de testes. A migration foi preparada e testada localmente; não foi aplicada ao Neon nem houve alteração do deploy de produção.
