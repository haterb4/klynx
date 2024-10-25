import { Application } from 'express';
import swaggerUi from 'swagger-ui-express';
import { SwaggerGenerator } from './SwaggerGenerator';
import { glob } from 'glob';
import path from 'path';

export interface SwaggerOptions {
  title?: string;
  version?: string;
  description?: string;
  routePrefix?: string;
  swaggerUiOptions?: swaggerUi.SwaggerUiOptions;
}

export class SwaggerSetup {
  private swaggerGenerator: SwaggerGenerator;

  constructor(
    private app: Application,
    private pattern: string,
    private options: SwaggerOptions = {}
  ) {
    this.swaggerGenerator = new SwaggerGenerator();
  }

  public async setup(): Promise<void> {
    const controllerClasses = await this.loadControllerClasses();
    const document = this.swaggerGenerator.generateFromControllers(controllerClasses);

    // Customize document based on options
    if (this.options.title) {
      document.info.title = this.options.title;
    }
    if (this.options.version) {
      document.info.version = this.options.version;
    }
    if (this.options.description) {
      document.info.description = this.options.description;
    }

    const routePrefix = this.options.routePrefix || '/api-docs';

    // Serve Swagger UI
    this.app.use(
      routePrefix,
      swaggerUi.serve,
      swaggerUi.setup(document, {
        explorer: true,
        customSiteTitle: this.options.title || 'API Documentation',
        ...this.options.swaggerUiOptions
      })
    );

    // Serve OpenAPI JSON
    this.app.get(`${routePrefix}.json`, (req, res) => {
      res.json(document);
    });
  }

  private async loadControllerClasses(): Promise<any[]> {
    const controllerFiles = glob.sync(this.pattern);
    const controllerClasses: any[] = [];

    for (const file of controllerFiles) {
      try {
        const controllerModule = await import(path.resolve(file));
        const ControllerClass = controllerModule.default || Object.values(controllerModule)[0];

        if (ControllerClass) {
          controllerClasses.push(ControllerClass);
        }
      } catch (error) {
        console.error(`Error loading controller for documentation from ${file}:`, error);
      }
    }

    return controllerClasses;
  }
}
