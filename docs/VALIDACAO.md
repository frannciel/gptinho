# Evidências da primeira entrega

Validação executada em 18/11/2026, no checkout `/workspace/gptinho`, com Node.js 24.22.1 e PostgreSQL 17 local em container Docker. Nenhuma credencial Neon ou implantação Vercel foi usada.

## Resultados finais

| Verificação                                                              | Resultado                                                                                                      |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                                      | Passou, sem erros                                                                                              |
| `npm run lint`                                                           | Passou, sem avisos                                                                                             |
| `npm run format:check`                                                   | Passou                                                                                                         |
| `npm run build`                                                          | Passou com Next.js 16.4.6/Turbopack; rotas privadas dinâmicas, runtime Node.js                                 |
| `npm test`                                                               | 15 testes unitários passaram                                                                                   |
| `npm run test:integration`                                               | 10 testes passaram em PostgreSQL real                                                                          |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e` | 4 testes completos passaram no Chromium                                                                        |
| Migration inicial                                                        | Gerada pelo schema engine oficial Prisma WASM e aplicada ao banco local; segunda aplicação não alterou o banco |
| Seed                                                                     | Executado duas vezes, sem erro, mantendo IDs estáveis e sem criar usuário padrão                               |
| CLI de administrador                                                     | Criação inicial, recusa de segundo bootstrap e redefinição de senha passaram em um segundo banco local isolado |
| `npm audit --omit=dev --audit-level=high`                                | Nenhuma vulnerabilidade reportada nas dependências de produção                                                 |
| Segredos e saídas locais                                                 | `.env`, `node_modules`, `.next` e `test-results` ignorados pelo Git; sem credenciais reais versionadas         |

Os testes de integração cobrem bootstrap concorrente de administrador, hash/login e inatividade, limite atômico de tentativas, CRUD/contatos, busca e filtros, duplicidade de CNPJ, rollback de transação, versão de edição, cadastro com múltiplos papéis, exclusão auditada e configurações com controle de concorrência. Também verificam que a auditoria não contém senha, hash ou segredo de sessão.

Os testes E2E cobrem:

1. Redirecionamento de páginas privadas e API 401; login; cadastro, busca, edição e exclusão de órgão/fornecedor; confirmação/cancelamento; persistência de configurações; logout; recusa de cookie antigo e de replay de Server Action sem sessão.
2. Recusa de usuário USER em página administrativa e resposta 403 na API.
3. Layout em 390 px sem overflow horizontal, navegação móvel e recusa de sessão revogada no banco.
4. Formulário de login sem JavaScript enviando por POST, sem credenciais na URL.

As capturas desktop e mobile geradas pelo Playwright foram usadas para inspecionar a interface. Os testes de navegador usam usuários efêmeros; não há uma conta de demonstração instalada para uso humano.

## Falhas investigadas e corrigidas

- O cache padrão npm em `/home/agent/.npm` não era gravável. Nesta sessão os comandos npm de instalação usaram `--cache /tmp/govnex-npm`.
- A auditoria inicial identificou vulnerabilidades nas versões antigas de Prisma/Zod. Foram substituídas por Prisma 7.10.1 e Zod 4.6.7; a auditoria de produção final não reportou vulnerabilidades.
- Um seletor do primeiro teste E2E não considerava o indicador de campo obrigatório. Foi corrigido para o campo de contato específico.
- A reutilização de um servidor antigo após rebuild deixou chunks de JavaScript inconsistentes. O Playwright agora sempre inicia um servidor próprio. Pare qualquer outro processo na porta 3000 antes de executá-lo.
- A verificação anterior também revelou que o formulário de login dependia do JavaScript para evitar GET. O formulário agora define POST explicitamente e tem teste de regressão sem JavaScript.

## Restrição de rede e alternativa usada nesta máquina

O proxy devolveu HTTP 403 para os downloads de engine/checksum em `binaries.prisma.sh` e do navegador em `cdn.playwright.dev`. Não foram desabilitados TLS, validação de certificado, assinaturas ou checksums. As tentativas nativas de `prisma generate` não concluíram. Por isso, a instalação padrão com postinstall e a CLI nativa `prisma migrate deploy` não estão validadas nesta máquina.

Para continuar a validação sem usar o artefato nativo bloqueado, foram instalados pelo registro npm, com integridade normal, os pacotes oficiais **7.10.1** `@prisma/internals`, `@prisma/client-generator-js` e `@prisma/migrate` em `/tmp/govnex-tools`, fora do repositório. O gerador JavaScript oficial gerou o cliente; o schema engine WASM oficial gerou/aplicou a migration usando o adaptador PostgreSQL. A implementação de runtime usa o mesmo cliente Prisma e adaptador `pg` da aplicação, sem substituir o banco por mocks. O Chromium já instalado foi usado para E2E.

Os auxiliares temporários estão em `/tmp/govnex-tools/generate.cjs`, `migration.cjs` e `apply.cjs`. São ferramentas de diagnóstico desta sessão e não substituem o fluxo padrão documentado de instalação/deploy. Não assuma que esses arquivos temporários, processos ou o container Docker serão restaurados em outra tarefa.

Foram salvos no rascunho do ambiente os domínios `binaries.prisma.sh`, `cdn.playwright.dev`, `playwright.download.prss.microsoft.com` e `cdn.download.prss.microsoft.com`, preservando os presets existentes. O salvamento foi confirmado, mas não aplicou a política à instância. Após revisar/salvar a configuração no painel, valide os comandos padrão:

```bash
npm ci
npm run db:generate
# Apenas no banco de desenvolvimento/testes configurado:
npm run db:migrate
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run build
npm run test:e2e
```

## O que não foi validado

- Conexão, migrations, backup, limites ou restauração no Neon: faltam credenciais de um ambiente apropriado.
- Deploy, domínio e comportamento real na Vercel: nenhuma publicação autorizada/executada.
- Execução do workflow GitHub Actions: o arquivo está preparado, mas não houve push.
- Instalação padrão após aplicação da nova política de rede: depende da alteração no painel.
- Recuperação por e-mail, MFA, provisionamento de usuários adicionais e módulos comerciais/financeiros: fora da primeira entrega.

Os 29 testes automatizados finais passaram. A validação local não representa aprovação para operar dados reais nem comprovação de implantação em nuvem.
