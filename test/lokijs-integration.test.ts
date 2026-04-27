/**
 * Real LokiJS integration test.
 *
 * The pre-existing "integration" tests mock @aws-amplify/datastore wholesale and
 * never actually exercise WatermelonDB, so a regression that broke LokiJS init
 * (e.g. silently falling back to the in-memory store because IndexedDB wasn't
 * available) would not have been caught.
 *
 * This test forces the LokiJS path via the jsdom test environment and the
 * fake-indexeddb polyfill loaded in test/setup.ts, then asserts:
 *   1. The optimal-adapter selection actually picks `lokijs`.
 *   2. A real LokiJS-backed Database can round-trip a record.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { WatermelonDBAdapter } from '../src/WatermelonDBAdapter';

describe('LokiJS integration (jsdom + fake-indexeddb)', () => {
    beforeAll(() => {
        // The dispatcher selection logic gates the LokiJS path on a browser-like
        // global. jest's `jsdom` env provides `window`, but make the assumption
        // explicit so this test fails loudly if the env is ever swapped to node
        // or if the fake-indexeddb polyfill isn't wired up in setup.ts.
        expect(typeof window).toBe('object');
        expect(typeof globalThis.indexedDB).toBe('object');
    });

    it('selects the LokiJS dispatcher when IndexedDB is available', async () => {
        const adapter = new WatermelonDBAdapter({
            cacheMaxSize: 16,
            batchSize: 8,
        });

        // createOptimalAdapter is private; reach in deliberately so the test
        // exercises the same selection logic that setup() drives at runtime
        // without dragging in the full Amplify InternalSchema fixture.
        const result = await (adapter as any).createOptimalAdapter();

        expect(result).toBeDefined();
        // The in-memory fallback exposes a `_store` Map; the real LokiJS adapter
        // does not. This is the regression the older tests missed.
        expect('_store' in result).toBe(false);
        expect((adapter as any)._dispatcherType).toBe('lokijs');
    });

    it('round-trips a record through the real LokiJS-backed Database', async () => {
        const { Database, Model } =
            require('@nozbe/watermelondb') as typeof import('@nozbe/watermelondb');
        const { appSchema, tableSchema } =
            require('@nozbe/watermelondb/Schema') as typeof import('@nozbe/watermelondb/Schema');
        const { field } =
            require('@nozbe/watermelondb/decorators') as typeof import('@nozbe/watermelondb/decorators');
        const LokiJSAdapter =
            require('@nozbe/watermelondb/adapters/lokijs').default;

        class Todo extends Model {
            static table = 'todos';
        }
        // Decorate after the class declaration so this file stays plain TS.
        field('title')(Todo.prototype, 'title');
        field('completed')(Todo.prototype, 'completed');

        const schema = appSchema({
            version: 1,
            tables: [
                tableSchema({
                    name: 'todos',
                    columns: [
                        { name: 'title', type: 'string' },
                        { name: 'completed', type: 'boolean' },
                    ],
                }),
            ],
        });

        const lokiAdapter = new LokiJSAdapter({
            schema,
            dbName: `test_lokijs_${Date.now()}`,
            useWebWorker: false,
            useIncrementalIndexedDB: true,
        });

        const db = new Database({
            adapter: lokiAdapter,
            modelClasses: [Todo as any],
        });

        const todos = db.get<Todo>('todos');

        await db.write(async () => {
            await todos.create((t: any) => {
                t.title = 'integration smoke';
                t.completed = false;
            });
        });

        const all = await todos.query().fetch();
        expect(all).toHaveLength(1);
        expect((all[0] as any).title).toBe('integration smoke');

        await db.write(async () => {
            await all[0].destroyPermanently();
        });

        const after = await todos.query().fetch();
        expect(after).toHaveLength(0);
    });
});
