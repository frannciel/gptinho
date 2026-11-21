# Em Análise, exclusão e margem sobre receita

## Situação padrão

Novas contratações começam em **Em Análise** no formulário, na validação do backend e no banco. A situação entra no acompanhamento comercial e nos alertas de prazo de apresentação. As situações dos registros existentes são preservadas.

## Exclusão

A consulta da contratação oferece Excluir contratação para registros não arquivados. O diálogo informa a perda permanente dos itens, dados de precificação e ofertas e exige Confirmar exclusão. Cancelar não altera os dados.

O backend exige administrador e versão atual, bloqueia contratações arquivadas e aquelas com contratos associados. Exclusão de itens e contratação ocorre na mesma transação. A auditoria da exclusão, o catálogo, os fornecedores e o órgão são preservados.

A nova tabela `Contract` é a estrutura mínima de vínculo para a proteção: identificação, contratação de origem, referência e datas. A chave estrangeira impede excluir uma contratação vinculada, inclusive em acesso direto ao banco. O serviço bloqueia a linha da contratação durante a verificação para evitar disputa com arquivamento, alterações ou associação de contratos. O módulo completo de contratos e sua interface continuam previstos para outra entrega.

## Resumo Financeiro

O resumo passa ao final da consulta, depois do Resumo da Contratação e do histórico. O título é **Resumo Financeiro**. Os rótulos são Custo de Aquisição, Custo de Frete, Total de Tributos, Custos Administrativos e Lucro Líquido.

O cálculo dos valores monetários permanece: receita menos aquisição, frete, tributos e custo administrativo. A base do **percentual** muda, conforme a nova instrução:

```text
Percentual de lucro líquido = lucro líquido / receita total × 100
```

Todos os itens usam receita estimada; vencedores usam ofertas vencedoras. O percentual geral usa os totais de lucro e receita, não a média dos percentuais. A mesma regra é aplicada ao indicador de cada oferta. Receita zero ou pendente não permite apurar percentual; aquisição zero não impede apuração se a receita for positiva e os demais dados estiverem completos.

Valores continuam calculados com inteiros escalados e HALF_UP, arredondando componentes por item em centavos. Exemplo já usado nas entregas anteriores: lucro vencedor de R$ 86,21 sobre receita de R$ 360,25 resulta em **23,93%**. Lucro estimado de −R$ 49,79 sobre R$ 200,25 resulta em **−24,86%**.

A linha de lucro recebe destaque verde para resultado positivo, vermelho para negativo e neutro para zero, com identificação acessível do sinal. Pendências não são tratadas como lucro zero.

## Proposta Vencedora

O percentual junto ao input é um campo de exibição (`output`), sem ação de submissão. O botão Salvar volta à coluna Ações, com label e ícone padronizados. A máscara de quatro casas e a confirmação de Classificada/Homologada permanecem.

## Migrações e implantação

Duas migrations aditivas:

1. `20261121000100_analysis_status`: acrescenta Em Análise ao enum.
2. `20261121000200_contracting_deletion`: configura o novo padrão e cria o vínculo de contratos com proteção por chave estrangeira.

A adição ao enum está separada da alteração do valor padrão para que o PostgreSQL confirme o novo valor antes de utilizá-lo.

Com a branch atualizada e variáveis do Neon configuradas, antes do deploy:

```sh
npm ci
npm run db:migrate
npx prisma migrate status
```

As migrations não removem registros nem alteram situações existentes. Não executar seed/reset em produção. Planejar a troca de versão com backup e evitar edições na transição. Versões anteriores desconhecem Em Análise; avaliar isso antes de qualquer rollback de código, sem apagar contratos ou dados reais para reverter a migration.

## Validação

117 testes unitários, 54 testes de integração em PostgreSQL local e 9 testes Chromium aprovados (180 no total). TypeScript, lint e build de produção aprovados. Cobertura de migrações, novo padrão, bloqueios de exclusão, auditoria, confirmação/cancelamento, autorização, receita zero e destaque de lucro/prejuízo.

As migrations foram aplicadas somente no banco local descartável; a segunda aplicação não encontrou pendências. Nenhuma migration no Neon ou deploy na Vercel foi executado nesta entrega.
