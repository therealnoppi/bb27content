import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin } from "@/lib/auth";
import { databaseError, jsonError, supabase } from "@/lib/http";
import { getV2Session } from "@/lib/v2-auth";

const reviewSchema = z.object({ status: z.enum(["approved", "rejected"]) });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) return jsonError("Diese Anfrage ist nicht zulässig.", 403);
  try {
    const session = await getV2Session();
    if (!session) return jsonError("Bitte melde dich erneut an.", 401);
    if (session.role !== "admin") return jsonError("Administratorzugriff ist erforderlich.", 403);
    const input = reviewSchema.parse(await request.json());
    const { id } = await context.params;
    const { data, error } = await supabase()
      .from("v2_file_requests")
      .update({ status: input.status, reviewed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "pending")
      .select("id, status")
      .maybeSingle();
    if (error) throw error;
    if (!data) return jsonError("Diese offene Dateianfrage wurde nicht gefunden.", 404);
    return NextResponse.json({ file: data });
  } catch (error) {
    if (error instanceof z.ZodError) return jsonError("Ungültige Freigabeentscheidung.", 400);
    return databaseError(error);
  }
}
