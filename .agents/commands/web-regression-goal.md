---
description: Run the web-regression skill 10 times, compare the outputs and improve the skill until repeated runs give the same result
argument-hint: "[runs=10] [base-url=https://foodme-artashesmkrtchyan.onrender.com]"
---

# Goal: a web regression that gives the same result every time

Arguments: `$ARGUMENTS` (optional: number of runs, default **10**; base URL, default prod: `https://foodme-artashesmkrtchyan.onrender.com`).

**Goal.** Run the `web-regression` skill repeatedly against the same app and make the skill better each time its output differs, until repeated runs are identical. The goal is met when the **last 3 runs have the same signature and needed no skill change**. Run all the requested runs even once the goal is met: the later runs confirm it.

Same input, same app, same commit: any difference between runs comes either from the skill (ambiguity, leaked state, different data or interpretation) or from the app (seeded flakes, latency). The skill can fix the first kind completely and must classify the second kind the same way every time.

## Setup

1. Follow `.agents/rules/git-workflow.md`: you'll edit files under `apps/web/.agents/skills/web-regression/`, so be on a `docs/` branch made from an up-to-date `main` (for example `docs/web-regression-self-improve`). If you're already on a branch for this work, stay on it.
2. Note `git rev-parse --short HEAD` and the deployed version (the skill's preflight step 3: the `assets/index-*.js` bundle name prod serves). The app must not change during the session. Prod redeploys on every push to `main`, so don't push or merge anything to `main` while the goal runs, and ask the user to hold merges too. Compare each run's `deployedVersion` with run 1's. If it changed, stop and tell the user: runs from before and after a redeploy can't be compared. Restart the session from run 1 if they agree.
3. Every run registers customers and may place orders in the **prod** database (10 runs × every case). That's expected for this demo, but say it once at the start so the user isn't surprised.
4. Use a session folder `$OUT/web-regression-goal-<yyyyMMdd-HHmm>/` (`$OUT` = `$CLAUDE_JOB_DIR/tmp`, or the system temp dir).

## Each run (N = 1 … runs)

1. **Run** the regression with the `web-regression-runner` agent (one fresh agent per run, one at a time, never in parallel: they share the browser). Give it: run label `goal-<N>`, the base URL, "do not record to Qase", and the output folder `<session folder>/goal-<N>/`.
2. **Read** its `result.json`. If it returned `BLOCKED`, fix the environment with the user (the skill's preflight says how). A blocked run doesn't count, so run it again.
3. **Compare** with every earlier run of this session, case by case: status, failed step, reason, known issue, and the set of cases executed and excluded. Also read its *Skill gaps*. Ignore durations, timestamps, screenshot names and the run label.
4. **Classify** each difference and each skill gap, in this order:

   | Cause | Example | Action |
   |---|---|---|
   | Case selection | different case count, order or excluded list | Fix section 2 of `SKILL.md` (query, filter or sort). |
   | Ambiguous step | the agent did step 3 one way in one run and another way in another | Add a note for that case to `case-notes.md`, or a general rule to section 3 if several cases share the problem. |
   | Test data / state | a different chef or dish, an account reused, a cart left from the previous case | Tighten the data or fresh-state rules in section 3. |
   | Oracle / wording | same behaviour, different status or reason text | Tighten the pass/fail or reason rules in section 3. |
   | Waiting | a step failed because the page was still loading | Add a wait rule (what text to wait for). Never a fixed delay. |
   | App flake | an `FM-FLAKE-NN` area, or latency, flips a case between `passed` and `flaky` | Not fixable in the skill. Make sure it's labelled the same every time (`knownIssue`), and note it in `case-notes.md`. |
   | Environment | prod instance asleep or restarted (free tier, 512 MB), redeploy, network error | Improve preflight if it could have caught it. Otherwise no change. |
   | Real product failure | fails the same way every run | Not a skill problem. Keep it in the final report. |

5. **Improve.** Make the smallest edit that would have made this run match the others, in `SKILL.md` or `case-notes.md`. Change only how the regression is performed, never what a case checks: don't change Qase cases, product code or tests. Keep `SKILL.md` general (rules for all cases), put case-specific details in `case-notes.md`, and remove a rule if it turned out to be wrong. If the run matched and reported no gaps, change nothing.
6. **Log** the run in `apps/web/.agents/skills/web-regression/improvement-log.md` using the format at the top of that file.
7. Tell the user in one line: run N, same/different from which run, cause, change made.

## Finish

Report in the chat:

```
# Regression goal — <date> — <git sha> — <runs> runs

Goal: <met at run N (last 3 identical, no changes) | not met>

## Stability per case
| Case | Title | Run 1 … Run N | Stable? | Cause of differences |

## Skill changes
| Run | File | Change | Cause |

## Remaining instability
Cases still differing, with the cause and whether the skill can still fix it.

## Product findings
Failures that were the same in every run, with known FM-BUG/FM-FLAKE tags. Offer the bug-report skill for the ones without a tag.
```

Then stop, as the git-workflow rule says: list the branch and the changed files, and leave them uncommitted until the user asks to commit (`/ship-pr`).
