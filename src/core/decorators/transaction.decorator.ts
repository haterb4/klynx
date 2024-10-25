import { v4 as uuidv4 } from 'uuid';
import { TransactionManager } from '../../core/infrastructure/transactions/TransactionManager';

export const Transactional = (): MethodDecorator => {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const transactionId = uuidv4();
      const transactionManager = TransactionManager.getInstance();

      try {
        await transactionManager.startTransaction(transactionId);
        const result = await originalMethod.apply(this, args);
        await transactionManager.commitTransaction(transactionId);
        return result;
      } catch (error) {
        await transactionManager.rollbackTransaction(transactionId);
        throw error;
      }
    };

    return descriptor;
  };
};