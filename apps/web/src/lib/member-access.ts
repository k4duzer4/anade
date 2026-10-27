import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
const readAccess = cache(async () => {
  const session = (await cookies()).get('anade.sid');
  if (!session) redirect('/');
  try {
    const options: RequestInit = {
      headers: { Cookie: `anade.sid=${encodeURIComponent(session.value)}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    };
    // API_ORIGIN é injetada pelo binding da Vercel apenas no servidor, em runtime.
    const backend = process.env.API_ORIGIN || (process.env.VERCEL ? null : 'http://127.0.0.1:3001');
    if (!backend) throw new Error('API indisponível.');
    const response = await fetch(new URL('api/access', `${backend.replace(/\/$/, '')}/`), options);
    if ([401, 403].includes(response.status)) return null;
    if (!response.ok) throw new Error('ACCESS_UNAVAILABLE');
    const user = (await response.json()).user;
    if (!user || typeof user.id !== 'string' || !user.id || typeof user.admin !== 'boolean')
      throw new Error('ACCESS_INVALID');
    return user as { id: string; admin: boolean; guest?: boolean };
  } catch {
    // An unavailable API must not look like a revoked session or start a login loop.
    throw new Error('O portal está temporariamente indisponível. Tente novamente.');
  }
});
export async function requireMember({
  adminOnly = false,
  allowGuest = false,
}: { adminOnly?: boolean; allowGuest?: boolean } = {}) {
  const user = await readAccess();
  if (!user) redirect('/');
  if (user.guest && !allowGuest) redirect('/convidado');
  if (adminOnly && !user.admin) redirect('/painel');
}
export async function requireGuest() {
  const user = await readAccess();
  if (!user) redirect('/');
  if (!user.guest) redirect('/painel');
}
