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
const defaultArgs = [
  "scan",
  "--config",
  ".semgrep.yml",
  "--no-git-ignore",
  "--error",
  "app",
  "lib",
  "components",
];

const res = spawnSync(bin, extraArgs.length > 0 ? extraArgs : defaultArgs, {
  stdio: "inherit",
  env: { ...process.env, PYTHONUTF8: "1" },
});

if (res.error) {
  console.error(`[semgrep] Failed to launch "${bin}": ${res.error.message}`);
  process.exit(1);
}
process.exit(res.status ?? 0);
