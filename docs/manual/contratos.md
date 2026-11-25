# Manual de uso — Contratos

[Voltar ao índice do manual](../MANUAL_USUARIO.md) · [Consultar Contratações](contratacoes.md)

## 1. Entender os registros

A lista **Contratos** contém dois instrumentos independentes:

| Instrumento          | Quando utilizar                                             |
| -------------------- | ----------------------------------------------------------- |
| Termo de Contrato    | Quando houver um contrato formal com assinatura e vigência. |
| Empenho substitutivo | Quando a nota de empenho substituir o termo de contrato.    |

Uma nota de empenho usada apenas como referência contábil deve ser registrada no **Pedido**, sem criar outro contrato. O antigo agrupamento chamado Negócio comercial não faz parte da operação atual.

A execução é organizada por itens, períodos e Pedidos. O fornecimento é informado diretamente no Pedido; não existe uma tela separada de Entregas.

## 2. Criar um contrato

1. Abra **Contratos → Novo contrato**.
2. Escolha **Termo de Contrato** ou **Empenho substitutivo**.
3. Se houver, pesquise a **Contratação de origem (opcional)** por identificação, objeto ou órgão.
4. Ao selecionar a origem, confira o órgão preenchido e os itens vencedores carregados.
5. Sem origem, pesquise e selecione o **Órgão público** por nome, sigla ou CNPJ.
6. Preencha número, valor original e datas exigidas pelo tipo de instrumento.
7. Marque **Continuado** somente quando aplicável e confira a **Situação**.
8. Inclua publicação, documento e observações, se disponíveis.
9. Confira os itens selecionados e suas quantidades e salve.

### Campos principais

| Campo                                               | Orientação                                                                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Número do contrato / Número do empenho substitutivo | Referência do instrumento formalizado.                                                                             |
| Valor original (R$)                                 | Valor original do instrumento, com centavos. Deve ser conferido com o total de seus itens.                         |
| Situação                                            | Em preparação, Em execução, Encerrado ou Cancelado. O padrão inicial é Em preparação.                              |
| Continuado                                          | Permite o fluxo de renovação de quantitativos por aditivo nos Termos de Contrato. Não cria renovações automáticas. |
| Data de assinatura                                  | Data de assinatura do Termo. Não há outro campo genérico Data do instrumento.                                      |
| Início da vigência / Fim da vigência                | Datas do período contratual do Termo.                                                                              |
| Data de emissão do empenho                          | Obrigatória no Empenho substitutivo.                                                                               |
| Prazo de fornecimento (se aplicável)                | Data aplicável ao Empenho substitutivo, quando prevista.                                                           |
| Link da publicação                                  | Endereço no PNCP ou Diário Oficial da União, Estado ou Município. Consulte a ajuda do campo.                       |
| Link do diretório ou documento                      | Endereço externo do instrumento e seus documentos. Não é envio de arquivo para o sistema.                          |

### Utilizar itens da contratação de origem

O sistema carrega itens **vencedores, com oferta vencedora e quantidade ainda disponível para contratação**. Confira quais serão incluídos e a quantidade de cada um. A quantidade já vinculada a outros contratos reduz a disponibilidade.

Se não aparecer um item esperado, revise a contratação: marcação de vencedor, preço da oferta, quantidade já contratada e eventual arquivamento. Selecionar a origem também preenche o órgão; confira essa informação antes de salvar.

Sem origem, salve o instrumento e inclua manualmente seus itens em **Dados gerais**.

## 3. Consultar dados e cadastrar itens manualmente

Na lista **Contratos**, pesquise por número, órgão ou contratação de origem e abra o registro. As guias são **Dados gerais**, **Pedidos**, **Notas Fiscais**, **Garantias**, **Aditivos** e **Apostilamento**. **Aditivos** aparece apenas no Termo de Contrato.

Para um item manual, informe número, descrição, unidade, marca/modelo quando aplicáveis, **Quantidade** e **Preço unitário contratado (R$, até 4 casas)**. Salve e confira o total.

Novas quantidades de itens de contrato, Pedidos, fornecimento e variações quantitativas de aditivos devem ser **inteiras**. Registros antigos fracionários podem aparecer sinalizados para revisão, sem arredondamento automático do histórico.

O preço unitário admite quatro casas decimais; o total é arredondado para centavos por item e os totais das linhas são somados. Não confunda preço unitário com total contratado.

### Valor original e valor atualizado

| Valor      | Como funciona                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| Original   | Pode ser corrigido em **Editar contrato**, mantendo o histórico.                                                         |
| Atualizado | É recalculado a partir do original e das alterações contratuais registradas. Não é um campo livre da edição do contrato. |

No início, ambos são iguais. Corrigir o original provoca novo cálculo, preservando os atos posteriores: se um aditivo já fixou um total absoluto, o atualizado pode continuar com esse mesmo total. Pedidos e notas anteriores não têm seus preços reescritos por essa correção.

O sistema compara o valor atualizado com a soma dos itens, até os centavos. Uma divergência gera **alerta**, inclusive enquanto o cadastro de itens está em andamento; não significa que os valores estejam conciliados. Confira instrumento, quantidades e preços e corrija a origem da diferença.

Reduções que violem valores já utilizados são bloqueadas. Não exclua o histórico para forçar uma redução incompatível com a execução.

## 4. Entender os saldos e períodos

- **Quantidade inicial:** quantidade originalmente cadastrada.
- **Quantidade atualizada:** inicial acrescida ou reduzida pelos aditivos.
- **Quantidade disponível:** atualizada menos a comprometida pelos Pedidos do período.
- **Preço atualizado:** preço vigente após aditivos e apostilamentos.

Cadastrar um Pedido compromete a quantidade solicitada. Atualizar o fornecimento não devolve essa quantidade ao disponível: ela já foi reservada pelo Pedido.

Cada Pedido guarda o período e o preço unitário de seu cadastro. Por isso, pedidos antigos não adotam automaticamente preços alterados depois.

Em contratos continuados, confira separadamente os valores e saldos do **período atual** e os valores acumulados de faturamento e recebimento. Uma nota de um Pedido antigo continua pertencendo ao período desse Pedido, mesmo quando emitida depois da renovação.

## 5. Cadastrar um Pedido

1. Abra o contrato e a guia **Pedidos**.
2. Em **Novo pedido**, informe a referência, se utilizada, a **Data do pedido** e o **Prazo de fornecimento**.
3. Preencha **Número do empenho (opcional)** e **Data de emissão do empenho (opcional)** quando aplicáveis.
4. Informe as quantidades inteiras solicitadas para os itens necessários, respeitando o disponível.
5. Complete link e observações, quando aplicáveis, e salve.
6. Confira os itens, o total e o status do Pedido registrado.

No **Empenho substitutivo**, número e emissão do empenho são preenchidos a partir do próprio instrumento quando esses campos estão vazios.

Um Pedido válido muda automaticamente o contrato de **Em preparação** para **Em execução**. Não é necessário confirmar outro alerta para essa transição. Pedidos inválidos não alteram a situação. Contratos encerrados ou cancelados não aceitam novos Pedidos.

### Alterar os dados do Pedido

Use a edição de dados do Pedido para corrigir referência, datas, empenho e quantidades quando permitido. O sistema protege quantidades já fornecidas e valores faturados. Não é permitido aumentar quantidades de Pedidos de um período já expirado nem criar novos Pedidos retroativos nesse período.

## 6. Registrar o fornecimento

1. Localize o Pedido na guia **Pedidos**.
2. Na coluna de fornecimento, informe o **total acumulado** já fornecido de cada item.
3. Salve e confira **Fornecido acumulado**, **Pendente** e o status.

**Exemplo:** um Pedido tem 10 unidades. A primeira entrega foi de 3: informe **3**. Depois foram entregues mais 2: atualize para **5**, e não para 2. Ao concluir, informe **10**.

O fornecido não pode ultrapassar o solicitado. Use o registro efetivo do fornecimento; a leitura de uma notificação de entrega não atualiza essas quantidades.

| Status do Pedido       | Significado                                                |
| ---------------------- | ---------------------------------------------------------- |
| Pendente               | Ainda não houve fornecimento.                              |
| Parcialmente fornecido | Há fornecimento, mas ainda existe quantidade pendente.     |
| Fornecido              | As quantidades solicitadas foram integralmente fornecidas. |
| Cancelado              | O Pedido foi cancelado.                                    |

Os status usam cores e texto: amarelo, azul, verde e cinza, respectivamente.

## 7. Registrar Nota Fiscal e recebimentos

O objetivo desta guia é **registrar a nota de um Pedido**, sem gestão fiscal detalhada nem cadastro dos itens da nota.

### Cadastrar a nota

1. Abra **Notas Fiscais** e o formulário **Nova nota fiscal**.
2. Selecione o **Pedido** correspondente, observando seu período.
3. Informe **Número da nota fiscal**, **Data de emissão** e **Valor da nota fiscal (R$)**.
4. Preencha a **Chave de Acesso (opcional)**, se disponível.
5. Acrescente o link e as observações necessários e salve.

O Pedido é obrigatório e não pode estar cancelado. Podem existir notas parciais para um mesmo Pedido, respeitando os limites de valor do Pedido e do período.

A Chave de Acesso é alfanumérica e aceita até 100 caracteres. Seu registro não emite NF-e, não valida a chave fiscalmente e não faz consulta automática à Fazenda.

### Registrar recebimento

1. Localize a nota.
2. Informe **Data do recebimento** e **Valor recebido (R$)** no formulário da própria nota.
3. Salve e confira o saldo a receber e o status.
4. Para outro pagamento parcial, registre um novo recebimento.

O recebimento não pode ultrapassar o saldo nem ter data anterior à emissão da nota. Encerrar o contrato não impede o registro de recebimentos válidos de notas existentes.

| Status da nota        | Significado                  |
| --------------------- | ---------------------------- |
| A receber             | Sem recebimento registrado.  |
| Parcialmente recebida | Parte do valor foi recebida. |
| Recebida              | Valor integral recebido.     |
| Cancelada             | Nota cancelada.              |

O registro não executa operação bancária nem substitui a contabilidade. A ampliação financeira permanece fora do MVP.

## 8. Registrar garantia

1. Abra **Garantias**.
2. Selecione o **Tipo de garantia**.
3. Informe valor, validade, situação e, se necessário, link e observações.
4. Salve e confira o registro.

As opções são **Caução em dinheiro**, **Caução títulos da dívida pública**, **Seguro-garantia**, **Fiança bancária** e **Título de capitalização**.

O cadastro é opcional. Ao editar um registro antigo cujo tipo não corresponda à lista atual, selecione uma opção válida antes de salvar. A validade informada serve de referência aos avisos de prazo da central de notificações.

## 9. Registrar termo aditivo

A guia **Aditivos** está disponível nos **Termos de Contrato**.

1. Abra a guia e preencha o número e a **Data de Assinatura**.
2. Escolha o tipo de alteração compatível com o documento.
3. Preencha a nova vigência, as variações de quantidade e/ou os novos preços que o tipo permitir.
4. Se aplicável, confira **Valor Atualizado do Contrato (R$, opcional)**.
5. Informe link e observações e salve.
6. Confira os quantitativos, preços, vigência e valor atualizado resultantes.

| Tipo                 | Efeito permitido                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| Acréscimo            | Aumento da quantidade e/ou preço; não admite reduções.                                                    |
| Supressão            | Redução da quantidade e/ou preço; não admite aumentos.                                                    |
| Prorrogação          | Estende a vigência, preservando período, saldo, preços e valor.                                           |
| Renovação            | Abre novo período em contrato continuado, com reposição do quantitativo atualizado e manutenção do preço. |
| Múltiplas Alterações | Combina as alterações pertinentes, respeitando as validações de saldo.                                    |

### Quantidade: informe a variação

Para passar de 100 para 110 unidades, informe **10** de acréscimo, não 110. Para passar de 100 para 90, informe **−10** de supressão. As variações são inteiras e não podem produzir saldos incompatíveis com o já utilizado.

### Preço: informe o novo valor unitário

Para mudar um preço de R$ 100,00 para R$ 110,00, registre **110,00** como novo preço, não 10,00. O sistema registra o novo preço, não uma variação monetária a somar.

Para aplicar a mesma alteração percentual, preencha **Variação para todos (%)** e clique em **Aplicar a todos**. O sistema calcula novos preços a partir dos preços atualizados. Confira cada linha e ajuste individualmente quando necessário. Esse percentual é uma ferramenta de preenchimento e não fica registrado como parâmetro permanente do ato.

### Valor Atualizado do Contrato

Esse campo representa o **total do contrato após o aditivo**, não o valor do acréscimo ou da supressão.

- **Vazio ou zero:** o sistema calcula o total pelos itens após a alteração.
- **Maior que zero:** utiliza o total informado, respeitando os limites já utilizados e alertando sobre divergência com os itens.

Os formulários de Prorrogação e Renovação seguem suas regras próprias e não oferecem alteração de preço ou total.

**Exemplo ilustrativo:** 100 unidades a R$ 100,00 passam a 110 unidades a R$ 110,00. Informe variação quantitativa **10** e novo preço **110,00**. O total calculado é **R$ 12.100,00**; esse é o total atualizado, não um acréscimo de R$ 12.100,00 ao anterior.

## 10. Distinguir Prorrogação de Renovação

| Aspecto             | Prorrogação                                  | Renovação                                      |
| ------------------- | -------------------------------------------- | ---------------------------------------------- |
| Vigência            | Nova data final posterior à vigente.         | Nova data final posterior; abre outro período. |
| Saldo de quantidade | Mantém o remanescente.                       | Reinicia com a quantidade atualizada completa. |
| Sobra anterior      | Continua no mesmo período.                   | Não é somada ao novo quantitativo.             |
| Preços              | Mantidos.                                    | Mantidos nos valores atualizados.              |
| Continuado          | Não é a reposição de um contrato continuado. | Exige a marca Continuado.                      |

**Exemplo de Renovação:** quantidade inicial de 100, acréscimo de 10 por aditivo e Pedidos de 90 deixam 20 disponíveis no período anterior. O novo período começa com **110 disponíveis**, não 130 e não 20.

O início do novo período é o dia seguinte ao fim anterior. O valor do novo período é calculado pela quantidade atualizada completa × preços atualizados.

**Atenção:** registrar a Renovação já efetiva a mudança operacional de período. Não existe agendamento para o sistema esperar uma data futura e só então renovar. Confira o momento de registrar e conclua a revisão do período anterior.

Os registros anteriores permanecem no histórico. Novas notas de Pedidos antigos continuam vinculadas ao período antigo. Não é possível retirar Continuado enquanto houver Renovação ativa.

## 11. Registrar Apostilamento

1. Abra **Apostilamento**.
2. Informe **Número**, **Data de Assinatura** e **Tipo**: **Reajuste** ou **Repactuação**.
3. Em cada item afetado, digite o novo valor unitário ou a variação percentual. O sistema calcula o outro campo.
4. Para a mesma variação em todos, utilize **Variação para todos (%) → Aplicar a todos** e confira as linhas.
5. Complete link e observações e salve.
6. Confira os novos preços e o valor atualizado.

Somente os **novos valores unitários** são mantidos para aplicação do ato; os percentuais são auxiliares de preenchimento. Se o preço anterior for zero e passar a positivo, informe diretamente o novo preço, pois não existe percentual finito de aumento a partir de zero. Preços negativos são recusados.

Apostilamento altera preços, não repõe quantidades. Pedidos já cadastrados preservam seus preços; os novos usam os preços atualizados.

### Ordem das alterações

Registre os atos na ordem correta. Um documento novo não pode anteceder a última alteração ativa. Para corrigir atos anteriores, pode ser necessário tratar primeiro os posteriores. Não reescreva uma sequência documental com valores incompatíveis com Pedidos ou faturamento já existentes.

## 12. Encerrar ou cancelar

Para atualizar a situação do instrumento, use **Editar contrato**. Antes de marcar **Encerrado** ou **Cancelado**, confira Pedidos, fornecimentos, notas e saldos pendentes. A mudança não apaga esses registros nem comprova a quitação das obrigações.

**Cancelar pedido**, **Cancelar nota fiscal** e **Cancelar aditivo**, quando disponíveis, preservam o registro como cancelado e são diferentes da exclusão definitiva. O sistema verifica a consistência dos saldos. Uma nota com recebimentos não pode ser cancelada.

Cancelar um formulário, por outro lado, apenas abandona a edição não salva. Leia a confirmação para identificar qual ação está sendo realizada.

## 13. Excluir registros com segurança

Não existe desfazer para exclusões. Confira o instrumento, número, vínculos e quantidades informadas no alerta antes de confirmar. Para um registro válido que apenas deixou de estar em execução, avalie atualizar a situação em vez de excluir.

| Registro excluído | Consequência                                                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contrato          | Apaga seus itens, períodos, Pedidos, notas, recebimentos, garantias, aditivos e apostilamentos. Preserva órgão, contratação de origem e catálogo.     |
| Pedido            | Apaga seus itens, notas vinculadas e respectivos recebimentos; libera o comprometimento de quantidade correspondente, conforme as regras de execução. |
| Nota Fiscal       | Apaga a nota e seus recebimentos. Não apaga o Pedido.                                                                                                 |
| Aditivo           | Remove o ato e recalcula os efeitos, sujeito à sequência documental e aos saldos já utilizados.                                                       |
| Apostilamento     | Remove o ato e recalcula preços e valores vigentes, sem reescrever os Pedidos anteriores.                                                             |

Atos com alterações ativas posteriores exigem tratar primeiro a alteração mais recente. Uma Renovação com Pedidos ou notas no novo período não pode ser excluída antes desses registros. Outros vínculos podem impedir a exclusão; o sistema não reduz saldos abaixo do já utilizado para concluir a operação.

A trilha de auditoria permanece, mas não funciona como restauração dos registros excluídos. Contratos não têm o mesmo fluxo de arquivamento/restauração disponível em Contratações.

## 14. Resolver dúvidas frequentes

| Situação                                                             | O que conferir                                                                                                                                            |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Não encontro a contratação de origem                                 | Pesquise por identificação, objeto ou órgão; confira se a origem está arquivada.                                                                          |
| Não aparecem os itens esperados                                      | Precisam ser vencedores, ter oferta vencedora e quantidade ainda não contratada.                                                                          |
| O órgão mudou ao escolher a origem                                   | É o preenchimento automático pelo órgão da contratação; confira a origem selecionada.                                                                     |
| O valor atualizado não acompanhou diretamente a correção do original | O recálculo reaplica os atos posteriores, inclusive totais absolutos fixados por aditivo.                                                                 |
| Há alerta de diferença de valor                                      | Compare o valor do instrumento com a soma dos totais dos itens em centavos; revise quantidades e preços.                                                  |
| Não consigo pedir a quantidade desejada                              | Confira o saldo do período, os Pedidos já comprometidos e a situação do contrato. Fornecer um Pedido não devolve seu quantitativo ao disponível.          |
| A quantidade fornecida parece diminuir                               | O campo espera o acumulado, não apenas a última entrega.                                                                                                  |
| Não encontro Aditivos                                                | A guia é exclusiva de Termo de Contrato, não de Empenho substitutivo.                                                                                     |
| A Renovação não aceita o cadastro                                    | Confira Continuado, nova data final, ordem dos atos e dados pendentes.                                                                                    |
| A nota não pode ser cancelada                                        | Confira se já há recebimentos; cancelamento e exclusão são operações diferentes.                                                                          |
| Não consigo excluir um ato antigo                                    | Há alterações posteriores ou utilização dos saldos; trate a sequência sem apagar documentos válidos para contornar a proteção.                            |
| A página informa alteração por outro usuário                         | Recarregue e confira a versão atual antes de repetir a edição.                                                                                            |
| Não recebi e-mail de vencimento                                      | O MVP usa central interna e sino; e-mail e WhatsApp não enviam notificações. Confira também o prazo cadastrado e o agendamento com o responsável técnico. |

## Documentos usados nesta edição

[Contratos e Fornecimento](../CONTRATOS.md), [planejamento](../PLANEJAMENTO.md) e [notificações](../NOTIFICACOES.md), confrontados com os formulários e regras atuais. Este capítulo descreve a operação; procedimentos técnicos de implantação não devem ser executados pelo usuário como parte do cadastro.
