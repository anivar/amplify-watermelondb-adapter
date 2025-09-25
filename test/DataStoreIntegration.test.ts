import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { DataStore } from '@aws-amplify/datastore';
import {
    configureDataStoreWithWatermelonDB,
    isWatermelonDBAdapterActive,
    getWatermelonDBMetrics,
    createFallbackConfiguration,
    migrateFromSQLiteAdapter
} from '../src/DataStoreIntegration';

// Mock DataStore
jest.mock('@aws-amplify/datastore', () => ({
    DataStore: {
        configure: jest.fn(),
        clear: jest.fn(() => Promise.resolve()),
        start: jest.fn(() => Promise.resolve()),
        stop: jest.fn(() => Promise.resolve())
    }
}));

describe('DataStoreIntegration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset global state
        (global as any)._watermelonDBAdapter = undefined;
    });

    describe('configureDataStoreWithWatermelonDB', () => {
        it('should configure DataStore with WatermelonDB adapter', () => {
            const result = configureDataStoreWithWatermelonDB();

            expect(result).toBe(true);
            expect(DataStore.configure).toHaveBeenCalledTimes(1);
            expect(DataStore.configure).toHaveBeenCalledWith(
                expect.objectContaining({
                    storageAdapter: expect.any(Object)
                })
            );
        });

        it('should use custom configuration options', () => {
            const dataStoreConfig = {
                syncPageSize: 100,
                maxRecordsToSync: 10000,
                fullSyncInterval: 60
            };

            const watermelonConfig = {
                conflictStrategy: 'RETRY_LOCAL' as const,
                cacheMaxSize: 500,
                cacheTTL: 30000,
                batchSize: 2000
            };

            const result = configureDataStoreWithWatermelonDB(dataStoreConfig, watermelonConfig);

            expect(result).toBe(true);
            expect(DataStore.configure).toHaveBeenCalledWith(
                expect.objectContaining({
                    syncPageSize: 100,
                    maxRecordsToSync: 10000,
                    fullSyncInterval: 60,
                    storageAdapter: expect.any(Object)
                })
            );
        });

        it('should handle configuration errors gracefully', () => {
            // Force an error
            (DataStore.configure as jest.Mock).mockImplementationOnce(() => {
                throw new Error('Configuration failed');
            });

            const result = configureDataStoreWithWatermelonDB();

            expect(result).toBe(false);
        });

        it('should enable debug logging when specified', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

            configureDataStoreWithWatermelonDB({}, { enableDebugLogging: true });

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[WatermelonDB] DataStore configured successfully')
            );

            consoleSpy.mockRestore();
        });
    });

    describe('isWatermelonDBAdapterActive', () => {
        it('should return false when adapter is not configured', () => {
            expect(isWatermelonDBAdapterActive()).toBe(false);
        });

        it('should return true when adapter is configured', () => {
            configureDataStoreWithWatermelonDB();
            expect(isWatermelonDBAdapterActive()).toBe(true);
        });

        it('should return false when adapter is not ready', () => {
            (global as any)._watermelonDBAdapter = { isReady: false };
            expect(isWatermelonDBAdapterActive()).toBe(false);
        });
    });

    describe('getWatermelonDBMetrics', () => {
        it('should return null when adapter is not configured', () => {
            const metrics = getWatermelonDBMetrics();
            expect(metrics).toBeNull();
        });

        it('should return metrics when adapter is configured', () => {
            configureDataStoreWithWatermelonDB();

            // Mock adapter methods
            const mockAdapter = (global as any)._watermelonDBAdapter;
            mockAdapter.dispatcherType = 'lokijs';
            mockAdapter.getSchemaVersion = jest.fn(() => 1);

            const metrics = getWatermelonDBMetrics();

            expect(metrics).toEqual({
                isActive: true,
                dispatcherType: 'lokijs',
                schemaVersion: 1
            });
        });
    });

    describe('createFallbackConfiguration', () => {
        it('should configure WatermelonDB adapter with fallback', () => {
            const dataStoreConfig = { syncPageSize: 100 };
            const fallbackAdapter = { name: 'SQLiteAdapter' };

            createFallbackConfiguration(dataStoreConfig, fallbackAdapter);

            expect(DataStore.configure).toHaveBeenCalledTimes(1);
            expect(DataStore.configure).toHaveBeenCalledWith(
                expect.objectContaining({
                    syncPageSize: 100,
                    storageAdapter: expect.any(Object)
                })
            );
        });

        it('should use fallback adapter on error', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const fallbackAdapter = { name: 'SQLiteAdapter' };

            // Force WatermelonDB to fail
            (DataStore.configure as jest.Mock).mockImplementationOnce(() => {
                throw new Error('WatermelonDB failed');
            });

            createFallbackConfiguration({}, fallbackAdapter);

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to initialize WatermelonDB adapter')
            );
            expect(DataStore.configure).toHaveBeenCalledTimes(2);

            consoleSpy.mockRestore();
        });

        it('should log when debug is enabled', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
            const fallbackAdapter = { name: 'SQLiteAdapter' };

            createFallbackConfiguration(
                {},
                fallbackAdapter,
                { enableDebugLogging: true }
            );

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[WatermelonDB] Attempting to configure DataStore')
            );

            consoleSpy.mockRestore();
        });
    });

    describe('migrateFromSQLiteAdapter', () => {
        it('should migrate from SQLite to WatermelonDB', async () => {
            const dataStoreConfig = { syncPageSize: 100 };

            const result = await migrateFromSQLiteAdapter(dataStoreConfig);

            expect(result).toBe(true);
            expect(DataStore.stop).toHaveBeenCalled();
            expect(DataStore.clear).toHaveBeenCalled();
            expect(DataStore.configure).toHaveBeenCalled();
            expect(DataStore.start).toHaveBeenCalled();
        });

        it('should handle migration errors', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            (DataStore.stop as any).mockRejectedValue(new Error('Stop failed'));

            const result = await migrateFromSQLiteAdapter({});

            expect(result).toBe(false);
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Migration failed'),
                expect.any(Error)
            );

            consoleSpy.mockRestore();
        });

        it('should log progress when debug is enabled', async () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

            await migrateFromSQLiteAdapter(
                {},
                { enableDebugLogging: true }
            );

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[WatermelonDB] Starting migration')
            );
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[WatermelonDB] Migration completed')
            );

            consoleSpy.mockRestore();
        });
    });

    describe('Integration scenarios', () => {
        it('should handle complete setup flow', async () => {
            // Step 1: Configure
            const configured = configureDataStoreWithWatermelonDB({
                syncPageSize: 50,
                maxRecordsToSync: 5000
            });
            expect(configured).toBe(true);

            // Step 2: Check if active
            const isActive = isWatermelonDBAdapterActive();
            expect(isActive).toBe(true);

            // Step 3: Get metrics
            const metrics = getWatermelonDBMetrics();
            expect(metrics).toBeTruthy();
        });

        it('should handle migration flow', async () => {
            // Simulate existing SQLite setup
            (DataStore.configure as jest.Mock).mockClear();

            // Perform migration
            const migrated = await migrateFromSQLiteAdapter({
                syncPageSize: 100,
                fullSyncInterval: 30
            });

            expect(migrated).toBe(true);
            expect(DataStore.stop).toHaveBeenCalled();
            expect(DataStore.clear).toHaveBeenCalled();
            expect(DataStore.start).toHaveBeenCalled();

            // Verify new adapter is active
            const isActive = isWatermelonDBAdapterActive();
            expect(isActive).toBe(true);
        });

        it('should handle fallback scenario', () => {
            const fallbackAdapter = { name: 'SQLiteAdapter' };
            const configSpy = jest.spyOn(DataStore, 'configure');

            // First attempt with WatermelonDB
            createFallbackConfiguration(
                { syncPageSize: 75 },
                fallbackAdapter
            );

            expect(configSpy).toHaveBeenCalledTimes(1);

            // Simulate failure and fallback
            configSpy.mockClear();
            configSpy.mockImplementationOnce(() => {
                throw new Error('WatermelonDB init failed');
            });

            createFallbackConfiguration(
                { syncPageSize: 75 },
                fallbackAdapter
            );

            // Should have attempted WatermelonDB then fallback
            expect(configSpy).toHaveBeenCalledTimes(2);
        });
    });

    describe('Configuration validation', () => {
        it('should validate conflict strategy', () => {
            const result = configureDataStoreWithWatermelonDB({}, {
                conflictStrategy: 'ACCEPT_REMOTE'
            });
            expect(result).toBe(true);

            const result2 = configureDataStoreWithWatermelonDB({}, {
                conflictStrategy: 'RETRY_LOCAL'
            });
            expect(result2).toBe(true);
        });

        it('should validate cache configuration', () => {
            const result = configureDataStoreWithWatermelonDB({}, {
                cacheMaxSize: 1000,
                cacheTTL: 60000
            });
            expect(result).toBe(true);
        });

        it('should validate batch size', () => {
            const result = configureDataStoreWithWatermelonDB({}, {
                batchSize: 5000
            });
            expect(result).toBe(true);
        });

        it('should handle invalid configurations gracefully', () => {
            const result = configureDataStoreWithWatermelonDB({}, {
                cacheMaxSize: -1, // Invalid
                cacheTTL: 0 // Invalid
            });

            // Should still attempt configuration
            expect(DataStore.configure).toHaveBeenCalled();
        });
    });

    describe('Metrics collection', () => {
        it('should collect performance metrics when enabled', () => {
            const config = configureDataStoreWithWatermelonDB({}, {
                enableMetrics: true
            });

            expect(config).toBe(true);

            const metrics = getWatermelonDBMetrics();
            expect(metrics).toBeTruthy();
            expect(metrics?.isActive).toBe(true);
        });

        it('should provide dispatcher type in metrics', () => {
            configureDataStoreWithWatermelonDB();

            const mockAdapter = (global as any)._watermelonDBAdapter;
            mockAdapter.dispatcherType = 'jsi';

            const metrics = getWatermelonDBMetrics();
            expect(metrics?.dispatcherType).toBe('jsi');
        });

        it('should provide schema version in metrics', () => {
            configureDataStoreWithWatermelonDB();

            const mockAdapter = (global as any)._watermelonDBAdapter;
            mockAdapter.getSchemaVersion = jest.fn(() => 2);

            const metrics = getWatermelonDBMetrics();
            expect(metrics?.schemaVersion).toBe(2);
        });
    });
});