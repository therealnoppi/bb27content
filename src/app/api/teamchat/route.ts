import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin } from "@/lib/auth";
import { getV2Session } from "@/lib/v2-auth";
import { databaseError, jsonError, supabase } from "@/lib/http";

export const dynamic = "force-dynamic";
const messageSchema = z.object({
  content: z.string().trim().min(1).max(4000),
  reply_to_id: z.string().uuid().nullable().optional(),
});

export async function GET(request: Request) {
  try {
    const session = await getV2Session();
    if (!session) return jsonError("Bitte melde dich erneut an.", 401);
    const url = new URL(request.url);
    const before = url.searchParams.get("before");
    const messageId = url.searchParams.get("id");
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 40, 1), 100);
    if (before && Number.isNaN(Date.parse(before))) return jsonError("Ungültiger Nachrichtenzeitpunkt.", 400);
    if (messageId && !z.string().uuid().safeParse(messageId).success) return jsonError("Ungültige Nachrichten-ID.", 400);

    let query = supabase()
      .from("team_chat_messages")
      .select("id, sender_id, sender_name, sender_is_admin, content, reply_to_id, edited, deleted_at, created_at, updated_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit);
    if (messageId) query = query.eq("id", messageId);
    else if (before) query = query.lt("created_at", before);
    const { data, error } = await query;
    if (error) throw error;

    const messages = (data ?? []).reverse();
    const replyIds = Array.from(new Set(messages.flatMap((message) => message.reply_to_id ? [message.reply_to_id] : [])));
    let replies: Record<string, { id: string; content: string; sender_name: string; deleted_at: string | null }> = {};
    if (replyIds.length) {
      const { data: parents, error: parentError } = await supabase()
        .from("team_chat_messages")
        .select("id, content, sender_name, deleted_at")
        .in("id", replyIds);
      if (parentError) throw parentError;
      replies = Object.fromEntries((parents ?? []).map((parent) => [parent.id, parent]));
    }

    const { data: readState, error: readError } = session.userId
      ? await supabase().from("team_chat_reads").select("last_read_at").eq("user_id", session.userId).maybeSingle()
      : await supabase().from("team_chat_admin_reads").select("last_read_at").eq("id", true).maybeSingle();
    if (readError) throw readError;
    const lastReadAt = readState?.last_read_at ?? "1970-01-01T00:00:00.000Z";
    let unreadQuery = supabase().from("team_chat_messages").select("id", { count: "exact", head: true })
      .gt("created_at", lastReadAt);
    unreadQuery = session.userId
      ? unreadQuery.or(`sender_id.is.null,sender_id.neq.${session.userId}`)
      : unreadQuery.eq("sender_is_admin", false);
    const { count, error: countError } = await unreadQuery;
    if (countError) throw countError;
    return NextResponse.json({
      messages: messages.map((message) => ({
        ...message,
        reply_to: message.reply_to_id ? replies[message.reply_to_id] ?? null : null,
      })),
      hasOlder: messages.length === limit,
      lastReadAt: readState?.last_read_at ?? null,
      unreadCount: count ?? 0,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return databaseError(error);
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Diese Anfrage ist nicht zulässig.", 403);
  try {
    const session = await getV2Session();
    if (!session) return jsonError("Bitte melde dich erneut an.", 401);
    const input = messageSchema.parse(await request.json());
    const name = session.role === "admin"
      ? "Administration"
      : await getMemberName(session.userId);
    const { data, error } = await supabase()
      .from("team_chat_messages")
      .insert({
        sender_id: session.userId ?? null,
        sender_name: name,
        sender_is_admin: session.role === "admin",
        content: input.content,
        reply_to_id: input.reply_to_id ?? null,
      })
      .select("id, sender_id, sender_name, sender_is_admin, content, reply_to_id, edited, deleted_at, created_at, updated_at")
      .single();
    if (error) throw error;
    return NextResponse.json({ message: { ...data, reply_to: null } }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return jsonError("Nachrichten müssen Text enthalten und dürfen höchstens 4.000 Zeichen lang sein.", 400);
    return databaseError(error);
  }
}

async function getMemberName(userId?: string) {
  if (!userId) throw new Error("Member sessions require a user ID.");
  const { data, error } = await supabase().from("v2_users").select("name").eq("id", userId).eq("active", true).single();
  if (error) throw error;
  return data.name;
}
