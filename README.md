# amplify-watermelondb-adapter

[![npm version](https://img.shields.io/npm/v/amplify-watermelondb-adapter.svg)](https://www.npmjs.com/package/amplify-watermelondb-adapter)
[![npm downloads](https://img.shields.io/npm/dm/amplify-watermelondb-adapter.svg)](https://www.npmjs.com/package/amplify-watermelondb-adapter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/amplify-watermelondb-adapter.svg)](https://nodejs.org)
[![React Native](https://img.shields.io/badge/React%20Native-%3E%3D0.76.0-blue.svg)](https://reactnative.dev/)

High-performance WatermelonDB adapter for AWS Amplify DataStore with JSI support.

## Features

- 🚀 **JSI Support** - 15-30% performance improvement in React Native
- 📱 **Cross-Platform** - Works on iOS, Android, Web, and Node.js
- ⚡ **Query Caching** - LRU cache with configurable TTL
- 🔄 **Real-time Subscriptions** - Observable queries with RxJS
- 📦 **Batch Operations** - Optimized bulk writes
- 🔐 **Conflict Resolution** - Automatic version-based conflict handling
- 🏗️ **New Architecture Ready** - Full support for React Native 0.76+

## Installation

```bash
npm install amplify-watermelondb-adapter @nozbe/watermelondb
```

or

```bash
yarn add amplify-watermelondb-adapter @nozbe/watermelondb
```

## Requirements

- Node.js 20.0.0 or higher
- React Native 0.76.0 or higher (optional, for React Native projects)
- AWS Amplify DataStore 4.x or 5.x
- WatermelonDB 0.27.0 or higher

## Basic Usage

```typescript
import { DataStore } from '@aws-amplify/datastore';
import { WatermelonDBAdapter } from 'amplify-watermelondb-adapter';

// Configure DataStore with WatermelonDB adapter
DataStore.configure({
  storageAdapter: new WatermelonDBAdapter({
    // Optional configuration
    conflictStrategy: 'ACCEPT_REMOTE',
    cacheMaxSize: 100,
    cacheTTL: 5 * 60 * 1000, // 5 minutes
  })
});

// Use DataStore as normal
const users = await DataStore.query(User);
await DataStore.save(new User({ name: 'John' }));
```

## Integration with Existing Apps

### Easy Migration with Fallback

For existing apps using SQLiteAdapter, use our migration helper with automatic fallback:

```typescript
import { createFallbackConfiguration } from 'amplify-watermelondb-adapter';
import { SQLiteAdapter } from '@aws-amplify/datastore-storage-adapter';

// Your existing DataStore configuration
const dataStoreConfig = {
  authProviders: { /* your auth */ },
  syncExpressions: [ /* your sync rules */ ],
  syncPageSize: 1000,
  maxRecordsToSync: 100000
};

// Automatically try WatermelonDB, fallback to SQLite if needed
createFallbackConfiguration(
  dataStoreConfig,
  SQLiteAdapter, // Your fallback adapter
  {
    conflictStrategy: 'ACCEPT_REMOTE',
    enableDebugLogging: true
  }
);

await DataStore.start();
```

### Check Active Adapter

```typescript
import { isWatermelonDBAdapterActive, getWatermelonDBMetrics } from 'amplify-watermelondb-adapter';

if (isWatermelonDBAdapterActive()) {
  const metrics = getWatermelonDBMetrics();
  console.log('Using WatermelonDB with:', metrics.dispatcherType);
  // Output: "Using WatermelonDB with: jsi" (on React Native)
}
```

## React Native Setup

For React Native projects with JSI support:

```typescript
import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

// Create WatermelonDB with JSI
const adapter = new SQLiteAdapter({
  dbName: 'myapp',
  jsi: true, // Enable JSI for better performance
});

const database = new Database({
  adapter,
  modelClasses: [],
});

// Pass to adapter
DataStore.configure({
  storageAdapter: new WatermelonDBAdapter({
    database,
  })
});
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `database` | `Database` | auto | WatermelonDB instance |
| `conflictStrategy` | `'ACCEPT_REMOTE' \| 'RETRY_LOCAL'` | `'ACCEPT_REMOTE'` | Conflict resolution strategy |
| `cacheMaxSize` | `number` | `100` | Maximum number of cached queries |
| `cacheTTL` | `number` | `300000` | Cache time-to-live in milliseconds |
| `batchSize` | `number` | `1000` | Maximum batch operation size |

## Performance

Benchmarks on React Native with JSI enabled:

| Operation | Speed | Notes |
|-----------|-------|-------|
| Write | 4,000-5,000 ops/sec | Batch mode |
| Query (cached) | <1ms | From LRU cache |
| Query (uncached) | 2-5ms | Indexed query |
| Subscription | 8ms | Real-time updates |

## Platform Support

| Platform | Supported | Adapter Used |
|----------|-----------|--------------|
| iOS | ✅ | SQLite with JSI |
| Android | ✅ | SQLite with JSI |
| Web | ✅ | LokiJS with IndexedDB |
| Node.js | ✅ | SQLite (better-sqlite3) |

## API Documentation

### Constructor

```typescript
new WatermelonDBAdapter(config?: WatermelonDBAdapterConfig)
```

### Methods

All standard DataStore adapter methods are implemented:

- `setup()` - Initialize the adapter
- `query()` - Query records
- `save()` - Save a record
- `delete()` - Delete records
- `batchSave()` - Batch save operations
- `queryOne()` - Query single record
- `clear()` - Clear all data
- `observe()` - Observe changes
- `stopObserve()` - Stop observing

## Examples

### Query with Predicates

```typescript
const activeTodos = await DataStore.query(Todo,
  todo => todo.completed.eq(false)
);
```

### Batch Operations

```typescript
const todos = [
  new Todo({ title: 'Task 1' }),
  new Todo({ title: 'Task 2' }),
  new Todo({ title: 'Task 3' })
];

await DataStore.save(todos);
```

### Real-time Subscriptions

```typescript
const subscription = DataStore.observe(Todo).subscribe(
  msg => console.log(msg.model, msg.opType)
);

// Later: cleanup
subscription.unsubscribe();
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to contribute.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 🐛 [Report Issues](https://github.com/anivar/amplify-watermelondb-adapter/issues)
- 💬 [Discussions](https://github.com/anivar/amplify-watermelondb-adapter/discussions)
- 📖 [Documentation](https://github.com/anivar/amplify-watermelondb-adapter/wiki)

## Acknowledgments

- [AWS Amplify](https://aws.amazon.com/amplify/) for the DataStore framework
- [WatermelonDB](https://github.com/Nozbe/WatermelonDB) for the reactive database
- [React Native](https://reactnative.dev/) community for JSI support