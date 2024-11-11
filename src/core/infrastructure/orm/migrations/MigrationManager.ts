import { DatabaseConnection } from '../../persistence/DatabaseConnection';
import { Migration } from './Migration';
import { ModelMetadataStore } from '../orm.metadata.store';
import * as path from 'path';
import * as fs from 'fs/promises';

export class MigrationManager {
  private metadataStore: ModelMetadataStore;

  constructor(
    private connection: DatabaseConnection,
    private migrationsPath: string
  ) {
    this.metadataStore = ModelMetadataStore.getInstance();
  }

  async initialize(): Promise<void> {
    await this.connection.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        batch INTEGER NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async migrateWithMigrations(migrations: Migration[]): Promise<void> {
    await this.initialize();

    if (migrations.length === 0) {
      console.log('No migrations to run.');
      return;
    }

    const batch = await this.getNextBatch();

    await this.connection.withTransaction(async () => {
      for (const migration of migrations) {
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
    });
  }
  
  async migrate(): Promise<void> {
    await this.initialize();

    const executedMigrations = await this.getExecutedMigrations();
    const allModelDefinitions = this.metadataStore.getAllModels();
    const pendingMigrations: Migration[] = [];

    // Générer les migrations pour les modèles qui n'en ont pas encore
    for (const [modelName, definition] of allModelDefinitions.entries()) {
      const migrationName = `Create${definition.tableName}Table`;
      if (!executedMigrations.includes(migrationName)) {
        const migration = await this.generateMigration(modelName, definition);
        pendingMigrations.push(migration);
      }
    }

    if (pendingMigrations.length === 0) {
      console.log('No pending migrations.');
      return;
    }

    const batch = await this.getNextBatch();

    // Exécuter les migrations dans une transaction
    await this.connection.withTransaction(async () => {
      for (const migration of pendingMigrations) {
        const migrationName = migration.constructor.name;
        console.log(`Migrating: ${migrationName}`);

        try {
          await migration.up();
          await this.recordMigration(migrationName, batch);
          console.log(`Migrated:  ${migrationName}`);
        } catch (error) {
          console.error(`Error migrating ${migrationName}:`, error);
          throw error;
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

  private async generateMigration(modelName: string, definition: any): Promise<Migration> {
    const timestamp = new Date().getTime();
    const className = `Create${definition.tableName}Table_${timestamp}`;
    const fileName = `${className}.ts`;
    const filePath = path.join(this.migrationsPath, fileName);

    const migrationContent = this.generateMigrationContent(className, definition);
    await fs.writeFile(filePath, migrationContent);

    // Charger dynamiquement la migration
    const { default: MigrationClass } = await import(filePath);
    return new MigrationClass(this.connection);
  }

  private generateMigrationContent(className: string, definition: any): string {
    const { tableName, columns, relations } = definition;
    const columnDefinitions = this.generateColumnDefinitions(columns);
    const relationDefinitions = this.generateRelationDefinitions(tableName, relations);

    return `
      import { DatabaseConnection, Migration } from 'celeron';

      export default class ${className} extends Migration {
        constructor(connection: DatabaseConnection) {
          super(connection);
        }

        async up(): Promise<void> {
          await this.connection.query(\`
            CREATE TABLE IF NOT EXISTS ${tableName} (
              id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
              ${columnDefinitions.join(',\n              ')}
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
          \`);

          ${relationDefinitions}

          // Créer un trigger pour mettre à jour updated_at
          await this.connection.query(\`
            CREATE TRIGGER update_${tableName}_updated_at
              BEFORE UPDATE ON ${tableName}
              FOR EACH ROW
              EXECUTE FUNCTION update_updated_at_column()
          \`);
        }

        async down(): Promise<void> {
          await this.connection.query('DROP TABLE IF EXISTS ${tableName} CASCADE');
        }
      }
    `;
  }

  private generateColumnDefinitions(columns: Map<string, any>): string[] {
    const definitions: string[] = [];
    
    columns.forEach((definition, columnName) => {
      let columnDef = `${columnName} ${this.getSqlType(definition.type)}`;
      
      if (!definition.nullable) {
        columnDef += ' NOT NULL';
      }
      
      if (definition.unique) {
        columnDef += ' UNIQUE';
      }
      
      if (definition.default !== undefined) {
        columnDef += ` DEFAULT ${this.getDefaultValue(definition.default)}`;
      }
      
      definitions.push(columnDef);
    });
    
    return definitions;
  }

  private generateRelationDefinitions(tableName: string, relations: Map<string, any>): string {
    const definitions: string[] = [];
    
    relations.forEach((relation, _) => {
      if (relation.type === 'belongsToMany' && relation.through) {
        const relatedModelDefinition = this.metadataStore.getModelDefinition(relation.model().name);
        
        definitions.push(`
          await this.connection.query(\`
            CREATE TABLE IF NOT EXISTS ${relation.through} (
              id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
              ${tableName.toLowerCase()}_id UUID REFERENCES ${tableName}(id) ON DELETE CASCADE,
              ${relatedModelDefinition.tableName.toLowerCase()}_id UUID REFERENCES ${relatedModelDefinition.tableName}(id) ON DELETE CASCADE,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(${tableName.toLowerCase()}_id, ${relatedModelDefinition.tableName.toLowerCase()}_id)
            )
          \`);
          
          await this.connection.query(\`
            CREATE TRIGGER update_${relation.through}_updated_at
              BEFORE UPDATE ON ${relation.through}
              FOR EACH ROW
              EXECUTE FUNCTION update_updated_at_column()
          \`);
        `);
      }
    });
    
    return definitions.join('\n');
  }

  private getSqlType(type: string): string {
    const typeMap: { [key: string]: string } = {
      string: 'VARCHAR(255)',
      number: 'NUMERIC',
      boolean: 'BOOLEAN',
      date: 'TIMESTAMP',
      json: 'JSONB'
    };
    
    return typeMap[type.toLowerCase()] || 'VARCHAR(255)';
  }

  private getDefaultValue(value: any): string {
    if (value === null) return 'NULL';
    if (value === 'CURRENT_TIMESTAMP') return value;
    if (typeof value === 'string') return `'${value}'`;
    return String(value);
  }

  private async getExecutedMigrations(): Promise<string[]> {
    const result = await this.connection.query(
      'SELECT name FROM migrations ORDER BY id'
    );
    return result.rows.map(row => row.name);
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