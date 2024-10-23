import { AggregateRoot } from "../../domain/AggregateRoot";

export abstract class BaseRepository<T extends AggregateRoot<any>> {
    constructor(protected readonly model: any) {}
  
    async exists(id: string): Promise<boolean> {
      const result = await this.model.findById(id);
      return !!result;
    }
  
    protected abstract toDomain(raw: any): T;
    protected abstract toPersistence(entity: T): any;
}