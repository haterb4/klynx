// core/infrastructure/app/loadControllers.ts
import { Application, Request, Response, NextFunction } from 'express';
import { AwilixContainer, asClass, Lifetime } from 'awilix';
import glob from 'glob';
import path from 'path';
import { MiddlewareMetadata, EnhancedMiddleware } from '@/core/decorators/middleware.decorator';
import { BaseError } from '../../../utils/BaseError';

export class ControllerLoaderError extends BaseError {
  constructor(message: string) {
    super('ControllerLoaderError', 500, true, message);
  }
}

export interface RouteMetadata {
  method: string;
  path: string;
  methodName: string;
  version?: string;
  deprecated?: {
    since: string;
    alternative?: string;
  };
}

interface ControllerMetadata {
  prefix: string;
  middlewares: MiddlewareMetadata[];
  routes: RouteMetadata[];
  groups: Record<string, MiddlewareMetadata[]>;
}

export class ControllerLoader {
  private static getControllerMetadata(controllerClass: any): ControllerMetadata {
    return {
      prefix: Reflect.getMetadata('prefix', controllerClass) || '',
      middlewares: Reflect.getMetadata('middlewares', controllerClass) || [],
      routes: Reflect.getMetadata('routes', controllerClass) || [],
      groups: Reflect.getMetadata('middleware-groups', controllerClass) || {}
    };
  }

  private static async executeMiddlewareChain(
    middlewares: MiddlewareMetadata[],
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    // Sort middlewares by order
    const sortedMiddlewares = [...middlewares].sort(
      (a, b) => (a.config?.order || 0) - (b.config?.order || 0)
    );

    let currentIndex = 0;

    const executeNext = async (): Promise<void> => {
      if (currentIndex >= sortedMiddlewares.length) {
        return next();
      }

      const { middleware, config } = sortedMiddlewares[currentIndex++];

      try {
        // Check conditions if any
        if (config?.condition) {
          const shouldExecute = await config.condition(req);
          if (!shouldExecute) {
            return executeNext();
          }
        }

        // Execute middleware
        const result = middleware.execute(req, res, executeNext);
        if (result instanceof Promise) {
          await result;
        }
      } catch (error) {
        next(error);
      }
    };

    await executeNext();
  }

  private static setupMiddlewares(
    app: Application,
    route: string,
    method: string,
    controllerInstance: any,
    methodName: string
  ): ((req: Request, res: Response, next: NextFunction) => Promise<void>)[] {
    const metadata = this.getControllerMetadata(controllerInstance.constructor);
    
    // Get class-level middlewares
    const classMiddlewares = metadata.middlewares;
    
    // Get route-specific middlewares
    const routeMiddlewares: Record<string, MiddlewareMetadata[]> = 
      Reflect.getMetadata('route-middlewares', controllerInstance.constructor) || {};
    const methodMiddlewares = routeMiddlewares[methodName] || [];
    
    // Get middleware groups
    const groups = metadata.groups;
    const groupMiddlewares: MiddlewareMetadata[] = Object.values(groups)
      .flat()
      .map(middleware => ({
        middleware: middleware as unknown as EnhancedMiddleware,
        config: (middleware as unknown as EnhancedMiddleware).config || {}
      }));

    // Combine all middlewares
    const allMiddlewares = [
      ...classMiddlewares,
      ...groupMiddlewares,
      ...methodMiddlewares
    ];

    // Create middleware chain handler
    return [
      async (req: Request, res: Response, next: NextFunction) => {
        try {
          await this.executeMiddlewareChain(allMiddlewares, req, res, next);
        } catch (error) {
          next(error);
        }
      }
    ];
  }

  private static setupVersioning(route: string, metadata: RouteMetadata): string {
    if (metadata.version) {
      const versionPrefix = `/v${metadata.version}`;
      return route.startsWith('/') ? versionPrefix + route : versionPrefix + '/' + route;
    }
    return route;
  }

  private static setupDeprecation(
    req: Request,
    res: Response,
    next: NextFunction,
    metadata: RouteMetadata
  ): void {
    if (metadata.deprecated) {
      res.setHeader(
        'Warning',
        `299 - "This endpoint is deprecated since version ${metadata.deprecated.since}${
          metadata.deprecated.alternative
            ? `. Please use ${metadata.deprecated.alternative} instead`
            : ''
        }"`
      );
    }
    next();
  }

  public static async loadControllers(
    app: Application,
    container: AwilixContainer,
    pattern: string
  ): Promise<void> {
    const controllerFiles = glob?.sync(pattern);

    for (const file of controllerFiles) {
      try {
        // Import controller module
        const controllerModule = await import(path.resolve(file));
        const ControllerClass = controllerModule.default || Object.values(controllerModule)[0];

        if (!ControllerClass) {
          throw new ControllerLoaderError(`No controller found in ${file}`);
        }

        // Get controller metadata
        const metadata = ControllerLoader.getControllerMetadata(ControllerClass);

        // Store API documentation metadata
        const apiDoc = Reflect.getMetadata('api-doc', ControllerClass) || {};
        Reflect.defineMetadata('swagger-doc', apiDoc, ControllerClass);

        // Register controller in container
        const controllerName = ControllerClass.name.charAt(0).toLowerCase() + ControllerClass.name.slice(1);

        if (!container.hasRegistration(controllerName)) {
          container.register({
            [controllerName]: asClass(ControllerClass, {
              lifetime: Lifetime.SINGLETON,
              injectionMode: 'CLASSIC'
            })
          });
        }

        // Resolve controller instance
        const controllerInstance = container.resolve(controllerName);

        // Register routes
        metadata.routes.forEach((route: RouteMetadata) => {
          // Get all API documentation from the controller
          const apiDocs = Reflect.getMetadata('api-docs', ControllerClass) || {};

          // Get the specific route's API documentation
          const routeApiDoc = apiDocs[route.methodName];
          if (routeApiDoc) {
            // Store it with a unique key for this route
            const metadataKey = `swagger-doc-${route.method}-${route.path}`;
            Reflect.defineMetadata(metadataKey, routeApiDoc, ControllerClass);
          }

          const { method, path: routePath, methodName } = route;
          
          // Build final route path with versioning
          const fullPath = ControllerLoader.setupVersioning(
            `${metadata.prefix}${routePath}`,
            route
          );

          console.log(`Registering route: ${method.toUpperCase()} ${fullPath}`);

          // Setup middleware chain
          const middlewareChain = ControllerLoader.setupMiddlewares(
            app,
            fullPath,
            method,
            controllerInstance,
            methodName
          );

          // Register route with all middlewares
          app[method.toLowerCase() as 'get' | 'post' | 'put' | 'delete'](
            fullPath,
            // Add deprecation check
            (req: Request, res: Response, next: NextFunction) =>
              ControllerLoader.setupDeprecation(req, res, next, route),
            // Add middlewares
            ...middlewareChain,
            // Add final route handler
            async (req: Request, res: Response, next: NextFunction) => {
              try {
                await controllerInstance[methodName].call(controllerInstance, req, res);
              } catch (error) {
                next(error);
              }
            }
          );
        });

      } catch (error) {
        console.error(`Error loading controller from ${file}:`, error);
        if (error instanceof Error) {
          throw new ControllerLoaderError(`Failed to load controller from ${file}: ${error.message}`);
        } else {
          throw new ControllerLoaderError(`Failed to load controller from ${file}: ${String(error)}`);
        }
      }
    }
  }
}

export const loadControllers = ControllerLoader.loadControllers;