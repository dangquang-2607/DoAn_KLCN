import type { NextConfig } from "next";

const apiProxyTarget = (
  process.env.API_PROXY_TARGET || "http://127.0.0.1:8000"
).replace(/\/+$/, "").replace(/\/api(?:\/v1)?$/, "");

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  output: 'standalone',
  devIndicators: false,
  // Upload now includes bounded OCR (90s) before an invoice is created.
  experimental: {
    proxyTimeout: 120_000,
    optimizePackageImports: ["lucide-react", "recharts"],
  },
  allowedDevOrigins: ["app.capitalflow.online"],
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
    // Both dev and production serve the API through the portal's own domain.
    return [{ source: "/api/v1/:path*", destination: `${apiProxyTarget}/api/v1/:path*` }];
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
