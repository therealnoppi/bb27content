import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/auth";
import { databaseError, jsonError, supabase } from "@/lib/http";
import { getV2Session } from "@/lib/v2-auth";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) return jsonError("Diese Anfrage ist nicht zulässig.", 403);
  try {
    const session = await getV2Session();
    if (!session) return jsonError("Bitte melde dich erneut an.", 401);
    if (session.role !== "admin") return jsonError("Administratorzugriff ist erforderlich.", 403);
    const { id } = await context.params;
    const { data, error } = await supabase()
      .from("v2_users")
      .update({ active: false, revoked_at: new Date().toISOString() })
      .eq("id", id)
      .eq("active", true)
      .select("id, name")
      .maybeSingle();
    if (error) throw error;
    if (!data) return jsonError("Aktiver Zugang nicht gefunden.", 404);
    return NextResponse.json({ revoked: true });
  } catch (error) {
    return databaseError(error);
  }
}
