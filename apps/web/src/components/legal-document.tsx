import Link from 'next/link';
import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react';
import { ThemeSwitcher } from './theme-switcher';
import { legalVersion } from '@/lib/affiliations';
const server = 'https://discord.com/channels/1559550956322951270';
export default function LegalDocument({ privacy = false }: { privacy?: boolean }) {
  return (
    <main className="legal-page">
      <header className="public-portal-header">
        <Link href="/" className="public-wordmark">
          ANADE<span>10</span>
        </Link>
        <nav>
          <Link href="/filiacao">Solicitar filiação</Link>
          <ThemeSwitcher />
        </nav>
      </header>
      <article className="legal-document">
        <Link href="/filiacao" className="text-link">
          <ArrowLeft size={16} />
          Voltar à filiação
        </Link>
        <div className="legal-document-title">
          {privacy ? <ShieldCheck size={28} /> : <FileText size={28} />}
          <span className="eyebrow">TRANSPARÊNCIA · ANADE DIGITAL</span>
          <h1>{privacy ? 'Política de Privacidade' : 'Termos e Condições de Uso'}</h1>
          <p>Versão {legalVersion} · Atualizado em 26 de outubro de 2026</p>
        </div>
        {privacy ? (
          <>
            <section>
              <h2>1. Quem cuida dos dados</h2>
              <p>
                A equipe de administração do portal ANADE, comunidade fictícia do RPG Legado, define
                as finalidades de uso dos dados neste site. ANADE neste contexto é um partido dentro
                de uma simulação; não se trata de filiação a partido político real.
              </p>
              <p>
                Para assuntos de privacidade, procure a administração da ANADE no{' '}
                <a href={server} target="_blank" rel="noopener noreferrer">
                  servidor oficial do Discord
                </a>
                , identifique sua conta e informe que se trata de um pedido sobre dados do portal.
                Este canal também atende pessoas com solicitação pendente ou recusada, sem exigir
                acesso às páginas internas.
              </p>
            </section>
            <section>
              <h2>2. Quais dados usamos e para quê</h2>
              <ul>
                <li>
                  <strong>Identificação e acesso:</strong> ID e nome de usuário do Discord,
                  confirmação de participação no servidor e cargo de filiado consultados no login,
                  situação de filiação local, sessão e permissões. Servem para identificar a conta e
                  proteger as áreas internas. Não recebemos sua senha do Discord e o login não pede
                  acesso ao seu e-mail pessoal.
                </li>
                <li>
                  <strong>Solicitação de filiação:</strong> nome, cidade/estado, idade e formação do
                  personagem; LegApp e e-mail fictícios; Blue, corrente de afinidade, planos e
                  contribuição. Servem para análise administrativa e criação da ficha após
                  aprovação.
                </li>
                <li>
                  <strong>Registro da decisão:</strong> data do envio, versão dos documentos
                  aceitos, momento do aceite, decisão, responsável e observação da análise. Servem
                  para acompanhar e verificar o processo.
                </li>
                <li>
                  <strong>Atividades no portal:</strong> perfil, fotos, banner, participações,
                  comentários, propostas, votos, presenças, pontos, comprovantes e documentos que
                  você fornecer. São usados para oferecer os recursos do partido, respeitando as
                  permissões de cada área.
                </li>
                <li>
                  <strong>Operação e segurança:</strong> cookie de sessão, preferências de tema e
                  navegação, registros técnicos e estado de entrega das integrações. A hospedagem
                  pode processar IP, horário e informações da requisição para funcionamento e
                  proteção do serviço.
                </li>
              </ul>
              <p>
                Os campos do personagem devem conter informações fictícias do jogo. Não envie
                documentos pessoais, CPF, telefone real, e-mail pessoal, senhas, dados de terceiros
                sem autorização ou opiniões políticas reais. Mesmo em uma simulação, a conta Discord
                e informações vinculáveis a uma pessoa podem ser dados pessoais.
              </p>
            </section>
            <section>
              <h2>3. Bases e limites do tratamento</h2>
              <p>
                O aceite da ficha registra sua autorização para analisar a candidatura, preparar o
                perfil após aprovação e comunicar a decisão pelo Discord. Operações necessárias para
                fornecer o serviço solicitado, proteger contas, cumprir obrigações ou preservar
                registros indispensáveis podem ter outras bases legais, conforme o caso. O aceite
                não autoriza publicidade, venda de dados ou usos incompatíveis com estas
                finalidades.
              </p>
              <p>
                A corrente informada refere-se ao personagem no RPG. Não solicitamos declaração de
                opinião política da pessoa real. Se algum dado pessoal sensível for enviado
                indevidamente, solicite sua remoção à administração.
              </p>
            </section>
            <section>
              <h2>4. Quem pode ver</h2>
              <p>
                A ficha de candidatura, seu e-mail no Legado, textos de motivação e registro de
                aceite ficam restritos ao solicitante e à administração. Após a aprovação, os dados
                básicos da ficha passam a integrar o perfil visível aos filiados autenticados. O
                LegApp não é compartilhado com outros filiados por padrão; sua publicação depende da
                opção no perfil. E-mail da candidatura, motivação e aceite não são copiados para o
                perfil público interno.
              </p>
              <p>
                Administradores e responsáveis por áreas podem acessar informações necessárias às
                suas atribuições. Documentos sigilosos e votações seguem as permissões próprias. A
                modalidade de voto secreto limita sua apresentação nas telas; ela não significa
                anonimato técnico absoluto perante os responsáveis pela infraestrutura.
              </p>
            </section>
            <section>
              <h2>5. Serviços externos e transferências</h2>
              <p>
                Usamos Vercel para hospedar o portal e a API, Supabase para banco e arquivos,
                Discord para autenticação, atribuição do cargo de filiado e mensagem de aprovação, e
                kMeet quando você entra em uma reunião de áudio. Esses fornecedores podem operar
                fora do Brasil e processar informações sob seus próprios termos, além dos controles
                aplicáveis ao portal.
              </p>
              <p>
                Ao aprovar a filiação, o bot usa seu ID para tentar atribuir o cargo e enviar uma
                mensagem direta sobre a decisão. O Discord pode bloquear o envio por configurações
                de privacidade ou falta de permissões. Áudio e informações da conferência são
                tratados pelo serviço de reunião quando você escolhe entrar; não é necessário ativar
                microfone para preencher uma candidatura. Links para Meet, Docs, Blue e outros
                serviços levam a ambientes externos com políticas próprias.
              </p>
            </section>
            <section>
              <h2>6. Cookies, segurança e armazenamento</h2>
              <p>
                O portal usa cookie de sessão para manter o login e armazenamento local para
                preferências de interface. A sessão atual tem duração de até oito horas e pode
                terminar antes por logout ou expiração. Não há publicidade comportamental nesta
                funcionalidade de filiação.
              </p>
              <p>
                O site aplica controle de acesso no servidor, proteção das alterações de sessão e
                restrições de acesso aos arquivos. Essas medidas reduzem riscos, mas nenhum serviço
                pode prometer segurança absoluta. Proteja sua conta Discord e não compartilhe
                sessões ou comprovantes com dados pessoais.
              </p>
            </section>
            <section>
              <h2>7. Conservação e seus direitos</h2>
              <p>
                Os dados são mantidos enquanto necessários à análise, à participação no partido e ao
                funcionamento dos recursos solicitados. Candidaturas encerradas podem permanecer
                como histórico administrativo enquanto essa finalidade existir. Não há exclusão
                automática diária das candidaturas. A limpeza diária do mural de divulgação
                refere-se à listagem daquele recurso, não a todo o banco ou às cópias de segurança.
              </p>
              <p>
                Você pode solicitar confirmação de tratamento, acesso, correção, informação sobre
                compartilhamento, retirada do consentimento e exclusão dos dados, nos termos
                aplicáveis. Solicite gratuitamente à administração pelo canal indicado na seção 1. A
                confirmação de identidade deve ser proporcional, preferencialmente pela própria
                conta Discord, sem envio desnecessário de documentos reais. Retirar uma candidatura
                pendente é possível na página de filiação; isso encerra a análise, mas não equivale
                à exclusão de todos os registros.
              </p>
              <p>
                A administração deve avaliar o pedido, informar o atendimento ou explicar eventual
                necessidade de conservação. A exclusão pode depender de obrigações aplicáveis e de
                registros indispensáveis; cópias de segurança seguem os ciclos dos fornecedores.
                Remover dados essenciais pode impedir o uso da conta. Os direitos previstos na
                legislação de proteção de dados permanecem preservados.
              </p>
            </section>
            <section>
              <h2>8. Alterações</h2>
              <p>
                Mudanças relevantes serão identificadas por uma nova versão e comunicadas no portal.
                Novas finalidades que dependam de consentimento exigirão uma nova manifestação. O
                aceite registrado na candidatura corresponde à versão exibida naquele momento.
              </p>
              <p>
                Referência sobre direitos dos titulares:{' '}
                <a
                  href="https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1/direito-dos-titulares"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  orientações da ANPD
                </a>
                .
              </p>
            </section>
          </>
        ) : (
          <>
            <section>
              <h2>1. Natureza do portal</h2>
              <p>
                O portal ANADE organiza a participação na Aliança Nacional Democrática dentro do RPG
                Legado. Personagens, cargos, funções, valores financeiros e atividades partidárias
                referem-se à simulação. O uso deste site não constitui filiação a um partido
                político real, contratação de serviços públicos ou movimentação de dinheiro real.
              </p>
            </section>
            <section>
              <h2>2. Conta, identificação e acesso</h2>
              <p>
                O acesso usa autenticação pelo Discord. Você é responsável pela segurança da sua
                conta e pela veracidade das informações do personagem. Não use contas de terceiros,
                tente contornar permissões ou compartilhe sua sessão. Visitantes podem consultar as
                páginas públicas, os documentos de uso e o processo de filiação; as áreas internas
                exigem filiação ativa.
              </p>
              <p>
                Cargos eletivos, funções partidárias e administração são definidos pelos
                responsáveis autorizados. Informar um título na biografia ou na candidatura não
                concede permissões.
              </p>
            </section>
            <section>
              <h2>3. Solicitação e aprovação da filiação</h2>
              <p>
                O envio da ficha é uma solicitação, sujeita à análise da administração. O login pelo
                Discord ou o preenchimento do formulário não garantem aprovação. A administração
                pode solicitar esclarecimentos, aprovar ou recusar e registrar uma resposta. Você
                pode acompanhar a situação no site e retirar uma solicitação ainda pendente.
              </p>
              <p>
                Ao aprovar, o site libera o acesso e tenta atribuir o cargo de filiado no servidor e
                enviar uma mensagem direta pelo bot. Essas operações dependem do bot, da
                participação no servidor, das permissões e das configurações do Discord. A falha do
                aviso ou do cargo não altera, por si só, a decisão já registrada no portal.
              </p>
            </section>
            <section>
              <h2>4. Regras de convivência e conteúdo</h2>
              <p>
                Respeite os demais participantes, as regras da comunidade e do Legado. Não publique
                ameaças, assédio, discriminação, exposição indevida de dados, conteúdo ilícito,
                códigos maliciosos ou materiais que você não tenha direito de compartilhar. Debates
                e correntes neste portal pertencem ao contexto do jogo.
              </p>
              <p>
                Ao enviar textos e arquivos, você autoriza seu armazenamento e exibição apenas na
                medida necessária às funcionalidades e aos públicos permitidos. A autoria continua
                pertencendo a seus titulares. A administração pode moderar conteúdos e restringir
                acessos diante de abuso, erro de cadastro ou descumprimento destas regras, com
                análise do contexto.
              </p>
            </section>
            <section>
              <h2>5. Reuniões, presenças e votações</h2>
              <p>
                Permissões para criar, moderar ou votar dependem das atribuições e do grupo
                definido. Confirmação de presença, quórum, prazo e modalidade de votação seguem as
                regras exibidas em cada atividade. Não registre presença ou voto por outra pessoa.
              </p>
              <p>
                O áudio pode usar um serviço externo. Recursos de microfone e moderação oferecidos
                pelo provedor podem diferir das permissões internas do portal. Respeite a mesa e não
                grave ou divulgue conversas e imagens de outros participantes sem autorização
                adequada.
              </p>
            </section>
            <section>
              <h2>6. Disponibilidade e serviços externos</h2>
              <p>
                O portal pode passar por manutenção, falhas de conexão e limitações dos
                fornecedores. A equipe não garante disponibilidade ininterrupta nem entrega de
                mensagens em todos os casos. Verifique no site o resultado de operações importantes
                antes de repeti-las. Links externos têm regras próprias e não são controlados pela
                ANADE.
              </p>
            </section>
            <section>
              <h2>7. Privacidade e encerramento</h2>
              <p>
                O tratamento de dados está descrito na{' '}
                <Link href="/privacidade">Política de Privacidade</Link>, parte destas condições.
                Use dados fictícios do personagem nos campos do jogo. Para corrigir informações,
                solicitar exclusão, encerrar sua participação ou esclarecer uma decisão, procure a
                administração no{' '}
                <a href={server} target="_blank" rel="noopener noreferrer">
                  servidor oficial do Discord
                </a>
                . Sair da sessão não exclui a conta nem os registros.
              </p>
            </section>
            <section>
              <h2>8. Atualizações e direitos preservados</h2>
              <p>
                Estes documentos têm versão e data. Alterações relevantes serão comunicadas no
                portal e, quando necessário, exigirão novo aceite. Nenhuma disposição retira
                direitos assegurados pela legislação aplicável ou autoriza uso de dados para
                finalidades não informadas.
              </p>
            </section>
          </>
        )}
        <footer className="affiliation-legal-links">
          <Link href={privacy ? '/termos' : '/privacidade'}>
            {privacy ? 'Ler Termos de Uso' : 'Ler Política de Privacidade'}
          </Link>
          <Link href="/filiacao">Ir para filiação</Link>
        </footer>
      </article>
    </main>
  );
}
