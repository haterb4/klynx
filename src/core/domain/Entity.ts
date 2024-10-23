import { v4 } from 'uuid';

export abstract class Entity<T> {
    protected readonly _id: string;
    protected props: T;
  
    constructor(props: T, id?: string) {
      this._id = id || v4();
      this.props = props;
    }
  
    public equals(object?: Entity<T>): boolean {
      if (object == null || object == undefined) {
        return false;
      }
      return this._id === object._id;
    }
  
    get id(): string {
      return this._id;
    }
}