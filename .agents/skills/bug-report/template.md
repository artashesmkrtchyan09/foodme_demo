# Bug report format

Whenever you write a bug report for FoodMe (in chat, a file, a Jira/Qase issue, or a PR description), use the template below. Fill every required section; if something is unknown, write "Unknown" and say what is needed to find out, rather than dropping the section. Keep it factual: only state what was observed or verified.

## Template

```markdown
# <Summary>

**Severity:** <Blocker | Critical | Major | Minor | Trivial>  **Priority:** <P1 | P2 | P3 | P4>
**Component:** <backend | web | admin | infra> — <area, e.g. checkout, cart, admin orders>

## Preconditions
- <state needed before step 1: logged in as customer / admin `admin`, cart contains X, seed data, feature flag…>
(or "None")

## Steps to reproduce
1. <one action per step, with exact URL, input values and buttons clicked>
2. …
3. …

**Reproducibility:** <Always | Intermittent (n of m tries) | Once>

## Actual result
<what happens — exact error text, wrong value, HTTP status and response body>

## Expected result
<what should happen, and the source of truth: spec, Qase case ID, API contract, previous behaviour>

## Environment
| | |
|---|---|
| Environment | <local | Render deployment URL | CI> |
| Version | <git commit SHA / branch, deploy date> |
| OS | <e.g. Windows 11, macOS 15, Android 15, iOS 18> |
| Device | <desktop / phone model / viewport size> |
| Browser | <name + version> (not needed for backend-only bugs) |
| Backend / DB | <only if relevant: profile, Java version, Postgres version> |

Supported OSs/devices/browsers it was **also checked on** (reproduces / doesn't): <list, or "not checked">

## Attachments
- <screenshots, screen recording, HAR file, browser console output, backend log lines (Loki), Sentry/GlitchTip event link, failing test name and output>
(or "None")

## Possible cause / suggested fix (optional)
<file:line, suspected root cause, proposed fix — clearly marked as a hypothesis unless verified>
```

## Section rules

- **Summary:** one line, under ~100 characters, saying *what* is wrong *where* and *when*. Good: "Cart total ignores dish additions after quantity change on checkout". Bad: "Cart broken", "Bug in checkout".
- **Steps:** numbered, one action each, starting from the preconditions, with concrete test data (emails, phone numbers, dish names). Someone new to the project must be able to follow them without guessing.
- **Actual vs expected:** two separate sections; never merge them. Quote error messages and values exactly.
- **Severity** is the impact on the user/system; **priority** is how soon to fix it. Set them independently:
  - Blocker: app or a core flow (browse → cart → checkout → order, admin login/orders) is unusable, no workaround.
  - Critical: core flow broken or data is wrong/lost (wrong totals, wrong order status, security/auth issue), workaround is hard.
  - Major: feature doesn't work as specified, a workaround exists.
  - Minor: small functional issue or edge case with little impact.
  - Trivial: cosmetic (typo, alignment, colour).
  - P1 fix now · P2 fix in the current iteration · P3 fix when convenient · P4 backlog.
- **Environment:** always include the version (commit SHA or deploy). For UI bugs include OS, device/viewport and browser version; for API bugs include the request (method, path, body) instead of browser details.
- **Attachments:** remove tokens, passwords and personal data from logs, HAR files and screenshots before attaching.
- **Possible cause:** optional. Label it a hypothesis unless you confirmed it, and point to code as `path:line`.

## FoodMe specifics

- This repo contains deliberate bugs marked `FM-BUG-NN` and flaky tests marked `FM-FLAKE-NN`. If the bug matches one of them, reference the tag in the summary or cause (e.g. "(FM-BUG-02)").
- `SimulatedLatencyConfig` adds 200–1500 ms to API calls and `FlakyHeartbeatJob` / `flakyHeartbeat` send fake errors to Sentry/GlitchTip. These are intentional; don't report them as bugs on their own.
- For intermittent bugs, give the reproduction rate and note whether it also happens with the `test` profile (no simulated latency).
