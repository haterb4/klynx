// createApp.ts
import 'reflect-metadata';
import express, { Application } from 'express';
import { AwilixContainer } from 'awilix';
import { scopePerRequest } from 'awilix-express';
import cors from 'cors';
import http from 'http';
import { loadControllers } from './loadControllers';
import { errorHandler } from '../middleware/errorHandler';
import { Request, Response, NextFunction } from 'express';
import { DatabaseConnection, DatabaseConnectionOptions } from '../persistence/DatabaseConnection';
import { container } from '../di/Container';
import { CacheManager } from '../cache/CacheManager';
import { Logger } from '../logging/Logger';
import { MetricsCollector } from '../monitoring/MetricsCollector';
import { TransactionManager } from '../transactions/TransactionManager';
import compression from 'compression';
import { WebSocketManager } from '../websocket/WebSocketManager';
import { SwaggerOptions, SwaggerSetup } from '../swagger/SwaggerSetup';
import path from 'path';
import { Model } from '../orm/orm.model';

export interface CreateAppOptions {
  container: AwilixContainer;
  modulesPath: string;
  corsOptions?: cors.CorsOptions;
  databaseConfig?: DatabaseConnectionOptions;
  enableWebSockets?: boolean;
  enableCompression?: boolean;
  enableSecurity?: boolean;
  swagger?: {
    enabled: boolean;
    options?: SwaggerOptions;
  };
}

export class App {
  private app: Application;
  private server: http.Server | null = null;
  private wsManager: WebSocketManager | null = null;

  constructor(app: Application) {
    this.app = app;
  }

  public getExpressApp(): Application {
    return this.app;
  }

  public getServer(): http.Server | null {
    return this.server;
  }

  public getWebSocketManager(): WebSocketManager | null {
    return this.wsManager;
  }

  public listen(port: number | string = 8001): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
        console.log(`Documentation available at http://localhost:${port}/api-docs`);
        
        // Initialize WebSocket after server is started
        if (this.wsManager) {
          this.wsManager.initialize(this.server!);
        }
        
        resolve();
      });
    });
  }

  public close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

export const createApp = async (options: CreateAppOptions): Promise<App> => {
  const app = express();

  // Register singletons in container
  container.bind(TransactionManager).toSelf().inSingletonScope();
  container.bind(CacheManager).toSelf().inSingletonScope();
  container.bind(Logger).toSelf().inSingletonScope();
  container.bind(MetricsCollector).toSelf().inSingletonScope();

  if (options.enableWebSockets) {
    const wsManager = container.resolve(WebSocketManager);
    const celeronApp = new App(app);
    celeronApp['wsManager'] = wsManager; // Store wsManager for later initialization
  }

  if (options.enableCompression) {
    app.use(compression());
  }

  if (options.enableSecurity) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      next();
    });
  }

  // Basic middlewares
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cors(options.corsOptions));

  // Dependency injection middleware
  app.use(scopePerRequest(options.container));

  // Initialize database if config provided
  if (options.databaseConfig) {
    const dbConnection = new DatabaseConnection(options.databaseConfig);
    await dbConnection.connect();
    options.container.register({ dbConnection: dbConnection });
    Model.setConnection(dbConnection)
  }

  // Load all controllers
  const baseDir = options.modulesPath;
  const pattern = `${path.resolve(baseDir, '..')}/**/*.controller.{ts,js}`;
  await loadControllers(app, options.container, pattern);
  
  // Setup Swagger après le chargement des contrôleurs
  if (options.swagger?.enabled) {
    const swaggerSetup = new SwaggerSetup(
      app,
      pattern,
      options.swagger.options
    );
    await swaggerSetup.setup();
  }

  // Error handling middleware
  app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
    errorHandler(error, req, res, next);
  });

  return new App(app);
};