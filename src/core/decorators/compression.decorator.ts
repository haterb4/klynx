// src/decorators/compression.decorator.ts
import compression from 'compression';

export function Compress(options: compression.CompressionOptions = {}): ClassDecorator {
  return function (target: any) {
    const originalMiddlewares = Reflect.getMetadata('middlewares', target) || [];
    originalMiddlewares.push(compression(options));
    Reflect.defineMetadata('middlewares', originalMiddlewares, target);
  };
}