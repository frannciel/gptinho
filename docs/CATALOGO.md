# Catálogo e itens das contratações

Os ajustes mais recentes de filtros, fornecedores, ordenação e botões estão em [CATALOGO_USABILIDADE.md](CATALOGO_USABILIDADE.md).

A atualização mais recente de modais, tributos, fornecedores múltiplos, precificação e proposta vencedora está em [PRECIFICACAO.md](PRECIFICACAO.md).

## Planejamento atualizado

O tópico 4 (Contratações) foi aprovado pelo usuário com ressalvas. Esta entrega atende às ressalvas e antecipa o catálogo do módulo 6, necessário como origem dos itens. A formação de preço completa continua prevista após cotações; não foi definida fórmula de preço de venda a partir de margem e custo administrativo.

Ordem: fundação e cadastros → contratações → catálogo e revisão dos itens → cotações → formação de preço → propostas/PDF → pedidos/fornecimentos → financeiro → consolidação do dashboard.

## Alterações solicitadas

- Inclusão, edição e exclusão em `/contratacoes/[id]/itens`, com confirmação de exclusão e recálculo do total.
- Cadastro e edição da contratação exibem somente os itens e o acesso à tela de gerenciamento. Salve a contratação antes de incluir seus itens.
- Marca e Modelo são textos opcionais.
- Margem e Custo Administrativo são percentuais obrigatórios no catálogo e ao incluir/editar um item, de 0 a 100, com até duas casas decimais, exibidos com duas casas. Zero é permitido e precisa ser informado.
- Cada item possui fornecedor.
- O catálogo em `/catalogo` permite cadastrar, buscar, editar, desativar e reativar itens. A busca mostra até 100 resultados; refine o texto quando necessário.
- Ao selecionar um produto, descrição, Marca, Modelo, Unidade, Margem, Custo Administrativo e Fornecedor são copiados para o item. Ajustes locais não alteram o catálogo. Alterações no catálogo não atualizam contratações anteriores.
- A quantidade e o valor unitário estimado pertencem à contratação. O valor estimado continua sendo a soma dos totais dos itens; percentuais não alteram esse indicador.

## Migração e compatibilidade

Migration: `20261120000200_product_catalog`.

Cria `CatalogProduct` e acrescenta campos a `OpportunityItem`, sem excluir dados. Itens anteriores ficam com os novos campos pendentes, sem inventar fornecedor ou percentuais. Ao editar um item antigo, selecione seu produto de catálogo e complete os dados obrigatórios. O cabeçalho pode continuar sendo editado sem mudar os itens.

Os fornecedores vinculados não podem perder seu papel de fornecedor; podem ser desativados preservando o histórico. A exclusão física de fornecedores/produtos vinculados é protegida por chaves estrangeiras. Modificações de catálogo e itens exigem administrador, geram auditoria e verificam a versão para evitar sobrescrever edições concorrentes.

Antes do deploy, com as variáveis do Neon corretamente configuradas e a branch atualizada:

```sh
npm ci
npm run db:migrate
npx prisma migrate status
```

Não executar seed/reset em produção. Não há alteração de credenciais nesta entrega. Aplicar a migração antes de publicar o código. Faça backup e evite edições durante a troca de versão; versões anteriores não conhecem os novos campos.

## Validação

Testes unitários de percentuais, integração em PostgreSQL local de snapshots, validação de fornecedor, concorrência e recálculo. Fluxo de navegador atualizado para criar produto e selecionar itens na tela específica. Validação local concluída: 94 testes unitários, 38 testes de integração e 7 testes de navegador (139 aprovados), além de TypeScript, ESLint e build de produção. A migration foi aplicada em PostgreSQL local descartável e a segunda execução não encontrou migrations pendentes. Nenhuma migration foi executada no Neon e nenhum deploy foi iniciado nesta entrega.
