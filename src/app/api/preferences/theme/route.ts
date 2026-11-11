import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, isSameOrigin } from "@/lib/auth";
import { databaseError, jsonError, supabase } from "@/lib/http";

export const dynamic = "force-dynamic";
const themeSchema = z.object({ theme: z.enum(["light", "dark", "system"]) });

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ theme: "system" });
    if (session.role !== "member" || !session.userId) return NextResponse.json({ theme: "system" });
    const { data, error } = await supabase().from("v2_users").select("theme_preference")
      .eq("id", session.userId).eq("active", true).single();
    if (error) throw error;
    return NextResponse.json({ theme: data.theme_preference }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return databaseError(error);
  }
}

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Diese Anfrage ist nicht zulässig.", 403);
  try {
    const session = await getSession();
    if (!session) return jsonError("Bitte melde dich erneut an.", 401);
    const input = themeSchema.parse(await request.json());
    if (session.role === "member" && session.userId) {
      const { error } = await supabase().from("v2_users").update({ theme_preference: input.theme })
        .eq("id", session.userId).eq("active", true);
      if (error) throw error;
    }
    return NextResponse.json({ theme: input.theme });
  } catch (error) {
    if (error instanceof z.ZodError) return jsonError("Ungültige Darstellungseinstellung.", 400);
    return databaseError(error);
  }
}
