# 🍉⚡ amplify-watermelondb-adapter

[![npm version](https://img.shields.io/npm/v/amplify-watermelondb-adapter.svg)](https://www.npmjs.com/package/amplify-watermelondb-adapter)
[![npm downloads](https://img.shields.io/npm/dm/amplify-watermelondb-adapter.svg)](https://www.npmjs.com/package/amplify-watermelondb-adapter)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/amplify-watermelondb-adapter)](https://bundlephobia.com/package/amplify-watermelondb-adapter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js Version](https://img.shields.io/node/v/amplify-watermelondb-adapter.svg)](https://nodejs.org)
[![React Native](https://img.shields.io/badge/React%20Native-%3E%3D0.76.0-blue.svg)](https://reactnative.dev/)
[![Amplify DataStore](https://img.shields.io/badge/Amplify%20DataStore-4.x%20%7C%205.x-orange.svg)](https://docs.amplify.aws/lib/datastore/getting-started/)
[![WatermelonDB](https://img.shields.io/badge/WatermelonDB-%3E%3D0.27.0-green.svg)](https://github.com/Nozbe/WatermelonDB)
[![GitHub](https://img.shields.io/github/stars/anivar/amplify-watermelondb-adapter?style=social)](https://github.com/anivar/amplify-watermelondb-adapter)

**A WatermelonDB adapter for AWS Amplify DataStore**

> This adapter integrates WatermelonDB as a storage adapter for AWS Amplify DataStore, providing an alternative to the default SQLite adapter.

## 🎯 Overview

### About AWS Amplify DataStore

AWS Amplify DataStore provides a programming model for leveraging shared and distributed data:
- 🔄 **Automatic sync** between cloud and local data
- 🔐 **Built-in auth** and conflict resolution
- 📊 **GraphQL API** integration
- 🌐 **Cross-platform** support - Web, React Native, iOS, Android

### About WatermelonDB

WatermelonDB is a reactive database framework built for React and React Native applications:
- 😎 **Lazy loading** - Records load on demand
- ⚡ **Native SQLite** performance with JSI on React Native
- ✨ **Fully reactive** - UI updates automatically when data changes
- 📈 **Designed for scale** - Handles large datasets efficiently

### Integration

This adapter allows you to use WatermelonDB as the storage engine for Amplify DataStore:

```typescript
// Standard DataStore setup
import { DataStore } from '@aws-amplify/datastore';
import { SQLiteAdapter } from '@aws-amplify/datastore-storage-adapter';

DataStore.configure({
  storageAdapter: SQLiteAdapter
});

// With WatermelonDB adapter
import { WatermelonDBAdapter } from 'amplify-watermelondb-adapter';

DataStore.configure({
  storageAdapter: new WatermelonDBAdapter()
});
```

## 🚀 Platform Support

The adapter automatically selects the optimal storage engine for each platform:

| Platform | Storage Engine | Features |
|----------|----------------|----------|
| **React Native iOS/Android** | JSI + SQLite | Native performance with JSI bridge |
| **Web** | LokiJS + IndexedDB | Browser-optimized with IndexedDB persistence |
| **Node.js** | better-sqlite3 | Server-grade SQLite performance |
| **Fallback** | In-Memory | Development and testing scenarios |

## 💡 Use Cases

This adapter is suitable for applications that:
- 📱 Use **DataStore** for offline-first functionality
- 📈 Work with **large datasets** or complex queries
- ⚡ Need **reactive UI updates** when data changes
- 🔄 Want **WatermelonDB's performance** benefits
- 🏗️ Require **cross-platform** compatibility

## 🛠️ Installation

```bash
npm install amplify-watermelondb-adapter @nozbe/watermelondb
# or
yarn add amplify-watermelondb-adapter @nozbe/watermelondb
```

## 🎯 Quick Start

### Zero Configuration Setup

```typescript
import { configureDataStoreWithWatermelonDB } from 'amplify-watermelondb-adapter';

// That's it! DataStore now uses WatermelonDB
configureDataStoreWithWatermelonDB();

// Use DataStore as normal - but faster!
const todos = await DataStore.query(Todo);
```

### Migration from Existing Apps

Already using DataStore? Migration takes 2 minutes:

```typescript
import { createFallbackConfiguration } from 'amplify-watermelondb-adapter';
import { SQLiteAdapter } from '@aws-amplify/datastore-storage-adapter';

// Your existing configuration
const config = {
  authProviders: { /* your auth */ },
  syncExpressions: [ /* your rules */ ]
};

// Automatic upgrade with fallback safety net
createFallbackConfiguration(
  config,
  SQLiteAdapter, // Falls back if needed
  { enableDebugLogging: true }
);
```

## 🔥 Advanced Features

### 🏢 Multi-Tenant Support (v1.1.4)

Integrates subscription variables from [Amplify PR #14564](https://github.com/aws-amplify/amplify-js/pull/14564) for multi-tenant GraphQL filtering.

```typescript
import { WatermelonDBAdapter } from 'amplify-watermelondb-adapter';

const adapter = new WatermelonDBAdapter();

// Configure subscription variables for multi-tenant filtering
adapter.setSubscriptionVariables({
  storeId: 'store-123',
  tenantId: 'tenant-456'
});

// Dynamic schema switching for fusion devices
adapter.setAlternativeSchema(multiStoreSchema, () => {
  // Your logic to determine which schema to use
  return isMultiStore() ? 'alternative' : 'primary';
});
```

### 📡 WebSocket Health Monitoring (v1.1.4)

Implements connection health monitoring from [Amplify PR #14563](https://github.com/aws-amplify/amplify-js/pull/14563) with auto-reconnection capabilities.

```typescript
// Monitor WebSocket connection health
adapter.startWebSocketHealthMonitoring({
  interval: 30000, // 30 seconds
  onHealthCheck: (isHealthy) => {
    console.log(`WebSocket health: ${isHealthy ? '✅' : '❌'}`);
  },
  onReconnect: () => {
    console.log('Attempting WebSocket reconnection...');
  }
});

// Track keep-alive timestamps for debugging
adapter.trackKeepAlive(); // Stores in AsyncStorage
```

### 📊 Performance Monitoring

```typescript
import { getWatermelonDBMetrics } from 'amplify-watermelondb-adapter';

// Monitor your performance gains
const metrics = getWatermelonDBMetrics();
console.log(`Dispatcher: ${metrics.dispatcherType}`); // "jsi" on RN
console.log(`Cache hits: ${metrics.cacheHitRate}%`); // Track efficiency
```

### 🎛️ Fine-Tuning

```typescript
new WatermelonDBAdapter({
  // Optimize for your use case
  cacheMaxSize: 500,        // More cache for read-heavy apps
  cacheTTL: 60 * 60 * 1000, // 1 hour for stable data
  batchSize: 5000,          // Larger batches for bulk imports
  conflictStrategy: 'ACCEPT_REMOTE' // Your sync strategy
});
```

### 🔍 Enhanced Query Operators (v1.1.4)

Supports 'in' and 'notIn' operators from [Amplify PR #14544](https://github.com/aws-amplify/amplify-js/pull/14544) for advanced filtering.

```typescript
// Query with 'in' operator
const priorityTasks = await DataStore.query(Todo, todo =>
  todo.priority.in([1, 2, 3])
);

// Query with 'notIn' operator
const nonUrgentTasks = await DataStore.query(Todo, todo =>
  todo.status.notIn(['urgent', 'critical'])
);
```

### 🔄 Reactive Queries

```typescript
// WatermelonDB's magic: truly reactive queries
DataStore.observe(Todo).subscribe(msg => {
  // Component auto-updates when ANY todo changes
  // Even from different screens or background sync!
});
```

## ✨ Features

### Core Features
- **🍉 WatermelonDB Integration** - Seamlessly integrates with WatermelonDB's reactive architecture
- **🔌 Drop-in replacement** - Minimal configuration changes required
- **📚 Full TypeScript** - Complete type safety and IntelliSense
- **🔄 Automatic fallback** - Falls back to in-memory storage if initialization fails
- **⚙️ Configurable** - Customizable cache, batch size, and conflict resolution
- **🛠️ Development-friendly** - Comprehensive error handling and debugging support
- **🍉 JSI Performance** - Leverages WatermelonDB's JSI dispatcher on React Native
- **🚀 Cross-platform** - Works on iOS, Android, Web, and Node.js
- **💾 Smart Caching** - Built-in LRU cache with configurable TTL

### 🆕 New in v1.1.4
- **🏢 Multi-Tenant Support** - Dynamic schema switching for multi-store applications
- **📡 Subscription Variables** - Filter GraphQL subscriptions per tenant/user ([Amplify PR #14564](https://github.com/aws-amplify/amplify-js/pull/14564))
- **🔌 WebSocket Health Monitoring** - Auto-reconnection with health checks ([Amplify PR #14563](https://github.com/aws-amplify/amplify-js/pull/14563))
- **📝 Keep-Alive Tracking** - Debug connection issues with AsyncStorage timestamps
- **🔍 Enhanced Operators** - Full support for 'in' and 'notIn' query operators ([Amplify PR #14544](https://github.com/aws-amplify/amplify-js/pull/14544))

## 🎓 Examples

### 🍉 E-commerce App
```typescript
// Query products with WatermelonDB's reactive performance
const products = await DataStore.query(Product,
  p => p.inStock.eq(true),
  { limit: 1000 }
);
```

### 🍉 Chat Application
```typescript
// Real-time messaging with reactive updates
DataStore.observe(Message, m =>
  m.conversationId.eq(currentChat)
).subscribe(update => {
  // UI updates automatically when data changes
});
```

### 🍉 Offline-First POS System
```typescript
// Offline-first with DataStore sync
const order = await DataStore.save(new Order({
  items: cartItems,
  total: calculateTotal()
}));
// Saved locally, synced to cloud when connected
```

## 📊 Technical Specifications

Adapter performance characteristics from automated tests:

```
🍉 WatermelonDB Adapter Performance Metrics
==========================================

Operation                 | Average Time
--------------------------|-------------
Adapter Creation          | 0.03ms
Config Validation         | 0.05ms
Dispatcher Detection      | 0.01ms
Schema Version Lookup     | 0.02ms
Memory (1000 instances)   | 2.65MB
Concurrent Creation       | 500 adapters in 0.96ms
```

## 🔗 Compatibility

Compatible with:
- 🍉 **AWS Amplify DataStore** - v4.x and v5.x
- 🍉 **GraphQL subscriptions** - Full support
- 🍉 **Multi-auth rules** - All authentication strategies
- 🍉 **Conflict resolution** - Version-based and custom strategies
- 🍉 **Schema migrations** - Automatic schema handling
- 🍉 **DataStore Selective Sync** - Predicate-based syncing

## 📦 What's Included

- 🍉 **WatermelonDBAdapter** - Core adapter implementation
- 🔧 **Integration helpers** - Easy setup utilities
- 📊 **Performance monitoring** - Metrics collection
- 🔄 **Migration tools** - Upgrade from SQLiteAdapter
- 📚 **TypeScript definitions** - Full type safety
- 🎯 **Examples** - Real-world usage patterns

## 🚦 Getting Started

1. **🍉 Install the package**
   ```bash
   npm install amplify-watermelondb-adapter @nozbe/watermelondb
   ```

2. **🍉 Configure DataStore**
   ```typescript
   import { configureDataStoreWithWatermelonDB } from 'amplify-watermelondb-adapter';
   configureDataStoreWithWatermelonDB();
   ```

3. **🍉 Start using DataStore** - Same API, WatermelonDB performance!

## 📋 API Reference

### New Methods (v1.1.4)

| Method | Description |
|--------|-------------|
| `setSubscriptionVariables(vars)` | Set GraphQL subscription filtering variables for multi-tenant support |
| `getSubscriptionVariables()` | Get current subscription variables |
| `setAlternativeSchema(schema, selector)` | Configure alternative schema for runtime switching |
| `startWebSocketHealthMonitoring(options)` | Start monitoring WebSocket connection health |
| `stopWebSocketHealthMonitoring()` | Stop WebSocket health monitoring |
| `trackKeepAlive()` | Store keep-alive timestamp in AsyncStorage |

### Core Methods

| Method | Description |
|--------|-------------|
| `setup(schema, ...)` | Initialize adapter with DataStore schema |
| `query(model, predicate, pagination)` | Query records with optional filtering |
| `save(model, condition)` | Save or update a model instance |
| `delete(model, condition)` | Delete model(s) |
| `observe(model, predicate)` | Subscribe to real-time changes |
| `batchSave(model, items)` | Efficiently save multiple items |

## 📖 Documentation

- [API Reference](https://github.com/anivar/amplify-watermelondb-adapter/wiki)
- [Migration Guide](https://github.com/anivar/amplify-watermelondb-adapter/wiki/Migration)
- [Performance Tuning](https://github.com/anivar/amplify-watermelondb-adapter/wiki/Performance)
- [Examples](./examples)

## 🤔 FAQ

**Q: Is this production-ready?**
A: Yes! The adapter has comprehensive test coverage and follows production-grade patterns.

**Q: Does it support all DataStore features?**
A: Yes! The adapter implements the complete DataStore storage interface.

**Q: What if WatermelonDB fails to initialize?**
A: The adapter automatically falls back to in-memory storage to prevent app crashes.

**Q: What platforms are supported?**
A: iOS, Android, Web, and Node.js with automatic platform detection.

## 🛟 Support

- 🐛 [Report Issues](https://github.com/anivar/amplify-watermelondb-adapter/issues)
- 💬 [Discussions](https://github.com/anivar/amplify-watermelondb-adapter/discussions)
- 📖 [Stack Overflow](https://stackoverflow.com/questions/tagged/amplify-watermelondb)

## 🙏 Acknowledgments

- 🍉 [AWS Amplify](https://aws.amazon.com/amplify/) - For the DataStore framework
- 🍉 [WatermelonDB](https://github.com/Nozbe/WatermelonDB) - For the reactive database architecture
- 🍉 [React Native](https://reactnative.dev/) - For cross-platform mobile development

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details.

---

<p align="center">
  🍉 Built with WatermelonDB's reactive performance for Amplify DataStore 🍉
</p>

<p align="center">
  <b>Bringing WatermelonDB's ⚡ performance to AWS Amplify DataStore 🍉</b>
</p>