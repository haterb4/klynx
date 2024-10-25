export const WebSocketController = (path: string): ClassDecorator => {
    return (target: any) => {
      Reflect.defineMetadata('ws-path', path, target);
    };
  };
  
  export const OnMessage = (): MethodDecorator => {
    return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
      Reflect.defineMetadata('ws-message-handler', propertyKey, target.constructor);
    };
  };
  
  // src/core/infrastructure/di/Container.ts
  import { Container, injectable, inject } from 'inversify';
  import 'reflect-metadata';
  
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