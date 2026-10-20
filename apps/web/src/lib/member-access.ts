import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
export async function requireMember() {
  const session = (await cookies()).get('anade.sid');
  if (!session) redirect('/');
  let allowed = false;
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
    allowed = response.ok;
  } catch {
    /* Sem confirmação da API, o conteúdo interno permanece fechado. */
  }
  if (!allowed) redirect('/');
}
