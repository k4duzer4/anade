# Plenário virtual com kMeet

O portal usa o kMeet público, hospedado pela Infomaniak, pela interface externa Jitsi. Não exige conta, cartão, token de API ou servidor de áudio da ANADE. A capacidade configurável de **10 a 40** limita admissões pelo portal; não limita entradas feitas diretamente pelo link externo.

## Operação

1. Administração → Agenda: crie uma reunião e selecione **Plenário virtual · kMeet, pautas e votações**. As reuniões Google Meet existentes continuam com seu fluxo original.
2. Abra **Plenário virtual** no menu, entre na reunião e selecione **Preparar plenário**.
3. Defina lugares, eleitorado/quórum e integrantes adicionais da mesa. Confirme a ciência da moderação compartilhada de áudio. A composição fica congelada depois de abrir.
4. A presidência abre a sessão. Filiados autorizados podem clicar **Entrar no áudio**. O código externo só é entregue pelo endpoint de admissão autenticado, com CSRF, e não pela listagem.
5. Os microfones começam silenciados e o portal bloqueia câmera. Cada pessoa autoriza seu microfone no navegador. A interface nativa do kMeet permanece disponível.
6. A mesa confere a identidade de quem entrou e clica **Confirmar presença**. Somente conexões ativas, confirmadas e integrantes do eleitorado entram no quórum. Reconectar exige reconfirmação. A confirmação de agenda não conta como presença no plenário.
7. Com quórum, a mesa abre votações com prazo, sigilo, abstenção e regra de aprovação. Não existe voto automático de administrador. A votação da Câmara/Senado exige também o cargo oficial atual.
8. Ao encerrar, o servidor bloqueia novas entradas/votos no portal e fecha as votações. A mesa também deve encerrar a sala no kMeet: a ANADE não possui autoridade remota sobre o servidor gratuito.

## Permissões efetivamente aplicadas

| Ação no portal | Autorização |
|---|---|
| Ver uma reunião/entrar | Filiado com ficha e acesso atual ao grupo; administrador pode consultar todas |
| Preparar/abrir/encerrar | Administrador, liderança atual do grupo ou, nas reuniões gerais, Presidente nacional/Secretário-geral |
| Escolher pauta ativa, confirmar presença, abrir/fechar votação | Presidência e integrantes adicionais da mesa, com acesso atual |
| Suspender entrada pelo portal | Presidência; não pode suspender a si mesma |
| Votar | Eleitor fixado, grupo/cargo atual, presença confirmada e conexão ativa, sessão/votação abertas |

As verificações ocorrem no backend. Campos de papel, nome ou permissões enviados pelo cliente não concedem privilégios. Uma mudança de cargo/grupo pode remover os direitos nas próximas requisições. O histórico de votos permanece.

## Limitação importante do áudio gratuito

**Os papéis da ANADE não são papéis autenticados do kMeet.** Na validação de 25/10/2026, dois acessos anônimos receberam controles de moderação, inclusive Silenciar todos e Expulsar. Não foi encontrada uma API pública documentada para a ANADE emitir credenciais de moderador exclusivas no serviço gratuito. Ocultar botões ou enviar um campo `moderator` não resolveria a autorização no servidor do provedor; a implementação não faz essa promessa.

Salas usam identificadores aleatórios de 128 bits. Porém, quem conhece o link pode tentar entrar diretamente, independentemente do login, capacidade, suspensão ou encerramento no portal. Senha e sala de espera podem auxiliar na organização manual; não vinculam identidades Discord. Reuniões sigilosas ou que exijam controle exclusivo e garantido de microfone não devem usar essa modalidade. Para isso será necessário um serviço com autenticação de moderadores/participantes suportada pelo fornecedor ou uma instância própria.

Presença usa evento da interface de conferência e heartbeat do navegador a cada 30 segundos; expira em 90 segundos. Isso é um sinal operacional, não prova auditada do servidor kMeet. A confirmação humana da mesa é obrigatória para quórum e voto. A ANADE não recebe nem grava as faixas de áudio. O serviço externo e participantes ainda podem ter recursos de gravação próprios.

## Configuração e verificação

A listagem oferece busca por título, filtros por situação e contadores de sessões. **Total de filiados** usa `data.members.length`, a mesma base da visão geral; não representa conectados, capacidade do áudio ou eleitorado. A sessão apresenta essas informações separadamente. O eleitorado congelado e as regras de voto não são alterados por atualizações no total de filiados.

A lista de presença inclui os participantes disponíveis mesmo antes de entrarem, busca por nome/estado, filtros de confirmação e pedidos de palavra, com 24 itens por etapa. Histórico de conexões anteriores também é preservado. Ampliar a sala altera apenas a disposição visual, sem desmontar o áudio. Estilos contemplam temas claro/escuro, telas menores e preferência por movimento reduzido.

- Aplicar `npm run db:migrate`: migração **017_plenary.sql**. Tabelas com RLS habilitada e sem acesso dos papéis públicos do Supabase.
- Opcional: `KMEET_ENABLED=false` no backend suspende aberturas e novas admissões de áudio. Não derruba clientes externos já conectados ao kMeet.
- Microfone é delegado somente à origem fixa `https://kmeet.infomaniak.com` nas páginas `/plenario/*`; câmera permanece bloqueada. Links de entrada fazem navegação completa para aplicar a política do documento, inclusive ao vir de páginas que bloqueiam microfone.
- O script externo só é carregado após a ação de entrar no áudio. O provedor controla as atualizações de seu cliente; não há cópia local modificada.
- Heartbeats não atualizam todo o estado do portal. Consultas da sala não se sobrepõem e pausam com aba oculta/offline. Falha temporária na consulta não desmonta imediatamente o áudio; perda de autorização encerra a interface.
- Testes automáticos cobrem CSRF, identidade e papéis, capacidade concorrente até 40, confirmação da mesa, quórum, suspensão, cargo de bancada, sigilo, fechamento e persistência/cascata SQL. Testes de interface verificam entrada explícita, evento de conexão e confirmação separada.
- A validação ao vivo anterior conectou duas abas sem mídia em uma página isolada. **Não houve ensaio de áudio com 40 pessoas**, teste de longa duração ou equivalência entre duas abas e duas conexões de redes distintas. A capacidade e qualidade de áudio precisam ser conferidas em uma reunião piloto real.

Fontes oficiais: [kMeet](https://www.infomaniak.com/en/ksuite/kmeet), [gratuidade e duração ilimitada](https://www.infomaniak.com/fr/offres-speciales), [moderação](https://www.infomaniak.com/en/support/faq/2476), [API externa Jitsi](https://jitsi.github.io/handbook/docs/dev-guide/dev-guide-iframe/).
