---
name: jira
description: Work with FoodMe's Jira (project SCRUM on artashesmkrtchyan09.atlassian.net) through the Atlassian MCP. Use when asked to find, list, search, read, summarize, create, file, edit, comment on, assign, move/transition or link Jira issues, tickets, bugs, tasks, stories or subtasks, to check Jira for duplicates, to link a ticket to code, a seeded FM-BUG/FM-FLAKE tag, a Qase case or a PR, or to get a sprint/board overview.
---

# Work with Jira

Jira is reached through the Atlassian MCP tools (`mcp__claude_ai_Atlassian_MCP__*`). Load the ones you need with ToolSearch (`select:<name>,...`) before calling them.

## 1. Connect once

- Site: `https://artashesmkrtchyan09.atlassian.net`. Default project key: **`SCRUM`** (unless the user names another).
- `cloudId`: **`7ba90b35-e299-4e42-b4ca-f566dfbdbc5a`**. Use it directly. Call `getAccessibleAtlassianResources` only if a call fails with an auth/site error or the user names another site. Pass `cloudId` as a top-level argument, never inside `inputs`.
- The compact search view already returns key, summary, status, priority, assignee, type and created date, which is enough for lists. Don't re-fetch each issue.
- Issue types in SCRUM: Bug, Task, Story, Subtask.

## 2. Read

- One known issue → `getJiraIssue`. Several → `searchJiraIssuesUsingJql`.
- **JQL must be bounded.** `order by created DESC` alone returns 400 "Unbounded JQL queries are not allowed". Always add a restriction, e.g. `project = SCRUM`.
- Useful queries:
  - open bugs: `project = SCRUM AND issuetype = Bug AND statusCategory != Done ORDER BY priority DESC`
  - text search: `project = SCRUM AND text ~ "basket quantity"`
  - agent test tickets: `project = SCRUM AND labels = agent-test`
- Default view is `compact`. Use `view: "evidence"` when custom fields (story points, sprint) matter. Sprint is `customfield_10020` and Rank is `customfield_10019`.
- **Summarizing one issue:** `getJiraIssue` with `view: "evidence"` gives the description, labels, sprint, links and comment *count*. Comment bodies need `listJiraIssueComments` (via `executeRead`). Summary shape: status/priority/assignee/sprint line, problem in 1–2 sentences, definition of done, then **Drift**.
- **Drift check (code vs ticket):** the ticket can be stale. Run `git log --oneline --all --grep="<KEY>"`, and also grep for the matching seeded tag (`git log --oneline --grep="FM-BUG-NN"`, `rg "FM-BUG-NN" apps`). If a fix is on `origin/main` but the ticket is still open, say so and offer a comment + transition. Seeded-bug markers are removed from code when they get fixed, so a missing marker in `rg` plus a fix commit means it's fixed.
- **Sprint/board overview:** a single call, `executeRead` name `getJiraBoardSprintData`, inputs `{boardId: "1"}`. It returns the active sprint, all sprints, metrics (done/in progress/to do, % complete) and `atRiskIssues` with reasons (overdue, unassigned, stale_in_progress, high_priority). Don't rebuild this from JQL, because JQL has no due-date risk or sprint metrics.
  - SCRUM board: id **1**, "SCRUM board", type simple (team-managed). Sprints (checked 2026-10-05): **2** "SCRUM Sprint 0" (active, ends 2026-10-08) and **1** "SCRUM Sprint 1" (future). Re-check with `listJiraBoardSprints` `{boardId: 1}` once a sprint closes.
  - Backlog: `project = SCRUM AND sprint is EMPTY AND statusCategory != Done`. Flag anything In Progress that's outside a sprint.
  - Overview shape: sprint name/dates/days left, a metrics line, a risk table (key, type, status, risk reasons, plus drift notes from the code), then the backlog in one line.
- Other operations without a primary tool (issue links, users, statuses, changelog): call `discover` with the goal, then the matching `executeRead` / `executeWrite` / `executeDestructive`. Never guess an operation name.

## 3. Write

Before any create, edit, comment, transition, assign or delete: **show the user the exact content and wait for confirmation**, unless they already pre-approved that specific write. Deletes always need explicit confirmation.

- **Duplicates first.** Before creating, search and then link to or comment on a match instead of creating a new issue:
  - `text ~` matches words with stemming (not an exact phrase) across summary, description and comments. Build one query from an *object* group and a *symptom* group, each OR-ing synonyms: `project = SCRUM AND (text ~ "cart" OR text ~ "basket") AND (text ~ "decrease" OR text ~ "quantity" OR text ~ "removes")`.
  - FoodMe synonyms: cart = basket; dish = item = product; chef = restaurant = kitchen; storefront = web = customer site; back office = admin. The storefront UI says **basket**, while code and users say **cart**.
  - **Don't filter by status.** A match that is Done means a *regression*: comment on or reopen that issue and link a new one, rather than filing a fresh bug that doesn't link to it.
  - Report the verdict: duplicate of `<KEY>` / regression of `<KEY>` / related to `<KEY>` / no match (and list the queries tried).
- **Create:** `createJiraIssue` with `projectKey`, `issueType`, `summary`, markdown `description`, `labels`, `priority` (Highest/High/Medium/Low/Lowest), and `parent` for a Subtask.
  - New issues land in the **backlog**. Pass `assignToSprint: "active"` only when the user wants it in the current sprint.
  - The response is only `{id, key}`. When labels, priority or sprint matter, read the issue back (`getJiraIssue`, `view: "evidence"`) and report what Jira actually stored.
  - **Test or demo tickets** (anything not real work): summary prefix `[agent-test]`, label `agent-test`, priority Low, and a description saying who created it and why. Find them with `labels = agent-test`, and close them when done.
  - **Cleanup:** search `project = SCRUM AND (labels = agent-test OR summary ~ "agent-test")` (both, in case a label was missed). For each one still open: comment, then transition **41**. Don't delete them, because history is useful to the course and deletes need explicit approval.
  - SCRUM's only closing status is Done (no "Won't do" resolution). When a test ticket describes a **real or seeded bug that is still present**, the closing comment must say "closed as test artifact, **NOT fixed**", with the `path:line @ sha`, so nobody reads Done as resolved. Offer to file a real ticket if it should be tracked.
  - Report a final table: key, status, closing commentId.
- **Bugs:** write the body with the `bug-report` skill (`.agents/skills/bug-report/template.md`), run the duplicate check, then create the issue as type Bug.
  - Summary: `[Area] Page/feature: symptom (FM-BUG-NN)`. Area is one of `Storefront`, `Back office`, `Backend`. Use the report's summary line; **drop the template's `# Summary` H1** from the description, because Jira shows the summary as the title.
  - Priority mapping: P1 → Highest, P2 → High, P3 → Medium, P4 → Low. SCRUM has no Severity field, so keep the `**Severity:** … **Priority:** …` line at the top of the description.
  - Labels: component area (`cart`, `checkout`, `delivery`, `admin-orders`, …) plus `bug`.
  - For `[agent-test]` bugs, the test-ticket rules win (priority Low). State the real severity and priority in a quoted note at the top.
  - If the bug wasn't reproduced against a running app, say so under Reproducibility (e.g. "by code path; not executed"). Don't present code reading as an observed result.
- **Seeded bugs:** if the issue matches an `FM-BUG-NN` / `FM-FLAKE-NN` tag (`rg "FM-(BUG|FLAKE)-\d+" apps`), put the tag in the description and a `path:line` reference.
- **Transitions:** `transitionJiraIssue` with a `transitionId`.
  - SCRUM workflow (checked 2026-10-05): every status can be reached from any status, with no transition screens. **11** To Do, **21** In Progress, **31** In Review, **41** Done.
  - If an id is rejected, or for another project, list them with `executeRead` name `listJiraIssueTransitions`, inputs `{issueIdOrKey}`. No `discover` is needed.
  - The response gives the status the issue landed in, so no read-back is needed. Move one step per call; a skipped step (To Do → Done) is allowed but loses history, so follow the real flow when the user asks for it.
  - Moving to/from a sprint: `transitionJiraIssue` with `sprintId` or `assignToBacklog: true`.
- **Comments:** `addOrEditJiraIssueComment` (markdown works: bold, lists, `code`). Use this shape:
  ```
  **<context, e.g. "Verification on main @ <sha>">**

  - Checked: <what, how: test name / steps / commit>
  - Result: <observed outcome>
  - Links: <commit, PR, Qase case, path:line>

  Next: <follow-up or "none">
  ```
  - Report the returned `commentId`. You need it to edit later (omit it to add a new comment).
  - Editing **replaces the whole body**: read the existing comment first (`listJiraIssueComments` via `executeRead`) and send the full new text.
  - Don't put comments in `transitionJiraIssue`'s `update`. They are silently dropped there.
- Redact tokens, passwords, JWTs and personal data from anything you post.

## 4. Link to code and PRs

- Branches and commits for a ticket include the key: `fix/scrum-5-cart-decrement`, `Fix cart decrement removing item early (SCRUM-5, FM-BUG-07)`. Shipping goes through the `ship-pr` skill, and only when the user asks.
- After a PR is opened, add a comment on the issue with the PR link.
- **Linking an issue to existing code/fix** (no GitHub↔Jira integration, so links live in comments):
  - Repo: `https://github.com/artashesmkrtchyan09/foodme_demo`. Commit URL: `<repo>/commit/<sha>`, PR URL: `<repo>/pull/<n>`.
  - Find the fix: `git log --oneline --all --grep="<KEY>\|FM-BUG-NN"`. Find its PR: `"/c/Program Files/GitHub CLI/gh.exe" pr list --state merged --search <sha> --json number,title,url` (`gh` isn't on PATH).
  - Give the current line as `path:line` on `main @ <short sha>`. Line numbers drift, so always pin the sha.
  - **Check the ticket's Definition of done before suggesting Done.** A code fix with no test it requires (e.g. no E2E spec in `apps/web/e2e`) is not done. Say what's missing in the comment's `Next:` and leave the status alone.
  - Markdown quirk: inline `code` inside `**bold**` gets split out of the bold. Keep code outside bold headings.

## 5. Report back

Always give the issue key **and** its URL (`https://artashesmkrtchyan09.atlassian.net/browse/<KEY>`). For lists, use a short table: key, type, status, priority, summary.
