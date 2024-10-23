export abstract class DomainEvent {
    readonly dateTimeOccurred: Date;
    
    constructor() {
      this.dateTimeOccurred = new Date();
    }
  
    abstract get aggregateId(): string;
}