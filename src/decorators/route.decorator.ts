export interface RouteDefinition {
  path: string;
  method: string;
  methodName: string | symbol;
}

export const route = (method: string, path: string): MethodDecorator => {
    return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
      if (!Reflect.hasMetadata('routes', target.constructor)) {
        Reflect.defineMetadata('routes', [], target.constructor);
      }
  
      const routes: RouteDefinition[] = Reflect.getMetadata('routes', target.constructor) as Array<any>;
  
      routes.push({
        method,
        path,
        methodName: propertyKey
      });
  
      Reflect.defineMetadata('routes', routes, target.constructor);
    };
};

export const httpGet = (path: string): MethodDecorator => {
    return route('GET', path);
};

export const httpPost = (path: string): MethodDecorator => {
    return route('POST', path);
};

export const httpPut = (path: string): MethodDecorator => {
    return route('PUT', path);
};

export const httpDelete = (path: string): MethodDecorator => {
    return route('DELETE', path);
};