import sharp from 'sharp';

export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
// Vercel Functions ~4.5MB istek gövdesi limiti uyguluyor; bu sınırın altında tutuyoruz.
export const MAX_IMAGE_SIZE = 4 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1600;
const WEBP_QUALITY = 80;

export async function convertToWebp(file: File): Promise<Buffer> {
  const inputBuffer = Buffer.from(await file.arrayBuffer());
  const isAnimated = file.type === 'image/gif' || file.type === 'image/webp';

  return sharp(inputBuffer, { animated: isAnimated })
    .resize({ width: MAX_IMAGE_DIMENSION, height: MAX_IMAGE_DIMENSION, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}
