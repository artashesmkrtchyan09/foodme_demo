---
name: qa-bug-filing
description: Step 8 of the feature-qa workflow. Turns the failed and flaky cases from manual execution into bug reports and files them in Jira (SCRUM) as Subtasks under the feature's open Task, creating that Task if none exists, after a duplicate check and one batch approval. Writes 08-defects.md. Use only when the feature-qa skill runs step 8 for a qa-runs/<folder>.
---

# Bug filing in Jira (step 8)

Input: the run folder. Read these:
- `07-test-execution.json`
- `00-source.md`
- `05-test-cases.yaml`
- `.agents/skills/jira/SKILL.md`: the connection, duplicate search, bug summary, priority mapping and labels
- `.agents/skills/bug-report/SKILL.md` and its `template.md`: the body of each bug
- `.agents/skills/feature-qa/references/artifacts.md` (step 8)

The `jira` skill's rules apply, with the differences below. Bugs are **Subtasks** (`issueType: "Subtask"`, `parent: <task key>`), because SCRUM is team-managed and a Bug can't have a Task as its parent.

This step runs in two phases, because Jira writes need the human's approval and only the orchestrator talks to the human.

## Phase A — draft (no Jira writes)

1. **Defects to file.** Take every `failed` or `flaky` case. Group the cases that fail for the same cause (same step, same reason, same REQ) into **one** defect.
   - A `blocked` case is not a defect, unless the blocker is itself a product failure (for example, the API returns 500).
   - A case blocked as `case defect` goes back to step 5, not to Jira.
2. **Feature Task.**
   - If the source is a SCRUM issue whose type is Task or Story and whose `statusCategory != Done`, use it.
   - Otherwise search `project = SCRUM AND issuetype in (Task, Story) AND statusCategory != Done AND (text ~ "<word1>" OR text ~ "<word2>")`, using the feature's key words and the FoodMe synonyms from the `jira` skill. Use a clear match.
   - If nothing matches, plan a new Task:
     - summary `QA: <feature title>`
     - labels `feature-qa` and the area
     - a description that links the source and the run folder name
3. **Duplicate check** for each defect, using the `jira` skill's object × symptom query, without a status filter.
   - A match that is still open gets a comment, not a new issue.
   - A match that is Done is a regression: plan a comment on it, plus a new Subtask that links to it.
   - Write down the verdict and the queries that were tried.
4. **Bodies.** Write each body with the `bug-report` template:
   - Fill it from `07-test-execution.json`: the steps from the Qase case, the actual result from `reason`, the evidence paths, the environment (prod URL, `deployedVersion`, `gitSha`, Chrome version).
   - The expected result cites the Qase case URL and the REQ.
   - Seeded matches (`knownIssue`) carry the tag and `path:line`.
   - Summary: `[Bug] [<Area>] <Page/feature>: <symptom>` plus `(FM-BUG-NN)` when there is one.
   - Labels: `bug`, the area, `feature-qa`.
5. Write `08-defects.md` with `status: draft`, the planned Task (existing key or "new") and every planned bug with its full body. Return `DRAFT: <n> bugs, task <key | new>` to the orchestrator.

The orchestrator then shows the batch at a gate. It shows the Task, plus each bug's summary, severity/priority and duplicate verdict, and asks for `file` / `file except <n>` / `stop`. It logs the answer in `08-defects.md` (approver, time, comment) and runs phase B. With no defects, skip the gate: write `08-defects.md` with "No defects found in <n> executed cases", touch nothing in Jira, and return `NONE`.

## Phase B — file (after approval)

1. Create the Task if it was planned (`createJiraIssue`, type Task).
2. Create each approved bug as a Subtask with `parent` set to the Task.
3. Add the planned comments on duplicates or regressions, using the comment shape from the `jira` skill.
4. Read every issue back (`getJiraIssue`, `view: "evidence"`) and record what Jira stored.
5. Link back in Qase: update the step-7 results of the failed cases (`qase_result_record` on the same run) so they carry the bug URL in the comment and `defect: true` (skip this for `knownIssue` cases that already existed). If the run is already completed and Qase refuses, note it in the artifact.
6. Update `08-defects.md`: set `status: filed`, and fill in the keys and URLs in the front matter and the table.

Return one line: `task <key> (<found|created>); <n> bugs filed, <n> comments on existing; <keys>`.
