import { createHash, createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export type SessionRole = "visitor" | "admin";
type SessionPayload = { role: SessionRole; expiresAt: number };

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

export function createSessionToken(role: SessionRole) {
  const payload: SessionPayload = {
    role,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

function constantTimeEqual(left: string, right: string) {
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

export function authenticatePassword(password: string, role: SessionRole) {
  const expected =
    role === "admin" ? process.env.ADMIN_PASSWORD : process.env.SITE_PASSWORD;
  if (!expected) {
    throw new Error(
      `${role === "admin" ? "ADMIN_PASSWORD" : "SITE_PASSWORD"} is not configured.`,
    );
  }
  if (role === "admin" && expected === process.env.SITE_PASSWORD) {
    throw new Error("ADMIN_PASSWORD and SITE_PASSWORD must be different.");
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
      (payload.role !== "visitor" && payload.role !== "admin") ||
      !Number.isInteger(payload.expiresAt) ||
      payload.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function getSession() {
  return readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
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
