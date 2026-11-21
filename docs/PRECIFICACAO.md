# Catálogo, precificação e proposta vencedora

A preservação do fornecedor após alterações do catálogo está detalhada em [FORNECEDOR_HISTORICO.md](FORNECEDOR_HISTORICO.md). Fornecedores já registrados podem ser mantidos, mesmo removidos ou inativos; novas escolhas seguem a lista ativa atual.

Os ajustes posteriores de filtros, resumo financeiro e situação da proposta estão em [RESUMO_FINANCEIRO.md](RESUMO_FINANCEIRO.md).

Esta entrega atende aos pedidos posteriores à primeira versão do catálogo. As orientações deste documento substituem as descrições anteriores de Margem e Custo Administrativo nos formulários de catálogo e itens.

## Catálogo

- Cadastro e edição em modal com foco contido, fechamento por Escape e botão Fechar.
- Tipo Material ou Serviço; descrição em textarea com duas linhas e até 20 mil caracteres; Marca e Modelo opcionais, Unidade e Alíquota tributária obrigatórias.
- Não há campo de margem ou custo administrativo no formulário do catálogo.
- Fornecedores com pesquisa e múltiplas seleções; pelo menos um fornecedor. Somente essa lista é oferecida na precificação dos itens vinculados.
- Tabela e botões seguem os componentes e classes usados em Órgãos públicos. Filtros por descrição, tipo, marca e fornecedor; paginação de 20 registros.

## Contratações e itens

A situação **Classificada** foi acrescentada. Ela participa do acompanhamento comercial, mas não gera alertas de prazo para apresentação de proposta.

As guias Visão geral, Gerenciar itens, Precificação e Proposta Vencedora organizam as telas. Editar contratação e Arquivar permanecem na visão geral.

O modal do item contém número, tipo, item do catálogo, descrição longa, marca, modelo, unidade, quantidade, valor estimado unitário (até quatro casas) e Vencedor. A seleção do catálogo copia as características e a alíquota; alterações posteriores no catálogo não atualizam automaticamente os itens já cadastrados.

Na lista, edição e exclusão usam ícones identificados para acessibilidade. O checkbox Vencedor é salvo no backend. A exclusão exige confirmação. Alterar o catálogo vinculado invalida a precificação anterior do item, mantendo o histórico de auditoria; é necessário precificá-lo novamente.

## Precificação

Para cada item, selecione um fornecedor ativo vinculado ao produto e informe valores unitários de aquisição e frete, alíquota tributária, lucro líquido e custo administrativo (percentuais).

```text
Preço mínimo viável = (aquisição unitária + frete unitário)
                     / (1 - (tributos + custo administrativo + lucro líquido) / 100)
```

A soma dos percentuais deve ser **estritamente menor que 100%**. Zero é um valor válido, que precisa ser informado. Cada percentual aceita até duas casas e cada custo unitário até quatro. O servidor calcula; o formulário não envia um preço mínimo calculado.

São usados inteiros escalados e divisão racional, sem ponto flutuante para a matemática monetária ou dos percentuais. Política HALF_UP: preços unitários com quatro casas; totais de cada item com duas casas; o total geral soma os totais já arredondados de cada item. Limites de precisão são validados antes da persistência.

Cada salvamento mantém um snapshot dos custos, percentuais, fornecedor, referência, quantidade, fórmula (versão 1), política de arredondamento e momento de cálculo. O snapshot atual fica no item e os anteriores ficam na auditoria. O banco também verifica a consistência do preço mínimo com os parâmetros.

Preço mínimo acima do estimado é destacado em amarelo, sem impedir precificação, participação ou registro da proposta. Salve uma linha antes de editar a próxima; o controle de versão da contratação rejeita salvamentos concorrentes desatualizados.

## Proposta Vencedora

Apenas itens com Vencedor marcado são exibidos. A oferta vencedora é um valor **unitário**, com máscara brasileira de quatro casas. O total do item é quantidade × oferta, arredondado em centavos; o rodapé soma esses totais. Enquanto um vencedor estiver sem oferta, o total geral fica pendente, evitando apresentar soma parcial como total. Sem vencedores, o total é zero.

A oferta não altera o valor estimado nem o preço mínimo. Desmarcar Vencedor retira o item dessa tela e preserva o valor para o histórico; marcar novamente recupera o valor. Contratações arquivadas permitem consulta, sem edição. As operações exigem administrador, validação de pertencimento do item e controle de versão.

## Migração e dados existentes

Migration: `20261120000300_pricing_winners`.

A migração é aditiva. Preserva os antigos campos de margem, custo administrativo e fornecedor único, cria a relação de múltiplos fornecedores e copia para ela o fornecedor anteriormente vinculado.

**Margem antiga não é transformada em alíquota tributária.** Tipo e alíquota dos registros existentes ficam pendentes para revisão. Novos itens iniciam como não vencedores; custos e ofertas não são inventados. A alíquota deve ser preenchida ao revisar o catálogo ou ao precificar.

Antes do deploy, com backup, branch atualizada e variáveis do Neon configuradas:

```sh
npm ci
npm run db:migrate
npx prisma migrate status
```

Não executar reset ou seed de desenvolvimento em produção. Aplicar a migração antes de publicar o código e evitar edições durante a troca de versão. O rollback do código precisa ser avaliado porque versões anteriores desconhecem Classificada, fornecedores múltiplos e os novos parâmetros financeiros. Não reverter a migração apagando dados reais.

## Próximas etapas

Gestão de cotações foi retirada do MVP. A próxima etapa passou a ser importação/exportação por arquivos para o agente externo preparar a proposta conforme o modelo. Consulte [PLANEJAMENTO.md](PLANEJAMENTO.md). Pedidos/fornecimentos e faturamento/recebimentos permanecem para priorização futura.

## Validação desta entrega

- 110 testes unitários aprovados.
- 46 testes de integração aprovados em PostgreSQL local descartável, incluindo migração, fórmula, snapshots, concorrência, fornecedores, limites monetários e pertencimento dos itens.
- 7 testes Chromium aprovados, incluindo os novos modais, seleção múltipla, filtros, Classificada, checkbox de vencedor, precificação, tooltip, oferta com quatro casas, total, arquivamento e recusa de acesso sem perfil administrador.
- TypeScript, ESLint e build de produção aprovados.

A migration foi aplicada no banco local de teste e a segunda execução confirmou ausência de migrations pendentes. Não foi aplicada no Neon nem foi feito deploy de produção nesta entrega.
