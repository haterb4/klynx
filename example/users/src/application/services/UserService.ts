// src/modules/users/application/services/UserService.ts
import { UserRepository } from '../../infrastructure/persistence/UserRepository';
import { User } from '../../domain/entities/User';
import { CreateUserDTO } from '../useCases/createUser/CreateUserDTO';

export class UserService {
  private userRepository: UserRepository;

  constructor(userRepository: UserRepository) {
    this.userRepository = userRepository;
  }

  async createUser(dto: CreateUserDTO): Promise<User> {
    const user = User.create({
      name: dto.name,
      email: dto.email
    });

    console.log(user)

    await this.userRepository.save(user);

    return user;
  }

  async getUserById(userId: string): Promise<User | null> {
    return this.userRepository.findById(userId);
  }

  async updateUser(userId: string, updateData: Partial<CreateUserDTO>): Promise<User> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Logique pour mettre à jour l'utilisateur ici
    if (updateData.name) user.name = updateData.name;
    if (updateData.email) user.email = updateData.email;

    await this.userRepository.save(user);

    return user;
  }

  async deleteUser(userId: string): Promise<void> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    await this.userRepository.delete(userId);
  }
}
