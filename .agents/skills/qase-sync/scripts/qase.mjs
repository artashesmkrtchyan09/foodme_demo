#!/usr/bin/env node
// Minimal Qase API v1 client. Reads QASE_API_TOKEN, QASE_PROJECT and optional QASE_API_URL
// (default https://api.qase.io/v1) from the environment. Never prints the token.
//
// Usage:
//   node qase.mjs export > qase.json            # project, suites and all cases (paginated)
//   node qase.mjs GET /case/FOODME/12            # raw call, prints JSON
//   node qase.mjs PATCH /case/FOODME/12 body.json
//   node qase.mjs POST /case/FOODME body.json

import fs from "node:fs";

const BASE = (process.env.QASE_API_URL || "https://api.qase.io/v1").replace(/\/$/, "");
const TOKEN = process.env.QASE_API_TOKEN;
const PROJECT = process.env.QASE_PROJECT;

function fail(msg) {
  process.stderr.write(msg + "\n");
  process.exit(1);
}

if (!TOKEN) fail("QASE_API_TOKEN is not set.");

async function call(method, path, body, attempt = 0) {
  const res = await fetch(BASE + path, {
    method,
    headers: { Token: TOKEN, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 429 && attempt < 5) {
    const wait = Number(res.headers.get("retry-after")) * 1000 || 2 ** attempt * 1000;
    await new Promise((r) => setTimeout(r, wait));
    return call(method, path, body, attempt + 1);
  }
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok || json.status === false) fail(`${method} ${path} -> HTTP ${res.status}: ${JSON.stringify(json.errorMessage || json.errorFields || json).slice(0, 500)}`);
  return json;
}

async function all(path) {
  const out = [];
  for (let offset = 0; ; offset += 100) {
    const sep = path.includes("?") ? "&" : "?";
    const { result } = await call("GET", `${path}${sep}limit=100&offset=${offset}`);
    out.push(...result.entities);
    if (result.entities.length < 100 || out.length >= result.total) return out;
  }
}

async function exportProject() {
  if (!PROJECT) fail("QASE_PROJECT (project code) is not set.");
  const { result: project } = await call("GET", `/project/${PROJECT}`);
  const suites = await all(`/suite/${PROJECT}`);
  const byId = new Map(suites.map((s) => [s.id, s]));
  const suitePath = (id) => {
    const p = [];
    for (let s = byId.get(id); s; s = byId.get(s.parent_id)) p.unshift(s.title);
    return p;
  };
  const cases = (await all(`/case/${PROJECT}`)).map((c) => ({
    id: c.id,
    title: c.title,
    suiteId: c.suite_id,
    suitePath: suitePath(c.suite_id),
    automation: c.automation, // 0 not automated, 1 to be automated, 2 automated
    status: c.status, // 0 actual, 1 draft, 2 deprecated
    isFlaky: c.is_flaky === 1 || c.is_flaky === true,
    tags: (c.tags || []).map((t) => t.title),
    stepsCount: (c.steps || []).length,
    description: c.description,
    updatedAt: c.updated_at,
  }));
  return {
    project: { code: project.code, title: project.title, counts: project.counts },
    exportedAt: new Date().toISOString(),
    suites: suites.map((s) => ({ id: s.id, title: s.title, parentId: s.parent_id, path: suitePath(s.id) })),
    cases,
  };
}

const [cmd, path, bodyFile] = process.argv.slice(2);
const result =
  cmd === "export"
    ? await exportProject()
    : /^(GET|POST|PATCH)$/.test(cmd || "") && path
      ? await call(cmd, path, bodyFile ? JSON.parse(fs.readFileSync(bodyFile, "utf8")) : undefined)
      : fail("Usage: qase.mjs export | <GET|POST|PATCH> <path> [body.json]");
process.stdout.write(JSON.stringify(result, null, 2) + "\n");
