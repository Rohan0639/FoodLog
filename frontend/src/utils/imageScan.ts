/**
 * Preparing a label photo and sending it to be read.
 *
 * A modern phone camera produces 8–12MP JPEGs of several megabytes. Sending
 * that raw would be slow on mobile data and buys nothing — nutrition panel text
 * is perfectly legible at 1600px. Downscaling in the browser cuts a typical
 * upload from ~4MB to ~250KB.
 */

export interface ScannedLabel {
  status: 'valid' | 'invalid';
  reason?: string;
  brand: string | null;
  productName: string;
  baseQuantity: number;
  baseUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  rawText?: string;
}

/** Long edge, in pixels. Panel text stays readable well below this. */
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

export interface PreparedImage {
  /** base64 without the data-URL prefix, for the API. */
  base64: string;
  mimeType: string;
  /** Full data URL, for previewing and optionally keeping with the food. */
  dataUrl: string;
}

/**
 * Loads, downscales and re-encodes a picked image.
 *
 * Re-encoding as JPEG also normalises HEIC and other formats a phone might
 * hand over, so the endpoint only ever sees types it accepts.
 */
export function prepareImage(file: File): Promise<PreparedImage> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('That file is not an image.'));
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);

      try {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('This browser could not process the image.'));
          return;
        }

        // Labels are often photographed slightly out of focus; smoothing the
        // downscale keeps the digits cleaner than nearest-neighbour would.
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        const base64 = dataUrl.split(',')[1] ?? '';

        if (!base64) {
          reject(new Error('Could not read that image.'));
          return;
        }

        resolve({ base64, mimeType: 'image/jpeg', dataUrl });
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Could not process the image.'));
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That image could not be opened.'));
    };

    img.src = url;
  });
}

/** Sends a prepared image to be read. Throws with a message fit for display. */
export async function scanLabel(image: PreparedImage): Promise<ScannedLabel> {
  const response = await fetch('/api/scan-label', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: image.base64, mimeType: image.mimeType }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      body.message || body.error || `Could not read the label (${response.status}).`
    );
  }

  return response.json();
}
