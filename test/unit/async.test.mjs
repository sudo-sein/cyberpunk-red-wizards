// test/unit/async.test.mjs
import { test } from "node:test";
import { strictEqual, ok } from "node:assert/strict";
import { sleep, waitFor } from "../../scripts/utils/async.js";

test("sleep resolves after the delay", async () => {
  const t0 = Date.now();
  await sleep(20);
  ok(Date.now() - t0 >= 18);
});

test("waitFor resolves true as soon as predicate passes", async () => {
  let n = 0;
  const result = await waitFor(() => (++n >= 3), { intervalMs: 1, timeoutMs: 100 });
  strictEqual(result, true);
  strictEqual(n, 3);
});

test("waitFor resolves false on timeout", async () => {
  const result = await waitFor(() => false, { intervalMs: 1, timeoutMs: 10 });
  strictEqual(result, false);
});
