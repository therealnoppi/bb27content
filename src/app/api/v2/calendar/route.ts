import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin } from "@/lib/auth";
import { databaseError, jsonError, supabase } from "@/lib/http";
import { getV2Session } from "@/lib/v2-auth";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  kind: z.enum(["technique", "event", "meeting", "other"]),
  starts_at: z.string().datetime({ offset: true }),
  ends_at: z.string().datetime({ offset: true }).nullable().optional(),
  location: z.string().trim().max(160).nullable().optional(),
  details: z.string().trim().max(1000).nullable().optional(),
}).refine(
  (value) => !value.ends_at || new Date(value.ends_at) >= new Date(value.starts_at),
  { message: "Das Ende darf nicht vor dem Beginn liegen." },
);

export async function GET() {
  try {
    const session = await getV2Session();
    if (!session) return jsonError("Bitte melde dich erneut an.", 401);
    const { data, error } = await supabase()
      .from("v2_calendar_events")
      .select("id, title, kind, starts_at, ends_at, location, details, created_by_name, created_at")
      .order("starts_at", { ascending: true })
      .limit(500);
    if (error) throw error;
    return NextResponse.json({ events: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return databaseError(error);
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Diese Anfrage ist nicht zulässig.", 403);
  try {
    const session = await getV2Session();
    if (!session) return jsonError("Bitte melde dich erneut an.", 401);
    const input = createSchema.parse(await request.json());
    const db = supabase();
    let name = session.role === "admin" ? "Administration" : "Projektteam";
    if (session.role === "member" && session.userId) {
      const { data: user, error } = await db
        .from("v2_users")
        .select("name")
        .eq("id", session.userId)
        .eq("active", true)
        .single();
      if (error) throw error;
      name = user.name;
    }
    const { data, error } = await db
      .from("v2_calendar_events")
      .insert({
        ...input,
        starts_at: new Date(input.starts_at).toISOString(),
        ends_at: input.ends_at ? new Date(input.ends_at).toISOString() : null,
        location: input.location || null,
        details: input.details || null,
        created_by: session.userId ?? null,
        created_by_name: name,
      })
      .select("id, title, kind, starts_at, ends_at, location, details, created_by_name, created_at")
      .single();
    if (error) throw error;
    return NextResponse.json({ event: data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return jsonError("Bitte prüfe Titel, Kategorie, Datum und Angaben.", 400);
    return databaseError(error);
  }
}
