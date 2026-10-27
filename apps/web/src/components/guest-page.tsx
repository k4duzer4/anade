'use client';
import { LockKeyhole } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { sidebarItems } from './portal-sidebar';
export function GuestPage({ path }: { path: string }) {
  const params = useSearchParams();
  const route = path === '/convidado' ? params.get('pagina') || '/painel' : path;
  const page =
    sidebarItems.find((item) => item.path === route) ||
    sidebarItems.find((item) => route.startsWith(`${item.path}/`));
  const title = page?.title || 'Portal ANADE';
  return (
    <div className="guest-page">
      <header>
        <span className="eyebrow">ANADE · ACESSO DE CONVIDADO</span>
        <h1>{title}</h1>
      </header>
      <div className="guest-empty">
        <LockKeyhole size={30} />
        <h2>Você está conhecendo o portal.</h2>
        <p>
          Use o menu para explorar as páginas. O conteúdo e as ações internas não estão disponíveis
          neste acesso.
        </p>
        <span>Convidado · Somente navegação</span>
      </div>
    </div>
  );
}
