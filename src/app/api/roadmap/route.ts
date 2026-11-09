import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { roadmapSteps } from "@/lib/config";
import { databaseError, jsonError, supabase } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getSession())) return jsonError("Bitte schalte zuerst die Roadmap frei.", 401);

  try {
    const db = supabase();
    const [{ data: statuses, error: statusError }, { data: comments, error: commentError }] =
      await Promise.all([
        db.from("roadmap_status").select("step_id, status"),
        db
          .from("comments")
          .select("id, step_id, name, message, created_at")
          .order("created_at", { ascending: false })
          .limit(1000),
      ]);
    if (statusError) throw statusError;
    if (commentError) throw commentError;

    const statusMap = new Map((statuses ?? []).map((item) => [item.step_id, item.status]));
    const commentMap = new Map<string, typeof comments>();
    for (const comment of comments ?? []) {
      const current = commentMap.get(comment.step_id) ?? [];
      current.push(comment);
      commentMap.set(comment.step_id, current);
    }

    const steps = roadmapSteps
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((step) => ({
        ...step,
        status: statusMap.get(step.id) ?? "green",
        comments: commentMap.get(step.id) ?? [],
      }));

    return NextResponse.json(
      { steps },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return databaseError(error);
  }
}
