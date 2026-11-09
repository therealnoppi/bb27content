import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, isSameOrigin } from "@/lib/auth";
import { roadmapSteps } from "@/lib/config";
import { databaseError, jsonError, supabase } from "@/lib/http";

const statusSchema = z.object({ status: z.enum(["green", "yellow", "red"]) });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) return jsonError("Diese Anfrage ist nicht zulässig.", 403);
  const session = await getSession();
  if (!session) return jsonError("Bitte schalte zuerst die Roadmap frei.", 401);
  if (session.role !== "admin") return jsonError("Administratorzugriff ist erforderlich.", 403);

  const { id } = await context.params;
  if (!roadmapSteps.some((step) => step.id === id)) {
    return jsonError("Roadmap-Schritt nicht gefunden.", 404);
  }

  let input: z.infer<typeof statusSchema>;
  try {
    input = statusSchema.parse(await request.json());
  } catch {
    return jsonError("Bitte wähle einen gültigen Status.", 400);
  }

  try {
    const { error } = await supabase()
      .from("roadmap_status")
      .upsert(
        { step_id: id, status: input.status, updated_at: new Date().toISOString() },
        { onConflict: "step_id" },
      );
    if (error) throw error;
    return NextResponse.json({ status: input.status });
  } catch (error) {
    return databaseError(error);
  }
}
