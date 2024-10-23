// src/modules/users/application/useCases/createUser/CreateUserUseCase.ts
import { IUserRepository } from "../../../domain/repositories/IUserRepository";
import { CreateUserDTO } from "./CreateUserDTO";
import { User } from '../../../domain/entities/User';
import { BaseUseCase } from "@/core/application/BaseUseCase";
import { Either, right } from "@/core/shared/Either";
import { Result } from "@/utils/Result";

export class CreateUserUseCase extends BaseUseCase<CreateUserDTO, void> {
  constructor(private userRepository: IUserRepository) {
    super();
  }

  protected validate(request: CreateUserDTO): Result<any> {
    // Validation des champs
    if (!request.name || !request.email) {
      return Result.fail('Invalid input');
    }
    return Result.ok();
  }

  async execute(request: CreateUserDTO): Promise<Either<Error, void>> {
    const user = User.create({
      name: request.name,
      email: request.email
    });

    await this.userRepository.save(user);
    return right(undefined);
  }
}
