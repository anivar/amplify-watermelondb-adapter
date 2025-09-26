import { ConsoleLogger } from '@aws-amplify/core';
import {
	InternalSchema,
	ModelFieldType,
	ModelInstanceCreator,
	ModelPredicate,
	NAMESPACES,
	NamespaceResolver,
	OpType,
	PaginationInput,
	PersistentModel,
	PersistentModelConstructor,
	QueryOne,
	SchemaModel,
} from '@aws-amplify/datastore';

// WatermelonDB types (imported dynamically)
type WatermelonModelClass = typeof import('@nozbe/watermelondb/Model').default;

const logger = new ConsoleLogger('WatermelonDBAdapter');

// Type definitions for WatermelonDB
interface WatermelonDatabase {
	adapter: WatermelonAdapter;
	collections: Map<string, WatermelonCollection>;
	batch(...operations: WatermelonOperation[]): Promise<void>;
	write<T>(work: () => Promise<T>): Promise<T>;
	read<T>(work: () => Promise<T>): Promise<T>;
	localStorage: {
		get(key: string): Promise<string | null>;
		set(key: string, value: string): Promise<void>;
		remove(key: string): Promise<void>;
	};
}

interface WatermelonAdapter {
	schema: any;
	migrations?: any;
	dbName: string;
	unsafeResetDatabase(): Promise<void>;
}

interface WatermelonCollection {
	find(id: string): Promise<WatermelonModel>;
	query(...conditions: any[]): WatermelonQuery;
	create(prepareCreate: (model: WatermelonModel) => void): Promise<WatermelonModel>;
	modelClass: any;
}

interface WatermelonQuery {
	fetch(): Promise<WatermelonModel[]>;
	fetchCount(): Promise<number>;
	observe(): any; // Observable
	observeCount(): any; // Observable
}

interface WatermelonOperation {
	type: 'create' | 'update' | 'markAsDeleted' | 'destroyPermanently';
	record?: WatermelonModel;
	collection?: string;
	prepareCreate?: (model: WatermelonModel) => void;
}

interface WatermelonModel {
	id: string;
	_raw: any;
	collection: any;
	update(updater: (model: any) => void): Promise<void>;
	markAsDeleted(): Promise<void>;
	destroyPermanently(): Promise<void>;
	observe(): any; // Observable
}

type DispatcherType = 'jsi' | 'asynchronous' | 'loki' | 'sqlite-node';

export interface WatermelonDBAdapterConfig {
	database?: WatermelonDatabase;
	conflictStrategy?: 'ACCEPT_REMOTE' | 'RETRY_LOCAL';
	cacheMaxSize?: number;
	cacheTTL?: number;
	batchSize?: number;
}

/**
 * WatermelonDB Adapter for DataStore
 *
 * This adapter provides integration between AWS Amplify DataStore and WatermelonDB,
 * leveraging WatermelonDB's reactive database architecture and internal APIs for
 * optimal performance and compatibility.
 *
 * Features:
 * - Automatic dispatcher selection (JSI → SQLite → LokiJS → In-Memory)
 * - Direct usage of WatermelonDB's internal APIs
 * - Full DataStore compatibility
 * - Cross-platform support (React Native, Web, Node.js)
 */
export class WatermelonDBAdapter {
	private db: WatermelonDatabase | undefined;
	private schema: InternalSchema | undefined;
	private namespaceResolver: NamespaceResolver | undefined;
	private modelInstanceCreator: ModelInstanceCreator | undefined;
	private adapter: WatermelonAdapter | undefined;
	private _dispatcherType: DispatcherType = 'jsi';
	private isInitialized = false;
	private collections = new Map<string, WatermelonCollection>();
	private models = new Map<string, WatermelonModelClass>();
	private queryCache = new Map<string, { result: any; timestamp: number }>();
	private readonly cacheTTL: number;
	private readonly maxCacheSize: number;
	private readonly conflictStrategy: 'ACCEPT_REMOTE' | 'RETRY_LOCAL';
	private readonly batchSize: number;
	private Q: typeof import('@nozbe/watermelondb/QueryDescription') | undefined;
	private subscriptions = new Set<any>();

	constructor(config: WatermelonDBAdapterConfig = {}) {
		this.cacheTTL = config.cacheTTL || 5 * 60 * 1000; // 5 minutes
		this.maxCacheSize = config.cacheMaxSize || 100;
		this.conflictStrategy = config.conflictStrategy || 'ACCEPT_REMOTE';
		this.batchSize = config.batchSize || 1000;

		if (config.database) {
			this.db = config.database;
			this.adapter = config.database.adapter;
		}

		// Import Q operators
		try {
			this.Q = require('@nozbe/watermelondb/QueryDescription');
		} catch (error) {
			logger.warn('WatermelonDB Q operators not available', error);
		}
	}

	/**
	 * Setup adapter with DataStore configuration
	 * Following Amplify's adapter pattern
	 */
	public async setup(
		theSchema: InternalSchema,
		namespaceResolver: NamespaceResolver,
		modelInstanceCreator: ModelInstanceCreator,
		getModelConstructorByModelName: (
			namsespaceName: NAMESPACES,
			modelName: string,
		) => PersistentModelConstructor<any>,
		sessionId?: string,
	): Promise<void> {
		if (this.isInitialized) {
			logger.debug('Adapter already initialized');

			return;
		}

		this.schema = theSchema;
		this.namespaceResolver = namespaceResolver;
		this.modelInstanceCreator = modelInstanceCreator;

		await this.initializeAdapter();
	}

	/**
	 * Initialize WatermelonDB with optimal adapter
	 */
	private async initializeAdapter(): Promise<void> {
		try {
			const WatermelonDB = require('@nozbe/watermelondb');
			const { Database } = WatermelonDB;

			// Create optimal adapter for platform
			this.adapter = await this.createOptimalAdapter();

			// Create database instance
			this.db = new Database({
				adapter: this.adapter,
				modelClasses: await this.createModelClasses(),
			});

			// Register collections
			this.registerCollections();

			this.isInitialized = true;
			logger.debug(
				`WatermelonDB initialized with ${this._dispatcherType} dispatcher`,
			);
		} catch (error) {
			logger.error('Failed to initialize WatermelonDB', error);
			throw error;
		}
	}

	/**
	 * Create optimal adapter based on platform
	 * Following WatermelonDB's dispatcher pattern from source
	 */
	private async createOptimalAdapter(): Promise<any> {
		const schema = this.buildWatermelonSchema();

		// Try adapters in order of preference
		const adapterStrategies = [
			{ name: 'jsi', createFn: () => this.createJSIAdapter(schema) },
			{
				name: 'asynchronous',
				createFn: () => this.createSQLiteAdapter(schema),
			},
			{ name: 'loki', createFn: () => this.createLokiAdapter(schema) },
			{ name: 'sqlite-node', createFn: () => this.createNodeAdapter(schema) },
		];

		for (const strategy of adapterStrategies) {
			try {
				const adapter = await strategy.createFn();
				this._dispatcherType = strategy.name as DispatcherType;
				logger.debug(`Using ${strategy.name} adapter`);

				return adapter;
			} catch (error) {
				logger.debug(`${strategy.name} adapter not available`, error);
			}
		}

		// Fallback to minimal in-memory adapter
		logger.warn('Using in-memory adapter - data will not persist');

		return this.createInMemoryAdapter(schema);
	}

	/**
	 * Create JSI SQLite adapter for React Native
	 */
	private async createJSIAdapter(schema: any): Promise<any> {
		const SQLiteAdapter =
			require('@nozbe/watermelondb/adapters/sqlite').default;

		const adapter = new SQLiteAdapter({
			schema,
			dbName: this.getDatabaseName(),
			migrations: this.createMigrations(),
			jsi: true,
			synchronous: true,
			experimentalUseJSI: true,
			onSetUpError: (error: any) => {
				logger.error('JSI SQLite setup error:', error);
				throw error;
			},
		});

		if (adapter.initializingPromise) {
			await adapter.initializingPromise;
		}

		return adapter;
	}

	/**
	 * Create standard SQLite adapter
	 */
	private async createSQLiteAdapter(schema: any): Promise<any> {
		const SQLiteAdapter =
			require('@nozbe/watermelondb/adapters/sqlite').default;

		const adapter = new SQLiteAdapter({
			schema,
			dbName: this.getDatabaseName(),
			migrations: this.createMigrations(),
			jsi: false,
		});

		if (adapter.initializingPromise) {
			await adapter.initializingPromise;
		}

		return adapter;
	}

	/**
	 * Create LokiJS adapter for web
	 */
	private async createLokiAdapter(schema: any): Promise<any> {
		const LokiJSAdapter =
			require('@nozbe/watermelondb/adapters/lokijs').default;

		return new LokiJSAdapter({
			schema,
			dbName: this.getDatabaseName(),
			useWebWorker: false,
			useIncrementalIndexedDB: true,
			extraIncrementalIDBOptions: {
				onFetchStart: () => {
					logger.debug('IndexedDB fetch started');
				},
			},
		});
	}

	/**
	 * Create Node.js SQLite adapter
	 */
	private async createNodeAdapter(schema: any): Promise<any> {
		// For Node.js environment with better-sqlite3
		const SQLiteAdapter =
			require('@nozbe/watermelondb/adapters/sqlite').default;

		return new SQLiteAdapter({
			schema,
			dbName: this.getDatabaseName(),
			migrations: this.createMigrations(),
		});
	}

	/**
	 * Create minimal in-memory adapter
	 */
	private createInMemoryAdapter(schema: any): any {
		return {
			schema,
			dbName: this.getDatabaseName(),
			find: async () => null,
			query: async () => [],
			batch: async (operations: any[]) => {
				// In-memory batch operations
				for (const op of operations) {
					if (op.type === 'create') {
						// Handle in-memory create
					} else if (op.type === 'update') {
						// Handle in-memory update
					} else if (op.type === 'delete') {
						// Handle in-memory delete
					}
				}
			},
			unsafeResetDatabase: async () => {
				// Clear in-memory data
				this.collections.clear();
				this.models.clear();
				this.queryCache.clear();
			},
		};
	}

	/**
	 * Build WatermelonDB schema from DataStore schema
	 */
	private buildWatermelonSchema(): any {
		if (!this.schema) {
			return { version: 1, tables: [] };
		}

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { appSchema, tableSchema } = require('@nozbe/watermelondb/Schema');

		const tables: any[] = [];
		const userModels = this.schema.namespaces?.user?.models || {};

		for (const [modelName, model] of Object.entries(userModels)) {
			const table = this.buildTableSchema(modelName, model as SchemaModel);
			if (table) {
				tables.push(table);
			}
		}

		// Add metadata table for DataStore
		tables.push(this.buildMetadataTable());

		return appSchema({
			version: this.schema.version || 1,
			tables,
		});
	}

	/**
	 * Build table schema for a model
	 */
	private buildTableSchema(modelName: string, model: SchemaModel): any {
		const { tableSchema } = require('@nozbe/watermelondb/Schema');

		const columns: any[] = [];

		for (const [fieldName, field] of Object.entries(model.fields)) {
			if (fieldName === 'id') continue;

			columns.push({
				name: this.toSnakeCase(fieldName),
				type: this.mapFieldType(field.type as ModelFieldType),
				isOptional: !field.isRequired,
				isIndexed: this.shouldIndexField(fieldName, field),
			});
		}

		// Add DataStore sync fields
		columns.push(
			{ name: '_version', type: 'number', isOptional: true, isIndexed: true },
			{
				name: '_last_changed_at',
				type: 'number',
				isOptional: true,
				isIndexed: true,
			},
			{ name: '_deleted', type: 'boolean', isOptional: true, isIndexed: true },
			{ name: 'created_at', type: 'number', isOptional: true },
			{ name: 'updated_at', type: 'number', isOptional: true },
		);

		return tableSchema({
			name: this.getTableName(modelName),
			columns,
		});
	}

	/**
	 * Build metadata table for DataStore
	 */
	private buildMetadataTable(): any {
		const { tableSchema } = require('@nozbe/watermelondb/Schema');

		return tableSchema({
			name: 'datastore_metadata',
			columns: [
				{ name: 'namespace', type: 'string' },
				{ name: 'model', type: 'string' },
				{ name: 'last_sync', type: 'number', isOptional: true },
				{ name: 'sync_status', type: 'string', isOptional: true },
			],
		});
	}

	/**
	 * Create model classes with WatermelonDB decorators
	 */
	private async createModelClasses(): Promise<any[]> {
		if (!this.schema) {
			return [];
		}

		const { Model } = require('@nozbe/watermelondb');
		const decorators = require('@nozbe/watermelondb/decorators');

		const modelClasses: any[] = [];
		const userModels = this.schema.namespaces?.user?.models || {};

		for (const [modelName, modelSchema] of Object.entries(userModels)) {
			const tableName = this.getTableName(modelName);

			// Create dynamic model class
			class DynamicModel extends Model {
				static table = tableName;
				static associations = this.buildAssociations(
					modelSchema as SchemaModel,
				);
			}

			// Set proper name for debugging
			Object.defineProperty(DynamicModel, 'name', { value: modelName });

			// Add fields using decorators
			this.addFieldDecorators(
				DynamicModel,
				modelSchema as SchemaModel,
				decorators,
			);

			modelClasses.push(DynamicModel);
			this.models.set(tableName, DynamicModel as any);
		}

		return modelClasses;
	}

	/**
	 * Add field decorators to model class
	 */
	private addFieldDecorators(
		ModelClass: any,
		schema: SchemaModel,
		decorators: any,
	): void {
		const { field, text, date, relation, children, readonly } = decorators;

		for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
			if (fieldName === 'id') continue;

			const columnName = this.toSnakeCase(fieldName);

			if (fieldDef.association) {
				// Handle relationships
				const assocTarget =
					(fieldDef.association as any).associatedWith ||
					(fieldDef.association as any).targetName;
				if (fieldDef.association.connectionType === 'BELONGS_TO') {
					Object.defineProperty(
						ModelClass.prototype,
						fieldName,
						relation(assocTarget, `${columnName}_id`),
					);
				} else if (fieldDef.association.connectionType === 'HAS_MANY') {
					Object.defineProperty(
						ModelClass.prototype,
						fieldName,
						children(assocTarget),
					);
				}
			} else {
				// Handle regular fields
				const decorator = this.getFieldDecorator(fieldDef, decorators);
				Object.defineProperty(
					ModelClass.prototype,
					fieldName,
					decorator(columnName),
				);
			}
		}

		// Add sync fields
		Object.defineProperty(
			ModelClass.prototype,
			'_version',
			readonly(field('_version')),
		);
		Object.defineProperty(
			ModelClass.prototype,
			'_deleted',
			readonly(field('_deleted')),
		);
		Object.defineProperty(
			ModelClass.prototype,
			'_lastChangedAt',
			readonly(field('_last_changed_at')),
		);
		Object.defineProperty(
			ModelClass.prototype,
			'createdAt',
			readonly(date('created_at')),
		);
		Object.defineProperty(
			ModelClass.prototype,
			'updatedAt',
			date('updated_at'),
		);
	}

	/**
	 * Get appropriate field decorator
	 */
	private getFieldDecorator(fieldDef: any, decorators: any): any {
		const { field, text, date } = decorators;

		switch (fieldDef.type) {
			case 'String':
			case 'ID':
			case 'AWSJSON':
			case 'AWSURL':
			case 'AWSEmail':
			case 'AWSPhone':
				return text;
			case 'AWSDateTime':
			case 'AWSDate':
			case 'AWSTime':
			case 'AWSTimestamp':
				return date;
			default:
				return field;
		}
	}

	/**
	 * Build associations configuration
	 */
	private buildAssociations(model: SchemaModel): any {
		const associations: any = {};

		for (const [fieldName, field] of Object.entries(model.fields)) {
			if (field.association) {
				const { connectionType } = field.association;
				const associatedWith =
					(field.association as any).associatedWith ||
					(field.association as any).targetName;

				if (connectionType === 'HAS_MANY') {
					associations[fieldName] = {
						type: 'has_many',
						foreignKey: `${this.toSnakeCase(fieldName)}_id`,
					};
				} else if (connectionType === 'BELONGS_TO') {
					associations[fieldName] = {
						type: 'belongs_to',
						key: `${this.toSnakeCase(fieldName)}_id`,
					};
				}
			}
		}

		return associations;
	}

	/**
	 * Register collections after database initialization
	 */
	private registerCollections(): void {
		if (!this.db) return;

		for (const [tableName, modelClass] of this.models) {
			try {
				const collection = this.db.collections.get(tableName);
				if (collection) {
					this.collections.set(tableName, collection);
					logger.debug(`Registered collection: ${tableName}`);
				}
			} catch (error) {
				logger.warn(`Failed to register collection: ${tableName}`, error);
			}
		}
	}

	/**
	 * Create migrations configuration
	 */
	private createMigrations(): any {
		if (!this.schema?.version || this.schema.version === '1') {
			return undefined;
		}

		// Return migrations configuration
		// This would need to be expanded based on actual schema changes
		return {
			migrations: [],
		};
	}

	/**
	 * Query records from storage
	 */
	public async query<T extends PersistentModel>(
		modelConstructor: PersistentModelConstructor<T>,
		predicate?: ModelPredicate<T>,
		pagination?: PaginationInput<T>,
	): Promise<T[]> {
		await this.ensureInitialized();

		const tableName = this.getTableName(modelConstructor.name);
		const collection = this.collections.get(tableName);

		if (!collection) {
			logger.warn(`Collection not found: ${tableName}`);

			return [];
		}

		// Check cache first
		const cacheKey = this.getCacheKey(tableName, predicate, pagination);
		const cachedResult = this.getFromCache<T[]>(cacheKey);
		if (cachedResult !== null) {
			return cachedResult;
		}

		// Build and execute query
		const query = this.buildQuery(collection, predicate, pagination);
		const records = await query.fetch();

		// Convert to DataStore models
		const results = records.map((record: any) =>
			this.convertToDataStoreModel(record, modelConstructor),
		);

		// Cache results
		this.setCache(cacheKey, results);

		return results;
	}

	/**
	 * Save model to storage
	 */
	public async save<T extends PersistentModel>(
		model: T,
		condition?: ModelPredicate<T>,
	): Promise<[T, OpType]> {
		await this.ensureInitialized();

		const modelName = model.constructor.name;
		const tableName = this.getTableName(modelName);
		const collection = this.collections.get(tableName);

		if (!collection) {
			throw new Error(`Collection not found: ${tableName}`);
		}

		// Clear cache for this table
		this.invalidateTableCache(tableName);

		// Perform save within writer transaction
		const result = await this.db!.write(async () => {
			let record;
			let opType: OpType = OpType.INSERT;

			try {
				record = await collection.find(model.id);
				opType = OpType.UPDATE;
			} catch (error) {
				// Record doesn't exist, will create
			}

			if (record) {
				// Update existing record
				await record.update((r: any) => {
					this.copyModelToRecord(model, r);
				});
			} else {
				// Create new record
				record = await collection.create((r: any) => {
					r._raw.id = model.id;
					this.copyModelToRecord(model, r);
				});
			}

			return { record, opType };
		});

		const savedModel = this.convertToDataStoreModel(
			result.record,
			model.constructor as PersistentModelConstructor<T>,
		);

		return [savedModel, result.opType];
	}

	/**
	 * Delete model(s) from storage
	 */
	public async delete<T extends PersistentModel>(
		modelOrConstructor: T | PersistentModelConstructor<T>,
		condition?: ModelPredicate<T>,
	): Promise<[T[], T[]]> {
		await this.ensureInitialized();

		const modelConstructor = this.getModelConstructor(modelOrConstructor);
		const tableName = this.getTableName(modelConstructor.name);
		const collection = this.collections.get(tableName);

		if (!collection) {
			throw new Error(`Collection not found: ${tableName}`);
		}

		// Clear cache for this table
		this.invalidateTableCache(tableName);

		const deletedModels: T[] = [];

		await this.db!.write(async () => {
			let records;

			if (this.isModelInstance(modelOrConstructor)) {
				// Delete specific instance
				records = [await collection.find((modelOrConstructor as T).id)];
			} else {
				// Delete by query
				const query = this.buildQuery(collection, condition);
				records = await query.fetch();
			}

			// Convert records before deletion
			for (const record of records) {
				deletedModels.push(
					this.convertToDataStoreModel(record, modelConstructor),
				);

				// Mark as deleted or destroy
				if ((this.schema as any)?.syncable) {
					await record.markAsDeleted();
				} else {
					await record.destroyPermanently();
				}
			}
		});

		return [deletedModels, []]; // Second array is for failed deletions
	}

	/**
	 * Query a single record by ID
	 */
	public async queryOne<T extends PersistentModel>(
		modelConstructor: PersistentModelConstructor<T>,
		firstOrLast: QueryOne,
	): Promise<T | undefined> {
		await this.ensureInitialized();

		const tableName = this.getTableName(modelConstructor.name);
		const collection = this.collections.get(tableName);

		if (!collection) {
			return undefined;
		}

		const query = collection.query();
		const records = await query.fetch();

		if (records.length === 0) {
			return undefined;
		}

		const record =
			firstOrLast === QueryOne.FIRST ? records[0] : records[records.length - 1];

		return this.convertToDataStoreModel(record, modelConstructor);
	}

	/**
	 * Clear all data and clean up resources
	 */
	public async clear(): Promise<void> {
		await this.ensureInitialized();

		// Stop all observations first
		this.stopObserve();

		await this.db!.write(async () => {
			for (const collection of this.collections.values()) {
				const records = await collection.query().fetch();
				await Promise.all(records.map((r: any) => r.destroyPermanently()));
			}
		});

		this.queryCache.clear();
		logger.debug('All data cleared and resources cleaned up');
	}

	/**
	 * Batch save operations
	 */
	public async batchSave<T extends PersistentModel>(
		modelConstructor: PersistentModelConstructor<T>,
		models: T[],
	): Promise<[T[], OpType[]]> {
		await this.ensureInitialized();

		const tableName = this.getTableName(modelConstructor.name);
		const collection = this.collections.get(tableName);

		if (!collection) {
			throw new Error(`Collection not found: ${tableName}`);
		}

		// Clear cache
		this.invalidateTableCache(tableName);

		const savedModels: T[] = [];
		const opTypes: OpType[] = [];

		await this.db!.write(async () => {
			for (const model of models) {
				let record;
				let opType: OpType = OpType.INSERT;

				try {
					record = await collection.find(model.id);
					opType = OpType.UPDATE;
				} catch (error) {
					// Record doesn't exist
				}

				if (record) {
					await record.update((r: any) => {
						this.copyModelToRecord(model, r);
					});
				} else {
					record = await collection.create((r: any) => {
						r._raw.id = model.id;
						this.copyModelToRecord(model, r);
					});
				}

				savedModels.push(
					this.convertToDataStoreModel(record, modelConstructor),
				);
				opTypes.push(opType);
			}
		});

		return [savedModels, opTypes];
	}

	/**
	 * Build WatermelonDB query from DataStore predicate
	 */
	private buildQuery(
		collection: any,
		predicate?: ModelPredicate<any>,
		pagination?: PaginationInput<any>,
	): any {
		const conditions: any[] = [];

		// Process predicate
		if (predicate && this.Q) {
			const predicateConditions = this.translatePredicate(predicate);
			conditions.push(...predicateConditions);
		}

		// Process pagination
		if (pagination && this.Q) {
			if (pagination.limit) {
				conditions.push(this.Q.take(pagination.limit));
			}
			if (pagination.page && pagination.limit) {
				conditions.push(this.Q.skip(pagination.page * pagination.limit));
			}
			if (pagination.sort) {
				const sortConditions = this.translateSort(pagination.sort);
				conditions.push(...sortConditions);
			}
		}

		return collection.query(...conditions);
	}

	/**
	 * Translate DataStore predicate to WatermelonDB conditions
	 */
	private translatePredicate(predicate: ModelPredicate<any>): any[] {
		const conditions: any[] = [];

		if (typeof predicate === 'function') {
			// Execute predicate function with builder
			const predicateBuilder = this.createPredicateBuilder();
			const predicateObj = (predicate as any)(predicateBuilder);

			if (predicateObj) {
				const translated = this.translatePredicateObject(predicateObj);
				conditions.push(...translated);
			}
		}

		return conditions;
	}

	/**
	 * Create DataStore-compatible predicate builder
	 */
	private createPredicateBuilder(): any {
		const { Q } = this;

		return new Proxy(
			{},
			{
				get: (target, fieldName: string) => {
					if (typeof fieldName !== 'string') return undefined;

					const columnName = this.toSnakeCase(fieldName);

					const Q = this.Q;
					if (!Q) {
						throw new Error('WatermelonDB Q operators not initialized');
					}

					return {
						eq: (value: any) => Q.where(columnName, value),
						ne: (value: any) => Q.where(columnName, Q.notEq(value)),
						gt: (value: any) => Q.where(columnName, Q.gt(value)),
						ge: (value: any) => Q.where(columnName, Q.gte(value)),
						lt: (value: any) => Q.where(columnName, Q.lt(value)),
						le: (value: any) => Q.where(columnName, Q.lte(value)),
						contains: (value: string) =>
							Q.where(columnName, Q.like(`%${value}%`)),
						notContains: (value: string) =>
							Q.where(columnName, Q.notLike(`%${value}%`)),
						beginsWith: (value: string) =>
							Q.where(columnName, Q.like(`${value}%`)),
						between: (min: any, max: any) =>
							Q.where(columnName, Q.between(min, max)),
						in: (values: any[]) => Q.where(columnName, Q.oneOf(values)),
						notIn: (values: any[]) => Q.where(columnName, Q.notIn(values)),
					};
				},
			},
		);
	}

	/**
	 * Translate predicate object recursively
	 */
	private translatePredicateObject(predicateObj: any): any[] {
		const conditions: any[] = [];
		const { Q } = this;

		if (!Q) {
			throw new Error('WatermelonDB Q operators not initialized');
		}

		if ((predicateObj as any).type === 'and') {
			const subConditions = (predicateObj as any).predicates
				.map((p: any) => this.translatePredicateObject(p))
				.flat();
			if (subConditions.length > 0) {
				conditions.push(Q.and(...subConditions));
			}
		} else if ((predicateObj as any).type === 'or') {
			const subConditions = (predicateObj as any).predicates
				.map((p: any) => this.translatePredicateObject(p))
				.flat();
			if (subConditions.length > 0) {
				conditions.push(Q.or(...subConditions));
			}
		} else {
			// Handle field predicates
			for (const [fieldName, condition] of Object.entries(predicateObj)) {
				if (typeof condition === 'object' && condition !== null) {
					const columnName = this.toSnakeCase(fieldName);
					const watermelonCondition = this.translateCondition(
						columnName,
						condition,
					);
					if (watermelonCondition) {
						conditions.push(watermelonCondition);
					}
				}
			}
		}

		return conditions;
	}

	/**
	 * Translate individual field condition
	 */
	private translateCondition(columnName: string, condition: any): any {
		const { Q } = this;

		if (!Q) {
			throw new Error('WatermelonDB Q operators not initialized');
		}

		if (condition.eq !== undefined) {
			return Q.where(columnName, condition.eq);
		}
		if (condition.ne !== undefined) {
			return Q.where(columnName, Q.notEq(condition.ne));
		}
		if (condition.gt !== undefined) {
			return Q.where(columnName, Q.gt(condition.gt));
		}
		if (condition.ge !== undefined) {
			return Q.where(columnName, Q.gte(condition.ge));
		}
		if (condition.lt !== undefined) {
			return Q.where(columnName, Q.lt(condition.lt));
		}
		if (condition.le !== undefined) {
			return Q.where(columnName, Q.lte(condition.le));
		}
		if (condition.contains !== undefined) {
			return Q.where(columnName, Q.like(`%${condition.contains}%`));
		}
		if (condition.notContains !== undefined) {
			return Q.where(columnName, Q.notLike(`%${condition.notContains}%`));
		}
		if (condition.beginsWith !== undefined) {
			return Q.where(columnName, Q.like(`${condition.beginsWith}%`));
		}
		if (condition.between !== undefined && Array.isArray(condition.between)) {
			const [min, max] = condition.between;

			return Q.where(columnName, Q.between(min, max));
		}
		if (condition.in !== undefined && Array.isArray(condition.in)) {
			return Q.where(columnName, Q.oneOf(condition.in));
		}
		if (condition.notIn !== undefined && Array.isArray(condition.notIn)) {
			return Q.where(columnName, Q.notIn(condition.notIn));
		}

		logger.warn(`Unsupported condition for ${columnName}:`, condition);

		return null;
	}

	/**
	 * Translate sort configuration
	 */
	private translateSort(sort: any): any[] {
		const conditions: any[] = [];
		const { Q } = this;

		if (!Q) {
			throw new Error('WatermelonDB Q operators not initialized');
		}

		if (typeof sort === 'function') {
			const sortBuilder = {};
			const sortConfig = sort(sortBuilder);

			if (sortConfig && sortConfig.field) {
				const columnName = this.toSnakeCase(sortConfig.field);
				const order = sortConfig.direction === 'DESCENDING' ? Q.desc : Q.asc;
				conditions.push(Q.sortBy(columnName, order));
			}
		}

		return conditions;
	}

	/**
	 * Copy model fields to WatermelonDB record
	 */
	private copyModelToRecord(model: any, record: any): void {
		for (const [key, value] of Object.entries(model)) {
			if (key === 'id' || key === 'constructor') continue;

			const columnName = this.toSnakeCase(key);

			// Handle special fields
			if (
				key === '_version' ||
				key === '_deleted' ||
				key === '_lastChangedAt'
			) {
				record._raw[columnName] = value;
			} else {
				// Try to set on record, fallback to _raw
				try {
					record[columnName] = value;
				} catch (error) {
					record._raw[columnName] = value;
				}
			}
		}

		// Set timestamps
		const now = Date.now();
		if (!record._raw.created_at) {
			record._raw.created_at = now;
		}
		record._raw.updated_at = now;
	}

	/**
	 * Convert WatermelonDB record to DataStore model
	 */
	private convertToDataStoreModel<T extends PersistentModel>(
		record: any,
		modelConstructor: PersistentModelConstructor<T>,
	): T {
		const modelData: any = {
			id: record.id,
		};

		// Copy raw fields
		for (const [key, value] of Object.entries(record._raw)) {
			if (key === 'id') continue;
			const camelKey = this.toCamelCase(key);
			modelData[camelKey] = value;
		}

		// Create model instance
		return this.modelInstanceCreator
			? this.modelInstanceCreator(modelConstructor, modelData)
			: new modelConstructor(modelData);
	}

	/**
	 * Cache management
	 */
	private getCacheKey(
		tableName: string,
		predicate?: ModelPredicate<any>,
		pagination?: PaginationInput<any>,
	): string {
		const predicateStr = predicate ? JSON.stringify(predicate) : '';
		const paginationStr = pagination ? JSON.stringify(pagination) : '';

		return `${tableName}:${predicateStr}:${paginationStr}`;
	}

	private getFromCache<T>(key: string): T | null {
		const cached = this.queryCache.get(key);
		if (!cached) return null;

		const now = Date.now();
		if (now - cached.timestamp > this.cacheTTL) {
			this.queryCache.delete(key);

			return null;
		}

		return cached.result as T;
	}

	private setCache(key: string, value: any): void {
		// Limit cache size
		if (this.queryCache.size >= this.maxCacheSize) {
			const firstKey = this.queryCache.keys().next().value;
			if (firstKey) {
				this.queryCache.delete(firstKey);
			}
		}

		this.queryCache.set(key, {
			result: value,
			timestamp: Date.now(),
		});
	}

	private invalidateTableCache(tableName: string): void {
		for (const key of this.queryCache.keys()) {
			if (key.startsWith(`${tableName}:`)) {
				this.queryCache.delete(key);
			}
		}
	}

	/**
	 * Utility methods
	 */
	private async ensureInitialized(): Promise<void> {
		if (!this.isInitialized) {
			throw new Error(
				'WatermelonDBAdapter not initialized. Call setup() first.',
			);
		}
	}

	private getModelConstructor<T extends PersistentModel>(
		modelOrConstructor: T | PersistentModelConstructor<T>,
	): PersistentModelConstructor<T> {
		return this.isModelInstance(modelOrConstructor)
			? (modelOrConstructor.constructor as PersistentModelConstructor<T>)
			: modelOrConstructor;
	}

	private isModelInstance<T extends PersistentModel>(obj: any): obj is T {
		return obj && typeof obj === 'object' && 'id' in obj;
	}

	private getDatabaseName(): string {
		return 'amplify_datastore';
	}

	private getTableName(modelName: string): string {
		return modelName.toLowerCase();
	}

	private toSnakeCase(str: string): string {
		return str
			.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
			.replace(/^_/, '');
	}

	private toCamelCase(str: string): string {
		return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
	}

	private mapFieldType(type: any): string {
		switch (type) {
			case 'String':
			case 'ID':
			case 'AWSJSON':
			case 'AWSURL':
			case 'AWSEmail':
			case 'AWSPhone':
			case 'AWSIPAddress':
				return 'string';
			case 'Int':
			case 'Float':
			case 'AWSTimestamp':
			case 'AWSDateTime':
			case 'AWSDate':
			case 'AWSTime':
				return 'number';
			case 'Boolean':
				return 'boolean';
			default:
				return 'string';
		}
	}

	private shouldIndexField(fieldName: string, field: any): boolean {
		// Index foreign keys
		if (field.association) return true;

		// Index commonly queried fields
		const indexedFields = [
			'created_at',
			'updated_at',
			'owner',
			'status',
			'type',
			'_version',
			'_last_changed_at',
			'_deleted',
		];

		return indexedFields.includes(fieldName.toLowerCase());
	}

	/**
	 * Get schema version
	 */
	public getSchemaVersion(): number {
		return parseInt(this.schema?.version || '1', 10);
	}

	/**
	 * Check if adapter is ready
	 */
	public get isReady(): boolean {
		return this.isInitialized;
	}

	/**
	 * Get current dispatcher type
	 */
	public get dispatcherType(): string {
		return this._dispatcherType;
	}

	/**
	 * Observe real-time changes to a model collection
	 * Returns an observable that emits arrays of models matching the predicate
	 */
	public observe<T extends PersistentModel>(
		modelConstructor: PersistentModelConstructor<T>,
		predicate?: ModelPredicate<T>,
		pagination?: PaginationInput<T>,
	): any {
		// Import RxJS Observable if available
		let Observable: any;
		try {
			Observable = require('rxjs').Observable;
		} catch (error) {
			logger.warn('RxJS not available for observe functionality');
			// Return a mock observable
			return {
				subscribe: (observer: any) => {
					observer.error(new Error('RxJS not available'));
					return { unsubscribe: () => {} };
				},
			};
		}

		return new Observable((observer: any) => {
			const tableName = this.getTableName(modelConstructor.name);
			const collection = this.collections.get(tableName);

			if (!collection) {
				observer.error(new Error(`Collection not found: ${tableName}`));
				return;
			}

			// Build WatermelonDB query
			const query = this.buildQuery(collection, predicate, pagination);

			// Subscribe to WatermelonDB's observe()
			const subscription = query.observe().subscribe({
				next: (records: WatermelonModel[]) => {
					// Convert WatermelonDB models to DataStore models
					const results = records.map((record) =>
						this.convertToDataStoreModel(record, modelConstructor)
					);
					observer.next(results);
				},
				error: (error: any) => {
					logger.error('Observation error:', error);
					observer.error(error);
				},
			});

			// Track subscription for cleanup
			this.subscriptions.add(subscription);

			// Return unsubscribe function
			return () => {
				subscription.unsubscribe();
				this.subscriptions.delete(subscription);
				// Clear related cache entries
				const cacheKey = this.getCacheKey(tableName, predicate, pagination);
				this.queryCache.delete(cacheKey);
			};
		});
	}

	/**
	 * Stop observing changes
	 * Cleans up all active subscriptions and cache
	 */
	public stopObserve(): void {
		// Unsubscribe all active subscriptions
		this.subscriptions.forEach((subscription) => {
			try {
				if (subscription && typeof subscription.unsubscribe === 'function') {
					subscription.unsubscribe();
				}
			} catch (error) {
				logger.warn('Error unsubscribing:', error);
			}
		});

		// Clear subscriptions set
		this.subscriptions.clear();

		// Clear all cached queries to force fresh data on next observe
		this.queryCache.clear();

		logger.debug('Stopped observing changes and cleaned up subscriptions');
	}

	/**
	 * Get conflict handler for resolution strategy
	 * Implements DataStore's conflict resolution
	 */
	public getConflictHandler(): ((conflictData: any) => any) | undefined {
		return (conflictData: {
			localModel: PersistentModel;
			remoteModel: PersistentModel;
			operation: OpType;
			attempts: number;
		}) => {
			const { localModel, remoteModel, operation, attempts } = conflictData;

			// Default conflict resolution strategy
			if (attempts > 3) {
				// After 3 attempts, accept remote version
				logger.warn(`Conflict resolution: accepting remote after ${attempts} attempts`);
				return 'ACCEPT_REMOTE';
			}

			// For deletes, remote wins
			if (operation === OpType.DELETE) {
				return 'ACCEPT_REMOTE';
			}

			// Compare versions
			const localVersion = (localModel as any)._version || 0;
			const remoteVersion = (remoteModel as any)._version || 0;

			if (remoteVersion > localVersion) {
				return 'ACCEPT_REMOTE';
			} else if (localVersion > remoteVersion) {
				return 'RETRY_LOCAL';
			}

			// If versions are equal, compare timestamps
			const localTimestamp = (localModel as any)._lastChangedAt || 0;
			const remoteTimestamp = (remoteModel as any)._lastChangedAt || 0;

			if (remoteTimestamp > localTimestamp) {
				return 'ACCEPT_REMOTE';
			}

			// Default to retrying local changes
			return 'RETRY_LOCAL';
		};
	}

	/**
	 * Get model definition at runtime
	 * Useful for introspection and dynamic operations
	 */
	public getModelDefinition(modelName: string): SchemaModel | undefined {
		if (!this.schema?.namespaces?.user?.models) {
			return undefined;
		}

		return this.schema.namespaces.user.models[modelName];
	}

	/**
	 * Batch multiple operations efficiently
	 * Uses WatermelonDB's batch API for atomic operations
	 */
	public async batch(...operations: any[]): Promise<void> {
		await this.ensureInitialized();

		if (!this.db) {
			throw new Error('Database not initialized');
		}

		const batchOperations: WatermelonOperation[] = [];

		for (const op of operations) {
			if (op.type === 'create') {
				batchOperations.push({
					type: 'create',
					collection: op.collection,
					prepareCreate: op.prepareCreate,
				});
			} else if (op.type === 'update') {
				batchOperations.push({
					type: 'update',
					record: op.record,
				});
			} else if (op.type === 'delete') {
				batchOperations.push({
					type: 'markAsDeleted',
					record: op.record,
				});
			} else if (op.type === 'destroyPermanently') {
				batchOperations.push({
					type: 'destroyPermanently',
					record: op.record,
				});
			}
		}

		await this.db.batch(...batchOperations);

		// Clear cache after batch operations
		this.queryCache.clear();
	}

	/**
	 * Reset database completely
	 * WARNING: This will delete all data permanently
	 */
	public async unsafeResetDatabase(): Promise<void> {
		await this.ensureInitialized();

		if (this.adapter) {
			// Use WatermelonDB's adapter method
			await this.adapter.unsafeResetDatabase();

			// Re-initialize collections
			this.registerCollections();

			// Clear all caches
			this.queryCache.clear();
			this.models.clear();

			logger.warn('Database has been reset');
		} else {
			throw new Error('Adapter not initialized');
		}
	}
}

export default WatermelonDBAdapter;
