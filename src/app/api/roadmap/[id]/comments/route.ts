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
  if (!(await getSession())) return jsonError("Bitte schalte zuerst die Roadmap frei.", 401);
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
    const { data, error } = await supabase()
      .from("comments")
      .insert({
        step_id: id,
        name: input.name,
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
