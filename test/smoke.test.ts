import { describe, it, expect } from '@jest/globals';
import { WatermelonDBAdapter } from '../src/WatermelonDBAdapter';
import {
    configureDataStoreWithWatermelonDB,
    isWatermelonDBAdapterActive,
    getWatermelonDBMetrics
} from '../src/DataStoreIntegration';

describe('Smoke Tests', () => {
    it('should create WatermelonDBAdapter instance', () => {
        const adapter = new WatermelonDBAdapter();
        expect(adapter).toBeDefined();
        expect(adapter).toBeInstanceOf(WatermelonDBAdapter);
    });

    it('should create adapter with configuration', () => {
        const adapter = new WatermelonDBAdapter({
            conflictStrategy: 'ACCEPT_REMOTE',
            cacheMaxSize: 500,
            cacheTTL: 60000,
            batchSize: 2000
        });
        expect(adapter).toBeDefined();
        expect(adapter.isReady).toBe(false); // Not initialized yet
    });

    it('should export integration functions', () => {
        expect(configureDataStoreWithWatermelonDB).toBeDefined();
        expect(isWatermelonDBAdapterActive).toBeDefined();
        expect(getWatermelonDBMetrics).toBeDefined();
        expect(typeof configureDataStoreWithWatermelonDB).toBe('function');
        expect(typeof isWatermelonDBAdapterActive).toBe('function');
        expect(typeof getWatermelonDBMetrics).toBe('function');
    });

    it('should check adapter status', () => {
        const isActive = isWatermelonDBAdapterActive();
        expect(typeof isActive).toBe('boolean');
        expect(isActive).toBe(false); // Not configured yet
    });

    it('should return null metrics when not configured', () => {
        const metrics = getWatermelonDBMetrics();
        expect(metrics).toBeNull();
    });

    it('should have required adapter methods', () => {
        const adapter = new WatermelonDBAdapter();
        expect(adapter.setup).toBeDefined();
        expect(adapter.query).toBeDefined();
        expect(adapter.save).toBeDefined();
        expect(adapter.delete).toBeDefined();
        expect(adapter.batchSave).toBeDefined();
        expect(adapter.queryOne).toBeDefined();
        expect(adapter.clear).toBeDefined();
        expect(adapter.observe).toBeDefined();
        expect(adapter.stopObserve).toBeDefined();
        expect(adapter.getConflictHandler).toBeDefined();
        expect(adapter.getModelDefinition).toBeDefined();
        expect(adapter.batch).toBeDefined();
        expect(adapter.unsafeResetDatabase).toBeDefined();
    });

    it('should have configuration properties', () => {
        const adapter = new WatermelonDBAdapter({
            conflictStrategy: 'RETRY_LOCAL',
            cacheMaxSize: 1000
        });

        // These properties exist after instantiation
        expect(adapter).toHaveProperty('isReady');
        expect(adapter).toHaveProperty('dispatcherType');
        expect(adapter).toHaveProperty('getSchemaVersion');
    });
});