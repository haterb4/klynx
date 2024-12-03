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
  propertyKey: string;
}

export interface QueryOptions {
  transaction?: boolean;
  orderBy?: { [key: string]: 'ASC' | 'DESC' };
  limit?: number;
  offset?: number;
  include?: string[];
  select?: string[];
  search?: {
    fields?: string[];
    term?: string;
    mode?: 'like' | 'exact' | 'fulltext';
  };
  filter?: {
    [key: string]: any;
  };
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

export type HookFunction = (model: Model) => Promise<void> | void;

export interface ModelHooks {
  beforeCreate?: HookFunction[];
  afterCreate?: HookFunction[];
  beforeUpdate?: HookFunction[];
  afterUpdate?: HookFunction[];
  beforeDelete?: HookFunction[];
  afterDelete?: HookFunction[];
}