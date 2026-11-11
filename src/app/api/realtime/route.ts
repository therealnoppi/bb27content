import { getV2Session } from "@/lib/v2-auth";
import { databaseError, jsonError } from "@/lib/http";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await getV2Session();
    if (!session) return jsonError("Bitte melde dich erneut an.", 401);

    const encoder = new TextEncoder();
    const channel = getSupabaseAdmin().channel(`workspace-${crypto.randomUUID()}`);
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let closeStream = () => {};
    let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
    let closed = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller;
        const send = async (name: string) => {
          if (closed) return;
          try {
            const currentSession = await getV2Session();
            if (currentSession) {
              controller.enqueue(encoder.encode(`event: ${name}\ndata: {}\n\n`));
              return;
            }
            closeStream();
          } catch (error) {
            console.error("Could not verify the session for a realtime event.", error);
            closeStream();
          }
        };
        closeStream = () => {
          if (closed) return;
          closed = true;
          if (heartbeat) clearInterval(heartbeat);
          request.signal.removeEventListener("abort", closeStream);
          try { streamController?.close(); } catch { /* The client may have disconnected already. */ }
          void getSupabaseAdmin().removeChannel(channel).catch((error: unknown) => {
            console.error("Could not remove a realtime channel.", error);
          });
        };
        request.signal.addEventListener("abort", closeStream, { once: true });

        channel.on("postgres_changes", {
          event: "*",
          schema: "public",
          table: "team_chat_messages",
        }, () => send("chat"));
        channel.on("postgres_changes", {
          event: "*",
          schema: "public",
          table: "version_releases",
        }, () => send("version"));
        if (session.role === "admin") {
          channel.on("postgres_changes", {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: "recipient_role=eq.admin",
          }, () => send("notification"));
        } else if (session.userId) {
          channel.on("postgres_changes", {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${session.userId}`,
          }, () => send("notification"));
        }
        channel.subscribe((status) => {
          if (status === "SUBSCRIBED") send("connected");
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") send("unavailable");
        });
        heartbeat = setInterval(() => send("ping"), 25_000);
      },
      cancel() {
        closeStream();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return databaseError(error);
  }
}
