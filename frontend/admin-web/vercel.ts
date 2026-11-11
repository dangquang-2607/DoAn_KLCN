const apiTarget = process.env.API_PROXY_TARGET?.replace(/\/+$/, "");

if (!apiTarget?.startsWith("https://")) {
  throw new Error("Set API_PROXY_TARGET to the HTTPS URL of FastAPI.");
}

export const config = {
  rewrites: [
    { source: "/api/v1/:path*", destination: `${apiTarget}/api/v1/:path*` },
    { source: "/(.*)", destination: "/index.html" },
  ],
};