export * from './core/application/BaseUseCase';
export * from './core/application/ports/IRepository'
export * from './core/application/ports/IUseCase'
export * from './core/domain/AggregateRoot';
export * from './core/domain/events/DomainEvents';
export * from './core/domain/events/DomainEvent';
export * from './core/interfaces/http/BaseController';
export * from './decorators/controller.decorator';
export * from './decorators/route.decorator';
export * from './core/infrastructure/app/createApp';
export * from './core/infrastructure/app/loadControllers';
export * from './core/infrastructure/persistence/BaseRepository';
export * from './core/infrastructure/persistence/DatabaseConnection';
export * from './core/shared/Either'
export * from './utils/Result'

// Assurez-vous que tous vos types sont correctement exportés
export type { CreateAppOptions } from '@/core/infrastructure/app/createApp';
export type { Entity } from '@/core/domain/Entity';
export type { IRepository } from '@/core/application/ports/IRepository'
export type { IUseCase } from '@/core/application/ports/IUseCase'
export type { EventHandler } from '@/core/infrastructure/events/EventDispatcher'
export type { BaseMiddleware } from '@/core/interfaces/http/BaseMiddleware'
export type { BaseRouter } from '@/core/interfaces/http/BaseRouter'
export type { ValidationRule } from '@/core/interfaces/validation/RequestValidator'
export type { Either } from '@/core/shared/Either'
export type { Request, Response, NextFunction } from 'express'

// ... autres exports
