// src/core/infrastructure/monitoring/MetricsCollector.ts
import prometheus from 'prom-client';

export class MetricsCollector {
  private static instance: MetricsCollector;
  private metrics: Map<string, prometheus.Counter | prometheus.Histogram>;

  private constructor() {
    this.metrics = new Map();
  }

  public static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  public recordMetric(name: string, value: number, labels?: Record<string, string>): void {
    let metric = this.metrics.get(name);
    
    if (!metric) {
      metric = new prometheus.Counter({
        name,
        help: `Metric for ${name}`
      });
      this.metrics.set(name, metric);
    }

    if (metric instanceof prometheus.Counter) {
      metric.inc(value);
    }
  }
}