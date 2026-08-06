import type { GeminiResponse } from '../types';

/** A nutrition label photographed alongside the message. */
export interface AttachedImage {
  base64: string;
  mimeType: string;
}

export interface ServerParseResult extends GeminiResponse {
  /** Present only when an image was sent. False means it could not be read. */
  labelRead?: boolean;
}

/**
 * Sends a meal description to the parser, optionally with a nutrition label.
 *
 * The image is additional evidence on the ordinary logging path — there is no
 * separate scanning workflow. Without one, this behaves exactly as it always
 * has.
 */
export async function analyzeFoodServer(
  foodText: string,
  image?: AttachedImage
): Promise<ServerParseResult> {
  const response = await fetch('/api/parse-food', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(
      image
        ? { text: foodText, image: image.base64, mimeType: image.mimeType }
        : { text: foodText }
    )
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.message || errorBody.error || `Server returned status: ${response.status}`);
  }

  return response.json();
}
