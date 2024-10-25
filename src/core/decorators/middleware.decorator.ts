import { Request } from 'express';
import { BaseMiddleware } from '@/core/interfaces/http/BaseMiddleware';

export type MiddlewareCondition = (req: Request) => boolean | Promise<boolean>;

export interface MiddlewareConfig {
  order?: number;
  group?: string;
  condition?: MiddlewareCondition;
}

export interface EnhancedMiddleware extends BaseMiddleware {
  config?: MiddlewareConfig;
}

export interface MiddlewareMetadata {
  middleware: EnhancedMiddleware;
  config: MiddlewareConfig;
}

// Decorator for class-level middleware
export function UseMiddleware(
  middleware: BaseMiddleware | BaseMiddleware[],
  config: MiddlewareConfig = {}
): ClassDecorator {
  return (target: any) => {
    const middlewares: MiddlewareMetadata[] = Reflect.getMetadata('middlewares', target) || [];
    const newMiddlewares = Array.isArray(middleware) ? middleware : [middleware];

    newMiddlewares.forEach(m => {
      (m as EnhancedMiddleware).config = config;
      middlewares.push({ middleware: m as EnhancedMiddleware, config });
    });

    Reflect.defineMetadata('middlewares', middlewares, target);
  };
}

// Decorator for method-level middleware
export function UseRouteMiddleware(
  middleware: BaseMiddleware | BaseMiddleware[],
  config: MiddlewareConfig = {}
): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const middlewares: Record<string, MiddlewareMetadata[]> = Reflect.getMetadata('route-middlewares', target.constructor) || {};
    
    if (!middlewares[propertyKey as string]) {
      middlewares[propertyKey as string] = [];
    }

    const newMiddlewares = Array.isArray(middleware) ? middleware : [middleware];
    newMiddlewares.forEach(m => {
      (m as EnhancedMiddleware).config = config;
      middlewares[propertyKey as string].push({ middleware: m as EnhancedMiddleware, config });
    });

    Reflect.defineMetadata('route-middlewares', middlewares, target.constructor);
  };
}

// Decorator for middleware groups
export function MiddlewareGroup(name: string, middlewares: BaseMiddleware[]): ClassDecorator {
  return (target: any) => {
    const groups: Record<string, BaseMiddleware[]> = Reflect.getMetadata('middleware-groups', target) || {};
    groups[name] = middlewares;
    Reflect.defineMetadata('middleware-groups', groups, target);
  };
}

// Decorator for conditional middleware execution
export function ConditionalMiddleware(
  middleware: BaseMiddleware,
  condition: MiddlewareCondition
): MethodDecorator {
  return UseRouteMiddleware(middleware, { condition });
}