/**
 * sync-design.mjs — Shared source sync for CapitalFlow frontend.
 * Run after editing any file in frontend/shared/.
 * Committed copies allow each Docker context to build independently.
 *
 * Usage:  node frontend/shared/sync-design.mjs
 */
import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const src  = (name) => join(__dir, name);
const user = (name) => join(__dir, "../user-web", name);
const adm  = (name) => join(__dir, "../admin-web/src", name);

// ── 1. swiss.css design tokens ────────────────────────────────────────────
copyFileSync(src("swiss.css"), user("app/swiss.css"));
copyFileSync(src("swiss.css"), adm("swiss.css"));
console.log("  Synced: swiss.css -> both projects");

// ── 2. Toast.jsx ──────────────────────────────────────────────────────────
copyFileSync(src("Toast.jsx"), user("components/ui/Toast.jsx"));
copyFileSync(src("Toast.jsx"), adm("components/Toast.jsx"));
console.log("  Synced: Toast.jsx -> user components/ui and admin components");

// ── 3. Motion.jsx ─────────────────────────────────────────────────────────
copyFileSync(src("Motion.jsx"), user("components/ui/Motion.jsx"));
copyFileSync(src("Motion.jsx"), adm("components/Motion.jsx"));
console.log("  Synced: Motion.jsx -> user components/ui and admin components");

// ── 4. CategoryIcon.tsx ───────────────────────────────────────────────────
// Vite transpiles .tsx automatically via esbuild (no tsconfig needed)
copyFileSync(src("CategoryIcon.tsx"), user("components/ui/CategoryIcon.tsx"));
copyFileSync(src("CategoryIcon.tsx"), adm("components/CategoryIcon.tsx"));
console.log("  Synced: CategoryIcon.tsx -> user components/ui and admin components");

// ── 5. finance.ts / format.ts ─────────────────────────────────────────────
// user-web uses it as lib/finance.ts
copyFileSync(src("finance.ts"), user("lib/finance.ts"));
// admin-web: copy as services/format.ts (Vite/esbuild handles TS natively)
copyFileSync(src("finance.ts"), adm("services/format.ts"));
console.log("  Synced: finance.ts -> user-web/lib/finance.ts");
console.log("  Synced: finance.ts -> admin-web/src/services/format.ts");
console.log("  NOTE: admin-web/src/services/format.js is a thin re-export shim (do not delete)");

console.log("\nAll shared files synced successfully.");
