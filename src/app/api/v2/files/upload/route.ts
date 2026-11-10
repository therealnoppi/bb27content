import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { isSameOrigin } from "@/lib/auth";
import { isV2RequestStoragePath, MAX_PDF_SIZE } from "@/lib/document-storage";
import { databaseError, jsonError, supabase } from "@/lib/http";
import { getV2Session } from "@/lib/v2-auth";

export const dynamic = "force-dynamic";

const schema = z.object({
  filename: z.string().trim().min(1).max(255).refine((value) => value.toLowerCase().endsWith(".pdf")),
  size: z.number().int().min(1).max(MAX_PDF_SIZE),
});
const cleanupSchema = z.object({ storage_path: z.string().min(1).max(200) });

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Diese Anfrage ist nicht zulässig.", 403);
  try {
    const session = await getV2Session();
    if (!session?.userId || session.role !== "member") return jsonError("Ein aktiver persönlicher Zugang ist erforderlich.", 403);
    const input = schema.parse(await request.json());
    const path = `pending/${session.userId}/${randomUUID()}.pdf`;
    const { data, error } = await supabase()
      .storage.from("v2-file-requests")
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
    if (error instanceof z.ZodError) return jsonError("Bitte wähle eine PDF-Datei bis höchstens 25 MB aus.", 400);
    return databaseError(error);
  }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Diese Anfrage ist nicht zulässig.", 403);
  try {
    const session = await getV2Session();
    if (!session?.userId || session.role !== "member") return jsonError("Ein aktiver persönlicher Zugang ist erforderlich.", 403);
    const { storage_path: path } = cleanupSchema.parse(await request.json());
    if (!isV2RequestStoragePath(path) || !path.startsWith(`pending/${session.userId}/`)) {
      return jsonError("Ungültige Upload-Datei.", 400);
    }
    const db = supabase();
    const { data, error: lookupError } = await db
      .from("v2_file_requests")
      .select("id")
      .eq("storage_path", path)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (data) return jsonError("Eine eingereichte Datei kann nicht entfernt werden.", 409);
    const { error } = await db.storage.from("v2-file-requests").remove([path]);
    if (error) throw error;
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error instanceof z.ZodError) return jsonError("Ungültige Upload-Datei.", 400);
    return databaseError(error);
  }
}
