import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { databaseError, supabase } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    let name: string | null = null;
    if (session?.role === "member" && session.userId) {
      const { data, error } = await supabase().from("v2_users").select("name").eq("id", session.userId).maybeSingle();
      if (error) throw error;
      name = data?.name ?? null;
    }
    return NextResponse.json(
      { authenticated: Boolean(session), role: session?.role ?? null, name },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return databaseError(error);
  }
}
