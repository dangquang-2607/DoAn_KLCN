import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

// Cho phép tải tài nguyên dev khi mở ứng dụng bằng IP của máy trong mạng LAN.
const localDevHosts = Object.values(networkInterfaces())
  .flatMap((addresses) => addresses ?? [])
  .filter((address) => address.family === "IPv4" && !address.internal)
  .map((address) => address.address);

const apiProxyTarget = (
  process.env.API_PROXY_TARGET || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
).replace(/\/+$/, "").replace(/\/api(?:\/v1)?$/, "");

const nextConfig: NextConfig = {
  output: 'standalone',
  // Upload now includes bounded OCR (90s) before an invoice is created.
  experimental: {
    proxyTimeout: 120_000,
    optimizePackageImports: ["lucide-react", "recharts"],
  },
  allowedDevOrigins: [
  ...localDevHosts,
  "capitalflow.online",
  "*.capitalflow.online",
],
  async headers() {
    // Dev chunks reuse their URLs as source changes; a CDN must not retain them.
    return process.env.NODE_ENV === "development" ? [{
      source: "/:path*",
      headers: [
        { key: "Cache-Control", value: "no-store, max-age=0" },
        { key: "CDN-Cache-Control", value: "no-store" },
        { key: "Cloudflare-CDN-Cache-Control", value: "no-store" },
      ],
    }] : [];
  },
  async rewrites() {
    // Trình duyệt điện thoại gọi cùng cổng frontend; Next.js kết nối backend trên máy chủ.
    return process.env.NODE_ENV === "development"
      ? [{ source: "/api/v1/:path*", destination: `${apiProxyTarget}/api/v1/:path*` }]
      : [];
  },
  async redirects() {
    return [
      {
        source: '/dashboard',
        destination: '/',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
