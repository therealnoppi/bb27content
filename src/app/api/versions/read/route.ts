import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, isSameOrigin } from "@/lib/auth";
import { databaseError, jsonError, supabase } from "@/lib/http";

const readSchema = z.object({ release_ids: z.array(z.string().uuid()).min(1).max(1000) });

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Diese Anfrage ist nicht zulässig.", 403);
  try {
    const session = await getSession();
    if (!session) return jsonError("Bitte melde dich erneut an.", 401);
    const input = readSchema.parse(await request.json());
    const uniqueIds = Array.from(new Set(input.release_ids));
    const { data: published, error: lookupError } = await supabase()
      .from("version_releases")
      .select("id")
      .in("id", uniqueIds)
      .not("published_at", "is", null);
    if (lookupError) throw lookupError;
    const allowedIds = (published ?? []).map((release) => release.id);
    if (!allowedIds.length) return NextResponse.json({ read: true });

    const readerKey = session.role === "admin" ? "admin" : session.userId;
    if (!readerKey) return jsonError("Bitte melde dich erneut an.", 401);
    const { error } = await supabase().from("version_release_reads").upsert(
      allowedIds.map((releaseId) => ({
        release_id: releaseId,
        reader_key: readerKey,
        reader_role: session.role,
        user_id: session.role === "member" ? session.userId : null,
        read_at: new Date().toISOString(),
      })),
      { onConflict: "release_id,reader_key" },
    );
    if (error) throw error;
    return NextResponse.json({ read: true });
  } catch (error) {
    if (error instanceof z.ZodError) return jsonError("Ungültige Gelesen-Markierung.", 400);
    return databaseError(error);
  }
}
