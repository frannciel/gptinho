# Govnex ERP

Sistema interno da **Govnex Soluções Digitais Ltda.**: fundação, autenticação, cadastros e contratações. Independente do site institucional, com destino futuro `app.govnex.com.br`.

## O que está implementado

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4.
- PostgreSQL, Prisma 7 e adaptador `pg`, compatível com Neon e funções Node.js da Vercel.
- Auth.js, por meio da versão **estável `next-auth` 4**, com Credentials, JWT em cookie HttpOnly, CSRF e sessão de até 8 horas. Sem versão beta.
- Hash Argon2id, autorização de administrador no servidor, verificação de usuário ativo e versão de sessão em cada acesso privado.
- Login/logout, bootstrap administrativo por terminal, recuperação operacional por terminal, sem cadastro público ou senha padrão.
- Cadastro unificado de organizações, com papéis órgão público e fornecedor e páginas próprias. CNPJ único, UASG, contatos, categorias, observações, ativação/desativação, busca, filtros, paginação, edição e exclusão confirmada.
- Configurações cadastrais da empresa, auditoria transacional e proteção contra sobrescrita concorrente.
- Contratações vinculadas aos órgãos: itens, valor estimado calculado pela soma dos itens, dois links, prazos em Brasília com ajuda, situações, auditoria e arquivamento/restauração.
- Dashboard com contagens consultadas no banco; módulos futuros explicitamente identificados, sem indicadores fictícios.
- Layout responsivo em português, valores em BRL, datas no fuso de São Paulo e tokens de identidade visual reutilizáveis.

**Ainda não implementados:** lotes, catálogo, cotações, formação de preço de venda, propostas/PDF, pedidos, fornecimentos e financeiro. Os zeros desses módulos são placeholders identificados, não apurações. Não há integração externa automática.

## Requisitos e instalação

Use Node.js **24 LTS** (`.nvmrc`), npm e PostgreSQL 17+ local ou uma branch de desenvolvimento do Neon. O lockfile fixa as dependências.

```bash
npm ci
cp .env.example .env
# Preencha as URLs do seu PostgreSQL e um NEXTAUTH_SECRET aleatório.
# Geração local do segredo, sem copiá-lo para o Git:
openssl rand -base64 48
npm run db:migrate
npm run admin:create
npm run dev
```

`npm ci` gera o cliente Prisma no postinstall. Execute `npm run db:generate` depois de alterar o schema. Se usar `nvm`, execute `nvm use` antes dos comandos. O cadastro do administrador solicita e-mail, nome e senha mascarada, com confirmação; recusa um segundo bootstrap. A senha exige 12 caracteres, maiúscula, minúscula, número e símbolo. Não passe senhas na linha de comando nem as versione.

O `.env` local desta execução aponta apenas para um PostgreSQL descartável de testes, com segredo aleatório. **Não é uma conexão Neon.** Arquivos `.env*` reais são ignorados pelo Git.

## Variáveis de ambiente

| Variável                              | Uso                                                                                                 |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                        | Conexão PostgreSQL da aplicação; no Neon, use endpoint pooled com TLS e verificação de certificado. |
| `DIRECT_URL`                          | Endpoint direto do PostgreSQL para migrations, preferencialmente com usuário separado.              |
| `NEXTAUTH_SECRET`                     | Segredo aleatório exclusivo por ambiente, pelo menos 32 bytes.                                      |
| `NEXTAUTH_URL`                        | Origem completa e confiável da aplicação; localmente `http://localhost:3000`. Produção usa HTTPS.   |
| `TEST_DATABASE_URL`                   | Banco descartável para integração, com `_test` no nome; a suíte limpa os dados.                     |
| `ALLOW_DEV_SEED`                      | `true` somente para autorizar seed fictício em banco de desenvolvimento.                            |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` | Opcional: caminho de Chromium já instalado para testes E2E.                                         |

A aplicação não precisa de credenciais GitHub, Vercel ou Neon API em runtime. As URLs PostgreSQL e o segredo de sessão devem ser valores reais no processo; placeholders de proxy HTTP não autenticam conexões PostgreSQL. Não use variáveis `NEXT_PUBLIC_*` para segredos.

## Comandos

```bash
npm run dev             # Desenvolvimento
npm run build           # Build de produção, sem consultar o banco
npm run start           # Servir o build de produção
npm run typecheck
npm run lint
npm test
npm run format:check
npm run db:generate
npm run db:migrate      # Aplicação de migrations versionadas
npm run db:dev          # Criar migration em banco de desenvolvimento, nunca em produção
npm run admin:reset-password
```

Não usamos `db push` como substituto das migrations. Consulte [implantação e rollback](docs/DEPLOY.md) antes de aplicar alterações em produção.

### Seed opcional de desenvolvimento

```bash
ALLOW_DEV_SEED=true npm run db:seed
```

Cria apenas um órgão, um fornecedor fictícios e configurações iniciais, de forma idempotente. Não cria usuários nem senha padrão. O guardião do seed bloqueia `NODE_ENV=production`, mas você também deve conferir que `DATABASE_URL` é de desenvolvimento. Nunca execute seed contra produção.

### Testes com banco real

Crie um banco **descartável**, aplique as migrations nele e configure `TEST_DATABASE_URL` para a mesma base. A suíte recusa banco sem `_test` no nome e apaga os dados do banco de testes.

```bash
npm run test:integration
# Para E2E, DATABASE_URL e DIRECT_URL também precisam apontar para uma base descartável.
npx playwright install chromium
npm run build
npm run test:e2e
```

Para usar o Chromium existente neste ambiente:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

O Playwright inicia seu próprio servidor de produção e recusa reutilizar um servidor existente. Pare qualquer servidor na porta 3000 antes dos testes. Na integração contínua (`.github/workflows/ci.yml`), os testes usam PostgreSQL efêmero. [Evidências e limites desta validação](docs/VALIDACAO.md).

## Estrutura

```text
src/app/                   Páginas, layouts, handlers HTTP e Server Actions
  (admin)/                 Dashboard, contratações, órgãos, fornecedores, configurações
  api/auth/[...nextauth]/   Auth.js
  api/admin/organizacoes/  Consulta administrativa protegida
src/components/            Interface e formulários reutilizáveis
src/lib/                   Prisma, autenticação, autorização, Zod, formatação
src/server/                Serviços transacionais e regras de negócio
prisma/                    Schema, migrations SQL e seed de desenvolvimento
scripts/                   Provisionamento e recuperação do administrador
 tests/unit/               Validação e segurança de senhas
 tests/integration/        PostgreSQL real, concorrência e auditoria
 tests/e2e/                Fluxos reais no navegador
 docs/                     Implantação, decisões e evidências
```

## Modelo inicial do banco

- **User:** nome, e-mail único normalizado, hash, perfil ADMIN/USER, ativo e versão de sessão.
- **Organization:** identificação única por CNPJ opcional, papéis, UASG, dados comerciais e versão de edição.
- **Opportunity (Contratação na interface):** identificação única, órgão vinculado, objeto, modalidade, processo, total calculado pelos itens, prazo, cinco situações, dois links e dados legados preservados.
- **OpportunityItem:** número, descrição, unidade, quantidade, valor unitário e total; IDs estáveis, unicidade por contratação e checks/triggers de consistência.
- **Contact:** pessoas vinculadas à organização; exclusão acompanha a organização quando permitida.
- **CompanySettings:** registro único usado pela aplicação para os dados cadastrais da Govnex.
- **AuditLog:** autor, entidade, operação, antes/depois e data; nenhuma senha, hash ou token.
- **LoginAttempt:** contagem atômica por chave HMAC do e-mail e janela de 15 minutos.

O total dos itens de contratações usa `numeric(18,2)` e `Prisma.Decimal`, com valores transmitidos como strings e formatação sem perda de centavos. As entidades financeiras ainda não foram implementadas e deverão manter essa representação decimal em suas próprias migrations.

## Segurança e operação

Todos os dados de negócio são acessíveis apenas por administradores nesta entrega. O perfil USER já existe para evolução; não dá acesso às telas administrativas. Layouts e páginas verificam acesso; as Server Actions repetem autorização antes de validar/gravar; a API privada responde 401/403. Auth.js protege seu login/logout contra CSRF; Server Actions usam a validação de origem do Next.js. Não há APIs públicas de escrita de negócio.

Cada acesso privado consulta o usuário ativo e a versão de sessão no banco, evitando confiar apenas no perfil contido em um JWT antigo. Logout e recuperação de senha revogam **todas as sessões** daquele usuário pela versão. Não há armazenamento de tokens no navegador via localStorage.

A autenticação limita a cinco tentativas por e-mail em 15 minutos no banco, inclusive entre instâncias serverless. Não zera o limite no sucesso para evitar bypass por concorrência. Antes de abrir a produção na Internet, configure também proteção por IP na borda da Vercel; isso complementa o limite por conta. Limpe registros antigos de LoginAttempt conforme política operacional, sem apagar janelas ativas.

Cadastros vinculados aos dois papéis não podem ser excluídos diretamente. É possível desativar ou remover um papel na edição. Contatos são parte do cadastro; sua exclusão é transacional. Os futuros vínculos comerciais devem usar chaves estrangeiras restritivas, preservando históricos. A auditoria contém dados cadastrais pessoais: acesso mínimo e retenção devem ser definidos antes da operação real.

Sem dependência de arquivos locais persistentes, sem uploads e sem uso do runtime Edge. O pool é limitado a três conexões por instância; dimensione-o junto com o endpoint pooled do Neon e os limites da Vercel.

## Fontes e precedência

A solicitação atual substitui as recomendações anteriores de Vite/Fastify/Drizzle dos anexos. As regras de negócio pertinentes foram preservadas, inclusive cadastro unificado, auditoria e edição concorrente. Ver [decisões](docs/DECISOES.md). A conversa referenciada não estava acessível por ferramenta nesta sessão; os 11 arquivos anexados foram consultados. Os Documentos 01 e 04 citados no índice não foram anexados.

## Atualização dos cadastros

Máscaras de CNPJ/telefone, endereços separados da Govnex e fornecedores, UASG oculta na tela de fornecedores e e-mail de contato único no sistema. Consulte [comportamento, migration e revisão de duplicidades](docs/CADASTROS.md) antes de implantar esta atualização.

## Contratações

O módulo foi renomeado de Oportunidades para Contratações. Consulte [itens, total calculado, situações, links, dados legados e implantação](docs/CONTRATACOES.md). As páginas antigas redirecionam para as novas. A migration deve ser aplicada antes de atualizar a Vercel.

### Catálogo e gerenciamento de itens

O catálogo de itens comercializados e a tela específica de itens da contratação estão descritos em [Catálogo e itens](docs/CATALOGO.md), incluindo alterações solicitadas, ordem atualizada das próximas entregas e migração necessária.

A entrega de [precificação e proposta vencedora](docs/PRECIFICACAO.md) acrescenta os novos modais, filtros e fornecedores múltiplos ao catálogo.

Os ajustes de [catálogo, filtros e padrão de ações](docs/CATALOGO_USABILIDADE.md) definem a consulta de ativos/inativos, fornecedores pesquisáveis e a ordenação por criação.

A entrega de [resumo financeiro e controle da proposta vencedora](docs/RESUMO_FINANCEIRO.md) documenta as bases confirmadas de cálculo e os ajustes mais recentes da interface.

A atualização de [Em Análise, exclusão protegida e margem sobre receita](docs/CONTRATACOES_EXCLUSAO_MARGEM.md) descreve as migrations mais recentes e os ajustes do Resumo Financeiro.

A correção de [fornecedor histórico da contratação](docs/FORNECEDOR_HISTORICO.md) separa a seleção já registrada das alterações posteriores no catálogo.
