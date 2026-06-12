/**
 * QR Code generator using the `qrcode` library.
 * Produces valid, scannable QR code PNGs from encrypted text.
 */
import QRCode from 'qrcode';

/**
 * Renders text as a QR code PNG Blob.
 */
export async function generateQrPng(text: string, scale = 8): Promise<Blob> {
  const canvas = document.createElement('canvas');
  await QRCode.toCanvas(canvas, text, {
    errorCorrectionLevel: 'L',
    margin: 4,
    scale,
    color: { dark: '#000000', light: '#ffffff' },
  });
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to render QR code image.'));
      },
      'image/png',
    );
  });
}

/**
 * Maximum text length this QR generator can encode (Version 40, Level L, byte mode).
 */
export const QR_MAX_BYTES = 2953;
