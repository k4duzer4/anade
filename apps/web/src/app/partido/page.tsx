import type { Metadata } from 'next';
import PartyContent from '@/components/party-content';
import { PublicHeader } from '@/components/public-header';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
export const metadata: Metadata = { title: 'A ANADE' };
export default function PartyPage() {
  return (
    <div className="public-party">
      <PublicHeader />
      <main className="public-party-content" id="conteudo">
        <PartyContent />
        <section className="public-invitation">
          <span className="eyebrow">O PRÓXIMO CAPÍTULO É COLETIVO</span>
          <h2>Seu lugar nessa aliança.</h2>
          <p>Já faz parte da ANADE? Entre com sua conta do Discord para acessar nosso diretório.</p>
          <Link href="/" className="button primary">
            Acessar o portal
            <ArrowRight size={17} />
          </Link>
        </section>
        <footer className="public-party-footer">
          <span>ANADE 10 · Aliança Nacional Democrática</span>
          <span>RPG Legado · Portal independente</span>
        </footer>
      </main>
    </div>
  );
}
