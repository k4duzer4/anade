# Filiação pelo portal

Entrada pública em `/filiacao`, com link na página de login. OAuth Discord identifica pessoas sem o cargo Filiado; elas recebem sessão limitada à própria candidatura e logout. Não recebem `/api/state`, fichas de terceiros ou ações internas. Os filiados anteriores continuam entrando pelo cargo confirmado no login.

## Formulário e privacidade

Nome, cidade/UF, idade e formação do personagem (até duas faculdades do jogo), LegApp, e-mail fictício do Legado, Blue, corrente da ANADE, planos e contribuição. Termos `/termos` e política `/privacidade`, versão `2026-10-26`. Aceite obrigatório, não pré-marcado, validado no servidor com versão e horário do servidor. ID e destinatário vêm da sessão OAuth, nunca do corpo enviado.

Solicitações são privadas; e-mail, motivação e aceite não entram no perfil dos filiados. Aprovação cria uma ficha básica se não existir, preservando ficha anterior e deixando o compartilhamento do LegApp desativado. Não atribui cargo eletivo, função ou administração. O solicitante pode acompanhar a decisão, retirar um pedido pendente e reenviar após recusa/retirada. Histórico e retirada não equivalem à exclusão de dados; canal de privacidade indicado nos documentos: administração no servidor oficial Discord.

## Administração

`/administracao/filiacoes`, acessível pela Administração. Filtros por situação, páginas de 20, ficha detalhada, aprovação/recusa e resposta opcional. A resposta é visível ao solicitante. Decisões concluídas são imutáveis e aprovação repetida não duplica ficha nem mensagem entregue. Um administrador não analisa a própria candidatura.

Migração `018_affiliations.sql`: pedidos, decisões, aceite e estado de entregas; autorização local em tabela separada. RLS habilitada e privilégios de PUBLIC/anon/authenticated revogados. Locks por conta serializam pedidos, decisões e reserva das entregas, entre instâncias. Não há consulta Discord durante navegação; a autorização local fica ativa após aprovação.

## Ativar o bot (pendente de configuração do responsável)

1. Abra o aplicativo da ANADE no Discord Developer Portal, seção Bot, e obtenha seu token. Não coloque token no chat, Git, front-end nem em variável NEXT_PUBLIC_.
2. Instale o bot no servidor com a permissão **Gerenciar cargos**. Não precisa de Administrador, leitura de mensagens, Presence ou Message Content. Coloque o cargo do bot **acima do cargo Filiado**. Apenas esse cargo configurado é atribuído pelo sistema.
3. Na Vercel, backend/API, configure `DISCORD_BOT_TOKEN` em Production e publique novamente. `DISCORD_GUILD_ID` e `DISCORD_MEMBER_ROLE_ID` existentes identificam servidor e cargo. Client secret OAuth não substitui o token do bot.
4. Aprovar tenta, separadamente, atribuir o cargo e enviar DM para a conta autenticada. Aprovação local continua válida se uma integração falhar. No painel, confira o estado de cada entrega e use “Tentar novamente” para pendências após configurar o bot. Nenhuma tarefa automática de fundo é prometida.

A mensagem confirma a aprovação e aponta para APP_ORIGIN/painel. Não inclui e-mail, textos da candidatura ou notas da análise; desativa menções. O destinatário pode bloquear DMs. Não garantir entrega universal. Respostas 429 guardam o prazo mínimo antes de tentar de novo; erros mostram códigos seguros, sem respostas brutas/tokens. Entregas confirmadas não são reenviadas. Uma interrupção de resultado desconhecido exige confirmação explícita do risco de duplicação; nonce fixo e enforce_nonce reduzem duplicatas no intervalo suportado pelo Discord. A operação externa ocorre após o commit, nunca dentro da transação de aprovação.

## Validação

Testes com Discord simulado, repositório em memória e PostgreSQL emulado: isolamento, CSRF, concorrência, aceite/versão, decisão, acesso imediato, preservação de ficha e tratamento de entregas. Nenhuma aprovação, atribuição de cargo ou DM real é feita como teste em produção. Não foi possível validar a entrega real sem bot configurado.

Fontes técnicas: [Create DM](https://github.com/discord/discord-api-docs/blob/main/developers/resources/user.mdx), [mensagens](https://github.com/discord/discord-api-docs/blob/main/developers/resources/message.mdx), [cargos](https://github.com/discord/discord-api-docs/blob/main/developers/resources/guild.mdx). Referência de transparência: [direitos dos titulares, ANPD](https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1/direito-dos-titulares). Os textos descrevem o comportamento do portal e não constituem certificação de conformidade jurídica.
