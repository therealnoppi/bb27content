import { NextResponse } from "next/server";
import { databaseError, jsonError, supabase } from "@/lib/http";
import { getV2Session } from "@/lib/v2-auth";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getV2Session();
    if (!session) return jsonError("Bitte melde dich erneut an.", 401);
    const { id } = await context.params;
    let query = supabase()
      .from("v2_file_requests")
      .select("filename, storage_path, status, submitted_by")
      .eq("id", id);
    if (session.role !== "admin") {
      query = query.eq("status", "approved");
    }
    const { data: file, error } = await query.maybeSingle();
    if (error) throw error;
    if (!file) return jsonError("Freigegebene PDF-Datei nicht gefunden.", 404);
    const { data, error: downloadError } = await supabase()
      .storage.from("v2-file-requests")
      .download(file.storage_path);
    if (downloadError) throw downloadError;
    return new NextResponse(data, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": 'attachment; filename="file.pdf"',
        "Content-Type": "application/pdf",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return databaseError(error);
  }
}
