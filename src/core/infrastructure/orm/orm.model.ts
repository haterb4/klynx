import { DatabaseConnection } from '../persistence/DatabaseConnection';
import { Entity } from '../../domain/Entity';
import { ColumnDefinition, QueryOptions, RelationDefinition } from './types';
import { ModelMetadataStore } from './orm.metadata.store';
import { v4 } from 'uuid';


export class Model extends Entity<any> {
  private static connection: DatabaseConnection;
  private static metadataStore = ModelMetadataStore.getInstance();

  private _data: Record<string, any> = {};

  constructor(data: Record<string, any> = {}) {
    super({});
    this.fill(data);
  }

  public fill(data: Record<string, any>): void {
    const modelClass = this.constructor as typeof Model;
    const columns = modelClass.columns;
    
    // Ne copier que les colonnes définies
    columns.forEach((definition, columnName) => {
      if (columnName in data) {
        this._data[columnName] = data[columnName];
      }
    });
    
    // Gérer l'ID séparément car il vient de Entity
    if ('id' in data) {
      this.id = data.id;
    }
    else {
      this._data["id"] = this.id
      this.id = ""
    }
  }

  public get(key: string): any {
    return this._data[key];
  }

  public set(key: string, value: any): void {
    const modelClass = this.constructor as typeof Model;
    if (modelClass.columns.has(key)) {
      this._data[key] = value;
    }
  }

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
      console.log("custom orm ==> Entity update")
    } else {
      console.log("custom orm ==> Entity creation")
      await this.insert(options);
    }
  }

  public async create(options: QueryOptions = {}): Promise<void> {
    const modelClass = this.constructor as typeof Model;
    const data: {[key: string]: any} = this.toJSON();
    data.id = this._id || v4()
    
    
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

    const query = `
      INSERT INTO ${modelClass.tableName}
      (${columns.join(', ')})
      VALUES (${placeholders})
      RETURNING id
    `;

    const result = await modelClass.getConnection().query(query, values, options);
    this.id = result.rows[0].id;
  }

  private async insert(options: QueryOptions = {}): Promise<void> {
    const data = this.toJSON();
    delete (data as any).id;

    const _columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

    console.log("inserting into", (this.constructor as typeof Model).tableName, "with ", options)
    const query = `
      INSERT INTO ${(this.constructor as typeof Model).tableName}
      (${_columns.join(', ')})
      VALUES (${placeholders})
      RETURNING id;`;

    const result = await (this.constructor as typeof Model).getConnection()
      .query(query, values, options);
      
    this.id = result.rows[0].id;
  }

  public async update(options: QueryOptions = {}): Promise<void> {
    if (!this.id) {
      throw new Error('Cannot update model without ID');
    }

    const modelClass = this.constructor as typeof Model;
    const data = this.toJSON();
    delete (data as any).id;  // Remove ID from update data

    const columns = Object.keys(data);
    const values = Object.values(data);
    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');

    const query = `
      UPDATE ${modelClass.tableName}
      SET ${setClause}
      WHERE id = $${values.length + 1}
    `;
    console.log("updating into", (this.constructor as typeof Model).tableName, "with ", options)
    await modelClass.getConnection().query(query, [...values, this.id], options);
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
    const modelClass = this.constructor as typeof Model;
    const result: Record<string, any> = {};

    // Inclure toutes les colonnes définies
    modelClass.columns.forEach((definition, columnName) => {
      result[columnName] = this._data[columnName];
    });

    // Ajouter l'ID s'il existe
    if (this.id) {
      result.id = this.id;
    }

    return result;
  }
}