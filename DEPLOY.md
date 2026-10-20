# Publicar no Render Free + Supabase Free

O portal pode começar em um único Web Service gratuito no Render. Next.js atende na porta pública; Express roda internamente em `127.0.0.1:3001`. Dados e sessões são persistidos no PostgreSQL do Supabase. Não use o modo demonstrativo em produção.

## Limites dos planos gratuitos

- Render suspende o serviço após 15 minutos sem tráfego. A primeira visita seguinte pode levar cerca de um minuto para abrir. Há 750 horas gratuitas mensais por workspace, compartilhadas com outros serviços, além de limites de tráfego e builds. O próprio Render destina esse plano a projetos pessoais e testes, sem garantias de disponibilidade para produção.
- Supabase Free inclui banco de até 500 MB e pode pausar o projeto após uma semana de inatividade. Planeje cópias de segurança dos dados.
- Use os subdomínios fornecidos pelas plataformas para começar sem comprar um domínio. Um domínio próprio é opcional e tem custo separado.

## 1. Preparar o Supabase

1. Crie um projeto no plano Free e guarde a senha do banco.
2. Em **Connect → Session pooler**, copie a URL PostgreSQL na porta **5432**. Substitua a senha e codifique caracteres especiais na URL.
3. Essa URL será `DATABASE_URL` no Render. Não use a chave pública, a service role ou a URL REST no lugar da conexão PostgreSQL.
4. Mantenha o schema `anade` fora dos schemas expostos pela Data API. As migrações criam as tabelas com RLS e acesso restrito ao backend.

## 2. Criar o serviço no Render

Depois de enviar esta versão ao GitHub:

1. Entre no Render com sua conta GitHub.
2. Abra **New → Blueprint**, selecione `k4duzer4/anade` e a branch `main`.
3. O arquivo `render.yaml` configura **um Web Service Free**. Confira o plano antes de criar.
4. Preencha as variáveis solicitadas:

| Variável                 | Valor                          |
| ------------------------ | ------------------------------ |
| `DATABASE_URL`           | Conexão PostgreSQL do Supabase |
| `DISCORD_CLIENT_ID`      | ID da aplicação Discord        |
| `DISCORD_CLIENT_SECRET`  | Segredo OAuth2 da aplicação    |
| `DISCORD_GUILD_ID`       | ID do servidor da ANADE        |
| `DISCORD_MEMBER_ROLE_ID` | ID do cargo de filiado         |

O Render gera `SESSION_SECRET`. `DISCORD_ADMIN_ROLE_ID` começa vazio; todos os usuários reais permanecem sem privilégios administrativos até configurá-lo. Os valores do `.env` local não são enviados automaticamente ao Render. Insira os segredos diretamente no painel.

O build instala as dependências e compila o Next. O início aplica as migrações versionadas e só inicia o portal se elas concluírem com sucesso. Um reinício verifica as versões sem recriar ou apagar dados. Se a migração falhar, consulte os logs e corrija a conexão antes de tentar novamente.

## 3. Ajustar o Discord

1. Copie a URL HTTPS gerada pelo Render, por exemplo `https://SEU-SERVICO.onrender.com`.
2. Na aplicação Discord, em **OAuth2 → Redirects**, adicione **essa URL seguida de `/auth/discord/callback`** e salve.
3. O inicializador utiliza `RENDER_EXTERNAL_URL` para definir automaticamente a origem e o redirect. Abra o portal pela URL gerada, com HTTPS.
4. Para domínio próprio, adicione `APP_ORIGIN=https://SEU-DOMINIO` no Render, sem barra final. Atualize também o redirect no Discord. Se definir `DISCORD_REDIRECT_URI` manualmente, ele deve corresponder à mesma origem.

## 4. Conferir antes de convidar os filiados

- Login funciona com a conta real e a ficha fica salva após sair e entrar.
- Conta sem o cargo de filiado não acessa páginas internas nem a API.
- Conta filiada entra sem ver controles administrativos enquanto o cargo administrativo estiver vazio.
- `/api/health` responde `{"ok":true}` e os logs não indicam falhas de conexão ao banco. Esse endpoint verifica a API; o teste de gravação da ficha confirma o banco.
- As páginas públicas são Login e A ANADE. Nenhum registro demonstrativo é inserido no banco real.

## Referências

- [Render Free: limites](https://render.com/docs/free)
- [Render: Blueprints](https://render.com/docs/blueprint-spec)
- [Render: variáveis automáticas](https://render.com/docs/environment-variables)
- [Supabase: conexão PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase: planos](https://supabase.com/pricing)
