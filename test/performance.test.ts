import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { WatermelonDBAdapter } from '../src/WatermelonDBAdapter';

describe('Performance Tests', () => {
    let adapter: WatermelonDBAdapter;

    beforeAll(() => {
        adapter = new WatermelonDBAdapter({
            cacheMaxSize: 1000,
            cacheTTL: 30000,
            batchSize: 1000
        });
    });

    afterAll(async () => {
        // Performance tests don't need cleanup as they don't modify state
    });

    describe('Adapter instantiation performance', () => {
        it('should create adapter instances quickly', () => {
            const iterations = 100;
            const startTime = performance.now();

            for (let i = 0; i < iterations; i++) {
                new WatermelonDBAdapter({
                    conflictStrategy: 'ACCEPT_REMOTE',
                    cacheMaxSize: 500,
                    batchSize: 1000
                });
            }

            const endTime = performance.now();
            const avgTime = (endTime - startTime) / iterations;

            console.log(`Average adapter creation time: ${avgTime.toFixed(2)}ms`);
            expect(avgTime).toBeLessThan(10); // Should be under 10ms per instance
        });
    });

    describe('Configuration performance', () => {
        it('should handle large configuration objects efficiently', () => {
            const largeSyncExpressions = Array.from({ length: 100 }, (_, i) => ({
                model: `Model${i}`,
                predicate: (m: any) => m.id.eq(`test${i}`)
            }));

            const startTime = performance.now();

            const adapter = new WatermelonDBAdapter({
                conflictStrategy: 'RETRY_LOCAL',
                cacheMaxSize: 10000,
                cacheTTL: 3600000,
                batchSize: 5000
            });

            const endTime = performance.now();
            const configTime = endTime - startTime;

            console.log(`Large configuration time: ${configTime.toFixed(2)}ms`);
            expect(configTime).toBeLessThan(100); // Should be under 100ms
            expect(adapter).toBeDefined();
        });
    });

    describe('Memory efficiency', () => {
        it('should not leak memory during repeated instantiation', () => {
            const iterations = 1000;
            const adapters: WatermelonDBAdapter[] = [];

            const startMemory = process.memoryUsage().heapUsed;

            for (let i = 0; i < iterations; i++) {
                adapters.push(new WatermelonDBAdapter({
                    cacheMaxSize: 100,
                    batchSize: 500
                }));
            }

            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }

            const endMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = (endMemory - startMemory) / 1024 / 1024; // MB

            console.log(`Memory increase: ${memoryIncrease.toFixed(2)}MB for ${iterations} adapters`);

            // Should not use excessive memory (less than 50MB for 1000 instances)
            expect(memoryIncrease).toBeLessThan(50);

            // Clear references
            adapters.length = 0;
        });
    });

    describe('Dispatcher type detection performance', () => {
        it('should detect dispatcher type quickly', () => {
            const iterations = 100;
            const times: number[] = [];

            for (let i = 0; i < iterations; i++) {
                const startTime = performance.now();
                const adapter = new WatermelonDBAdapter();
                const dispatcherType = adapter.dispatcherType;
                const endTime = performance.now();

                times.push(endTime - startTime);
                expect(dispatcherType).toBeDefined();
                expect(['jsi', 'sqlite', 'lokijs', 'in-memory']).toContain(dispatcherType);
            }

            const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
            const maxTime = Math.max(...times);
            const minTime = Math.min(...times);

            console.log(`Dispatcher detection - Avg: ${avgTime.toFixed(2)}ms, Min: ${minTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);

            expect(avgTime).toBeLessThan(10); // Average should be under 10ms
            expect(maxTime).toBeLessThan(50); // Max should be under 50ms
        });
    });

    describe('Schema operations performance', () => {
        it('should have fast schema version lookup', () => {
            const iterations = 1000;
            const adapter = new WatermelonDBAdapter();

            const startTime = performance.now();

            for (let i = 0; i < iterations; i++) {
                const version = adapter.getSchemaVersion();
                expect(typeof version).toBe('number');
            }

            const endTime = performance.now();
            const avgTime = (endTime - startTime) / iterations;

            console.log(`Average schema version lookup: ${avgTime.toFixed(4)}ms`);
            expect(avgTime).toBeLessThan(1); // Should be sub-millisecond
        });

        it('should efficiently check readiness status', () => {
            const iterations = 10000;
            const adapter = new WatermelonDBAdapter();

            const startTime = performance.now();

            for (let i = 0; i < iterations; i++) {
                const isReady = adapter.isReady;
                expect(typeof isReady).toBe('boolean');
            }

            const endTime = performance.now();
            const avgTime = (endTime - startTime) / iterations;

            console.log(`Average readiness check: ${avgTime.toFixed(4)}ms`);
            expect(avgTime).toBeLessThan(0.1); // Should be very fast
        });
    });

    describe('Configuration validation performance', () => {
        it('should validate different config combinations quickly', () => {
            const configs = [
                {},
                { conflictStrategy: 'ACCEPT_REMOTE' as const },
                { cacheMaxSize: 500 },
                { cacheTTL: 60000 },
                { batchSize: 2000 },
                {
                    conflictStrategy: 'RETRY_LOCAL' as const,
                    cacheMaxSize: 1000,
                    cacheTTL: 120000,
                    batchSize: 5000
                }
            ];

            const startTime = performance.now();

            configs.forEach(config => {
                const adapter = new WatermelonDBAdapter(config);
                expect(adapter).toBeDefined();
                expect(adapter.dispatcherType).toBeDefined();
            });

            const endTime = performance.now();
            const avgTime = (endTime - startTime) / configs.length;

            console.log(`Average config validation time: ${avgTime.toFixed(2)}ms`);
            expect(avgTime).toBeLessThan(20); // Should be under 20ms per config
        });
    });

    describe('Concurrent adapter creation', () => {
        it('should handle concurrent adapter creation efficiently', async () => {
            const concurrency = 10;
            const iterations = 50;

            const createAdapter = async () => {
                const adapters = [];
                for (let i = 0; i < iterations; i++) {
                    adapters.push(new WatermelonDBAdapter({
                        cacheMaxSize: 200 + i,
                        batchSize: 500 + i
                    }));
                }
                return adapters;
            };

            const startTime = performance.now();

            const promises = Array.from({ length: concurrency }, createAdapter);
            const results = await Promise.all(promises);

            const endTime = performance.now();
            const totalTime = endTime - startTime;
            const totalAdapters = concurrency * iterations;

            console.log(`Concurrent creation: ${totalAdapters} adapters in ${totalTime.toFixed(2)}ms`);
            console.log(`Average per adapter: ${(totalTime / totalAdapters).toFixed(2)}ms`);

            expect(results).toHaveLength(concurrency);
            expect(results.every(batch => batch.length === iterations)).toBe(true);
            expect(totalTime / totalAdapters).toBeLessThan(10); // Should average under 10ms per adapter
        });
    });

    describe('Performance regression detection', () => {
        it('should maintain consistent performance characteristics', () => {
            const samples = 20;
            const times: number[] = [];

            for (let i = 0; i < samples; i++) {
                const startTime = performance.now();

                const adapter = new WatermelonDBAdapter({
                    conflictStrategy: 'ACCEPT_REMOTE',
                    cacheMaxSize: 1000,
                    cacheTTL: 60000,
                    batchSize: 2000
                });

                // Test multiple operations
                expect(adapter.isReady).toBeDefined();
                expect(adapter.dispatcherType).toBeDefined();
                expect(adapter.getSchemaVersion()).toBeDefined();

                const endTime = performance.now();
                times.push(endTime - startTime);
            }

            const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
            const stdDev = Math.sqrt(
                times.reduce((sq, time) => sq + Math.pow(time - avgTime, 2), 0) / times.length
            );

            console.log(`Performance consistency - Avg: ${avgTime.toFixed(2)}ms, StdDev: ${stdDev.toFixed(2)}ms`);

            // Performance should be consistent (low standard deviation)
            expect(stdDev / avgTime).toBeLessThan(0.5); // Coefficient of variation < 50%
            expect(avgTime).toBeLessThan(20); // Average should be reasonable
        });
    });
});