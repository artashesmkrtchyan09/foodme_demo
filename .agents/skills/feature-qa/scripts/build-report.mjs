#!/usr/bin/env node
// Builds qa-runs/<folder>/index.html: one tab per feature-qa artifact.
// Usage: node .agents/skills/feature-qa/scripts/build-report.mjs qa-runs/<folder>
// No dependencies. The page renders Markdown with marked + DOMPurify from cdnjs and
// falls back to plain text when offline.
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, basename, extname } from "node:path";

const dir = process.argv[2];
if (!dir || !existsSync(dir) || !statSync(dir).isDirectory()) {
  console.error("Usage: node build-report.mjs qa-runs/<folder>");
  process.exit(1);
}

const TITLES = {
  "99-verdict": "Verdict",
  "00-progress": "Progress",
  "00-source": "Source requirement",
  "01-requirements-review": "1 · Requirement review",
  "02-requirements-approval": "2 · Requirement approval",
  "03-test-plan": "3 · Test plan",
  "04-test-plan-approval": "4 · Test plan approval",
  "05-test-cases": "5 · Test cases",
  "06-test-case-review": "6 · Test case review (judge)",
  "07-test-execution": "7 · Test execution",
  "08-defects": "8 · Defects",
  "09-automation": "9 · Automation",
  "10-automation-review": "10 · Automation review (judge)",
  "11-flake-check": "11 · CI flake check",
  "12-pull-request": "12 · Pull request",
};
const ORDER = Object.keys(TITLES);
const TEXT_EXT = new Set([".md", ".yaml", ".yml", ".json"]);
const IMG_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);

// Group files by stem; a stem with .md and .yaml/.json gets one tab showing the .md first.
const groups = new Map();
for (const f of readdirSync(dir)) {
  const ext = extname(f).toLowerCase();
  if (!TEXT_EXT.has(ext)) continue;
  const stem = basename(f, extname(f));
  if (!groups.has(stem)) groups.set(stem, []);
  groups.get(stem).push({ name: f, ext, text: readFileSync(join(dir, f), "utf8") });
}
const rank = (s) => (ORDER.includes(s) ? ORDER.indexOf(s) : ORDER.length);
const tabs = [...groups.keys()]
  .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
  .map((stem) => ({
    id: stem,
    title: TITLES[stem] || stem,
    files: groups.get(stem).sort((a, b) => (a.ext === ".md" ? -1 : b.ext === ".md" ? 1 : a.name.localeCompare(b.name))),
  }));

// Evidence gallery (screenshots), referenced relatively so the folder stays portable.
const evidence = [];
for (const sub of readdirSync(dir)) {
  const p = join(dir, sub);
  if (!statSync(p).isDirectory()) continue;
  for (const f of readdirSync(p)) if (IMG_EXT.has(extname(f).toLowerCase())) evidence.push(`${sub}/${f}`);
}
if (evidence.length) tabs.push({ id: "evidence", title: "Evidence", files: [], images: evidence.sort() });

const progress = groups.get("00-progress")?.[0]?.text || "";
const field = (k) => (progress.match(new RegExp(`^${k}:\\s*(.+)$`, "m")) || [])[1]?.trim() || "—";
const verdictMd = groups.get("99-verdict")?.find((f) => f.ext === ".md")?.text || "";
const recommendation = (verdictMd.match(/^recommendation:\s*(.+)$/m) || [])[1]?.trim() || "pending";
const folder = basename(dir.replace(/[\\/]+$/, ""));

const data = JSON.stringify({ tabs, folder }).replace(/</g, "\\u003c");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Feature QA Report</title>
<style>
:root{--bg:#f7f7f5;--panel:#fff;--text:#1d1d1b;--muted:#6b6b66;--border:#e3e2dc;--accent:#2f5d8a;--code:#f0efea;
--ok:#2e7d4f;--warn:#9a6a00;--bad:#b3261e}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#161615;--panel:#1f1f1d;--text:#ecebe6;--muted:#a3a29b;--border:#34332f;--accent:#8db4dd;--code:#2a2a27;--ok:#6cc08e;--warn:#e0b450;--bad:#f08a80}}
:root[data-theme="dark"]{--bg:#161615;--panel:#1f1f1d;--text:#ecebe6;--muted:#a3a29b;--border:#34332f;--accent:#8db4dd;--code:#2a2a27;--ok:#6cc08e;--warn:#e0b450;--bad:#f08a80}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
header{padding:16px;border-bottom:1px solid var(--border);background:var(--panel);display:flex;flex-wrap:wrap;gap:8px 20px;align-items:baseline}
header h1{font-size:18px;margin:0}
header .meta{color:var(--muted);font-size:13px}
.badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600;border:1px solid currentColor}
.ok{color:var(--ok)}.warn{color:var(--warn)}.bad{color:var(--bad)}
#theme{margin-left:auto;background:none;border:1px solid var(--border);color:var(--text);border-radius:6px;padding:4px 10px;cursor:pointer}
.layout{display:flex;min-height:calc(100vh - 60px)}
nav{width:260px;flex-shrink:0;border-right:1px solid var(--border);padding:8px;background:var(--panel)}
nav a{display:block;padding:7px 10px;border-radius:6px;color:var(--text);text-decoration:none;font-size:14px}
nav a:hover{background:var(--code)}
nav a.active{background:var(--accent);color:var(--panel)}
main{flex:1;min-width:0;padding:16px 24px;max-width:1100px}
.file{background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:16px 20px;margin-bottom:16px;overflow-x:auto}
.file>.fname{font:12px ui-monospace,monospace;color:var(--muted);margin-bottom:8px}
pre,code{font:13px/1.45 ui-monospace,"Cascadia Code",monospace;background:var(--code);border-radius:4px}
pre{padding:12px;overflow-x:auto}
code{padding:1px 4px}pre code{padding:0;background:none}
table{border-collapse:collapse;margin:12px 0;font-size:14px;display:block;overflow-x:auto}
th,td{border:1px solid var(--border);padding:6px 10px;text-align:left;vertical-align:top}
th{background:var(--code)}
a{color:var(--accent)}
blockquote{margin:8px 0;padding:4px 12px;border-left:3px solid var(--border);color:var(--muted)}
details.fm{margin-bottom:8px}details.fm summary{cursor:pointer;color:var(--muted);font-size:13px}
.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
.gallery figure{margin:0}.gallery img{width:100%;border:1px solid var(--border);border-radius:6px}
.gallery figcaption{font:12px ui-monospace,monospace;color:var(--muted)}
@media (max-width:760px){.layout{flex-direction:column}nav{width:auto;border-right:0;border-bottom:1px solid var(--border);display:flex;overflow-x:auto;gap:4px}nav a{white-space:nowrap}main{padding:16px}}
</style>
</head>
<body>
<header>
  <h1>Feature QA — ${esc(folder)}</h1>
  <span class="meta">Status: <b>${esc(field("status"))}</b> · step ${esc(field("current_step"))}</span>
  <span class="badge ${/^ready$/i.test(recommendation) ? "ok" : /risk/i.test(recommendation) ? "warn" : /not/i.test(recommendation) ? "bad" : ""}">${esc(recommendation)}</span>
  <span class="meta">Generated ${esc(new Date().toISOString().slice(0, 16).replace("T", " "))}</span>
  <button id="theme" type="button" aria-label="Toggle colour theme">Theme</button>
</header>
<div class="layout">
  <nav id="nav" aria-label="Artifacts"></nav>
  <main id="main" tabindex="-1"></main>
</div>
<script id="data" type="application/json">${data}</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.2/marked.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.1.6/purify.min.js"></script>
<script>
const { tabs } = JSON.parse(document.getElementById("data").textContent);
const nav = document.getElementById("nav"), main = document.getElementById("main");
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"})[c]);
const md = s => (window.marked && window.DOMPurify) ? DOMPurify.sanitize(marked.parse(s)) : "<pre>" + esc(s) + "</pre>";
function renderFile(f) {
  let body;
  if (f.ext === ".md") {
    const m = f.text.match(/^---\\r?\\n([\\s\\S]*?)\\r?\\n---\\r?\\n?/);
    const fm = m ? '<details class="fm"><summary>Front matter</summary><pre><code>' + esc(m[1]) + "</code></pre></details>" : "";
    body = fm + md(m ? f.text.slice(m[0].length) : f.text);
  } else {
    let t = f.text;
    if (f.ext === ".json") { try { t = JSON.stringify(JSON.parse(t), null, 2); } catch {} }
    body = "<pre><code>" + esc(t) + "</code></pre>";
  }
  return '<section class="file"><div class="fname">' + esc(f.name) + "</div>" + body + "</section>";
}
function show(id) {
  const tab = tabs.find(t => t.id === id) || tabs[0];
  if (!tab) { main.innerHTML = "<p>No artifacts yet.</p>"; return; }
  for (const a of nav.children) a.classList.toggle("active", a.dataset.id === tab.id);
  main.innerHTML = "<h2>" + esc(tab.title) + "</h2>" +
    (tab.images ? '<div class="gallery">' + tab.images.map(p => '<figure><a href="' + encodeURI(p) + '"><img src="' + encodeURI(p) + '" alt="' + esc(p) + '" loading="lazy"></a><figcaption>' + esc(p) + "</figcaption></figure>").join("") + "</div>"
                : tab.files.map(renderFile).join(""));
  for (const a of main.querySelectorAll("a[href^='http']")) { a.target = "_blank"; a.rel = "noopener"; }
  main.focus({ preventScroll: true });
}
for (const t of tabs) {
  const a = document.createElement("a");
  a.href = "#" + t.id; a.textContent = t.title; a.dataset.id = t.id;
  nav.appendChild(a);
}
window.addEventListener("hashchange", () => show(location.hash.slice(1)));
show(location.hash.slice(1));
const root = document.documentElement;
try { const s = localStorage.getItem("fqa-theme"); if (s) root.dataset.theme = s; } catch {}
document.getElementById("theme").onclick = () => {
  const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = dark ? "light" : "dark";
  try { localStorage.setItem("fqa-theme", root.dataset.theme); } catch {}
};
</script>
</body>
</html>
`;

writeFileSync(join(dir, "index.html"), html);
console.log(`Wrote ${join(dir, "index.html")} (${tabs.length} tabs)`);
