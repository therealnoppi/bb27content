import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { databaseError, jsonError, supabase } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await getSession())) return jsonError("Bitte schalte zuerst die Roadmap frei.", 401);
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return jsonError("PDF-Dokument nicht gefunden.", 404);
  }

  try {
    const db = supabase();
    const { data: document, error } = await db
      .from("documents")
      .select("filename, storage_path")
      .eq("id", id)
      .eq("kind", "pdf")
      .maybeSingle();
    if (error) throw error;
    if (!document?.storage_path) return jsonError("PDF-Dokument nicht gefunden.", 404);

    const { data: file, error: downloadError } = await db.storage
      .from("project-documents")
      .download(document.storage_path);
    if (downloadError) throw downloadError;
    return new NextResponse(file, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="document.pdf"; filename*=UTF-8''${encodeURIComponent(document.filename ?? "document.pdf")}`,
        "Content-Type": "application/pdf",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return databaseError(error);
  }
}
