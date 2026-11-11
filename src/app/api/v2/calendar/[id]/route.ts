import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin } from "@/lib/auth";
import { databaseError, jsonError, supabase } from "@/lib/http";
import { getV2Session } from "@/lib/v2-auth";

const updateSchema = z.object({
  title: z.string().trim().min(1).max(120),
  kind: z.enum(["technique", "event", "meeting", "other"]),
  starts_at: z.string().datetime({ offset: true }),
  ends_at: z.string().datetime({ offset: true }).nullable(),
  location: z.string().trim().max(160).nullable(),
  details: z.string().trim().max(1000).nullable(),
}).refine(
  (value) => !value.ends_at || new Date(value.ends_at) >= new Date(value.starts_at),
  { message: "Das Ende darf nicht vor dem Beginn liegen." },
);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) return jsonError("Diese Anfrage ist nicht zulässig.", 403);
  try {
    const session = await getV2Session();
    if (!session) return jsonError("Bitte melde dich erneut an.", 401);
    if (session.role !== "admin") return jsonError("Administratorzugriff ist erforderlich.", 403);

    const { id } = await context.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return jsonError("Kalendereintrag nicht gefunden.", 404);
    }

    const input = updateSchema.parse(await request.json());
    const { data, error } = await supabase()
      .from("v2_calendar_events")
      .update({
        ...input,
        starts_at: new Date(input.starts_at).toISOString(),
        ends_at: input.ends_at ? new Date(input.ends_at).toISOString() : null,
        location: input.location || null,
        details: input.details || null,
        updated_by: session.userId ?? null,
        updated_by_is_admin: true,
      })
      .eq("id", id)
      .select("id, title, kind, starts_at, ends_at, location, details, created_by_name, created_at")
      .maybeSingle();
    if (error) throw error;
    if (!data) return jsonError("Kalendereintrag nicht gefunden.", 404);
    return NextResponse.json({ event: data });
  } catch (error) {
    if (error instanceof z.ZodError) return jsonError("Bitte prüfe Titel, Kategorie, Datum und Angaben.", 400);
    return databaseError(error);
  }
}
