type RequestOptions = {
  method?: string;
  body?: unknown;
  csrf?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
};
export async function portalRequest<T = unknown>(
  url: string,
  {
    method = 'GET',
    body,
    csrf,
    signal,
    timeoutMs = method === 'GET' ? 15000 : 45000,
  }: RequestOptions = {},
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    const multipart = body instanceof FormData;
    const response = await fetch(url, {
      method,
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        ...(!multipart ? { 'Content-Type': 'application/json' } : {}),
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
      },
      ...(body !== undefined ? { body: multipart ? body : JSON.stringify(body) } : {}),
    });
    if (!response.headers.get('content-type')?.includes('application/json'))
      throw new Error('O portal está temporariamente indisponível. Tente novamente em instantes.');
    const value = await response.json();
    if (!response.ok)
      throw Object.assign(new Error(value.error || 'Não foi possível concluir a operação.'), {
        status: response.status,
        code: value.code,
      });
    return value as T;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (timedOut)
      throw Object.assign(
        new Error(
          method === 'GET'
            ? 'A consulta demorou demais. Tente atualizar novamente.'
            : 'Não foi possível confirmar a alteração a tempo. Confira se ela foi aplicada antes de tentar novamente.',
        ),
        { status: 408 },
      );
    if (error instanceof TypeError)
      throw new Error(
        method === 'GET'
          ? 'Não foi possível conectar ao portal. Verifique sua conexão e tente atualizar.'
          : 'A conexão foi interrompida. Confira se a alteração foi aplicada antes de tentar novamente.',
        { cause: error },
      );
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

// Background events share one read. A write requests a fresh pass after any older read.
export function createRefreshQueue(work: () => Promise<void>) {
  let inFlight: Promise<void> | null = null,
    again = false;
  return (fresh = false) => {
    if (inFlight) {
      again ||= fresh;
      return inFlight;
    }
    inFlight = (async () => {
      do {
        again = false;
        await work();
      } while (again);
    })().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };
}
