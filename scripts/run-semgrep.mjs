// Cross-platform Semgrep runner for GFL.
// Checks local .venv, sibling slp-activity-generator .venv, or semgrep on PATH.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const isWin = process.platform === "win32";
const candidates = isWin
  ? [
      resolve(".venv", "Scripts", "semgrep.exe"),
      resolve("..", "slp-activity-generator", ".venv", "Scripts", "semgrep.exe"),
    ]
  : [
      resolve(".venv", "bin", "semgrep"),
      resolve("..", "slp-activity-generator", ".venv", "bin", "semgrep"),
    ];

const bin = candidates.find((p) => existsSync(p)) ?? "semgrep";
const extraArgs = process.argv.slice(2);
const hasConfig = extraArgs.some(
  (a) => a === "--config" || a === "-c" || a.startsWith("--config=") || a.startsWith("-c="),
);
const cleanArgs = extraArgs[0] === "scan" ? extraArgs.slice(1) : extraArgs;
const hasErrorFlag = cleanArgs.includes("--error") || cleanArgs.includes("--no-error");
const finalArgs = [
  "scan",
  ...(hasConfig ? [] : ["--config", ".semgrep.yml"]),
  ...(hasErrorFlag ? [] : ["--error"]),
  ...(cleanArgs.length > 0 ? cleanArgs : ["--no-git-ignore", "app", "lib", "components", "context"]),
];

const res = spawnSync(bin, finalArgs, {
  stdio: "inherit",
  env: { ...process.env, PYTHONUTF8: "1" },
});

if (res.error) {
  console.error(`[semgrep] Failed to launch "${bin}": ${res.error.message}`);
  process.exit(1);
}
process.exit(res.status ?? 0);
