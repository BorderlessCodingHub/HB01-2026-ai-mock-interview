import { auth } from "@/lib/auth/auth";
import { toNextJsHandler } from "better-auth/next-js";
import type { NextRequest } from "next/server";

/**
 * Next.js strips `basePath` before the route handler runs, but better-auth
 * matches routes against the public URL (including /ai-mock-interview).
 * @see https://github.com/better-auth/better-auth/issues/4715
 */
const appBasePath = process.env.__NEXT_ROUTER_BASEPATH ?? "";

const handlers = toNextJsHandler(auth);

function withPublicUrl(request: NextRequest): NextRequest {
  if (!appBasePath) return request;

  const { pathname, search } = request.nextUrl;
  const url = new URL(`${appBasePath}${pathname}`, request.nextUrl.origin);
  url.search = search;
  return new NextRequest(url, request);
}

export async function GET(request: NextRequest) {
  return handlers.GET(withPublicUrl(request));
}

export async function POST(request: NextRequest) {
  return handlers.POST(withPublicUrl(request));
}
