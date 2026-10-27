'use client';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { FloatingLayerContext, Tooltip } from './floating-ui';
import {
  X,
  ArrowUpRight,
  LoaderCircle,
  Diamond,
  Landmark,
  ShieldCheck,
  CalendarClock,
  Radio,
  Archive,
  CheckCheck,
} from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
export function Badge({
  children,
  tone = 'green',
}: {
  children: ReactNode;
  tone?: 'green' | 'gold' | 'gray';
}) {
  return (
    <span className={`badge ${tone}`}>
      <span className="badge-mark" aria-hidden="true">
        <Diamond size={10} />
      </span>
      <span className="badge-label">{children}</span>
    </span>
  );
}
export function RoleInsignia({ admin }: { admin: boolean }) {
  const Icon = admin ? Landmark : ShieldCheck;
  return (
    <div className={`role-insignia ${admin ? 'role-director' : 'role-member'}`}>
      <span className="role-crest" aria-hidden="true">
        <Icon size={22} />
      </span>
      <span className="role-caption">
        <small>ANADE · 10</small>
        <strong>{admin ? 'Direção nacional' : 'Filiado ANADE'}</strong>
        <span>{admin ? 'Administração do partido' : 'Parte da nossa aliança'}</span>
      </span>
    </div>
  );
}
export function StatusLabel({ kind }: { kind: 'scheduled' | 'completed' | 'open' | 'closed' }) {
  const status = {
    scheduled: { Icon: CalendarClock, caption: 'AGENDA ANADE', label: 'Próximo encontro' },
    completed: { Icon: CheckCheck, caption: 'REGISTRO', label: 'Realizada' },
    open: { Icon: Radio, caption: 'DECISÃO COLETIVA', label: 'Em votação' },
    closed: { Icon: Archive, caption: 'RESULTADO', label: 'Encerrada' },
  }[kind];
  return (
    <span className="status-label" data-state={kind}>
      <span className="status-symbol" aria-hidden="true">
        <status.Icon size={20} />
      </span>
      <span className="status-copy">
        <small>{status.caption}</small>
        <strong>{status.label}</strong>
      </span>
    </span>
  );
}
export function PageHeading({
  eyebrow = 'PORTAL DO FILIADO',
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>;
}
export function Modal({
  title,
  children,
  onClose,
  className = '',
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [container, setContainer] = useState<HTMLDialogElement | null>(null);
  const attachDialog = useCallback((node: HTMLDialogElement | null) => {
    ref.current = node;
    setContainer(node);
  }, []);
  const titleId = useId();
  const reduced = useReducedMotion();
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <m.dialog
      className={`modal ${className}`}
      ref={attachDialog}
      onCancel={onClose}
      aria-labelledby={titleId}
      initial={reduced ? false : { opacity: 0, scale: 0.96, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      <FloatingLayerContext.Provider value={container}>
        <header>
          <h2 id={titleId}>{title}</h2>
          <Tooltip content="Fechar janela">
            <button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}>
              <X size={20} />
            </button>
          </Tooltip>
        </header>
        <div className="modal-content">{children}</div>
      </FloatingLayerContext.Provider>
    </m.dialog>
  );
}
export function SubmitButton({
  busy,
  disabled = false,
  children,
}: {
  busy: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button type="submit" className="button primary" disabled={busy || disabled}>
      {busy ? <LoaderCircle className="spin" size={16} /> : null}
      {children}
    </button>
  );
}
export function ErrorNotice({ message }: { message: string }) {
  return message ? (
    <p className="error-notice" role="alert">
      {message}
    </p>
  ) : null;
}
export function ExternalWiki() {
  return (
    <a href="https://legado.planalto.fun/wiki/" target="_blank" rel="noopener noreferrer">
      Wiki do Legado <ArrowUpRight size={14} />
    </a>
  );
}
