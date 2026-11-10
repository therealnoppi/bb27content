import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, isSameOrigin } from "@/lib/auth";
import { roadmapSteps } from "@/lib/config";
import { databaseError, jsonError, supabase } from "@/lib/http";

const commentSchema = z.object({
  name: z.string().trim().min(1).max(60),
  message: z.string().trim().min(1).max(1000),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) return jsonError("Diese Anfrage ist nicht zulässig.", 403);
  const session = await getSession();
  if (!session) return jsonError("Bitte schalte zuerst die Roadmap frei.", 401);
  const { id } = await context.params;
  if (!roadmapSteps.some((step) => step.id === id)) {
    return jsonError("Roadmap-Schritt nicht gefunden.", 404);
  }

  let input: z.infer<typeof commentSchema>;
  try {
    input = commentSchema.parse(await request.json());
  } catch {
    return jsonError("Gib einen Namen und einen Kommentar mit höchstens 1.000 Zeichen ein.", 400);
  }

  try {
    let authorName = input.name;
    if (session.role === "member" && session.userId) {
      const { data: user, error: userError } = await supabase()
        .from("v2_users")
        .select("name")
        .eq("id", session.userId)
        .eq("active", true)
        .single();
      if (userError) throw userError;
      authorName = user.name;
    }
    const { data, error } = await supabase()
      .from("comments")
      .insert({
        step_id: id,
        name: authorName,
        message: input.message,
      })
      .select("id, step_id, name, message, created_at")
      .single();
    if (error) throw error;
    return NextResponse.json({ comment: data }, { status: 201 });
  } catch (error) {
    return databaseError(error);
  }
}
