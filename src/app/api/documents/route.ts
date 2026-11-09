import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, isSameOrigin } from "@/lib/auth";
import { DOCUMENT_BUCKET, hasValidUploadedPdf, isDocumentStoragePath } from "@/lib/document-storage";
import { databaseError, jsonError, supabase } from "@/lib/http";

export const dynamic = "force-dynamic";

const linkSchema = z.object({
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
const pdfSchema = z.object({
  kind: z.literal("pdf"),
  title: z.string().trim().min(1).max(120),
  filename: z.string().trim().min(1).max(255).refine((value) => value.toLowerCase().endsWith(".pdf")),
  storage_path: z.string().refine(isDocumentStoragePath),
});
const createSchema = z.discriminatedUnion("kind", [linkSchema, pdfSchema]);

export async function GET() {
  if (!(await getSession())) return jsonError("Bitte schalte zuerst die Roadmap frei.", 401);

  try {
    const { data, error } = await supabase()
      .from("documents")
      .select("id, kind, title, filename, url, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const documents = data ?? [];
    return NextResponse.json({
      documents,
      counts: {
        pdf: documents.filter((document) => document.kind === "pdf").length,
        link: documents.filter((document) => document.kind === "link").length,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return databaseError(error);
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Diese Anfrage ist nicht zulässig.", 403);
  const session = await getSession();
  if (!session) return jsonError("Bitte schalte zuerst die Roadmap frei.", 401);
  if (session.role !== "admin") return jsonError("Administratorzugriff ist erforderlich.", 403);

  let input: z.infer<typeof createSchema>;
  try {
    input = createSchema.parse(await request.json());
  } catch {
    return jsonError("Bitte prüfe Titel, HTTPS-Adresse und PDF-Datei.", 400);
  }

  if (input.kind === "pdf") return createPdf(input);

  try {
    const { data, error } = await supabase()
      .from("documents")
      .insert({ kind: "link", title: input.title, url: input.url })
      .select("id, kind, title, filename, url, created_at, updated_at")
      .single();
    if (error) throw error;
    return NextResponse.json({ document: data }, { status: 201 });
  } catch (error) {
    if (isLimitError(error, "link")) return jsonError("Es können höchstens 15 Links abgelegt werden.", 409);
    return databaseError(error);
  }
}

async function createPdf(input: z.infer<typeof pdfSchema>) {
  try {
    const db = supabase();
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
      .insert({
        kind: "pdf",
        title: input.title,
        filename: input.filename,
        storage_path: input.storage_path,
      })
      .select("id, kind, title, filename, url, created_at, updated_at")
      .single();
    if (error) {
      const { error: cleanupError } = await db.storage.from(DOCUMENT_BUCKET).remove([input.storage_path]);
      if (cleanupError) console.error("Could not clean up an unregistered PDF.", cleanupError);
      throw error;
    }
    return NextResponse.json({ document: data }, { status: 201 });
  } catch (error) {
    if (isLimitError(error, "pdf")) {
      return jsonError("Es können höchstens 10 PDFs abgelegt werden.", 409);
    }
    return databaseError(error);
  }
}

function isLimitError(error: unknown, kind: "pdf" | "link") {
  return error instanceof Error && error.message.includes(`document_limit_${kind}`);
}
