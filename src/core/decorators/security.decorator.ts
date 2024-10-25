// src/decorators/security.decorator.ts
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import helmet from 'helmet';
import { parseDuration } from '../../utils/parseDuration';

export interface RateLimitOptions {
  windowMs: number;
  max: number;
}

export function RateLimit(max: number, windowMs: string): ClassDecorator {
  return function (target: any) {
    const middleware = rateLimit({
      windowMs: parseDuration(windowMs),
      max
    });
    
    const originalMiddlewares = Reflect.getMetadata('middlewares', target) || [];
    originalMiddlewares.push(middleware);
    Reflect.defineMetadata('middlewares', originalMiddlewares, target);
  };
}

export function Cors(options: cors.CorsOptions): ClassDecorator {
  return function (target: any) {
    const middleware = cors(options);
    const originalMiddlewares = Reflect.getMetadata('middlewares', target) || [];
    originalMiddlewares.push(middleware);
    Reflect.defineMetadata('middlewares', originalMiddlewares, target);
  };
}

export function SecurityHeaders(): ClassDecorator {
  return function (target: any) {
    const middleware = helmet();
    const originalMiddlewares = Reflect.getMetadata('middlewares', target) || [];
    originalMiddlewares.push(middleware);
    Reflect.defineMetadata('middlewares', originalMiddlewares, target);
  };
}