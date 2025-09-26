/**
 * Example: Integrating WatermelonDB adapter with existing DataStore configuration
 * Based on real-world implementation patterns
 */

import { DataStore } from '@aws-amplify/datastore';
import { SQLiteAdapter } from '@aws-amplify/datastore-storage-adapter';
import {
    configureDataStoreWithWatermelonDB,
    createFallbackConfiguration,
    getWatermelonDBMetrics,
    isWatermelonDBAdapterActive
} from 'amplify-watermelondb-adapter';

// Example 1: Simple integration with auto-fallback
export const setupDataStoreWithFallback = async (licenseKey, tenantId, syncExpressions) => {
    const dataStoreConfig = {
        authProviders: {
            functionAuthProvider: async () => ({
                token: licenseKey
            })
        },
        syncExpressions: syncExpressions,
        syncPageSize: 1000,
        maxRecordsToSync: 100000,
        fullSyncInterval: 24 * 60 * 365, // 1 year
        errorHandler: (error) => {
            console.error('DataStore error:', error);
        }
    };

    // Try WatermelonDB first, fallback to SQLite if it fails
    createFallbackConfiguration(
        dataStoreConfig,
        SQLiteAdapter,
        {
            conflictStrategy: 'ACCEPT_REMOTE',
            cacheMaxSize: 200,
            cacheTTL: 10 * 60 * 1000, // 10 minutes
            batchSize: 1000,
            enableDebugLogging: true,
            enableMetrics: true
        }
    );

    // Start DataStore
    try {
        await DataStore.start();

        // Log which adapter is active
        if (isWatermelonDBAdapterActive()) {
            const metrics = getWatermelonDBMetrics();
            console.log('✅ WatermelonDB adapter active:', metrics);
        } else {
            console.log('ℹ️ Using SQLite adapter (fallback)');
        }
    } catch (error) {
        console.error('Failed to start DataStore:', error);
    }
};

// Example 2: Manual configuration with error handling
export const manualSetup = async () => {
    const config = {
        authProviders: {
            functionAuthProvider: async () => ({
                token: 'your-license-key'
            })
        },
        syncExpressions: [
            // Your sync expressions
        ],
        syncPageSize: 1000,
        maxRecordsToSync: 100000
    };

    // Try WatermelonDB adapter
    const success = configureDataStoreWithWatermelonDB(config, {
        conflictStrategy: 'ACCEPT_REMOTE',
        cacheMaxSize: 300,
        cacheTTL: 15 * 60 * 1000, // 15 minutes
        enableDebugLogging: true
    });

    if (!success) {
        console.warn('WatermelonDB adapter failed, using SQLite');
        DataStore.configure({
            ...config,
            storageAdapter: SQLiteAdapter
        });
    }

    await DataStore.start();
};

// Example 3: React Native component integration
import React, { useEffect, useState } from 'react';

export const DataStoreSyncComponent = ({ licenseKey, tenantId }) => {
    const [adapterType, setAdapterType] = useState(null);
    const [metrics, setMetrics] = useState(null);

    useEffect(() => {
        const initDataStore = async () => {
            const config = {
                authProviders: {
                    functionAuthProvider: async () => ({
                        token: licenseKey
                    })
                },
                syncPageSize: 1000,
                maxRecordsToSync: 100000
            };

            // Configure with WatermelonDB
            const success = configureDataStoreWithWatermelonDB(config, {
                conflictStrategy: 'ACCEPT_REMOTE',
                cacheMaxSize: 200,
                cacheTTL: 10 * 60 * 1000,
                enableDebugLogging: __DEV__ // Only in development
            });

            if (success) {
                setAdapterType('WatermelonDB');
                const metrics = getWatermelonDBMetrics();
                setMetrics(metrics);
            } else {
                setAdapterType('SQLite');
                // Fallback configuration
                DataStore.configure({
                    ...config,
                    storageAdapter: SQLiteAdapter
                });
            }

            // Start syncing
            await DataStore.start();
        };

        initDataStore().catch(console.error);

        // Cleanup
        return () => {
            DataStore.stop().catch(console.error);
        };
    }, [licenseKey, tenantId]);

    return (
        <View>
            <Text>Adapter: {adapterType}</Text>
            {metrics && (
                <View>
                    <Text>Dispatcher: {metrics.dispatcherType}</Text>
                    <Text>Ready: {metrics.isReady ? 'Yes' : 'No'}</Text>
                    <Text>Schema Version: {metrics.schemaVersion}</Text>
                </View>
            )}
        </View>
    );
};

// Example 4: Migration from existing SQLite setup
export const migrateExistingApp = async () => {
    // Your existing DataStore configuration
    const existingConfig = {
        authProviders: { /* ... */ },
        syncExpressions: [ /* ... */ ],
        syncPageSize: 1000,
        // ... other config
    };

    // Stop current DataStore
    await DataStore.stop();

    // Migrate to WatermelonDB
    const migrationSuccess = await migrateFromSQLiteAdapter(
        existingConfig,
        {
            conflictStrategy: 'ACCEPT_REMOTE',
            cacheMaxSize: 200,
            cacheTTL: 10 * 60 * 1000,
            enableDebugLogging: true
        }
    );

    if (migrationSuccess) {
        console.log('✅ Successfully migrated to WatermelonDB adapter');
        console.log('Performance improvement: ~15-30% expected');
    } else {
        console.warn('Migration failed, continuing with SQLite');
        // Continue with existing setup
        DataStore.configure({
            ...existingConfig,
            storageAdapter: SQLiteAdapter
        });
        await DataStore.start();
    }
};