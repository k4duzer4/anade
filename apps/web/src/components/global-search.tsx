'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, LoaderCircle, Search } from 'lucide-react';
import { Modal, ErrorNotice } from './ui';
import { loadCommunity } from '@/lib/community';
type Result = { type: string; id: string; title: string; excerpt: string; href: string };
export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener('keydown', shortcut);
    return () => document.removeEventListener('keydown', shortcut);
  }, []);
  return (
    <>
      <button
        className="global-search-trigger"
        type="button"
        aria-label="Buscar no portal"
        aria-keyshortcuts="Control+k Meta+k"
        onClick={() => setOpen(true)}
      >
        <Search size={17} />
        <span>Buscar no portal</span>
        <kbd>Ctrl K</kbd>
      </button>
      {open && (
        <Modal title="Buscar no portal" onClose={() => setOpen(false)}>
          <SearchContent onClose={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}
function SearchContent({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState(''),
    [result, setResult] = useState<{ results: Result[]; limited: boolean } | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    if (q.trim().length < 2) return;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      loadCommunity<{ results: Result[]; limited: boolean }>(
        `/api/search?q=${encodeURIComponent(q.trim())}`,
        abort.signal,
      )
        .then((value) => {
          if (abort.signal.aborted) return;
          setResult(value);
          setError('');
        })
        .catch((failure) => {
          if (!abort.signal.aborted) setError(failure.message);
        })
        .finally(() => {
          if (!abort.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [q]);
  return (
    <div className="global-search-content">
      <label className="refresh-search">
        <Search size={19} />
        <input
          aria-label="Pesquisar no portal"
          placeholder="Filiados, reuniões, documentos, votações…"
          maxLength={100}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setResult(null);
            setError('');
            setLoading(false);
          }}
          autoFocus
        />
        {loading && q.trim().length >= 2 && <LoaderCircle size={16} className="spin" />}
      </label>
      {q.trim().length < 2 ? (
        <p className="form-description">
          Digite pelo menos dois caracteres. A busca inclui propostas, comunicados e campanhas
          quando disponíveis para você.
        </p>
      ) : (
        <>
          <ErrorNotice message={error} />
          <div className="global-search-results">
            {result?.results.map((item) => (
              <Link href={item.href} onClick={onClose} key={`${item.type}-${item.id}`}>
                <span>{item.type}</span>
                <strong>{item.title}</strong>
                <p>{item.excerpt}</p>
                <ArrowUpRight size={16} />
              </Link>
            ))}
            {result && !result.results.length && (
              <p className="form-description">
                Nenhum resultado encontrado. Experimente outro nome ou assunto.
              </p>
            )}
            {result?.limited && (
              <p className="form-description">
                Mostrando os primeiros resultados. Refine a busca para encontrar algo específico.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
