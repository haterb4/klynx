import { ModelMetadataStore } from "./orm.metadata.store";
import { Model } from "./orm.model";
import { ColumnDefinition, RelationDefinition } from "./types";

const metadataStore = ModelMetadataStore.getInstance();

// Décorateurs
export function table(tableName: string): ClassDecorator {
  return function (constructor: Function) {
    metadataStore.registerModel(constructor.name, tableName);
    (constructor as typeof Model).prototype.getModelName = function(): string { return constructor.name }
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
      through: options.through,
      propertyKey
    };
    metadataStore.setRelation(target.constructor.name, propertyKey, relation);
  };
}

export function belongsTo(relatedModel: () => typeof Model, options: Partial<RelationDefinition> = {}) {
  return function (target: any, propertyKey: string) {
    const relation: RelationDefinition = {
      type: 'belongsTo',
      model: relatedModel,
      foreignKey: options.foreignKey || `${relatedModel().name.toLowerCase()}_id`,
      propertyKey
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
      foreignKey: options.foreignKey,
      propertyKey
    };
    metadataStore.setRelation(target.constructor.name, propertyKey, relation);
  };
}