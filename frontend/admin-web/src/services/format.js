/**
 * format.js — Backward-compatible re-export shim.
 * Source of truth: frontend/shared/finance.ts
 * TypeScript copy: frontend/admin-web/src/services/format.ts (auto-synced)
 *
 * All existing imports from './services/format' continue to work unchanged.
 * Vite/esbuild transpiles format.ts automatically — no tsconfig required.
 */
export {
  money,
  localDate,
  dateLabel,
  errorMessage,
  accountTypes,
  exportCsv,
} from "./format.ts";