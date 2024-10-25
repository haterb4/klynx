import { ApiDocOptions } from '@/core/decorators/api.decorator';
import { OpenAPIV3 } from 'openapi-types';
import { RouteMetadata } from '../app/loadControllers';

export class SwaggerGenerator {
  private document: OpenAPIV3.Document;

  constructor() {
    this.document = {
      openapi: '3.0.0',
      info: {
        title: 'API Documentation',
        version: '1.0.0'
      },
      paths: {} as Record<string, OpenAPIV3.PathItemObject>,
      components: {
        schemas: {},
      },
    };
  }

  public generateFromControllers(controllers: any[]): OpenAPIV3.Document {
    controllers.forEach(controller => {
      const prefix = Reflect.getMetadata('prefix', controller) || '';
      const routes = Reflect.getMetadata('routes', controller) || [];

      routes.forEach((route: RouteMetadata) => {
        const metadataKey = `swagger-doc-${route.method}-${route.path}`;
        const swaggerDoc = Reflect.getMetadata(metadataKey, controller);

        if (swaggerDoc) {
          const fullPath = this.normalizePath(prefix + route.path);
          this.addPathToDocument(
            fullPath,
            route.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete',
            swaggerDoc
          );
        }
      });
    });

    return this.document;
  }

  private normalizePath(path: string): string {
    // Ensure path starts with / and remove any double slashes
    return ('/' + path).replace(/\/+/g, '/');
  }

  private addPathToDocument(path: string, method: 'get' | 'post' | 'put' | 'delete', apiDoc: ApiDocOptions): void {
    if (!this.document.paths[path]) {
      this.document.paths[path] = {};
    }

    const operation: OpenAPIV3.OperationObject = {
      description: apiDoc.description,
      summary: apiDoc.summary,
      responses: this.transformResponses(apiDoc.responses),
      requestBody: apiDoc.requestBody as OpenAPIV3.RequestBodyObject,
      tags: apiDoc.tags,
      deprecated: apiDoc.deprecated
    };

    // Assign the operation to the method in the path
    this.document.paths[path][method] = operation;
  }

  private transformResponses(responses?: Record<number, any>): OpenAPIV3.ResponsesObject {
    if (!responses) return {};

    return Object.entries(responses).reduce((acc, [code, response]) => {
      acc[code] = {
        description: response.description,
        content: response.content
      };
      return acc;
    }, {} as OpenAPIV3.ResponsesObject);
  }
}
