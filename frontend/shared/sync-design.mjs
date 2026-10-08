/**
 * Đồng bộ primitive giao diện; mỗi portal vẫn build Docker độc lập.
 * Không đồng bộ kiểu nghiệp vụ/formatter: hợp đồng API của hai portal khác nhau.
 * Usage: node frontend/shared/sync-design.mjs [--check]
 */
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const sourceDirectory = dirname(fileURLToPath(import.meta.url));
const checkOnly = process.argv.includes("--check");
const assets = {
  "swiss.css": "styles/swiss.css",
  "Toast.jsx": "UI-chung/Toast.jsx",
  "Motion.jsx": "UI-chung/Motion.jsx",
  "CategoryIcon.tsx": "UI-chung/CategoryIcon.tsx",
};
let mismatches = 0;
for (const [name, destination] of Object.entries(assets)) {
  const source = join(sourceDirectory, name);
  for (const portal of ["user-web", "admin-web"]) {
    const target = join(sourceDirectory, "..", portal, "src/dung-chung", destination);
    if (checkOnly) {
      if (!readFileSync(source).equals(readFileSync(target))) {
        console.error(`Chưa đồng bộ: ${portal}/src/dung-chung/${destination}`);
        mismatches += 1;
      }
    } else {
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(source, target);
      console.log(`Đã đồng bộ: ${portal}/src/dung-chung/${destination}`);
    }
  }
}
if (checkOnly && mismatches === 0) console.log("Các primitive giao diện đã đồng bộ.");
process.exitCode = mismatches ? 1 : 0;
