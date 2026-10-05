# Git workflow

Applies to every change in this repo: code, tests, test data, docs, CI and agent files. These rules hold for humans and coding agents alike.

The default branch is **`main`** (the "master" branch). Render redeploys the app on every push to it (`autoDeploy: true` in `render.yaml`), so whatever lands on `main` goes live.

## Never work directly on `main`

- Never commit or push directly to `main`. Every change goes through a branch and a pull request.
- Never force-push to `main`, and never rewrite its history (`reset`, `rebase`, `commit --amend` on commits already pushed there).
- Before starting work, update `main` and branch from it:
  ```sh
  git switch main
  git pull --ff-only
  git switch -c test/web-checkout-empty-cart
  ```
- If you notice you committed on `main` by mistake and haven't pushed yet, move the work to a branch: `git switch -c <branch>`, then `git switch main` and `git reset --hard origin/main`. Check `git log` first to make sure the commits are on the new branch.

## Branches

- One branch per task: one bug fix, one test suite change, one ticket. Don't mix unrelated work.
- Name format: `<type>/<area>-<short-description>`, lowercase, words separated by hyphens. Add the ticket or bug ID when there is one.

  | Type | Use for | Example |
  |---|---|---|
  | `test/` | new or changed automated tests (JUnit, Playwright) | `test/admin-order-status-filter` |
  | `fix/` | product bug fixes | `fix/fm-bug-07-cart-decrement` |
  | `flake/` | stabilizing a flaky test | `flake/fm-flake-01-dish-modal-wait` |
  | `feat/` | new product functionality | `feat/web-order-history-page` |
  | `chore/` | tooling, deps, CI, config | `chore/ci-playwright-cache` |
  | `docs/` | README, AGENTS.md, rules, skills | `docs/git-workflow-rule` |

  Areas: `backend`, `web`, `admin`, `ci`, `infra`, or the feature name.
- Keep branches short-lived. Merge within a few days. Delete the branch after the PR is merged.
- Keep your branch current with `main` by rebasing (`git fetch && git rebase origin/main`) until the branch is shared with others. After that, merge `main` in instead of rebasing.

## Commits

- **Small and focused:** one logical change per commit. A reviewer should be able to read it and understand it alone. Test changes and the fix they cover can share a commit. Unrelated cleanup and formatting go in their own commit.
- **Each commit should build and pass lint.** Don't commit half-finished work that breaks the build. Use `git stash` or a WIP commit on your own branch and squash it before the PR.
- **Review before committing.** Run `git status` and `git diff --staged`. Stage files on purpose (`git add <path>` or `git add -p`) rather than `git add .`, so stray files don't slip in.
- **Commit often, push regularly** so work isn't lost and CI runs early.

## Commit messages

- Subject line: imperative mood ("Add", "Fix", "Stabilize", not "Added"/"Fixes"), about 50 characters and never over 72, no trailing period.
- Say *what* changed and where. "Fix stuff", "update", "wip" or "changes" are not acceptable.
- Reference the ticket or seeded-bug tag in the subject when there is one, e.g. `Fix cart decrement removing item one step early (FM-BUG-07)`.
- When the reason isn't obvious, add a blank line and a body explaining *why*: root cause, what the test now covers, what was tried.

  ```
  Stabilize dish modal spec by waiting for dialog (FM-FLAKE-01)

  The spec used waitForTimeout(300), which failed under the backend's
  simulated latency. It now waits for the dialog role to be visible.
  ```

Good subjects:
- `Add Playwright spec for checkout with empty cart`
- `Cover order status transitions in OrderServiceTest`
- `Replace class locators with roles in admin orders spec`

Bad subjects: `tests`, `fixed bug`, `Update order.spec.ts`, `more changes`.

## What never goes into git

- Secrets and personal config: `.env*` (except `.env.example`), API tokens (Qase, Sentry/GlitchTip DSN tokens, Render, GitHub), passwords, JWTs. `.gitignore` covers the common files. If you commit a secret by accident, rotating it is the fix. Deleting it in a later commit is not enough, because it stays in history.
- Generated output: `test-results/`, `playwright-report/`, `blob-report/`, `build/`, `dist/`, `node_modules/`, traces, videos and screenshots from test runs. Attach these to the bug report or PR instead.
- Real customer or production data in fixtures. Use made-up test data.
- Large binaries. Link to them instead.

## Pull requests

- Open the PR against `main` with a clear title (same style as a commit subject) and a description covering:
  - what changed and why, with links to the ticket, bug report or Qase case
  - how it was tested: which suites were run locally (`./gradlew test`, `npm run test:e2e`, …) and their result
  - screenshots or traces for UI changes or failures
- Keep PRs small. Under ~400 changed lines is a good target. Split large work into several PRs.
- Wait for CI (`ci.yml`) to be green and for review (including `claude-pr-review.yml`) before merging. Don't merge red builds. If a failure is a known `FM-FLAKE-NN` flake, say so in the PR and re-run it. Don't ignore it silently.
- Resolve review comments with new commits rather than force-pushing over reviewed work. Squash on merge if the history is noisy.
- Don't merge your own PR without review unless the team has agreed that's fine for that kind of change.

## Seeded bugs and flakes

Code tagged `FM-BUG-NN` or `FM-FLAKE-NN` is intentionally broken (see the root `AGENTS.md`). Don't fix it as a side effect of another change. When you do fix one on purpose, do it in its own branch and PR, and put the tag in the branch name and commit subject.

## Merge conflicts

- Resolve conflicts locally, then re-run the affected build and tests before pushing.
- Never resolve a conflict by blindly taking "ours" or "theirs" on test files. Two people may have added different tests to the same spec, and both should survive.
- Don't commit conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`). Search for them before committing.
- If a lock file (`package-lock.json`) conflicts, take `main`'s version and run `npm install` again rather than editing it by hand.

## Safe habits

- Run `git status` before and after every git operation that changes state.
- Prefer non-destructive commands: `git revert` over `git reset` on shared branches, and `git push --force-with-lease` over `--force` on your own branch.
- Before `git reset --hard`, `git clean -fd`, `git checkout -- <file>` or `git branch -D`, check what will be lost. These can't be undone.
- To undo something on `main`, open a PR with `git revert <sha>`. Never rewrite `main`.
- Tag releases or test-cycle baselines (e.g. `git tag qa-cycle-2026-10`) when you need to reproduce exactly what was tested.
- When reporting a bug, include the commit SHA (`git rev-parse --short HEAD`) or the deployed version you tested.
