// Claude Code PreToolUse hook (see .claude/settings.json). Inspects the Bash
// command about to run:
//   - `git push`   → runs the same fast gate as .githooks/pre-push (Semgrep
//                    SAST + unit suite) and DENIES the push on failure.
//   - `git commit` → runs `npm run lint` and denies the commit on failure
//                    (AGENTS.md: lint before every commit).
// Every other Bash command passes through instantly.
//
// This makes the "gate before push" rule in AGENTS.md enforced rather than
// behavioral. It does not replace the diff reviewers or the user's explicit
// "push" confirmation. The full gate (lint + semgrep + test + build) remains
// `npm run verify:prepush`.
import { spawnSync } from "node:child_process";

let input = "";
try {
  input = (await new Promise((resolve) => {
    let buf = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (d) => { buf += d; });
    process.stdin.on("end", () => resolve(buf));
    process.stdin.on("error", () => resolve(buf));
  })) || "";
} catch { /* no stdin */ }

let command = "";
try { command = JSON.parse(input)?.tool_input?.command || ""; } catch { /* not JSON */ }

const isPush = /\bgit\b[^\n;&|]*\bpush\b/.test(command);
const isCommit = !isPush && /\bgit\b[^\n;&|]*\bcommit\b/.test(command);
if (!isPush && !isCommit) process.exit(0);

const isWin = process.platform === "win32";
const npm = isWin ? "npm.cmd" : "npm";
const steps = isPush
  ? [["Semgrep SAST", ["run", "semgrep"]], ["Unit suite", ["test"]]]
  : [["Lint", ["run", "lint"]]];

for (const [label, args] of steps) {
  const r = spawnSync(npm, args, { stdio: ["ignore", "pipe", "pipe"], shell: isWin, encoding: "utf8" });
  if (r.status !== 0) {
    const tail = `${r.stdout || ""}\n${r.stderr || ""}`.trim().split("\n").slice(-25).join("\n");
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `${isPush ? "Pre-push" : "Pre-commit"} gate failed at: ${label}. Fix it before ${isPush ? "pushing" : "committing"}.\n${tail}`,
      },
    }));
    process.exit(0);
  }
}
process.stdout.write(JSON.stringify({
  systemMessage: isPush
    ? "Pre-push gate passed: Semgrep 0 findings, unit suite green."
    : "Pre-commit gate passed: lint clean.",
}));
process.exit(0);
