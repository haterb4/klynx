import { ColumnDefinition, Model, RelationDefinition } from "./orm.model";

// Décorateurs
export function table(name: string) {
    return function (constructor: typeof Model) {
      constructor.tableName = name;
    };
}
  
export function column(definition: ColumnDefinition) {
    return function (target: any, propertyKey: string) {
      const constructor = target.constructor as typeof Model;
      constructor.column(propertyKey, definition);
    };
}
  
export function relation(definition: RelationDefinition) {
    return function (target: any, propertyKey: string) {
      const constructor = target.constructor as typeof Model;
      constructor.relation(propertyKey, definition);
    };
}