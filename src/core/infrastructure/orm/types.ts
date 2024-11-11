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