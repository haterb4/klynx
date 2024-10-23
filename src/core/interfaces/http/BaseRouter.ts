import { Router } from 'express';
import { BaseMiddleware } from './BaseMiddleware';

export abstract class BaseRouter {
  protected router: Router;
  private middlewares: BaseMiddleware[];

  constructor() {
    this.router = Router();
    this.middlewares = [];
  }

  protected abstract setupRoutes(): void;

  public addMiddleware(middleware: BaseMiddleware): void {
    this.middlewares.push(middleware);
  }

  protected applyMiddleware(middleware: BaseMiddleware): void {
    this.router.use(middleware.execute.bind(middleware));
  }

  public getRouter(): Router {
    // Apply all middlewares
    this.middlewares.forEach(middleware => this.applyMiddleware(middleware));
    // Setup routes
    this.setupRoutes();
    return this.router;
  }
}