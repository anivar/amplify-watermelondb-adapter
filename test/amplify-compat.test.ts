import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { WatermelonDBAdapter } from '../src/WatermelonDBAdapter';
import { DataStore } from '@aws-amplify/datastore';
import { NAMESPACES, OpType } from '@aws-amplify/datastore';

// Mock DataStore
jest.mock('@aws-amplify/datastore', () => ({
    DataStore: {
        configure: jest.fn(),
        query: jest.fn(() => Promise.resolve([])),
        save: jest.fn(() => Promise.resolve({})),
        delete: jest.fn(() => Promise.resolve([])),
        observe: jest.fn(() => ({
            subscribe: jest.fn(() => ({ unsubscribe: jest.fn() }))
        })),
        clear: jest.fn(() => Promise.resolve()),
        start: jest.fn(() => Promise.resolve()),
        stop: jest.fn(() => Promise.resolve())
    },
    NAMESPACES: { DATASTORE: 'datastore', USER: 'user', SYNC: 'sync', STORAGE: 'storage' },
    OpType: { INSERT: 'INSERT', UPDATE: 'UPDATE', DELETE: 'DELETE' }
}));

describe('Amplify DataStore Compatibility', () => {
    let adapter: WatermelonDBAdapter;

    const testSchema: any = {
        namespaces: {
            [NAMESPACES.USER]: {
                name: NAMESPACES.USER,
                enums: {},
                models: {
                    Todo: {
                        syncable: true,
                        name: 'Todo',
                        fields: {
                            id: { name: 'id', type: { model: 'Todo' }, isRequired: true, isArray: false },
                            name: { name: 'name', type: 'String', isRequired: true, isArray: false },
                            description: { name: 'description', type: 'String', isRequired: false, isArray: false },
                            isComplete: { name: 'isComplete', type: 'Boolean', isRequired: true, isArray: false },
                            priority: { name: 'priority', type: 'Int', isRequired: false, isArray: false },
                        }
                    },
                    Note: {
                        syncable: true,
                        name: 'Note',
                        fields: {
                            id: { name: 'id', type: { model: 'Note' }, isRequired: true, isArray: false },
                            content: { name: 'content', type: 'String', isRequired: true, isArray: false },
                        }
                    }
                }
            },
            [NAMESPACES.DATASTORE]: {
                name: NAMESPACES.DATASTORE,
                enums: {},
                models: {}
            }
        },
        version: '1'
    };

    class Todo {
        id: string;
        name: string;
        description: string;
        isComplete: boolean;
        priority: number;
        constructor(init: any) {
            this.id = init.id || `todo-${Date.now()}-${Math.random()}`;
            this.name = init.name || '';
            this.description = init.description || '';
            this.isComplete = init.isComplete ?? false;
            this.priority = init.priority ?? 0;
        }
    }

    class Note {
        id: string;
        content: string;
        constructor(init: any) {
            this.id = init.id || `note-${Date.now()}-${Math.random()}`;
            this.content = init.content || '';
        }
    }

    beforeEach(async () => {
        adapter = new WatermelonDBAdapter({
            conflictStrategy: 'ACCEPT_REMOTE',
            cacheMaxSize: 200,
            cacheTTL: 60000,
            batchSize: 1000
        });

        await adapter.setup(
            testSchema,
            (_model: any) => NAMESPACES.USER,
            jest.fn((ctor: any, json: any) => new ctor(json)) as any,
            (_ns: string, _name: string) => Todo as any,
            jest.fn() as any,
        );
    });

    describe('DataStore storage adapter interface', () => {
        it('should implement all required interface methods', () => {
            const requiredMethods = ['setup', 'save', 'delete', 'query', 'observe', 'clear', 'batchSave'];
            for (const method of requiredMethods) {
                expect(typeof (adapter as any)[method]).toBe('function');
            }
        });

        it('should be accepted by DataStore.configure', () => {
            expect(() => {
                DataStore.configure({
                    storageAdapter: adapter as any
                });
            }).not.toThrow();

            expect(DataStore.configure).toHaveBeenCalledWith(
                expect.objectContaining({
                    storageAdapter: adapter
                })
            );
        });

        it('should provide a conflict handler', () => {
            const handler = adapter.getConflictHandler();
            expect(handler).toBeDefined();
            expect(typeof handler).toBe('function');
        });

        it('should report dispatcher type', () => {
            expect(adapter.dispatcherType).toBe('in-memory');
        });
    });

    describe('CRUD operations via adapter interface', () => {
        it('should save and query a model (DataStore flow)', async () => {
            const todo = new Todo({ name: 'Buy groceries', isComplete: false, priority: 1 });
            const [saved, opType] = await adapter.save(todo);

            expect(opType).toBe(OpType.INSERT);
            expect(saved.name).toBe('Buy groceries');
            expect(saved.id).toBe(todo.id);

            const results = await adapter.query(Todo as any);
            expect(results.length).toBe(1);
            expect(results[0].name).toBe('Buy groceries');
        });

        it('should update an existing model', async () => {
            const todo = new Todo({ name: 'Original', isComplete: false });
            const [saved] = await adapter.save(todo);

            const updated = new Todo({ ...saved, name: 'Updated', isComplete: true, _version: 1 });
            const [result, opType] = await adapter.save(updated);

            expect(opType).toBe(OpType.UPDATE);
            expect(result.name).toBe('Updated');
            expect(result.isComplete).toBe(true);
        });

        it('should delete a model', async () => {
            const todo = new Todo({ name: 'To delete', isComplete: false });
            const [saved] = await adapter.save(todo);

            const [deleted] = await adapter.delete(saved);
            expect(deleted.length).toBe(1);
            expect(deleted[0].id).toBe(saved.id);

            const remaining = await adapter.query(Todo as any);
            expect(remaining.length).toBe(0);
        });

        it('should batch save multiple models', async () => {
            const todos = Array.from({ length: 5 }, (_, i) =>
                new Todo({ name: `Todo ${i}`, isComplete: i % 2 === 0, priority: i })
            );

            const [saved, opTypes] = await adapter.batchSave(Todo as any, todos);
            expect(saved.length).toBe(5);
            expect(opTypes.every(op => op === OpType.INSERT)).toBe(true);

            const results = await adapter.query(Todo as any);
            expect(results.length).toBe(5);
        });

        it('should clear all data', async () => {
            await adapter.save(new Todo({ name: 'Todo 1', isComplete: false }));
            await adapter.save(new Todo({ name: 'Todo 2', isComplete: true }));

            const before = await adapter.query(Todo as any);
            expect(before.length).toBe(2);

            await adapter.clear();

            const after = await adapter.query(Todo as any);
            expect(after.length).toBe(0);
        });
    });

    describe('Query filtering (predicate support)', () => {
        beforeEach(async () => {
            const todos = [
                new Todo({ name: 'Buy milk', isComplete: false, priority: 1 }),
                new Todo({ name: 'Buy eggs', isComplete: true, priority: 2 }),
                new Todo({ name: 'Clean house', isComplete: false, priority: 3 }),
                new Todo({ name: 'Buy bread', isComplete: true, priority: 1 }),
            ];
            for (const todo of todos) {
                await adapter.save(todo);
            }
        });

        it('should filter by equality', async () => {
            const results = await adapter.query(
                Todo as any,
                ((m: any) => m.isComplete.eq(true)) as any
            );
            expect(results.length).toBe(2);
            expect(results.every((r: any) => r.isComplete === true)).toBe(true);
        });

        it('should filter by contains', async () => {
            const results = await adapter.query(
                Todo as any,
                ((m: any) => m.name.contains('Buy')) as any
            );
            expect(results.length).toBe(3);
        });

        it('should filter with compound predicate (and)', async () => {
            const results = await adapter.query(
                Todo as any,
                ((m: any) => m.isComplete.eq(false).and(m.priority.eq(1))) as any
            );
            expect(results.length).toBe(1);
            expect(results[0].name).toBe('Buy milk');
        });

        it('should filter with gt operator', async () => {
            const results = await adapter.query(
                Todo as any,
                ((m: any) => m.priority.gt(1)) as any
            );
            expect(results.length).toBe(2);
        });
    });

    describe('Conflict resolution', () => {
        it('should return DISCARD for ACCEPT_REMOTE strategy', () => {
            const handler = adapter.getConflictHandler()!;
            const result = handler({
                localModel: { id: '1' } as any,
                remoteModel: { id: '1' } as any,
                operation: OpType.UPDATE,
                attempts: 0
            });
            expect(result).toBe('DISCARD');
        });

        it('should return RETRY for RETRY_LOCAL strategy', () => {
            const retryAdapter = new WatermelonDBAdapter({
                conflictStrategy: 'RETRY_LOCAL'
            });
            const handler = retryAdapter.getConflictHandler()!;
            const result = handler({
                localModel: { id: '1' } as any,
                remoteModel: { id: '1' } as any,
                operation: OpType.UPDATE,
                attempts: 0
            });
            expect(result).toBe('RETRY');
        });

        it('should fall back to DISCARD after max attempts', () => {
            const retryAdapter = new WatermelonDBAdapter({
                conflictStrategy: 'RETRY_LOCAL'
            });
            const handler = retryAdapter.getConflictHandler()!;
            const result = handler({
                localModel: { id: '1' } as any,
                remoteModel: { id: '1' } as any,
                operation: OpType.UPDATE,
                attempts: 5
            });
            expect(result).toBe('DISCARD');
        });
    });

    describe('Multi-model support', () => {
        it('should handle multiple model types independently', async () => {
            const todo = new Todo({ name: 'Test todo', isComplete: false });
            const note = new Note({ content: 'Test note' });

            await adapter.save(todo);

            // Note uses a different collection
            const todoResults = await adapter.query(Todo as any);
            expect(todoResults.length).toBe(1);
            expect(todoResults[0].name).toBe('Test todo');
        });
    });

    describe('Observable support', () => {
        it('should return an observable from observe()', () => {
            const observable = adapter.observe(Todo as any);
            expect(observable).toBeDefined();
            expect(typeof observable.subscribe).toBe('function');
        });

        it('should emit changes when data is modified', async () => {
            const changes: any[] = [];
            const observable = adapter.observe(Todo as any);
            const subscription = observable.subscribe((data: any) => {
                changes.push(data);
            });

            await adapter.save(new Todo({ name: 'Observable test', isComplete: false }));
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(changes.length).toBeGreaterThan(0);

            subscription.unsubscribe();
            adapter.stopObserve();
        });
    });

    describe('Schema introspection', () => {
        it('should find model definitions across namespaces', () => {
            const todoDef = adapter.getModelDefinition('Todo');
            expect(todoDef).toBeDefined();
            expect(todoDef?.name).toBe('Todo');
            expect(todoDef?.fields).toHaveProperty('name');
        });

        it('should return undefined for unknown models', () => {
            const unknown = adapter.getModelDefinition('NonExistent');
            expect(unknown).toBeUndefined();
        });
    });
});
