// src/modules/users/application/handlers/SendWelcomeEmail.ts
import { DomainEvent } from '@/core/domain/events/DomainEvent';
import { DomainEvents } from '@/core/domain/events/DomainEvents';
import { UserCreatedEvent } from '../../domain/events/UserCreatedEvent';

const sendWelcomeEmail = (event: UserCreatedEvent) => {
  console.log(`Sending welcome email to user with ID: ${event.userId}`);
  // Logique d'envoi d'email ici
};

// Enregistrement du handler pour l'événement UserCreatedEvent
DomainEvents.register(sendWelcomeEmail as unknown as (event: DomainEvent) => void, UserCreatedEvent.name);
