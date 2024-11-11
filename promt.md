//src/orm/migrations/Migration.ts
import { DatabaseConnection } from "../../persistence/DatabaseConnection";
import { MigrationGenerator } from "./MigrationGenerator";

export class Migration {
  constructor(protected connection: DatabaseConnection) {}

  async up(): Promise<void> {}
  async down(): Promise<void> {}
}

export async function runMigrations(
  connection: DatabaseConnection,
  modelsPath: string,
  migrationsPath: string
): Promise<void> {
  const generator = new MigrationGenerator(connection, modelsPath, migrationsPath);
  await generator.generateAndRunMigrations();
}

//src/orm/migrations/MigrationGenerator.ts
import { DatabaseConnection } from '../../persistence/DatabaseConnection';
import { ModelMetadataStore } from '../orm.metadata.store';
import { Model } from '../orm.model';
import { ColumnDefinition, RelationDefinition } from '../types';
import { Migration } from './Migration';
import { MigrationManager } from './MigrationManager';

import * as fs from 'fs/promises';
import * as path from 'path';

export class MigrationGenerator {
  private metadataStore: ModelMetadataStore;
  constructor(
    private connection: DatabaseConnection,
    private modelsPath: string,
    private migrationsPath: string
  ) {
    this.metadataStore = ModelMetadataStore.getInstance();
  }

  async generateAndRunMigrations(): Promise<void> {
    try {
      // 1. Charger d'abord tous les fichiers de modèles pour les enregistrer
      await this.preloadModels();
      
      // 2. Attendre un peu pour s'assurer que les décorateurs sont appliqués
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 3. Obtenir les modèles enregistrés
      const modelDefinitions = this.metadataStore.getAllModels();
      
      // 4. Générer les migrations pour chaque modèle
      const migrations: Migration[] = [];
      
      for (const [modelName, definition] of modelDefinitions) {
        const ModelClass = await this.findModelClass(modelName);
        if (ModelClass) {
          const migration = await this.generateMigrationForModel(ModelClass);
          if (migration) {
            const migrationInstance = new migration(this.connection);
            migrations.push(migrationInstance);
          }
        }
      }
      
      // 5. Exécuter les migrations via MigrationManager
      const migrationManager = new MigrationManager(this.connection, this.migrationsPath);
      await migrationManager.migrateWithMigrations(migrations);
      
    } catch (error) {
      console.error('Error in generateAndRunMigrations:', error);
      throw error;
    }
  }

  private async findModelClass(modelName: string): Promise<typeof Model | undefined> {
    try {
      const files = await this.getFilesRecursively(this.modelsPath);
      
      for (const file of files) {
        if (file.endsWith('.model.ts') && !file.endsWith('.d.ts')) {
          const module = await import(file);
          
          // Parcourir toutes les exports du module
          for (const exportedItem of Object.values(module)) {
            if (
              this.isModelClass(exportedItem) && 
              (exportedItem as any).name === modelName
            ) {
              return exportedItem as typeof Model;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error finding model class:', error);
    }
    return undefined;
  }

  private async preloadModels(): Promise<void> {
    try {
      const files = await this.getFilesRecursively(this.modelsPath);
      
      for (const file of files) {
        if (file.endsWith('.model.ts') || file.endsWith('.model.js')) {
          // Importer le fichier pour déclencher les décorateurs
          await import(file);
        }
      }
    } catch (error) {
      console.error('Error preloading models:', error);
      throw error;
    }
  }

  private async findModels(): Promise<typeof Model[]> {
    const models: typeof Model[] = [];
    
    try {
      // Récupérer tous les fichiers .ts dans le dossier des modèles de manière récursive
      const files = await this.getFilesRecursively(this.modelsPath);
      
      for (const file of files) {
        if (file.endsWith('.model.ts') && !file.endsWith('.d.ts')) {
          const module = await import(file);
          
          // Parcourir toutes les exports du module
          Object.values(module).forEach(exportedItem => {
            if (this.isModelClass(exportedItem)) {
              models.push(exportedItem as typeof Model);
            }
          });
        }
      }
    } catch (error) {
      console.error('Error finding models:', error);
      throw error;
    }
    
    return models;
  }

  private async getFilesRecursively(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        files.push(...await this.getFilesRecursively(fullPath));
      } else {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  private isModelClass(item: any): boolean {
    return (
      typeof item === 'function' &&
      item.prototype instanceof Model &&
      item !== Model // Exclure la classe Model de base
    );
  }

  private async generateMigrations(models: typeof Model[]): Promise<typeof Migration[]> {
    const migrations: typeof Migration[] = [];
    
    for (const ModelClass of models) {
      const migration = await this.generateMigrationForModel(ModelClass);
      migrations.push(migration);
    }
    
    return migrations;
  }

  private async generateMigrationForModel(ModelClass: typeof Model): Promise<typeof Migration> {
    const modelMetadata = this.metadataStore.getModelDefinition(ModelClass.name);
    const tableName = modelMetadata.tableName;
    const columns = modelMetadata.columns;
    const relations = modelMetadata.relations;
    
    const timestamp = new Date().getTime();
    const className = `Create${tableName.slice(0, 1).toUpperCase()+tableName.slice(1)}Table_${timestamp}`;
    const fileName = `${className}.migration.ts`;
    const filePath = path.join(this.migrationsPath, fileName);
    
    // Générer le contenu de la migration
    const migrationContent = this.generateMigrationContent(className, tableName, columns, relations);
    
    // Écrire le fichier de migration
    await fs.writeFile(filePath, migrationContent);
    
    // Importer et retourner la classe de migration
    const module = await import(filePath);
    return module.default;
  }

  private generateMigrationContent(
    className: string,
    tableName: string,
    columns: Map<string, ColumnDefinition>,
    relations: Map<string, RelationDefinition>
  ): string {
    const columnDefinitions: string[] = this.generateColumnDefinitions(columns);
    const relationDefinitions: string = this.generateRelationDefinitions(tableName, relations);
    console.log("columns of ", tableName, columnDefinitions)
    console.log("relations of ", tableName, relationDefinitions)
    return `
export class ${className} extends Migration {
    constructor(connection: DatabaseConnection) {
        super(connection);
    }

    async up(): Promise<void> {
        // Création de la table principale
        await this.connection.query(\`
        CREATE TABLE IF NOT EXISTS ${tableName} (
            id UUID PRIMARY KEY,
            ${columnDefinitions.join(',\n\t')}
        )
        \`);

        // Création des tables de relations
        ${relationDefinitions}
    }

    async down(): Promise<void> {
        // Suppression des tables de relations
        ${this.generateRelationDropStatements(relations)}
        
        // Suppression de la table principale
        await this.connection.query('DROP TABLE IF EXISTS ${tableName} CASCADE');
    }
}

export default ${className};`;
  }

  private generateColumnDefinitions(columns: Map<string, ColumnDefinition>): string[] {
    const definitions: string[] = [];
    
    columns.forEach((definition, columnName) => {
      let columnDef = `${columnName} ${this.getSqlType(definition.type)}`;
      
      if (definition.nullable === false) {
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

  private getSqlType(type: string): string {
    const typeMap: { [key: string]: string } = {
      string: 'VARCHAR(255)',
      number: 'NUMERIC',
      boolean: 'BOOLEAN',
      date: 'TIMESTAMP',
      json: 'JSONB'
    };
    
    return typeMap[type] || 'VARCHAR(255)';
  }

  private getDefaultValue(value: any): string {
    if (value === 'CURRENT_TIMESTAMP') {
      return 'CURRENT_TIMESTAMP';
    }
    
    if (typeof value === 'string') {
      return `'${value}'`;
    }
    
    return String(value);
  }

  private generateRelationDefinitions(tableName: string, relations: Map<string, RelationDefinition>): string {
    const definitions: string[] = [];
    
    relations.forEach((relation, relationName) => {
      if (relation.type === 'belongsToMany' && relation.through) {
        const RelatedModel = relation.model();
        const relatedModelMetadata = this.metadataStore.getModelDefinition(RelatedModel.name);
        
        definitions.push(`
    await this.connection.query(\`
      CREATE TABLE IF NOT EXISTS ${relation.through} (
        id UUID PRIMARY KEY,
        ${tableName.toLowerCase()}_id UUID NOT NULL REFERENCES ${tableName}(id) ON DELETE CASCADE,
        ${relatedModelMetadata.tableName.toLowerCase()}_id UUID NOT NULL REFERENCES ${relatedModelMetadata.tableName}(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(${tableName.toLowerCase()}_id, ${relatedModelMetadata.tableName.toLowerCase()}_id)
      )
    \`);`);
      }
    });
    
    return definitions.join('\n');
  }

  private generateRelationDropStatements(relations: Map<string, RelationDefinition>): string {
    const statements: string[] = [];
    
    relations.forEach((relation) => {
      if (relation.type === 'belongsToMany' && relation.through) {
        statements.push(`await this.connection.query('DROP TABLE IF EXISTS ${relation.through} CASCADE');`);
      }
    });
    
    return statements.join('\n    ');
  }
}

//src/orm/migrations/MigrationManager.ts
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
      import { Migration } from './Migration';
      import { DatabaseConnection } from '../../persistence/DatabaseConnection';

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

//src/orm/orm.decorator.ts
import { ModelMetadataStore } from "./orm.metadata.store";
import { Model } from "./orm.model";
import { ColumnDefinition, RelationDefinition } from "./types";

const metadataStore = ModelMetadataStore.getInstance();

// Décorateurs
export function table(tableName: string) {
    return function (constructor: typeof Model) {
      metadataStore.registerModel(constructor.name, tableName);
    };
}
  
export function column(definition: ColumnDefinition) {
    return function (target: any, propertyKey: string) {
      metadataStore.setColumn(target.constructor.name, propertyKey, definition);
    };
}
  
export function hasMany(relatedModel: () => typeof Model, options: Partial<RelationDefinition> = {}) {
  return function (target: any, propertyKey: string) {
    const relation: RelationDefinition = {
      type: 'hasMany',
      model: relatedModel,
      foreignKey: options.foreignKey || `${target.constructor.name.toLowerCase()}_id`,
      through: options.through
    };
    metadataStore.setRelation(target.constructor.name, propertyKey, relation);
  };
}

export function belongsTo(relatedModel: () => typeof Model, options: Partial<RelationDefinition> = {}) {
  return function (target: any, propertyKey: string) {
    const relation: RelationDefinition = {
      type: 'belongsTo',
      model: relatedModel,
      foreignKey: options.foreignKey || `${relatedModel().name.toLowerCase()}_id`
    };
    metadataStore.setRelation(target.constructor.name, propertyKey, relation);
  };
}

export function belongsToMany(
  relatedModel: () => typeof Model,
  through: string,
  options: Partial<RelationDefinition> = {}
) {
  return function (target: any, propertyKey: string) {
    const relation: RelationDefinition = {
      type: 'belongsToMany',
      model: relatedModel,
      through,
      foreignKey: options.foreignKey
    };
    metadataStore.setRelation(target.constructor.name, propertyKey, relation);
  };
}

//src/orm/orm.metadata.store.ts
import { ColumnDefinition, ModelDefinition, RelationDefinition } from "./types";

export class ModelMetadataStore {
  private static instance: ModelMetadataStore;
  private modelDefinitions: Map<string, ModelDefinition> = new Map();

  private constructor() {}

  static getInstance(): ModelMetadataStore {
    if (!ModelMetadataStore.instance) {
      ModelMetadataStore.instance = new ModelMetadataStore();
    }
    return ModelMetadataStore.instance;
  }

  registerModel(modelName: string, tableName: string) {
    if (!this.modelDefinitions.has(modelName)) {
      this.modelDefinitions.set(modelName, {
        tableName,
        columns: new Map(),
        relations: new Map()
      });
    }
    return this.getModelDefinition(modelName);
  }

  getModelDefinition(modelName: string): ModelDefinition {
    const definition = this.modelDefinitions.get(modelName);
    if (!definition) {
      throw new Error(`Model ${modelName} not registered`);
    }
    return definition;
  }

  setColumn(modelName: string, columnName: string, definition: ColumnDefinition) {
    const model = this.getModelDefinition(modelName);
    model.columns.set(columnName, definition);
  }

  setRelation(modelName: string, relationName: string, definition: RelationDefinition) {
    const model = this.getModelDefinition(modelName);
    model.relations.set(relationName, definition);
  }

  getAllModels(): Map<string, ModelDefinition> {
    return this.modelDefinitions;
  }
}

//src/orm/orm.model.ts
import { DatabaseConnection } from '../persistence/DatabaseConnection';
import { Entity } from '../../domain/Entity';
import { ColumnDefinition, QueryOptions, RelationDefinition } from './types';
import { ModelMetadataStore } from './orm.metadata.store';


export class Model extends Entity<any> {
  private static connection: DatabaseConnection;
  private static metadataStore = ModelMetadataStore.getInstance();

  protected static getModelName(): string {
    return this.name;
  }

  public static get tableName(): string {
    return this.metadataStore.getModelDefinition(this.getModelName()).tableName;
  }

  public static get columns(): Map<string, ColumnDefinition> {
    return this.metadataStore.getModelDefinition(this.getModelName()).columns;
  }
  
  public static get relations(): Map<string, RelationDefinition> {
    return this.metadataStore.getModelDefinition(this.getModelName()).relations;
  }

  private static _columns: Map<string, ColumnDefinition> = new Map();
  private static _relations: Map<string, RelationDefinition> = new Map();

  // Gestion de la connexion
  static setConnection(connection: DatabaseConnection) {
    this.connection = connection;
  }

  static getConnection(): DatabaseConnection {
    if (!this.connection) {
      throw new Error('Database connection not set');
    }
    return this.connection;
  }

  // Méthodes de configuration
  static column(name: string, definition: ColumnDefinition) {
    this._columns.set(name, definition);
  }

  static relation(name: string, definition: RelationDefinition) {
    this._relations.set(name, definition);
  }

  // Méthodes de requête améliorées
  static async findById(id: string, options: QueryOptions = {}): Promise<Model | null> {
    const query = `SELECT ${this.buildSelectClause(options)} FROM ${this.tableName} WHERE id = $1`;
    const result = await this.getConnection().query(query, [id], options);
    return result.rows[0] ? this.hydrate(result.rows[0]) : null;
  }

  static async findAll(conditions: object = {}, options: QueryOptions = {}): Promise<Model[]> {
    const { query, params } = this.buildSelectQuery(conditions, options);
    const result = await this.getConnection().query(query, params, options);
    return result.rows.map(row => this.hydrate(row));
  }

  static async count(conditions: object = {}): Promise<number> {
    const { query, params } = this.buildCountQuery(conditions);
    const result = await this.getConnection().query(query, params);
    return parseInt(result.rows[0].count);
  }

  static async exists(conditions: object): Promise<boolean> {
    const count = await this.count(conditions);
    return count > 0;
  }

  private static buildSelectQuery(conditions: object, options: QueryOptions): { query: string; params: any[] } {
    const whereClause: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    // Construction de la clause WHERE
    Object.entries(conditions).forEach(([key, value]) => {
      if (value === null) {
        whereClause.push(`${key} IS NULL`);
      } else {
        whereClause.push(`${key} = $${paramCount}`);
        params.push(value);
        paramCount++;
      }
    });

    let query = `SELECT ${this.buildSelectClause(options)} FROM ${this.tableName}`;
    
    if (whereClause.length) {
      query += ` WHERE ${whereClause.join(' AND ')}`;
    }

    // Ajout ORDER BY
    if (options.orderBy) {
      const orderClauses = Object.entries(options.orderBy)
        .map(([column, direction]) => `${column} ${direction}`);
      query += ` ORDER BY ${orderClauses.join(', ')}`;
    }

    // Ajout LIMIT et OFFSET
    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }
    if (options.offset) {
      query += ` OFFSET ${options.offset}`;
    }

    return { query, params };
  }

  private static buildCountQuery(conditions: object): { query: string; params: any[] } {
    const { query, params } = this.buildSelectQuery(conditions, {});
    return {
      query: `SELECT COUNT(*) as count FROM (${query}) as subquery`,
      params
    };
  }

  private static buildSelectClause(options: QueryOptions): string {
    if (options.select && options.select.length > 0) {
      return options.select.join(', ');
    }
    return '*';
  }

  private static hydrate(data: any): Model {
    const instance = new this(data);
    Object.assign(instance, data);
    return instance;
  }

  static async first(conditions: object = {}, options: QueryOptions = {}): Promise<Model | null> {
    const { query, params } = this.buildSelectQuery(conditions, { ...options, limit: 1 });
    const result = await this.getConnection().query(query, params, options);
    return result.rows[0] ? this.hydrate(result.rows[0]) : null;
  }

  static async where(conditions: object, options: QueryOptions = {}): Promise<Model[]> {
    return this.findAll(conditions, options);
  }

  // Méthodes de persistance améliorées
  async save(options: QueryOptions = {}): Promise<void> {
    if (this.id) {
      await this.update(options);
    } else {
      await this.insert(options);
    }
  }

  private async insert(options: QueryOptions = {}): Promise<void> {
    const data = this.toJSON();
    delete (data as any).id;

    const _columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

    const query = `
      INSERT INTO ${(this.constructor as typeof Model).tableName}
      (${_columns.join(', ')})
      VALUES (${placeholders})
      RETURNING id
    `;

    const result = await (this.constructor as typeof Model).getConnection()
      .query(query, values, options);
      
    this.id = result.rows[0].id;
  }

  private async update(options: QueryOptions = {}): Promise<void> {
    const data = this.toJSON();
    delete (data as any).id;

    const _columns = Object.keys(data);
    const values = Object.values(data);
    const setClause = _columns.map((col, i) => `${col} = $${i + 1}`).join(', ');

    const query = `
      UPDATE ${(this.constructor as typeof Model).tableName}
      SET ${setClause}
      WHERE id = $${values.length + 1}
    `;

    await (this.constructor as typeof Model).getConnection()
      .query(query, [...values, this.id], options);
  }

  async delete(options: QueryOptions = {}): Promise<void> {
    const query = `DELETE FROM ${(this.constructor as typeof Model).tableName} WHERE id = $1`;
    await (this.constructor as typeof Model).getConnection()
      .query(query, [this.id], options);
  }

  // Gestion des transactions
  static async transaction<T>(callback: () => Promise<T>): Promise<T> {
    return this.getConnection().withTransaction(callback);
  }

  // _relations améliorées
  async load(relationName: string, options: QueryOptions = {}): Promise<any> {
    const modelConstructor = this.constructor as typeof Model;
    const relation = modelConstructor._relations.get(relationName);
    
    if (!relation) {
      throw new Error(`Relation ${relationName} not found`);
    }

    switch (relation.type) {
      case 'hasOne':
        return Model.loadHasOne(this, relation, options);
      case 'hasMany':
        return Model.loadHasMany(this, relation, options);
      case 'belongsTo':
        return Model.loadBelongsTo(this, relation, options);
      case 'belongsToMany':
        return Model.loadBelongsToMany(this, relation, options);
    }
  }

  private static async loadHasOne(instance: Model, relation: RelationDefinition, options: QueryOptions): Promise<Model | null> {
    const RelatedModel = relation.model();
    const foreignKey = relation.foreignKey || `${this.name.toLowerCase()}_id`;
    return RelatedModel.first({ [foreignKey]: instance.id }, options);
  }

  private static async loadHasMany(instance: Model, relation: RelationDefinition, options: QueryOptions): Promise<Model[]> {
    const RelatedModel = relation.model();
    const foreignKey = relation.foreignKey || `${this.name.toLowerCase()}_id`;
    return RelatedModel.where({ [foreignKey]: instance.id }, options);
  }

  private static async loadBelongsTo(instance: Model, relation: RelationDefinition, options: QueryOptions): Promise<Model | null> {
    const RelatedModel = relation.model();
    const foreignKey = relation.foreignKey || `${RelatedModel.name.toLowerCase()}_id`;
    return RelatedModel.findById((instance as any)[foreignKey], options);
  }

  private static async loadBelongsToMany(instance: Model, relation: RelationDefinition, options: QueryOptions): Promise<Model[]> {
    if (!relation.through) {
      throw new Error('Through table is required for belongsToMany relation');
    }

    const RelatedModel = relation.model();
    const thisKey = `${this.name.toLowerCase()}_id`;
    const relatedKey = `${RelatedModel.name.toLowerCase()}_id`;

    const query = `
      SELECT ${this.buildSelectClause(options)} FROM ${RelatedModel.tableName} r
      INNER JOIN ${relation.through} j ON j.${relatedKey} = r.id
      WHERE j.${thisKey} = $1
      ${options.orderBy ? `ORDER BY ${Object.entries(options.orderBy)
        .map(([column, direction]) => `${column} ${direction}`).join(', ')}` : ''}
      ${options.limit ? `LIMIT ${options.limit}` : ''}
      ${options.offset ? `OFFSET ${options.offset}` : ''}
    `;

    const result = await this.getConnection().query(query, [instance.id], options);
    return result.rows.map(row => RelatedModel.hydrate(row));
  }


  toJSON(): object {
    const json: any = {};
    (this.constructor as typeof Model)._columns.forEach((definition, key) => {
      json[key] = (this as any)[key];
    });
    return json;
  }
}

//src/orm/type.ts

import { Model } from "./orm.model";

export type ColumnType = 'string' | 'number' | 'boolean' | 'date' | 'json';

export interface ColumnDefinition {
  type: ColumnType;
  nullable?: boolean;
  unique?: boolean;
  primary?: boolean;
  default?: any;
}

export interface RelationDefinition {
  type: 'hasOne' | 'hasMany' | 'belongsTo' | 'belongsToMany';
  model: () => typeof Model;
  foreignKey?: string;
  through?: string;
}

export interface QueryOptions {
  transaction?: boolean;
  orderBy?: { [key: string]: 'ASC' | 'DESC' };
  limit?: number;
  offset?: number;
  select?: string[];
}

export type ValidationRule = {
  validator: (value: any) => boolean | Promise<boolean>;
  message: string;
};

export type ValidationRules = {
  [key: string]: ValidationRule[];
};

export interface ModelDefinition {
  tableName: string;
  columns: Map<string, ColumnDefinition>;
  relations: Map<string, RelationDefinition>;
}