import { createHash, randomBytes } from "node:crypto";

export const COOKIE_NAME = "inquiry_session";
export const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

export function makeToken() {
  return randomBytes(32).toString("hex");
}

export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function readCookie(cookieHeader = "", name = COOKIE_NAME) {
  const pair = cookieHeader.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!pair) return null;
  try {
    return decodeURIComponent(pair.slice(name.length + 1));
  } catch {
    return null;
  }
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MS,
  };
}
