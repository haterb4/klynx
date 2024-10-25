// src/decorators/api.decorator.ts
import { OpenAPIV3 } from 'openapi-types';

export interface ApiDocOptions {
  description?: string;
  summary?: string;
  responses?: Record<number, {
    description: string;
    content?: Record<string, OpenAPIV3.MediaTypeObject>;
  }>;
  requestBody?: {
    description?: string;
    required?: boolean;
    content: Record<string, OpenAPIV3.MediaTypeObject>;
  };
  tags?: string[];
  deprecated?: boolean;
}

export const ApiDoc = (options: ApiDocOptions): MethodDecorator => {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const existingMetadata = Reflect.getMetadata('api-docs', target.constructor) || {};
    existingMetadata[propertyKey] = options;
    Reflect.defineMetadata('api-docs', existingMetadata, target.constructor);
  };
};