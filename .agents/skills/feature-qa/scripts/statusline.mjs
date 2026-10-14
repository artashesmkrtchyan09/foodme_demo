#!/usr/bin/env node
// Claude Code status line: shows where the newest feature-qa run is.
// Wired in .claude/settings.json ("statusLine"). Reads the session JSON from stdin
// and qa-runs/*/00-progress.yaml (newest by modification time). No dependencies.
// Output examples:
//   QA SCRUM-12 ●●●●●○○○○○○○ 5/12 Test cases · cycle 2 · running
//   QA SCRUM-12 ●●○○○○○○○○○○ 2/12 Requirement approval · ⏸ waiting for you: answers to Q-1..Q-4 → /feature-qa continue
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

const STEPS = {
  1: "Requirement review", 2: "Requirement approval", 3: "Test plan", 4: "Test plan approval",
  5: "Test cases", 6: "Test case judge", 7: "Manual execution", 8: "Bug filing",
  9: "Automation", 10: "Automation judge", 11: "CI flake check", 12: "Pull request",
};
const CYCLE_KEY = { 1: "requirements", 2: "requirements", 3: "test_plan", 4: "test_plan",
  5: "test_cases", 6: "test_cases", 9: "automation", 10: "automation", 11: "automation" };
const C = { dim: "\x1b[2m", bold: "\x1b[1m", green: "\x1b[32m", yellow: "\x1b[33m", red: "\x1b[31m", cyan: "\x1b[36m", reset: "\x1b[0m" };

let input = {};
try { input = JSON.parse(readFileSync(0, "utf8") || "{}"); } catch {}
const root = input.workspace?.project_dir || input.workspace?.current_dir || input.cwd || process.cwd();
const model = input.model?.display_name || "";

function newestProgress() {
  const runs = join(root, "qa-runs");
  if (!existsSync(runs)) return null;
  let best = null;
  for (const d of readdirSync(runs)) {
    const p = join(runs, d, "00-progress.yaml");
    try {
      const m = statSync(p).mtimeMs;
      if (!best || m > best.m) best = { p, m, dir: join(runs, d), name: d };
    } catch {}
  }
  return best;
}

// Minimal reads of the fields the orchestrator writes (see references/artifacts.md §progress).
const top = (y, k) => (y.match(new RegExp(`^${k}:\\s*(.*)$`, "m")) || [])[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
const inline = (line, k) => (line.match(new RegExp(`\\b${k}:\\s*("([^"]*)"|[^,}]*)`)) || [])
  .slice(1).reverse().find((v) => v !== undefined)?.trim() ?? "";

function render() {
  const run = newestProgress();
  if (!run) return `${C.dim}${model}${model ? " · " : ""}no feature-qa run${C.reset}`;
  const y = readFileSync(run.p, "utf8");
  const step = Number(top(y, "current_step")) || 0;
  const status = top(y, "status") || "running";
  const key = inline(top(y, "source"), "ref") || run.name.replace(/-\d{4}-\d{2}-\d{2}(-\d+)?$/, "");
  const cycles = top(y, "cycles");
  const ck = CYCLE_KEY[step];
  const cycle = ck ? Number(inline(cycles, ck)) || 0 : 0;

  const done = status === "done";
  const filled = done ? 12 : Math.max(0, step - 1);
  const bar = `${C.green}${"●".repeat(filled)}${C.reset}${!done && step ? `${C.cyan}◉${C.reset}` : ""}${C.dim}${"○".repeat(Math.max(0, 12 - filled - (!done && step ? 1 : 0)))}${C.reset}`;

  let state;
  if (done) {
    let rec = "";
    try { rec = (readFileSync(join(run.dir, "99-verdict.md"), "utf8").match(/^recommendation:\s*(.+)$/m) || [])[1]?.trim() || ""; } catch {}
    const col = /^ready$/i.test(rec) ? C.green : /not/i.test(rec) ? C.red : C.yellow;
    state = `${C.green}✔ done${C.reset}${rec ? ` · ${col}${rec}${C.reset}` : ""}`;
  } else if (status === "waiting_for_human") {
    const what = inline(top(y, "waiting_for"), "what");
    state = `${C.yellow}${C.bold}⏸ waiting for you${C.reset}${C.yellow}${what ? `: ${what}` : ""} → /feature-qa continue${C.reset}`;
  } else if (status === "blocked") {
    state = `${C.red}⛔ blocked${top(y, "blocked_reason") && top(y, "blocked_reason") !== "null" ? `: ${top(y, "blocked_reason")}` : ""}${C.reset}`;
  } else {
    state = `${C.cyan}▶ ${status}${C.reset}`;
  }

  const stepTxt = done ? "12/12 complete" : `${step}/12 ${STEPS[step] || "starting"}${cycle > 1 ? ` · cycle ${cycle}` : ""}`;
  return `${C.bold}QA ${key}${C.reset} ${bar} ${stepTxt} · ${state}`;
}

try { process.stdout.write(render()); } catch { process.stdout.write("feature-qa: status unavailable"); }
