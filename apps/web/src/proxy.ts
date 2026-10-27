import { NextResponse, type NextRequest } from 'next/server';
export async function proxy(request: NextRequest) {
  const session = request.cookies.get('anade.sid');
  if (!session) return NextResponse.next();
  try {
    const backend = process.env.API_ORIGIN || (process.env.VERCEL ? null : 'http://127.0.0.1:3001');
    if (!backend) throw new Error('API_UNAVAILABLE');
    const result = await fetch(new URL('api/access', `${backend.replace(/\/$/, '')}/`), {
      headers: { Cookie: `anade.sid=${encodeURIComponent(session.value)}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    if ([401, 403].includes(result.status)) return NextResponse.next();
    if (!result.ok) throw new Error('ACCESS_UNAVAILABLE');
    const { user } = await result.json();
    if (!user || typeof user.id !== 'string' || !user.id || typeof user.admin !== 'boolean')
      throw new Error('ACCESS_INVALID');
    if (user.guest !== true) return NextResponse.next();
    // Rewrite before the original page or its server components can execute.
    const destination = request.nextUrl.clone();
    destination.pathname = '/convidado';
    destination.search = '';
    destination.searchParams.set('pagina', request.nextUrl.pathname);
    const response = NextResponse.rewrite(destination);
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('Vary', 'Cookie');
    return response;
  } catch {
    return new NextResponse('O portal está temporariamente indisponível. Tente novamente.', {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
export const config = {
  matcher: [
    '/painel/:path*',
    '/agenda/:path*',
    '/plenario/:path*',
    '/calendario/:path*',
    '/comunicados/:path*',
    '/ponto/:path*',
    '/votacoes/:path*',
    '/propostas/:path*',
    '/campanha/:path*',
    '/divulgacao/:path*',
    '/grupos/:path*',
    '/bancadas/:path*',
    '/filiados/:path*',
    '/direcao/:path*',
    '/estatuto/:path*',
    '/financeiro/:path*',
    '/juridico/:path*',
    '/administracao/:path*',
    '/ficha/:path*',
    '/partido/:path*',
  ],
};
