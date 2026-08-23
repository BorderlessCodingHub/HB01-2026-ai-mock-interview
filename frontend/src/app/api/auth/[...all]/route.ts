import { auth } from "@/lib/auth/auth";
import { toNextJsHandler } from "better-auth/next-js";
import type { NextRequest } from "next/server";

/**
 * Next.js / OpenNext strip `basePath` before the App Router handler runs, but
 * better-auth matches routes against the public URL (including /ai-mock-interview).
 * @see https://github.com/better-auth/better-auth/issues/4715
 */
function resolveAppBasePath(): string {
  const fromNext = process.env.__NEXT_ROUTER_BASEPATH;
  if (fromNext !== undefined && fromNext !== "") return fromNext;

  const fromOpenNext = (
    globalThis as typeof globalThis & { __NEXT_BASE_PATH__?: string }
  ).__NEXT_BASE_PATH__;
  if (fromOpenNext) return fromOpenNext;

  const authUrl = process.env.BETTER_AUTH_URL;
  if (authUrl) {
    try {
      const pathname = new URL(authUrl).pathname.replace(/\/$/, "");
      if (pathname && pathname !== "/") return pathname;
    } catch {
      // ignore invalid URL
    }
  }

  return "";
}

const appBasePath = resolveAppBasePath();

const handlers = toNextJsHandler(auth);

function withPublicUrl(request: NextRequest): NextRequest {
  if (!appBasePath) return request;

  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith(appBasePath)) return request;

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
