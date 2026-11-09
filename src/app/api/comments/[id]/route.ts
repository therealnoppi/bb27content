import { NextResponse } from "next/server";
import { getSession, isSameOrigin } from "@/lib/auth";
import { databaseError, jsonError, supabase } from "@/lib/http";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) return jsonError("Diese Anfrage ist nicht zulässig.", 403);
  const session = await getSession();
  if (!session) return jsonError("Bitte schalte zuerst die Roadmap frei.", 401);
  if (session.role !== "admin") return jsonError("Administratorzugriff ist erforderlich.", 403);
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return jsonError("Kommentar nicht gefunden.", 404);
  }

  try {
    const { data, error } = await supabase()
      .from("comments")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return jsonError("Kommentar nicht gefunden.", 404);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return databaseError(error);
  }
}
