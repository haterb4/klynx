// src/core/infrastructure/di/Container.ts
import { Container, injectable, inject } from 'inversify';

export const container = new Container();

export const Injectable = (): ClassDecorator => {
  return injectable() as ClassDecorator;
};

export const Inject = (identifier?: any): ParameterDecorator => {
  return inject(identifier);
};

export const Singleton = (): ClassDecorator => {
  return (target: any) => {
    if (!container.isBound(target)) {
      container.bind(target).toSelf().inSingletonScope();
    }
  };
};