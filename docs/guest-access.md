# Convidados

Permissão local separada de filiação, administração e cargos do Discord. A pessoa precisa autenticar com o Discord pelo menos uma vez para existir como conta, mas não precisa ser filiada. Não há concessão automática a visitantes.

## Administração

Administração → Acessos e equipe → localizar conta por ID Discord → **Conceder acesso de convidado**. Remover na mesma ficha ou na lista Convidados. A própria conta não pode alterar sua permissão. Administradores locais não podem ser convertidos em convidados; convidados não podem ser promovidos antes de remover esse modo.

Se uma conta filiada recebe a permissão de convidado, o modo restrito prevalece enquanto estiver ativo. Remover convidado não concede filiação nem administração: a conta volta a depender de seus direitos anteriores. A condição é lida no banco em cada requisição, sem consultar Discord durante a navegação. Não atribui cargo no servidor nem envia mensagens.

## Proteção

- A API aceita apenas identidade própria (`/api/access`), estado vazio (`/api/state`) e logout para convidados. Configuração pública e saúde do serviço continuam públicas. Todo outro endpoint, inclusive solicitações de filiação, busca, contadores, mídia e downloads, responde 403 antes de consultar o conteúdo.
- O estado é construído a partir de uma lista explícita de campos: conta atual, CSRF, horário e arrays vazios. Não se obtém um snapshot para apagá-lo posteriormente.
- O Proxy do Next consulta a autorização e reescreve URLs das áreas internas e A ANADE para uma página vazia **antes** de executar os componentes da página original. Queries de reunião, votação, edição ou documentos são descartadas. Falha ao verificar não é tratada como autorização.
- O layout permite essa navegação, mas as guardas de filiados continuam recusando convidado fora da reescrita. A página de destino também valida a permissão no servidor. O shell não monta os filhos, a busca, notificações ou rastreamento de atividade no modo convidado; não se trata apenas de esconder dados com CSS.
- O menu mostra todas as seções, incluindo Administração, com identificação Convidado. Nenhum conteúdo administrativo ou controle de gestão é renderizado para a pessoa.
- Documentos de uso e privacidade e a página pública de filiação permanecem sujeitos aos seus fluxos próprios; a API de candidatura não é liberada ao convidado. Assets públicos de marca não são dados internos.
- A remoção da permissão altera a autorização das próximas requisições. Como em qualquer revogação, ela não apaga cópias de dados que uma pessoa já recebeu quando tinha outro tipo de acesso.

Migração `019_guest_access.sql`: permissão por conta e histórico do responsável pela alteração. RLS habilitada e privilégios de PUBLIC/anon/authenticated revogados. Nenhuma conta real é convertida em convidada como teste.

Na Vercel, o Proxy consulta `/api/access` pela origem pública canônica da ANADE (`APP_ORIGIN` ou `https://anade.vercel.app`), sem seguir redirects nem derivar destino de Host enviado pelo cliente. Componentes do servidor mantêm o binding interno. [Bindings de Services não estão disponíveis no middleware/Proxy](https://vercel.com/kb/guide/vercel-services). O teste de publicação com cookie inválido deve voltar ao login, sem erro 503.

Testes cobrem concessão/remoção/CSRF, modo restrito prevalecendo sobre sessão filiada, OAuth sem cargo de filiado, estado sem snapshot, bloqueio de endpoints e arquivos, persistência entre instâncias, reescrita de URLs e não montagem de componentes privados no shell.
