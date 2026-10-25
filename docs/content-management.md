# Pautas, comentários e exclusões

As pautas dos grupos e cada assunto de reunião têm uma conversa própria, carregada ao abrir. Comentários têm até 2.000 caracteres e páginas de 20 registros. O servidor define a autoria e verifica o acesso atual ao grupo/reunião em cada leitura, publicação e exclusão.

Nos assuntos de reunião, reordenar a lista mantém a conversa. Alterar ou remover o texto de um assunto remove seus comentários antigos. Assuntos com texto idêntico compartilham a mesma conversa. A reunião precisa manter ao menos um assunto; para remover o encontro inteiro, use **Excluir reunião**.

| Conteúdo                        | Quem pode excluir                                                   | Vínculos                                                                                         |
| ------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Pauta/registro de grupo         | Autoria, liderança ou ADM, com acesso ao grupo                      | Remove comentários e notificações do registro                                                    |
| Comentário da pauta             | Autoria, liderança do grupo ou ADM, com acesso atual                | Não altera o assunto                                                                             |
| Reunião ou assunto de reunião   | ADM                                                                 | Remove comentários; excluir a reunião também remove presenças e notas                            |
| Votação                         | ADM                                                                 | Remove alternativas, votos e resultados; desvincula a proposta para permitir novo encaminhamento |
| Grupo                           | ADM                                                                 | Remove pautas e conversas; bloqueia enquanto houver reuniões ou votações vinculadas              |
| Proposta                        | Autoria ou ADM; encaminhadas, somente ADM                           | Remove apoios e comentários; votação já criada permanece                                         |
| Comentário de proposta          | Autoria ou ADM                                                      | Remove somente o comentário                                                                      |
| Comunicado                      | Comunicação ou ADM                                                  | Remove confirmações de leitura                                                                   |
| Pré-candidatura                 | Autoria com central aberta, ou ADM                                  | Remove apresentação, materiais e compromissos cadastrados                                        |
| Marco da trajetória             | Dono da ficha ou ADM                                                | Não altera cargos/funções oficiais                                                               |
| Caixa                           | Equipe financeira                                                   | Deve estar sem movimentações                                                                     |
| Movimentação                    | Equipe financeira                                                   | Remove comprovantes e recalcula saldo; bloqueia reservas dependentes ou saldo insuficiente       |
| Registro jurídico               | Jurídico com acesso ao caso                                         | Remove anexos e notificações; administração não substitui a função Jurídico                      |
| Anexo                           | Equipe jurídica com acesso ao caso, ou financeiro para comprovantes | Remove arquivo privado e referência                                                              |
| Evento cadastrado do calendário | ADM                                                                 | Não altera os marcos previstos da temporada                                                      |
| Ponto                           | ADM                                                                 | Remove os dois prints e recalcula consultas/ranking; libera novo envio se ainda for o mesmo dia  |
| Conteúdo do estatuto            | ADM                                                                 | Retorna à elaboração e preserva a página                                                         |

Todas as exclusões usam confirmação. Grupo, reunião, votação, registro jurídico e estatuto também pedem o nome para confirmar. As permissões e a proteção CSRF são verificadas no backend. Nenhum dado real foi excluído como parte da implantação. Links e documentos em serviços externos não são apagados.

Comentários ficam na tabela privada `anade.agenda_comments`, criada pela migração `016_agenda_comments.sql`, com referências e exclusão em cascata para reuniões e registros de grupo. A migração é aditiva e preserva os dados existentes. Alterações estruturais e exclusões relacionadas usam a mesma transação/conexão, evitando concorrência e espera por conexões adicionais no pool.

Após remover uma referência a anexo ou ponto, o backend solicita a remoção dos objetos do Storage. Eventuais falhas de limpeza são registradas no servidor; o arquivo órfão continua privado e perde sua rota de acesso no portal.
