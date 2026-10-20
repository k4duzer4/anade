'use client';
import Image from 'next/image';
import { ArrowUpRight, Leaf, BookOpen, Scale, ShieldCheck } from 'lucide-react';
import { PageHeading } from '@/components/ui';
export default function Party() {
  return (
    <>
      <PageHeading
        eyebrow="ALIANÇA NACIONAL DEMOCRÁTICA · 10"
        title="DIFERENTES CORRENTES. UM PROJETO COMUM."
        description="Uma aliança que reúne trajetórias, ideias e a vontade de construir um Brasil mais justo dentro do Legado."
      />
      <section className="party-banner">
        <Image
          src="/brand/filie-se.png"
          alt="Identidade da ANADE 10, em verde, amarelo e tons de papel"
          width={2170}
          height={725}
          sizes="100vw"
        />
      </section>
      <section className="party-statement">
        <span className="eyebrow">O QUE NOS UNE</span>
        <h2>
          DEMOCRACIA. TRABALHO.
          <br />
          <em>JUSTIÇA SOCIAL.</em>
        </h2>
        <p>
          Soberania, serviços públicos e desenvolvimento sustentável. Diferentes caminhos se
          encontram na ANADE para construir um projeto coletivo.
        </p>
      </section>
      <div className="principles-grid">
        {[
          {
            icon: ShieldCheck,
            title: 'SEGURANÇA INTELIGENTE',
            text: 'Proteção, inteligência e presença do Estado nas áreas mais vulneráveis.',
          },
          {
            icon: BookOpen,
            title: 'TRABALHO E FORMAÇÃO',
            text: 'Oportunidades reais, ensino técnico e desenvolvimento local.',
          },
          {
            icon: Scale,
            title: 'JUSTIÇA TRIBUTÁRIA',
            text: 'Um sistema mais simples, progressivo e comprometido com a justiça social.',
          },
          {
            icon: Leaf,
            title: 'DESENVOLVIMENTO COM INCLUSÃO',
            text: 'Produção nacional, infraestrutura, energia limpa e redução das desigualdades.',
          },
        ].map((p) => (
          <article key={p.title}>
            <p.icon size={25} />
            <h3>{p.title}</h3>
            <p>{p.text}</p>
          </article>
        ))}
      </div>
      <div className="party-gallery">
        <section>
          <header>
            <span className="eyebrow">PLURALIDADE QUE CONSTRÓI</span>
            <h2>NOSSAS CORRENTES</h2>
            <p>
              As correntes da ANADE representam o debate interno do partido. A ideologia declarada
              da ficha segue as opções oficiais do Legado.
            </p>
          </header>
          <a href="/brand/correntes.png" target="_blank" rel="noopener noreferrer">
            <Image
              src="/brand/correntes.png"
              alt="Correntes da ANADE: comunismo, socialismo democrático, trabalhismo, social-democracia, desenvolvimentismo, ecossocialismo, esquerda libertária e progressismo"
              width={1120}
              height={1405}
              sizes="(max-width: 700px) 100vw, 40vw"
            />
            <span>
              Ver arte completa
              <ArrowUpRight size={16} />
            </span>
          </a>
        </section>
        <section>
          <header>
            <span className="eyebrow">UM BRASIL MAIS FORTE</span>
            <h2>NOSSO PROJETO</h2>
            <p>Trabalho, oportunidade e justiça. Desenvolver o Brasil é cuidar das pessoas.</p>
          </header>
          <a href="/brand/projeto.png" target="_blank" rel="noopener noreferrer">
            <Image
              src="/brand/projeto.png"
              alt="Propostas da ANADE para segurança, trabalho, justiça tributária e desenvolvimento com inclusão"
              width={1024}
              height={1536}
              sizes="(max-width: 700px) 100vw, 40vw"
            />
            <span>
              Ver arte completa
              <ArrowUpRight size={16} />
            </span>
          </a>
        </section>
      </div>
    </>
  );
}
