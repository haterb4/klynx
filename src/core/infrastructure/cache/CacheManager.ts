// src/core/infrastructure/cache/CacheManager.ts
import 'reflect-metadata'
import NodeCache from 'node-cache';
import { Injectable, Singleton } from '../di/Container';

@Injectable()
@Singleton()
export class CacheManager {
  private static instance: CacheManager;
  private cache: NodeCache;

  private constructor() {
    this.cache = new NodeCache();
  }

  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  public get<T>(key: string): T | undefined {
    return this.cache.get<T>(key);
  }

  public set<T>(key: string, value: T, ttl: number): boolean {
    return this.cache.set(key, value, ttl);
  }

  public del(key: string): number {
    return this.cache.del(key);
  }

  public flush(): void {
    this.cache.flushAll();
  }
}