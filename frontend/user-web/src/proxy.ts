import { NextRequest, NextResponse } from "next/server";

const publicHost = "app.capitalflow.online";

// Cloudflare terminates TLS and forwards HTTP locally. Respect its original scheme.
export function proxy(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0].toLowerCase();
  if (host !== publicHost) return NextResponse.next();
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim().toLowerCase()
    || request.nextUrl.protocol.replace(":", "");
  if (protocol !== "https") {
    const target = new URL(request.nextUrl.pathname + request.nextUrl.search, `https://${publicHost}`);
    return NextResponse.redirect(target, 307);
  }
  const response = NextResponse.next();
  response.headers.set("Strict-Transport-Security", "max-age=31536000");
  return response;
}
