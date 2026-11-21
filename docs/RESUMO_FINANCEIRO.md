# Resumo financeiro e controle da proposta vencedora

A revisão mais recente está em [CONTRATACOES_EXCLUSAO_MARGEM.md](CONTRATACOES_EXCLUSAO_MARGEM.md): percentual sobre receita, exclusão protegida e Em Análise como padrão.

## Base de cálculo confirmada pelo usuário

Na coluna **Todos os itens**, a receita usa o valor unitário estimado de cada item multiplicado pela quantidade. Na coluna **Itens vencedores**, usa a oferta unitária vencedora multiplicada pela quantidade dos itens marcados como vencedores.

Os custos unitários de aquisição e frete vêm da precificação. Tributos e custo administrativo incidem sobre a receita da respectiva coluna. O lucro líquido é a receita menos aquisição, frete, tributos e custo administrativo.

```text
Lucro líquido = receita − aquisição − frete − tributos − custo administrativo
Percentual apurado = lucro líquido / receita total × 100
```

O percentual apurado usa a receita como denominador. O lucro efetivo considera os custos e a receita da coluna selecionada; os parâmetros históricos da precificação permanecem preservados.

## Precisão e pendências

- A matemática usa inteiros escalados e arredondamento HALF_UP, sem ponto flutuante.
- Cada total de receita, aquisição e frete é calculado por item e arredondado para centavos.
- Tributos e despesa administrativa são calculados sobre a receita do item já expressa em centavos, com percentuais de duas casas, e arredondados para centavos.
- O lucro é a diferença desses componentes. Os resumos somam os resultados dos itens.
- O percentual geral é lucro total dividido pela receita total, com duas casas; não é a média dos percentuais individuais.
- Valores ausentes aparecem como Pendente. Receita igual a zero não permite apurar percentual, apresentado como Não apurável. Conjunto vazio tem totais zero, sem inventar percentual.
- Prejuízos são exibidos como valores negativos.

Exemplo: quantidade 2, estimativa unitária 100,1250, oferta vencedora 180,1234, aquisição unitária 100,0000, frete unitário 10,0000, tributos 10% e custo administrativo 5%. O resultado estimado é −R$ 49,79 (−24,86% sobre receita); o resultado vencedor é R$ 86,21 (23,93% sobre receita).

## Interface

- A consulta da contratação apresenta o Resumo Financeiro em duas colunas.
- O campo de oferta vencedora tem input e caixa de exibição do percentual de lucro integrados. O botão Salvar fica na coluna Ações. A simulação usa a mesma função decimal dos cálculos da tela de resumo; os valores persistidos e as regras são validados no backend.
- O botão mostra — quando o percentual não é apurável, por custos pendentes, receita ausente ou receita zero.
- Total passa a Total Estimado nas tabelas. Gerenciar itens apresenta Valor Total Estimado no rodapé.
- Histórico recente consulta e exibe apenas cinco atualizações.
- O menu lateral desktop pode ser ocultado e exibido pelo botão do cabeçalho. A preferência é mantida durante a navegação e reinicia com uma nova carga da aplicação. A navegação móvel permanece disponível.

## Situação da proposta vencedora

O registro da oferta exige contratação Classificada ou Homologada. Em qualquer outra situação, a tentativa de salvar abre um alerta com Classificada, Homologada e Cancelar.

A seleção explícita atualiza situação e oferta na mesma transação, com auditoria e controle de versão. Cancelar não salva a oferta nem muda a situação. Valores inválidos ou versão desatualizada também não causam atualização parcial. O servidor aplica a regra mesmo em chamadas diretas à ação. Consultar ofertas existentes continua permitido; contratações arquivadas permanecem sem edição.

## Catálogo

O filtro de fornecedor passa a select simples, com uma seleção por consulta e opção Todos os fornecedores. O filtro Marca é removido. Buscar item consulta descrição, marca ou modelo e apresenta placeholder explicativo. A seleção múltipla com pesquisa permanece no formulário do produto.

## Implantação

Não há nova migration. Os valores são derivados dos campos já existentes e a situação utiliza opções já disponíveis. Atualizar a branch, revisar o PR e executar o deploy habitual após autorização. Neon e produção não foram alterados nesta entrega.

## Validação

116 testes unitários, 50 testes de integração em PostgreSQL local e 8 testes Chromium aprovados, totalizando 174. TypeScript, ESLint e build de produção aprovados. Os cenários incluem confirmação/cancelamento, atualização atômica, histórico limitado, perdas e percentuais ponderados, dados pendentes, menu recolhível e pesquisa por modelo no catálogo.
