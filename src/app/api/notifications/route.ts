import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin } from "@/lib/auth";
import { getV2Session } from "@/lib/v2-auth";
import { databaseError, jsonError, supabase } from "@/lib/http";

export const dynamic = "force-dynamic";
const updateSchema = z.object({ id: z.string().uuid().optional(), all: z.boolean().optional() })
  .refine((value) => Boolean(value.id) !== Boolean(value.all), "Specify a notification or all.");

export async function GET() {
  try {
    const session = await getV2Session();
    if (!session) return jsonError("Bitte melde dich erneut an.", 401);
    const db = supabase();
    let listQuery = db.from("notifications").select("id, title, description, href, created_at, read_at")
      .order("created_at", { ascending: false }).limit(30);
    let countQuery = db.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
    if (session.role === "admin") {
      listQuery = listQuery.eq("recipient_role", "admin").is("user_id", null);
      countQuery = countQuery.eq("recipient_role", "admin").is("user_id", null);
    } else if (session.userId) {
      listQuery = listQuery.eq("recipient_role", "member").eq("user_id", session.userId);
      countQuery = countQuery.eq("recipient_role", "member").eq("user_id", session.userId);
    } else {
      return NextResponse.json({ notifications: [], unreadCount: 0 });
    }
    const [{ data, error }, { count, error: countError }] = await Promise.all([listQuery, countQuery]);
    if (error) throw error;
    if (countError) throw countError;
    return NextResponse.json({ notifications: data ?? [], unreadCount: count ?? 0 }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return databaseError(error);
  }
}

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Diese Anfrage ist nicht zulässig.", 403);
  try {
    const session = await getV2Session();
    if (!session) return jsonError("Bitte melde dich erneut an.", 401);
    const input = updateSchema.parse(await request.json());
    let query = supabase().from("notifications").update({ read_at: new Date().toISOString() })
      .is("read_at", null);
    if (session.role === "admin") query = query.eq("recipient_role", "admin").is("user_id", null);
    else if (session.userId) query = query.eq("recipient_role", "member").eq("user_id", session.userId);
    else return jsonError("Bitte melde dich erneut an.", 401);
    if (input.id) query = query.eq("id", input.id);
    const { error } = await query;
    if (error) throw error;
    return NextResponse.json({ updated: true });
  } catch (error) {
    if (error instanceof z.ZodError) return jsonError("Ungültige Anfrage.", 400);
    return databaseError(error);
  }
}
