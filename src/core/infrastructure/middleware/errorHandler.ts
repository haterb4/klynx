import { Request, Response, NextFunction } from 'express';
import { Result } from '../../../utils/Result';
import { BaseError } from '../../../utils/BaseError';


export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(`Error processing request: ${error.message}`);
  console.error(error.stack);

  // Handle Result errors
  if (error instanceof Result) {
    return res.status(400).json({
      type: 'ValidationError',
      message: error.getError()
    });
  }

  // Handle domain errors
  if (error instanceof BaseError) {
    return res.status((error as BaseError).statusCode || 400).json({
      type: error.constructor.name,
      message: error.message
    });
  }

  // Handle HTTP errors
  if (error instanceof HttpError) {
    return res.status(error.statusCode).json({
      type: 'HttpError',
      message: error.message
    });
  }

  // Handle unexpected errors
  return res.status(500).json({
    type: 'InternalServerError',
    message: 'An unexpected error occurred'
  });
};