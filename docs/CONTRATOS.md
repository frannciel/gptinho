# Contratos e Fornecimento

## Fluxo operacional

A tela **Contratos** lista **Termos de Contrato** e **Empenhos substitutivos** independentes. Empenhos contábeis são referências opcionais dos **Pedidos**. O agrupamento Negócio comercial não faz parte da operação atual.

```mermaid
flowchart TD
    ORG["Órgão público pesquisado"] --> CT["Termo ou Empenho substitutivo"]
    LIC["Contratação de origem opcional<br/>Pesquisada por identificação, objeto ou órgão"] -. "Herda órgão e itens vencedores" .-> CT
    CT --> IT["Itens: quantidade inicial e atualizada<br/>Preço inicial e atualizado"]
    CT --> PER["Períodos de execução"]
    PER --> PED["Pedidos: quantidade solicitada e fornecida<br/>Snapshot do preço e período de origem"]
    PED --> EMP["Número e emissão do empenho opcionais"]
    PED --> NF["Nota fiscal: número, data, valor e chave opcional<br/>Sem cadastro de itens"]
    NF --> REC["Recebimentos parciais ou integrais"]
    CT --> GAR["Garantias opcionais"]
    CT --> AD["Aditivos: Acréscimo, Supressão, Prorrogação,<br/>Renovação ou Múltiplas Alterações"]
    CT --> AP["Apostilamento: Reajuste ou Repactuação"]
    AD -. "Renovação de contrato continuado" .-> PER
    AD -. "Quantidades e/ou preços" .-> IT
    AP -. "Novo preço unitário" .-> IT
```

O diagrama é operacional. O armazenamento interno `ContractCase` permanece por compatibilidade; cada contrato novo tem sua própria base. Não existe entidade Entrega: o fornecimento é acompanhado diretamente no Pedido.

## Cadastro e pesquisa

- Escolha **Termo de Contrato** ou **Empenho substitutivo**.
- **Contratação de origem** e **Órgão público** são campos de pesquisa remota, com consultas paginadas de até 20 resultados e opção de carregar mais. A página não carrega as listas completas.
- A pesquisa de contratação aceita identificação, objeto ou órgão. A pesquisa de órgão aceita nome, sigla ou CNPJ.
- Selecionar a origem preenche o órgão automaticamente e carrega os itens vencedores com preço e quantidade disponível. Sem origem, selecione o órgão e cadastre os itens manualmente depois de salvar.
- O Termo usa data de assinatura e vigência; não há campo genérico Data do instrumento. O Empenho substitutivo usa sua data de emissão.
- **Continuado** identifica contratos cuja quantidade pode ser renovada para novos períodos. A renovação por aditivo continua disponível nos Termos, conforme o escopo anterior de aditivos do MVP.
- **Link da publicação** é opcional e tem ajuda para PNCP ou Diário Oficial da União, do Estado ou do Município.
- **Link do diretório ou documento** tem o mesmo nome nos formulários. São links HTTP/HTTPS; não há upload nem armazenamento local persistente.

As buscas e alterações exigem autenticação de administrador. Consultas não ficam em cache público; respostas antigas de pesquisa são canceladas quando a seleção muda.

## Valor original e valor atualizado

| Campo            | Significado                                                                      | Como alterar                                                                                    |
| ---------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Valor original   | Referência original do instrumento.                                              | Pela edição do contrato, inclusive após Pedidos ou alterações contratuais, mantendo auditoria.  |
| Valor atualizado | Valor vigente do período, calculado desde a base original e os atos registrados. | É recalculado ao alterar o original e ao registrar, cancelar ou excluir alterações contratuais. |

No cadastro inicial, os dois valores começam iguais. Ao corrigir o original, o backend atualiza a base de cálculo e reaplica, em ordem, aditivos, apostilamentos e renovações. Pedidos e notas anteriores mantêm seus próprios valores e preços gravados.

`amount` armazena o original; `initialCurrentAmount` mantém a base de cálculo sincronizada com o original corrigido; `currentAmount` persiste o resultado atualizado. O valor atualizado não é um campo livre da edição.

**Valores absolutos posteriores continuam sendo respeitados.** Se um aditivo fixa o total atualizado do contrato, esse total pode produzir o mesmo resultado após o recálculo do original. A operação sempre recalcula; ela não ignora o valor fixado pelo documento posterior.

O valor atualizado é comparado com o somatório dos itens atualizados do período. Diferenças em centavos geram alerta, sem impedir salvar um cadastro cujo preenchimento de itens ainda está em andamento. Valores já faturados continuam protegidos: uma correção que reduza indevidamente o orçamento abaixo do utilizado é revertida integralmente.

### Quantidades e precisão

- Quantidades novas são **inteiras**, sem casas decimais, nos itens do contrato, Pedidos, fornecimento e variações quantitativas dos aditivos.
- A apresentação remove casas decimais sem significado: `100.000` é mostrado como `100`.
- Valores fracionários legados não são arredondados nem truncados pela migração. São sinalizados para revisão e continuam identificáveis com seu valor exato; novas alterações de quantidade exigem números inteiros.
- A escala `Decimal(18,3)` permanece no banco por compatibilidade com esse histórico. A validação de novos dados exige quantidade matematicamente inteira.
- Preços unitários iniciais, atualizados e novos preços dos atos: `Decimal(18,4)`.
- Valores monetários de contrato, período, nota, garantia e recebimento: `Decimal(18,2)`.
- Cálculos exatos com inteiros de escala fixa: total por linha = quantidade × preço, arredondado HALF_UP para centavos. Os totais somam as linhas arredondadas.
- Percentuais dos formulários usam até quatro casas, com divisão exata e arredondamento HALF_UP, sem ponto flutuante financeiro.

## Períodos e contratos continuados

Cada contrato tem um período inicial. Pedidos e notas fiscais guardam o período a que pertencem; cada Pedido novo também guarda seu preço unitário no momento do cadastro.

**Quantidade atualizada** é a quantidade inicial acrescida ou reduzida pelos aditivos. **Quantidade disponível** é a atualizada menos a quantidade comprometida nos Pedidos daquele período.

### Prorrogação

Altera a data final da vigência e conserva o período, os preços e o saldo remanescente. Não renova quantitativos.

### Renovação

Exige contrato marcado como **Continuado** e nova data final posterior à vigente. Abre um novo período, iniciado no dia seguinte ao término anterior, usando a quantidade atualizada completa de cada item e mantendo seu preço atualizado.

```text
Quantidade inicial:                          100
Acréscimo por aditivo:                        10
Quantidade atualizada para cada período:    110
Pedidos do período anterior:                 90
Saldo não pedido ao encerrar:                20

Disponível ao abrir o novo período:         110
Não se transfere a sobra de 20.
```

O registro da Renovação efetiva a transição operacional para o novo período; não há agendamento automático de uma transição futura. O valor atualizado do novo período é a soma desse quantitativo completo pelos preços atualizados. Os valores e saldos dos períodos anteriores continuam no histórico. Por isso, a consulta separa **valor e saldo do período atual** de **faturamento, recebimentos e saldo a receber acumulados**.

Notas emitidas depois da renovação para um Pedido antigo permanecem no período do Pedido e não consomem o orçamento novo. Não é permitido criar Pedidos retroativos no período expirado nem aumentar quantidades de Pedidos daquele período. Correções de registros anteriores continuam sujeitas aos saldos já fornecidos e faturados.

Não é possível retirar a marca Continuado enquanto houver renovação ativa. A renovação mantém a quantidade atualizada e o preço; modificações adicionais devem ser registradas nos atos próprios.

## Aditivos

A guia Aditivos permanece exclusiva do Termo no MVP. Os novos registros utilizam as opções:

| Tipo                 | Regra                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| Acréscimo            | Aumenta quantidade e/ou preço de item; não aceita reduções.                                     |
| Supressão            | Reduz quantidade e/ou preço de item; não aceita aumentos.                                       |
| Prorrogação          | Altera a vigência para uma data final posterior, sem alterar itens ou valor.                    |
| Renovação            | Abre novo período com quantitativo atualizado completo e preço mantido, em contrato continuado. |
| Múltiplas Alterações | Permite combinar as alterações pertinentes, respeitando os saldos e os limites de dados.        |

Os aditivos usam **Data de Assinatura** e registram o **novo preço unitário** de cada item alterado, em vez de acrescentar uma variação monetária ao preço anterior. A variação da quantidade continua sendo um acréscimo ou redução inteiro.

O operador pode informar os novos preços individualmente ou preencher **Variação para todos (%)** e clicar em Aplicar a todos. O percentual incide sobre o preço atualizado de cada item e preenche os novos valores; estes ainda podem ser ajustados individualmente. O percentual não é persistido.

**Valor Atualizado do Contrato (R$, opcional)** representa o total após o aditivo, nunca um valor a somar ao anterior:

- Com zero ou vazio, o backend soma os totais de **todos** os itens após a alteração e grava esse total calculado no ato.
- Com valor maior que zero, grava o total informado no documento, respeitando os saldos utilizados e mantendo o alerta de eventual divergência com os itens.
- Prorrogação preserva o valor e o período; Renovação segue a regra própria de abertura de período. Esses formulários não oferecem alteração de preço ou total.

Novos atos persistem `ContractAmendment.updatedAmount` como total atualizado e `ContractAmendmentItem.unitPrice` como novo preço unitário. As colunas antigas de variação monetária ficam mantidas apenas para compatibilidade e histórico. Não se aplicam simultaneamente o novo preço e a variação antiga.

Documentos novos não podem anteceder a última alteração ativa registrada. Datas e valores originais, Pedidos e notas anteriores não são reescritos. Registros antigos com tipo textual são preservados como legados; a migração não presume que um texto antigo representava uma renovação real.

## Apostilamento

A guia Apostilamento registra:

- Número, Data de Assinatura e Tipo (**Reajuste** ou **Repactuação**).
- Link do diretório ou documento e Observações opcionais.
- Novos preços unitários dos itens afetados.

O operador pode digitar o **novo valor** para calcular a variação percentual ou informar a **variação percentual** para calcular o novo valor. **Variação para todos (%)** e o botão Aplicar a todos preenchem os percentuais das linhas, que ainda podem ser ajustadas individualmente.

Somente o novo valor unitário de cada item alterado é persistido. Percentuais individuais e a variação para todos não são gravados. O backend valida os novos valores e recalcula o valor atualizado; não confia em um total simulado pelo navegador.

Se o preço anterior for zero e o novo for positivo, não existe percentual finito de variação: a interface orienta informar diretamente o novo preço. Variações que produzam preço negativo são recusadas, mesmo que o arredondamento pudesse ocultar um negativo muito pequeno.

Preços de Pedidos anteriores são preservados. Um Pedido posterior usa o preço atualizado resultante do apostilamento.

## Pedidos e notas fiscais

O Pedido mantém referência opcional, data, prazo, observações, número e emissão do empenho opcionais e suas quantidades solicitadas/fornecidas. No Empenho substitutivo, número e emissão são preenchidos automaticamente a partir do próprio instrumento, inclusive pelo backend quando chegam vazios.

Um Pedido válido muda automaticamente a situação **Em preparação → Em execução**, na mesma transação. Pedidos inválidos não alteram a situação. Contratos encerrados ou cancelados não recebem novos Pedidos.

A Nota Fiscal agora é um registro simples de um **Pedido obrigatório**, com número, data de emissão, valor, Chave de Acesso alfanumérica opcional, link e observações. Não há formulário nem tabela operacional de itens da nota. Várias notas parciais podem ser registradas para o mesmo Pedido, respeitando seus saldos financeiros e os do período.

A Chave de Acesso aceita até 100 caracteres alfanuméricos, sem exigir exclusivamente 44 dígitos. Não há emissão de NF-e, validação fiscal da chave ou consulta automática à fazenda pública.

Recebimentos continuam na própria nota, parciais ou integrais, sem ultrapassar o saldo e sem data anterior à emissão. Encerrar o contrato não apaga obrigações nem impede recebimentos válidos. Cancelar uma nota com recebimentos continua bloqueado; a exclusão definitiva é uma operação distinta e exige confirmação da perda também desses recebimentos.

## Destaques dos status

Pedidos e notas fiscais usam badges com texto, ícone, borda e fundo:

- Pendente / A receber: amarelo.
- Parcialmente fornecido / Parcialmente recebida: azul.
- Fornecido / Recebida: verde.
- Cancelado / Cancelada: cinza.

O significado continua disponível em texto, sem depender apenas da cor. As regras de cálculo das situações permanecem as mesmas.

## Garantias

São opcionais e usam as opções:

- Caução em dinheiro.
- Caução títulos da dívida pública.
- Seguro-garantia.
- Fiança bancária.
- Título de capitalização.

Textos antigos são mantidos no histórico. Ao editar um registro legado com tipo fora dessas opções, o operador precisa escolher uma opção da lista para salvar.

## Exclusões definitivas

Todas as exclusões exigem administrador, confirmação explícita de irreversibilidade e versão atual dos dados. A trilha de auditoria registra o antes/depois e permanece após a exclusão; não existe função de desfazer na interface.

| Registro excluído | Efeito confirmado no alerta                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contrato          | Apaga seus itens, períodos, Pedidos, notas, recebimentos, garantias, aditivos e apostilamentos. Não apaga órgão, catálogo ou contratação de origem.     |
| Pedido            | Apaga seus itens, notas vinculadas e respectivos recebimentos, liberando seu comprometimento de quantidade.                                             |
| Nota Fiscal       | Apaga a nota, seus recebimentos e eventuais linhas históricas legadas. Não apaga o Pedido.                                                              |
| Aditivo           | Remove o registro e recalcula seus efeitos. Deve respeitar alterações posteriores e quantidades/valores já utilizados.                                  |
| Apostilamento     | Remove o registro e recalcula os preços/valores vigentes, sem reescrever Pedidos anteriores. Deve respeitar alterações posteriores e saldos utilizados. |

Os alertas de Contrato, Pedido e Nota exibem as quantidades de dependentes que serão apagados. Aditivos/apostilamentos ativos com atos posteriores não podem ser excluídos antes desses atos: remova ou cancele a alteração mais recente primeiro. Renovação com Pedidos ou notas no novo período não pode ser excluída antes desses registros. Uma redução de saldo abaixo do já utilizado faz a transação inteira ser revertida.

Grupos legados com mais de um contrato independente ainda compartilhando itens exigem separação antes de exclusão do contrato; não se apagam outros contratos por suposição. Recebimentos de notas existentes permanecem disponíveis nesses legados.

## Migração, compatibilidade e implantação

Migração nova: `20261123000100_absolute_amendment_prices`, posterior à criação dos períodos e apostilamentos.

Ela adiciona o novo preço unitário dos itens de aditivo e o total atualizado absoluto do cabeçalho. Reconstrói os preços dos aditivos ativos em ordem cronológica, considerando apostilamentos intermediários, e preserva as variações originais como histórico. Aditivos cancelados não são reinterpretados: mantêm a referência legada quando não há um novo preço ativo a converter.

A migração não altera quantidades históricas, saldos dos períodos, Pedidos, notas ou recebimentos. Cabeçalhos antigos continuam identificados como legados e seguem sua semântica anterior; novos cabeçalhos gravam o total absoluto. As mudanças de base original passam a ocorrer explicitamente na edição do contrato, sem uma correção financeira retroativa automática durante o deploy.

Continuam válidas as medidas de compatibilidade da migração anterior: itens antigos de NF são apenas históricos, e preços desconhecidos de Pedidos anteriores não são inventados. Cadastros legados sem valor ou tipo precisam ser completados antes da execução.

Em homologação, com as variáveis já documentadas:

```bash
npm ci
npm run db:generate
npm run db:migrate
npm run build
```

Não há novas variáveis. `db:migrate` executa `prisma migrate deploy`. Não executar `reset`, `db push` ou migrations de desenvolvimento em produção. Aplicar primeiro em homologação com backup e documentos reais. Não remover a expansão de banco ao reverter um deploy, especialmente depois de haver períodos, apostilamentos ou lançamentos financeiros novos.

A migração e os fluxos são testados somente em PostgreSQL descartável neste ambiente. Não há migration automática no Neon nem publicação de produção nesta implementação.

### Verificações desta entrega

- TypeScript, ESLint, Prettier e build Next.js aprovados.
- **289 testes aprovados:** 162 unitários, 110 de integração com PostgreSQL e 17 de navegador.
- Migração aplicada somente ao PostgreSQL descartável local; segunda execução sem pendências, usando o engine oficial WASM do Prisma com o adaptador PostgreSQL neste ambiente.
- Foram verificados o recálculo do original, preços absolutos de aditivos, total automático ou informado, percentuais não persistidos, quantidades inteiras, badges, renovações, exclusões, autenticação e preservação dos dados anteriores.
- Nenhuma migration no Neon nem publicação de produção foi executada nesta entrega.
