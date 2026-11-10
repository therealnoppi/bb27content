import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin } from "@/lib/auth";
import { databaseError, jsonError, supabase } from "@/lib/http";
import { getV2Session, hashV2Password } from "@/lib/v2-auth";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9._-]+$/),
  password: z.string().min(12).max(256),
});

export async function GET() {
  try {
    const session = await getV2Session();
    if (!session) return jsonError("Bitte melde dich erneut an.", 401);
    if (session.role !== "admin") return jsonError("Administratorzugriff ist erforderlich.", 403);
    const { data, error } = await supabase()
      .from("v2_users")
      .select("id, name, username, active, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ users: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return databaseError(error);
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Diese Anfrage ist nicht zulässig.", 403);
  try {
    const session = await getV2Session();
    if (!session) return jsonError("Bitte melde dich erneut an.", 401);
    if (session.role !== "admin") return jsonError("Administratorzugriff ist erforderlich.", 403);
    const input = createSchema.parse(await request.json());
    const { data, error } = await supabase()
      .from("v2_users")
      .insert({
        name: input.name,
        username: input.username.toLowerCase(),
        password_hash: await hashV2Password(input.password),
      })
      .select("id, name, username, active, created_at")
      .single();
    if (error) {
      if (error.code === "23505") return jsonError("Dieser Benutzername ist bereits vergeben.", 409);
      throw error;
    }
    return NextResponse.json({ user: data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return jsonError("Name, Benutzername oder Passwort sind ungültig. Passwörter benötigen mindestens 12 Zeichen.", 400);
    return databaseError(error);
  }
}
