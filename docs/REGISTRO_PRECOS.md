# Registro de Preços (SRP)

## Estrutura

A contratação possui o indicador Registro de Preços (SRP), desmarcado por padrão para os cadastros existentes. Seu órgão principal é o gerenciador. Uma contratação SRP pode possuir várias atas e vários órgãos participantes.

As guias Registros de preços e Participantes estão na navegação da contratação. Sem o indicador SRP, as guias informam como habilitar o cadastro. Contratações arquivadas permitem somente consulta.

## Participantes

Seleção pesquisável entre órgãos públicos ativos. Um órgão não pode participar duas vezes da mesma contratação, nem ser simultaneamente gerenciador e participante. Participantes inativados posteriormente permanecem no histórico. Remover um participante não exclui a organização.

A troca de gerenciador é bloqueada se o novo órgão estiver na lista de participantes: primeiro deve ser removido dessa lista. Organizações participantes não podem perder o papel de órgão público enquanto houver vínculos.

## Atas

Campos: número da ata, data de assinatura, data de validade, Permite Adesão, link do diretório ou documento e observações. Número, datas e seleção de ao menos um item são obrigatórios. A validade deve ser igual ou posterior à assinatura. O número é único dentro da contratação, permitindo o mesmo número em contratações diferentes.

Cada ata seleciona itens da própria contratação. No vínculo inicial são copiados número, descrição, quantidade e preço unitário; o preço vencedor preenchido tem preferência sobre o estimado. Itens sem preço não podem ser vinculados até que seu valor seja informado na contratação.

Os dados copiados são preservados: editar a contratação ou os metadados da ata não altera as cópias já registradas. Itens novos adicionados posteriormente recebem uma cópia na ocasião do vínculo. Remover e adicionar novamente um item cria uma nova cópia com seus dados atuais. O vínculo impede excluir o item de origem enquanto usado em uma ata.

A lista mostra Item, Descrição resumida, Quantidade, Valor unitário (quatro casas) e Disponível. Valores monetários e quantidades usam Decimal exato, sem conversão de cálculo para ponto flutuante. Quantidades fracionárias legadas são preservadas.

**Nesta etapa, Disponível equivale à quantidade registrada na ata.** Ainda não há baixa por contrato, empenho, pedido ou adesão; a seleção em várias atas não constitui controle de reserva global. Permite Adesão é informação cadastral, sem processo de adesão implementado. Não há integração automática com contratos, financeiro, PNCP ou calendário nesta entrega.

## Segurança e manutenção

Páginas e Server Actions exigem administrador ativo. Mutações validam o SRP, arquivamento, versão da contratação e propriedade dos vínculos. As operações são transacionais, auditadas e incrementam a versão do cadastro principal. O histórico recente da contratação recebe também um registro resumido das alterações em atas/participantes.

Excluir uma ata exige confirmação sobre perda irreversível dos seus itens. Desmarcar SRP ou excluir a contratação é bloqueado enquanto houver atas/participantes; os vínculos devem ser removidos explicitamente antes. A remoção de atas não apaga itens de origem.

As chaves estrangeiras compostas impedem relacionar, numa ata, itens pertencentes a outra contratação.

## Implantação

Aplicar primeiro em homologação a migration `202611250001_price_registrations` com `npm run db:migrate`, regenerar o cliente Prisma e implantar conforme o fluxo aprovado. Não há novas variáveis de ambiente. A migration apenas adiciona estruturas; não transforma contratações existentes em SRP nem remove registros.

Validar indicador SRP, participantes, cópia de itens, precisão dos preços, edição/remoção e bloqueio em arquivadas. Testes locais usam exclusivamente PostgreSQL descartável. Não houve aplicação de migration no Neon nem publicação em produção nesta implementação.

Para rollback da aplicação, manter as novas estruturas e dados no banco, sem executar exclusão destrutiva de tabelas. Versões anteriores não oferecem as telas de SRP e não reconhecem seus vínculos; suas tentativas de excluir itens/contratações vinculados serão bloqueadas pelas chaves estrangeiras.

## Validação da entrega

TypeScript, lint, formatação e build de produção passaram. Foram validados 183 testes unitários, 137 de integração em PostgreSQL local e 20 cenários de navegador. Cobertura de SRP: exigência do indicador, distinção de gerenciador/participante, duplicações, troca de gerenciador, desmarcação protegida, origem dos itens, cópia decimal exata, preservação do histórico, versão desatualizada, arquivamento, exclusão e auditoria. O cenário de navegador percorre a marcação SRP, inclusão de participante e cadastro, edição e exclusão da ata.
