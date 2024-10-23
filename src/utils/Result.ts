export class Result<T> {
    public isSuccess: boolean;
    public isFailure: boolean;
    private error: T | string;
    private _value: T | undefined;
  
    constructor(isSuccess: boolean, error: T | string = '', value?: T) {
      this.isSuccess = isSuccess;
      this.isFailure = !isSuccess;
      this.error = error;
      this._value = value as T;
    }
  
    public getValue(): T {
      if (!this.isSuccess) {
        throw new Error("Can't get the value of an error result.");
      }
      if (this._value === undefined) {
        throw new Error("Value is undefined.");
      }
      return this._value;
    }
  
    public getError(): T | string {
      return this.error;
    }
  
    public static ok<U>(value?: U): Result<U> {
      return new Result<U>(true, '', value);
    }
  
    public static fail<U>(error: any): Result<U> {
      return new Result<U>(false, error);
    }
}