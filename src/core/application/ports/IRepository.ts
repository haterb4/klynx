export interface IRepository<T> {
    findOne(id: string): Promise<T | null>;
    findAll(): Promise<T[]>;
    save(entity: T): Promise<void>;
    delete(id: string): Promise<void>;
    exists(id: string): Promise<boolean>;
}