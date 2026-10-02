#!/usr/bin/env node
// Lists every automated test in the FoodMe repo (backend JUnit + web/admin Playwright)
// with any linked Qase IDs and FM-FLAKE / FM-BUG markers.
//
// Usage: node inventory.mjs [repoRoot] > inventory.json

import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.argv[2] || process.cwd());

const SOURCES = [
  { app: "backend", dir: "apps/backend/src/test/java", match: (f) => f.endsWith(".java"), parse: parseJava },
  { app: "web", dir: "apps/web/e2e", match: (f) => /\.spec\.[cm]?[jt]s$/.test(f), parse: parsePlaywright },
  { app: "admin", dir: "apps/admin/e2e", match: (f) => /\.spec\.[cm]?[jt]s$/.test(f), parse: parsePlaywright },
];

// `// qase: 12`, `// qase: FOODME-12, 13`, `@QaseId(12)`, `qase.id(12)`, `(Qase ID: 12)`
const QASE_PATTERNS = [
  /\/\/\s*qase:\s*([A-Z0-9_\-,\s]+)/gi,
  /@QaseId\(\s*(\d+)\s*\)/g,
  /qase\.id\(\s*([\d,\s]+)\s*\)/g,
  /Qase ID:\s*([\d,\s]+)/gi,
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" ? [] : walk(p);
    return [p];
  });
}

function qaseIds(text) {
  const ids = new Set();
  for (const re of QASE_PATTERNS) {
    for (const m of text.matchAll(re)) {
      for (const part of m[1].split(",")) {
        const id = part.trim().match(/(\d+)$/);
        if (id) ids.add(Number(id[1]));
      }
    }
  }
  return [...ids];
}

function markers(text, kind) {
  return [...new Set([...text.matchAll(new RegExp(`${kind}-\\d+[^\\n]*`, "g"))].map((m) => m[0].trim()))];
}

// Attach id/marker info to tests; each test's "range" runs from its leading comments/annotations
// to the line before the next test (or EOF).
function finalize(tests, lines, file, app) {
  return tests.map((t, i) => {
    const end = i + 1 < tests.length ? tests[i + 1].rangeStart : lines.length;
    const text = lines.slice(t.rangeStart, end).join("\n");
    const ids = [...new Set([...t.extraIds, ...qaseIds(text)])];
    return {
      app,
      file,
      line: t.line,
      suitePath: t.suitePath,
      title: t.title,
      qaseIds: ids,
      skipped: t.skipped,
      flakeMarkers: markers(text, "FM-FLAKE"),
      bugMarkers: markers(text, "FM-BUG"),
      key: [app, file, ...t.suitePath, t.title].join(" > "),
    };
  });
}

function parseJava(src, file, app) {
  const lines = src.split(/\r?\n/);
  const tests = [];
  let cls = null;
  let pending = []; // annotation/comment lines (with index) right before a declaration
  lines.forEach((raw, i) => {
    const line = raw.trim();
    const clsMatch = line.match(/\bclass\s+(\w+)/);
    if (clsMatch && !cls) cls = clsMatch[1];
    if (line === "" || line.startsWith("@") || line.startsWith("//") || line.startsWith("/*") || line.startsWith("*")) {
      if (line !== "") pending.push({ i, line });
      return;
    }
    const method = line.match(/^(?:public\s+|protected\s+|private\s+)?void\s+(\w+)\s*\(/);
    const anns = pending.map((p) => p.line).join("\n");
    if (method && /@(Test|ParameterizedTest|RepeatedTest|TestFactory)\b/.test(anns)) {
      const display = anns.match(/@DisplayName\(\s*"([^"]*)"\s*\)/);
      tests.push({
        line: i + 1,
        rangeStart: pending.length ? pending[0].i : i,
        suitePath: [cls || path.basename(file, ".java")],
        title: display ? display[1] : method[1],
        method: method[1],
        skipped: /@Disabled\b/.test(anns),
        extraIds: [],
      });
    }
    pending = [];
  });
  return finalize(tests, lines, file, app);
}

function parsePlaywright(src, file, app) {
  const lines = src.split(/\r?\n/);
  const tests = [];
  const describes = []; // { title, depth, skipped }
  let depth = 0;
  let commentStart = null;
  // String literal whose opening quote is capture group n; its content is group n + 1.
  const str = (n) => "([\"'`])((?:\\\\.|(?!\\" + n + ").)*)\\" + n;
  const describeRe = new RegExp(String.raw`^\s*test\.describe(?:\.(only|skip|fixme|serial|parallel))?(?:\.(only|skip|fixme))?\(\s*${str(3)}`);
  const testRe = new RegExp(String.raw`^\s*test(?:\.(only|skip|fixme|fail|slow))?\(\s*${str(2)}`);
  const wrappedRe = new RegExp(String.raw`^\s*test(?:\.(only|skip|fixme|fail|slow))?\(\s*qase\(\s*(\[[\d,\s]+\]|\d+)\s*,\s*${str(3)}`);

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (line.startsWith("//")) {
      if (commentStart === null) commentStart = i;
    } else if (line !== "") {
      const d = line.match(describeRe);
      const w = line.match(wrappedRe);
      const t = !w && line.match(testRe);
      if (d) {
        describes.push({ title: d[4], depth, skipped: d[1] === "skip" || d[2] === "skip" || d[1] === "fixme" || d[2] === "fixme" });
      } else if (w || t) {
        const mod = (w || t)[1];
        tests.push({
          line: i + 1,
          rangeStart: commentStart ?? i,
          suitePath: [path.basename(file), ...describes.map((x) => x.title)],
          title: w ? w[4] : t[3],
          skipped: mod === "skip" || mod === "fixme" || describes.some((x) => x.skipped),
          extraIds: w ? qaseIds(`qase.id(${w[2].replace(/[[\]]/g, "")})`) : [],
        });
      }
      commentStart = null;
    }
    // Rough brace tracking (ignores braces in strings) to know when a describe block closes.
    for (const ch of raw.replace(/(["'`])(?:\\.|(?!\1).)*\1/g, "")) {
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        while (describes.length && depth <= describes[describes.length - 1].depth) describes.pop();
      }
    }
  });
  return finalize(tests, lines, file, app);
}

const all = [];
for (const s of SOURCES) {
  for (const abs of walk(path.join(repoRoot, s.dir)).filter(s.match)) {
    const rel = path.relative(repoRoot, abs).split(path.sep).join("/");
    all.push(...s.parse(fs.readFileSync(abs, "utf8"), rel, s.app));
  }
}
process.stdout.write(JSON.stringify(all, null, 2) + "\n");
