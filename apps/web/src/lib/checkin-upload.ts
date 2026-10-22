const MAX_SOURCE = 10 * 1024 * 1024;
const MAX_PREPARED = 1800 * 1024;

export async function prepareCheckinProof(file: File): Promise<Blob> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    throw new Error('Use um print em PNG, JPG ou WebP.');
  if (file.size > MAX_SOURCE) throw new Error('Cada print deve ter até 10 MB.');
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('Não foi possível ler esse print. Escolha outra imagem.');
  });
  try {
    const scale = Math.min(1, 2000 / bitmap.width, 5000 / bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context)
      throw new Error('Seu navegador não conseguiu preparar a imagem. Tente outro navegador.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.9, 0.78, 0.65]) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/webp', quality),
      );
      if (blob && blob.size <= MAX_PREPARED) return blob;
    }
    throw new Error('O print está muito grande. Recorte a parte importante e tente novamente.');
  } finally {
    bitmap.close();
  }
}

export async function loadCheckins<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', signal });
  if (!response.headers.get('content-type')?.includes('application/json'))
    throw new Error('Não foi possível carregar os pontos. Tente novamente.');
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Não foi possível consultar os pontos.');
  return body;
}
