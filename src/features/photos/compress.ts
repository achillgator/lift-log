// On-device photo compression: JPEG 0.8, 1600 px long edge, plus a 320 px thumbnail.
// Browser-only (canvas). The sizing math is tested in src/lib/later/photos.ts.
import { fitWithin, IMAGE_LONG_EDGE, JPEG_QUALITY, THUMB_LONG_EDGE } from '../../lib/later/photos';

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  release(): void;
}

async function decode(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() };
    } catch {
      // Some formats only decode through <img> (HEIC on some iOS versions). Fall through.
    }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new Error('That file is not a photo this device can open.');
  }
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
}

function draw(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This device could not process the photo.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

function toJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('This device could not save the photo.'))), 'image/jpeg', JPEG_QUALITY),
  );
}

/** Compresses a picked photo. The thumbnail is drawn from the resized image for a sharper result. */
export async function compressPhoto(file: Blob): Promise<{ image: Blob; thumb: Blob }> {
  const decoded = await decode(file);
  try {
    const big = fitWithin(decoded.width, decoded.height, IMAGE_LONG_EDGE);
    const imageCanvas = draw(decoded.source, big.width, big.height);
    const small = fitWithin(big.width, big.height, THUMB_LONG_EDGE);
    const thumbCanvas = draw(imageCanvas, small.width, small.height);
    const [image, thumb] = await Promise.all([toJpeg(imageCanvas), toJpeg(thumbCanvas)]);
    // Free the canvas memory at once; iOS caps total canvas memory per page.
    imageCanvas.width = imageCanvas.height = thumbCanvas.width = thumbCanvas.height = 0;
    return { image, thumb };
  } finally {
    decoded.release();
  }
}
