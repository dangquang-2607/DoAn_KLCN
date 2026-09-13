// Run after editing swiss.css. Committed copies let each Docker context build independently.
import { copyFileSync } from "node:fs";
const source = new URL("./swiss.css", import.meta.url);
for (const destination of [
  "../user-web/app/swiss.css",
  "../admin-web/src/swiss.css",
]) {
  copyFileSync(source, new URL(destination, import.meta.url));
}
for (const destination of ["../user-web/components/Toast.jsx", "../admin-web/src/components/Toast.jsx"]) {
  copyFileSync(new URL("./Toast.jsx", import.meta.url), new URL(destination, import.meta.url));
}
for (const destination of ["../user-web/components/Motion.jsx", "../admin-web/src/components/Motion.jsx"]) {
  copyFileSync(new URL("./Motion.jsx", import.meta.url), new URL(destination, import.meta.url));
}
