import { NextResponse } from "next/server";
import {
  isSameOrigin,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";
import { jsonError } from "@/lib/http";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Diese Anfrage ist nicht zulässig.", 403);

  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
