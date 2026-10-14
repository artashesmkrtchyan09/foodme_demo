---
name: qa-test-cases
description: Step 5 of the feature-qa workflow. Designs test cases from the approved test plan and requirement baseline and creates or updates them in the Qase project FOODME (one suite per feature), then writes 05-test-cases.yaml/.md with a REQ traceability matrix. Also applies the test-case judge's findings on later cycles. Use only when the feature-qa skill runs step 5 for a qa-runs/<folder>.
---

# Test cases in Qase (step 5)

Input: the run folder. Read these files from it:
- `02-requirements-approval.md` (the baseline)
- `03-test-plan.md`
- `05-test-cases.yaml` and `06-test-case-review.md`, if they exist (on a judge cycle, the latest cycle's findings are your task list)
- `.agents/skills/feature-qa/references/istqb.md` §3–4 and `references/artifacts.md` (step 5)

Qase is reached through the Qase MCP server. Load the schemas with ToolSearch, and read `qase_tool_help` for each tool before its first use. On a 401, follow `web-regression` preflight 1. Reads can go through AgentSecrets, but writes need the MCP server, so if it is down set `blocked` and stop.

1. **Suite.** Run `qase_project_context` (`code: "FOODME"`). Take the root suite of the app: `Web`, `Admin` or `Backend`. Find or create the sub-suite `<KEY or slug> <feature title>` with `qase_suite_upsert` (`parent_id` = the app root, the description = the source URL and the REQ list). For a cross-app feature, create one sub-suite per app.
2. **Reuse before you create.** Use `qql_search` to find existing cases in the area. If one already checks a planned behaviour, update it, or reference it in the traceability matrix with `action: unchanged`. Never duplicate it.
3. **Design** the cases the plan's technique matrix asks for, following istqb.md §4:
   - one behaviour per case
   - one action per step
   - an exact expected result per step (text, number or status)
   - preconditions with the data rules from `web-regression` §3 (chefs and dishes found through the API, `@example.test` accounts)
   - titles of the form "<behaviour> when <condition>"

   Write steps as a user sees them: visible labels and roles, never selectors.
4. **Fields:**
   - `title`
   - `suite_id`
   - `description`: "Traces: REQ-n — <requirement>. Technique: <x>. Source: <url>"
   - `preconditions`
   - `steps`: `[{action, expected_result, data}]`
   - `severity` and `priority` from the risk score: 6–9 high, 3–5 medium, 1–2 low
   - `automation`: Manual
   - `status`: Actual
   - `tags`: `[<KEY or slug>, feature-qa]`
5. **Write to Qase.** Create new cases in one `qase_case_bulk_create` call, and update existing ones with `qase_case_upsert` (pass the current `title`). Deprecate cases you replace (`status` = Deprecated); never delete one.
6. **Judge findings.** On a judge cycle, handle every finding: fix it in Qase, or reject it with a reason (for example, out of the approved scope). Record each one in `05-test-cases.yaml` `changes` and in the `### Response` table of the latest cycle in `06-test-case-review.md`.
7. **Read back.** Read the cases back with `qql_search` (by tag) to confirm what Qase stored. Then write both artifacts. The traceability matrix lists **every** REQ; any REQ without a case is a bug in this step, so fix it before you return.

Return one line: `cycle N: <n> created, <n> updated, <n> deprecated; REQ coverage <x>/<y>; suite <url>`.
