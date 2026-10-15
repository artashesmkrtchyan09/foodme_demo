import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { registerCustomerViaApi } from "./auth";

const API = process.env.VITE_API_BASE_URL || "http://localhost:8081";
const PASSWORD = "secret123"; // registerCustomerViaApi's password

// Preconditions (customers, orders, kitchen status changes) go through the API; the
// UI part of each test is only the cancel behaviour under test.
type Dish = { chefId: number; id: number; minimumOrderCount?: number };

async function findDishViaApi(request: APIRequestContext): Promise<Dish> {
  const chefs = await (await request.get(`${API}/api/chef/active?page=0&size=12`)).json();
  const chef = chefs.exploreChefResponseDtoList[0];
  const detail = await (await request.get(`${API}/api/chef/${chef.id}`)).json();
  return { ...detail.dishes[0], chefId: chef.id };
}

// Pass `dish` when placing several orders, so the chef lookup isn't repeated.
async function placeOrderViaApi(request: APIRequestContext, token: string, dish?: Dish) {
  const { chefId, id, minimumOrderCount } = dish ?? (await findDishViaApi(request));
  const res = await request.post(`${API}/api/order`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      chefId,
      receiverName: "Cancel E2E",
      receiverPhoneNumber: "+37490000000",
      receiverEmail: "cancel-e2e@example.com",
      paymentType: "CASH",
      deliveryMethod: "TAKEAWAY",
      note: "",
      createOrderDishes: [{ dishId: id, quantity: minimumOrderCount || 1 }],
    },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).number as string;
}

async function cancelOrderViaApi(request: APIRequestContext, token: string, number: string) {
  const res = await request.post(`${API}/api/customer/orders/${number}/cancel`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok()).toBeTruthy();
}

async function adminTokenViaApi(request: APIRequestContext): Promise<string> {
  const login = await request.post(`${API}/admin/auth/login`, {
    data: { username: "admin", password: "admin123" },
  });
  expect(login.ok()).toBeTruthy();
  return (await login.json()).token;
}

// The kitchen's side of the flow, done as the seeded back-office admin. Pass `token`
// when changing several orders, so the admin login isn't repeated.
async function setStatusViaAdminApi(
  request: APIRequestContext,
  number: string,
  status: "ACCEPTED" | "DELIVERED" | "REJECTED",
  token?: string,
) {
  token ??= await adminTokenViaApi(request);
  const order = await (await request.get(`${API}/api/order/number/${number}`)).json();
  const res = await request.patch(`${API}/admin/order/${order.id}/status`, {
    headers: { Authorization: `Bearer ${token}` },
    data: status === "REJECTED" ? { status, rejectReason: "Out of stock" } : { status },
  });
  expect(res.ok()).toBeTruthy();
}

async function signIn(page: Page, email: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  const form = page.getByRole("form", { name: "Sign in" });
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Password").fill(PASSWORD);
  await form.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`${next}$`));
}

async function confirmCancel(page: Page, number: string) {
  const dialog = page.getByRole("dialog", { name: `Cancel order ${number}?` });
  await expect(dialog).toBeVisible();
  const cancelResponse = page.waitForResponse((r) => r.url().includes(`/orders/${number}/cancel`));
  await dialog.getByRole("button", { name: "Cancel order" }).click();
  await cancelResponse;
  await expect(dialog).toBeHidden();
}

function orderRow(page: Page, number: string) {
  return page.getByRole("listitem").filter({ hasText: number });
}

async function expectProgressSteps(page: Page) {
  for (const step of ["Received", "Preparing", "Delivered"]) {
    await expect(page.getByRole("main").getByRole("listitem").filter({ hasText: step })).toBeVisible();
  }
}

// On mobile the case also checks that the controls fit the screen without
// horizontal scrolling.
async function cancelsFromMyOrders(page: Page, request: APIRequestContext, mobile = false) {
  const { token, email } = await registerCustomerViaApi(request, API);
  const number = await placeOrderViaApi(request, token);
  await signIn(page, email, "/orders");

  const row = orderRow(page, number);
  const cancelButton = row.getByRole("button", { name: "Cancel order" });
  await expect(row.getByText("Received", { exact: true })).toBeVisible();
  await expect(cancelButton).toBeVisible();
  if (mobile) {
    await expect(cancelButton).toBeInViewport({ ratio: 1 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      .toBe(true);
  }
  await cancelButton.click();
  if (mobile) {
    const dialog = page.getByRole("dialog", { name: `Cancel order ${number}?` });
    await expect(dialog.getByRole("button", { name: "Keep order" })).toBeInViewport({ ratio: 1 });
    await expect(dialog.getByRole("button", { name: "Cancel order" })).toBeInViewport({ ratio: 1 });
  }
  await confirmCancel(page, number);

  await expect(row.getByText("Cancelled", { exact: true })).toBeVisible();
  await expect(row.getByRole("button", { name: "Cancel order" })).toHaveCount(0);

  await page.reload();
  const reloaded = orderRow(page, number);
  await expect(reloaded.getByText("Cancelled", { exact: true })).toBeVisible();
  await expect(reloaded.getByRole("button", { name: "Cancel order" })).toHaveCount(0);
}

test.describe("Cancel order", () => {
  test.describe("desktop", () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    // qase: 111
    test("customer cancels a received order from My Orders (desktop)", async ({ page, request }) => {
      await cancelsFromMyOrders(page, request);
    });
  });

  test.describe("mobile", () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    // qase: 112
    test("customer cancels a received order from My Orders (mobile)", async ({ page, request }) => {
      await cancelsFromMyOrders(page, request, true);
    });
  });

  // qase: 113
  test("cancel confirmation names the order and offers keep and cancel", async ({ page, request }) => {
    const { token, email } = await registerCustomerViaApi(request, API);
    const number = await placeOrderViaApi(request, token);
    await signIn(page, email, "/orders");

    const row = orderRow(page, number);
    await expect(row.getByText("Received", { exact: true })).toBeVisible();
    await row.getByRole("button", { name: "Cancel order" }).click();

    const dialog = page.getByRole("dialog", { name: `Cancel order ${number}?` });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("This can't be undone.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Keep order" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Cancel order" })).toBeVisible();
  });

  // qase: 114
  test("keep order closes the dialog and leaves the order received", async ({ page, request }) => {
    const { token, email } = await registerCustomerViaApi(request, API);
    const number = await placeOrderViaApi(request, token);
    await signIn(page, email, "/orders");

    const row = orderRow(page, number);
    await expect(row.getByText("Received", { exact: true })).toBeVisible();
    await row.getByRole("button", { name: "Cancel order" }).click();
    const dialog = page.getByRole("dialog", { name: `Cancel order ${number}?` });
    await dialog.getByRole("button", { name: "Keep order" }).click();

    await expect(dialog).toBeHidden();
    await expect(row.getByText("Received", { exact: true })).toBeVisible();
    await expect(row.getByRole("button", { name: "Cancel order" })).toBeVisible();

    await page.reload();
    await expect(orderRow(page, number).getByText("Received", { exact: true })).toBeVisible();
  });

  // qase: 116
  test("tracking page explains a cancelled order", async ({ page, request }) => {
    const { token, email } = await registerCustomerViaApi(request, API);
    const number = await placeOrderViaApi(request, token);
    await cancelOrderViaApi(request, token, number);
    await signIn(page, email, "/orders");

    await page.goto(`/tracking/${number}`);

    await expect(page.getByText("Cancelled", { exact: true })).toBeVisible();
    await expect(page.getByText("You cancelled this order before the kitchen accepted it.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);
  });

  // qase: 117
  test("tracking page shows no progress steps for a cancelled order", async ({ page, request }) => {
    const { token, email } = await registerCustomerViaApi(request, API);
    const number = await placeOrderViaApi(request, token);
    await cancelOrderViaApi(request, token, number);
    await signIn(page, email, "/orders");

    await page.goto(`/tracking/${number}`);

    await expect(page.getByText("Cancelled", { exact: true })).toBeVisible();
    await expect(page.getByText("You cancelled this order before the kitchen accepted it.")).toBeVisible();
    for (const step of ["Received", "Preparing", "Delivered"]) {
      await expect(page.getByRole("main").getByText(step, { exact: true })).toHaveCount(0);
    }
  });

  // qase: 118
  test("customer cancels from the tracking page", async ({ page, request }) => {
    const { token, email } = await registerCustomerViaApi(request, API);
    const number = await placeOrderViaApi(request, token);
    await signIn(page, email, "/orders");
    await page.goto(`/tracking/${number}`);

    await expect(page.getByText("Order received")).toBeVisible();
    await expectProgressSteps(page);
    await page.getByRole("button", { name: "Cancel order" }).click();
    await confirmCancel(page, number);

    await expect(page.getByText("Cancelled", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);
  });

  // qase: 119
  test("tracking page offers no cancel to a signed-out visitor", async ({ page, request }) => {
    const { token } = await registerCustomerViaApi(request, API);
    const number = await placeOrderViaApi(request, token);

    await page.goto(`/tracking/${number}`);

    await expect(page.getByText("Order received")).toBeVisible();
    await expectProgressSteps(page);
    await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);
  });

  // qase: 120
  test("tracking page offers no cancel once the kitchen accepted the order", async ({ page, request }) => {
    const { token, email } = await registerCustomerViaApi(request, API);
    const number = await placeOrderViaApi(request, token);
    await setStatusViaAdminApi(request, number, "ACCEPTED");
    await signIn(page, email, "/orders");

    await page.goto(`/tracking/${number}`);

    await expect(page.getByText("Preparing your order")).toBeVisible();
    await expectProgressSteps(page);
    // The active step is marked with aria-current="step" on its icon; there is no
    // role-based query for aria-current, so match the step that contains it.
    await expect(
      page.getByRole("main").getByRole("listitem").filter({ has: page.locator('[aria-current="step"]') }),
    ).toHaveText("Preparing");
    await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);
  });

  // qase: 121
  test("My Orders offers cancel only on received orders", async ({ page, request }) => {
    // Six orders and their status changes cost ~30 API calls, each with 200–1500 ms of
    // simulated latency, so the independent ones run in parallel; only
    // ACCEPTED → DELIVERED has to happen in order.
    const { token, email } = await registerCustomerViaApi(request, API);
    const [dish, adminToken] = await Promise.all([findDishViaApi(request), adminTokenViaApi(request)]);
    const [received, alsoReceived, preparing, delivered, declined, cancelled] = await Promise.all(
      Array.from({ length: 6 }, () => placeOrderViaApi(request, token, dish)),
    );
    await Promise.all([
      setStatusViaAdminApi(request, preparing, "ACCEPTED", adminToken),
      setStatusViaAdminApi(request, delivered, "ACCEPTED", adminToken).then(() =>
        setStatusViaAdminApi(request, delivered, "DELIVERED", adminToken),
      ),
      setStatusViaAdminApi(request, declined, "REJECTED", adminToken),
      cancelOrderViaApi(request, token, cancelled),
    ]);

    await signIn(page, email, "/orders");

    const expected: [string, string, number][] = [
      [received, "Received", 1],
      [alsoReceived, "Received", 1],
      [preparing, "Preparing", 0],
      [delivered, "Delivered", 0],
      [declined, "Declined", 0],
      [cancelled, "Cancelled", 0],
    ];
    for (const [number, label, buttons] of expected) {
      const row = orderRow(page, number);
      await expect(row.getByText(label, { exact: true })).toBeVisible();
      await expect(row.getByRole("button", { name: "Cancel order" })).toHaveCount(buttons);
    }
  });

  // qase: 122
  test("another customer is refused when cancelling from the tracking page", async ({ page, request }) => {
    const owner = await registerCustomerViaApi(request, API);
    const number = await placeOrderViaApi(request, owner.token);
    const other = await registerCustomerViaApi(request, API);
    await signIn(page, other.email, "/orders");
    await page.goto(`/tracking/${number}`);

    await expect(page.getByText("Order received")).toBeVisible();
    await page.getByRole("button", { name: "Cancel order" }).click();
    await confirmCancel(page, number);

    await expect(page.getByRole("alert")).toHaveText("Only the customer who placed this order can cancel it.");
    await expect(page.getByText("Order received")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Order received")).toBeVisible();
  });

  // qase: 123
  test("order accepted before the customer confirms shows the reason and its real status", async ({
    page,
    request,
  }) => {
    const { token, email } = await registerCustomerViaApi(request, API);
    const number = await placeOrderViaApi(request, token);
    await signIn(page, email, "/orders");

    const row = orderRow(page, number);
    await expect(row.getByText("Received", { exact: true })).toBeVisible();
    await row.getByRole("button", { name: "Cancel order" }).click();
    await setStatusViaAdminApi(request, number, "ACCEPTED");
    await confirmCancel(page, number);

    await expect(row.getByRole("alert")).toHaveText("Only new orders can be cancelled.");
    await expect(row.getByText("Preparing", { exact: true })).toBeVisible();
    await expect(row.getByRole("button", { name: "Cancel order" })).toHaveCount(0);
  });
});
