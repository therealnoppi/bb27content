import { NextResponse } from "next/server";
import { createSessionToken, getSession, isSameOrigin, sessionCookieOptions } from "@/lib/auth";
import { jsonError } from "@/lib/http";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Diese Anfrage ist nicht zulässig.", 403);

  const session = await getSession();
  const response = NextResponse.json({ authenticated: session?.role === "admin" });
  if (session?.role === "admin") {
    response.cookies.set(
      "northstar_session",
      createSessionToken("visitor"),
      sessionCookieOptions(),
    );
  } else {
    response.cookies.set("northstar_session", "", {
      ...sessionCookieOptions(),
      maxAge: 0,
    });
  }
  return response;
}
