// Local CI-equivalent pre-push verification runner (`npm run verify:prepush`).
// Runs lint → Semgrep SAST → unit suite → production build, stopping at the
// first failure with a clear step name. The fast subset (semgrep + test) is
// what .githooks/pre-push and scripts/claude-prepush-gate.mjs enforce on every
// push; this is the full gate to run before asking "Push?".
import { spawnSync } from "node:child_process";

const isWin = process.platform === "win32";
const npmCmd = isWin ? "npm.cmd" : "npm";

function runStep(label, args) {
  console.log(`\n=== [verify:prepush] ${label} ===`);
  const result = spawnSync(npmCmd, args, { stdio: "inherit", shell: isWin });
  if (result.status !== 0) {
    console.error(`\n[verify:prepush] FAILED at step: ${label}`);
    process.exit(result.status || 1);
  }
}

runStep("Lint (eslint app components lib)", ["run", "lint"]);
runStep("Semgrep SAST ruleset (.semgrep.yml)", ["run", "semgrep"]);
runStep("Unit suite (node:test via tsx)", ["test"]);
runStep("Production build (next build)", ["run", "build"]);

console.log("\n[verify:prepush] ALL PRE-PUSH CHECKS PASSED.");
