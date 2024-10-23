import 'reflect-metadata';

import express, { Application } from 'express';
import { AwilixContainer } from 'awilix';
import { scopePerRequest } from 'awilix-express';
import cors from 'cors';
import { loadControllers } from './loadControllers';
import { errorHandler } from '../middleware/errorHandler';
import { Request, Response, NextFunction } from 'express';
import { DatabaseConnection } from '../persistence/DatabaseConnection';

export interface CreateAppOptions {
  container: AwilixContainer;
  modulesPath: string;
  corsOptions?: cors.CorsOptions;
  databaseConfig?: {
    url: string;
    options?: any;
  };
}

export const createApp = async (options: CreateAppOptions): Promise<Application> => {
  const app = express();
  
  // Basic middlewares
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cors(options.corsOptions));
  
  // Dependency injection middleware
  app.use(scopePerRequest(options.container));
  
  // Initialize database if config provided
  if (options.databaseConfig) {
    const dbConnection = new DatabaseConnection(
      options.databaseConfig.url,
      options.databaseConfig.options
    );
    await dbConnection.connect();
    
    // Register database connection in container
    options.container.register({
      dbConnection: dbConnection
    });
  }
  
  // Load all controllers
  await loadControllers(app, options.container, options.modulesPath);
  
  app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
    errorHandler(error, req, res, next);
  });
  
  return app;
};