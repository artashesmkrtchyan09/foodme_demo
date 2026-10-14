import { test, expect, type Page } from "@playwright/test";

const API = process.env.VITE_API_BASE_URL || "http://localhost:8081";

async function loginAsAdmin(page: Page) {
  await page.goto("/#/login");
  await expect(page.getByRole("heading", { name: "FoodMe Admin" })).toBeVisible();
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("admin123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("menuitem", { name: "Orders" })).toBeVisible({ timeout: 15000 });
}

async function createOrderViaApi(request: import("@playwright/test").APIRequestContext) {
  const chefs = await (await request.get(`${API}/api/chef/active?page=0&size=12`)).json();
  const chef = chefs.exploreChefResponseDtoList[0];
  const detail = await (await request.get(`${API}/api/chef/${chef.id}`)).json();
  const dish = detail.dishes[0];
  const email = `admin-e2e-${Date.now()}@example.com`;
  const registerRes = await request.post(`${API}/api/auth/register`, {
    data: {
      fullName: "Admin E2E",
      email,
      phoneNumber: "+37495555666",
      password: "secret123",
    },
  });
  expect(registerRes.ok()).toBeTruthy();
  const { token } = await registerRes.json();
  const createRes = await request.post(`${API}/api/order`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      chefId: chef.id,
      receiverName: "Admin E2E",
      receiverPhoneNumber: "+37495555666",
      receiverEmail: "admin-e2e@example.com",
      paymentType: "CASH",
      deliveryMethod: "TAKEAWAY",
      note: "admin e2e order",
      createOrderDishes: [{ dishId: dish.id, quantity: 1 }],
    },
  });
  expect(createRes.ok()).toBeTruthy();
  return { ...(await createRes.json()), customerToken: token as string };
}

async function cancelOrderViaApi(
  request: import("@playwright/test").APIRequestContext,
  order: { number: string; customerToken: string },
) {
  const res = await request.post(`${API}/api/customer/orders/${order.number}/cancel`, {
    headers: { Authorization: `Bearer ${order.customerToken}` },
  });
  expect(res.ok()).toBeTruthy();
}

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

  test("status filter shows customer-cancelled orders", async ({ page, request }) => {
    const order = await createOrderViaApi(request);
    await cancelOrderViaApi(request, order);

    await page.goto("/#/orders");
    await page.getByLabel("Status").click();
    await page.getByRole("option", { name: "CANCELLED" }).click();
    await expect(page).toHaveURL(/CANCELLED/);

    const row = page.getByRole("row").filter({ hasText: order.number });
    await expect(row).toBeVisible({ timeout: 15000 });
    await expect(row.getByText("CANCELLED", { exact: true })).toBeVisible();
    await expect(page.getByRole("cell").getByText("NEW", { exact: true })).toHaveCount(0);
  });

  test("cancelled order shows the customer note and no status actions", async ({ page, request }) => {
    const order = await createOrderViaApi(request);
    await cancelOrderViaApi(request, order);

    await page.goto("/#/orders");
    await page.getByRole("button", { name: "Refresh" }).click();
    await page.getByText(order.number).click();
    await expect(page).toHaveURL(/#\/orders\/\d+\/show/);

    await expect(page.getByRole("heading", { name: `Order ${order.number}`, level: 5 })).toBeVisible();
    await expect(page.getByText("Cancelled by customer")).toBeVisible();
    await expect(page.getByText("CANCELLED", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Mark as / })).toHaveCount(0);
  });

  test("dashboard revenue leaves out cancelled and declined orders", async ({ page, request }) => {
    const order = await createOrderViaApi(request);
    await cancelOrderViaApi(request, order);

    // loginAsAdmin already loaded the dashboard before this order existed; refresh
    // it, and compute the expected sum from the exact orders the dashboard received
    // (its 100 most recent), so orders other tests create meanwhile don't matter.
    await page.goto("/#/");
    const recentResponse = page.waitForResponse(
      (r) => r.url().includes("/admin/order?") && r.url().includes("size=100") && r.ok(),
    );
    await page.getByRole("button", { name: "Refresh" }).click();
    const orders: { number: string; status: string; totalPrice: number }[] = (
      await (await recentResponse).json()
    ).list;
    expect(orders).toContainEqual(expect.objectContaining({ number: order.number, status: "CANCELLED" }));
    const expected = orders
      .filter((o) => o.status !== "CANCELLED" && o.status !== "REJECTED")
      .reduce((sum, o) => sum + (o.totalPrice ?? 0), 0);
    const formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "AMD",
      maximumFractionDigits: 0,
    }).format(expected);

    await expect(page.getByTestId("recent-revenue")).toContainText(formatted, { timeout: 15000 });
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
