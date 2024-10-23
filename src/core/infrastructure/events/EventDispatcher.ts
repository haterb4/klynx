import { DomainEvent } from '../../domain/events/DomainEvent';

export interface EventHandler<T extends DomainEvent> {
  handle(event: T): Promise<void>;
}

export class EventDispatcher {
  private handlers: Map<string, EventHandler<DomainEvent>[]>;

  constructor() {
    this.handlers = new Map();
  }

  public register(eventName: string, handler: EventHandler<DomainEvent>): void {
    const handlers = this.handlers.get(eventName) || [];
    handlers.push(handler);
    this.handlers.set(eventName, handlers);
  }

  public async dispatch(event: DomainEvent): Promise<void> {
    const eventClassName = event.constructor.name;
    const handlers = this.handlers.get(eventClassName) || [];
    
    for (const handler of handlers) {
      await handler.handle(event);
    }
  }
}