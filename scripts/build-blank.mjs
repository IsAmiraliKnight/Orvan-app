/*
 * Builds the tester copy of the app into `out 2`.
 *
 * Same code as the showcase build, one flag apart: `NEXT_PUBLIC_ORVAN_BLANK`
 * makes a new browser start on an empty account instead of the demo one, and
 * puts its saved state under its own key so the two can be served side by side
 * without one inheriting the other's data.
 *
 * Two builds cannot share `.next`, because the flag is baked into the chunks —
 * leaving the previous build's cache behind copies its chunks into the export
 * alongside the current ones. So each run starts from a clean cache, and `out`
 * is restored to the showcase build afterwards.
 *
 *   npm run build:blank
 */
import { execFileSync } from "node:child_process";
import { renameSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const OUT = resolve(root, "out");
const BLANK_OUT = resolve(root, "out 2");

function build(blank) {
  rmSync(resolve(root, ".next"), { recursive: true, force: true });
  rmSync(OUT, { recursive: true, force: true });
  execFileSync("npx", ["next", "build"], {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: blank ? { ...process.env, NEXT_PUBLIC_ORVAN_BLANK: "1" } : process.env,
  });
}

build(true);
rmSync(BLANK_OUT, { recursive: true, force: true });
renameSync(OUT, BLANK_OUT);

// The showcase build is what `out` is expected to hold, so put it back rather
// than leaving the folder missing after a run.
build(false);

console.log('\nDone: "out" is the demo build, "out 2" is the blank tester build.');
