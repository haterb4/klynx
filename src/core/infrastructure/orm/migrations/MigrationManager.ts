import { DatabaseConnection } from '../../persistence/DatabaseConnection';
import { JointTableMigration, Migration } from './Migration';
import * as path from 'path';

export class MigrationManager {

  constructor(
    private connection: DatabaseConnection,
    private migrationsPath: string
  ) {}

  async initialize(): Promise<void> {
    await this.connection.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await this.connection.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        batch INTEGER NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await this.connection.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);
  }

  async migrateWithMigrations(migrations: Migration[]): Promise<void> {
    await this.initialize();

    if (migrations.length === 0) {
      console.log('No migrations to run.');
      return;
    }

    const batch = await this.getNextBatch();

    // Exécuter les migrations pour les tables principales
    await this.runPrimaryModelMigrations(migrations, batch);

    // Exécuter les migrations pour les tables de jonction
    await this.runJointTableMigrations(migrations, batch);
  }

  private async runPrimaryModelMigrations(migrations: Migration[], batch: number): Promise<void> {
    await this.connection.withTransaction(async () => {
      for (const migration of migrations) {
        if (!(migration instanceof JointTableMigration)) {
          const migrationName = migration.constructor.name;
          console.log(`Running migration: ${migrationName}`);

          try {
            await migration.up();
            await this.recordMigration(migrationName, batch);
            console.log(`Completed migration: ${migrationName}`);
          } catch (error) {
            console.error(`Error in migration ${migrationName}:`, error);
            throw error;
          }
        }
      }
    });
  }

  private async runJointTableMigrations(migrations: Migration[], batch: number): Promise<void> {
    await this.connection.withTransaction(async () => {
      for (const migration of migrations) {
        if (migration instanceof JointTableMigration) {
          const migrationName = migration.constructor.name;
          console.log(`Running migration: ${migrationName}`);

          try {
            await migration.up();
            await this.recordMigration(migrationName, batch);
            console.log(`Completed migration: ${migrationName}`);
          } catch (error) {
            console.error(`Error in migration ${migrationName}:`, error);
            throw error;
          }
        }
      }
    });
  }

  async rollback(steps: number = 1): Promise<void> {
    const batches = await this.getLastBatches(steps);
    
    // Exécuter le rollback dans une transaction
    await this.connection.withTransaction(async () => {
      for (const batch of batches) {
        const migrations = await this.getMigrationsInBatch(batch);
        
        for (const migrationRecord of migrations.reverse()) {
          const migration = await this.loadMigration(migrationRecord.name);
          console.log(`Rolling back: ${migrationRecord.name}`);
          
          try {
            await migration.down();
            await this.removeMigration(migrationRecord.name);
            console.log(`Rolled back: ${migrationRecord.name}`);
          } catch (error) {
            console.error(`Error rolling back ${migrationRecord.name}:`, error);
            throw error;
          }
        }
      }
    });
  }


  private async getNextBatch(): Promise<number> {
    const result = await this.connection.query(
      'SELECT COALESCE(MAX(batch), 0) + 1 as next_batch FROM migrations'
    );
    return result.rows[0].next_batch;
  }

  private async recordMigration(name: string, batch: number): Promise<void> {
    await this.connection.query(
      'INSERT INTO migrations (name, batch) VALUES ($1, $2)',
      [name, batch]
    );
  }

  private async removeMigration(name: string): Promise<void> {
    await this.connection.query('DELETE FROM migrations WHERE name = $1', [name]);
  }

  private async getLastBatches(steps: number): Promise<number[]> {
    const result = await this.connection.query(
      'SELECT DISTINCT batch FROM migrations ORDER BY batch DESC LIMIT $1',
      [steps]
    );
    return result.rows.map(row => row.batch);
  }

  private async getMigrationsInBatch(batch: number): Promise<any[]> {
    const result = await this.connection.query(
      'SELECT * FROM migrations WHERE batch = $1 ORDER BY id',
      [batch]
    );
    return result.rows;
  }

  private async loadMigration(name: string): Promise<Migration> {
    const filePath = path.join(this.migrationsPath, `${name}.ts`);
    const { default: MigrationClass } = await import(filePath);
    return new MigrationClass(this.connection);
  }
}