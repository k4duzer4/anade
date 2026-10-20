import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
export async function requireMember() {
  const session = (await cookies()).get('anade.sid');
  if (!session) redirect('/');
  let allowed = false;
  try {
    const response = await fetch(
      `${process.env.API_ORIGIN || 'http://127.0.0.1:3001'}/api/access`,
      {
        headers: { Cookie: `anade.sid=${encodeURIComponent(session.value)}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      },
    );
    allowed = response.ok;
  } catch {
    /* Sem confirmação da API, o conteúdo interno permanece fechado. */
  }
  if (!allowed) redirect('/');
}
