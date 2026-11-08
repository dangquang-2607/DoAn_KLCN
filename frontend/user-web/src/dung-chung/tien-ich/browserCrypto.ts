import { sha256 } from "@noble/hashes/sha2.js";

/** Same SHA-256 on browsers with or without the secure-context SubtleCrypto API. */
export async function sha256Hex(value: string | ArrayBuffer): Promise<string> {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  let digest: Uint8Array;
  if (globalThis.crypto?.subtle) {
    try { digest = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes)); }
    catch { digest = sha256(bytes); }
  } else digest = sha256(bytes);
  return Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
}

/** UUID v4 using cryptographic randomness; never downgrade to Math.random. */
export function newRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  if (typeof globalThis.crypto?.getRandomValues !== "function") {
    throw new Error("Trình duyệt chưa hỗ trợ thao tác này. Hãy mở bằng Safari hoặc Chrome phiên bản mới.");
  }
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
