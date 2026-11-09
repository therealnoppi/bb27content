import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { roadmapSteps } from "@/lib/config";
import { databaseError, jsonError, supabase } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getSession())) return jsonError("Bitte schalte zuerst die Roadmap frei.", 401);

  try {
    const db = supabase();
    const [{ data: statuses, error: statusError }, comments] =
      await Promise.all([
        db.from("roadmap_status").select("step_id, status"),
        loadAllComments(db),
      ]);
    if (statusError) throw statusError;

    const statusMap = new Map((statuses ?? []).map((item) => [item.step_id, item.status]));
    const commentMap = new Map<string, typeof comments>();
    for (const comment of comments) {
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

async function loadAllComments(db: ReturnType<typeof supabase>) {
  const comments: {
    id: string;
    step_id: string;
    name: string;
    message: string;
    created_at: string;
  }[] = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await db
      .from("comments")
      .select("id, step_id, name, message, created_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = data ?? [];
    comments.push(...page);
    if (page.length < pageSize) return comments;
    offset += pageSize;
  }
}
