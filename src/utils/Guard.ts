export interface IGuardResult {
    succeeded: boolean;
    message?: string;
  }
  
  export interface IGuardArgument {
    argument: any;
    argumentName: string;
  }
  
  export class Guard {
    public static combine(guardResults: IGuardResult[]): IGuardResult {
      for (let result of guardResults) {
        if (result.succeeded === false) return result;
      }
  
      return { succeeded: true };
    }
  
    public static againstNullOrUndefined(argument: any, argumentName: string): IGuardResult {
      if (argument === null || argument === undefined) {
        return { succeeded: false, message: `${argumentName} is null or undefined` };
      }
      return { succeeded: true };
    }
  
    public static againstNullOrEmpty(argument: string, argumentName: string): IGuardResult {
      if (argument === null || argument === undefined || argument.trim().length === 0) {
        return { succeeded: false, message: `${argumentName} is null, undefined or empty` };
      }
      return { succeeded: true };
    }
  }