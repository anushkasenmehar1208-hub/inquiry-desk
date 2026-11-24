import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);

test("an occupied API port reports startup failure, never readiness", async () => {
  const occupied = createServer();
  occupied.listen(0);
  await once(occupied, "listening");
  try {
    const port = occupied.address().port;
    await assert.rejects(
      exec(process.execPath, [fileURLToPath(new URL("../src/server.js", import.meta.url))], {
        timeout: 10000,
        env: {
          ...process.env,
          PORT: String(port),
          NODE_ENV: "test",
          DATABASE_URL: "postgres://localhost/inquiry_desk_test",
        },
      }),
      (error) => {
        assert.equal(error.code, 1);
        assert.match(error.stderr, /API failed to start on port/);
        assert.match(error.stderr, /EADDRINUSE|address already in use/i);
        assert.doesNotMatch(error.stdout, /API ready/);
        return true;
      },
    );
  } finally {
    await new Promise((resolve, reject) => occupied.close((error) => error ? reject(error) : resolve()));
  }
});
