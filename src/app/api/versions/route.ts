import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, isSameOrigin } from "@/lib/auth";
import { databaseError, jsonError, supabase } from "@/lib/http";

export const dynamic = "force-dynamic";

const changeSchema = z.object({
  category: z.enum(["feature", "improvement", "fix", "other"]),
  description: z.string().trim().min(1).max(500),
});
const releaseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  version_number: z.string().trim().max(32).nullable().optional(),
  release_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isValidDate),
  description: z.string().trim().min(1).max(1000),
  changes: z.array(changeSchema).min(1).max(100),
});

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return jsonError("Bitte melde dich erneut an.", 401);

    let query = supabase()
      .from("version_releases")
      .select("id, name, version_number, release_date, description, status, published_at, created_at, updated_at")
      .order("release_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (session.role !== "admin") query = query.not("published_at", "is", null);

    const { data: releases, error } = await query.limit(1000);
    if (error) throw error;
    const releaseIds = (releases ?? []).map((release) => release.id);
    if (!releaseIds.length) return NextResponse.json({ releases: [] }, noStore);

    const [{ data: changes, error: changesError }, { data: reads, error: readsError }] = await Promise.all([
      supabase().from("version_release_changes")
        .select("id, release_id, category, description, sort_order")
        .in("release_id", releaseIds)
        .order("sort_order", { ascending: true }),
      session.role === "admin"
        ? supabase().from("version_release_reads").select("release_id").eq("reader_key", "admin")
          .in("release_id", releaseIds)
        : supabase().from("version_release_reads").select("release_id").eq("reader_key", session.userId!)
          .in("release_id", releaseIds),
    ]);
    if (changesError) throw changesError;
    if (readsError) throw readsError;
    const readIds = new Set((reads ?? []).map((read) => read.release_id));
    const changesByRelease = new Map<string, NonNullable<typeof changes>>();
    for (const change of changes ?? []) {
      const current = changesByRelease.get(change.release_id) ?? [];
      current.push(change);
      changesByRelease.set(change.release_id, current);
    }

    return NextResponse.json({
      releases: (releases ?? []).map((release) => ({
        ...release,
        changes: changesByRelease.get(release.id) ?? [],
        is_read: readIds.has(release.id),
      })),
    }, noStore);
  } catch (error) {
    return databaseError(error);
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Diese Anfrage ist nicht zulässig.", 403);
  try {
    const session = await getSession();
    if (!session) return jsonError("Bitte melde dich erneut an.", 401);
    if (session.role !== "admin") return jsonError("Administratorzugriff ist erforderlich.", 403);
    const input = releaseSchema.parse(await request.json());
    const { data, error } = await supabase().rpc("create_version_release", {
      p_name: input.name,
      p_version_number: input.version_number ?? null,
      p_release_date: input.release_date,
      p_description: input.description,
      p_changes: input.changes,
    });
    if (error) throw error;
    return NextResponse.json({ id: data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return jsonError("Bitte prüfe Versionsname, Datum, Beschreibung und Änderungsliste.", 400);
    return databaseError(error);
  }
}

function isValidDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const noStore = { headers: { "Cache-Control": "no-store" } };
