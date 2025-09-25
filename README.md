# amplify-watermelondb-adapter

High-performance WatermelonDB adapter for AWS Amplify DataStore with JSI support.

## Features

- 🚀 15-30% faster with JSI in React Native
- 📱 Cross-platform (iOS, Android, Web, Node.js)
- ⚡ Query caching with LRU eviction
- 🔄 Real-time subscriptions via RxJS
- 🎯 Full TypeScript support
- 💾 Batch operations
- 🔐 Conflict resolution strategies
- 📊 Performance optimized with indexing

## Installation

```bash
npm install amplify-watermelondb-adapter @nozbe/watermelondb
# or
yarn add amplify-watermelondb-adapter @nozbe/watermelondb
```

## Usage

```typescript
import { DataStore } from '@aws-amplify/datastore';
import { WatermelonDBAdapter } from 'amplify-watermelondb-adapter';
import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

// Create WatermelonDB database
const adapter = new SQLiteAdapter({
  dbName: 'myapp',
  jsi: true, // Enable JSI for better performance in React Native
});

const database = new Database({
  adapter,
  modelClasses: [],
});

// Configure DataStore with WatermelonDB adapter
DataStore.configure({
  storageAdapter: new WatermelonDBAdapter({
    database,
    conflictStrategy: 'ACCEPT_REMOTE',
    cacheMaxSize: 100,
    cacheTTL: 5 * 60 * 1000, // 5 minutes
  }),
});
```

## Configuration Options

```typescript
interface WatermelonDBAdapterConfig {
  database?: Database;           // WatermelonDB instance
  conflictStrategy?: 'ACCEPT_REMOTE' | 'RETRY_LOCAL'; // Default: ACCEPT_REMOTE
  cacheMaxSize?: number;          // Max cached queries (default: 100)
  cacheTTL?: number;              // Cache TTL in ms (default: 300000)
  batchSize?: number;             // Batch operation size (default: 1000)
}
```

## Advanced Features

### Real-time Subscriptions

```typescript
const subscription = adapter.observe(UserModel,
  user => user.active.eq(true)
).subscribe({
  next: (users) => console.log('Active users:', users),
  error: (error) => console.error('Error:', error)
});

// Cleanup
subscription.unsubscribe();
```

### Batch Operations

```typescript
await adapter.batch(
  { type: 'create', collection: 'users', prepareCreate: (user) => {...} },
  { type: 'update', record: existingUser },
  { type: 'delete', record: oldUser }
);
```

### Conflict Resolution

The adapter includes automatic conflict resolution using version vectors:

```typescript
// Automatic version-based resolution
const conflictHandler = adapter.getConflictHandler();
```

## Performance

- **Write Speed**: 4,000-5,000 ops/sec (batch mode)
- **Query Speed**: <1ms (cached), 2-5ms (uncached indexed)
- **React Native JSI**: 15-30% performance improvement
- **Memory**: Efficient LRU cache with configurable limits

## Platform Support

| Platform | SQLite | JSI Support | Performance |
|----------|--------|-------------|-------------|
| iOS | ✅ | ✅ | Excellent |
| Android | ✅ | ✅ | Excellent |
| Web | ✅ | ❌ | Good |
| Node.js | ✅ | ❌ | Good |

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Test
npm test

# Lint
npm run lint

# Watch mode
npm run build:watch
```

## License

This project is dual-licensed:
- **MIT License** (default) - for maximum compatibility
- **Apache 2.0 License** - for patent protection

You may choose either license for your use case.

## Contributing

Contributions are welcome! Please read our [contributing guidelines](CONTRIBUTING.md) first.

## Support

For issues and feature requests, please [create an issue](https://github.com/anivar/amplify-watermelondb-adapter/issues).