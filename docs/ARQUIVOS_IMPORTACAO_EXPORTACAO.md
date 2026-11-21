# Arquivos de importação e exportação — versão 1.0

Gestão de cotações está **fora do MVP**. O agente de IA trabalha externamente: recebe o termo de referência, prepara arquivos, e o usuário os importa no Govnex. Para elaborar a proposta, o usuário baixa os dados e os entrega ao agente junto ao modelo. Não há conexão direta entre o agente e o ERP.

## Modelos oficiais

- [Catálogo: exemplo](arquivos/catalogo-v1.exemplo.json) e [JSON Schema](arquivos/catalogo-v1.schema.json).
- [Itens da contratação: exemplo](arquivos/contratacao-v1.exemplo.json) e [JSON Schema](arquivos/contratacao-v1.schema.json).
- [Instruções para o agente extrator](AGENTE_EXTRATOR.md).

Os mesmos modelos podem ser baixados nas telas de importação. Os exemplos são ilustrativos e devem ser substituídos pelos dados reais do documento.

## Regras comuns

JSON UTF-8, com ou sem BOM, até **2 MiB e 100 itens por arquivo**. A contratação continua limitada a 100 itens no total.

- `versao`: sempre `"1.0"`.
- `tipo`: `"itens_catalogo"` ou `"itens_contratacao"`.
- `loteId`: identificação estável da carga, com 3 a 100 letras ASCII, números, ponto, hífen ou sublinhado. Ex.: `catalogo-pregao-2026-001-v1`. Não é o lote comercial da licitação.
- `origem`: documento e referência textual; pode ser null.
- `tipo` do item: `"MATERIAL"` ou `"SERVICO"`.
- `descricao`: texto completo, entre 3 e 20 mil caracteres. As quebras de linha devem ser escapadas corretamente no JSON.
- `marca` e `modelo`: texto ou null. `unidade` é obrigatória, até 20 caracteres.
- Quantidades, valores e percentuais são **strings decimais**, com ponto e sem separador de milhar. Não usar números JSON para esses campos. `"1000.1250"` representa mil reais e 12,50 centavos; `"1.000"` representa um, não mil.
- Campos desconhecidos são rejeitados. Não incluir vencedor, preços internos, custos, margens, situação, usuários ou configurações.

JSON Schema valida a estrutura; o backend também aplica precisão, CNPJ válido, vínculos, conflitos, limites monetários e demais regras comerciais.

## Catálogo

Cada item contém `codigo` único no arquivo, tipo, descrição, marca, modelo, unidade, `aliquotaTributaria` e `fornecedoresCnpj`.

O termo de referência normalmente não informa nossos tributos e fornecedores. Nesses casos, usar alíquota null e lista de CNPJs vazia. Na tela **Catálogo → Importar JSON**, o operador escolhe fornecedores ativos e informa uma alíquota padrão, aplicada apenas aos itens sem esses dados no arquivo. Zero é permitido quando informado explicitamente; não existe preenchimento automático com zero.

Quando houver CNPJs no arquivo, eles devem corresponder a fornecedores já cadastrados e ativos. Não são criadas organizações automaticamente. O CNPJ do órgão comprador não deve ser usado como fornecedor. A importação exige alíquota e fornecedor válidos para cada produto antes da gravação.

Itens equivalentes por descrição, tipo, unidade, marca e modelo são recusados quando encontrados no catálogo. Não há atualização automática por semelhança nem mesclagem de produtos.

## Itens da contratação

Cada item contém `numero` inteiro positivo e único na contratação, tipo, descrição, marca, modelo, unidade, `quantidade` positiva (até três casas), `valorUnitarioEstimado` (até quatro casas ou null) e um vínculo opcional ao catálogo.

O destino é escolhido na interface: **Contratação → Gerenciar itens → Importar JSON**. O arquivo não modifica o cabeçalho, o órgão ou a situação da contratação.

Há duas formas de vínculo ao catálogo, mutuamente exclusivas:

1. `catalogoId`: ID conhecido de um produto ativo já cadastrado.
2. `catalogoReferencia`: referência ao código de um produto importado anteriormente, sem exigir que o agente conheça IDs internos:

```json
{
  "catalogoId": null,
  "catalogoReferencia": {
    "loteId": "catalogo-pregao-2026-001-v1",
    "codigo": "CAT-001"
  }
}
```

Para esse fluxo, importar primeiro o catálogo e depois os itens da contratação. Os recibos de auditoria resolvem o par lote/código para o produto criado. O produto deve continuar ativo e seu tipo deve ser compatível com o item.

Os dois vínculos podem ser null: o item é importado como **vínculo pendente**, com aviso, para associação manual ao catálogo antes da precificação. Fornecedor, vencedor e oferta vencedora não são importados. A alíquota do produto vinculado é copiada; preços estimados e quantidades vêm do arquivo.

O total é recalculado pelo backend, mantendo a política decimal existente. Um preço desconhecido deixa a estimativa pendente. Números já cadastrados bloqueiam toda a carga. Itens existentes, seus fornecedores históricos, ofertas e snapshots não são regravados. Contratações arquivadas não recebem importações.

Numeração repetida por grupos/lotes do edital exige revisão da modelagem antes de importar: a versão atual aceita uma numeração única por contratação e não renumera linhas silenciosamente.

## Prévia, confirmação e reenvio

1. Escolher arquivo e complementos necessários.
2. **Validar e visualizar**: mostra itens, preços, vínculos e avisos; não grava dados.
3. Conferir e selecionar **Confirmar importação**.

A confirmação revalida dados e prévia, com transação e controle de versão. Alterações na contratação, nos fornecedores ou nos dados relevantes do catálogo podem exigir nova prévia. Qualquer erro impede a gravação do lote completo; não existe importação parcial.

O mesmo lote e conteúdo/complementos não são importados duas vezes, inclusive em confirmações simultâneas ou reenvio após perda de conexão. Alterar o conteúdo de um lote já processado exige um novo `loteId`; isso não autoriza sobrescrever números de itens existentes. A identificação do lote é por catálogo ou por contratação de destino.

A auditoria registra origem, itens adicionados, IDs criados e resumo da carga. Arquivos não dependem de armazenamento persistente no servidor.

## Exportação para proposta

Na consulta da contratação, selecionar **Exportar proposta**:

- **Itens vencedores**: somente os marcados como vencedores, com suas ofertas unitárias.
- **Todos os itens**: valores estimados de referência, identificados explicitamente como `REFERENCIA_ESTIMADA`. Não devem ser tratados como preços comerciais aprovados sem revisão.

O arquivo contém versão, moeda BRL, natureza dos preços, empresa, órgão e contatos, identificação/objeto/modalidade/processo/prazos/links da contratação, itens numerados com descrição completa, marca, modelo, unidade, quantidade, valor unitário e total, além do total geral e pendências cadastrais/comerciais.

Não inclui custos de aquisição, frete interno, margem, lucro, fornecedor, preço mínimo, snapshots, notas internas ou auditoria. A seleção é feita por lista explícita de campos. Um preço ausente ou conjunto vazio bloqueia a exportação com mensagem indicando o motivo; não são inventados preços.

Formatos: JSON estruturado ou Markdown com o mesmo JSON em bloco delimitado, preservando tipos e precisão para o agente. Até 4 MiB por exportação. Os endpoints são privados, exigem administrador e respondem com `Cache-Control: no-store`.

O agente recebe esse arquivo e o modelo da proposta por envio manual. Validade, entrega, pagamento e cláusulas do edital precisam ser conferidos; o ERP não gera o documento final nem o publica nesta entrega.

## Implantação

Sem nova migration ou variável de ambiente. A auditoria existente armazena os recibos de lote. O limite de Server Actions foi ajustado para acomodar a codificação do arquivo, mantendo a validação específica de 2 MiB no backend. Compatível com o ambiente Node.js da Vercel.

Nenhum arquivo é enviado a serviços de IA pelo aplicativo. Não foi executado deploy na Vercel nesta entrega.

## Validação desta entrega

131 testes unitários, 67 testes de integração em PostgreSQL local descartável e 12 testes Chromium aprovados (210 no total). TypeScript, ESLint e build de produção aprovados. Os cenários incluem precisão decimal, JSON inválido, limites, prévia sem gravação, atualização concorrente, arquivadas, CNPJ, atomicidade, idempotência concorrente, vínculo por lote/código, exclusão de campos internos, downloads JSON/Markdown e recusa de acesso sem administrador.
