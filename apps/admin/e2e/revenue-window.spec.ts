import { test, expect } from "@playwright/test";
import {
  loginAsAdmin,
  createOrderViaApi,
  cancelOrderViaApi,
  setStatusViaAdminApi,
  placeMoreOrdersViaApi,
  refreshDashboard,
  revenueOf,
  amd,
} from "./helpers";

// Boundary tests for the dashboard's "Recent revenue" window (the 100 most recent
// orders). They need to know an order's exact position in that window and the exact
// sum before and after one more order, which only holds when nothing else writes
// orders meanwhile. So they run only against a backend no other suite or run uses
// (E2E_ISOLATED_BACKEND=true, set by e2e-flake-check.yml, which starts its own
// Postgres), and are skipped against a shared one.
test.describe("Dashboard revenue window", () => {
  test.skip(
    !process.env.E2E_ISOLATED_BACKEND,
    "Needs a backend no other suite writes to: set E2E_ISOLATED_BACKEND=true",
  );

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  // The exact drop for case 140; admin-flows.spec.ts checks the card per response on any backend.
  // qase: 140
  test("dashboard revenue drops by the order total when the customer cancels it", async ({
    page,
    request,
  }) => {
    const order = await createOrderViaApi(request);
    const before = await refreshDashboard(page);
    expect(before).toContainEqual(expect.objectContaining({ number: order.number, status: "NEW" }));
    await expect(page.getByTestId("recent-revenue")).toContainText(amd(revenueOf(before)), { timeout: 15000 });

    await cancelOrderViaApi(request, order);
    const after = await refreshDashboard(page);

    expect(revenueOf(after)).toBe(revenueOf(before) - order.totalPrice);
    await expect(page.getByTestId("recent-revenue")).toContainText(amd(revenueOf(after)));
  });

  // The exact drop for case 141; admin-flows.spec.ts checks the card per response on any backend.
  // qase: 141
  test("dashboard revenue drops by the order total when the kitchen rejects it", async ({
    page,
    request,
  }) => {
    const order = await createOrderViaApi(request);
    const before = await refreshDashboard(page);
    expect(before).toContainEqual(expect.objectContaining({ number: order.number, status: "NEW" }));
    await expect(page.getByTestId("recent-revenue")).toContainText(amd(revenueOf(before)), { timeout: 15000 });

    await setStatusViaAdminApi(request, order.number, "REJECTED");
    const after = await refreshDashboard(page);

    expect(revenueOf(after)).toBe(revenueOf(before) - order.totalPrice);
    await expect(page.getByTestId("recent-revenue")).toContainText(amd(revenueOf(after)));
  });

  // qase: 142
  test("dashboard revenue counts the 100th most recent order and drops it at 101st", async ({
    page,
    request,
  }) => {
    const order = await createOrderViaApi(request);
    await placeMoreOrdersViaApi(request, order, 99);

    const recent = await refreshDashboard(page);
    expect(recent).toHaveLength(100);
    expect(recent[99]).toEqual(expect.objectContaining({ number: order.number, status: "NEW" }));
    await expect(page.getByTestId("recent-revenue")).toContainText(amd(revenueOf(recent)), { timeout: 15000 });

    // Quantity 2, so the newest order's total differs from K's. With equal totals the
    // expected card value E1 + P_N - P_K would equal E1, and the final check couldn't
    // tell a refreshed card from one that never re-rendered.
    const [newest] = await placeMoreOrdersViaApi(request, order, 1, 2);
    expect(newest.totalPrice).not.toBe(order.totalPrice);
    const after = await refreshDashboard(page);

    expect(after.map((o) => o.number)).not.toContain(order.number);
    expect(revenueOf(after)).toBe(revenueOf(recent) + newest.totalPrice - order.totalPrice);
    await expect(page.getByTestId("recent-revenue")).toContainText(amd(revenueOf(after)));
  });

  // qase: 143
  test("dashboard revenue never counts a cancelled order at the edge of the window", async ({
    page,
    request,
  }) => {
    const order = await createOrderViaApi(request);
    await cancelOrderViaApi(request, order);
    await placeMoreOrdersViaApi(request, order, 99);

    const recent = await refreshDashboard(page);
    expect(recent).toHaveLength(100);
    expect(recent[99]).toEqual(expect.objectContaining({ number: order.number, status: "CANCELLED" }));
    await expect(page.getByTestId("recent-revenue")).toContainText(amd(revenueOf(recent)), { timeout: 15000 });

    const [newest] = await placeMoreOrdersViaApi(request, order, 1);
    const after = await refreshDashboard(page);

    expect(after.map((o) => o.number)).not.toContain(order.number);
    expect(revenueOf(after)).toBe(revenueOf(recent) + newest.totalPrice);
    await expect(page.getByTestId("recent-revenue")).toContainText(amd(revenueOf(after)));
  });
});
