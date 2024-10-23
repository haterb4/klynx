// config/container.ts
import { asValue, createContainer, asClass, InjectionMode, Lifetime } from 'awilix';
import { UserController } from '../src/infrastructure/http/controllers/UserController';
import { UserModel, UserRepository } from '../src/infrastructure/persistence/UserRepository';
import { UserService } from '../src/application/services/UserService';



export const container = createContainer({
  injectionMode: InjectionMode.CLASSIC  // Important pour l'injection par constructeur
});

container.register({
  // Models
  userModel: asValue(UserModel),

  // Repositories
  userRepository: asClass(UserRepository, { lifetime: Lifetime.SINGLETON }),

  // Services
  userService: asClass(UserService, { lifetime: Lifetime.SINGLETON }),
  
  // Contrôleurs
  userController: asClass(UserController, { lifetime: Lifetime.SINGLETON })
});