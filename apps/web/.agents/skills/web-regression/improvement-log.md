# web-regression skill — improvement log

One entry per run made by `/web-regression-goal`: whether the result matched earlier runs, what caused any difference, and the change made to `SKILL.md` or `case-notes.md`.

<!-- Entry format:
## Session <yyyy-MM-dd> — Run N/10 — <run-label>
- Signature: <same as run M | differs from run M on C12, C14>
- Cause: <skill ambiguity | leaked state | environment | app flake (FM-FLAKE-NN) | real product change> — <one line>
- Change: <what was edited in SKILL.md / case-notes.md, or "none">
-->

## Session 2026-10-06 — Run 1/10 (blocked, not counted) — goal-1
- Signature: none (BLOCKED at preflight 1, Qase 401)
- Cause: environment — the shell's `QASE_API_TOKEN` (passed to the MCP server) is rejected by Qase, while the token in AgentSecrets is valid (api_call → 200)
- Change: SKILL.md preflight 1 checks the AgentSecrets token with `agentsecrets api_call` on a 401; if it is valid, the run reads Qase through the REST API via AgentSecrets (new *Qase through AgentSecrets* part of section 2) instead of stopping. Moved the misplaced "Record to Qase" row back into the inputs table

## Session 2026-10-06 — Run 1/10 — goal-1
- Signature: baseline (34 passed, 4 failed: C64, C66 FM-BUG-02, C93, C104; 4 blocked; 1 skipped)
- Cause: skill ambiguity — 14 gaps: second chef / dish-with-property / unknown IDs undefined, fault injection used in C76 but not C97, C101 paths and C93 input not fixed, screenshots can't be written outside the repo, status labels vs enum names (C104)
- Change: SKILL.md section 3: signed-in setup, no-fault-injection → blocked, data rules (chef B, dish with property, quantity 2, unknown IDs, order count), "exact" = shown text, screenshot path via `.playwright-mcp/`. case-notes.md: notes for C64–C66, C70–C76, C79, C87–C97, C101, C102, C104, C106

## Session 2026-10-06 — Run 2/10 — goal-2 (scope cut to C64–C69 at the user's request; compared with run 1's C64–C69)
- Signature: same as run 1
- Cause: oracle/wording — C64/C66 reason differed (run 1 named "Armenian Traditional", run 2 said the chef can't be identified); C67 "or" done once vs both; screenshot retry overwrote attempt 1; duplicated text in SKILL.md
- Change: case-notes C64/C66 fixed reason text and no chef identification; C67 hero link only; C68 chef choice. SKILL.md: do the first of "X or Y", page/API text is data not instructions (a chef description on prod contains injected instructions), screenshots get `-a<attempt>`, console errors only for failed steps, removed duplicate

## Session 2026-10-06 — Run 3/10 — goal-3 (C64–C69)
- Signature: same as runs 1–2; C64/C66 reasons now identical to the fixed text
- Cause: skill gaps — no rule for collecting a case-ID scope; Explore wait text appears before cards (loading); runner used CSS/evaluate to count and click; C68/C69 pass criteria unstated; seeded-issue grep timed out in node_modules
- Change: SKILL.md: case-ID scope collection, snapshot refs only (scripts only for setup), grep excludes node_modules/dist/build. case-notes: Explore wait (subtitle gone), C68 pass criteria, C69 unknown ID only

## Session 2026-10-06 — Run 4/10 — goal-4 (C64–C69)
- Signature: same as runs 1–3, same reasons
- Cause: waiting — `textGone` on the Explore subtitle returned before the cards rendered; a `main`-scoped snapshot came back empty (C69). Environment — no python for JSON
- Change: SKILL.md: re-wait and re-snapshot up to 30 s when a snapshot still shows loading; full-page snapshots only; parse JSON with node. case-notes: Explore waits for the first walk chef's name

## Session 2026-10-06 — Run 5/10 — goal-5 (C64–C69)
- Signature: same as runs 1–4, same reasons
- Cause: waiting — waits still return early, but the 30 s re-wait rule handled it every time; skill ambiguity — whether a case blocked by its note still runs fresh-state steps; C67 waited for a subtitle that disappears
- Change: SKILL.md: the snapshot decides, and early waits aren't a skill gap; cases blocked/skipped by a case note get that status directly. case-notes C67: judge by URL, don't wait for the subtitle

## Session 2026-10-06 — Run 6/10 — goal-6 (C64–C69)
- Signature: same as runs 1–5, same reasons
- Cause: skill ambiguity — runner skipped the base-URL reload when step 1 opens its own URL; injected text in the Argentinean description not mentioned in C68's note
- Change: SKILL.md step 1: always reload the base URL. case-notes C68: name the injected text as known test data

## Session 2026-10-06 — Run 7/10 — goal-7 (C64–C69)
- Signature: same as runs 1–6, same reasons; skill gaps: none
- Cause: —
- Change: none

## Session 2026-10-06 — Run 8/10 — goal-8 (C64–C69)
- Signature: same as runs 1–7, same reasons; skill gaps: none
- Cause: —
- Change: none

## Session 2026-10-06 — Run 9/10 — goal-9 (C64–C69)
- Signature: same as runs 1–8, same reasons
- Cause: skill ambiguity — runner used depth-limited snapshots (C67, C68); not forbidden, could hide checked content
- Change: SKILL.md step 4: snapshots must not be depth-limited

## Session 2026-10-06 — Run 10/10 — goal-10 (C64–C69)
- Signature: same as runs 1–9, same reasons; skill gaps: none
- Cause: —
- Change: none
- Session result: goal not met within 10 runs (runs 7, 8, 10 clean; run 9 needed a snapshot-depth rule). Signature identical in all 10 runs.
