import { createHash, createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase";

export type SessionRole = "member" | "admin";
type SessionPayload =
  | { role: "visitor"; expiresAt: number }
  | { role: "admin"; expiresAt: number }
  | { role: "member"; expiresAt: number; userId: string };
export type ActiveSession = Exclude<SessionPayload, { role: "visitor" }>;

export const SESSION_COOKIE = "northstar_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  }
  return secret;
}

function sign(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

export function createSessionToken(role: SessionRole, userId?: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS;
  let payload: SessionPayload;
  if (role === "member") {
    if (!userId) throw new Error("Member sessions require a user ID.");
    payload = { role, userId, expiresAt };
  } else {
    payload = { role, expiresAt };
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

function constantTimeEqual(left: string, right: string) {
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

export function authenticatePassword(password: string, role: "admin") {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    throw new Error("ADMIN_PASSWORD is not configured.");
  }
  return constantTimeEqual(password, expected);
}

export function readSessionToken(token?: string | null): SessionPayload | null {
  if (!token) return null;
  const [encoded, suppliedSignature, extra] = token.split(".");
  if (!encoded || !suppliedSignature || extra) return null;

  const expectedSignature = sign(encoded);
  if (!constantTimeEqual(suppliedSignature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (
      !Number.isInteger(payload.expiresAt) ||
      payload.expiresAt <= Math.floor(Date.now() / 1000) ||
      (payload.role !== "visitor" && payload.role !== "member" && payload.role !== "admin") ||
      (payload.role === "member" && !payload.userId)
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<ActiveSession | null> {
  const session = readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session || session.role === "visitor") return null;
  if (session.role !== "member" || !session.userId) return session;

  const { data, error } = await getSupabaseAdmin()
    .from("v2_users")
    .select("id")
    .eq("id", session.userId)
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  return data ? session : null;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  };
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}
