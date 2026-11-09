import { NextResponse } from "next/server";
import { z } from "zod";
import {
  authenticatePassword,
  createSessionToken,
  isSameOrigin,
  sessionCookieOptions,
} from "@/lib/auth";
import { jsonError } from "@/lib/http";

const loginSchema = z.object({
  password: z.string().min(1).max(256),
  role: z.enum(["visitor", "admin"]),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Diese Anfrage ist nicht zulässig.", 403);

  let input: z.infer<typeof loginSchema>;
  try {
    input = loginSchema.parse(await request.json());
  } catch {
    return jsonError("Bitte gib ein gültiges Passwort ein.", 400);
  }

  try {
    if (!authenticatePassword(input.password, input.role)) {
      return jsonError("Dieses Passwort ist nicht korrekt.", 401);
    }
    const response = NextResponse.json({ authenticated: true, role: input.role });
    response.cookies.set(
      "northstar_session",
      createSessionToken(input.role),
      sessionCookieOptions(),
    );
    return response;
  } catch (error) {
    console.error("Session configuration is invalid.", error);
    return jsonError("Der Anmeldedienst ist nicht korrekt konfiguriert.", 503);
  }
}
