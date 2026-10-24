'use client';
import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Sparkles,
  Megaphone,
  Lightbulb,
  Rocket,
  ContactRound,
  CalendarDays,
  ShieldCheck,
  Search,
  Camera,
  Trophy,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { Modal } from './ui';

const release = '2026-10-24-organization';
const updates = [
  {
    Icon: Users,
    title: 'Grupos, diretórios e bancadas',
    description:
      'Câmara, Senado, direção, jurídico, comunicação e diretórios estaduais com participantes e liderança definidos pela administração. Cada grupo reúne pautas, prioridades, negociações, orientações e tarefas.',
    href: '/grupos',
    label: 'Explorar grupos',
  },
  {
    Icon: ShieldCheck,
    title: 'Votações para quem decide',
    description:
      'Defina eleitores, abertura, prazo, modalidade, quórum e regra de aprovação. O eleitorado fica fixo ao publicar; pessoas fora da lista não podem votar.',
    href: '/votacoes',
    label: 'Ver votações',
  },
  {
    Icon: Megaphone,
    title: 'Avisos que acompanham você',
    description:
      'O sino reúne atribuições, menções, reuniões próximas e vencimentos, com controle individual de leitura.',
    href: null,
    label: null,
  },
  {
    Icon: Trophy,
    title: 'Cada caixa, seu controle',
    description:
      'Caixa partidário, fundo eleitoral e campanhas separados, com receitas, despesas, reservas, destinatários e comprovantes privados. Os lançamentos formam um extrato permanente do RPG.',
    href: '/financeiro',
    label: 'Financeiro',
  },
  {
    Icon: CalendarDays,
    title: 'O tempo do Legado no painel',
    description:
      'Acompanhe o tick previsto, dia da temporada, eleições, campanhas, posses e efeitos pendentes. Marcos da wiki são previsões; a administração confirma o início e os eventos oficiais.',
    href: '/calendario',
    label: 'Calendário do Legado',
  },
  {
    Icon: ShieldCheck,
    title: 'Acompanhamento jurídico',
    description:
      'Contratos, serviços, processos, intimações, vigência e pagamentos com acesso por caso. Cada documento também pode ter sua própria lista de pessoas autorizadas.',
    href: '/juridico',
    label: 'Jurídico',
  },
  {
    Icon: Lightbulb,
    title: 'Ideias que viram decisões',
    description:
      'Apresente propostas, receba apoios e converse nos comentários. A direção pode encaminhar a ideia para votação.',
    href: '/propostas',
    label: 'Central de propostas',
  },
  {
    Icon: Megaphone,
    title: 'Comunicados em um só lugar',
    description: 'Avisos da administração com destaque, prazo opcional e confirmação de leitura.',
    href: '/comunicados',
    label: 'Ver comunicados',
  },
  {
    Icon: Rocket,
    title: 'Sua próxima campanha',
    description:
      'Espaço para pré-candidaturas, propostas, materiais e compromissos. Começa fechado: a administração decide quando abrir.',
    href: '/campanha',
    label: 'Central de campanha',
  },
  {
    Icon: ContactRound,
    title: 'Uma história para contar',
    description:
      'Linha do tempo no perfil para registrar cargos, candidaturas, mandatos e contribuições ao partido.',
    href: '/ficha',
    label: 'Meu perfil',
  },
  {
    Icon: CalendarDays,
    title: 'Agenda e votações renovadas',
    description:
      'Calendário interativo, filtros e cartões alinhados. Encontros com Meet e ata, decisões com voto nominal, secreto e abstenção.',
    href: '/agenda',
    label: 'Explorar agenda',
  },
  {
    Icon: Camera,
    title: 'Seu perfil, do seu jeito',
    description:
      'Foto e banner de até 4 MB, recorte com ajuste de posição e ações para trocar ou remover direto no perfil.',
    href: '/ficha',
    label: 'Personalizar perfil',
  },
  {
    Icon: Trophy,
    title: 'Participação que aparece',
    description:
      'Ponto diário opcional com dois prints e histórico. A administração acompanha o ranking de engajamento por período.',
    href: '/ponto',
    label: 'Bater ponto',
  },
  {
    Icon: Users,
    title: 'Conheça nossa aliança',
    description:
      'Filiados em grade ou lista, filtros e perfis individuais. Direção com quatro destaques e seis pessoas por fileira seguinte em telas grandes.',
    href: '/filiados',
    label: 'Conhecer filiados',
  },
  {
    Icon: ShieldCheck,
    title: 'Gestão mais completa',
    description:
      'Painel administrativo com indicadores, atividades e gestão de acessos. A Visão geral também ganhou um novo visual e atalhos.',
    href: '/painel',
    label: 'Visão geral',
  },
  {
    Icon: Search,
    title: 'Encontre sem procurar demais',
    description:
      'Busca geral de filiados, reuniões, documentos, votações e novas centrais. Abra pela lupa ou por Ctrl + K (⌘ + K no Mac).',
    href: null,
    label: null,
  },
];

export function PortalUpdates({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const storageKey = `anade:updates:${userId}:${release}`;
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        setOpen(localStorage.getItem(storageKey) !== 'seen');
      } catch {
        setOpen(true);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [storageKey]);
  function close() {
    try {
      localStorage.setItem(storageKey, 'seen');
    } catch {
      // The notice remains usable when browser storage is unavailable.
    }
    setOpen(false);
  }
  return (
    <>
      <section className="updates-banner" aria-label="Atualizações do portal">
        <span className="updates-symbol">
          <Sparkles size={23} />
        </span>
        <div>
          <span className="eyebrow">TEM NOVIDADE NA ALIANÇA</span>
          <strong>O portal evoluiu com você.</strong>
          <p>Novas centrais, mais participação e um visual renovado. Veja tudo que chegou.</p>
        </div>
        <button className="button secondary" onClick={() => setOpen(true)}>
          Ver novidades <ArrowUpRight size={16} />
        </button>
      </section>
      {open && (
        <Modal title="Novidades na ANADE" onClose={close}>
          <div className="updates-intro">
            <span className="eyebrow">ATUALIZAÇÃO · 24 DE OUTUBRO DE 2026</span>
            <h3>Mais perto. Mais juntos.</h3>
            <p>Confira as últimas melhorias para o seu dia no partido.</p>
          </div>
          <div className="updates-list">
            {updates.map(({ Icon, title, description, href, label }) => (
              <article key={title}>
                <span className="updates-symbol">
                  <Icon size={20} />
                </span>
                <div>
                  <h4>{title}</h4>
                  <p>{description}</p>
                  {href && (
                    <Link className="text-button" href={href} onClick={close}>
                      {label}
                      <ArrowUpRight size={13} />
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
          <p className="updates-footnote">
            Também refinamos tipografia, cartões, seletores, calendários, balões e barras de
            rolagem, com identidade ANADE nos modos claro e escuro.
          </p>
          <div className="updates-footer">
            <span>Este resumo continua disponível em “Ver novidades”.</span>
            <button className="button primary" onClick={close}>
              Entendi
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
