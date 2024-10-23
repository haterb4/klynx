// src/modules/users/infrastructure/persistence/UserRepository.ts
import { DomainEvents } from '@/core/domain/events/DomainEvents';
import { BaseRepository } from '@/core/infrastructure/persistence/BaseRepository';
import { User } from '../../domain/entities/User';
import { IUserRepository } from '../../domain/repositories/IUserRepository';

import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true }
});

export const UserModel = mongoose.model('User', userSchema);

export class UserRepository extends BaseRepository<User> implements IUserRepository {
  constructor(private readonly userModel: typeof UserModel) {
    super(userModel);
  }

  async save(user: User): Promise<void> {
    const rawData = this.toPersistence(user);
    await this.model.create(rawData);

    // Marquer les événements de l'agrégat pour distribution
    DomainEvents.markAggregateForDispatch(user);
  }

  async findById(id: string): Promise<User | null> {
    const rawUser = await this.model.findById(id);
    if (!rawUser) return null;
    return this.toDomain(rawUser);
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.model.delete(id)
    return
  }

  protected toDomain(raw: any): User {
    return User.create({
      name: raw.name,
      email: raw.email
    });
  }

  protected toPersistence(user: User): any {
    return {
      id: user.id,
      name: user.name,
      email: user.email
    };
  }
}