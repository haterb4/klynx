import { Logger } from "../../core/infrastructure/logging/Logger";

// src/decorators/logging.decorator.ts
export function Log(level: string = 'info'): MethodDecorator {
    return function (
      target: any,
      propertyKey: string | symbol,
      descriptor: PropertyDescriptor
    ) {
      const originalMethod = descriptor.value;
      const logger = Logger.getInstance();
  
      descriptor.value = async function (...args: any[]) {
        const start = Date.now();
        try {
          const result = await originalMethod.apply(this, args);
          logger.log(level, `${String(propertyKey)} completed`, {
            duration: Date.now() - start,
            success: true
          });
          return result;
        } catch (error) {
          logger.log('error', `${String(propertyKey)} failed`, {
            duration: Date.now() - start,
            error: (error as Error).message
          });
          throw error;
        }
      };
  
      return descriptor;
    };
  }