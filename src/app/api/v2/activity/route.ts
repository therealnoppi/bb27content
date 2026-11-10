import { NextResponse } from "next/server";
import { databaseError, jsonError, supabase } from "@/lib/http";
import { getV2Session } from "@/lib/v2-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getV2Session();
    if (!session) return jsonError("Bitte melde dich erneut an.", 401);
    let query = supabase()
      .from("v2_activity")
      .select("id, action, entity_type, entity_title, actor_name, is_public, created_at")
      .order("created_at", { ascending: false });
    if (session.role !== "admin") query = query.eq("is_public", true);
    const { data, error } = await query.limit(12);
    if (error) throw error;
    return NextResponse.json({ activity: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return databaseError(error);
  }
}
