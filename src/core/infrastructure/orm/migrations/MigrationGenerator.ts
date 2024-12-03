import { DatabaseConnection } from '../../persistence/DatabaseConnection';
import { ModelMetadataStore } from '../orm.metadata.store';
import { Model } from '../orm.model';
import { ColumnDefinition, ModelDefinition, RelationDefinition } from '../types';
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
      await this.findModels();
      
      // 2. Attendre un peu pour s'assurer que les décorateurs sont appliqués
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 3. Obtenir les modèles enregistrés
      const modelDefinitions = this.metadataStore.getAllModels();
      
      // 4. Générer les migrations pour chaque modèle
      const migrations: Migration[] = [];
      
      for (const [modelName, definition] of modelDefinitions) {
        const ModelClass = await this.findModelClass(modelName);
        if (ModelClass) {
          // Générer les migrations pour les tables principales
          const primaryModelMigration = await this.generatePrimaryModelMigration(ModelClass);
          if (primaryModelMigration) {
            const primaryModelMigrationInstance = new primaryModelMigration(this.connection);
            migrations.push(primaryModelMigrationInstance);
          }

          // Générer les migrations pour les relations belongsToMany
          const belongsToManyRelations = this.getBelongsToManyRelations(definition);
          for (const relation of belongsToManyRelations) {
            const jointTableMigration = await this.generateJointTableMigration(ModelClass, relation);
            if (jointTableMigration) {
              const jointTableMigrationInstance = new jointTableMigration(this.connection);
              migrations.push(jointTableMigrationInstance);
            }
          }
        }
      }
      
      // 5. Exécuter les migrations via MigrationManager
      const migrationManager = new MigrationManager(this.connection, this.migrationsPath);
      const primaryMigrations: Migration[] = []
      const joinMigrations: Migration[] = []
      for (let migration of migrations){
        if (`${migration.constructor.name}`.includes('JoinTable')) {
          joinMigrations.push(migration)
        }
        else {
          primaryMigrations.push(migration)
        }
      }
      
      const finalmigrations = [...primaryMigrations, ...joinMigrations]
      await migrationManager.migrateWithMigrations(finalmigrations);
      
    } catch (error) {
      console.error('Error in generateAndRunMigrations:', error);
      throw error;
    }
  }

  private async generatePrimaryModelMigration(ModelClass: typeof Model): Promise<typeof Migration | undefined> {
    const modelDefinition = this.metadataStore.getModelDefinition(ModelClass.name);
    const { tableName, columns } = modelDefinition;
    const timestamp = new Date().getTime();
    const className = `Create${tableName}Table_${timestamp}`;
    const fileName = `${className}.migration.ts`;
    const filePath = path.join(this.migrationsPath, fileName);

    // Générer le contenu de la migration
    const migrationContent = this.generatePrimaryModelMigrationContent(className, tableName, columns);
    await fs.writeFile(filePath, migrationContent);

    // Charger dynamiquement la migration
    const { default: MigrationClass } = await import(filePath);
    return MigrationClass;
  }

  private async generateJointTableMigration(ModelClass: typeof Model, relation: RelationDefinition): Promise<typeof Migration | undefined> {
    const modelDefinition = this.metadataStore.getModelDefinition(ModelClass.name);
    const { tableName } = modelDefinition;
    const relatedModelDefinition = this.metadataStore.getModelDefinition(relation.model().name);
    const timestamp = new Date().getTime();
    const className = `CreateJoinTable_${tableName}_${relatedModelDefinition.tableName}_${timestamp}`;
    const fileName = `${className}.migration.ts`;
    const filePath = path.join(this.migrationsPath, fileName);

    // Générer le contenu de la migration
    const migrationContent = this.generateJointTableMigrationContent(className, tableName, relatedModelDefinition.tableName, relation);
    await fs.writeFile(filePath, migrationContent);

    // Charger dynamiquement la migration
    const { default: MigrationClass } = await import(filePath);
    return MigrationClass;
  }

  private generatePrimaryModelMigrationContent(className: string, tableName: string, columns: Map<string, ColumnDefinition>): string {
    const columnDefinitions = this.generateColumnDefinitions(columns);

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
              ${columnDefinitions.join(',\n              ')},
              created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
              updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
            )
          \`);

          // Créer un trigger pour mettre à jour updated_at
          await this.connection.query(\`
            DROP TRIGGER IF EXISTS update_${tableName}_updated_at ON ${tableName};
          \`);
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
  
  private generateJointTableMigrationContent(className: string, tableName: string, relatedTableName: string, relation: RelationDefinition): string {
    const thisKey = `${tableName.toLowerCase()}_id`;
    const relatedKey = `${relatedTableName.toLowerCase()}_id`;

    return `
      import { DatabaseConnection, Migration } from 'celeron';

      export default class ${className} extends Migration {
        constructor(connection: DatabaseConnection) {
          super(connection);
        }

        async up(): Promise<void> {
          await this.connection.query(\`
            CREATE TABLE IF NOT EXISTS ${relation.through} (
              id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
              ${thisKey} UUID REFERENCES ${tableName}(id) ON DELETE CASCADE,
              ${relatedKey} UUID REFERENCES ${relatedTableName}(id) ON DELETE CASCADE,
              created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
              updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(${thisKey}, ${relatedKey})
            )
          \`);

          // Créer un trigger pour mettre à jour updated_at
          await this.connection.query(\`
            DROP TRIGGER IF EXISTS update_${relation.through}_updated_at ON ${relation.through};
          \`);
          await this.connection.query(\`
            CREATE TRIGGER update_${relation.through}_updated_at
              BEFORE UPDATE ON ${relation.through}
              FOR EACH ROW
              EXECUTE FUNCTION update_updated_at_column()
          \`);
        }

        async down(): Promise<void> {
          await this.connection.query('DROP TABLE IF EXISTS ${relation.through} CASCADE');
        }
      }
    `;
  }

  private getBelongsToManyRelations(definition: ModelDefinition): RelationDefinition[] {
    return [...definition.relations.values()].filter(relation => relation.type === 'belongsToMany');
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

  private generateColumnDefinitions(columns: Map<string, ColumnDefinition>): string[] {
    const definitions: string[] = [];
    let unique = 0
    const uniqueString: string[] = []
    columns.forEach((definition, columnName) => {
      let columnDef = `${columnName} ${this.getSqlType(definition.type)}`;
      
      if (definition.nullable === false) {
        columnDef += ' NOT NULL';
      }
      
      if (definition.unique) {
        if (unique < 1) {
          columnDef += ' UNIQUE';
          uniqueString.push(columnName);
          unique += 1;
        }
        else {
          uniqueString.push(columnName);
        }
      }
      
      if (definition.default !== undefined) {
        columnDef += ` DEFAULT ${this.getDefaultValue(definition.default)}`;
      }
      
      definitions.push(columnDef);
    });
    
    if (uniqueString.length > 1) {
      for (let i=0, c = definitions.length; i < c; i++) {
        if (definitions[i].includes(' UNIQUE')) {
          definitions[i] = definitions[i].replace(' UNIQUE', '')
          break;
        }
      }
      definitions.push(`UNIQUE(${uniqueString.join(', ')})`)
    }

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
}