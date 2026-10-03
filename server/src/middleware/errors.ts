import type { NextFunction, Request, Response } from 'express';
import { log } from '../utils/logger';

/** Every error response has this shape. Stack traces are never sent to the client. */
export interface ApiError {
  success: false;
  error: { code: string; message: string };
}

export function sendError(res: Response, status: number, code: string, message: string): void {
  const body: ApiError = { success: false, error: { code, message } };
  res.status(status).json(body);
}

export function notFound(req: Request, res: Response): void {
  sendError(res, 404, 'NOT_FOUND', `No route for ${req.method} ${req.path}`);
}

/** Maps known parser and body errors to safe messages; everything else becomes a generic 500. */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = res.locals.requestId as string | undefined;
  const status = (err as { status?: number }).status;

  if (status === 413) {
    sendError(res, 413, 'PAYLOAD_TOO_LARGE', 'The request body is too large.');
    return;
  }
  if (status === 400 && err instanceof SyntaxError) {
    sendError(res, 400, 'INVALID_JSON', 'The request body is not valid JSON.');
    return;
  }

  log('error', 'unhandled error', {
    requestId,
    method: req.method,
    path: req.path,
    errorName: err instanceof Error ? err.name : 'UnknownError',
    errorMessage: err instanceof Error ? err.message : String(err),
  });
  sendError(res, 500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
}
