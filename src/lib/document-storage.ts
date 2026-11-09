import type { SupabaseClient } from "@supabase/supabase-js";

export const DOCUMENT_BUCKET = "project-documents";
export const MAX_PDF_SIZE = 25 * 1024 * 1024;

export function isDocumentStoragePath(value: string) {
  return /^pdf\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$/i.test(value);
}

export async function hasValidUploadedPdf(db: SupabaseClient, path: string) {
  if (!isDocumentStoragePath(path)) return false;
  const filename = path.slice("pdf/".length);
  const { data, error } = await db.storage
    .from(DOCUMENT_BUCKET)
    .list("pdf", { search: filename, limit: 1 });
  if (error) throw error;

  const file = data?.find((item) => item.name === filename);
  if (!file) return false;
  const metadata = file.metadata as { mimetype?: string; size?: number } | null;
  if (!(
    (!metadata?.mimetype || metadata.mimetype === "application/pdf") &&
    typeof metadata?.size === "number" &&
    metadata.size > 0 &&
    metadata.size <= MAX_PDF_SIZE
  )) return false;

  const { data: blob, error: downloadError } = await db.storage
    .from(DOCUMENT_BUCKET)
    .download(path);
  if (downloadError) throw downloadError;
  return blob.slice(0, 5).text().then((header) => header === "%PDF-");
}
