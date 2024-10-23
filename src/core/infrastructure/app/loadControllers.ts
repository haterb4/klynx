// core/infrastructure/app/loadControllers.ts
import { Application, Request, Response, NextFunction } from 'express';
import { AwilixContainer, asClass, Lifetime } from 'awilix';
import glob from 'glob';
import path from 'path';

export const loadControllers = async (
  app: Application, 
  container: AwilixContainer, 
  pattern: string
): Promise<void> => {
  const controllerFiles = glob.sync(pattern);

  for (const file of controllerFiles) {
    try {
      // Importer le module
      const controllerModule = await import(path.resolve(file));
      const ControllerClass = controllerModule.default || Object.values(controllerModule)[0];
      
      if (!ControllerClass) {
        console.warn(`No controller found in ${file}`);
        continue;
      }

      // Extraire le nom du contrôleur pour l'enregistrement
      const controllerName = ControllerClass.name.charAt(0).toLowerCase() + 
                           ControllerClass.name.slice(1);

      // Enregistrer le contrôleur s'il n'est pas déjà enregistré
      if (!container.hasRegistration(controllerName)) {
        container.register({
          [controllerName]: asClass(ControllerClass, {
            lifetime: Lifetime.SINGLETON,
            injectionMode: 'CLASSIC'
          })
        });
      }

      // Résoudre l'instance
      const controllerInstance = container.resolve(controllerName);

      // Récupérer les métadonnées des routes
      const prefix = Reflect.getMetadata('prefix', ControllerClass) || '';
      const routes = Reflect.getMetadata('routes', ControllerClass) || [];

      // Enregistrer les routes
      routes.forEach((route: { method: string; path: string; methodName: string }) => {
        const { method, path: routePath, methodName } = route;
        const fullPath = `${prefix}${routePath}`;
        
        console.log(`Registering route: ${method.toUpperCase()} ${fullPath}`);
        
        app[method.toLowerCase() as 'get' | 'post' | 'put' | 'delete'](fullPath, async (req: Request, res: Response, next: NextFunction) => {
          try {
            await controllerInstance[methodName].call(controllerInstance, req, res);
          } catch (error) {
            next(error);
          }
        });
      });

    } catch (error) {
      console.error(`Error loading controller from ${file}:`, error);
    }
  }
};