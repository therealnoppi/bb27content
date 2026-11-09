import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { getSession, isSameOrigin } from "@/lib/auth";
import { DOCUMENT_BUCKET, isDocumentStoragePath, MAX_PDF_SIZE } from "@/lib/document-storage";
import { databaseError, jsonError, supabase } from "@/lib/http";

export const dynamic = "force-dynamic";

const uploadSchema = z.object({
  filename: z.string().trim().min(1).max(255).refine((value) => value.toLowerCase().endsWith(".pdf")),
  size: z.number().int().min(1).max(MAX_PDF_SIZE),
});
const cleanupSchema = z.object({ storage_path: z.string().refine(isDocumentStoragePath) });

async function authorize(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Diese Anfrage ist nicht zulässig.", 403);
  const session = await getSession();
  if (!session) return jsonError("Bitte schalte zuerst die Roadmap frei.", 401);
  if (session.role !== "admin") return jsonError("Administratorzugriff ist erforderlich.", 403);
  return null;
}

export async function POST(request: Request) {
  const authorizationError = await authorize(request);
  if (authorizationError) return authorizationError;

  let input: z.infer<typeof uploadSchema>;
  try {
    input = uploadSchema.parse(await request.json());
  } catch {
    return jsonError("Bitte wähle eine PDF-Datei bis höchstens 25 MB aus.", 400);
  }

  try {
    const path = `pdf/${randomUUID()}.pdf`;
    const { data, error } = await supabase()
      .storage
      .from(DOCUMENT_BUCKET)
      .createSignedUploadUrl(path, { upsert: false });
    if (error) throw error;

    const storageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!storageUrl) return jsonError("Die Storage-Konfiguration ist unvollständig.", 503);
    return NextResponse.json({
      storage_path: path,
      filename: input.filename,
      signedUrl: new URL(data.signedUrl, storageUrl).toString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return databaseError(error);
  }
}

export async function DELETE(request: Request) {
  const authorizationError = await authorize(request);
  if (authorizationError) return authorizationError;

  let input: z.infer<typeof cleanupSchema>;
  try {
    input = cleanupSchema.parse(await request.json());
  } catch {
    return jsonError("Ungültige PDF-Datei.", 400);
  }

  try {
    const db = supabase();
    const { data: existing, error: existingError } = await db
      .from("documents")
      .select("id")
      .eq("storage_path", input.storage_path)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return jsonError("Die abgelegte PDF-Datei kann nicht entfernt werden.", 409);

    const { error } = await db.storage.from(DOCUMENT_BUCKET).remove([input.storage_path]);
    if (error) throw error;
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return databaseError(error);
  }
}
