import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { WatermelonDBAdapter } from '../src/WatermelonDBAdapter';
import {
    DataStore,
    PersistentModel,
    PersistentModelConstructor,
    InternalSchema,
    NamespaceResolver,
    ModelInstanceCreator,
    NAMESPACES,
    SchemaModel,
    ModelPredicate,
    OpType
} from '@aws-amplify/datastore';

// Test model definitions
class TestModel implements PersistentModel {
    readonly id: string;
    readonly title: string;
    readonly description?: string;
    readonly isCompleted: boolean;
    readonly priority: number;
    readonly tags?: string[];
    readonly createdAt?: string;
    readonly updatedAt?: string;
    readonly _version?: number;
    readonly _lastChangedAt?: number;
    readonly _deleted?: boolean | null;

    constructor(init: Partial<TestModel>) {
        this.id = init.id || `test-${Date.now()}-${Math.random()}`;
        this.title = init.title || '';
        this.description = init.description;
        this.isCompleted = init.isCompleted || false;
        this.priority = init.priority || 0;
        this.tags = init.tags;
        this.createdAt = init.createdAt;
        this.updatedAt = init.updatedAt;
        this._version = init._version;
        this._lastChangedAt = init._lastChangedAt;
        this._deleted = init._deleted;
    }
}

class RelatedModel implements PersistentModel {
    readonly id: string;
    readonly name: string;
    readonly testModelId: string;
    readonly _version?: number;
    readonly _lastChangedAt?: number;
    readonly _deleted?: boolean | null;

    constructor(init: Partial<RelatedModel>) {
        this.id = init.id || `related-${Date.now()}-${Math.random()}`;
        this.name = init.name || '';
        this.testModelId = init.testModelId || '';
        this._version = init._version;
        this._lastChangedAt = init._lastChangedAt;
        this._deleted = init._deleted;
    }
}

// Mock schema
const mockSchema: InternalSchema = {
    namespaces: {
        [NAMESPACES.DATASTORE]: {
            name: NAMESPACES.DATASTORE,
            models: {
                TestModel: {
                    syncable: true,
                    name: 'TestModel',
                    pluralName: 'TestModels',
                    attributes: [],
                    fields: {
                        id: {
                            name: 'id',
                            isArray: false,
                            type: 'ID',
                            isRequired: true,
                            attributes: []
                        },
                        title: {
                            name: 'title',
                            isArray: false,
                            type: 'String',
                            isRequired: true,
                            attributes: []
                        },
                        description: {
                            name: 'description',
                            isArray: false,
                            type: 'String',
                            isRequired: false,
                            attributes: []
                        },
                        isCompleted: {
                            name: 'isCompleted',
                            isArray: false,
                            type: 'Boolean',
                            isRequired: true,
                            attributes: []
                        },
                        priority: {
                            name: 'priority',
                            isArray: false,
                            type: 'Int',
                            isRequired: true,
                            attributes: []
                        },
                        tags: {
                            name: 'tags',
                            isArray: true,
                            type: 'String',
                            isRequired: false,
                            attributes: []
                        }
                    }
                },
                RelatedModel: {
                    syncable: true,
                    name: 'RelatedModel',
                    pluralName: 'RelatedModels',
                    attributes: [],
                    fields: {
                        id: {
                            name: 'id',
                            isArray: false,
                            type: 'ID',
                            isRequired: true,
                            attributes: []
                        },
                        name: {
                            name: 'name',
                            isArray: false,
                            type: 'String',
                            isRequired: true,
                            attributes: []
                        },
                        testModelId: {
                            name: 'testModelId',
                            isArray: false,
                            type: 'ID',
                            isRequired: true,
                            attributes: []
                        }
                    }
                }
            }
        }
    },
    version: '1',
    codegenVersion: '3.0.0'
};

// Mock functions
const mockNamespaceResolver: NamespaceResolver = (model: any) => NAMESPACES.DATASTORE;
const mockModelInstanceCreator: ModelInstanceCreator = jest.fn((modelConstructor, json) => {
    return new modelConstructor(json);
});
const mockGetModelConstructor = (namespace: string, modelName: string) => {
    const models: Record<string, any> = {
        TestModel,
        RelatedModel
    };
    return models[modelName];
};

describe('WatermelonDBAdapter', () => {
    let adapter: WatermelonDBAdapter;

    beforeEach(async () => {
        adapter = new WatermelonDBAdapter({
            cacheMaxSize: 100,
            cacheTTL: 5000,
            batchSize: 100,
            conflictStrategy: 'ACCEPT_REMOTE'
        });

        await adapter.setup(
            mockSchema,
            mockNamespaceResolver,
            mockModelInstanceCreator,
            mockGetModelConstructor,
            'test-session'
        );
    });

    afterEach(async () => {
        if (adapter) {
            await adapter.clear();
        }
    });

    describe('setup', () => {
        it('should initialize adapter successfully', () => {
            expect(adapter.isReady).toBe(true);
            expect(adapter.dispatcherType).toBeDefined();
        });

        it('should detect correct dispatcher type', () => {
            const dispatcher = adapter.dispatcherType;
            expect(['jsi', 'sqlite', 'lokijs', 'in-memory']).toContain(dispatcher);
        });

        it('should have correct schema version', () => {
            expect(adapter.getSchemaVersion()).toBe(1);
        });
    });

    describe('save', () => {
        it('should save a new model', async () => {
            const model = new TestModel({
                title: 'Test Item',
                description: 'Test Description',
                isCompleted: false,
                priority: 1,
                tags: ['test', 'sample']
            });

            const [saved, opType] = await adapter.save(model);

            expect(saved).toBeDefined();
            expect(saved.id).toBe(model.id);
            expect(saved.title).toBe('Test Item');
            expect(opType).toBe(OpType.INSERT);
        });

        it('should update an existing model', async () => {
            const model = new TestModel({
                title: 'Original Title',
                isCompleted: false,
                priority: 1
            });

            const [saved] = await adapter.save(model);

            const updated = new TestModel({
                ...saved,
                title: 'Updated Title',
                isCompleted: true,
                _version: 1
            });

            const [result, opType] = await adapter.save(updated);

            expect(result.title).toBe('Updated Title');
            expect(result.isCompleted).toBe(true);
            expect(opType).toBe(OpType.UPDATE);
        });

        it('should handle conditional save', async () => {
            const model = new TestModel({
                title: 'Conditional Test',
                isCompleted: false,
                priority: 2
            });

            const [saved] = await adapter.save(model);

            const condition = (m: TestModel) => m.priority.eq(2);

            const updated = new TestModel({
                ...saved,
                title: 'Updated with Condition',
                _version: 1
            });

            const [result] = await adapter.save(updated, condition as any);
            expect(result.title).toBe('Updated with Condition');
        });
    });

    describe('query', () => {
        beforeEach(async () => {
            // Seed test data
            const models = [
                new TestModel({ title: 'Item 1', priority: 1, isCompleted: false }),
                new TestModel({ title: 'Item 2', priority: 2, isCompleted: true }),
                new TestModel({ title: 'Item 3', priority: 3, isCompleted: false }),
                new TestModel({ title: 'Special Item', priority: 1, isCompleted: true })
            ];

            for (const model of models) {
                await adapter.save(model);
            }
        });

        it('should query all models', async () => {
            const results = await adapter.query(TestModel as PersistentModelConstructor<TestModel>);
            expect(results.length).toBe(4);
        });

        it('should query with simple predicate', async () => {
            const predicate = (m: TestModel) => m.isCompleted.eq(true);
            const results = await adapter.query(
                TestModel as PersistentModelConstructor<TestModel>,
                predicate as any
            );

            expect(results.length).toBe(2);
            expect(results.every(r => r.isCompleted === true)).toBe(true);
        });

        it('should query with compound predicate', async () => {
            const predicate = (m: TestModel) =>
                m.priority.eq(1).and(m.isCompleted.eq(false));

            const results = await adapter.query(
                TestModel as PersistentModelConstructor<TestModel>,
                predicate as any
            );

            expect(results.length).toBe(1);
            expect(results[0].title).toBe('Item 1');
        });

        it('should query with contains operator', async () => {
            const predicate = (m: TestModel) => m.title.contains('Special');
            const results = await adapter.query(
                TestModel as PersistentModelConstructor<TestModel>,
                predicate as any
            );

            expect(results.length).toBe(1);
            expect(results[0].title).toBe('Special Item');
        });

        it('should query with pagination', async () => {
            const results = await adapter.query(
                TestModel as PersistentModelConstructor<TestModel>,
                undefined,
                { page: 0, limit: 2 }
            );

            expect(results.length).toBe(2);
        });

        it('should query with sorting', async () => {
            const results = await adapter.query(
                TestModel as PersistentModelConstructor<TestModel>,
                undefined,
                {
                    sort: (s: any) => s.priority.ascending()
                }
            );

            expect(results[0].priority).toBe(1);
            expect(results[results.length - 1].priority).toBe(3);
        });
    });

    describe('queryOne', () => {
        beforeEach(async () => {
            const models = [
                new TestModel({ title: 'First', priority: 1, isCompleted: false }),
                new TestModel({ title: 'Second', priority: 2, isCompleted: true }),
                new TestModel({ title: 'Third', priority: 3, isCompleted: false })
            ];

            for (const model of models) {
                await adapter.save(model);
            }
        });

        it('should query first model', async () => {
            const result = await adapter.queryOne(
                TestModel as PersistentModelConstructor<TestModel>,
                'FIRST'
            );

            expect(result).toBeDefined();
            expect(result?.title).toBe('First');
        });

        it('should query last model', async () => {
            const result = await adapter.queryOne(
                TestModel as PersistentModelConstructor<TestModel>,
                'LAST'
            );

            expect(result).toBeDefined();
            expect(result?.title).toBe('Third');
        });

        it('should return undefined for empty results', async () => {
            await adapter.clear();
            const result = await adapter.queryOne(
                TestModel as PersistentModelConstructor<TestModel>,
                'FIRST'
            );

            expect(result).toBeUndefined();
        });
    });

    describe('delete', () => {
        it('should delete a single model', async () => {
            const model = new TestModel({
                title: 'To Delete',
                isCompleted: false,
                priority: 1
            });
            const [saved] = await adapter.save(model);

            const [deleted, remaining] = await adapter.delete(saved);

            expect(deleted.length).toBe(1);
            expect(deleted[0].id).toBe(saved.id);
            expect(remaining.length).toBe(0);

            const results = await adapter.query(TestModel as PersistentModelConstructor<TestModel>);
            expect(results.find(r => r.id === saved.id)).toBeUndefined();
        });

        it('should delete multiple models with predicate', async () => {
            const models = [
                new TestModel({ title: 'Item 1', priority: 1, isCompleted: true }),
                new TestModel({ title: 'Item 2', priority: 2, isCompleted: false }),
                new TestModel({ title: 'Item 3', priority: 3, isCompleted: true })
            ];

            for (const model of models) {
                await adapter.save(model);
            }

            const predicate = (m: TestModel) => m.isCompleted.eq(true);
            const [deleted, remaining] = await adapter.delete(
                TestModel as PersistentModelConstructor<TestModel>,
                predicate as any
            );

            expect(deleted.length).toBe(2);
            expect(remaining.length).toBe(0);

            const results = await adapter.query(TestModel as PersistentModelConstructor<TestModel>);
            expect(results.length).toBe(1);
            expect(results[0].isCompleted).toBe(false);
        });
    });

    describe('batchSave', () => {
        it('should save multiple models in batch', async () => {
            const models = Array.from({ length: 10 }, (_, i) =>
                new TestModel({
                    title: `Batch Item ${i}`,
                    priority: i,
                    isCompleted: i % 2 === 0
                })
            );

            const [saved, opTypes] = await adapter.batchSave(
                TestModel as PersistentModelConstructor<TestModel>,
                models
            );

            expect(saved.length).toBe(10);
            expect(opTypes.every(op => op === OpType.INSERT)).toBe(true);

            const results = await adapter.query(TestModel as PersistentModelConstructor<TestModel>);
            expect(results.length).toBe(10);
        });

        it('should handle large batches efficiently', async () => {
            const models = Array.from({ length: 1000 }, (_, i) =>
                new TestModel({
                    title: `Large Batch Item ${i}`,
                    priority: i % 10,
                    isCompleted: i % 3 === 0,
                    tags: [`tag${i % 5}`, `category${i % 3}`]
                })
            );

            const startTime = performance.now();
            const [saved] = await adapter.batchSave(
                TestModel as PersistentModelConstructor<TestModel>,
                models
            );
            const endTime = performance.now();

            expect(saved.length).toBe(1000);
            expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds

            // Verify data integrity
            const results = await adapter.query(TestModel as PersistentModelConstructor<TestModel>);
            expect(results.length).toBe(1000);
        });
    });

    describe('observe', () => {
        it('should observe model changes', async () => {
            const changes: any[] = [];

            const observable = adapter.observe(
                TestModel as PersistentModelConstructor<TestModel>
            );

            const subscription = observable.subscribe((data: any) => {
                changes.push(data);
            });

            // Create a model
            const model = new TestModel({
                title: 'Observable Test',
                priority: 1,
                isCompleted: false
            });
            await adapter.save(model);

            // Wait for observable to emit
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(changes.length).toBeGreaterThan(0);

            subscription.unsubscribe();
            adapter.stopObserve();
        });

        it('should observe with predicates', async () => {
            const changes: any[] = [];

            const predicate = (m: TestModel) => m.priority.gt(5);
            const observable = adapter.observe(
                TestModel as PersistentModelConstructor<TestModel>,
                predicate as any
            );

            const subscription = observable.subscribe((data: any) => {
                changes.push(data);
            });

            // Create models
            await adapter.save(new TestModel({ title: 'Low Priority', priority: 1, isCompleted: false }));
            await adapter.save(new TestModel({ title: 'High Priority', priority: 10, isCompleted: false }));

            // Wait for observable to emit
            await new Promise(resolve => setTimeout(resolve, 100));

            // Should only observe high priority items
            const highPriorityItems = changes.filter(c =>
                Array.isArray(c) ? c.some(item => item.priority > 5) : c.priority > 5
            );
            expect(highPriorityItems.length).toBeGreaterThan(0);

            subscription.unsubscribe();
            adapter.stopObserve();
        });
    });

    describe('caching', () => {
        it('should cache query results', async () => {
            const models = Array.from({ length: 5 }, (_, i) =>
                new TestModel({
                    title: `Cache Test ${i}`,
                    priority: i,
                    isCompleted: false
                })
            );

            for (const model of models) {
                await adapter.save(model);
            }

            // First query - should hit database
            const startTime1 = performance.now();
            const results1 = await adapter.query(TestModel as PersistentModelConstructor<TestModel>);
            const endTime1 = performance.now();
            const firstQueryTime = endTime1 - startTime1;

            // Second query - should hit cache
            const startTime2 = performance.now();
            const results2 = await adapter.query(TestModel as PersistentModelConstructor<TestModel>);
            const endTime2 = performance.now();
            const secondQueryTime = endTime2 - startTime2;

            expect(results1.length).toBe(results2.length);
            expect(secondQueryTime).toBeLessThan(firstQueryTime);
        });

        it('should invalidate cache on modifications', async () => {
            const model = new TestModel({
                title: 'Cache Invalidation Test',
                priority: 1,
                isCompleted: false
            });

            await adapter.save(model);

            // Query to populate cache
            const results1 = await adapter.query(TestModel as PersistentModelConstructor<TestModel>);
            expect(results1.length).toBe(1);

            // Save new model
            await adapter.save(new TestModel({
                title: 'Another Model',
                priority: 2,
                isCompleted: true
            }));

            // Query again - cache should be invalidated
            const results2 = await adapter.query(TestModel as PersistentModelConstructor<TestModel>);
            expect(results2.length).toBe(2);
        });
    });

    describe('conflict resolution', () => {
        it('should handle version conflicts with ACCEPT_REMOTE strategy', async () => {
            const adapter = new WatermelonDBAdapter({
                conflictStrategy: 'ACCEPT_REMOTE'
            });

            await adapter.setup(
                mockSchema,
                mockNamespaceResolver,
                mockModelInstanceCreator,
                mockGetModelConstructor,
                'test-session-conflict'
            );

            const handler = adapter.getConflictHandler();
            expect(handler).toBeDefined();

            if (handler) {
                const conflictData = {
                    modelConstructor: TestModel,
                    localModel: { id: '1', title: 'Local', _version: 1 },
                    remoteModel: { id: '1', title: 'Remote', _version: 2 },
                    operation: 'UPDATE'
                };

                const result = handler(conflictData);
                expect(result).toBe('DISCARD');
            }

            await adapter.clear();
        });

        it('should handle version conflicts with RETRY_LOCAL strategy', async () => {
            const adapter = new WatermelonDBAdapter({
                conflictStrategy: 'RETRY_LOCAL'
            });

            await adapter.setup(
                mockSchema,
                mockNamespaceResolver,
                mockModelInstanceCreator,
                mockGetModelConstructor,
                'test-session-retry'
            );

            const handler = adapter.getConflictHandler();
            expect(handler).toBeDefined();

            if (handler) {
                const conflictData = {
                    modelConstructor: TestModel,
                    localModel: { id: '1', title: 'Local', _version: 1 },
                    remoteModel: { id: '1', title: 'Remote', _version: 2 },
                    operation: 'UPDATE'
                };

                const result = handler(conflictData);
                expect(result).toBe('RETRY');
            }

            await adapter.clear();
        });
    });

    describe('schema management', () => {
        it('should get model definition', () => {
            const modelDef = adapter.getModelDefinition('TestModel');
            expect(modelDef).toBeDefined();
            expect(modelDef?.name).toBe('TestModel');
            expect(modelDef?.fields).toBeDefined();
        });

        it('should handle unknown model names', () => {
            const modelDef = adapter.getModelDefinition('UnknownModel');
            expect(modelDef).toBeUndefined();
        });
    });

    describe('clear', () => {
        it('should clear all data', async () => {
            // Add test data
            const models = Array.from({ length: 5 }, (_, i) =>
                new TestModel({
                    title: `Clear Test ${i}`,
                    priority: i,
                    isCompleted: false
                })
            );

            for (const model of models) {
                await adapter.save(model);
            }

            // Verify data exists
            const beforeClear = await adapter.query(TestModel as PersistentModelConstructor<TestModel>);
            expect(beforeClear.length).toBe(5);

            // Clear all data
            await adapter.clear();

            // Verify data is gone
            const afterClear = await adapter.query(TestModel as PersistentModelConstructor<TestModel>);
            expect(afterClear.length).toBe(0);
        });
    });

    describe('error handling', () => {
        it('should throw error when not initialized', async () => {
            const uninitializedAdapter = new WatermelonDBAdapter();

            await expect(
                uninitializedAdapter.query(TestModel as PersistentModelConstructor<TestModel>)
            ).rejects.toThrow('Adapter not initialized');
        });

        it('should handle invalid model constructor', async () => {
            await expect(
                adapter.query(null as any)
            ).rejects.toThrow();
        });

        it('should handle database reset gracefully', async () => {
            // Add data
            await adapter.save(new TestModel({
                title: 'Reset Test',
                priority: 1,
                isCompleted: false
            }));

            // Reset database
            await adapter.unsafeResetDatabase();

            // Should be able to query after reset
            const results = await adapter.query(TestModel as PersistentModelConstructor<TestModel>);
            expect(results).toBeDefined();
            expect(results.length).toBe(0);
        });
    });

    describe('performance metrics', () => {
        it('should track dispatcher type', () => {
            const dispatcherType = adapter.dispatcherType;
            expect(dispatcherType).toBeDefined();
            console.log('Dispatcher type:', dispatcherType);
        });

        it('should measure operation performance', async () => {
            const iterations = 100;
            const startTime = performance.now();

            for (let i = 0; i < iterations; i++) {
                const model = new TestModel({
                    title: `Performance Test ${i}`,
                    priority: i % 10,
                    isCompleted: i % 2 === 0
                });
                await adapter.save(model);
            }

            const endTime = performance.now();
            const totalTime = endTime - startTime;
            const avgTime = totalTime / iterations;

            console.log(`Average save time: ${avgTime.toFixed(2)}ms`);
            expect(avgTime).toBeLessThan(50); // Should be under 50ms per operation
        });
    });
});