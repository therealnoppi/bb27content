import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin } from "@/lib/auth";
import { hasValidUploadedPdf, isV2RequestStoragePath } from "@/lib/document-storage";
import { databaseError, jsonError, supabase } from "@/lib/http";
import { getV2Session } from "@/lib/v2-auth";

export const dynamic = "force-dynamic";

const pdfRequestSchema = z.object({
  kind: z.literal("pdf"),
  title: z.string().trim().min(1).max(120),
  filename: z.string().trim().min(1).max(255).refine((value) => value.toLowerCase().endsWith(".pdf")),
  storage_path: z.string().min(1).max(200),
});
const linkRequestSchema = z.object({
  kind: z.literal("link"),
  title: z.string().trim().min(1).max(120),
  url: z.string().url().max(2048).refine((value) => {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }),
});
const requestSchema = z.discriminatedUnion("kind", [pdfRequestSchema, linkRequestSchema]);

export async function GET() {
  try {
    const session = await getV2Session();
    if (!session) return jsonError("Bitte melde dich erneut an.", 401);
    let query = supabase()
      .from("v2_file_requests")
      .select("id, kind, title, filename, url, status, submitted_by, submitted_by_name, created_at, reviewed_at")
      .order("created_at", { ascending: false });
    if (session.role === "member") {
      query = query.or(`status.eq.approved,submitted_by.eq.${session.userId}`);
    } else if (session.role !== "admin") {
      query = query.eq("status", "approved");
    }
    const { data, error } = await query.limit(200);
    if (error) throw error;
    return NextResponse.json({ files: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return databaseError(error);
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Diese Anfrage ist nicht zulässig.", 403);
  try {
    const session = await getV2Session();
    if (!session) return jsonError("Bitte melde dich erneut an.", 401);
    if (session.role !== "member" || !session.userId) return jsonError("Dateianfragen sind nur mit einem persönlichen Zugang möglich.", 403);
    const input = requestSchema.parse(await request.json());
    const db = supabase();
    if (input.kind === "pdf") {
      if (
        !isV2RequestStoragePath(input.storage_path) ||
        !input.storage_path.startsWith(`pending/${session.userId}/`)
      ) return jsonError("Ungültige Upload-Datei.", 400);
      if (!(await hasValidUploadedPdf(db, input.storage_path, "v2-file-requests"))) {
        return jsonError("Die hochgeladene PDF-Datei ist ungültig oder zu groß.", 400);
      }
    }
    const { data: user, error: userError } = await db
      .from("v2_users")
      .select("name")
      .eq("id", session.userId)
      .eq("active", true)
      .single();
    if (userError) throw userError;
    const { data, error } = await db
      .from("v2_file_requests")
      .insert({
        kind: input.kind,
        title: input.title,
        filename: input.kind === "pdf" ? input.filename : null,
        storage_path: input.kind === "pdf" ? input.storage_path : null,
        url: input.kind === "link" ? input.url : null,
        submitted_by: session.userId,
        submitted_by_name: user.name,
      })
      .select("id, kind, title, filename, url, status, submitted_by, submitted_by_name, created_at, reviewed_at")
      .single();
    if (error) throw error;
    return NextResponse.json({ file: data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return jsonError("Bitte prüfe Titel, HTTPS-Adresse und PDF-Datei.", 400);
    return databaseError(error);
  }
}
