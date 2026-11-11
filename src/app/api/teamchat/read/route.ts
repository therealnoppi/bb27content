import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/auth";
import { getV2Session } from "@/lib/v2-auth";
import { databaseError, jsonError, supabase } from "@/lib/http";

export async function PUT(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Diese Anfrage ist nicht zulässig.", 403);
  try {
    const session = await getV2Session();
    if (!session) return jsonError("Bitte melde dich erneut an.", 401);
    const db = supabase();
    const { error } = session.userId
      ? await db.from("team_chat_reads").upsert(
        { user_id: session.userId, last_read_at: new Date().toISOString() },
        { onConflict: "user_id" },
      )
      : await db.from("team_chat_admin_reads").upsert(
        { id: true, last_read_at: new Date().toISOString() },
        { onConflict: "id" },
      );
    if (error) throw error;
    return NextResponse.json({ read: true });
  } catch (error) {
    return databaseError(error);
  }
}
