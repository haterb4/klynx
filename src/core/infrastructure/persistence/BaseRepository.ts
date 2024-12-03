import { AggregateRoot } from "../../domain/AggregateRoot";
import { Model } from "../orm/orm.model";
import { QueryOptions } from "../orm/types";

export abstract class BaseRepository<T extends AggregateRoot<any>> {
    constructor(protected readonly model: Model) {}
  
    async exists(id: string): Promise<boolean> {
      throw new Error("Method not implemented.");
    }

    async findById(id: string, options: QueryOptions = {}): Promise<Model | null>{
      throw new Error("Method not implemented.");
    }

    async findAll(conditions: object = {}, options: QueryOptions = {}): Promise<Model[]>{
      throw new Error("Method not implemented.");
    }

    async count(conditions: object = {}): Promise<number> {
      throw new Error("Method not implemented.");
    }
  
    protected abstract toDomain(raw: any): T;
    protected abstract toPersistence(entity: T): any;
}