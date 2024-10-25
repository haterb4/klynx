import { MetricsCollector } from "../../core/infrastructure/monitoring/MetricsCollector";

// src/decorators/monitor.decorator.ts
export function Monitor(metricName: string): MethodDecorator {
    return function (
      target: any,
      propertyKey: string | symbol,
      descriptor: PropertyDescriptor
    ) {
      const originalMethod = descriptor.value;
      const metricsCollector = MetricsCollector.getInstance();
  
      descriptor.value = async function (...args: any[]) {
        const start = Date.now();
        try {
          const result = await originalMethod.apply(this, args);
          metricsCollector.recordMetric(metricName, Date.now() - start);
          return result;
        } catch (error) {
          metricsCollector.recordMetric(`${metricName}_errors`, 1);
          throw error;
        }
      };
  
      return descriptor;
    };
  }