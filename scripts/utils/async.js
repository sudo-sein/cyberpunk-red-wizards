// scripts/utils/async.js

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Poll `predicate` every intervalMs until it returns truthy or timeoutMs
// elapses. Resolves true if the predicate passed, false on timeout. The
// timer is injectable (sleepFn) so callers/tests control timing.
export async function waitFor(predicate, { intervalMs = 50, timeoutMs = 2000, sleepFn = sleep } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await sleepFn(intervalMs);
  }
  return predicate() ? true : false;
}
