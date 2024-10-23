import { DomainEvent } from "./events/DomainEvent";
import { Entity } from "./Entity";
import { DomainEvents } from "./events/DomainEvents";

export abstract class AggregateRoot<T> extends Entity<T> {
    private _domainEvents: DomainEvent[] = [];
  
    get domainEvents(): DomainEvent[] {
      return this._domainEvents;
    }
  
    protected addDomainEvent(domainEvent: DomainEvent): void {
      this._domainEvents.push(domainEvent);
      DomainEvents.markAggregateForDispatch(this);
    }
  
    public clearEvents(): void {
      this._domainEvents.splice(0, this._domainEvents.length);
    }
}