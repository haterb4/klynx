import { ColumnDefinition, ModelDefinition, RelationDefinition } from "./types";

export class ModelMetadataStore {
  private static instance: ModelMetadataStore;
  private modelDefinitions: Map<string, ModelDefinition> = new Map();
  private pendingColumns: Map<string, Map<string, ColumnDefinition>> = new Map();
  private pendingRelations: Map<string, Map<string, RelationDefinition>> = new Map();

  private constructor() {}

  static getInstance(): ModelMetadataStore {
    if (!ModelMetadataStore.instance) {
      ModelMetadataStore.instance = new ModelMetadataStore();
    }
    return ModelMetadataStore.instance;
  }

  registerModel(modelName: string, tableName: string) {
    // Créer la définition du modèle
    const modelDefinition: ModelDefinition = {
      tableName,
      columns: new Map(this.pendingColumns.get(modelName) || []),
      relations: new Map(this.pendingRelations.get(modelName) || [])
    };

    // Enregistrer le modèle
    this.modelDefinitions.set(modelName, modelDefinition);

    // Nettoyer les colonnes et relations en attente pour ce modèle
    this.pendingColumns.delete(modelName);
    this.pendingRelations.delete(modelName);

    return modelDefinition;
  }

  getModelDefinition(modelName: string): ModelDefinition {
    const definition = this.modelDefinitions.get(modelName);
    if (!definition) {
      throw new Error(`Model ${modelName} not registered`);
    }
    return definition;
  }

  setColumn(modelName: string, columnName: string, definition: ColumnDefinition) {
    if (this.modelDefinitions.has(modelName)) {
      // Si le modèle existe déjà, ajouter directement la colonne
      const model = this.modelDefinitions.get(modelName)!;
      model.columns.set(columnName, definition);
    } else {
      // Sinon, stocker la colonne en attente
      if (!this.pendingColumns.has(modelName)) {
        this.pendingColumns.set(modelName, new Map());
      }
      this.pendingColumns.get(modelName)!.set(columnName, definition);
    }
  }

  setRelation(modelName: string, relationName: string, definition: RelationDefinition) {
    if (this.modelDefinitions.has(modelName)) {
      // Si le modèle existe déjà, ajouter directement la relation
      const model = this.modelDefinitions.get(modelName)!;
      model.relations.set(relationName, definition);
    } else {
      // Sinon, stocker la relation en attente
      if (!this.pendingRelations.has(modelName)) {
        this.pendingRelations.set(modelName, new Map());
      }
      this.pendingRelations.get(modelName)!.set(relationName, definition);
    }
  }

  getAllModels(): Map<string, ModelDefinition> {
    return this.modelDefinitions;
  }

  // Méthode utilitaire pour vérifier l'état des colonnes en attente (debug)
  getPendingColumns(): Map<string, Map<string, ColumnDefinition>> {
    return this.pendingColumns;
  }

  // Méthode utilitaire pour vérifier l'état des relations en attente (debug)
  getPendingRelations(): Map<string, Map<string, RelationDefinition>> {
    return this.pendingRelations;
  }
}