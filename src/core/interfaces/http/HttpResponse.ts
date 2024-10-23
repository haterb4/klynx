export class HttpResponse {
    public static ok<T>(dto?: T) {
      return {
        statusCode: 200,
        body: dto
      };
    }
  
    public static created() {
      return {
        statusCode: 201,
        body: undefined
      };
    }
  
    public static clientError(message: string) {
      return {
        statusCode: 400,
        body: {
          error: message
        }
      };
    }
  
    public static unauthorized(message: string = 'Unauthorized') {
      return {
        statusCode: 401,
        body: {
          error: message
        }
      };
    }
  
    public static forbidden(message: string = 'Forbidden') {
      return {
        statusCode: 403,
        body: {
          error: message
        }
      };
    }
  
    public static notFound(message: string = 'Not found') {
      return {
        statusCode: 404,
        body: {
          error: message
        }
      };
    }
  
    public static conflict(message: string) {
      return {
        statusCode: 409,
        body: {
          error: message
        }
      };
    }
  
    public static tooMany(message: string = 'Too many requests') {
      return {
        statusCode: 429,
        body: {
          error: message
        }
      };
    }
  
    public static fail(error: Error | string) {
      return {
        statusCode: 500,
        body: {
          error: error instanceof Error ? error.message : error
        }
      };
    }
  }