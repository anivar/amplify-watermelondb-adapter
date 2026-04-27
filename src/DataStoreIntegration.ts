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
 * Stores adapter reference on global for diagnostics and metrics access.
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
            storageAdapter: adapter
        });

        // Store adapter reference for diagnostics (after successful configure)
        (global as any)._watermelonDBAdapter = adapter;

        if (watermelonConfig.enableDebugLogging) {
            console.log('[WatermelonDB] DataStore configured successfully');
            console.log('[WatermelonDB] Dispatcher type:', adapter.dispatcherType);
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
        const adapter = (global as any)._watermelonDBAdapter;
        return adapter instanceof WatermelonDBAdapter;
    } catch {
        return false;
    }
};

/**
 * Get performance metrics from WatermelonDB adapter
 */
export const getWatermelonDBMetrics = (): {
    isActive: boolean;
    dispatcherType: string;
    schemaVersion: number;
} | null => {
    try {
        const adapter = (global as any)._watermelonDBAdapter;
        if (adapter && adapter instanceof WatermelonDBAdapter) {
            return {
                isActive: true,
                dispatcherType: adapter.dispatcherType,
                schemaVersion: adapter.getSchemaVersion?.() || 0
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
    if (watermelonConfig?.enableDebugLogging) {
        console.log('[WatermelonDB] Attempting to configure DataStore with WatermelonDB adapter');
    }

    const useWatermelonDB = configureDataStoreWithWatermelonDB(
        dataStoreConfig,
        watermelonConfig
    );

    if (!useWatermelonDB && fallbackAdapter) {
        console.warn('[WatermelonDB] Failed to initialize WatermelonDB adapter, falling back to provided adapter');

        // Fallback to provided adapter
        DataStore.configure({
            ...dataStoreConfig,
            storageAdapter: fallbackAdapter
        });
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
        if (watermelonConfig?.enableDebugLogging) {
            console.log('[WatermelonDB] Starting migration from SQLiteAdapter');
        }

        // Stop DataStore if running
        await DataStore.stop();

        // Clear existing data for clean migration
        await DataStore.clear();

        // Configure with WatermelonDB adapter
        const success = configureDataStoreWithWatermelonDB(
            dataStoreConfig,
            watermelonConfig
        );

        if (success) {
            // Start DataStore with new adapter
            await DataStore.start();

            if (watermelonConfig?.enableDebugLogging) {
                console.log('[WatermelonDB] Migration completed successfully');
            }
        }

        return success;
    } catch (error) {
        console.error('[WatermelonDB] Migration failed:', error);
        return false;
    }
};