# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Clash 配置聚合系统 — a TypeScript web app that aggregates multiple Clash proxy config URLs into unified configurations, served via per-scheme endpoints (`/api/schemes/:name/clash`).

## Commands

```bash
npm run install-all          # Install root + backend + frontend deps
npm run dev                  # Start backend (localhost:8888) + frontend (localhost:5173) concurrently
npm run build                # Build both backend and frontend
npm start                    # Build then run production server

cd backend && npm run lint       # ESLint for backend
cd backend && npm run typecheck  # Backend type check
cd frontend && npm run typecheck # Frontend type check
```

No test framework is configured. Use `typecheck` and `lint` as verification steps.

**Build order matters**: `shared/` must be compiled (`tsc`) before backend or frontend, since both import from `shared/dist/types`. The `npm run build` script handles this automatically.

## Architecture

**Monorepo with three packages** (root `package.json` orchestrates via `concurrently`):

- **`shared/`** — Shared TypeScript type definitions (`types.ts`). Core domain types: `Scheme`, `Config`, `ClashConfig`, `ClashProxy`, `AggregateRule`. Both backend and frontend import from `shared/dist/types`.

- **`backend/`** — Express API server (port 8888). Entry: `src/index.ts`.
  - `routes/schemes.ts` — CRUD for schemes
  - `routes/configs.ts` — Config management and single-config preview within schemes
  - `routes/aggregate.ts` — Generates aggregated Clash YAML configs, node listing, batch refresh, system status
  - `services/dataService.ts` — JSON file persistence (`data/schemes.json`), uses a mutation queue for write serialization
  - `services/clashService.ts` — Fetches remote Clash configs, merges proxies/groups/rules with dedup and conflict resolution logic; supports post-processing (region grouping)
  - In production, serves frontend static files from `frontend/dist/`

- **`frontend/`** — Vue 3 + Vite + Element Plus + Pinia.
  - Views: `Home.vue`, `Schemes.vue`, `SchemeDetail.vue`
  - State: `stores/schemes.ts` (Pinia store)
  - API client: `api/index.ts` (Axios)
  - Dev server proxies `/api` to backend

## Key Design Decisions

- **Data storage**: Plain JSON file (`data/schemes.json`), no database. `DataService` serializes writes via a promise-based mutex queue.
- **Shared types**: The `shared` package must be built (`tsc`) before backend can import from `shared/dist/types`. This is a build-time dependency.
- **Aggregation**: `ClashService.aggregateConfigs()` fetches all enabled configs in sequence, then merges proxies with configurable dedup (`by_name`/`by_server`/`none`) and conflict resolution (`rename`/`skip`/`override`).
- **Region grouping**: Optional post-processing step in `clashService.ts`. When `AggregateRule.regionGrouping` is enabled, proxies are classified by geographic region via regex patterns on node names (`REGION_PATTERNS`), and per-region proxy groups are generated. The group type (`select` or `url-test`) is controlled by `regionGroupMode`. Unmatched nodes go into a "🌐 其他" group.
- **Partial updates**: Backend `PUT /schemes/:name` filters out `undefined` fields before passing to `dataService.updateScheme()` to avoid accidentally overwriting existing values with `undefined`.

## Coding Conventions

- TypeScript throughout, 2-space indentation in `.ts`/`.vue` files, 4-space in JSON
- Backend filenames: lowercase (`schemes.ts`). Frontend views: PascalCase (`SchemeDetail.vue`)
- API responses use `APIResponse<T>` wrapper type with `success`, `data`, `error` fields
