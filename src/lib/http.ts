import { NextResponse } from "next/server";
import { DatabaseConfigurationError, getSupabaseAdmin } from "@/lib/supabase";

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function databaseError(error: unknown) {
  if (error instanceof DatabaseConfigurationError) {
    return jsonError("Die Datenbank ist nicht eingerichtet. Bitte prüfe die Supabase-Konfiguration.", 503);
  }
  console.error("Roadmap database request failed.", error);
  return jsonError("Die Daten konnten nicht geladen werden. Bitte versuche es später erneut.", 502);
}

export function supabase() {
  return getSupabaseAdmin();
}
