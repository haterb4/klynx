export * from './core/application/BaseUseCase';
export * from './core/application/ports/IRepository'
export * from './core/application/ports/IUseCase'
export * from './core/decorators/api.decorator';
export * from './core/decorators/cache.decorator';
export * from './core/decorators/compression.decorator';
export * from './core/decorators/controller.decorator';
export * from './core/decorators/logging.decorator';
export * from './core/decorators/middleware.decorator';
export * from './core/decorators/monitor.decorator';
export * from './core/decorators/route.decorator';
export * from './core/decorators/security.decorator';
export * from './core/decorators/transaction.decorator';
export * from './core/decorators/websocket.decorator';
export * from './core/decorators/middleware.decorator';
export * from './core/decorators/middleware.decorator';
export * from './core/domain/AggregateRoot';
export * from './core/domain/events/DomainEvents';
export * from './core/domain/events/DomainEvent';
export * from './core/infrastructure/app/createApp';
export * from './core/infrastructure/app/loadControllers';
export * from './core/infrastructure/orm/orm.decorator'
export * from './core/infrastructure/orm/orm.model'
export * from './core/infrastructure/orm/migrations/Migration'
export * from './core/infrastructure/orm/migrations/MigrationGenerator'
export * from './core/infrastructure/orm/migrations/MigrationManager'
export * from './core/infrastructure/orm/validation/Validator'
export * from './core/infrastructure/orm/validation/validator.decorator'
export * from './core/infrastructure/persistence/BaseRepository';
export * from './core/infrastructure/persistence/DatabaseConnection';
export * from './core/interfaces/http/BaseController';
export * from './core/interfaces/http/BaseMiddleware';
export * from './core/interfaces/validation/RequestValidator'
export * from './core/shared/Either'
export * from './utils/Result'
export * from './utils/BaseError'

// Assurez-vous que tous vos types sont correctement exportés
export type { CreateAppOptions } from '@/core/infrastructure/app/createApp';
export type { Entity } from '@/core/domain/Entity';
export type { IRepository } from '@/core/application/ports/IRepository'
export type { IUseCase } from '@/core/application/ports/IUseCase'
export type { EventHandler } from '@/core/infrastructure/events/EventDispatcher'
export type { BaseRouter } from '@/core/interfaces/http/BaseRouter'
export type { ValidationRule } from '@/core/interfaces/validation/RequestValidator'
export type { Either } from '@/core/shared/Either'
export type { Request, Response, NextFunction } from 'express'

// ... autres exports
