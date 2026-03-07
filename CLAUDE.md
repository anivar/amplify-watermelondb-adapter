# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A WatermelonDB storage adapter for AWS Amplify DataStore. It replaces DataStore's default SQLite adapter with WatermelonDB, providing reactive queries and JSI-based native performance on React Native. Supports web (LokiJS/IndexedDB), Node.js (better-sqlite3), and in-memory fallback.

## Commands

- **Build:** `npm run build` (Rollup, outputs CJS + ESM to `dist/`)
- **Lint:** `npm run lint` / `npm run lint:fix`
- **Test all:** `npm test`
- **Test single file:** `npx jest test/smoke.test.ts`
- **Test with pattern:** `npx jest --testNamePattern="pattern"`
- **Test coverage:** `npm run test:coverage` (thresholds: 80% branches, 85% functions/lines/statements)
- **Watch tests:** `npm run test:watch`
- **Clean:** `npm run clean`

## Architecture

Three source files in `src/`:

- **`WatermelonDBAdapter.ts`** — Core adapter class (~1000 lines). Implements the Amplify DataStore storage interface (`setup`, `query`, `save`, `delete`, `observe`, `batchSave`). Includes LRU caching, platform-specific dispatcher detection (JSI/LokiJS/memory), WebSocket health monitoring, multi-tenant subscription variables, and alternative schema support. Defines all WatermelonDB type interfaces inline (no separate types file).

- **`DataStoreIntegration.ts`** — Helper utilities for configuring DataStore with the adapter: `configureDataStoreWithWatermelonDB()` (zero-config setup), `createFallbackConfiguration()` (try WatermelonDB, fallback to another adapter), and `migrateFromSQLiteAdapter()`.

- **`index.ts`** — Public API barrel export.

## Test Structure

Tests live in `test/` (primary) and `__tests__/` (legacy). Jest uses `ts-jest` with `jsdom` environment. Test setup is in `test/setup.ts`.

- `test/smoke.test.ts` — Basic adapter creation and config validation
- `test/WatermelonDBAdapter.test.ts` — Core adapter unit tests
- `test/DataStoreIntegration.test.ts` — Integration helper tests
- `test/integration.test.ts` — Full integration scenarios
- `test/performance.test.ts` — Performance benchmarks

## Upstream Context (amplify-js)

This adapter was built to address specific production DataStore pain points discovered while contributing to `aws-amplify/amplify-js`:

- **SQLite performance spikes** (amplify-js #13957) — DataStore's SQLite transactions cause CPU spikes and UI freezes. WatermelonDB's JSI dispatcher bypasses the JS bridge for native performance.
- **Silent memory fallback** (amplify-js #14440) — DataStore silently falls back to in-memory storage, losing data on restart. This adapter provides explicit fallback with `createFallbackConfiguration()`.
- **Multi-tenant subscription filtering** — Integrates subscription variables from amplify-js PR #14564 so DataStore receives only tenant-relevant mutations via WebSocket instead of filtering client-side.
- **WebSocket health monitoring** — Implements connection health checks from amplify-js PR #14563 with auto-reconnection.
- **Enhanced query operators** — Supports `in`/`notIn` operators from merged amplify-js PR #14544, enabling patterns like `storeId.in(multiStoreIds)`.
- **Version cross-contamination** — Addresses amplify-js PR #14570 where rapid save/query cycles could corrupt `_version` fields.

The upstream `amplify-js` repo is at `../../personal/amplify-js/` with analysis docs in its `.claude/` directory.

## Key Patterns

- Peer dependencies: `@aws-amplify/core` (5.x/6.x), `@aws-amplify/datastore` (4.x/5.x), `@nozbe/watermelondb` (>=0.27.0), `react-native` (optional, >=0.76.0)
- TypeScript strict mode, ES2023 target, ESNext modules
- ESLint warns on `no-explicit-any` and `no-unused-vars` (not errors)
- Rollup bundles with peer deps externalized; second pass bundles `.d.ts` with `rollup-plugin-dts`
- Module path alias: `@/` maps to `src/` in tests
