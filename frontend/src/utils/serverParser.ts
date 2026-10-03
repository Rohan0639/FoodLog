import type { GeminiResponse } from '../types';
import { apiRequest } from '../services/api/client';

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
 * Sends a meal description to the authenticated parser, optionally with a
 * nutrition label. The server answers from the user's saved foods first and only
 * calls the AI for what is new.
 */
export function analyzeFoodServer(
  foodText: string,
  image?: AttachedImage
): Promise<ServerParseResult> {
  return apiRequest<ServerParseResult>('/api/parse-food', {
    method: 'POST',
    body: image
      ? { text: foodText, image: image.base64, mimeType: image.mimeType }
      : { text: foodText },
  });
}
