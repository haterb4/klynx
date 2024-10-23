import { Request, Response, NextFunction } from 'express';

export abstract class BaseMiddleware {
  abstract execute(req: Request, res: Response, next: NextFunction): Promise<void>;
  
  protected async handleError(error: Error, res: Response): Promise<void> {
    res.status(500).json({
      message: 'Internal server error',
      error: error.message
    });
  }
}