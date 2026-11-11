import { NextResponse } from "next/server";
import { getV2Session } from "@/lib/v2-auth";
import { roadmapSteps } from "@/lib/config";
import { databaseError, jsonError, supabase } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getV2Session();
    if (!session) return jsonError("Bitte melde dich erneut an.", 401);
    const term = new URL(request.url).searchParams.get("q")?.trim().slice(0, 80) ?? "";
    if (term.length < 2) return NextResponse.json({ groups: [] });
    const pattern = `%${term.replace(/[%_\\]/g, " ")}%`;
    const db = supabase();
    const fileRequestBase = db.from("v2_file_requests").select("id, title, filename, status, submitted_by")
      .ilike("title", pattern);
    const visibleFileRequestBase = session.role === "member"
      ? fileRequestBase.or(`status.eq.approved,submitted_by.eq.${session.userId}`)
      : fileRequestBase;
    const [documents, fileRequests, commentNames, commentMessages, eventTitles, eventDetails, messages] = await Promise.all([
      db.from("documents").select("id, title, filename, kind").ilike("title", pattern).limit(8),
      visibleFileRequestBase.limit(8),
      db.from("comments").select("id, step_id, name, message").ilike("name", pattern).limit(8),
      db.from("comments").select("id, step_id, name, message").ilike("message", pattern).limit(8),
      db.from("v2_calendar_events").select("id, title, details, starts_at").ilike("title", pattern).limit(8),
      db.from("v2_calendar_events").select("id, title, details, starts_at").ilike("details", pattern).limit(8),
      db.from("team_chat_messages").select("id, content, sender_name, deleted_at").is("deleted_at", null).ilike("content", pattern).limit(8),
    ]);
    for (const result of [documents, fileRequests, commentNames, commentMessages, eventTitles, eventDetails, messages]) if (result.error) throw result.error;
    const lowerTerm = term.toLocaleLowerCase("de");
    const groups = [
      {
        category: "Roadmap",
        items: roadmapSteps.filter((step) => `${step.title} ${step.description}`.toLocaleLowerCase("de").includes(lowerTerm))
          .slice(0, 8).map((step) => ({ id: step.id, title: step.title, detail: step.description, section: "roadmap" })),
      },
      {
        category: "Dokumente",
        items: [
          ...(documents.data ?? []).map((item) => ({ id: item.id, title: item.title, detail: item.filename ?? item.kind, section: "documents" as const })),
          ...(fileRequests.data ?? []).map((item) => ({ id: item.id, title: item.title, detail: `${item.filename} · ${item.status}`, section: "documents" as const })),
        ].slice(0, 8),
      },
      {
        category: "Kommentare",
        items: Array.from(new Map([...(commentNames.data ?? []), ...(commentMessages.data ?? [])].map((item) => [item.id, item])).values())
          .slice(0, 8).map((item) => ({ id: item.id, title: item.name, detail: item.message, section: "roadmap" as const, target: item.step_id })),
      },
      {
        category: "Kalender",
        items: Array.from(new Map([...(eventTitles.data ?? []), ...(eventDetails.data ?? [])].map((item) => [item.id, item])).values())
          .slice(0, 8).map((item) => ({ id: item.id, title: item.title, detail: item.details ?? new Date(item.starts_at).toLocaleString("de-DE"), section: "calendar" as const })),
      },
      {
        category: "Teamchat",
        items: (messages.data ?? []).map((item) => ({ id: item.id, title: item.sender_name, detail: item.content, section: "teamchat" })),
      },
    ].filter((group) => group.items.length);
    return NextResponse.json({ groups }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return databaseError(error);
  }
}
