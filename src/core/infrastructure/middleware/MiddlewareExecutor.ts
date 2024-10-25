import { Request, Response, NextFunction } from 'express';
import { MiddlewareMetadata, EnhancedMiddleware } from '@/core/decorators/middleware.decorator';

export class MiddlewareExecutor {
  private static async executeMiddleware(
    middleware: EnhancedMiddleware,
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (middleware.config?.condition) {
        const shouldExecute = await middleware.config.condition(req);
        if (!shouldExecute) {
          return next();
        }
      }

      const result = middleware.execute(req, res, next);
      if (result instanceof Promise) {
        await result;
      }
    } catch (error) {
      next(error);
    }
  }

  public static async executeMiddlewares(
    middlewares: MiddlewareMetadata[],
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    // Sort middlewares by order
    const sortedMiddlewares = [...middlewares].sort(
      (a, b) => (a.config.order || 0) - (b.config.order || 0)
    );

    let currentIndex = 0;

    const executeNext = async () => {
      if (currentIndex >= sortedMiddlewares.length) {
        return next();
      }

      const { middleware } = sortedMiddlewares[currentIndex++];
      await this.executeMiddleware(middleware, req, res, executeNext);
    };

    await executeNext();
  }
}