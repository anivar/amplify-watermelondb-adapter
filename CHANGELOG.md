# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2025-09-26

### Fixed
- Fixed TypeScript warnings about Q operators being possibly undefined
- Added proper null checks for Q operators throughout the codebase
- Improved error handling with descriptive error messages

## [1.1.0] - 2025-09-26

### Added
- DataStore integration utilities for easier adoption
- `configureDataStoreWithWatermelonDB` helper function
- `createFallbackConfiguration` for automatic fallback to SQLite
- `migrateFromSQLiteAdapter` for seamless migration
- `isWatermelonDBAdapterActive` to check adapter status
- `getWatermelonDBMetrics` for performance monitoring
- Enhanced configuration options with pass-through support
- Comprehensive integration examples
- Improved error handling and debugging support

### Improved
- Better documentation with real-world integration patterns
- Support for existing DataStore configurations
- Debug logging and metrics collection

## [1.0.0] - 2025-09-26

### Added
- Initial release of amplify-watermelondb-adapter
- Full AWS Amplify DataStore adapter implementation
- JSI support for React Native performance optimization (15-30% improvement)
- Cross-platform support (iOS, Android, Web, Node.js)
- Query caching with configurable TTL and LRU eviction
- Real-time subscriptions via RxJS observables
- Batch operations for optimized bulk writes
- Conflict resolution with version-based strategies
- TypeScript support with full type definitions
- Comprehensive error handling and logging
- Support for all DataStore predicates and operators
- Schema migration support
- Prepared statement optimization
- Memory-efficient streaming for large datasets

### Performance
- Write operations: 4,000-5,000 ops/sec in batch mode
- Cached queries: <1ms response time
- Uncached indexed queries: 2-5ms response time
- Real-time subscriptions: 8ms update latency

### Compatibility
- Node.js 20.0.0 or higher
- React Native 0.76.0 or higher (New Architecture)
- AWS Amplify Core 5.x and 6.x
- AWS Amplify DataStore 4.x and 5.x
- WatermelonDB 0.27.0 or higher

[1.0.0]: https://github.com/anivar/amplify-watermelondb-adapter/releases/tag/v1.0.0