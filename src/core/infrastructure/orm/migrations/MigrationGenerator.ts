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
      const models = await this.findModels();
      
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
    return `
import { DatabaseConnection, Migration } from 'celeron'
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