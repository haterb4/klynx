import { DatabaseConnection } from '../persistence/DatabaseConnection';
import { ColumnDefinition, HookFunction, ModelHooks, QueryOptions, RelationDefinition } from './types';
import { ModelMetadataStore } from './orm.metadata.store';
import { v4 } from 'uuid';
import { AggregateRoot } from '../../domain/AggregateRoot';
import { DomainEvent } from '@/core/domain/events/DomainEvent';


export class Model extends AggregateRoot<any> {
  private static connection: DatabaseConnection;
  private static metadataStore = ModelMetadataStore.getInstance();
  private static hooks: Map<string, ModelHooks> = new Map();

  private _data: Record<string, any> = {};

  constructor(data: Record<string, any> = {}) {
    super({});
    this.fill(data);
    this._data["id"] = this.id
    this.id = ""

    // Initialiser les hooks pour cette classe si ce n'est pas déjà fait
    const modelClass = this.constructor as typeof Model;
    const modelName = modelClass.name;
    
    if (!Model.hooks.has(modelName)) {
      Model.hooks.set(modelName, {
        beforeCreate: [],
        afterCreate: [],
        beforeUpdate: [],
        afterUpdate: [],
        beforeDelete: [],
        afterDelete: []
      });
    }
  }

  addEvent(domainEvent: DomainEvent): void {
    this.addDomainEvent(domainEvent);
  }
  protected static getHooks(modelName: string): ModelHooks {
    if (!this.hooks.has(modelName)) {
      this.hooks.set(modelName, {
        beforeCreate: [],
        afterCreate: [],
        beforeUpdate: [],
        afterUpdate: [],
        beforeDelete: [],
        afterDelete: []
      });
    }
    return this.hooks.get(modelName)!;
  }

  protected static registerHook(
    type: keyof ModelHooks,
    fn: HookFunction
  ): void {
    const modelName = this.prototype.getModelName();
    const modelHooks = this.hooks.get(modelName) || {};
    
    if (!this.hooks.has(modelName)) {
      this.hooks.set(modelName, modelHooks);
    }

    if (!modelHooks[type]) {
      modelHooks[type] = [];
    }

    modelHooks[type]!.push(fn);
    this.hooks.set(modelName, modelHooks)
  }

  static addHook(modelName: string, type: keyof ModelHooks, fn: HookFunction): void {
    const hooks = this.getHooks(modelName);
    hooks[type]?.push(fn);
    this.hooks.set(modelName, hooks)
    console.log("hook added sucessfully")
  }

  // Méthodes de raccourci pour enregistrer les hooks
  static addBeforeCreate(fn: HookFunction): void {
    this.addHook(this.name, 'beforeCreate', fn);
  }

  static addAfterCreate(fn: HookFunction): void {
    this.addHook(this.name, 'afterCreate', fn);
  }

  static addBeforeUpdate(fn: HookFunction): void {
    this.addHook(this.name, 'beforeUpdate', fn);
  }

  static addAfterUpdate(fn: HookFunction): void {
    this.addHook(this.name, 'afterUpdate', fn);
  }

  static addBeforeDelete(fn: HookFunction): void {
    this.addHook(this.name, 'beforeDelete', fn);
  }

  static addAfterDelete(fn: HookFunction): void {
    this.addHook(this.name, 'afterDelete', fn);
  }

  private async executeHooks(type: keyof ModelHooks): Promise<void> {
    const modelClass = this.constructor as typeof Model;
    const hooks = Model.getHooks(modelClass.name);
    
    if (!hooks[type]) return;

    for (const hook of hooks[type]) {
      await hook(this);
    }
  }

  public fill(data: Record<string, any>): void {
    const modelClass = this.constructor as typeof Model;
    const columns = modelClass.columns;
    const relations = modelClass.relations;
    
    // Ne copier que les colonnes définies
    columns.forEach((definition, columnName) => {
      if (columnName in data) {
        this._data[columnName] = data[columnName];
        const item: Record<string, any> = {}
        item[columnName] = data[columnName]
        Object.assign(this, item);
      }
    });

    relations.forEach((definition, relationName) => {
      if (relationName in data) {
        this._data[relationName] = data[relationName];
        const item: Record<string, any> = {}
        item[relationName] = data[relationName]
        Object.assign(this, item);
      }
    })
    
    
    // Gérer l'ID séparément car il vient de Entity
    if ('id' in data) {
      this.id = data.id;
    }
  }

  public get(key: string): any {
    return this._data[key];
  }

  public set(key: string, value: any): void {
    const modelClass = this.constructor as typeof Model;
    if (modelClass.columns.has(key) || modelClass.relations.has(key)) {
      this._data[key] = value;
      const item: Record<string, any> = {}
      item[key] = value
      Object.assign(this, item)
    }
  }

  getModelName(): string {
    return this.constructor.name;
  }

  public static get tableName(): string {
    return this.metadataStore.getModelDefinition(this.prototype.getModelName()).tableName;
  }

  public static get columns(): Map<string, ColumnDefinition> {
    return this.metadataStore.getModelDefinition(this.prototype.getModelName()).columns;
  }
  
  public static get relations(): Map<string, RelationDefinition> {
    return this.metadataStore.getModelDefinition(this.prototype.getModelName()).relations;
  }

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
  static async findById(id: string, options: QueryOptions = {}): Promise<InstanceType<typeof this> | null> {
    const query = `SELECT ${this.buildSelectClause(options)} FROM ${this.tableName} WHERE id = $1`;
    const result = await this.getConnection().query(query, [id], options);
    const data = result.rows[0] ? this.hydrate(result.rows[0]) : null;
    if (options.include && options.include.length > 0 && data !== null) {
      for (let relation of options.include) {
        await data.load(relation)
      }
    }
    return data;
  }

  static async findAll(conditions: object = {}, options: QueryOptions = {}): Promise<InstanceType<typeof this>[]> {
    const { query, params } = this.buildSelectQuery(conditions, options);
    const result = await this.getConnection().query(query, params, options);
    const models = result.rows.map(row => this.hydrate(row));

    if (options.include && options.include.length > 0) {
      for (const model of models) {
        for (const relationName of options.include) {
          await model.load(relationName);
        }
      }
    }

    return models
  }

  static async findAndCount(
    conditions: object = {}, 
    options: QueryOptions = {}
  ): Promise<{ 
    rows: InstanceType<typeof Model>[]; 
    total: number; 
  }> {
    // Prepare base options for queries
    const queryOptions = { ...options };
    
    // Remove limit and offset for count query
    const countOptions = { ...queryOptions };
    delete countOptions.limit;
    delete countOptions.offset;
  
    // Perform parallel queries
    const [rows, total] = await Promise.all([
      this.findAll(conditions, queryOptions),
      this.count(conditions, countOptions)
    ]);
  
    return { 
      rows, 
      total 
    };
  }

  static async createMany(dataArray: Record<string, any>[], options: QueryOptions = {}): Promise<InstanceType<typeof this>[]> {
    return this.transaction(async () => {
      const createdInstances: InstanceType<typeof this>[] = [];
      
      for (const data of dataArray) {
        const instance = new this(data);
        await instance.create(options);
        createdInstances.push(instance);
      }
      
      return createdInstances;
    });
  }

  static async count(
    conditions: object = {}, 
    options: QueryOptions = {}
  ): Promise<number> {
    const { query, params } = this.buildCountQuery(conditions, options);
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
  
    // Handle complex search conditions
    if (options.search) {
      const { fields = [], term = '', mode = 'like' } = options.search;
      
      if (term && fields.length > 0) {
        const searchConditions = fields.map(field => {
          switch (mode) {
            case 'like': return `${field} ILIKE $${paramCount}`;
            case 'exact': return `${field} = $${paramCount}`;
            case 'fulltext': return `to_tsvector(${field}) @@ to_tsquery($${paramCount})`;
            default: return `${field} ILIKE $${paramCount}`;
          }
        });
        
        whereClause.push(`(${searchConditions.join(' OR ')})`);
        params.push(`%${term}%`);
        paramCount++;
      }
    }
  
    // Handle additional filter conditions
    if (options.filter) {
      Object.entries(options.filter).forEach(([key, value]) => {
        if (value === null) {
          whereClause.push(`${key} IS NULL`);
        } else {
          whereClause.push(`${key} = $${paramCount}`);
          params.push(value);
          paramCount++;
        }
      });
    }
  
    // Original condition handling
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
  
    // Existing ORDER BY, LIMIT, OFFSET logic remains the same
    if (options.orderBy) {
      const orderClauses = Object.entries(options.orderBy)
        .map(([column, direction]) => `${column} ${direction}`);
      query += ` ORDER BY ${orderClauses.join(', ')}`;
    }
  
    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }
    if (options.offset) {
      query += ` OFFSET ${options.offset}`;
    }
  
    return { query, params };
  }

  private static buildCountQuery(
    conditions: object, 
    options: QueryOptions
  ): { query: string; params: any[] } {
    const whereClause: string[] = [];
    const params: any[] = [];
    let paramCount = 1;
  
    // Reuse search and filter logic from buildSelectQuery
    if (options.search) {
      const { fields = [], term = '', mode = 'like' } = options.search;
      
      if (term && fields.length > 0) {
        const searchConditions = fields.map(field => {
          switch (mode) {
            case 'like': return `${field} ILIKE $${paramCount}`;
            case 'exact': return `${field} = $${paramCount}`;
            case 'fulltext': return `to_tsvector(${field}) @@ to_tsquery($${paramCount})`;
            default: return `${field} ILIKE $${paramCount}`;
          }
        });
        
        whereClause.push(`(${searchConditions.join(' OR ')})`);
        params.push(`%${term}%`);
        paramCount++;
      }
    }
  
    // Handle additional filter conditions
    if (options.filter) {
      Object.entries(options.filter).forEach(([key, value]) => {
        if (value === null) {
          whereClause.push(`${key} IS NULL`);
        } else {
          whereClause.push(`${key} = $${paramCount}`);
          params.push(value);
          paramCount++;
        }
      });
    }
  
    // Original condition handling
    Object.entries(conditions).forEach(([key, value]) => {
      if (value === null) {
        whereClause.push(`${key} IS NULL`);
      } else {
        whereClause.push(`${key} = $${paramCount}`);
        params.push(value);
        paramCount++;
      }
    });
  
    let query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    
    if (whereClause.length) {
      query += ` WHERE ${whereClause.join(' AND ')}`;
    }
  
    return { query, params };
  }

  private static buildSelectClause(options: QueryOptions): string {
    if (options.select && options.select.length > 0) {
      return options.select.join(', ');
    }
    return '*';
  }

  private static hydrate(data: any): InstanceType<typeof this> {
    const instance = new this(data);
    Object.assign(instance, data);
    return instance;
  }

  private static buildDeleteQuery(conditions: object): { query: string; params: any[] } {
    const whereClause: string[] = [];
    const params: any[] = [];
    let paramCount = 1;
  
    Object.entries(conditions).forEach(([key, value]) => {
      if (value === null) {
        whereClause.push(`${key} IS NULL`);
      } else {
        whereClause.push(`${key} = $${paramCount}`);
        params.push(value);
        paramCount++;
      }
    });
  
    let query = `DELETE FROM ${this.tableName}`;
    
    if (whereClause.length) {
      query += ` WHERE ${whereClause.join(' AND ')}`;
    }
  
    return { query, params };
  }

  static async findOne(conditions: object = {}, options: QueryOptions = {}): Promise<InstanceType<typeof this> | null> {
    const { query, params } = this.buildSelectQuery(conditions, { ...options, limit: 1 });
    const result = await this.getConnection().query(query, params, options);
    return result.rows[0] ? this.hydrate(result.rows[0]) : null;
  }

  static async where(conditions: object, options: QueryOptions = {}): Promise<InstanceType<typeof this>[]> {
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

  public async create(options: QueryOptions = {}): Promise<void> {
    await this.executeHooks('beforeCreate');
    const modelClass = this.constructor as typeof Model;
    const data: Record<string, any> = this.toJSON();
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

    await this.executeHooks('afterCreate');
  }

  private async insert(options: QueryOptions = {}): Promise<void> {
    await this.executeHooks('beforeCreate');
    const data: Record<string, any> = this.toJSON();
    data.id = data.id || this._id || v4()

    const _columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

    const query = `
      INSERT INTO ${(this.constructor as typeof Model).tableName}
      (${_columns.join(', ')})
      VALUES (${placeholders})
      RETURNING id;`;

    const result = await (this.constructor as typeof Model).getConnection()
      .query(query, values, options);
      
    this.id = result.rows[0].id;

    await this.executeHooks('afterCreate');
  }

  public async update(options: QueryOptions = {}): Promise<void> {
    if (!this.id) {
      throw new Error('Cannot update model without ID');
    }

    await this.executeHooks('beforeUpdate');

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
    await modelClass.getConnection().query(query, [...values, this.id], options);

    await this.executeHooks('afterUpdate');
  }

  static async updateMany(conditions: object, updates: Record<string, any>, options: QueryOptions = {}): Promise<number> {
    const updateColumns = Object.keys(updates);
    const updateValues = Object.values(updates);
    const whereConditions = Object.keys(conditions);
    const whereValues = Object.values(conditions);
  
    let paramCount = 1;
    const setClause = updateColumns.map(col => `${col} = $${paramCount++}`).join(', ');
    const whereClause = whereConditions.map(col => `${col} = $${paramCount++}`).join(' AND ');
  
    const query = `
      UPDATE ${this.tableName}
      SET ${setClause}
      WHERE ${whereClause}
    `;
  
    const params = [...updateValues, ...whereValues];
    const result = await this.getConnection().query(query, params, options);
    return result.rowCount || 0;
  }

  async delete(options: QueryOptions = {}): Promise<void> {
    await this.executeHooks('beforeDelete');

    const query = `DELETE FROM ${(this.constructor as typeof Model).tableName} WHERE id = $1`;
    await (this.constructor as typeof Model).getConnection()
      .query(query, [this.id], options);
    
    await this.executeHooks('afterDelete');
  }

  static async deleteMany(conditions: object, options: QueryOptions = {}): Promise<number> {
    const { query, params } = this.buildDeleteQuery(conditions);
    const result = await this.getConnection().query(query, params, options);
    return result.rowCount || 0;
  }

  // Gestion des transactions
  static async transaction<T>(callback: () => Promise<T>): Promise<T> {
    return this.getConnection().withTransaction(callback);
  }

  // _relations améliorées
  async load(relationName: string, options: QueryOptions = {}): Promise<Model | Model[] | null> {
    const modelConstructor = this.constructor as typeof Model;
    const modelDefinition = modelConstructor.metadataStore.getAllModels().get(modelConstructor.name);
    if (!modelDefinition) {
      throw new Error(`Model definition for ${modelConstructor.name} not found`);
    }
    const relation = modelDefinition.relations.get(relationName);
    
    if (!relation) {
      throw new Error(`Relation ${relationName} not found`);
    }

    const thisKey = `${this.getModelName().toLowerCase()}s_id`;

    switch (relation.type) {
      case 'hasOne':
        return Model.loadHasOne(this, relation, options);
      case 'hasMany':
        return Model.loadHasMany(this, relation, options);
      case 'belongsTo':
        return Model.loadBelongsTo(this, relation, options);
      case 'belongsToMany':
        return Model.loadBelongsToMany(this, thisKey, relation, options);
    }
  }

  private static async loadHasOne(instance: Model, relation: RelationDefinition, options: QueryOptions): Promise<Model | null> {
    const RelatedModel = relation.model();
    const foreignKey = relation.foreignKey || `${this.name.toLowerCase()}_id`;
    const data = RelatedModel.findOne({ [foreignKey]: instance.id }, options);
    instance.set(relation.propertyKey, await data);
    return data;
  }

  private static async loadHasMany(instance: Model, relation: RelationDefinition, options: QueryOptions): Promise<Model[]> {
    const RelatedModel = relation.model();
    const foreignKey = relation.foreignKey || `${this.name.toLowerCase()}_id`;
    const data = RelatedModel.where({ [foreignKey]: instance.id }, options);
    instance.set(relation.propertyKey, await data);
    return data;
  }

  private static async loadBelongsTo(instance: Model, relation: RelationDefinition, options: QueryOptions): Promise<Model | null> {
    const RelatedModel = relation.model();
    const foreignKey = relation.foreignKey || `${RelatedModel.name.toLowerCase()}_id`;
    const data = RelatedModel.findById((instance as any)[foreignKey], options);
    instance.set(relation.propertyKey, await data);
    return data;
  }

  private static async loadBelongsToMany(instance: Model, thisKey: string, relation: RelationDefinition, options: QueryOptions): Promise<Model[]> {
    if (!relation.through) {
      throw new Error('Through table is required for belongsToMany relation');
    }
    const RelatedModel = relation.model();
    const relatedKey = `${RelatedModel.name.toLowerCase()}s_id`;

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
    const data = result.rows.map(row => RelatedModel.hydrate(row));
    instance.set(relation.propertyKey, data);
    return data;
  }

  // Relations Management Methods
  async attach(relationName: string, ids: string | string[]): Promise<void> {
    const modelClass = this.constructor as typeof Model;
    const relation = modelClass.relations.get(relationName);

    if (!relation || relation.type !== 'belongsToMany') {
      throw new Error(`Relation ${relationName} not found or is not a many-to-many relation`);
    }

    if (!relation.through) {
      throw new Error('Through table is required for belongsToMany relation');
    }

    const RelatedModel = relation.model();
    const thisKey = `${modelClass.name.toLowerCase()}s_id`;
    const relatedKey = `${RelatedModel.name.toLowerCase()}s_id`;
    
    const idsArray = Array.isArray(ids) ? ids : [ids];
    
    // Begin transaction
    await modelClass.transaction(async () => {
      for (const id of idsArray) {
        await modelClass.getConnection().query(
          `INSERT INTO ${relation.through} (${thisKey}, ${relatedKey}) 
           VALUES ($1, $2) 
           ON CONFLICT (${thisKey}, ${relatedKey}) DO NOTHING`,
          [this.id, id]
        );
      }
    });
  }

  async detach(relationName: string, ids?: string | string[]): Promise<void> {
    const modelClass = this.constructor as typeof Model;
    const relation = modelClass.relations.get(relationName);

    if (!relation || relation.type !== 'belongsToMany') {
      throw new Error(`Relation ${relationName} not found or is not a many-to-many relation`);
    }

    if (!relation.through) {
      throw new Error('Through table is required for belongsToMany relation');
    }

    const RelatedModel = relation.model();
    const thisKey = `${modelClass.name.toLowerCase()}_id`;
    const relatedKey = `${RelatedModel.name.toLowerCase()}_id`;

    let query = `DELETE FROM ${relation.through} WHERE ${thisKey} = $1`;
    let params = [this.id];

    if (ids) {
      const idsArray = Array.isArray(ids) ? ids : [ids];
      const placeholders = idsArray.map((_, index) => `$${index + 2}`).join(', ');
      query += ` AND ${relatedKey} IN (${placeholders})`;
      params = params.concat(idsArray);
    }

    await modelClass.getConnection().query(query, params);
  }

  async sync(relationName: string, ids: string[]): Promise<void> {
    const modelClass = this.constructor as typeof Model;
    const relation = modelClass.relations.get(relationName);

    if (!relation || relation.type !== 'belongsToMany') {
      throw new Error(`Relation ${relationName} not found or is not a many-to-many relation`);
    }

    await modelClass.transaction(async () => {
      // Remove all existing relations
      await this.detach(relationName);
      // Add new relations
      if (ids.length > 0) {
        await this.attach(relationName, ids);
      }
    });
  }

  async isAttached(relationName: string, id: string): Promise<boolean> {
    const modelClass = this.constructor as typeof Model;
    const relation = modelClass.relations.get(relationName);

    if (!relation || relation.type !== 'belongsToMany') {
      throw new Error(`Relation ${relationName} not found or is not a many-to-many relation`);
    }

    if (!relation.through) {
      throw new Error('Through table is required for belongsToMany relation');
    }

    const RelatedModel = relation.model();
    const thisKey = `${modelClass.name.toLowerCase()}_id`;
    const relatedKey = `${RelatedModel.name.toLowerCase()}_id`;

    const result = await modelClass.getConnection().query(
      `SELECT COUNT(*) as count FROM ${relation.through} 
       WHERE ${thisKey} = $1 AND ${relatedKey} = $2`,
      [this.id, id]
    );

    return parseInt(result.rows[0].count) > 0;
  }


  toJSON(): object {
    const modelClass = this.constructor as typeof Model;
    const result: Record<string, any> = {};

    // Inclure toutes les colonnes définies
    modelClass.columns.forEach((definition, columnName) => {
      result[columnName] = this._data[columnName];
    });

    //Inclure les relations définies
    modelClass.relations.forEach((definition, relationName) => {
      if (this._data[relationName]) {
        result[relationName] = this._data[relationName]
      }
    })

    // Ajouter l'ID s'il existe
    if (this.id) {
      result.id = this.id;
    }

    return result;
  }

  toString(): string{
    const result = this.toJSON()
    return JSON.stringify(result)
  }
}