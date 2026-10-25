# Segurança e estabilidade

Revisão de 25/10/2026. Não exige migração do banco nem novas variáveis.

## Correções de segurança

- `body-parser` atualizado para 2.4.0 e descompressão de JSON desativada. Requisições codificadas são rejeitadas antes da leitura de sessões; corpos inválidos/grandes não derrubam o processo. [Aviso oficial](https://github.com/advisories/GHSA-27r3-jxmh-p828).
- `@vercel/functions` atualizado para 3.10.3, com Zod 4.6.7 fixado por override. A dependência compartilhada na raiz mantém o override efetivo também no grafo dos workspaces do npm. A auditoria de produção ficou sem alertas conhecidos. [Aviso do Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
- A sessão real exige confirmação explícita `member: true`, além de validade, administração atual no banco, autorização da rota e CSRF/origem nas alterações.
- Limites adicionais por conta: 60 alterações/minuto e 10 uploads/minuto. No máximo dois uploads simultâneos por instância; ocupação retorna 503 e `Retry-After: 5`. Os limites em memória são por instância, não uma quota global entre réplicas da Vercel.
- As páginas restringem enquadramento, objetos incorporados, alteração da URL base e destinos de formulários; câmera, microfone e geolocalização não são usados pelo portal. Isso não interfere nos links externos do Meet. A política não bloqueia os scripts de hidratação do Next.
- Arquivos `.env.*` são ignorados, preservando os exemplos sem credenciais. Valores de chaves não entram nos relatórios nem no Git.

## Menos consultas e menos esperas

- A leitura de metadados usa três consultas, sem buscar votos, alternativas, presenças ou metadados antigos de diretores.
- O resumo de novidades agrupa registros organizacionais e usa uma consulta específica para a comunidade, sem calcular apoios e leituras que o contador não utiliza. As regras de acesso continuam sendo verificadas em cada requisição; não foi criado cache compartilhado de dados privados.
- Na medição local contra o Supabase, a consulta completa de novidades passou de **23 para 11 consultas SQL**. Essa contagem é da operação de novidades, não de todas as páginas ou de um teste de carga.
- Eventos concorrentes de atualização compartilham uma consulta. Uma alteração solicita uma nova leitura depois de qualquer consulta anterior, para não reapresentar um estado desatualizado.
- Polling fica pausado com a aba oculta ou offline e retoma no foco/conexão, com agrupamento dos eventos duplicados.
- Consultas têm prazo de 15 segundos; alterações, 45 segundos. Não há repetição automática de alterações após falhas, para evitar duplicar operações. A mensagem orienta conferir o resultado antes de tentar novamente.
- Leituras são canceladas ao desmontar/sair da conta. Resultados antigos não restauram informações depois do logout.
- A confirmação de acesso do servidor é reaproveitada somente dentro da renderização atual do React. Falhas temporárias da API abrem recuperação, enquanto sessões inválidas continuam indo ao login. O botão usa `retry`, conforme o Next instalado.

## Verificação contínua

O workflow `quality.yml` executa instalação pelo lockfile, auditoria de produção, testes, lint, tipagem e build em Linux/Node 22. As ações oficiais estão fixadas por SHA e recebem somente permissão de leitura do repositório. Não recebe credenciais do Supabase ou Discord.

Validação local:

```powershell
npm run audit:production
npm test
npm run lint
npm run typecheck
npm run build
```

Os testes incluem limites de requisição/upload, JSON inválido/comprimido, sessão sem filiação confirmada, consultas de metadados, autorização de conteúdo privado, concorrência no navegador, desconexão, Strict Mode, cancelamentos e recuperação de acesso.

## Credenciais já compartilhadas

Segredos anteriormente compartilhados no chat precisam ser trocados nos serviços de origem: client secret do Discord, senha do banco e chave secreta do Supabase. Depois, atualizar os respectivos valores na Vercel e no `.env` local, seguido de redeploy. Não enviar os novos valores pelo chat nem versioná-los. A troca é uma operação de credencial que deve ser feita pelo titular nos painéis; esta revisão não altera esses valores nem interrompe o login/banco para rotacioná-los sem coordenação.
