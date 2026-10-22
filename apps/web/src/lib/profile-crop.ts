export type CropPosition = { x: number; y: number; zoom: number };
export const centeredCrop: CropPosition = { x: 0, y: 0, zoom: 1 };
export const clamp = (value: number, min = -1, max = 1) => Math.min(max, Math.max(min, value));

export function cropRectangle(
  width: number,
  height: number,
  aspect: number,
  position: CropPosition,
) {
  const zoom = clamp(position.zoom, 1, 3);
  const cropWidth = Math.min(width, height * aspect) / zoom;
  const cropHeight = cropWidth / aspect;
  return {
    x: ((width - cropWidth) * (1 - clamp(position.x))) / 2,
    y: ((height - cropHeight) * (1 - clamp(position.y))) / 2,
    width: cropWidth,
    height: cropHeight,
  };
}

export async function exportProfileCrop(
  image: HTMLImageElement,
  kind: 'avatar' | 'banner',
  position: CropPosition,
): Promise<File> {
  const rect = cropRectangle(
    image.naturalWidth,
    image.naturalHeight,
    kind === 'avatar' ? 1 : 3,
    position,
  );
  const canvas = document.createElement('canvas');
  canvas.width = kind === 'avatar' ? 512 : 1920;
  canvas.height = kind === 'avatar' ? 512 : 640;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Seu navegador não conseguiu preparar o recorte. Tente novamente.');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    image,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', 0.9),
  );
  if (!blob || blob.size === 0 || blob.size > 4 * 1024 * 1024)
    throw new Error('Não foi possível preparar esse recorte. Escolha outra imagem.');
  return new File([blob], `${kind}-recortado.webp`, { type: 'image/webp' });
}
