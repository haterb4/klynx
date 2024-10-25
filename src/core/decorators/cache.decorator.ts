// src/decorators/cache.decorator.ts
import { CacheManager } from "../../core/infrastructure/cache/CacheManager";

export function Cache(key: string, ttl: number): MethodDecorator {
    return function (
      target: any,
      propertyKey: string | symbol,
      descriptor: PropertyDescriptor
    ) {
      const originalMethod = descriptor.value;
      const cacheManager = CacheManager.getInstance();
  
      descriptor.value = async function (...args: any[]) {
        const cacheKey = `${key}-${JSON.stringify(args)}`;
        const cachedValue = cacheManager.get(cacheKey);
  
        if (cachedValue !== undefined) {
          return cachedValue;
        }
  
        const result = await originalMethod.apply(this, args);
        cacheManager.set(cacheKey, result, ttl);
        return result;
      };
  
      return descriptor;
    };
}