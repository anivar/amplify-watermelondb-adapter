/**
 * DataStore integration helper for WatermelonDB adapter
 *
 * This module provides utilities to easily integrate WatermelonDB adapter
 * with AWS Amplify DataStore in existing applications.
 */

import { DataStore } from '@aws-amplify/datastore';
import { WatermelonDBAdapter } from './WatermelonDBAdapter';

export interface DataStoreConfig {
    authProviders?: any;
    syncExpressions?: any[];
    syncPageSize?: number;
    maxRecordsToSync?: number;
    fullSyncInterval?: number;
    subscriptionVariables?: any;
    errorHandler?: (error: any) => void;
}

export interface WatermelonDBIntegrationConfig {
    conflictStrategy?: 'ACCEPT_REMOTE' | 'RETRY_LOCAL';
    cacheMaxSize?: number;
    cacheTTL?: number;
    batchSize?: number;
    enableMetrics?: boolean;
    enableDebugLogging?: boolean;
}

/**
 * Configure DataStore with WatermelonDB adapter
 * Provides seamless integration with existing DataStore configurations
 */
export const configureDataStoreWithWatermelonDB = (
    dataStoreConfig: DataStoreConfig = {},
    watermelonConfig: WatermelonDBIntegrationConfig = {}
): boolean => {
    try {
        const adapter = new WatermelonDBAdapter({
            conflictStrategy: watermelonConfig.conflictStrategy || 'ACCEPT_REMOTE',
            cacheMaxSize: watermelonConfig.cacheMaxSize || 200,
            cacheTTL: watermelonConfig.cacheTTL || 10 * 60 * 1000, // 10 minutes
            batchSize: watermelonConfig.batchSize || 1000
        });

        // Configure DataStore with WatermelonDB adapter
        DataStore.configure({
            ...dataStoreConfig,
            storageAdapter: adapter as any
        });

        if (watermelonConfig.enableDebugLogging) {
            console.log('[WatermelonDB] DataStore configured successfully');
            console.log('[WatermelonDB] Dispatcher type:', (adapter as any).dispatcherType);
        }

        return true;
    } catch (error) {
        if (watermelonConfig.enableDebugLogging) {
            console.error('[WatermelonDB] Failed to configure adapter:', error);
        }
        return false;
    }
};

/**
 * Check if WatermelonDB adapter is active
 */
export const isWatermelonDBAdapterActive = (): boolean => {
    try {
        const storage = (DataStore as any)?.storage;
        return storage?.constructor?.name === 'WatermelonDBAdapter';
    } catch {
        return false;
    }
};

/**
 * Get performance metrics from WatermelonDB adapter
 */
export const getWatermelonDBMetrics = (): any => {
    try {
        const storage = (DataStore as any)?.storage;
        if (storage && typeof storage.dispatcherType === 'string') {
            return {
                dispatcherType: storage.dispatcherType,
                isReady: storage.isReady || false,
                schemaVersion: storage.getSchemaVersion?.() || 0
            };
        }
    } catch (error) {
        console.error('[WatermelonDB] Failed to get metrics:', error);
    }
    return null;
};

/**
 * Create a fallback configuration that tries WatermelonDB first
 * then falls back to the provided adapter if it fails
 */
export const createFallbackConfiguration = (
    dataStoreConfig: DataStoreConfig,
    fallbackAdapter: any,
    watermelonConfig?: WatermelonDBIntegrationConfig
): void => {
    const useWatermelonDB = configureDataStoreWithWatermelonDB(
        dataStoreConfig,
        watermelonConfig
    );

    if (!useWatermelonDB && fallbackAdapter) {
        // Fallback to provided adapter
        DataStore.configure({
            ...dataStoreConfig,
            storageAdapter: fallbackAdapter
        });

        if (watermelonConfig?.enableDebugLogging) {
            console.log('[WatermelonDB] Fell back to default adapter');
        }
    }
};

/**
 * Migration helper for existing SQLiteAdapter users
 */
export const migrateFromSQLiteAdapter = async (
    dataStoreConfig: DataStoreConfig,
    watermelonConfig?: WatermelonDBIntegrationConfig
): Promise<boolean> => {
    try {
        // Stop DataStore if running
        await DataStore.stop();

        // Configure with WatermelonDB adapter
        const success = configureDataStoreWithWatermelonDB(
            dataStoreConfig,
            watermelonConfig
        );

        if (success) {
            // Start DataStore with new adapter
            await DataStore.start();

            if (watermelonConfig?.enableDebugLogging) {
                console.log('[WatermelonDB] Successfully migrated from SQLiteAdapter');
            }
        }

        return success;
    } catch (error) {
        if (watermelonConfig?.enableDebugLogging) {
            console.error('[WatermelonDB] Migration failed:', error);
        }
        return false;
    }
};