import { AggregateRoot } from "../AggregateRoot";
import { DomainEvent } from "./DomainEvent";

export class DomainEvents {
    private static handlersMap = new Map<string, Function[]>();
    private static markedAggregates: AggregateRoot<any>[] = [];
  
    public static markAggregateForDispatch(aggregate: AggregateRoot<any>): void {
      const aggregateFound = !!this.findMarkedAggregateByID(aggregate.id);
  
      if (!aggregateFound) {
        this.markedAggregates.push(aggregate);
      }
    }
  
    private static dispatchAggregateEvents(aggregate: AggregateRoot<any>): void {
      aggregate.domainEvents.forEach((event: DomainEvent) => this.dispatch(event));
    }
  
    private static removeAggregateFromMarkedDispatchList(aggregate: AggregateRoot<any>): void {
      const index = this.markedAggregates.findIndex((a) => a.equals(aggregate));
      this.markedAggregates.splice(index, 1);
    }
  
    private static findMarkedAggregateByID(id: string): AggregateRoot<any> {
      return this.markedAggregates.find((aggregate) => aggregate.id === id) as AggregateRoot<any>;
    }
  
    public static dispatchEventsForAggregate(id: string): void {
      const aggregate = this.findMarkedAggregateByID(id);
  
      if (aggregate) {
        this.dispatchAggregateEvents(aggregate);
        aggregate.clearEvents();
        this.removeAggregateFromMarkedDispatchList(aggregate);
      }
    }
  
    public static register(callback: (event: DomainEvent) => void, eventClassName: string): void {
      const handlers = this.handlersMap.get(eventClassName) || [];
      handlers.push(callback);
      this.handlersMap.set(eventClassName, handlers);
    }
  
    public static clearHandlers(): void {
      this.handlersMap.clear();
    }
  
    public static clearMarkedAggregates(): void {
      this.markedAggregates = [];
    }
  
    private static dispatch(event: DomainEvent): void {
      const eventClassName: string = event.constructor.name;
      const handlers = this.handlersMap.get(eventClassName) || [];
      handlers.forEach((handler) => handler(event));
    }
  }