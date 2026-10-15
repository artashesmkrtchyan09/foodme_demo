import { test, expect } from "@playwright/test";
import {
  loginAsAdmin,
  createOrderViaApi,
  cancelOrderViaApi,
  setStatusViaAdminApi,
  refreshDashboard,
  revenueOf,
  amd,
} from "./helpers";

test.describe("Admin auth", () => {
  test("rejects bad password", async ({ page }) => {
    await page.goto("/#/login");
    await page.getByLabel("Username").fill("admin");
    await page.getByLabel("Password").fill("wrong");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Invalid username or password.")).toBeVisible();
  });

  test("logs in with seeded credentials", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByRole("menuitem", { name: "Chefs" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Dishes" })).toBeVisible();
  });
});

test.describe("Admin resources", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("orders list shows rows after API order", async ({ page, request }) => {
    const order = await createOrderViaApi(request);
    await page.goto("/#/orders");
    await page.getByRole("button", { name: "Refresh" }).click();
    await expect(page.getByText(order.number)).toBeVisible({ timeout: 15000 });
  });

  test("order show + mark ACCEPTED", async ({ page, request }) => {
    const order = await createOrderViaApi(request);
    await page.goto("/#/orders");
    await page.getByRole("button", { name: "Refresh" }).click();
    await page.getByText(order.number).click();
    await expect(page).toHaveURL(/#\/orders\/\d+\/show/);
    // Both the app-bar title and the page heading render "Order FM-…"; target
    // the h5 page heading to keep the locator strict-mode safe.
    await expect(
      page.getByRole("heading", { name: `Order ${order.number}`, level: 5 }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Mark as ACCEPTED" }).click();
    await expect(page.getByText("Order status updated")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("ACCEPTED").first()).toBeVisible();
  });

  test("chefs list loads and opens edit", async ({ page }) => {
    await page.goto("/#/chefs");
    await expect(page.getByText("No Chefs found")).toHaveCount(0, { timeout: 15000 });
    await expect(
      page.getByText(/Alans Kitchen|Italiano Margarino|Chef Verona|Argentinean|Armenian Traditional|Sakura Kitchen/i).first(),
    ).toBeVisible({ timeout: 15000 });
    await page.locator("table tbody tr").first().click();
    await expect(page).toHaveURL(/#\/chefs\/\d+/);
  });

  test("dishes list loads and opens edit", async ({ page }) => {
    await page.goto("/#/dishes");
    await expect(page.getByText("No Dishes found")).toHaveCount(0, { timeout: 15000 });
    await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 15000 });
    await page.locator("table tbody tr").first().click();
    await expect(page).toHaveURL(/#\/dishes\/\d+/);
  });

  // qase: 137
  test("status filter shows customer-cancelled orders", async ({ page, request }) => {
    const order = await createOrderViaApi(request);
    await cancelOrderViaApi(request, order);
    const stillNew = await createOrderViaApi(request);

    await page.goto("/#/orders");
    await page.getByLabel("Status").click();
    await page.getByRole("option", { name: "CANCELLED" }).click();
    await expect(page).toHaveURL(/CANCELLED/);

    const row = page.getByRole("row").filter({ hasText: order.number });
    await expect(row).toBeVisible({ timeout: 15000 });
    await expect(row.getByText("CANCELLED", { exact: true })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: stillNew.number })).toHaveCount(0);
    await expect(
      page.getByRole("cell").getByText(/^(NEW|ACCEPTED|DELIVERED|REJECTED)$/),
    ).toHaveCount(0);
  });

  // qase: 138
  test("cancelled order shows the customer note and no status actions", async ({ page, request }) => {
    const order = await createOrderViaApi(request);
    await cancelOrderViaApi(request, order);

    await page.goto("/#/orders");
    await page.getByLabel("Status").click();
    await page.getByRole("option", { name: "CANCELLED" }).click();
    const row = page.getByRole("row").filter({ hasText: order.number });
    await expect(row.getByText("CANCELLED", { exact: true })).toBeVisible({ timeout: 15000 });
    await row.getByText(order.number).click();
    await expect(page).toHaveURL(/#\/orders\/\d+\/show/);

    await expect(page.getByRole("heading", { name: `Order ${order.number}`, level: 5 })).toBeVisible();
    await expect(page.getByText("Cancelled by customer")).toBeVisible();
    await expect(page.getByText("CANCELLED", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Mark as / })).toHaveCount(0);
  });

  // Partial check of Qase 140 on any backend; the case is linked to the exact test in revenue-window.spec.ts.
  test("dashboard revenue leaves out an order the customer cancelled", async ({ page, request }) => {
    const order = await createOrderViaApi(request);

    // loginAsAdmin already loaded the dashboard before this order existed; refresh it,
    // and compare the card only with the sum of the exact orders that response held
    // (its 100 most recent), so orders other tests or runs write don't matter. The
    // exact before/after arithmetic lives in revenue-window.spec.ts (isolated backend).
    const before = await refreshDashboard(page);
    expect(before).toContainEqual(expect.objectContaining({ number: order.number, status: "NEW" }));
    await expect(page.getByTestId("recent-revenue")).toContainText(amd(revenueOf(before)), { timeout: 15000 });

    await cancelOrderViaApi(request, order);
    const after = await refreshDashboard(page);

    expect(after).toContainEqual(expect.objectContaining({ number: order.number, status: "CANCELLED" }));
    await expect(page.getByTestId("recent-revenue")).toContainText(amd(revenueOf(after)));
  });

  // Partial check of Qase 141 on any backend; the case is linked to the exact test in revenue-window.spec.ts.
  test("dashboard revenue leaves out an order the kitchen rejected", async ({ page, request }) => {
    const order = await createOrderViaApi(request);
    const before = await refreshDashboard(page);
    expect(before).toContainEqual(expect.objectContaining({ number: order.number, status: "NEW" }));
    await expect(page.getByTestId("recent-revenue")).toContainText(amd(revenueOf(before)), { timeout: 15000 });

    await setStatusViaAdminApi(request, order.number, "REJECTED");
    const after = await refreshDashboard(page);

    expect(after).toContainEqual(expect.objectContaining({ number: order.number, status: "REJECTED" }));
    await expect(page.getByTestId("recent-revenue")).toContainText(amd(revenueOf(after)));
  });

  // qase: 139
  test("status change on an order the customer cancelled meanwhile shows the reason", async ({
    page,
    request,
  }) => {
    const order = await createOrderViaApi(request);
    await page.goto("/#/orders");
    await page.getByRole("button", { name: "Refresh" }).click();
    await page.getByRole("row").filter({ hasText: order.number }).getByText(order.number).click();
    await expect(page.getByRole("heading", { name: `Order ${order.number}`, level: 5 })).toBeVisible();
    await expect(page.getByText("NEW", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark as ACCEPTED" })).toBeVisible();

    await cancelOrderViaApi(request, order);
    await page.getByRole("button", { name: "Mark as ACCEPTED" }).click();

    await expect(page.getByText("Order was cancelled by the customer and can't be changed.")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("Cancelled by customer")).toBeVisible();
    await expect(page.getByText("CANCELLED", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Mark as / })).toHaveCount(0);
  });

  test("sidebar navigates between resources", async ({ page }) => {
    await page.goto("/#/orders");
    await page.getByRole("menuitem", { name: "Chefs" }).click();
    await expect(page).toHaveURL(/#\/chefs/);
    await page.getByRole("menuitem", { name: "Dishes" }).click();
    await expect(page).toHaveURL(/#\/dishes/);
    await page.getByRole("menuitem", { name: "Orders" }).click();
    await expect(page).toHaveURL(/#\/orders/);
  });
});
