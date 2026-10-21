# Publicar na Vercel + Supabase

O portal usa **um projeto Vercel**, com endereço gratuito `vercel.app`, e PostgreSQL no Supabase. O `vercel.json` na raiz declara dois Services: `web` (Next.js) e `api` (Express). `/api/*` e `/auth/*` chegam ao Express; as demais páginas chegam ao Next. As páginas privadas consultam a API por binding interno. Services está em beta e disponível em todos os planos; o Hobby é destinado a projetos pessoais, sem uso comercial, sujeito aos limites da plataforma.

O Cloudflare foi retirado da configuração. Não execute mais os comandos Wrangler. Esta mudança não publicou nem removeu recursos em contas externas.

## 1. Preparar o Supabase

1. Crie um projeto **Free** e anote a senha do banco.
2. Em **Connect → Session pooler**, copie a URI PostgreSQL na porta **5432**, substituindo a senha (codifique caracteres especiais para URL).
3. Coloque essa URI em `DATABASE_URL` no arquivo local `apps/api/.env`. Execute na raiz:

```powershell
npm ci
npm run db:migrate
```

As migrações criam as tabelas no schema privado `anade`. Mantenha esse schema fora dos schemas expostos pela Data API. Não há dados demonstrativos no banco real.

Para a Vercel, copie também a URI de **Connect → Transaction pooler**, porta **6543**. Essa será a `DATABASE_URL` do ambiente publicado. O aplicativo usa `pg` sem prepared statements nomeados, compatível com esse pooler.

A autoridade certificadora pública oficial do Supabase está incluída em `apps/api/certs/supabase-prod-ca-2021.crt`. O backend a utiliza nos hosts oficiais do Supabase, verificando o certificado e o hostname. Não é preciso desativar a verificação SSL nem cadastrar uma variável extra para o certificado.

## 2. Importar o GitHub na Vercel

1. Entre em <https://vercel.com/new> com sua conta GitHub e escolha **Hobby**, para este projeto pessoal de RPG.
2. Importe `k4duzer4/anade`.
3. Mantenha **Root Directory na raiz do repositório** (`./`), sem selecionar `apps/web`. O `vercel.json` declara os dois serviços e seus frameworks. Não substitua as configurações por um único projeto Next.js.
4. Use **Node.js 24.x**. Deixe Install Command, Build Command e Output Directory sem overrides manuais; os frameworks e npm workspaces são detectados por serviço.
5. Cadastre as variáveis abaixo antes de publicar. O endereço final em **Settings → Domains** precisa coincidir com `APP_ORIGIN`. Se o nome desejado estiver ocupado, use o endereço realmente atribuído pela Vercel e atualize a variável.

| Variável                 | Valor                                             |
| ------------------------ | ------------------------------------------------- |
| `APP_ORIGIN`             | `https://SEU-PROJETO.vercel.app`, sem barra final |
| `DATABASE_URL`           | URI **Transaction pooler**, porta 6543            |
| `SESSION_SECRET`         | Segredo aleatório com pelo menos 32 caracteres    |
| `DISCORD_CLIENT_ID`      | `1562181914998341714`                             |
| `DISCORD_CLIENT_SECRET`  | Client Secret atual da aplicação Discord          |
| `DISCORD_GUILD_ID`       | `1559550956322951270`                             |
| `DISCORD_MEMBER_ROLE_ID` | `1559710512722219069`                             |

Gere o segredo de sessão localmente:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Não configure `API_ORIGIN`: a Vercel injeta essa variável pelo binding interno. `DISCORD_REDIRECT_URI` é derivada de `APP_ORIGIN`, então também pode ficar ausente. `DISCORD_ADMIN_ROLE_ID` permanece ausente até escolhermos o cargo administrativo. Não prefixe credenciais com `NEXT_PUBLIC_`. O `.env` local não é enviado automaticamente.

Salve as variáveis no ambiente **Production** e clique em **Deploy**. Alterações de variáveis exigem novo deploy. Para previews com login, use um banco de teste, uma origem estável e um redirect OAuth correspondente.

## 3. Configurar o Discord

No Discord Developer Portal, abra sua aplicação → **OAuth2 → Redirects**. Adicione e salve:

```text
https://SEU-PROJETO.vercel.app/auth/discord/callback
```

O endereço precisa coincidir exatamente com a origem publicada. O callback local pode continuar cadastrado. O login usa `identify guilds.members.read` e verifica o cargo no servidor; não precisa de IDs individuais dos filiados nem de token de bot.

A migração `006_discord_memberships.sql` mantém o prazo de espera das consultas do Discord no PostgreSQL, compartilhado entre instâncias. Execute `npm run db:migrate` antes de publicar essa versão. O cargo é consultado em cada login e o resultado fica salvo na sessão do banco. Não há novas consultas ao Discord durante a navegação ou ao editar a ficha. Remoções de cargo passam a valer no próximo login; a sessão atual continua até sair ou expirar. Se um novo login receber 429, ele respeita o prazo de espera e não concede acesso com a confirmação anterior.

## 4. Conferir a publicação

Para o endereço `https://anade.vercel.app`, use `APP_ORIGIN=https://anade.vercel.app` e cadastre `https://anade.vercel.app/auth/discord/callback` no Discord. Ao alterar as variáveis em Settings → Environment Variables, selecione **Production** e execute **Redeploy** para aplicá-las.

Se a API retornar 503, consulte os Runtime Logs do serviço `api`: `CONFIG_APP_ORIGIN`, `CONFIG_SESSION_SECRET` e `CONFIG_DATABASE_URL` identificam a variável ausente ou inválida, sem registrar seu valor. O segredo de sessão precisa ter pelo menos 32 caracteres. Erros de conexão PostgreSQL ou tabelas ausentes precisam ser corrigidos na conexão ou nas migrações. A página inicial tem uma regra explícita para `/` no roteamento dos Services.

- `/` e `/partido` devem abrir sem login.
- `/painel`, `/agenda`, `/votacoes`, `/filiados`, `/ficha` e `/direcao` devem redirecionar visitantes para o login.
- Um usuário com o cargo de filiado deve conseguir entrar e salvar sua ficha; confira a persistência após sair e entrar novamente.
- Um usuário sem o cargo deve ter o acesso negado. Sem cargo administrativo configurado, nenhum usuário real recebe controles de administrador.

As sessões ficam no PostgreSQL. A API reutiliza um pool pequeno por instância e usa `attachDatabasePool` para liberar conexões ociosas antes da suspensão. Sessões expiradas são limpas durante requisições, sem cron pago ou timers em segundo plano. O rate limit em memória vale por instância; limites globais adicionais podem ser configurados no firewall da plataforma.

## Verificação local

```powershell
npm test
npm run lint
npm run typecheck
npm run build
```

Os testes incluem o adaptador Vercel com PostgreSQL emulado: sessão entre duas instâncias, cookie seguro, OAuth, rejeição de state inválido e uso da autorização salva na sessão. Um teste de login completo simulado confirma a consulta do cargo somente no login, a edição de ficha durante indisponibilidade do Discord e a negação do próximo login quando o cargo é removido. O build local não confirma a publicação nem o login completo com Discord/Supabase reais.

O desenvolvimento continua com `npm run dev` ou `npm run demo`. Para uma instalação Node persistente, `npm start` continua disponível; a alternativa Render está em [DEPLOY-RENDER.md](DEPLOY-RENDER.md).

## Documentação

- [Services na Vercel](https://vercel.com/docs/services)
- [Express na Vercel](https://vercel.com/docs/frameworks/backend/express)
- [Bindings internos](https://vercel.com/docs/services/bindings)
- [Conexões PostgreSQL no Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Plano Hobby](https://vercel.com/docs/plans/hobby)
