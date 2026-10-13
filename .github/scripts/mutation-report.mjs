// Validates, recomputes and renders the mutation reports written by the
// mutation-test skill. The gate trusts these numbers, not the agent's own.
//
// CLI: node mutation-report.mjs <reportsDir> <threshold> <modulesCsv>
//   reads mutation-report-*.json (recursively), writes summary.md and
//   status.json ({state, description}) into <reportsDir>.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const STATUSES = new Set(["KILLED", "SURVIVED", "INVALID"]);

const errorReport = (module, error) => ({
  module,
  mutations: 0,
  killed: 0,
  survived: 0,
  score: 0,
  result: "ERROR",
  error,
  mutants: [],
});

export function normalize(report, threshold) {
  if (report === null || typeof report !== "object" || Array.isArray(report)) {
    return errorReport("unknown", "report is not a JSON object");
  }
  const module = typeof report.module === "string" ? report.module : "unknown";
  if (!Array.isArray(report.mutants)) {
    return errorReport(module, "mutants is not an array");
  }
  const bad = report.mutants.find((m) => !m || !STATUSES.has(m.status));
  if (bad !== undefined) {
    return errorReport(module, `unknown mutant status: ${bad?.status}`);
  }

  const killed = report.mutants.filter((m) => m.status === "KILLED").length;
  const survived = report.mutants.filter((m) => m.status === "SURVIVED").length;
  const mutations = killed + survived;
  const score = mutations === 0 ? 0 : Math.round((killed / mutations) * 1000) / 10;

  let result;
  if (report.result === "SKIPPED" || report.result === "ERROR") result = report.result;
  else if (mutations === 0) result = "ERROR";
  else result = score >= threshold ? "PASS" : "FAIL";

  const out = {
    module,
    mutations,
    killed,
    survived,
    score,
    threshold,
    result,
    mutants: report.mutants,
  };
  if (result === "ERROR" && mutations === 0 && report.result !== "ERROR") {
    out.error = "no killed or survived mutants were recorded";
  } else if (typeof report.error === "string") {
    out.error = report.error;
  }
  return out;
}

export function overall(reports, expectedModules) {
  const missing = expectedModules.filter((m) => !reports.some((r) => r.module === m));
  if (missing.length > 0) {
    return { state: "failure", description: `No mutation report for: ${missing.join(", ")}` };
  }
  const bad = reports.filter((r) => r.result === "FAIL" || r.result === "ERROR");
  if (bad.length > 0) {
    const list = bad.map((r) => `${r.module} ${r.result}`).join(", ");
    return { state: "failure", description: `Mutation testing failed: ${list}` };
  }
  return { state: "success", description: "Mutation testing passed" };
}

const cell = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

export function renderMarkdown(reports, marker) {
  const lines = [marker, "## Mutation testing", ""];
  if (reports.length === 0) {
    lines.push("No source changes to mutate.");
    return lines.join("\n") + "\n";
  }
  lines.push(
    "| Module | Mutations | Killed | Survived | Score | Result |",
    "|---|---|---|---|---|---|",
  );
  for (const r of reports) {
    lines.push(`| ${r.module} | ${r.mutations} | ${r.killed} | ${r.survived} | ${r.score}% | **${r.result}** |`);
  }
  for (const r of reports) {
    lines.push("", `### ${r.module}`);
    if (r.error) lines.push("", `Error: ${cell(r.error)}`);
    if (r.mutants.length === 0) continue;
    lines.push(
      "",
      "| ID | Location | Type | Description | Status |",
      "|---|---|---|---|---|",
    );
    for (const m of r.mutants) {
      lines.push(`| ${cell(m.id)} | ${cell(m.file)}:${cell(m.line)} | ${cell(m.type)} | ${cell(m.description)} | ${cell(m.status)} |`);
    }
  }
  return lines.join("\n") + "\n";
}

function findReports(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...findReports(full));
    else if (/^mutation-report-.+\.json$/.test(entry.name)) found.push(full);
  }
  return found;
}

function main() {
  const [dir, thresholdArg, modulesCsv = ""] = process.argv.slice(2);
  const threshold = Number(thresholdArg);
  const expected = modulesCsv.split(",").filter(Boolean);

  const reports = findReports(dir).map((file) => {
    const module = path.basename(file).replace(/^mutation-report-/, "").replace(/\.json$/, "");
    let r;
    try {
      r = normalize(JSON.parse(fs.readFileSync(file, "utf8")), threshold);
    } catch (e) {
      r = errorReport(module, `invalid JSON: ${e.message}`);
    }
    // The file name is authoritative for which module a report belongs to.
    r.module = module;
    return r;
  });

  const marker = "<!-- claude-mutation-testing -->";
  fs.writeFileSync(path.join(dir, "summary.md"), renderMarkdown(reports, marker));
  fs.writeFileSync(path.join(dir, "status.json"), JSON.stringify(overall(reports, expected)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
