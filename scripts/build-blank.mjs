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
import { renameSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const OUT = resolve(root, "out");
const BLANK_OUT = resolve(root, "out 2");

function build(blank) {
  rmSync(resolve(root, ".next"), { recursive: true, force: true });
  rmSync(OUT, { recursive: true, force: true });
  execFileSync(process.execPath, [resolve(root, "node_modules/next/dist/bin/next"), "build"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, NEXT_PUBLIC_ORVAN_BLANK: blank ? "1" : "0" },
  });
}

build(true);
rmSync(BLANK_OUT, { recursive: true, force: true });
renameSync(OUT, BLANK_OUT);
writeFileSync(resolve(BLANK_OUT, "START-HERE.txt"), `Orvan — tester edition

This folder contains the updated app with an empty account for new users.
Serve the entire folder with a static web server, or upload its contents to a
static host. Open the resulting address in your browser, not index.html directly.

Tasks, projects, monthly finances and settings are saved only in your browser.
Keep using the same address and browser profile to retain your data. Replacing
the app files at the same address preserves existing tester data. Clearing site
data or using private browsing can remove it. Each tester has their own data.

No demo tasks, projects or financial records are added to this edition.
`, "utf8");

// The showcase build is what `out` is expected to hold, so put it back rather
// than leaving the folder missing after a run.
build(false);

console.log('\nDone: "out" is the demo build, "out 2" is the blank tester build.');
