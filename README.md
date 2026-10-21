# ANADE 10 — Portal do Filiado

Portal da **Aliança Nacional Democrática** no RPG Legado, com a identidade visual fornecida pelo partido: verde profundo, amarelo, papel e jacaré. Projeto independente do TripSplit e da primeira versão `portal-partido-legado`.

## Stack e organização

- **Frontend:** Next.js 16 App Router, React 19, TypeScript, Motion e fontes locais Sora (títulos e números), Manrope (leitura) e Barlow Condensed (marca e chamadas da ANADE). Temas claro, escuro e do sistema com `next-themes`.
- **Backend:** Node.js 22.14+ e Express 5, separado do servidor Next.
- **Banco recomendado:** **PostgreSQL hospedado no Supabase**. Driver `pg`, migrações SQL versionadas e sessões persistidas no PostgreSQL.
- **Autenticação:** OAuth2 do Discord; cargos de filiado e direção conferidos em cada login e salvos na sessão persistida no PostgreSQL.
- Tudo no mesmo repositório, com npm workspaces e um único `package-lock.json`.

```text
apps/web/           Next.js, telas, componentes e artes da ANADE
apps/api/src/       Express, autenticação, regras e repositórios
apps/api/db/        Migrações PostgreSQL
apps/api/test/      Testes de domínio, API e consultas SQL
```

## Experimentar o frontend completo

Na raiz do repositório:

```powershell
npm install
npm run demo
```

Abra **http://localhost:3000**. Escolha explorar como direção ou entrar como filiado. Next roda na porta 3000 e Express em 3001. A configuração padrão de OAuth usa `localhost`; abra esse endereço, não `127.0.0.1`, para a validação de origem funcionar.

A demonstração utiliza registros fictícios **em memória**, sem consultar Supabase ou Discord. Alterações são perdidas ao reiniciar a API. O acesso demonstrativo não existe no modo real e é recusado com `NODE_ENV=production`.

## Configurar PostgreSQL no Supabase

1. Crie um projeto no Supabase. O banco é PostgreSQL; não é necessário usar Supabase Auth, pois o login é feito pelo Express com Discord.
2. No painel **Connect**, copie a conexão **Session pooler** na porta **5432**, apropriada para um backend Node persistente em rede IPv4. Use exatamente host, usuário e região mostrados pelo seu projeto.
3. Copie `apps/api/.env.example` para `apps/api/.env` e preencha `DATABASE_URL`. Se a senha tiver caracteres especiais, codifique-os para URL.
4. Gere um segredo com pelo menos 32 caracteres para `SESSION_SECRET`. Exemplo: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
5. Execute `npm run db:migrate` na raiz.

As migrações criam o schema privado `anade`, contas, fichas, reuniões, presenças, votações, alternativas, votos e sessões. Não adicione `anade` aos schemas expostos pela Data API do Supabase. RLS é habilitado e os acessos `PUBLIC`, `anon` e `authenticated` são revogados. O backend conecta com o usuário de banco definido em `DATABASE_URL` (dono das tabelas, por exemplo a conexão `postgres` do painel). O navegador acessa somente a API Express; não recebe senha do banco, service role ou segredo Discord.

O voto tem chave única `(poll_id, account_id)` e chave estrangeira para uma alternativa válida. Inserção de voto e verificação de prazo/encerramento usam transação com bloqueio da votação, evitando duplicidade e disputa com o encerramento. A execução de migrações também é transacional e tem controle de versões.

Faça backup pelo Supabase de acordo com seu plano. O Supabase hospeda o banco; **Next.js e Express precisam de hospedagem de aplicação**, como um servidor Node ou dois serviços atrás da mesma origem.

## Configurar Discord

1. Crie a aplicação em https://discord.com/developers/applications.
2. Em OAuth2, cadastre `http://localhost:3000/auth/discord/callback` para desenvolvimento.
3. Preencha no `.env` da API: `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_GUILD_ID`, `DISCORD_MEMBER_ROLE_ID` e `DISCORD_REDIRECT_URI`. `DISCORD_ADMIN_ROLE_ID` é opcional: sem ele, o login real funciona para filiados e ninguém recebe acesso administrativo.
4. Quando a administração for configurada, o dirigente deve ter **ambos** os cargos: filiado e direção. Os IDs são copiados com o modo desenvolvedor do Discord.
5. Execute `npm run dev`.

O fluxo usa os escopos `identify guilds.members.read`, sem exigir um bot. O token é usado no backend durante o login e não é enviado ao frontend nem armazenado nas novas sessões. Há validação de state OAuth, regeneração da sessão, cookie HttpOnly/SameSite, proteção de origem/CSRF e limites de requisições. Cada login consulta o cargo uma vez e salva `member: true` e o papel administrativo na sessão do PostgreSQL. Consultas, edição de ficha, votações e navegação usam essa sessão sem chamar o Discord. Mudanças de cargo passam a valer no próximo login; a sessão atual permanece válida até sair ou expirar.

A migração `006_discord_memberships.sql` armazena a última consulta e o prazo de espera imposto pelo Discord. Um novo login força uma consulta atualizada, respeitando o cooldown compartilhado entre instâncias. Se o cargo estiver ausente, o login é negado e a sessão anterior já foi invalidada. Respostas 429 exibem o tempo de espera; não se concede uma nova sessão usando uma confirmação antiga.

A sessão dura até oito horas ou a expiração do token Discord, o que vier primeiro. Não há renovação automática: o usuário entra novamente. Logout destrói a sessão. As sessões reais ficam no PostgreSQL; o modo demonstrativo usa memória.

## Telas e permissões

- `/`: página pública de login pelo Discord, com acesso à apresentação da ANADE.
- `/painel`: resumo real dos cadastros, agenda, votações e filiados.
- `/agenda`: próximos encontros e reuniões realizadas. Somente a administração cria e edita título, data, pautas, link do Google Meet, Google Docs da ata e notas internas. Filiados entram na chamada, abrem a ata e confirmam/cancelam presença antes do início.
- `/votacoes`: abertas e encerradas. Direção publica temas, alternativas e prazo. **Abstenção** é incluída automaticamente além das 2–10 alternativas. Filiados conferem a escolha antes de confirmar um voto definitivo. Modalidade secreta ou nominal. Abstenções contam na participação e aparecem separadas dos votos válidos no resultado. Percentuais usam toda a participação, incluindo abstenções; o portal não determina automaticamente vencedores ou quórum.
- `/direcao`: composição do diretório, restrita aos filiados. O administrador adiciona, edita e remove diretores, vinculando uma ficha cadastrada a um cargo, responsabilidades e ordem de exibição. Um filiado pode ocupar mais de um cargo. Esse cadastro não concede permissões de administrador: elas continuam sendo verificadas pelos cargos no Discord. A remoção preserva a ficha do filiado.
- `/filiados`: busca, filtro de estado e ficha detalhada; LegApp privado é removido da resposta para outros usuários, inclusive dirigentes.
- `/ficha`: nome, temporada, Discord vinculado, Blue, LegApp, compartilhamento opcional, idade, domicílio, cidade, ideologia, cargo, profissão, faculdades, OAB e biografia.
- `/partido`: página pública **A ANADE**, com valores, correntes e programa do partido. Tem navegação própria, sem os menus internos, e pode ser aberta sem login.
- `/sobre`: endereço antigo que redireciona para `/partido`.

Somente o login e A ANADE são páginas públicas de conteúdo. Painel, agenda, votações, filiados e ficha ficam sob um layout de servidor do Next.js: ele verifica a sessão com `/api/access` antes de renderizar e redireciona para o login se não houver autorização. A API verifica a sessão e as permissões salvas em todas as chamadas autenticadas, sem consultar o Discord novamente. A navegação interna também verifica a expiração da sessão. `/api/access` devolve apenas a identificação e o papel do usuário autorizado, sem carregar cadastros ou votações.

As correntes internas da ANADE aparecem na área institucional; não substituem as oito ideologias oficiais do Legado no cadastro. A lista de filiados mostra fichas registradas, não uma importação automática de todos os membros do Discord. Dados do personagem são autodeclarados e não são sincronizados com o jogo. Há uma ficha atual por conta; histórico de temporadas não está implementado.

**Voto secreto:** nenhuma escolha de outro usuário ou resultado parcial é exposto na interface/API. Após encerrar, há resultado agregado. O operador do banco mantém acesso técnico à associação de votos para assegurar unicidade: não há anonimato criptográfico.

## Identidade visual

As seis imagens originais enviadas foram copiadas sem alterações para `apps/web/public/brand`. O login usa a ilustração de diversidade; painel e navegação usam a paleta verde/amarelo/papel e a marca com jacaré; a área institucional apresenta correntes e programa. As fontes são instaladas via `@fontsource`, sem chamadas a Google Fonts durante uso ou build.

A interface tem superfícies com profundidade, barra superior com desfoque, transições de página, indicador de navegação animado, contadores, resultados animados, diálogos e notificações com Motion. O painel tem iluminação que acompanha o ponteiro. Tema claro/escuro/sistema fica salvo em `localStorage` (`anade-theme`), sem depender de login; a preferência de reduzir movimento é respeitada. Há layout responsivo, navegação por teclado, foco visível e link para pular conteúdo.

Os cards compartilham uma composição própria da ANADE: cabeçalho de data com dia, mês, ano e horário de Brasília na agenda; identificação dos filiados com faixa institucional; alternativas de votação identificadas por letras; métricas com ícones e ações. O refinamento tipográfico e dos cards está em `apps/web/src/app/cards.css`; o cabeçalho de data é o componente `MeetingDate`.

Cargo e situação usam componentes próprios (`RoleInsignia` e `StatusLabel`), com credencial da direção, ícones e legendas para reuniões e votações. Os acabamentos desses componentes e o layout público de A ANADE estão em `apps/web/src/app/details.css`.

A migração `003_abstention.sql` amplia o limite de alternativas e acrescenta Abstenção às votações existentes que ainda estão abertas e dentro do prazo, preservando as encerradas e as de prazo expirado. Execute `npm run db:migrate` após atualizar uma instalação real. Os testes locais verificam a restrição ampliada, a preservação das votações encerradas e a ausência de duplicação da opção.

## Reuniões no Google Meet e atas no Google Docs

A administração agenda a reunião no portal e usa o atalho **Criar chamada no Google** para abrir o Meet em outra aba, criar uma reunião para mais tarde e copiar o link. O campo da chamada é obrigatório em novas reuniões. O Google Docs da ata é opcional no agendamento e pode ser adicionado ou atualizado em **Gerenciar reunião**, inclusive depois do encontro. O atalho **Criar documento** abre um novo Google Docs na conta do administrador.

Os filiados veem **Entrar no Google Meet** e **Abrir ata no Google Docs** quando os links estão configurados. Reuniões antigas permanecem preservadas, com indicação de links pendentes. As permissões administrativas são verificadas na API para criação, alteração de links e notas. Cada pessoa continua podendo confirmar sua própria presença.

Este fluxo vincula links; não cria chamadas ou documentos automaticamente por API, não sincroniza conteúdo e não usa autorização Google no portal. O administrador cria os recursos na própria conta Google e define quem pode entrar na chamada ou ler/editar o documento. Para manter a edição da ata restrita, compartilhe o Docs com os filiados como **Leitor**. O portal não altera as permissões do Google. Os links aceitam somente HTTPS nos domínios oficiais do Meet/Docs e formatos de chamada/documento; não são acessados pelo backend.

Para atualizar o banco real, execute `npm run db:migrate`: a migração `004_meeting_links.sql` adiciona as colunas dos links, sem apagar dados anteriores. A demonstração não contém links fictícios de reuniões ou atas externas; o administrador precisa cadastrar os seus.

A migração `005_directors.sql` cria a tabela privada `anade.directors`, com referência às fichas, RLS e bloqueio da Data API. Execute `npm run db:migrate` antes de iniciar a versão com Direção no banco real. O modo demonstrativo inclui três cargos fictícios; o banco real inicia sem diretores. Os endpoints `POST /api/directors`, `PUT /api/directors/:id` e `DELETE /api/directors/:id` exigem administrador, sessão válida e CSRF. Os filiados consultam a composição em `/api/state`. Cards e banner responsivos estão em `direction.css`.

## Verificação e produção

O destino escolhido é **Vercel + Supabase**, com endereço gratuito `vercel.app`: consulte [o guia de publicação](DEPLOY.md). O `vercel.json` na raiz declara Services Next.js e Express no mesmo projeto Vercel. O roteamento mantém páginas, API e autenticação no mesmo domínio; o Next consulta a API por binding interno. Dados e sessões ficam no PostgreSQL do Supabase, com Transaction pooler na produção. A configuração Cloudflare foi removida. A configuração Render permanece como alternativa no [guia separado](DEPLOY-RENDER.md).

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

Os testes SQL usam `pg-mem`: validam migração inicial, consultas e restrições, mas não substituem a execução das migrações nem os testes de concorrência no PostgreSQL real do Supabase. Os testes da API simulam Discord e cobrem reconfirmação do cargo no novo login, navegação e edição de ficha sem novas consultas, permissões, CSRF, privacidade, voto definitivo e logout. Login real e conexão ao Supabase precisam ser conferidos após preencher suas credenciais.

Na Vercel, importe a raiz do repositório e configure as variáveis do [guia](DEPLOY.md). O binding injeta `API_ORIGIN` em runtime e o adaptador Express configura o proxy HTTPS, sem iniciar um listener próprio. Para hospedagem Node persistente, execute migrações, faça build e inicie com `NODE_ENV=production`; exponha Next por HTTPS e ajuste `API_ORIGIN` e `TRUST_PROXY` conforme a rede. Não use `npm run demo` em produção.

## Referências

- [Next.js: instalação e App Router](https://nextjs.org/docs/app/getting-started/installation)
- [Express 5](https://expressjs.com/en/guide/migrating-5/)
- [Supabase: conectar ao PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Discord OAuth2](https://docs.discord.com/developers/topics/oauth2)
- [Legado: personagem](https://legado.planalto.fun/wiki/personagem), [ideologia](https://legado.planalto.fun/wiki/ideologia) e [LegApp](https://legado.planalto.fun/wiki/legapp). As regras da wiki podem mudar durante o desenvolvimento do jogo.
