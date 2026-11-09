import { NextResponse } from "next/server";
import { getSession, isSameOrigin } from "@/lib/auth";
import { databaseError, jsonError, supabase } from "@/lib/http";

export async function DELETE(
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

  try {
    const db = supabase();
    const { data: document, error: readError } = await db
      .from("documents")
      .select("id, storage_path")
      .eq("id", id)
      .maybeSingle();
    if (readError) throw readError;
    if (!document) return jsonError("Dokument nicht gefunden.", 404);

    const { error: deleteError } = await db.from("documents").delete().eq("id", id);
    if (deleteError) throw deleteError;
    if (document.storage_path) {
      const { error: storageError } = await db.storage
        .from("project-documents")
        .remove([document.storage_path]);
      if (storageError) {
        console.error("Document metadata was deleted, but its PDF could not be removed.", storageError);
        return jsonError("Der Eintrag wurde gelöscht, die gespeicherte PDF-Datei konnte jedoch nicht entfernt werden.", 502);
      }
    }
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return databaseError(error);
  }
}
