import type { SupabaseClient } from "@supabase/supabase-js";

export const DOCUMENT_BUCKET = "project-documents";
export const MAX_PDF_SIZE = 25 * 1024 * 1024;
const UUID_PATTERN = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";

export function isDocumentStoragePath(value: string) {
  return new RegExp(`^pdf/${UUID_PATTERN}\\.pdf$`, "i").test(value);
}

export function isV2RequestStoragePath(value: string) {
  return new RegExp(`^pending/${UUID_PATTERN}/${UUID_PATTERN}\\.pdf$`, "i").test(value);
}

export async function hasValidUploadedPdf(
  db: SupabaseClient,
  path: string,
  bucket = DOCUMENT_BUCKET,
) {
  const validPath = bucket === DOCUMENT_BUCKET
    ? isDocumentStoragePath(path)
    : isV2RequestStoragePath(path);
  if (!validPath) return false;
  const filename = path.slice(path.lastIndexOf("/") + 1);
  const folder = path.slice(0, path.lastIndexOf("/"));
  const { data, error } = await db.storage
    .from(bucket)
    .list(folder, { search: filename, limit: 1 });
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
    .from(bucket)
    .download(path);
  if (downloadError) throw downloadError;
  return blob.slice(0, 5).text().then((header) => header === "%PDF-");
}
