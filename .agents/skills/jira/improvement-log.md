# jira skill — improvement log

One entry per real run of the skill: the task, the friction it ran into, and the change made to `SKILL.md`.

<!-- Entry format:
## Run N/10 — <task>
- Result: <what was done, issue keys>
- Friction: <what was wrong, missing or slow in the skill>
- Change: <what was edited in SKILL.md>
-->

## Run 1/10 — List open bugs in SCRUM
- Result: 1 open bug, SCRUM-5 (High, To Do). The bounded JQL from the skill worked first time.
- Friction: The skill made every session start with a `getAccessibleAtlassianResources` call just to get a cloudId that never changes.
- Change: Hardcoded the cloudId, with the lookup kept only as a fallback. Noted that the compact view already has the fields a list needs.

## Run 2/10 — Summarize SCRUM-5
- Result: Summarized. Found drift: the bug (FM-BUG-07) has been fixed on `main` by `fa2c378` since 2026-09-27, but SCRUM-5 is still To Do and the commit doesn't mention the key.
- Friction: The skill had no guidance for one-issue summaries (which view, where comments live) and didn't prompt a code cross-check. Without the extra grep the summary would have been wrong.
- Change: Added a "Summarizing one issue" recipe, the Sprint/Rank field IDs, and a "Drift check" step (git log by key and seeded tag; a removed marker means fixed).

## Run 3/10 — Duplicate check: "cart item disappears when decreasing quantity on checkout page"
- Result: Likely duplicate of SCRUM-5. Since its fix is on main, a new report would be a regression, so the action is to comment on or reopen SCRUM-5, not create a new issue.
- Friction: "2–3 keywords" was too vague. The ticket says "basket" while the reporter said "cart", and the skill didn't say whether to include Done issues or how `text ~` matches.
- Change: Replaced the bullet with a recipe: object × symptom OR-groups, a FoodMe synonym list, no status filter (Done match = regression), and a fixed set of verdicts.

## Run 4/10 — Create test Task
- Result: Created SCRUM-6 "[agent-test] Verify jira skill create flow" (Task, Low, label agent-test, backlog). Checked first for existing agent-test tickets (none) and verified by reading it back.
- Friction: There was no create recipe. The create response is only `{id, key}`, so nothing confirms the fields. It wasn't clear whether new issues join the active sprint (they don't) or how to mark throwaway tickets.
- Change: Added a "Create" bullet covering the fields, the backlog-by-default rule with `assignToSprint: "active"`, read-back verification, and conventions for test tickets.

## Run 5/10 — Comment on SCRUM-6
- Result: Added comment 10000 on SCRUM-6 summarizing runs 1–4. Markdown rendered correctly.
- Friction: There was no comment template, so the structure was improvised. The skill didn't mention that `commentId` is needed for edits, that an edit replaces the whole body, or that comments passed during a transition are silently dropped (from the tool docs).
- Change: Expanded the Comments bullet with a Checked/Result/Links/Next template, and added notes on commentId, full-body edits and the transition comment trap.

## Run 6/10 — Transition SCRUM-6 To Do → In Progress → Done
- Result: Listed the transitions, then moved SCRUM-6 to In Progress (21) and then Done (41). Both calls confirmed the landed status.
- Friction: The skill pointed to `discover` for listing transitions, even though the operation name `listJiraIssueTransitions` is known. Without the ids written down, every transition costs an extra lookup.
- Change: Recorded the SCRUM workflow ids (11/21/31/41, global transitions), the direct `executeRead` call as a fallback, the no-read-back note and sprint/backlog moves.

## Run 7/10 — Create a Bug from bug-report output
- Result: Picked seeded FM-BUG-03 (free delivery uses `>` instead of `>=`, `OrderService.java:62`). The duplicate check (delivery/shipping × free/threshold/fee/price) found no match. Created SCRUM-7 as an `[agent-test]` Bug with the full bug-report body; the endpoint path was verified from the code.
- Friction: "Map bug-report priority to Jira priority" had no mapping (P1–P4 vs Highest…Lowest). Severity has no Jira field. The template's H1 duplicates the summary. It wasn't clear which priority applies to a test bug, or how to label a report that came from code reading.
- Change: Expanded the Bugs bullet with the summary/area format, dropping the H1, the P→Jira priority mapping, keeping Severity in the body, labels, the agent-test priority rule and the "not reproduced" wording.

## Run 8/10 — Link SCRUM-5 to the FM-BUG-07 fix
- Result: Added comment 10001 on SCRUM-5 with `useCart.ts:75` @ `b22a1ab`, commit `fa2c378` and PR #2 links. Found the definition of done unmet (no E2E spec covers it), so the ticket was left in To Do rather than closed.
- Friction: There was no recipe for commit → PR → URL, so I had to work out the repo URL and the `gh` path (not on PATH). Nothing prompted a definition-of-done check before closing. Inline code inside bold rendered oddly.
- Change: Added "Linking an issue to existing code/fix" to section 4: repo/commit/PR URL patterns, git/gh commands, sha-pinned `path:line`, the definition-of-done gate and the markdown quirk.

## Run 9/10 — Sprint/board overview
- Result: Sprint 0 (id 2) ends 2026-10-08 at 0% complete (3 issues, all unassigned). SCRUM-1 and SCRUM-2 are overdue, SCRUM-5 is high priority. Backlog: SCRUM-3 (In Progress outside a sprint), SCRUM-4, plus the agent-test tickets.
- Friction: "Call discover" meant a round-trip, and my first try (JQL with the sprint field) couldn't show due-date risk, metrics or the future sprint. The right operation, `getJiraBoardSprintData`, does all of it in one call.
- Change: Added a "Sprint/board overview" recipe with the board id (1), sprint ids (2 active, 1 future), a backlog JQL, the overview shape, and a rule against rebuilding it from JQL. Narrowed the discover bullet.

## Run 10/10 — Clean up agent-test tickets
- Result: Found SCRUM-6 (already Done) and SCRUM-7 (To Do). Added closing comment 10002 on SCRUM-7 stating that FM-BUG-03 is NOT fixed (still at `OrderService.java:62` @ `b22a1ab`), then moved it to Done (41). All agent-test tickets are now Done; nothing was deleted.
- Friction: "Close them when done" ignored that a test bug can describe a real, unfixed bug. SCRUM has only Done as a closing status, so a bare close would falsely suggest a fix.
- Change: Added a Cleanup recipe: a label-or-summary search, comment then transition 41, no deletes, required "NOT fixed" wording for still-present bugs, and a final report table.
