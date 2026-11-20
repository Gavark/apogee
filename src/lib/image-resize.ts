/** Largest size that fits in a max×max box, keeping the aspect ratio; never upscales. */
export function fitWithin(width: number, height: number, max = 1600): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const k = max / longest;
  return { width: Math.round(width * k), height: Math.round(height * k) };
}

async function toJpeg(file: File, max: number, quality: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, max);
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(width, height);
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
      return await canvas.convertToBlob({ type: 'image/jpeg', quality });
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', quality)
    );
  } finally {
    bitmap.close();
  }
}

/** Downsizes a photo to a JPEG before upload. Falls back to the original file if the browser cannot decode it. */
export async function resizeImage(file: File, max = 1600, quality = 0.8): Promise<Blob> {
  try {
    if (typeof createImageBitmap === 'undefined') return file;
    return await toJpeg(file, max, quality);
  } catch {
    return file;
  }
}
