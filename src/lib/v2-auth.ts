import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { getSession, type SessionRole } from "@/lib/auth";

const scrypt = promisify(scryptCallback);

export type V2Role = SessionRole;
export type V2Session = {
  role: V2Role;
  userId?: string;
  expiresAt: number;
};

export async function getV2Session(): Promise<V2Session | null> {
  const session = await getSession();
  if (!session) return null;
  return session;
}

export async function hashV2Password(password: string) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `${salt.toString("base64url")}.${derived.toString("base64url")}`;
}

export async function verifyV2Password(password: string, encoded: string) {
  const [saltText, hashText, extra] = encoded.split(".");
  if (!saltText || !hashText || extra) return false;
  const salt = Buffer.from(saltText, "base64url");
  const expected = Buffer.from(hashText, "base64url");
  if (salt.length !== 16 || expected.length !== 64) return false;
  const actual = await scrypt(password, salt, expected.length) as Buffer;
  return timingSafeEqual(actual, expected);
}
