# Catálogo, ordenação e padrão de ações

## Alterações

- O catálogo exibe somente itens ativos por padrão. O filtro Situação permite consultar Ativo ou Inativo e é preservado na paginação.
- A coluna Fornecedores contém um dropdown de consulta com os fornecedores de cada produto. Consultar uma opção mantém os vínculos cadastrados.
- Catálogo, Contratações, Órgãos públicos e Fornecedores usam criação decrescente como ordenação padrão, com desempate estável por ID. Em Contratações, as opções explícitas de ordenação continuam disponíveis. Itens da contratação permanecem por número crescente; indicadores de prazo continuam ordenados pela data limite.
- Novo item do catálogo inicia Unidade vazia, com preenchimento obrigatório.
- O seletor de fornecedores usa consulta no servidor, pesquisa por razão social, nome fantasia ou CNPJ, resultados paginados de 20 registros e etiquetas removíveis para os selecionados. Mantém o limite de 100 fornecedores por produto. Seleções existentes de fornecedores inativos são preservadas na edição.
- O filtro de fornecedor também usa consulta no servidor e admite fornecedores inativos para consultar os vínculos históricos.
- O endpoint administrativo `/api/admin/fornecedores/busca` exige autenticação e perfil administrador, valida parâmetros e envia `Cache-Control: no-store`.
- Os formulários do catálogo e de itens têm espaçamento e separação antes das ações. Salvar, Cancelar, Limpar, Voltar e Filtrar compartilham labels e ícones reutilizáveis em `ButtonContent`. As ações de salvamento mantêm nomes acessíveis com contexto para distinguir os formulários.
- Limpar restaura os valores padrão dos filtros, incluindo a situação Ativo do catálogo.

## Implantação

Não há mudança de schema nem nova migration nesta entrega. Atualizar o código após revisar a branch e executar o deploy habitual. Nenhuma alteração de banco ou deploy de produção foi executado nesta entrega.

## Validação

110 testes unitários, 48 testes de integração em PostgreSQL local e 8 testes Chromium aprovados (166 no total). TypeScript, ESLint, build de produção e formatação verificados. A cobertura inclui ordenação por criação, paginação e autorização da consulta de fornecedores, seleção e remoção de etiquetas, filtro de inativos, dropdown por item e restauração dos filtros.
