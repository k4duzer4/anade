'use client';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, LogIn } from 'lucide-react';
import { ThemeSwitcher } from './theme-switcher';
import { usePortal } from './portal-provider';
export function PublicHeader() {
  const { data } = usePortal();
  return (
    <header className="public-header">
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <Link href="/" className="public-brand" aria-label="ANADE 10, login">
        <span className="public-brand-image">
          <Image src="/brand/anade-logo.png" alt="" width={145} height={145} />
        </span>
        <span>
          ALIANÇA NACIONAL
          <br />
          <strong>DEMOCRÁTICA</strong>
        </span>
      </Link>
      <nav aria-label="Navegação pública">
        <Link href="/partido" className="public-active" aria-current="page">
          A ANADE
          <ArrowUpRight size={13} />
        </Link>
        <ThemeSwitcher />
        {data ? (
          <Link className="button primary" href="/painel">
            Abrir diretório
            <ArrowUpRight size={15} />
          </Link>
        ) : (
          <Link className="button primary" href="/">
            <LogIn size={15} />
            Login
          </Link>
        )}
      </nav>
    </header>
  );
}
