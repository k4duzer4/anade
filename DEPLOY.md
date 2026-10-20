# Publicar no Cloudflare Workers + Supabase

Destino escolhido: **Workers Free**, com endereço gratuito `workers.dev`, e PostgreSQL no Supabase. Há dois Workers: `anade` (Next.js público, com OpenNext) e `anade-api` (Express privado). O site encaminha `/api` e `/auth` por um Service Binding. As páginas internas também consultam a sessão pelo binding. A API não recebe um endereço público.

As sessões ficam no PostgreSQL. Cada requisição da API recebe uma conexão própria, encerrada ao concluir, sem reutilizar sockets de outra requisição do Workers. Uma tarefa agendada remove sessões expiradas a cada seis horas. O cadastro administrativo permanece opcional.

## 1. Supabase

1. Crie um projeto no plano **Free**.
2. Em **Connect → Session pooler**, copie a conexão PostgreSQL na porta **5432**, substituindo a senha e codificando caracteres especiais para URL.
3. Preencha `DATABASE_URL` em `apps/api/.env` localmente e execute na raiz:

```sh
npm ci
npm run db:migrate
```

As cinco migrações criam o schema privado `anade`. Mantenha esse schema fora da Data API do Supabase. Não use a URL REST nem a chave pública como conexão PostgreSQL. As migrações são executadas antes de publicar, nunca dentro de requisições do Worker.

## 2. Conta Cloudflare e endereço público

1. Entre no Cloudflare e mantenha o plano **Workers Free**.
2. Em **Workers & Pages**, escolha seu subdomínio `workers.dev`.
3. A URL do site será `https://anade.SEU-SUBDOMINIO.workers.dev`.
4. Substitua o exemplo de `APP_ORIGIN` em `apps/api/wrangler.jsonc` pela URL real, sem barra final. Os IDs Discord já estão preenchidos; o cargo administrativo continua vazio.
5. Autorize o Wrangler pelo terminal:

```sh
npx wrangler login
```

Use **Workers**, pois o portal tem sessões e páginas renderizadas no servidor. OpenNext recomenda Linux ou WSL para builds em máquinas Windows. O ambiente de CI do Cloudflare também pode gerar o build.

## 3. Publicar a API privada

```sh
npm run cf:deploy:api
npx wrangler secret put DATABASE_URL --config apps/api/wrangler.jsonc
npx wrangler secret put SESSION_SECRET --config apps/api/wrangler.jsonc
npx wrangler secret put DISCORD_CLIENT_SECRET --config apps/api/wrangler.jsonc
```

Os comandos solicitam os valores no terminal. Gere uma chave de produção com pelo menos 32 caracteres para `SESSION_SECRET`, por exemplo `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Use o Client Secret OAuth2 atual. A API só fica operacional após preencher os três secrets. O `.env` local não é enviado automaticamente; não publique nem compartilhe os segredos no chat.

`workers_dev: false` e `preview_urls: false` deixam a API acessível apenas por bindings. O frontend não precisa das credenciais PostgreSQL ou Discord.

## 4. Publicar o site e configurar OAuth

```sh
npm run cf:build
npm run cf:deploy:web
```

Confirme que a URL publicada corresponde a `APP_ORIGIN`. No Discord Developer Portal, em **OAuth2 → Redirects**, cadastre essa URL seguida de `/auth/discord/callback`:

```text
https://anade.SEU-SUBDOMINIO.workers.dev/auth/discord/callback
```

O callback é derivado de `APP_ORIGIN`. Quando quiser habilitar a administração, preencha `DISCORD_ADMIN_ROLE_ID` e publique a API novamente. Os administradores precisam dos cargos de filiado e administrador. Nenhum dado demonstrativo é inserido no banco real.

Para publicação pelo GitHub, configure dois projetos Workers Builds no mesmo repositório, ambos executando na raiz. A API publica com `npm run cf:deploy:api`. O site usa build `npm run cf:build` e publicação `npm run cf:deploy:web`. Publique primeiro a API. Configure seus secrets no Worker da API.

## 5. Testes e prévia

```sh
npm test
npm run typecheck
npm run lint
npm run cf:check:api
npm run cf:build
npm run cf:test
```

`cf:test` inicia Workers descartáveis e um PostgreSQL emulado, sem acessar contas externas. Valida páginas públicas, bloqueio de páginas privadas, binding, persistência da sessão de autorização, cookie seguro e rejeição de state OAuth inválido. A simulação não substitui testes do banco real e do login completo com sua conta Discord.

Para prévia manual, copie `apps/api/.dev.vars.example` para `.dev.vars` (ignorado pelo Git), use credenciais de um banco de teste, gere o build e execute `npm run cf:preview`. A demonstração Node em `localhost:3000` continua disponível com `npm run demo`.

No ambiente publicado, confira login real, filiação, gravação e persistência da ficha. Confirme também o bloqueio de não filiados e a ausência de controles administrativos enquanto o cargo correspondente estiver vazio. `/api/health` verifica a API; salvar a ficha confirma a integração com o banco.

## Limites gratuitos

Workers Free tem limites de requisições, CPU por requisição e memória. SSR e autenticação precisam ser medidos no ambiente publicado; a prévia local não confirma o consumo real. As imagens são servidas como arquivos estáticos, sem depender de Cloudflare Images. R2, KV e Hyperdrive não são obrigatórios nesta configuração.

Supabase Free tem limite de banco e pode pausar após inatividade. Planeje cópias de segurança. Um domínio próprio é opcional; o endereço `workers.dev` permite começar sem comprar um domínio.

A configuração anterior Render está em `render.yaml`, com [guia separado](DEPLOY-RENDER.md), como alternativa. Ela não participa do deploy Cloudflare.

## Documentação

- [OpenNext no Cloudflare Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/)
- [HTTP Node/Express no Workers](https://developers.cloudflare.com/workers/runtime-apis/nodejs/http/)
- [Service Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)
- [Limites do Workers](https://developers.cloudflare.com/workers/platform/limits/)
- [Conexão PostgreSQL do Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres)
