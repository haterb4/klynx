import { DatabaseConnection } from '../persistence/DatabaseConnection';
import { Entity } from '../../domain/Entity';

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

export class Model extends Entity<any> {
  private static connection: DatabaseConnection;
  protected static _tableName: string;

  public static get tableName(): string {
    return this._tableName;
  }

  public static set tableName(value: string) {
    this._tableName = value;
  }

  private static columns: Map<string, ColumnDefinition> = new Map();
  private static relations: Map<string, RelationDefinition> = new Map();

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
    this.columns.set(name, definition);
  }

  static relation(name: string, definition: RelationDefinition) {
    this.relations.set(name, definition);
  }

  // Méthodes de requête améliorées
  static async findById(id: string, options: QueryOptions = {}): Promise<Model | null> {
    const query = `SELECT ${this.buildSelectClause(options)} FROM ${this._tableName} WHERE id = $1`;
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

    let query = `SELECT ${this.buildSelectClause(options)} FROM ${this._tableName}`;
    
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

    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

    const query = `
      INSERT INTO ${(this.constructor as typeof Model).tableName}
      (${columns.join(', ')})
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

    const columns = Object.keys(data);
    const values = Object.values(data);
    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');

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

  // Relations améliorées
  async load(relationName: string, options: QueryOptions = {}): Promise<any> {
    const modelConstructor = this.constructor as typeof Model;
    const relation = modelConstructor.relations.get(relationName);
    
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
    (this.constructor as typeof Model).columns.forEach((definition, key) => {
      json[key] = (this as any)[key];
    });
    return json;
  }
}