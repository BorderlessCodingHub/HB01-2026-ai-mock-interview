import { NextRequest } from "next/server";
import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth/auth";

/**
 * Must match `basePath` in next.config.ts.
 * Next.js strips this from the request URL before the App Router handler runs;
 * better-auth still expects the public pathname (app basePath + /api/auth/...).
 */
const NEXT_BASE_PATH = "/ai-mock-interview";

const handlers = toNextJsHandler(auth);

function withPublicBasePath(req: NextRequest): NextRequest {
  const { pathname, search } = req.nextUrl;
  if (
    pathname === NEXT_BASE_PATH ||
    pathname.startsWith(`${NEXT_BASE_PATH}/`)
  ) {
    return req;
  }

  const url = new URL(
    `${NEXT_BASE_PATH}${pathname}${search}`,
    req.nextUrl.origin,
  );
  return new NextRequest(url, req);
}

export async function GET(req: NextRequest) {
  return handlers.GET(withPublicBasePath(req));
}

export async function POST(req: NextRequest) {
  return handlers.POST(withPublicBasePath(req));
}
