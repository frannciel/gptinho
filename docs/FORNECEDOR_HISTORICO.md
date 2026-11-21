# Fornecedor do catálogo e fornecedor da contratação

## Diagnóstico

O banco já mantém dois vínculos independentes:

- `CatalogSupplier`: fornecedores disponíveis no produto do catálogo.
- `OpportunityItem.supplierId`: fornecedor efetivamente registrado no item da contratação, com chave estrangeira que impede sua exclusão física enquanto estiver vinculado.

As alterações do catálogo não atualizavam esse ID no item. O problema estava na consulta e na validação: a tela montava as opções exclusivamente a partir dos fornecedores ativos do catálogo e o backend exigia que o fornecedor já registrado ainda pertencesse a essa lista. Por isso a seleção podia deixar de aparecer, e o recálculo era bloqueado.

## Regra corrigida

O fornecedor já registrado no item sempre aparece como opção própria, identificado como Registrado na contratação. Removê-lo da lista do produto, desativar o fornecedor ou desativar o produto não substitui nem apaga essa seleção, custos, alíquotas, preço mínimo, oferta ou outros dados do item.

Em contratação aberta, é possível recalcular mantendo esse fornecedor histórico. Uma troca explícita continua limitada aos fornecedores ativos vinculados a um produto ativo. A exceção histórica vale somente para o fornecedor já salvo naquele item, não para outros itens da contratação.

Em contratação arquivada, a tela mostra somente o fornecedor registrado, sem oferecer outros fornecedores do catálogo. Todos os campos permanecem bloqueados e o backend continua rejeitando alterações.

A alteração explícita do produto vinculado ao item continua sendo uma operação distinta, que exige edição pelo usuário e invalida a precificação anterior conforme a regra já existente. Alterar o cadastro do produto não realiza essa edição automaticamente.

## Identificação e snapshots

Novas precificações registram `supplierSnapshot` com ID, razão social, nome fantasia e CNPJ dentro do snapshot já existente. Ao recalcular com o mesmo fornecedor, essa identificação é preservada; ao trocar explicitamente o fornecedor, é capturada a identificação do novo fornecedor. Snapshots anteriores continuam na auditoria.

Registros antigos sem snapshot de identificação usam o fornecedor já vinculado como referência de exibição. Não há regravação automática de contratações arquivadas nem tentativa de inventar nomes cadastrais históricos que não foram capturados. Remoção do vínculo do catálogo e desativação não ocultam a seleção desses registros legados.

## Concorrência e proteção

O salvamento mantém o controle de versão da contratação. Na precificação, o fornecedor e o produto são consultados com bloqueios na mesma ordem usada pelo cadastro de catálogo, permitindo remoção do vínculo no catálogo e recálculo do fornecedor histórico sem perder a seleção. A validação do fornecedor atual continua obrigatória para novas escolhas.

## Implantação e validação

Não há alteração de schema, nova dependência, variável de ambiente ou migration. A correção usa o vínculo e o campo JSON já existentes.

Validação local: 122 testes unitários, 59 testes de integração em PostgreSQL e 10 testes Chromium aprovados (191 no total), além de TypeScript, ESLint e build de produção. Os testes cobrem remoção, desativação de fornecedor/produto, preservação de contratos abertos e arquivados, recálculo histórico, troca explícita, novas escolhas recusadas, identificação preservada e operações concorrentes.

Nenhuma alteração foi aplicada no Neon nem foi executado deploy na Vercel nesta entrega.
