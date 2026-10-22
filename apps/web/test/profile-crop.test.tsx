import { describe, expect, it, vi } from 'vitest';
import { centeredCrop, cropRectangle, exportProfileCrop } from '../src/lib/profile-crop';

describe('área salva no recorte', () => {
  it('mantém o quadrado e permite escolher as duas extremidades da foto horizontal', () => {
    expect(cropRectangle(1600, 900, 1, centeredCrop)).toEqual({
      x: 350,
      y: 0,
      width: 900,
      height: 900,
    });
    expect(cropRectangle(1600, 900, 1, { ...centeredCrop, x: 1 }).x).toBe(0);
    expect(cropRectangle(1600, 900, 1, { ...centeredCrop, x: -1 }).x).toBe(700);
  });
  it('banner mantém 3:1 e zoom nunca expõe áreas fora da imagem', () => {
    for (const aspect of [1, 3])
      for (const x of [-20, -1, 0, 1, 20])
        for (const y of [-20, 0, 20])
          for (const zoom of [0.1, 1, 2, 3, 20]) {
            const rect = cropRectangle(900, 1600, aspect, { x, y, zoom });
            expect(rect.width / rect.height).toBeCloseTo(aspect);
            expect(rect.x).toBeGreaterThanOrEqual(0);
            expect(rect.y).toBeGreaterThanOrEqual(0);
            expect(rect.x + rect.width).toBeLessThanOrEqual(900.000001);
            expect(rect.y + rect.height).toBeLessThanOrEqual(1600.000001);
          }
    expect(cropRectangle(900, 1600, 3, { x: 0, y: 1, zoom: 1 }).y).toBe(0);
    expect(cropRectangle(900, 1600, 3, { x: 0, y: -1, zoom: 1 }).y).toBe(1300);
  });
  it('exporta exatamente a área escolhida, em WebP e nas dimensões do destino', async () => {
    const drawImage = vi.fn();
    const context = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
    const toBlob = vi
      .spyOn(HTMLCanvasElement.prototype, 'toBlob')
      .mockImplementation((callback) => callback(new Blob(['encoded'], { type: 'image/webp' })));
    const image = { naturalWidth: 1600, naturalHeight: 900 } as HTMLImageElement;
    try {
      const result = await exportProfileCrop(image, 'avatar', { x: 1, y: 0, zoom: 2 });
      expect(drawImage).toHaveBeenLastCalledWith(image, 0, 225, 450, 450, 0, 0, 512, 512);
      expect(result.type).toBe('image/webp');
      expect(result.size).toBeGreaterThan(0);
      await exportProfileCrop(image, 'banner', { x: 0, y: -1, zoom: 1 });
      expect(drawImage).toHaveBeenLastCalledWith(
        image,
        0,
        900 - 1600 / 3,
        1600,
        1600 / 3,
        0,
        0,
        1920,
        640,
      );
    } finally {
      context.mockRestore();
      toBlob.mockRestore();
    }
  });
});
