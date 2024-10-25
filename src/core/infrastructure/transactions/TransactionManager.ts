import { Injectable, Singleton } from '../di/Container';
import { EntityManager, getManager } from 'typeorm';

@Injectable()
@Singleton()
export class TransactionManager {
  private static instance: TransactionManager;
  private activeTransactions: Map<string, EntityManager>;

  private constructor() {
    this.activeTransactions = new Map();
  }

  public static getInstance(): TransactionManager {
    if (!TransactionManager.instance) {
      TransactionManager.instance = new TransactionManager();
    }
    return TransactionManager.instance;
  }

  public async startTransaction(transactionId: string): Promise<EntityManager> {
    const entityManager = getManager();
    const queryRunner = entityManager.queryRunner;
    await queryRunner?.startTransaction();
    this.activeTransactions.set(transactionId, entityManager);
    return entityManager;
  }

  public async commitTransaction(transactionId: string): Promise<void> {
    const entityManager = this.activeTransactions.get(transactionId);
    if (entityManager) {
      await entityManager.queryRunner?.commitTransaction();
      this.activeTransactions.delete(transactionId);
    }
  }

  public async rollbackTransaction(transactionId: string): Promise<void> {
    const entityManager = this.activeTransactions.get(transactionId);
    if (entityManager) {
      await entityManager.queryRunner?.rollbackTransaction();
      this.activeTransactions.delete(transactionId);
    }
  }
}