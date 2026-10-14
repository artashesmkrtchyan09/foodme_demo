---
name: qa-flake-check
description: Step 11 of the feature-qa workflow. After the human approves the push, commits the feature's Playwright specs on their test/ branch, pushes it and runs the e2e-flake-check GitHub workflow (specs repeated 10 times, retries off, simulated latency on), then reports per-test pass counts in 11-flake-check.md. Use only when the feature-qa skill runs step 11 for a qa-runs/<folder>.
---

# CI flake check (step 11)

Input: the run folder. Read these from it:
- `09-automation.md`: the branch, the specs and the test titles
- `00-progress.yaml`
- `.agents/skills/feature-qa/references/artifacts.md` (step 11)

The orchestrator runs this step only after the human has answered `push` at the step-11 gate. That answer is the explicit request that `.agents/rules/git-workflow.md` requires before an agent pushes.

`gh` is not on the bash PATH: use `GH="/c/Program Files/GitHub CLI/gh.exe"`, and check `"$GH" auth status` first (see the `ship-pr` skill §0).

1. **Commit.**
   - Check that you're on the branch from `09-automation.md` (`git branch --show-current`).
   - Run `git status` and `git diff`, then stage the spec and helper files explicitly. Never stage `qa-runs/` (it is git-ignored), reports or traces.
   - Commit with a subject in the git-rule style: `Add Playwright specs for <feature> (<KEY>)` on the first cycle, `Stabilize <feature> specs after flake check (<KEY>)` on later cycles. Add the session's attribution trailer.
   - On a re-run, make a new commit; never amend or force-push.
2. **Push:** `git push -u origin <branch>`.
3. **Run the workflow.** It must exist on `main`. If `gh workflow view e2e-flake-check.yml` fails, set `blocked: e2e-flake-check.yml is not on main yet; merge the feature-qa setup PR first` and stop.
   ```sh
   "$GH" workflow run e2e-flake-check.yml --ref <branch> -f app=<web|admin> -f specs="<space-separated spec paths relative to apps/<app>>" -f repeat=10
   sleep 5; "$GH" run list --workflow e2e-flake-check.yml --branch <branch> --limit 1 --json databaseId,url,headSha
   "$GH" run watch <id> --exit-status --interval 30      # Bash tool, timeout 600000; re-run watch if it times out
   ```
   Check that `headSha` equals `git rev-parse HEAD`, so the run tests the commit you just pushed. Run one dispatch per app when both apps changed.
4. **Read the results.**
   - Download the run's artifact: `"$GH" run download <id> -n flake-check-<app> -D "$CLAUDE_JOB_DIR/tmp/flake-<id>"`, and parse `results.json` with `node -e`.
   - For each test (spec › title), count the passed runs out of the repeats, and collect each unique failure message (first line).
   - Tests that `test.fail` expects to fail count as passed when Playwright reports them as `expected`.
   - Don't download traces into the repo.
5. **Write the artifact.** Append the run to `11-flake-check.md`, with:
   - the run URL and sha
   - the per-test table
   - `verdict: stable` only if every test passed 10/10, otherwise `flaky`
   - the decision: stable → step 12, flaky → step 9, with the failing tests and messages as findings

   A failure on every run of a test is not flakiness. It is a broken test, or an unmarked product bug, and it also goes back to step 9.

Return one line: `run <url>: <n>/<n> tests 10/10 → <stable|flaky>`.
