# Manual de uso — Contratações

[Voltar ao índice do manual](../MANUAL_USUARIO.md) · [Consultar Contratos](contratos.md)

## 1. Preparar o cadastro

Cadastre o órgão comprador em **Órgãos públicos**. Para utilizar a precificação, cadastre também os fornecedores e os produtos ou serviços no **Catálogo**, relacionando os fornecedores de cada item.

Uma contratação pode ser cadastrada e receber itens antes de concluir esses vínculos. A falta do vínculo com o catálogo precisará ser resolvida para selecionar o fornecedor na precificação.

## 2. Criar uma contratação

1. Abra **Contratações** e selecione a ação de nova contratação.
2. Preencha a **Identificação**, selecione o **Órgão público** e informe o **Objeto**.
3. Complete modalidade, número do processo e demais campos aplicáveis.
4. Informe o **Prazo de apresentação**, com data e hora corretas de Brasília.
5. Confira a **Situação** e marque **Registro de Preços (SRP)** apenas quando aplicável.
6. Cadastre os links e observações necessários e clique em **Salvar**.
7. Abra **Gerenciar itens** para cadastrar os itens da disputa.

| Campo                                | Como utilizar                                                                                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identificação                        | Referência interna que permita localizar o processo, por exemplo `CT-2026-001`.                                                                     |
| Órgão público                        | Órgão principal da contratação; em SRP, é o gerenciador.                                                                                            |
| Prazo de apresentação                | Data limite da proposta e referência da sessão pública para notificações. Confira a ajuda do campo. Não são dois prazos independentes nesta versão. |
| Link da plataforma de licitação      | Endereço da disputa na plataforma de compras.                                                                                                       |
| Pasta na nuvem (anexos da licitação) | Diretório com edital, termo de referência e demais anexos.                                                                                          |
| Registro de Preços (SRP)             | Habilita o cadastro de atas e participantes nas respectivas guias.                                                                                  |

O valor estimado da contratação **não é digitado no cabeçalho**: resulta dos totais de seus itens.

### Situação

O padrão de uma nova contratação é **Em Análise**. As opções são **Em Análise**, **Classificada**, **Cancelada**, **Suspensa**, **Homologada**, **Proposta Cadastrada** e **Encerrada**.

Mantenha a situação coerente com o andamento do processo. Registrar um preço vencedor exige **Classificada** ou **Homologada**, conforme explicado adiante. Situação e arquivamento são controles diferentes: marcar Encerrada não equivale a arquivar.

## 3. Consultar e editar

Localize o registro em **Contratações** e abra sua consulta. As guias organizam o trabalho:

- **Visão geral**: dados do processo, itens, últimas cinco atualizações e Resumo Financeiro.
- **Gerenciar itens**: inclusão, edição, exclusão e marcação de vencedores.
- **Precificação**: custos, fornecedor e preço mínimo viável.
- **Proposta Vencedora**: preços ofertados dos itens vencedores.
- **Registros de preços** e **Participantes**: informações de SRP.

Use **Editar contratação** para alterar o cabeçalho. As inclusões e edições de itens ficam em **Gerenciar itens**, não na tabela da Visão geral.

Os registros são listados do mais recente para o mais antigo. Dentro da contratação, os itens seguem sua numeração.

## 4. Cadastrar ou editar itens

1. Abra **Gerenciar itens** e clique em **Novo item**.
2. No modal, informe o **Número do item**, único nessa contratação.
3. Selecione **Material** ou **Serviço** no campo **Tipo**.
4. Se aplicável, selecione o **Item do catálogo** e confira os dados copiados.
5. Revise descrição completa, marca, modelo, unidade, quantidade e valor estimado unitário.
6. Marque **Vencedor** somente se o item tiver sido ganho e salve.

| Campo          | Regra prática                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------- |
| Descrição      | Pode conter a especificação completa em várias linhas. Não substitua por um resumo que prejudique a proposta. |
| Marca e Modelo | Opcionais. Confira se são compatíveis com o que será ofertado.                                                |
| Quantidade     | Positiva; na contratação, admite até três casas decimais.                                                     |
| Valor estimado | Valor **unitário** de referência, com até quatro casas decimais. Ausência de valor não equivale a zero.       |
| Vencedor       | Indica se o item deve aparecer em Proposta Vencedora. Também pode ser alterado pelo checkbox da tabela.       |

A tabela apresenta Item, Descrição, Marca, Quant., Valor estimado, Preço Mínimo Viável, **Total Estimado** e ações. Use os ícones de edição e exclusão; confira o texto de ajuda da ação. O **Valor Total Estimado** aparece abaixo da relação.

Cada total é quantidade × estimativa unitária, arredondado para centavos. A contratação aceita até **100 itens**. Se faltar estimativa em um deles, o total fica pendente, em vez de apresentar uma soma parcial como se estivesse completa.

### Cópia do catálogo e preservação do histórico

Selecionar um produto do catálogo copia suas características e alíquota para o item. Alterações posteriores no catálogo não substituem automaticamente o que já foi registrado na contratação.

Se trocar o produto vinculado, revise os dados e **refaça a precificação**: a associação anterior pode deixar de ser válida. O fornecedor escolhido na precificação permanece no histórico mesmo que depois seja retirado do produto ou desativado; novas escolhas precisam estar elegíveis no catálogo.

A exclusão de um item é definitiva. Vínculos, como sua utilização em ata, podem impedir a operação.

## 5. Precificar

1. Abra **Precificação**.
2. Na linha do item, selecione um fornecedor entre os relacionados ao respectivo produto no catálogo.
3. Informe **Valor de Aquisição** e **Custo de frete**, ambos por unidade.
4. Confira **Alíquota tributária (%)**, **Custo Administrativo (%)** e **Lucro Líquido (%)**.
5. Salve a linha e confira o **Preço Mínimo Viável** calculado.
6. Repita para os demais itens.

Os valores unitários admitem quatro casas decimais; os percentuais da precificação, duas. Informe zero explicitamente quando não houver aquele custo. A soma de tributos, custo administrativo e lucro líquido precisa ser **menor que 100%**.

```text
Preço Mínimo Viável = (aquisição unitária + frete unitário)
                     ÷ [1 − (tributos + custo administrativo + lucro líquido) ÷ 100]
```

O cálculo definitivo é feito pelo sistema ao salvar. O resultado unitário usa quatro casas decimais. Não informe o frete total do pedido como se fosse frete por unidade.

**Exemplo ilustrativo:** aquisição de R$ 80,00, frete unitário de R$ 5,00, tributos de 10%, custo administrativo de 5% e lucro líquido de 15% produzem preço mínimo de **R$ 121,4286** por unidade.

Se a estimativa for R$ 120,00, o sistema sinaliza que o mínimo supera a referência. Esse alerta **não bloqueia** a participação ou o salvamento; exige análise comercial.

## 6. Registrar a proposta vencedora

1. Em **Gerenciar itens**, marque os itens efetivamente vencedores.
2. Abra **Proposta Vencedora**. Apenas esses itens serão relacionados.
3. Em **Proposta Vencedora**, digite o preço **unitário ofertado que venceu**, com até quatro casas decimais. Use a ajuda do campo em caso de dúvida.
4. Confira o percentual de lucro exibido ao lado e clique em **Salvar**, na coluna **Ações** da mesma linha.
5. Confira os totais das linhas e o total geral ao final da página.

A caixa do percentual de lucro é informativa; ela não salva a linha. O **Preço mínimo** vem da precificação e não é substituído pelo preço vencedor.

Se a situação não for **Classificada** nem **Homologada**, o sistema oferece as opções **Classificada**, **Homologada** ou **Cancelar**. Escolha a situação correta para salvar conjuntamente a alteração e o preço, ou cancele para revisar.

Se faltar o preço de um vencedor, o total da proposta permanece pendente. Desmarcar um vencedor o retira dessa lista, mas preserva sua oferta registrada para eventual nova marcação.

## 7. Interpretar o Resumo Financeiro

Na parte final da **Visão geral**, o **Resumo Financeiro** compara dois cenários:

| Coluna           | Base de receita                                                   |
| ---------------- | ----------------------------------------------------------------- |
| Todos os itens   | Quantidade × valor unitário estimado de cada item.                |
| Itens vencedores | Quantidade × oferta vencedora de cada item marcado como vencedor. |

São somados **Custo de Aquisição**, **Custo de Frete**, **Total de Tributos**, **Custos Administrativos** e **Lucro Líquido**. Tributos e custo administrativo são calculados sobre a receita do respectivo cenário.

```text
Lucro líquido = receita − aquisição − frete − tributos − custos administrativos
Lucro líquido (%) = lucro líquido ÷ receita × 100
```

O percentual total é calculado com os valores somados; não é a média simples dos percentuais dos itens. Lucro positivo e negativo recebem destaque visual. Dados incompletos deixam resultados pendentes; com receita zero, o percentual não é apurável.

**Exemplo ilustrativo:** para 10 unidades vendidas a R$ 130,00, aquisição de R$ 80,00 e frete de R$ 5,00 por unidade, tributos de 10% e custo administrativo de 5%:

| Componente              |         Valor |
| ----------------------- | ------------: |
| Receita                 |   R$ 1.300,00 |
| Aquisição               |     R$ 800,00 |
| Frete                   |      R$ 50,00 |
| Tributos                |     R$ 130,00 |
| Custos administrativos  |      R$ 65,00 |
| Lucro líquido           | **R$ 255,00** |
| Lucro líquido / receita |    **19,62%** |

O resumo é uma análise comercial baseada nos preços e parâmetros registrados. Não comprova faturamento, recebimento ou resultado contábil realizado.

## 8. Cadastrar participantes de SRP

1. Confirme que o cabeçalho está marcado como **Registro de Preços (SRP)**.
2. Abra **Participantes** e clique em **Adicionar participante**.
3. Pesquise e selecione um órgão público elegível no modal e salve.
4. Repita para os demais participantes.

O órgão principal é o **gerenciador** e não pode ser incluído como participante. O mesmo órgão não pode ser adicionado duas vezes. Para novos vínculos, o órgão precisa estar ativo; sua posterior desativação não apaga o vínculo histórico.

Remover um participante retira sua relação com a contratação, sem excluir o cadastro do órgão. Para trocar o gerenciador por um órgão que já é participante, primeiro remova essa participação.

## 9. Cadastrar ata de registro de preços

1. Abra **Registros de preços** e clique em **Nova ata**.
2. Preencha **Número da ata**, **Data de assinatura** e **Data de validade**.
3. Marque **Permite Adesão** quando previsto no documento.
4. Informe, se necessário, **Link do diretório ou documento** e **Observações**.
5. Selecione ao menos um item da contratação e confira os dados copiados.
6. Salve. Para corrigir, use **Editar ata** e revise o modal.

O número da ata não pode se repetir na mesma contratação. A validade não pode anteceder a assinatura. O item precisa ter preço: o sistema utiliza a oferta vencedora quando informada; caso contrário, utiliza a estimativa.

A ata preserva os dados copiados de número, descrição, quantidade e preço. Alterações posteriores no item de origem ou simples edição dos dados da ata não os atualizam automaticamente. Remover e incluir novamente um item faz uma nova cópia dos dados atuais.

**Limite do MVP:** a coluna **Disponível** corresponde ao quantitativo registrado na ata. Não há baixa automática por contratos, Pedidos ou adesões, nem reserva global entre atas. **Permite Adesão** é uma informação cadastral; não inicia um fluxo de adesão no sistema.

**Excluir ata** exige confirmação e remove o registro definitivamente. Não é possível desmarcar SRP enquanto houver atas ou participantes vinculados. Contratações arquivadas não permitem essas alterações.

## 10. Importar itens de um arquivo JSON

Use a importação quando os itens forem extraídos de um termo de referência por um agente externo. O arquivo não altera o órgão, o cabeçalho ou a situação da contratação.

1. Baixe o modelo na tela de importação ou consulte o [exemplo de itens da contratação](../arquivos/contratacao-v1.exemplo.json).
2. Entregue o documento e as [instruções do agente extrator](../AGENTE_EXTRATOR.md) ao responsável pela preparação do JSON.
3. Se o arquivo referenciar produtos de uma carga do catálogo, importe primeiro o catálogo em **Catálogo → Importar JSON**. Há um [modelo próprio de catálogo](../arquivos/catalogo-v1.exemplo.json).
4. Abra a contratação de destino e escolha **Gerenciar itens → Importar JSON**.
5. Selecione o arquivo e clique em **Validar e visualizar**.
6. Confira descrição, numeração, unidade, quantidade, estimativa e vínculos apresentados na prévia.
7. Corrija os erros ou o arquivo quando necessário. Quando estiver correto, clique em **Confirmar importação**.
8. Confira a confirmação e os itens cadastrados. Complete os vínculos pendentes antes de precificar.

### Regras do arquivo

- JSON em UTF-8, versão `"1.0"`, até **2 MiB** e **100 itens**. O limite total da contratação continua sendo 100 itens.
- Quantidades e valores são textos decimais com ponto e sem separador de milhar. Exemplo: `"1000.1250"`. **`"1.000"` significa um, não mil.** Não use `"1.000,00"`.
- O `loteId` identifica a carga do arquivo; não é o lote comercial da licitação. Mantenha essa identificação estável para evitar reenvios duplicados.
- Não inclua vencedor, oferta vencedora, custos internos ou seleção de fornecedor da precificação.
- Itens podem ficar sem vínculo com o catálogo, com aviso, para associação posterior. Quando houver referência a um catálogo importado, essa carga precisa existir primeiro.
- Fornecedores informados na importação do catálogo devem estar previamente cadastrados e ativos. Quando ausentes no arquivo, a tela permite completar fornecedores e alíquota padrão para os produtos.

A prévia **não salva**. A confirmação valida tudo novamente: um erro impede a carga inteira, sem importação parcial. Numeração já existente bloqueia a importação; o processo não atualiza nem sobrescreve itens cadastrados. Reenviar a mesma carga não duplica seus registros. Mudar o `loteId` não autoriza sobrescrever itens existentes.

Para detalhes de todos os campos, consulte os [formatos oficiais de importação e exportação](../ARQUIVOS_IMPORTACAO_EXPORTACAO.md). Os exemplos contêm dados ilustrativos e devem ser substituídos pelos dados reais.

## 11. Exportar dados para elaborar uma proposta

1. Na consulta da contratação, clique em **Exportar proposta**.
2. Escolha **Itens vencedores** ou **Todos os itens**.
3. Escolha **JSON** ou **Markdown** e baixe o arquivo.
4. Entregue o arquivo e o modelo de proposta ao agente externo.
5. Revise o documento elaborado antes de utilizá-lo comercialmente.

| Seleção          | Preços exportados                                                                     |
| ---------------- | ------------------------------------------------------------------------------------- |
| Itens vencedores | Ofertas unitárias registradas dos itens marcados como vencedores.                     |
| Todos os itens   | Valores estimados de referência; não são automaticamente preços comerciais aprovados. |

A exportação inclui dados da empresa, órgão e contatos, processo e itens com descrição completa, quantidades, preços e totais. Não inclui custos de aquisição, frete interno, fornecedor, preço mínimo, lucro ou notas internas.

Conjunto vazio ou preço ausente impede a exportação. Revise também as pendências cadastrais indicadas. O formato Markdown disponibiliza os dados em bloco JSON para leitura pelo agente. O Govnex não se comunica diretamente com o agente nem produz automaticamente o documento final da proposta.

## 12. Arquivar, restaurar ou excluir

| Ação                | Quando utilizar e efeito                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Arquivar            | Retirar a contratação da operação corrente, preservando dados e histórico. Revise e salve as edições antes de arquivar.                    |
| Restaurar           | Reabrir uma contratação arquivada para permitir novas alterações.                                                                          |
| Excluir contratação | Remover definitivamente a contratação e seus itens, precificações e ofertas, após confirmação. Não exclui órgão, fornecedores ou catálogo. |

Uma contratação **arquivada não pode ser excluída**. Contratos associados impedem a exclusão. Atas e participantes devem ser removidos explicitamente antes; outros vínculos impeditivos também precisam ser tratados. Não exclua documentos válidos apenas para contornar um bloqueio: prefira manter o histórico e arquivar quando esse for o objetivo.

## 13. Resolver dúvidas frequentes

| Situação                                                         | O que conferir                                                                                                       |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Não encontro fornecedor para precificar                          | Vínculo do item ao catálogo, relação de fornecedores desse produto e situação ativa do fornecedor para nova seleção. |
| Um fornecedor antigo aparece, embora não esteja mais no catálogo | É o fornecedor histórico preservado na contratação. Isso é esperado.                                                 |
| O total estimado está pendente                                   | Há item sem estimativa unitária; zero precisa ser informado quando for realmente o valor correto.                    |
| O cálculo do mínimo não é aceito                                 | Percentuais devem somar menos de 100%; confira também os valores e campos obrigatórios.                              |
| O mínimo aparece em alerta                                       | Ele supera a estimativa. O alerta não bloqueia a operação, mas exige avaliação comercial.                            |
| Não vejo um item na proposta vencedora                           | Confira a marcação Vencedor em Gerenciar itens.                                                                      |
| A ata ou participante não pode ser cadastrado                    | Confira SRP e se a contratação está arquivada.                                                                       |
| A importação acusa número repetido                               | O número precisa ser único no arquivo e na contratação. Não é uma função de atualização em lote.                     |
| O registro mudou enquanto eu editava                             | Recarregue, compare os dados e refaça a alteração sobre a versão atual.                                              |
| Preciso formalizar o fornecimento                                | Abra **Contratos** e cadastre o instrumento, selecionando esta contratação como origem quando aplicável.             |

## Documentos usados nesta edição

[Contratações](../CONTRATACOES.md), [precificação](../PRECIFICACAO.md), [situação e margem sobre receita](../CONTRATACOES_EXCLUSAO_MARGEM.md), [fornecedor histórico](../FORNECEDOR_HISTORICO.md), [registro de preços](../REGISTRO_PRECOS.md) e [arquivos](../ARQUIVOS_IMPORTACAO_EXPORTACAO.md), confrontados com as telas e regras atuais. Trechos históricos desses documentos não substituem as orientações operacionais acima.
