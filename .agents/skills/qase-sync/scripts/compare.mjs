#!/usr/bin/env node
// Compares the code inventory (inventory.mjs) with a Qase export (qase.mjs export) and prints
// a findings JSON. It only reports; it never changes code or Qase.
//
// Usage: node compare.mjs inventory.json qase.json > findings.json

import fs from "node:fs";

const [invFile, qaseFile] = process.argv.slice(2);
if (!invFile || !qaseFile) {
  process.stderr.write("Usage: compare.mjs inventory.json qase.json\n");
  process.exit(1);
}
const tests = JSON.parse(fs.readFileSync(invFile, "utf8"));
const qase = JSON.parse(fs.readFileSync(qaseFile, "utf8"));
const cases = new Map(qase.cases.map((c) => [c.id, c]));

const AUTOMATION = { 0: "not automated", 1: "to be automated", 2: "automated" };
const STATUS = { 0: "actual", 1: "draft", 2: "deprecated" };
const APP_SUITE = { backend: /back-?end|api/i, web: /web|storefront/i, admin: /admin|back-?office/i };

// "createOrder_cashPayment_succeeds" and "Create order: cash payment succeeds" normalise alike.
const words = (s) =>
  s
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
const norm = (s) => words(s).join(" ");
function similarity(a, b) {
  const A = new Set(words(a));
  const B = new Set(words(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return Math.round((inter / (A.size + B.size - inter)) * 100) / 100;
}
const ref = (t) => ({ app: t.app, file: t.file, line: t.line, suitePath: t.suitePath, title: t.title });
const caseRef = (c) => ({ id: c.id, title: c.title, suitePath: c.suitePath, automation: AUTOMATION[c.automation] ?? c.automation, status: STATUS[c.status] ?? c.status, isFlaky: c.isFlaky });

const findings = [];
const add = (type, severity, data) => findings.push({ type, severity, ...data });

// Which tests link to each case.
const linkedBy = new Map();
for (const t of tests) for (const id of t.qaseIds) linkedBy.set(id, [...(linkedBy.get(id) || []), t]);

for (const t of tests) {
  const flakyInCode = t.flakeMarkers.length > 0;

  if (!t.qaseIds.length) {
    const candidates = qase.cases
      .map((c) => ({ ...caseRef(c), score: similarity(t.title, c.title), linkedElsewhere: linkedBy.has(c.id) }))
      .filter((c) => c.score >= 0.4)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    add("UNLINKED_TEST", "high", { test: ref(t), flakyInCode, candidates });
    continue;
  }

  for (const id of t.qaseIds) {
    const c = cases.get(id);
    if (!c) {
      add("LINK_TO_MISSING_CASE", "high", { test: ref(t), qaseId: id });
      continue;
    }
    if (norm(t.title) !== norm(c.title)) add("TITLE_MISMATCH", "low", { test: ref(t), case: caseRef(c), score: similarity(t.title, c.title) });
    if (c.automation !== 2) add("AUTOMATION_STATUS_MISMATCH", "medium", { test: ref(t), case: caseRef(c), expected: "automated" });
    if (c.status === 2) add("LINKED_CASE_DEPRECATED", "medium", { test: ref(t), case: caseRef(c) });
    else if (c.status === 1) add("LINKED_CASE_DRAFT", "low", { test: ref(t), case: caseRef(c) });
    if (flakyInCode !== c.isFlaky)
      add("FLAKY_MISMATCH", "medium", { test: ref(t), case: caseRef(c), flakeMarkers: t.flakeMarkers, flakyInCode, flakyInQase: c.isFlaky });
    if (t.skipped) add("SKIPPED_IN_CODE", "medium", { test: ref(t), case: caseRef(c) });
    if (!c.suitePath.some((p) => APP_SUITE[t.app].test(p))) add("SUITE_MISMATCH", "low", { test: ref(t), case: caseRef(c), expectedSuiteLike: t.app });
  }
}

for (const [id, ts] of linkedBy) {
  if (ts.length > 1 && cases.has(id)) add("DUPLICATE_LINK", "medium", { case: caseRef(cases.get(id)), tests: ts.map(ref) });
}

for (const c of qase.cases) {
  if (linkedBy.has(c.id) || c.status === 2) continue;
  if (c.automation === 2) {
    const candidates = tests
      .filter((t) => !t.qaseIds.length)
      .map((t) => ({ ...ref(t), score: similarity(t.title, c.title) }))
      .filter((t) => t.score >= 0.4)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    add("AUTOMATED_CASE_WITHOUT_TEST", "high", { case: caseRef(c), candidates });
  }
  else if (c.automation === 1) add("TO_BE_AUTOMATED", "info", { case: caseRef(c) });
}

const manualOnly = qase.cases.filter((c) => !linkedBy.has(c.id) && c.automation === 0 && c.status !== 2).length;
const linkedTests = tests.filter((t) => t.qaseIds.length).length;
const summary = {
  project: qase.project,
  exportedAt: qase.exportedAt,
  code: {
    tests: tests.length,
    byApp: Object.fromEntries(["backend", "web", "admin"].map((a) => [a, tests.filter((t) => t.app === a).length])),
    linked: linkedTests,
    unlinked: tests.length - linkedTests,
    withFlakeMarker: tests.filter((t) => t.flakeMarkers.length).length,
    skipped: tests.filter((t) => t.skipped).length,
  },
  qase: {
    cases: qase.cases.length,
    automated: qase.cases.filter((c) => c.automation === 2).length,
    toBeAutomated: qase.cases.filter((c) => c.automation === 1).length,
    manual: qase.cases.filter((c) => c.automation === 0).length,
    deprecated: qase.cases.filter((c) => c.status === 2).length,
    flaky: qase.cases.filter((c) => c.isFlaky).length,
    linkedFromCode: linkedBy.size,
    manualWithoutTest: manualOnly,
  },
  findingsByType: findings.reduce((m, f) => ({ ...m, [f.type]: (m[f.type] || 0) + 1 }), {}),
};

process.stdout.write(JSON.stringify({ summary, findings }, null, 2) + "\n");
