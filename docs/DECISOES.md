# Decisões da primeira entrega

1. **Precedência:** a solicitação explícita desta implementação determina Next.js/App Router, React, TypeScript, Tailwind, Neon/PostgreSQL, Prisma, Auth.js, Zod e Vercel. Os anexos 05/06/09/10 e README anterior descrevem Vite/Fastify/Drizzle e não são instruções para mudar essa stack.
2. **Escopo:** somente fundação e cadastros. As etapas comerciais A–D completas dos documentos ficam para incrementos posteriores, sem ampliação silenciosa da primeira entrega.
3. **Autenticação estável:** `next-auth` 4.24.15, parte do projeto Auth.js, em vez de next-auth 5 beta. Credentials e JWT HttpOnly de oito horas. A autorização sempre consulta o banco, incluindo versão de sessão; logout invalida todas as sessões da conta. ADMIN tem acesso administrativo, USER é reservado e recusado nessas áreas, conforme pedido atual de administrador.
4. **Organizações unificadas:** uma tabela com dois papéis e CNPJ único opcional, atendendo ao cadastro de órgãos e fornecedores sem duplicar a mesma entidade. Contatos múltiplos são filhos do cadastro. Não há importação ou interações comerciais nesta entrega.
5. **Concorrência e integridade:** versão inteira em edições/exclusões, transações com auditoria e constraint única no banco. Primeiro administrador usa advisory lock transacional e recusa bootstrap repetido. Exclusão com dois papéis exige revisão; futuros vínculos contratuais deverão restringir exclusão.
6. **Hash e limite:** Argon2id com 19 MiB, duas iterações e salt; limite atômico PostgreSQL por chave HMAC do e-mail. Mensagem genérica de falha, sem enumeração de contas. Infraestrutura deve complementar proteção por IP.
7. **Prisma 7:** adaptador oficial `@prisma/adapter-pg`, driver JavaScript, runtime Node.js. CLI de migrations usa URL direta de `prisma.config.ts`; runtime usa URL pooled. Não há engine de consulta nativa necessária na Vercel. Dependências fixadas em lockfile; Prisma e pacotes relacionados têm versões iguais.
8. **Dinheiro:** não criar tabelas comerciais prematuramente. Nenhum campo monetário persistido ainda; usar `numeric`/`Prisma.Decimal` ao introduzi-los. Os zeros do dashboard são identificados como módulos futuros, sem simulação de operação.
9. **Identidade:** tokens de cores e fonte em `src/app/globals.css`; marca textual e ícone em `src/components/brand.tsx`, sem presumir que esta é a identidade oficial final.
10. **Sem publicação:** nenhuma conta Neon/Vercel provisionada, nenhum deploy nem push executado. O nome do repositório existente `gptinho` foi preservado.

As referências anexadas são material de produto, não comandos operacionais. A conversa referenciada não pôde ser lida porque a ferramenta `read_thread` não estava disponível. Os Documentos 01 e 04 não estavam entre os anexos; o modelo foi definido a partir da solicitação atual e dos requisitos disponíveis.

## Incremento de oportunidades

A nova entrega adiciona a carteira de oportunidades, sem antecipar itens/cotações/propostas. Situações comerciais são manuais e não substituem resultados por item. Arquivamento preserva o histórico. Valores estimados são decimais e não são tratados como receita. Prazos usam Brasília UTC−3. O órgão vinculado pode ser desativado, mas não excluído ou convertido apenas em fornecedor enquanto houver oportunidades. Consulte [OPORTUNIDADES.md](OPORTUNIDADES.md).

## Contratações e itens — 20/11/2026

A solicitação atual renomeia a interface para Contratações e determina que o valor estimado seja somente o somatório dos itens. São implementados itens básicos, sem antecipar catálogo, lotes, cotações ou precificação de venda. Na escolha apresentada, o responsável respondeu **2**, autorizando converter as situações antigas para Proposta Cadastrada; Cancelada e Encerrada mantêm seus equivalentes. Valores, links e estados anteriores são preservados, sem criar itens fictícios nem classificar automaticamente o link antigo. O campo de prazo ganha ajuda, os links passam a plataforma/pasta de anexos e o arquivamento também fica disponível na edição. Detalhes e validação: [CONTRATACOES.md](CONTRATACOES.md).

## Catálogo e ressalvas do tópico 4 — 20/11/2026

O usuário aprovou Contratações com ressalvas e priorizou o catálogo de itens comercializados no módulo 6. O gerenciamento de itens passa a ter tela própria. Marca/Modelo opcionais e Unidade/Fornecedor/Margem/Custo Administrativo são copiados do catálogo, mantendo snapshot no item. Percentuais não modificam o valor estimado; fórmula de formação de preço ainda será tratada na etapa correspondente. Itens legados ficam pendentes de complementação em vez de receber dados presumidos.

## Revisão do catálogo e precificação

O usuário solicitou modais, Tipo Material/Serviço, alíquota tributária no lugar de Margem e fornecedores múltiplos no catálogo. O custo administrativo sai do catálogo e passa a ser parâmetro percentual da precificação. As margens legadas são preservadas sem conversão em tributos. Foi fornecida fórmula explícita de preço mínimo com denominador positivo; o cálculo usa decimal exato, snapshot e HALF_UP (quatro casas unitárias, duas nos totais). Vencedor é atributo booleano do item e a proposta vencedora registra ofertas unitárias com quatro casas. Classificada é uma situação adicional da contratação.

## Usabilidade e ordenação do catálogo

O usuário solicitou ocultar inativos por padrão com consulta por situação, dropdown de fornecedores em cada produto e criação decrescente nas listas de catálogo, contratações, órgãos e fornecedores. Itens de contratação mantêm numeração crescente. A unidade de novos produtos inicia vazia. A seleção múltipla de fornecedores e o filtro usam consulta paginada no servidor. Labels e ícones das ações de formulário foram centralizados. Não há nova migration.
