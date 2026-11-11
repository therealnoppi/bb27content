import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, isSameOrigin } from "@/lib/auth";
import { databaseError, jsonError, supabase } from "@/lib/http";

const idSchema = z.string().uuid();
const changeSchema = z.object({
  category: z.enum(["feature", "improvement", "fix", "other"]),
  description: z.string().trim().min(1).max(500),
});
const saveSchema = z.object({
  action: z.literal("save"),
  name: z.string().trim().min(1).max(120),
  version_number: z.string().trim().max(32).nullable().optional(),
  release_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isValidDate),
  description: z.string().trim().min(1).max(1000),
  changes: z.array(changeSchema).min(1).max(100),
});
const actionSchema = z.discriminatedUnion("action", [
  saveSchema,
  z.object({ action: z.literal("publish") }),
  z.object({ action: z.literal("archive") }),
]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return jsonError("Diese Anfrage ist nicht zulässig.", 403);
  try {
    const session = await getSession();
    if (!session) return jsonError("Bitte melde dich erneut an.", 401);
    if (session.role !== "admin") return jsonError("Administratorzugriff ist erforderlich.", 403);
    const { id } = await context.params;
    if (!idSchema.safeParse(id).success) return jsonError("Versionshinweis nicht gefunden.", 404);
    const input = actionSchema.parse(await request.json());
    const db = supabase();

    if (input.action === "save") {
      const { error } = await db.rpc("update_version_release", {
        p_id: id,
        p_name: input.name,
        p_version_number: input.version_number ?? null,
        p_release_date: input.release_date,
        p_description: input.description,
        p_changes: input.changes,
      });
      if (error) throw error;
    } else {
      const procedure = input.action === "publish" ? "publish_version_release" : "archive_version_release";
      const { error } = await db.rpc(procedure, { p_id: id });
      if (error) {
        if (error.code === "P0002") return jsonError("Diese Version kann in ihrem aktuellen Status nicht geändert werden.", 409);
        throw error;
      }
    }
    return NextResponse.json({ updated: true });
  } catch (error) {
    if (error instanceof z.ZodError) return jsonError("Ungültige Versionsdaten.", 400);
    return databaseError(error);
  }
}

function isValidDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
