import { AggregateRoot } from '@/core/domain/AggregateRoot';
import { UserCreatedEvent } from '../events/UserCreatedEvent';

interface UserProps {
  name: string;
  email: string;
}

export class User extends AggregateRoot<UserProps> {
  get name(): string {
    return this.props.name;
  }

  set name(value: string) {
    this.props.name = value;
  }

  get email(): string {
    return this.props.email;
  }

  set email(value: string) {
    this.props.email = value;
  }

  private constructor(props: UserProps) {
    super(props);
  }

  // Méthode statique pour créer un nouvel utilisateur
  public static create(props: UserProps): User {
    const user = new User(props);

    // Ajout de l'événement de domaine
    user.addDomainEvent(new UserCreatedEvent(user.id));
    
    return user;
  }
}