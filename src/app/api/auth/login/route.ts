import { NextResponse } from "next/server";
import { z } from "zod";
import {
  authenticatePassword,
  createSessionToken,
  isSameOrigin,
  sessionCookieOptions,
} from "@/lib/auth";
import { databaseError, jsonError, supabase } from "@/lib/http";
import { hashV2Password, verifyV2Password } from "@/lib/v2-auth";

const loginSchema = z.discriminatedUnion("role", [
  z.object({ password: z.string().min(1).max(256), role: z.literal("admin") }),
  z.object({
    password: z.string().min(1).max(256),
    role: z.literal("member"),
    username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9._-]+$/),
  }),
]);

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Diese Anfrage ist nicht zulässig.", 403);

  let input: z.infer<typeof loginSchema>;
  try {
    input = loginSchema.parse(await request.json());
  } catch {
    return jsonError("Bitte gib ein gültiges Passwort ein.", 400);
  }

  try {
    if (input.role === "member") {
      const { data: user, error } = await supabase()
        .from("v2_users")
        .select("id, name, password_hash")
        .eq("username", input.username.toLowerCase())
        .eq("active", true)
        .maybeSingle();
      if (error) throw error;
      const validPassword = user
        ? await verifyV2Password(input.password, user.password_hash)
        : await hashV2Password(input.password).then(() => false);
      if (!user || !validPassword) return jsonError("Benutzername oder Passwort ist nicht korrekt.", 401);
      const response = NextResponse.json({ authenticated: true, role: input.role, name: user.name });
      response.cookies.set("northstar_session", createSessionToken("member", user.id), sessionCookieOptions());
      return response;
    }
    if (!authenticatePassword(input.password, input.role)) return jsonError("Dieses Passwort ist nicht korrekt.", 401);
    const response = NextResponse.json({ authenticated: true, role: input.role });
    response.cookies.set(
      "northstar_session",
      createSessionToken(input.role),
      sessionCookieOptions(),
    );
    return response;
  } catch (error) {
    if (
      !(error instanceof Error) ||
      (!error.message.includes("PASSWORD") && !error.message.includes("SESSION_SECRET"))
    ) {
      return databaseError(error);
    }
    console.error("Session configuration is invalid.", error);
    return jsonError("Der Anmeldedienst ist nicht korrekt konfiguriert.", 503);
  }
}
