# Usuários, minha conta e agenda operacional

## Telas e navegação

O submenu expansível Administração reúne três telas independentes:

- `/usuarios`: listagem, busca por nome/e-mail, filtro de situação, paginação, cadastro, edição e ativação/desativação.
- `/meu-perfil`: edição do nome e e-mail do usuário autenticado. A identificação do usuário na barra superior também dá acesso a esta tela.
- `/trocar-senha`: senha atual, nova senha e confirmação.

O submenu Agenda operacional reúne Calendário, Tarefas e Notificações, com suas rotas e telas independentes. A seção em uso abre automaticamente e destaca a tela atual. A navegação por teclado usa os controles nativos de expansão. No celular, selecionar um item fecha o menu principal, inclusive quando o item está dentro de um submenu. O sino continua na barra superior.

## Contas administrativas no MVP

Todas as contas cadastradas ou atualizadas por esta interface recebem ADMIN. Não há seletor de perfil, permissões por módulo ou exclusão definitiva de contas. Desativar preserva os registros e a autoria do histórico.

A migration não promove automaticamente contas antigas USER nem altera seus estados. Se houver uma conta legada, a tela informa a atualização pendente; salvar ou ativar essa conta aplica o acesso administrativo adotado no MVP, com auditoria e revogação das sessões anteriores. O valor técnico USER continua reservado no modelo existente para evolução futura.

Todas as telas e Server Actions exigem administrador ativo. Na alteração de perfil e senha, o usuário é identificado pela sessão no servidor; esses formulários não recebem um identificador de outra conta.

## Cadastro, edição e situação

O cadastro exige nome, e-mail único, senha inicial forte e confirmação. O e-mail é normalizado em minúsculas e sem espaços nas extremidades. A unicidade também considera endereços legados com caixa diferente. A senha inicial é informada pelo administrador; não há credencial padrão fixa nem envio automático de e-mail/WhatsApp.

As listagens e respostas dos serviços excluem hashes e senhas. A edição de conta permite nome, e-mail e situação; a senha é alterada pelo próprio usuário na tela específica. A recuperação operacional por terminal continua disponível pelo procedimento existente.

A proteção do último administrador ativo vale tanto na edição quanto no botão Desativar. Operações administrativas concorrentes usam o mesmo bloqueio transacional do bootstrap administrativo. Não é possível que duas desativações pela aplicação removam simultaneamente os dois últimos administradores. Versões de cadastro impedem sobrescrever uma edição mais recente.

Um administrador pode desativar a própria conta quando houver outro administrador ativo; nesse caso sua sessão é encerrada. Ativar uma conta não restaura tokens antigos revogados.

## Perfil e sessões

Alterar apenas o nome preserva as sessões e atualiza a identificação na interface. Alterar e-mail, situação ou acesso incrementa a versão de sessão, tornando inválidas as sessões anteriores. Alterações feitas na própria conta que exigem nova autenticação redirecionam para o login com confirmação.

Meu perfil altera somente nome e e-mail. O perfil não permite modificar a própria situação, definir permissões ou fornecer dados de outra pessoa.

## Troca de senha

A troca exige a senha atual correta, uma nova senha diferente e a confirmação correspondente. A política mantém pelo menos doze caracteres, com maiúscula, minúscula, número e símbolo, até 128 caracteres. A senha é armazenada com Argon2id, utilizando o mecanismo existente.

Há limite compartilhado de cinco tentativas de troca em quinze minutos por conta, persistido no PostgreSQL, inclusive entre instâncias serverless. A comparação e geração do hash ficam fora do bloqueio administrativo para reduzir o tempo da transação. A gravação final confere novamente a conta, a versão do cadastro e a sessão para impedir troca baseada em estado desatualizado.

O sucesso revoga todas as sessões, inclusive a atual, e pede novo login com a nova senha. Tentativas incorretas não alteram a credencial. A auditoria registra as operações e as falhas sem incluir senha atual, nova senha, confirmação ou hash.

## Implantação

Aplicar primeiro em homologação a migration `202611250003_user_management` com `npm run db:migrate` e gerar o cliente Prisma durante a instalação. Ela adiciona somente User.version, iniciando em 1, sem alterar e-mails, hashes, permissões, atividade ou versões de sessão existentes. Não há novas variáveis de ambiente.

Validar cadastro e duplicidade de e-mail, edição, ativação/desativação, preservação do último administrador, alteração do próprio e-mail, senha atual incorreta, senha nova e sessões revogadas. Conferir os dois submenus em desktop e celular.

Não houve execução da migration no Neon nem publicação em produção nesta implementação. Em rollback, manter a coluna e os registros, retornando apenas o código. O procedimento operacional de recuperação de senha passou também a incrementar a versão de cadastro.

## Escopo do MVP

Esta entrega conclui a inclusão funcional solicitada de contas e navegação. A ampliação do financeiro está fora do MVP. Configurações gerais de precificação e edição da matriz de alertas continuam como pontos de planejamento, sem implementação nesta entrega.

## Validação da entrega

TypeScript, lint, formatação e build de produção passaram. Foram validados 205 testes unitários, 164 de integração em PostgreSQL local e 25 cenários de navegador. A suíte anterior foi executada integralmente e os quatro cenários de contas/navegação foram conferidos após o ajuste final das mensagens de confirmação.

A cobertura inclui administrador único e desativações simultâneas, unicidade de e-mail, versões desatualizadas, contas legadas, hash seguro, auditoria sem credenciais, sessão revogada, limite de tentativas, troca de nome/e-mail/senha, cadastro/edição/ativação/desativação, busca, submenus em desktop/celular e proteção contra parâmetros de confirmação inesperados na URL.

O teste de migration aplica a cadeia em schema isolado e confirma que os dados anteriores permanecem iguais, com apenas a nova versão de cadastro. Não houve reset ou seed em banco de produção.
