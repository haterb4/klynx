import { AwilixContainer, Resolver } from 'awilix';
import { Pool, PoolClient, QueryResult } from 'pg';
import { QueryOptions } from '../orm/types';


export interface DatabaseConnectionOptions {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  max?: number; // maximum number of clients in the pool
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export class DatabaseConnection implements Resolver<DatabaseConnection> {
  private pool: Pool;
  private transactionClient: PoolClient | null = null;

  constructor(private readonly options: DatabaseConnectionOptions) {
    this.pool = new Pool({
      host: options.host,
      port: options.port,
      user: options.user,
      password: options.password,
      database: options.database,
      max: options.max || 20,
      idleTimeoutMillis: options.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: options.connectionTimeoutMillis || 2000
    });

    // Error handling for the pool
    this.pool.on('error', (err: Error) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  /**
   * Exécute une requête SQL avec des paramètres optionnels
   */
  async query(sql: string, params: any[] = [], options: QueryOptions = {}): Promise<QueryResult> {
    if (options.transaction && this.transactionClient) {
      return this.transactionClient.query(sql, params);
    }
    return this.pool.query(sql, params);
  }

  /**
   * Démarre une nouvelle transaction
   */
  async beginTransaction(): Promise<void> {
    if (this.transactionClient) {
      throw new Error('Transaction already in progress');
    }
    this.transactionClient = await this.pool.connect();
    await this.transactionClient.query('BEGIN');
  }

  /**
   * Valide la transaction en cours
   */
  async commit(): Promise<void> {
    if (!this.transactionClient) {
      throw new Error('No transaction in progress');
    }
    await this.transactionClient.query('COMMIT');
    this.transactionClient.release();
    this.transactionClient = null;
  }

  /**
   * Annule la transaction en cours
   */
  async rollback(): Promise<void> {
    if (!this.transactionClient) {
      throw new Error('No transaction in progress');
    }
    await this.transactionClient.query('ROLLBACK');
    this.transactionClient.release();
    this.transactionClient = null;
  }

  /**
   * Execute une fonction dans une transaction
   */
  async withTransaction<T>(callback: () => Promise<T>): Promise<T> {
    await this.beginTransaction();
    try {
      const result = await callback();
      await this.commit();
      return result;
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }

  /**
   * Connecte à la base de données
   */
  async connect(): Promise<void> {
    const client = await this.pool.connect();
    client.release();
  }

  /**
   * Ferme toutes les connexions
   */
  async disconnect(): Promise<void> {
    if (this.transactionClient) {
      await this.rollback();
    }
    await this.pool.end();
  }

  /**
   * Vérifie l'état de la connexion
   */
  async healthCheck(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      client.release();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Retourne les statistiques du pool
   */
  getPoolStats() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount
    };
  }

  resolve(container: AwilixContainer): any {
    return this;
  }
}