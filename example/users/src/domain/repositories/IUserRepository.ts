import { User } from "../entities/User";

export interface IUserRepository {
  save(user: User): Promise<void>;
  findById(id: string): Promise<User | null>;
  delete(id: string): Promise<void>
}
