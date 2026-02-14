# Repository Guidelines

## Project Structure & Module Organization
- `backend/`: Express + TypeScript API. Entry point is `backend/src/index.ts` with routes in `backend/src/routes/`, services in `backend/src/services/`, and utilities in `backend/src/utils/`.
- `frontend/`: Vue 3 + Vite UI. Main entry is `frontend/src/main.ts` with views in `frontend/src/views/`, stores in `frontend/src/stores/`, and API clients in `frontend/src/api/`.
- `shared/`: Shared TypeScript types (see `shared/src/types.ts`).
- `data/`: JSON-backed storage used by the backend at runtime.
- `docs/`: Supplemental documentation.

## Build, Test, and Development Commands
Run these from the repository root unless noted.
- `npm run install-all`: Install root, backend, and frontend dependencies.
- `npm run dev`: Start backend (`localhost:8888`) and frontend (`localhost:5173`) concurrently.
- `npm run build`: Build backend and frontend bundles.
- `npm start`: Build then run the production backend.
- `cd backend && npm run lint`: Lint backend TypeScript with ESLint.
- `cd backend && npm run typecheck`: Backend typecheck only.
- `cd frontend && npm run typecheck`: Frontend typecheck only.

## Coding Style & Naming Conventions
- Language: TypeScript across backend and frontend.
- Indentation: match existing files (2 spaces in most `.ts`/`.vue` sources).
- Naming: Vue view components use `PascalCase` filenames (e.g., `frontend/src/views/Schemes.vue`). Backend modules use `kebab`-free lowercase filenames (e.g., `backend/src/routes/schemes.ts`).
- Linting: ESLint is configured for the backend via `npm run lint`. No repository-wide formatter is defined.

## Testing Guidelines
- No dedicated test framework or test directory is present in this repo.
- Use `npm run typecheck` (backend and/or frontend) as the minimum verification step before PRs.

## Commit & Pull Request Guidelines
- Git history is not available in this workspace, so no established commit convention can be inferred.
- Use a concise, imperative summary; Conventional Commits are preferred (e.g., `feat: add scheme validation`, `fix: handle empty config list`).
- PRs should include: a clear summary, linked issues (if any), and screenshots or short clips for UI changes.

## Configuration & Data Notes
- Backend stores data under `data/`. Avoid committing generated or environment-specific data unless the change is intentional and reviewed.
