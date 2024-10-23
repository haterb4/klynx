// src/domain/events/UserCreatedEvent.ts

import { DomainEvent } from "@/core/domain/events/DomainEvent";

export class UserCreatedEvent extends DomainEvent {
  constructor(public readonly userId: string) {
    super();
  }

  get aggregateId(): string {
    return this.userId;
  }
}
