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

Também é possível conceder administração pelo banco, sem cargo ou ID de cargo Discord: após a migração `007_account_admin.sql`, abra **Supabase → Table Editor → schema anade → accounts**, localize a conta pela coluna `username` e altere `is_admin` para `true`. Atualize o portal para carregar a permissão. Para remover, volte a `false`. Ninguém é promovido automaticamente; contas novas iniciam com `false`. O usuário ainda precisa ser filiado e ter uma sessão válida. O formulário de perfil não altera essa permissão.

Com o primeiro administrador configurado, o menu **Administração** (`/administracao`) reúne os atalhos de gestão e a lista de administradores locais. Para conceder acesso a outra pessoa, informe o **ID do usuário Discord**, localize a conta, confira a identidade e clique em **Conceder administração**. A pessoa precisa ter entrado no portal ao menos uma vez. A permissão passa a valer ao atualizar a página, sem consultar o Discord novamente. A migração `008_admin_grants.sql` registra quem concedeu cada permissão e quando, em uma tabela privada. Concessões repetidas não duplicam o registro.

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
- `/direcao`: composição do diretório, restrita aos filiados, derivada das funções oficiais atribuídas pela administração em `/administracao/cargos`. Uma pessoa pode acumular funções. Essas atribuições são separadas da administração do site; remover uma função preserva a ficha.
- `/administracao`: painel exclusivo de administradores, com resumo, atalhos de gestão e concessão de administração por ID do usuário Discord. A API protege a listagem de contas e exige sessão administrativa, origem válida e CSRF para conceder acesso. A busca não expõe contatos privados das fichas.
- `/filiados`: busca, filtro de estado e ficha detalhada; LegApp privado é removido da resposta para outros usuários, inclusive dirigentes.
- `/ficha`: visualização do próprio perfil, com identidade, biografia, contatos, formação e atuação na direção. O botão **Editar meu perfil** abre `/ficha/editar`; após salvar, o usuário volta ao perfil. Quem ainda não cadastrou a ficha encontra o botão **Criar minha ficha**.
- `/ficha/editar`: formulário do próprio personagem, com nome, temporada, Blue, LegApp, compartilhamento opcional, idade, domicílio, cidade, ideologia, profissão, faculdades, OAB e biografia. Cargo e funções são somente leitura e não podem ser alterados pelo dono. O backend sempre altera somente a ficha da sessão autenticada.
- `/filiados/[id]`: perfil individual do filiado, acessado pelos cards da listagem, do painel e da direção. O botão de edição aparece somente quando o perfil pertence à pessoa logada. A privacidade do LegApp continua aplicada pela API antes de os dados chegarem ao navegador.
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

## Foto e banner do perfil

Em **Meu perfil**, passe o mouse sobre sua foto ou banner para trocar, recortar ou retirar a imagem; os controles também aparecem ao navegar por teclado e ficam visíveis em telas de toque. Somente o dono vê essas ações. Cada arquivo pode ter até **4 MB**, em PNG, JPG ou WebP estático. O editor permite arrastar a imagem com mouse ou toque, mover com as setas, ajustar o zoom e centralizar novamente. A foto mantém recorte quadrado e o banner, proporção 3:1. **Usar recorte** abre uma confirmação com prévia; **Salvar foto/banner** publica. **Ajustar recorte** também abre uma imagem já salva. Cancelar mantém a imagem atual. O servidor valida o conteúdo real, remove metadados e converte para WebP, com foto de 512 × 512 e banner de até 1920 × 640. Foto e banner são enviados separadamente.

A migração `010_profile_media.sql` guarda apenas referências aos arquivos. O bucket **anade-profiles** é privado, usa as mesmas variáveis do Supabase já configuradas e é preparado automaticamente. Somente o próprio dono pode alterar as imagens; a leitura exige sessão de filiado. Alterar os dados da ficha preserva as imagens. Falha no upload mantém a imagem anterior; substituir ou remover limpa os objetos antigos.

## Bater ponto

`/ponto` está disponível para **qualquer filiado**, de forma **opcional**, com um registro por dia no fuso **America/Sao_Paulo**. Envie o print das três ações e o print do post no Blue, confirme a declaração e clique em **Bater ponto**. O cargo registrado vem da atribuição oficial, sem seleção pelo filiado. A data, o dono e o horário são definidos no servidor; não há registro retroativo, edição ou substituição dos comprovantes. Uma restrição única no PostgreSQL protege contra envios duplicados, inclusive simultâneos. A página mostra o próprio histórico e atualiza a disponibilidade a cada minuto.

Administradores acessam **Administração → Consultar pontos** (`/administracao/pontos`), com filtros por dia, filiado e cargo, paginação e abertura dos dois comprovantes. Filiados consultam somente os próprios registros e imagens. A identificação do personagem, Discord e Blue é preservada como estava no momento do ponto. LegApp e outros dados privados não entram na consulta.

A migração `009_checkins.sql` cria a tabela privada com RLS e revoga a Data API. Os prints são validados pelo Sharp, sem SVG ou animação, sem metadados e regravados em WebP no bucket **privado** do Supabase Storage. Consulte [a configuração de Production](DEPLOY.md) para `SUPABASE_URL` e `SUPABASE_SECRET_KEY` (também aceita `SUPABASE_SERVICE_ROLE_KEY` legada). O bucket é preparado automaticamente no primeiro envio. Falhas não produzem pontos incompletos e a API tenta remover os arquivos parciais. O envio não interpreta o conteúdo do print nem confirma atividades diretamente no jogo; os comprovantes ficam disponíveis para consulta humana.

## Controles e elementos flutuantes

### Ranking de participação

Em **Bater ponto → Ranking**, administradores consultam `/administracao/pontos/ranking`. A página e a API `/api/admin/checkins/ranking` verificam a permissão administrativa; a classificação não entra em `/api/state`. O ranking conta dias com registro (um ponto por dia), com períodos de 7 dias, 30 dias ou todo o período, paginação, última participação e acesso aos comprovantes filtrados por filiado. Empates têm a mesma colocação. O dia corrente e os limites dos períodos usam Brasília. A participação permanece opcional; não há pontuação extra por voto, foto ou cargo.

Selects da ficha, direção, modalidade de voto e filtro de estados usam o mesmo componente ANADE, com busca por digitação, navegação por teclado e indicação da opção selecionada. Os calendários de reuniões e votações têm meses em português, navegação por mês/ano, horário com precisão de minutos e ações Hoje, Limpar e Aplicar. Fechar o calendário sem aplicar descarta o rascunho. A data continua usando o horário local do dispositivo e é convertida para ISO no envio à API, como antes.

Tooltips de aparência, participantes e fechamento de janelas, avisos de validação, checkboxes, radios e campos numéricos seguem os tokens claro/escuro do portal. Os popups respeitam as bordas da tela e os diálogos nativos; campos inválidos recebem foco e uma mensagem acessível antes do envio. As animações respeitam a preferência de movimento reduzido. Componentes compartilhados estão em `apps/web/src/components` e os estilos em `controls.css`.

`npm test` executa os testes da API e as interações dos controles em JSDOM. A suíte de interface verifica seleção por teclado, filtros, valores enviados por FormData, validação, limites numéricos, descarte de rascunho, minutos exatos, conversão de fuso e popups dentro dos diálogos. JSDOM não verifica posicionamento visual nem a camada nativa de foco do navegador.

## Reuniões no Google Meet e atas no Google Docs

A administração agenda a reunião no portal e usa o atalho **Criar chamada no Google** para abrir o Meet em outra aba, criar uma reunião para mais tarde e copiar o link. O campo da chamada é obrigatório em novas reuniões. O Google Docs da ata é opcional no agendamento e pode ser adicionado ou atualizado em **Gerenciar reunião**, inclusive depois do encontro. O atalho **Criar documento** abre um novo Google Docs na conta do administrador.

Os filiados veem **Entrar no Google Meet** e **Abrir ata no Google Docs** quando os links estão configurados. Reuniões antigas permanecem preservadas, com indicação de links pendentes. As permissões administrativas são verificadas na API para criação, alteração de links e notas. Cada pessoa continua podendo confirmar sua própria presença.

Este fluxo vincula links; não cria chamadas ou documentos automaticamente por API, não sincroniza conteúdo e não usa autorização Google no portal. O administrador cria os recursos na própria conta Google e define quem pode entrar na chamada ou ler/editar o documento. Para manter a edição da ata restrita, compartilhe o Docs com os filiados como **Leitor**. O portal não altera as permissões do Google. Os links aceitam somente HTTPS nos domínios oficiais do Meet/Docs e formatos de chamada/documento; não são acessados pelo backend.

Para atualizar o banco real, execute `npm run db:migrate`: a migração `004_meeting_links.sql` adiciona as colunas dos links, sem apagar dados anteriores. A demonstração não contém links fictícios de reuniões ou atas externas; o administrador precisa cadastrar os seus.

A migração `005_directors.sql` mantém metadados privados da direção, com referência às fichas, RLS e bloqueio da Data API. A composição exibida agora deriva das funções em `013_assignments.sql`; títulos antigos não concedem autoridade nem entram automaticamente na nova composição. Cards e banner responsivos estão em `direction.css`.

## Verificação e produção

### Propostas, comunicados, campanha e trajetória

A migração `011_community.sql` cria os registros das novas áreas, apoios, confirmações de leitura e a configuração da campanha, com RLS e sem acesso pela Data API pública. Não há novas variáveis de ambiente.

- `/propostas`: filiados apresentam ideias, apoiam uma vez por conta e comentam. Somente administradores encaminham uma proposta para votação. O encaminhamento é transacional e único, preserva o contexto completo e inclui abstenção.
- `/comunicados`: administradores e pessoas com função Comunicação publicam, editam e fixam avisos, com prazo opcional. Cada filiado confirma sua leitura; mudanças no título, texto ou prazo reiniciam as confirmações. A administração acompanha o total de leituras.
- `/campanha`: começa fechada. A administração abre ou fecha pela própria página ou pelo atalho do painel. Fechada, a central bloqueia cadastro/edição e oculta registros e resultados de busca dos filiados; administradores continuam consultando. Aberta, cada pessoa mantém uma pré-candidatura com cargo, estado, propostas, compromissos e até dez links HTTPS de materiais.
- No perfil, a linha do tempo reúne marcos declarados pelo jogador: cargos, candidaturas, mandatos e contribuições. Só o dono inclui, edita ou exclui seus marcos.
- A lupa no cabeçalho e `Ctrl+K`/`Cmd+K` abrem a busca de filiados, reuniões, atas/documentos, votações, propostas, comunicados e campanhas permitidas. LegApp e votos privados não são indexados. Links de busca para reuniões e votações funcionam também em itens encerrados.

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

## Grupos, bancadas, financeiro, jurídico e calendário

O menu lateral reúne as páginas em quatro submenus (Dia a dia, Participação, Organização e Gestão). O botão de recolher ativa uma faixa de ícones no desktop, com nomes em balões e preferência salva no navegador. No celular, mantém os nomes completos, fecha com Escape e contém o foco enquanto está aberto.

Cada grupo abre em `/grupos/:id`, com liderança, participantes e abas de pautas, votações e reuniões filtradas pelo grupo. Essas páginas individuais não são adicionadas ao menu. Links antigos com `?grupo=...` são redirecionados para o endereço próprio. Atalhos administrativos abrem o formulário de reunião/votação com o grupo selecionado.

Execute `npm run db:migrate` para aplicar `012_organization.sql` antes de publicar esta versão. A migração preserva reuniões/votações anteriores e cria Câmara, Senado, direção, jurídico, comunicação e tesouraria **sem participantes**, além dos caixas partidário e eleitoral **zerados e somente para administradores**. Não há novas variáveis de ambiente.

- `/grupos` e `/bancadas`: a administração mantém os grupos. Câmara e Senado recebem automaticamente deputados federais e senadores com atribuição oficial. Direção, Jurídico, Comunicação e Tesouraria derivam das funções oficiais; grupos livres mantêm participantes manuais. Presidências e coordenações estaduais entram no respectivo diretório estadual. Qualquer participante registra prioridades, pautas, negociações, orientações de voto, tarefas e avisos. Autor, liderança e administradores editam. As reuniões de grupo são filtradas na API, na busca e nas notificações, inclusive ao confirmar presença.
- Novas votações, inclusive propostas encaminhadas, salvam o eleitorado na publicação. Mudanças posteriores no grupo não alteram essa lista: novos integrantes podem acompanhar, mas só os eleitores originais votam. Administradores não recebem voto automático. Abertura, encerramento, sigilo, quórum e regra de aprovação não têm endpoint de edição. Administradores podem encerrar antecipadamente pelo fluxo existente. Abstenção conta no quórum, sem apoiar alternativa. Maioria absoluta e dois terços usam **todo o eleitorado** como denominador; pluralidade exige vencedor único. Empate, ausência de votos válidos e quórum insuficiente não aprovam resultado.
- O sino mostra avisos internos de atribuições, menções explícitas, reuniões nas próximas 24 horas e vencimentos. Leituras são individuais e persistidas. Lembretes são calculados nas consultas e atualizados a cada atualização do estado do portal (aproximadamente um minuto, com aba ativa); não dependem de cron e não enviam email, push ou mensagens no Discord. Acesso revogado remove também a notificação correspondente.
- `/financeiro`: somente as funções Financeiro e Tesoureiro criam caixas, movimentações e comprovantes, inclusive quando a pessoa é administradora. Administradores e leitores definidos podem consultar os caixas; leitura não permite movimentação. Valores em centavos; receita, despesa, reserva e liberação compõem um extrato imutável. Reserva reduz disponível; despesa vinculada consome a reserva; liberação devolve disponibilidade. Transações serializadas no PostgreSQL impedem gastos simultâneos acima do saldo. Nenhuma transferência é executada no jogo. Cadastre saldos existentes como receitas identificadas.
- `/juridico`: somente a função Jurídico cria e edita registros. Cada caso pode ser visível a todos os filiados, sigiloso para toda a equipe jurídica ou restrito a jurídicos selecionados. Documentos possuem lista própria limitada ao público do caso, e a API revalida ambos os acessos em cada consulta/download. Administradores sem função Jurídico não recebem acesso a casos sigilosos. Registros antigos continuam restritos e não são publicados automaticamente. Pagamento é acompanhamento declarado, independente do extrato financeiro.
- PDF, PNG, JPG e WebP de até 4 MB podem ser anexados aos casos e aos lançamentos financeiros. Imagens são validadas/reprocessadas. O bucket `anade-documents` é criado privado sob demanda com as variáveis Supabase existentes. Download autenticado em `/api/organization/files/:id`; nunca há URL pública. Até 20 documentos por registro.
- `/calendario`: data real, dia da temporada virando às 8h de Brasília, próximo tick previsto, marcos eleitorais da wiki e eventos oficiais manuais (incluindo efeitos pendentes/conclusão). A data inicial precisa ser confirmada pela administração. A consulta pública usa somente a URL oficial fixa, não reutiliza cookies de jogadores e não sobrescreve configuração quando há redirecionamento/login ou data indisponível. Previsões não sincronizam pausas e mudanças do motor; a administração deve conferir a temporada e registrar alterações. Referência consultada: [Temporada e tempo](https://legado.planalto.fun/wiki/temporada-e-tempo).

### Cargos e funções oficiais

Execute `npm run db:migrate` para aplicar `013_assignments.sql`. Não há novas variáveis. Em **Administração → Cargos e funções**, selecione uma conta e atribua o cargo eletivo, estado e funções partidárias. A alteração é auditada no banco e vale nas próximas requisições, sem nova consulta ao Discord. Nenhuma atribuição é criada automaticamente a partir de cargos autodeclarados antigos ou participantes manuais de bancadas; o administrador precisa confirmar cada pessoa. Sem atribuição, a conta é membro comum.

Nas votações da Câmara/Senado, a lista de eleitores continua congelada, mas cada voto também exige o cargo oficial atual de deputado federal/senador. Retirar o cargo bloqueia novos votos; votos já registrados permanecem. Liderar a Câmara/Senado também exige o respectivo cargo. Administração do site, cargo eletivo e funções partidárias são conceitos separados.

O painel e o calendário têm contagem regressiva por segundo, alinhada ao horário do servidor, e recalculam o dia ao passar das 8h. A temporada 1 foi confirmada com dia 1 em **15/10/2026**, duração de **90 dias**, dia 10 em **24/10/2026** e encerramento previsto em **12/01/2027**. Os próximos marcos incluem eleições, posse, eleição interna, janela partidária, filiação, convenções e campanha. As datas continuam ajustáveis pela administração se o Legado alterar o calendário.

### Divulgação diária e estatuto

Execute `npm run db:migrate` para aplicar `014_publications.sql`, sem novas variáveis. Em `/divulgacao`, qualquer filiado compartilha um título, um link HTTPS e o tipo (post ou matéria de jornal). A autoria vem da sessão. O autor ou um administrador pode retirar o link; URLs não são acessadas pelo servidor nem recebem prévia remota. Links repetidos da mesma pessoa no mesmo ciclo são bloqueados.

O ciclo vai das **8h de Brasília até as 8h do dia seguinte**, incluindo a madrugada. Às 8h o mural deixa de exibir o ciclo anterior, mesmo se a aba continuar aberta e a nova consulta falhar. A API só consulta o ciclo vigente; os registros antigos são removidos fisicamente no próximo acesso ao mural. Não depende de cron pago nem de servidor ligado continuamente, e não apaga as publicações nos sites de origem. A paginação mantém até vinte links por página.

Em `/estatuto`, o espaço começa **Em elaboração**. Somente administradores podem salvar o texto e/ou link do documento e escolher publicar. Rascunhos não são devolvidos aos filiados pela API. Publicar exige texto ou link HTTPS; desmarcar a publicação volta ao estado de elaboração. A página e as APIs são exclusivas para filiados. O menu agrupa Divulgação em Participação e Estatuto em Organização.

Na visão geral, o calendário usa cartões de mesma altura e só três próximos marcos, com acesso à lista completa em `/calendario`, evitando que a coluna de marcos crie um vazio no desktop.

## Referências técnicas

- [Next.js: instalação e App Router](https://nextjs.org/docs/app/getting-started/installation)
- [Express 5](https://expressjs.com/en/guide/migrating-5/)
- [Supabase: conectar ao PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Discord OAuth2](https://docs.discord.com/developers/topics/oauth2)
- [Legado: personagem](https://legado.planalto.fun/wiki/personagem), [ideologia](https://legado.planalto.fun/wiki/ideologia) e [LegApp](https://legado.planalto.fun/wiki/legapp). As regras da wiki podem mudar durante o desenvolvimento do jogo.
