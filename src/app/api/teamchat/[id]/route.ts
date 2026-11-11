import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin } from "@/lib/auth";
import { getV2Session } from "@/lib/v2-auth";
import { databaseError, jsonError, supabase } from "@/lib/http";

const editSchema = z.object({ content: z.string().trim().min(1).max(4000) });

async function updateMessage(request: Request, context: { params: Promise<{ id: string }> }, remove: boolean) {
  if (!isSameOrigin(request)) return jsonError("Diese Anfrage ist nicht zulässig.", 403);
  try {
    const session = await getV2Session();
    if (!session) return jsonError("Bitte melde dich erneut an.", 401);
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) return jsonError("Nachricht nicht gefunden.", 404);
    const db = supabase();
    const { data: message, error: readError } = await db.from("team_chat_messages")
      .select("id, sender_id, sender_is_admin, deleted_at").eq("id", id).maybeSingle();
    if (readError) throw readError;
    if (!message) return jsonError("Nachricht nicht gefunden.", 404);
    const ownsMessage = session.role === "admin"
      ? message.sender_is_admin
      : message.sender_id === session.userId;
    if (!ownsMessage && session.role !== "admin") return jsonError("Du darfst nur eigene Nachrichten bearbeiten.", 403);
    if (message.deleted_at) return jsonError("Gelöschte Nachrichten können nicht geändert werden.", 409);

    let changes: { content?: string; edited?: boolean; deleted_at?: string; updated_at: string };
    if (remove) {
      changes = { content: "Diese Nachricht wurde gelöscht.", deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    } else {
      const input = editSchema.parse(await request.json());
      changes = { content: input.content, edited: true, updated_at: new Date().toISOString() };
    }
    const { data, error } = await db.from("team_chat_messages").update(changes).eq("id", id)
      .select("id, sender_id, sender_name, sender_is_admin, content, reply_to_id, edited, deleted_at, created_at, updated_at").single();
    if (error) throw error;
    return NextResponse.json({ message: { ...data, reply_to: null } });
  } catch (error) {
    if (error instanceof z.ZodError) return jsonError("Die Nachricht muss Text enthalten und darf höchstens 4.000 Zeichen lang sein.", 400);
    return databaseError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return updateMessage(request, context, false);
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return updateMessage(request, context, true);
}
