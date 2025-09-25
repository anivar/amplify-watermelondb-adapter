export { WatermelonDBAdapter } from './WatermelonDBAdapter';
export type { WatermelonDBAdapterConfig } from './WatermelonDBAdapter';

// DataStore integration utilities
export {
    configureDataStoreWithWatermelonDB,
    isWatermelonDBAdapterActive,
    getWatermelonDBMetrics,
    createFallbackConfiguration,
    migrateFromSQLiteAdapter
} from './DataStoreIntegration';

export type {
    DataStoreConfig,
    WatermelonDBIntegrationConfig
} from './DataStoreIntegration';