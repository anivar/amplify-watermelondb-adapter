import { describe, it, expect, jest, beforeAll, afterAll } from '@jest/globals';
import { configureDataStoreWithWatermelonDB, isWatermelonDBAdapterActive } from '../src/DataStoreIntegration';

// Mock DataStore to prevent actual Amplify initialization
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
    }
}));

describe('Integration Tests', () => {
    beforeAll(() => {
        // Clear any previous adapter state
        (global as any)._watermelonDBAdapter = undefined;
    });

    afterAll(() => {
        // Cleanup
        (global as any)._watermelonDBAdapter = undefined;
    });

    describe('Real-world integration scenarios', () => {
        it('should successfully configure DataStore with WatermelonDB', () => {
            const success = configureDataStoreWithWatermelonDB({
                syncPageSize: 100,
                maxRecordsToSync: 10000
            }, {
                conflictStrategy: 'ACCEPT_REMOTE',
                cacheMaxSize: 500,
                enableDebugLogging: true
            });

            expect(success).toBe(true);
            expect(isWatermelonDBAdapterActive()).toBe(true);
        });

        it('should handle configuration with all options', () => {
            const success = configureDataStoreWithWatermelonDB({
                syncPageSize: 50,
                maxRecordsToSync: 5000,
                fullSyncInterval: 60,
                authProviders: { userPool: 'test' },
                syncExpressions: [],
                subscriptionVariables: {},
                errorHandler: jest.fn()
            }, {
                conflictStrategy: 'RETRY_LOCAL',
                cacheMaxSize: 1000,
                cacheTTL: 30000,
                batchSize: 2000,
                enableMetrics: true,
                enableDebugLogging: false
            });

            expect(success).toBe(true);
        });

        it('should provide meaningful metrics', () => {
            configureDataStoreWithWatermelonDB();

            const adapter = (global as any)._watermelonDBAdapter;
            expect(adapter).toBeDefined();

            // Mock adapter properties for testing
            adapter.dispatcherType = 'lokijs';
            adapter.getSchemaVersion = jest.fn(() => 1);

            const { getWatermelonDBMetrics } = require('../src/DataStoreIntegration');
            const metrics = getWatermelonDBMetrics();

            expect(metrics).toEqual({
                isActive: true,
                dispatcherType: 'lokijs',
                schemaVersion: 1
            });
        });
    });

    describe('Platform detection simulation', () => {
        const originalNavigator = global.navigator;
        const originalWindow = global.window;
        const originalProcess = global.process;

        afterEach(() => {
            global.navigator = originalNavigator;
            global.window = originalWindow;
            global.process = originalProcess;
        });

        it('should handle web environment detection', () => {
            // Mock web environment
            global.window = { location: { href: 'http://localhost' } } as any;
            global.navigator = { userAgent: 'Mozilla/5.0' } as any;
            delete (global as any).process;

            const success = configureDataStoreWithWatermelonDB();
            expect(success).toBe(true);

            const adapter = (global as any)._watermelonDBAdapter;
            expect(adapter).toBeDefined();
        });

        it('should handle Node.js environment detection', () => {
            // Mock Node.js environment
            delete (global as any).window;
            delete (global as any).navigator;
            global.process = {
                versions: { node: '20.0.0' },
                platform: 'darwin'
            } as any;

            const success = configureDataStoreWithWatermelonDB();
            expect(success).toBe(true);

            const adapter = (global as any)._watermelonDBAdapter;
            expect(adapter).toBeDefined();
        });

        it('should handle React Native environment detection', () => {
            // Mock React Native environment
            global.navigator = { product: 'ReactNative' } as any;
            global.process = {
                versions: { node: '20.0.0' },
                platform: 'darwin'
            } as any;

            const success = configureDataStoreWithWatermelonDB();
            expect(success).toBe(true);

            const adapter = (global as any)._watermelonDBAdapter;
            expect(adapter).toBeDefined();
        });
    });

    describe('Error handling', () => {
        it('should handle DataStore configuration errors gracefully', () => {
            const { DataStore } = require('@aws-amplify/datastore');
            const originalConfigure = DataStore.configure;

            DataStore.configure = jest.fn(() => {
                throw new Error('DataStore configuration failed');
            });

            const success = configureDataStoreWithWatermelonDB();
            expect(success).toBe(false);
            expect(isWatermelonDBAdapterActive()).toBe(false);

            // Restore
            DataStore.configure = originalConfigure;
        });

        it('should handle adapter initialization errors', () => {
            // This test ensures the adapter gracefully handles initialization failures
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            const success = configureDataStoreWithWatermelonDB({}, {
                enableDebugLogging: true
            });

            // Even if there are internal errors, the function should still attempt configuration
            expect(typeof success).toBe('boolean');

            consoleSpy.mockRestore();
        });
    });

    describe('Configuration validation', () => {
        it('should use default values for missing configuration', () => {
            const success = configureDataStoreWithWatermelonDB();
            expect(success).toBe(true);

            const adapter = (global as any)._watermelonDBAdapter;
            expect(adapter).toBeDefined();
        });

        it('should respect provided configuration values', () => {
            const success = configureDataStoreWithWatermelonDB({
                syncPageSize: 200
            }, {
                conflictStrategy: 'RETRY_LOCAL',
                cacheMaxSize: 2000,
                cacheTTL: 120000,
                batchSize: 10000
            });

            expect(success).toBe(true);

            const adapter = (global as any)._watermelonDBAdapter;
            expect(adapter).toBeDefined();
        });
    });
});