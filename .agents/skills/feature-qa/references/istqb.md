# ISTQB rules applied in the feature QA workflow

This file is the checklist each step applies. Terms follow the ISTQB glossary (CTFL v4.0), and documents follow ISO/IEC/IEEE 29119-3. Use the terms as written: a **defect** is in the product, a **failure** is what execution observes, and an **error** is the human mistake behind them.

## 1. Requirement review (static testing): steps 1–2

Review type: an informal review that uses a checklist, with the human at the gate as the author/PM role. Check each requirement statement against these attributes, and raise a question for every miss:

| Attribute | The requirement fails when… |
|---|---|
| Complete | It lacks a trigger, actor, precondition, input range, output, error behaviour, or non-functional need (performance, accessibility, security) that matters to users |
| Unambiguous | It uses words like "fast", "user-friendly", "etc.", "and/or", "should", "appropriate", or has an undefined term or a pronoun with no clear antecedent |
| Consistent | It contradicts another requirement, the existing app behaviour (check the code), or the UI copy |
| Testable / verifiable | No objective pass/fail oracle can be written: no number, state, message or rule to check |
| Feasible | It conflicts with known constraints (Render free tier, a single-chef cart, the order status flow) |
| Traceable | It has no ID, or a business rule has no source |
| Atomic | One statement mixes several requirements that can pass or fail independently |
| Bounded | Inputs, lists or quantities have no limits (min/max, empty, overflow) |

Question severity:
- **blocker**: no test can be designed until it is answered.
- **major**: tests can be designed, but the oracle is a guess.
- **minor**: wording or completeness.

Each question quotes the text it is about and proposes a default answer, so the human can just confirm it.

The **requirement baseline** lists atomic requirements with IDs `REQ-1…`, the acceptance criteria per REQ, and out-of-scope items. Tests trace to it, not to the raw source.

## 2. Test plan (ISO 29119-3 test plan): steps 3–4

Required sections:
1. Context and test items
2. Scope: features to be tested and features not to be tested, with reasons
3. Test objectives
4. Product risk analysis: likelihood × impact, each 1–3, so risk = 1–9, with a REQ per risk. High risk (6–9) gets more techniques and higher-priority cases
5. Test approach: test levels (system or E2E UI, API where needed), test types (functional, negative, boundary, usability spot-checks, compatibility only where the requirement asks for it), design techniques per REQ (§3), and experience-based testing (error guessing from FM-BUG history)
6. Test environment and test data: prod `onrender.com` for manual runs, CI Postgres for automation, `@example.test` accounts
7. Entry criteria: baseline approved; environment reachable
8. Exit criteria: for example, 100% of REQs covered by ≥1 case, 100% of planned cases run, no open blocker or critical defect without an accepted risk, automated specs 10/10 in CI
9. Suspension and resumption criteria: for example, prod down, or a blocker defect in the core flow
10. Deliverables (the artifact list)
11. Roles: the human approver, the AI test designer, the judges
12. Project risks and mitigations

## 3. Test design techniques (black-box first)

| Technique | Use when the REQ has… | Minimum cases |
|---|---|---|
| Equivalence partitioning (EP) | input classes (valid or invalid categories) | 1 per valid partition + 1 per invalid partition |
| Boundary value analysis (BVA, 2-value) | numeric or length ranges, min order, quantity limits | min, min−1, max, max+1 (and the value just inside each boundary) |
| Decision table | combinations of conditions (signed in × delivery × payment …) | 1 per feasible rule, after collapsing |
| State transition | statuses or flows (order NEW→ACCEPTED→DELIVERED/REJECTED, cart states) | every valid transition (0-switch) + the relevant invalid ones |
| Use case / scenario | user journeys | main flow + each alternative and exception flow |
| Error guessing | known weak spots (FM-BUG areas, empty or long input, double submit, back navigation) | as judged; name the guess |

Each case names the technique it comes from.

## 4. Test case quality (ISO 29119-3 test case specification): steps 5–6

A case has:
- a unique ID (Qase)
- a title that states the behaviour and the condition
- the traced REQ-ID(s)
- priority and severity
- preconditions, including test data
- numbered steps with **one action each**
- an **expected result per step**, specific enough to be an oracle (exact text, number or state)
- the technique

Postconditions are included when the case changes data.

Bad case smells:
- several behaviours in one case
- an expected result that just says "works", "correct" or "as expected"
- hidden dependence on another case
- data that is not given
- UI-structure wording ("click the 3rd div")
- a case that duplicates another
- a case with no REQ

Coverage:
- every REQ has ≥1 case
- every acceptance criterion has ≥1 positive case
- every high-risk REQ also has negative and boundary cases

## 5. Test execution and logging: step 7

- Execute in priority order within the case-ID order the `web-regression` rules use.
- Log per case: the status, the actual result at the failing step, the evidence, and the environment and version.
- Status values:
  - `passed`
  - `failed`: a failure was observed
  - `flaky`: it passed only on the retry
  - `blocked`: a precondition was not available
  - `skipped`: not executable here
- A failure that matches a known defect (`FM-BUG-NN`, an existing Jira issue) is still `failed`, and `knownIssue` is set.

## 6. Defect reports (ISO 29119-3 incident report): step 8

Use the repo's `bug-report` template. Its fields map to ISTQB:
- ID
- title
- date and author
- test item and version
- environment
- steps to reproduce
- expected vs actual
- severity (impact) vs priority (urgency), chosen separately
- reproducibility
- evidence
- references (Qase case, REQ)
- status

Report one defect per report, and run a duplicate check before creating one.

## 7. Test automation selection: step 9

Automate a case when **all** of these hold:
- it is repeatable with self-created data
- its oracle is deterministic
- it can run without admin or fault injection in the storefront suite (or it fits the admin suite against a CI backend)
- it is not a visual-only judgement

Prioritise by:
1. risk score
2. regression value (a flow that is likely to break again)
3. execution frequency
4. cost of running it manually

Keep a case manual (and write down why) when it is exploratory, usability, visual, one-off, or needs an external system. If a known `FM-BUG` blocks a case, it is still automated, as `test.fail(true, "FM-BUG-NN: …")` (e2e rule).

## 8. Flakiness (step 10 judge, step 11)

A test is flaky when the same code passes and fails on the same input. Before CI, look for these flake causes:
- fixed waits
- shared or fixed data
- order dependence
- absolute counts on growing lists
- one-shot reads (`isVisible()`, `textContent()`) used as assertions
- races with the simulated latency (200–1500 ms)
- hard-coded seed names or IDs

Exit criterion: every new test passes **10 of 10** runs in CI with retries off and latency on.

## 9. Test completion report (ISO 29119-3): end

The report covers:
- a summary
- deviations from the plan
- the test coverage: REQ coverage %, the cases planned, run, passed and failed, and the automation %
- the defects: counts by severity and status, with links
- the residual risks
- the evaluation of each exit criterion (met / not met)
- a release recommendation, one of:
  - **Ready**: every exit criterion met, and no open blocker, critical or major defect
  - **Ready with risks**: only minor or trivial defects open, or a major defect whose risk the human accepted
  - **Not ready**: an open blocker or critical defect, a high-risk REQ that is uncovered or failing, or a core flow that is failing
- the lessons learned
