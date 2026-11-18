# Implantação, Neon e Vercel

## 1. Preparar GitHub

O projeto está no checkout existente de `frannciel/gptinho`. Revise as mudanças, crie um commit e envie uma branch para revisão. Não é necessário renomear o repositório. Nenhum push ou publicação foi realizado nesta entrega.

```bash
git status
git add .
git diff --cached
# Verifique que nenhum .env real ou dado de teste está incluído.
git commit -m "feat: fundação do Govnex ERP e cadastros iniciais"
# Faça push somente depois de revisar e autorizar o envio.
```

## 2. Configurar Neon

1. Crie projeto PostgreSQL no Neon com região próxima à aplicação e plano/backup aprovados pela empresa.
2. Separe branches/bancos de desenvolvimento, testes, preview e produção. Nunca rode suites destrutivas contra produção.
3. Copie a conexão **pooled** para `DATABASE_URL` e a **direta** para `DIRECT_URL`. Use TLS com verificação de certificado/hostname (`sslmode=verify-full`); não use `rejectUnauthorized=false` nem desative a verificação TLS.
4. Restrinja usuários/permissões. A conta de migrations precisa criar tabelas, índices e enums; a aplicação deve ter somente as permissões necessárias às operações e auditoria.
5. Em um terminal confiável com o `.env` apontando para a branch de desenvolvimento, execute `npm ci`, `npm run db:migrate`, `npm run admin:create`, `npm run dev`.
6. Valide login, criação/edição/busca/exclusão de cadastros e persistência depois de reiniciar a aplicação.

A conexão Neon não foi testada nesta entrega por ausência de credenciais. Não substitua as URLs por credenciais inventadas. A validação local em PostgreSQL não comprova rede, plano, backup ou desempenho no Neon.

## 3. Configurar Vercel — sem publicar automaticamente

1. Importe o repositório GitHub na Vercel e selecione o preset **Next.js**, raiz do projeto e Node.js **24.x**.
2. A instalação padrão é `npm ci`; o postinstall gera Prisma. Build: `npm run build`. Não configure runtime Edge para Prisma/Argon2.
3. Configure `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET` e `NEXTAUTH_URL` nos escopos certos. Use segredos distintos por ambiente. Para um preview, defina NEXTAUTH_URL para a origem exata desse preview e use a branch Neon de preview.
4. Não prefixe segredos com NEXT_PUBLIC. O valor de NEXTAUTH_URL da produção deve ser `https://app.govnex.com.br` quando esse domínio estiver ativo; antes disso, use a origem HTTPS real atribuída à aplicação.
5. Configure proteção de preview e proteção por IP/rate limit no login na borda; não confie em cabeçalhos X-Forwarded-For arbitrários.
6. Revise a migration SQL e execute `npm run db:migrate` em um job/terminal controlado para o banco de destino. **Não rode migrations em cada inicialização serverless ou como parte automática de todo preview.**
7. Execute `npm run admin:create` em terminal confiável, apontando ao banco de destino. A senha é digitada de forma mascarada, sem ser enviada em argumentos ou logs. Não crie endpoint HTTP de bootstrap.
8. **Somente com autorização explícita**, efetue o deploy. Depois verifique `/api/health`, login, permissões, CRUD e persistência. Health informa a vida do processo, não testa banco; o fluxo autenticado comprova a conexão.

A configuração do código é compatível com Next.js/Node.js na Vercel; nenhuma implantação real foi executada ou validada.

## 4. Domínio futuro

Mantenha `govnex.com.br` no site institucional. Adicione apenas `app.govnex.com.br` ao projeto Vercel e configure o registro DNS exatamente como orientado pelo painel da Vercel. Após emissão do certificado, ajuste NEXTAUTH_URL, reimplante e teste login/logout por HTTPS. Cookies em produção são Secure, HttpOnly e SameSite pelo Auth.js. Não compartilhe o segredo de sessão com o site institucional.

## 5. Atualizações, rollback e recuperação

- Antes de migrations de risco, faça backup ou crie ponto/branch de restauração Neon e teste a recuperação em ambiente isolado. Defina retenção, RPO, RTO e responsável antes de operar dados reais.
- Use alterações compatíveis, seguindo expandir → migrar → trocar → remover em entrega posterior. Não execute reset, `db push --accept-data-loss`, `migrate reset` ou SQL destrutivo em produção.
- No rollback de código, restaure a implantação anterior pela Vercel somente se compatível com o schema atual. Prisma não produz rollback automático de dados; restauração do banco exige procedimento próprio e reconciliação de gravações posteriores.
- Em perda de acesso: `npm run admin:reset-password`, em terminal autorizado com acesso ao banco. Solicita confirmação, muda hash e incrementa sessionVersion. Todas as sessões antigas são recusadas.
- Ao trocar NEXTAUTH_SECRET, todas as sessões são invalidadas. Também incremente sessionVersion ou desative usuário em resposta a comprometimento individual via administração operacional autorizada do banco; não crie rotas públicas para isso.
- A rotina de recuperação não reativa usuários desativados. Recuperação por e-mail, MFA, gestão de múltiplos usuários e consulta de auditoria na interface ficam para outra entrega.
- Defina retenção e limpeza periódica de LoginAttempt (somente janelas expiradas) e de auditoria conforme obrigações da empresa/LGPD. Não registre credenciais em logs ou em auditoria.

## 6. Rede do ambiente de desenvolvimento

A instalação usa `registry.npmjs.org`; a CLI Prisma baixa engines e checksums de `binaries.prisma.sh`. Playwright usa `cdn.playwright.dev`, podendo redirecionar para `playwright.download.prss.microsoft.com` e `cdn.download.prss.microsoft.com`. Mantenha TLS e checksums ativos. Não use PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING.

Os domínios adicionais foram salvos no rascunho das configurações do ambiente em nuvem; o salvamento não os aplicou à máquina. Revise/salve essas alterações no painel e publique o **ambiente** quando desejar disponibilizar sua configuração para novas tarefas. Isso é diferente de publicar a aplicação na Vercel.

Enquanto o domínio Prisma estiver bloqueado, `npm ci` (postinstall), `db:generate` e a CLI nativa de migrations falharão. Veja o registro de validação para os caminhos oficiais JavaScript/WASM usados nesta execução, sem desativar verificação de artefatos. Não há promessa de restauração de processos ou banco Docker em uma nova tarefa.
