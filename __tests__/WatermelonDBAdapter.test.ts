import { WatermelonDBAdapter } from '../src/WatermelonDBAdapter';
import { ModelInit, PersistentModel, PersistentModelConstructor } from '@aws-amplify/datastore';

// Mock WatermelonDB
jest.mock('@nozbe/watermelondb', () => ({
  Database: jest.fn().mockImplementation(() => ({
    adapter: {
      underlyingAdapter: {
        dbName: 'test',
      },
    },
    collections: {
      get: jest.fn(),
    },
    write: jest.fn((fn) => fn()),
    batch: jest.fn(),
  })),
}));

jest.mock('@nozbe/watermelondb/adapters/sqlite', () => ({
  default: jest.fn(),
}));

describe('WatermelonDBAdapter', () => {
  let adapter: WatermelonDBAdapter;

  beforeEach(() => {
    adapter = new WatermelonDBAdapter({
      conflictStrategy: 'ACCEPT_REMOTE',
      cacheMaxSize: 10,
      cacheTTL: 1000,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('setup', () => {
    it('should initialize the adapter', async () => {
      const schema = {
        version: '1',
        models: {},
      };

      await expect(adapter.setup(schema)).resolves.toBeUndefined();
    });
  });

  describe('clear', () => {
    it('should clear all data', async () => {
      await expect(adapter.clear()).resolves.toBeUndefined();
    });
  });

  describe('query cache', () => {
    it('should cache query results', async () => {
      const modelConstructor = {} as PersistentModelConstructor<any>;
      const predicate = undefined;
      const pagination = undefined;

      // First call - cache miss
      const result1 = await adapter.query(modelConstructor, predicate, pagination);

      // Second call - should hit cache
      const result2 = await adapter.query(modelConstructor, predicate, pagination);

      expect(result1).toEqual(result2);
    });

    it('should evict old entries when cache is full', async () => {
      // Test cache eviction logic
      const modelConstructor = {} as PersistentModelConstructor<any>;

      // Fill cache beyond max size
      for (let i = 0; i < 15; i++) {
        await adapter.query(modelConstructor, { id: { eq: i } } as any);
      }

      // Cache size should not exceed max
      expect((adapter as any).queryCache.size).toBeLessThanOrEqual(10);
    });
  });

  describe('conflict resolution', () => {
    it('should provide conflict handler', () => {
      const handler = adapter.getConflictHandler();
      expect(handler).toBeDefined();
      expect(typeof handler).toBe('function');
    });

    it('should handle version conflicts', () => {
      const handler = adapter.getConflictHandler();
      if (handler) {
        const result = handler({
          modelConstructor: {} as any,
          model: {
            _version: 1,
            _lastChangedAt: Date.now(),
          },
          remoteModel: {
            _version: 2,
            _lastChangedAt: Date.now() + 1000,
          },
          operation: 'UPDATE',
        });

        // Should accept remote with higher version
        expect(result).toBeDefined();
      }
    });
  });

  describe('batch operations', () => {
    it('should handle batch operations', async () => {
      const operations = [
        { type: 'create', collection: 'users', prepareCreate: jest.fn() },
        { type: 'update', record: { id: '1' } },
        { type: 'delete', record: { id: '2' } },
      ];

      await expect(adapter.batch(...operations)).resolves.toBeUndefined();
    });
  });

  describe('observe', () => {
    it('should return observable for real-time updates', () => {
      const modelConstructor = {} as PersistentModelConstructor<any>;
      const observable = adapter.observe(modelConstructor);

      expect(observable).toBeDefined();
      expect(observable.subscribe).toBeDefined();
    });
  });

  describe('stopObserve', () => {
    it('should clean up subscriptions', () => {
      adapter.stopObserve();
      // Should not throw
      expect((adapter as any).subscriptions.size).toBe(0);
    });
  });

  describe('unsafeResetDatabase', () => {
    it('should reset database completely', async () => {
      await expect(adapter.unsafeResetDatabase()).resolves.toBeUndefined();
      // Cache should be cleared
      expect((adapter as any).queryCache.size).toBe(0);
    });
  });
});