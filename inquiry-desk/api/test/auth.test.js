import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/lib/password.js";
import { hashToken, makeToken, readCookie } from "../src/lib/session.js";

test("password verification only accepts the correct password", async () => {
  const saved = await hashPassword("Welcome123!");
  assert.equal(await verifyPassword("Welcome123!", saved), true);
  assert.equal(await verifyPassword("wrong", saved), false);
  assert.equal(await verifyPassword("Welcome123!", "not-a-hash"), false);
});

test("session tokens are random and stored only as hashes", () => {
  const tokenA = makeToken();
  const tokenB = makeToken();
  assert.notEqual(tokenA, tokenB);
  assert.equal(hashToken(tokenA).length, 64);
  assert.notEqual(hashToken(tokenA), tokenA);
});

test("cookie parser reads named cookies and handles bad encoding", () => {
  assert.equal(readCookie("theme=dark; inquiry_session=abc123"), "abc123");
  assert.equal(readCookie("theme=dark"), null);
  assert.equal(readCookie("inquiry_session=%ZZ"), null);
});
