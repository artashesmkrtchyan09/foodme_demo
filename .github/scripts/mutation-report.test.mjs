import test from "node:test";
import assert from "node:assert/strict";
import { normalize, overall, renderMarkdown } from "./mutation-report.mjs";

const mutant = (id, status) => ({
  id,
  file: "apps/backend/src/main/java/am/foodme/backend/service/OrderService.java",
  line: 10,
  type: "product",
  description: `mutant ${id}`,
  status,
  killedBy: status === "KILLED" ? "OrderControllerTest#x" : null,
});

const many = (killed, survived, invalid = 0) => [
  ...Array.from({ length: killed }, (_, i) => mutant(`K${i}`, "KILLED")),
  ...Array.from({ length: survived }, (_, i) => mutant(`S${i}`, "SURVIVED")),
  ...Array.from({ length: invalid }, (_, i) => mutant(`I${i}`, "INVALID")),
];

test("normalize recomputes counts and score from mutants", () => {
  const r = normalize(
    { module: "backend", score: 99, killed: 1, mutants: many(7, 3, 1) },
    70,
  );
  assert.equal(r.mutations, 10);
  assert.equal(r.killed, 7);
  assert.equal(r.survived, 3);
  assert.equal(r.score, 70);
  assert.equal(r.threshold, 70);
  assert.equal(r.result, "PASS");
});

test("score equal to threshold passes", () => {
  assert.equal(normalize({ module: "web", mutants: many(7, 3) }, 70).result, "PASS");
});

test("score just below threshold fails", () => {
  const r = normalize({ module: "web", mutants: many(6, 4) }, 70);
  assert.equal(r.score, 60);
  assert.equal(r.result, "FAIL");
});

test("zero counted mutants is ERROR even if the report says PASS", () => {
  const r = normalize({ module: "admin", result: "PASS", mutants: many(0, 0, 3) }, 70);
  assert.equal(r.result, "ERROR");
});

test("SKIPPED is preserved", () => {
  const r = normalize({ module: "admin", result: "SKIPPED", mutants: [] }, 70);
  assert.equal(r.result, "SKIPPED");
});

test("unknown status is ERROR", () => {
  const r = normalize({ module: "web", mutants: [mutant("M1", "MAYBE")] }, 70);
  assert.equal(r.result, "ERROR");
});

test("non-object input returns ERROR without throwing", () => {
  assert.equal(normalize(null, 70).result, "ERROR");
  assert.equal(normalize("nope", 70).result, "ERROR");
  assert.equal(normalize({ module: "web", mutants: "x" }, 70).result, "ERROR");
});

test("overall succeeds when all PASS or SKIPPED", () => {
  const reports = [
    normalize({ module: "backend", mutants: many(8, 2) }, 70),
    normalize({ module: "web", result: "SKIPPED", mutants: [] }, 70),
  ];
  assert.equal(overall(reports, ["backend", "web"]).state, "success");
});

test("overall fails on any FAIL or ERROR", () => {
  const fail = normalize({ module: "backend", mutants: many(1, 9) }, 70);
  const ok = normalize({ module: "web", mutants: many(9, 1) }, 70);
  assert.equal(overall([fail, ok], ["backend", "web"]).state, "failure");
  const err = normalize(null, 70);
  err.module = "web";
  assert.equal(overall([ok, err], ["web"]).state, "failure");
});

test("overall fails when an expected module has no report", () => {
  const ok = normalize({ module: "backend", mutants: many(9, 1) }, 70);
  const o = overall([ok], ["backend", "admin"]);
  assert.equal(o.state, "failure");
  assert.match(o.description, /admin/);
});

test("overall succeeds with no expected modules", () => {
  assert.equal(overall([], []).state, "success");
});

test("renderMarkdown starts with the marker and lists every mutant", () => {
  const r = normalize({ module: "backend", mutants: many(2, 1) }, 70);
  const md = renderMarkdown([r], "<!-- claude-mutation-testing -->");
  assert.ok(md.startsWith("<!-- claude-mutation-testing -->"));
  for (const m of r.mutants) {
    assert.ok(md.includes(m.id), `missing ${m.id}`);
    assert.ok(md.includes(m.status), `missing ${m.status}`);
  }
  assert.match(md, /backend/);
});
