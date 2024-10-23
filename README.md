Nexium the next Generation Clean Architecture based Backend Framework based on Nodejs.

```md
# DDD Framework Documentation

## Table of Contents

1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Architecture](#architecture)
4. [Core Components](#core-components)
    - [Entities](#entities)
    - [Aggregate Root](#aggregate-root)
    - [Domain Events](#domain-events)
    - [Repositories](#repositories)
    - [Use Cases](#use-cases)
    - [Controllers](#controllers)
5. [Event Dispatching](#event-dispatching)
6. [Example Application](#example-application)
7. [Running the Application](#running-the-application)
8. [Testing](#testing)

## Introduction

This framework is designed for building scalable, maintainable applications following the principles of Domain-Driven Design (DDD). It provides a clear structure with core building blocks such as Entities, Repositories, Use Cases, and Domain Events, allowing you to model complex business logic in a clean and modular way.

## Installation

To install the framework in your project, you can use the following commands:

```bash
npm install klynx
```

Once installed, you can start by setting up the necessary components for your domain, application, and infrastructure layers.

## Architecture

This framework is based on three layers:

- **Domain Layer**: Contains core business logic, entities, and domain events.
- **Application Layer**: Contains use cases and services to orchestrate business rules.
- **Infrastructure Layer**: Deals with data persistence, repositories, and external systems.

Each layer is independent, ensuring a clean separation of concerns.

## Core Components

### Entities

Entities represent domain objects with unique identifiers. An `Entity` extends the base `Entity` class and includes an ID for identifying objects in the domain.

```typescript
import { Entity } from 'klynx';

class User extends Entity<UserProps> {
  private constructor(props: UserProps) {
    super(props);
  }

  public static create(props: UserProps): User {
    return new User(props);
  }
}
```

### Aggregate Root

The `AggregateRoot` is an entity that serves as the entry point for managing a collection of entities and emitting domain events.

```typescript
import { AggregateRoot } from 'klynx';

class UserAggregate extends AggregateRoot<UserProps> {
  private constructor(props: UserProps) {
    super(props);
  }

  public static create(props: UserProps): UserAggregate {
    return new UserAggregate(props);
  }

  // Business logic methods here...
}
```

### Domain Events

Domain events are emitted by an aggregate to signal that something important has happened in the business. Use the `DomainEvent` class to create events and `DomainEvents` to dispatch them.

```typescript
import { DomainEvent, DomainEvents } from 'klynx';

class UserCreatedEvent extends DomainEvent {
  constructor(public readonly userId: string) {
    super();
  }

  get aggregateId(): string {
    return this.userId;
  }
}

DomainEvents.register((event: UserCreatedEvent) => {
  console.log(`User created: ${event.userId}`);
}, 'UserCreatedEvent');
```

### Repositories

A repository handles persistence logic and converts domain objects into database entities and vice versa. Extend the `BaseRepository` for your repositories.

```typescript
import { BaseRepository } from 'klynx';
import { UserAggregate } from '../domain/UserAggregate';

class UserRepository extends BaseRepository<UserAggregate> {
  async save(user: UserAggregate): Promise<void> {
    const rawData = this.toPersistence(user);
    await this.model.create(rawData);
  }

  protected toDomain(raw: any): UserAggregate {
    return UserAggregate.create(raw);
  }

  protected toPersistence(user: UserAggregate): any {
    return {
      id: user.id,
      name: user.props.name,
      email: user.props.email,
    };
  }
}
```

### Use Cases

Use cases contain the application’s business logic. Each use case should validate the input, orchestrate the business logic, and return a result.

```typescript
import { BaseUseCase } from 'klynx';
import { Either, left, right } from '../shared/Either';
import { Result } from '../utils/Result';

export class CreateUserUseCase extends BaseUseCase<CreateUserDTO, CreateUserResponse> {
  constructor(private userRepository: UserRepository) {
    super();
  }

  async execute(dto: CreateUserDTO): Promise<Either<Error, CreateUserResponse>> {
    const user = UserAggregate.create({
      name: dto.name,
      email: dto.email,
    });

    await this.userRepository.save(user);

    return right(Result.ok(user));
  }

  protected validate(dto: CreateUserDTO): Result<any> {
    if (!dto.email || !dto.name) {
      return Result.fail('Invalid data');
    }
    return Result.ok();
  }
}
```

### Controllers

Controllers handle HTTP requests and delegate the business logic to use cases. Extend the `BaseController` and define your routes.

```typescript
import { BaseController, controller, route } from 'klynx';

@controller('/users')
export class UserController extends BaseController {
  constructor(private createUserUseCase: CreateUserUseCase) {
    super();
  }

  @route('POST', '/')
  async createUser(req: Request, res: Response) {
    const dto = req.body;
    const result = await this.createUserUseCase.execute(dto);
    this.ok(res, result);
  }
}
```

## Event Dispatching

The `DomainEvents` class is responsible for managing and dispatching domain events. When an event is triggered within an aggregate root, it is stored, and then dispatched at a later time.

Example of dispatching events for an aggregate:

```typescript
DomainEvents.dispatchEventsForAggregate(aggregate.id);
```

## Example Application

Here’s a quick example of how all the pieces fit together in a sample `User` domain.

1. **User Aggregate**: Manages the state and business logic of a `User`.
2. **UserCreatedEvent**: Triggers when a user is created.
3. **UserRepository**: Handles persistence of the `UserAggregate`.
4. **CreateUserUseCase**: Handles the creation of a user.
5. **UserController**: Defines HTTP endpoints for user management.

## Running the Application

To start the application, make sure you have all dependencies installed, then run:

```bash
npm start
```

Ensure that your application is configured properly to listen for HTTP requests and dispatch domain events.

## Testing

For testing, you can write unit and integration tests using your preferred testing framework. Below is a sample test for the `CreateUserUseCase`.

```typescript
import { CreateUserUseCase } from './CreateUserUseCase';
import { UserRepository } from '../../infrastructure/repositories/UserRepository';

describe('CreateUserUseCase', () => {
  let userRepository: UserRepository;
  let createUserUseCase: CreateUserUseCase;

  beforeEach(() => {
    userRepository = new UserRepository();
    createUserUseCase = new CreateUserUseCase(userRepository);
  });

  it('should create a user successfully', async () => {
    const dto = { name: 'John Doe', email: 'john@example.com' };
    const result = await createUserUseCase.execute(dto);
    expect(result.isRight()).toBeTruthy();
  });
});
```

## Conclusion

This framework offers a solid structure for building applications using Domain-Driven Design. By leveraging entities, aggregates, repositories, use cases, and controllers, you can easily manage complex business logic while maintaining a clean architecture.
```