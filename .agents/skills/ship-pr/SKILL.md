---
name: ship-pr
description: Commit, push and open a ready-to-merge GitHub pull request for FoodMe changes already made on a feature branch, then watch CI, separate new failures from ones already on main, hand the merge to the user and sync main afterwards. Use ONLY when the user explicitly asks to commit, push, open/create a PR or ship/send their changes. Never use it on your own after finishing a change.
---

# Ship a change as a pull request

Branch names, commit messages, PR contents and what must never be committed are defined in [`.agents/rules/git-workflow.md`](../../rules/git-workflow.md). Read it first and follow it. This skill is the step-by-step procedure.

**Run only on request.** Under the rule's *Coding agents* flow, you make changes on a branch and stop. This skill starts only when the user asks you to ship them. Do only what they asked: "commit" means steps 1–2 without pushing, "push" means up to step 2, and "open a PR" or `/ship-pr` means steps 0–5. If unsure, ask.

**You never merge.** The user reviews and merges every PR themselves, because `main` auto-deploys to Render. Claude Code's auto mode also blocks `gh pr merge`. Don't try to get around that with another tool, the API or a direct push to `main`.

## 0. Make sure `gh` works

Run every `gh` command through the Bash tool, using the full path if `gh` isn't on PATH:

```sh
GH=$(command -v gh || echo "/c/Program Files/GitHub CLI/gh.exe")
"$GH" auth status
```

- **Not installed:** ask the user, then run `winget install --id GitHub.cli -e --accept-source-agreements --accept-package-agreements --silent` in PowerShell.
- **Not logged in:** ask the user to run `! "/c/Program Files/GitHub CLI/gh.exe" auth login --web --git-protocol https`.
- Any command you ask the user to run with `!` executes in **bash**. Write it in bash syntax: `/c/...` paths, quoted exe path, no PowerShell `&`.

## 1. Check the working tree

- `git status --short` and `git diff`. Read every changed or untracked file you are about to commit, including files the user edited, so you know exactly what you're publishing.
- Leave out anything the rule forbids (secrets, `.env*`, reports, build output). If unrelated changes are mixed in, ask which ones belong in this PR.
- Check that no `FM-BUG-NN` / `FM-FLAKE-NN` code was changed by accident (`git diff | grep -n "FM-\(BUG\|FLAKE\)"`).

## 2. Commit and push

The changes should already be on a feature branch (`git branch --show-current`). If they're on `main`, move them to a new branch named by the rule (`git switch -c <type>/<area>-<short-description>` carries uncommitted changes along) and tell the user you did.

```sh
git add <paths>                                    # explicit paths, never `git add .`
git commit -F - <<'EOF'
<Imperative subject, ≤72 chars, with FM tag if any>

<Why, when not obvious>

<attribution trailer from the session's system reminder, if any>
EOF
git push -u origin <branch>
```

- If commits were made on `main` by mistake, follow the recovery step in the rule.
- Split unrelated changes into separate commits.
- Stop after this step if the user asked only to commit or push.
- Run the checks that cover what you changed before pushing (see the app's `AGENTS.md`). Docs-only changes need none.

## 3. Open the PR

```sh
"$GH" pr create --base main --head <branch> --title "<same style as commit subject>" --body-file - <<'EOF'
## What changed
<what and why; links to ticket / bug report / Qase case>

## How it was tested
<suites run and their results, or "Docs-only change">

<PR attribution footer from the session's system reminder, if any>
EOF
```

## 4. Watch CI and sort the failures

```sh
"$GH" pr checks <N> --watch --interval 20      # Bash tool, timeout up to 600000
```

For every failing check, find out if this PR caused it:

```sh
"$GH" run list --branch main --limit 4                  # is main red too?
"$GH" run view --job <job-id> --log-failed | grep -E "##\[error\]|ERROR|error:" | head
```

- **Caused by this PR:** fix it on the branch with a new commit (no force-push), push again and watch again.
- **Already failing on `main`, or a known `FM-FLAKE-NN`:** post a PR comment listing each failure with its one-line cause and noting that it also fails on `main`. Don't fix it in this PR. Offer a separate `chore/ci-…` PR instead.

Known failures on `main` as of 2026-10-05:
- Backend Build: `gradle-wrapper.jar` is not committed.
- Docker Build: the build context is missing `apps/*`.
- claude-review: "Environment variable validation failed".

Re-check these against `main` each time, since they may have been fixed.

## 5. Hand the merge to the user

Stop and tell the user:
- the PR link
- a CI summary: what passed, and what failed and why
- the merge command for them to run:

  ```
  ! "/c/Program Files/GitHub CLI/gh.exe" pr merge <N> --merge --delete-branch
  ```

  They can also merge on the PR page.

## 6. After the user says it's merged

Check the merge actually happened before syncing. A merge from the UI can fail silently, for example because of failing required checks.

```sh
"$GH" pr view <N> --json state,mergedAt     # must be "MERGED"
git switch main
git pull --ff-only
git fetch --prune
git branch -d <branch>
```

If the state is still `OPEN`, say so and give the merge command again. Don't pull or delete anything until it's merged.

Finally, remind the user that merging to `main` triggers a Render redeploy.
