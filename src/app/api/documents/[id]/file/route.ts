import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, isSameOrigin } from "@/lib/auth";
import { DOCUMENT_BUCKET, hasValidUploadedPdf, isDocumentStoragePath } from "@/lib/document-storage";
import { databaseError, jsonError, supabase } from "@/lib/http";

export const dynamic = "force-dynamic";

const replacementSchema = z.object({
  filename: z.string().trim().min(1).max(255).refine((value) => value.toLowerCase().endsWith(".pdf")),
  storage_path: z.string().refine(isDocumentStoragePath),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) return jsonError("Diese Anfrage ist nicht zulässig.", 403);
  const session = await getSession();
  if (!session) return jsonError("Bitte schalte zuerst die Roadmap frei.", 401);
  if (session.role !== "admin") return jsonError("Administratorzugriff ist erforderlich.", 403);

  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return jsonError("Dokument nicht gefunden.", 404);
  }

  let input: z.infer<typeof replacementSchema>;
  try {
    input = replacementSchema.parse(await request.json());
  } catch {
    return jsonError("Bitte wähle eine gültige PDF-Version aus.", 400);
  }

  try {
    const db = supabase();
    const { data: document, error: readError } = await db
      .from("documents")
      .select("id, kind, storage_path")
      .eq("id", id)
      .maybeSingle();
    if (readError) throw readError;
    if (!document || document.kind !== "pdf") return jsonError("PDF-Dokument nicht gefunden.", 404);

    if (document.storage_path === input.storage_path) {
      return jsonError("Bitte lade eine neue PDF-Datei als Version hoch.", 400);
    }
    const { data: existing, error: existingError } = await db
      .from("documents")
      .select("id")
      .eq("storage_path", input.storage_path)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return jsonError("Diese PDF-Datei ist bereits abgelegt.", 409);

    if (!(await hasValidUploadedPdf(db, input.storage_path))) {
      return jsonError("Die hochgeladene PDF-Datei ist ungültig oder zu groß.", 400);
    }

    const { data, error } = await db
      .from("documents")
      .update({
        filename: input.filename,
        storage_path: input.storage_path,
        updated_at: new Date().toISOString(),
        updated_by: null,
        updated_by_is_admin: true,
      })
      .eq("id", id)
      .eq("storage_path", document.storage_path)
      .select("id, kind, title, filename, url, created_at, updated_at")
      .single();
    if (error) {
      const { error: cleanupError } = await db.storage
        .from(DOCUMENT_BUCKET)
        .remove([input.storage_path]);
      if (cleanupError) console.error("Could not clean up an unregistered replacement PDF.", cleanupError);
      throw error;
    }

    if (document.storage_path) {
      const { error: removeError } = await db.storage
        .from(DOCUMENT_BUCKET)
        .remove([document.storage_path]);
      if (removeError) {
        console.error("The previous PDF version could not be removed.", removeError);
        return NextResponse.json({
          document: data,
          warning: "Die neue Version ist gespeichert, die alte Datei konnte jedoch nicht entfernt werden.",
        });
      }
    }
    return NextResponse.json({ document: data });
  } catch (error) {
    return databaseError(error);
  }
}
