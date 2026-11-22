import { randomBytes, scrypt as callbackScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(callbackScrypt);

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64);
  return `${salt}:${hash.toString("hex")}`;
}

export async function verifyPassword(password, stored) {
  const [salt, expectedHex] = stored?.split(":") ?? [];
  if (!salt || !expectedHex || !/^[a-f0-9]{128}$/i.test(expectedHex)) return false;

  const expected = Buffer.from(expectedHex, "hex");
  const actual = await scrypt(password, salt, expected.length);
  return timingSafeEqual(expected, actual);
}
