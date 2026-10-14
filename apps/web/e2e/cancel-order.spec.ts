import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { registerCustomerViaApi } from "./auth";

const API = process.env.VITE_API_BASE_URL || "http://localhost:8081";
const PASSWORD = "secret123"; // registerCustomerViaApi's password

// Preconditions (customer, order, kitchen accepting) go through the API; the UI
// part of each test is only the cancel behaviour under test.
async function placeOrderViaApi(request: APIRequestContext, token: string) {
  const chefs = await (await request.get(`${API}/api/chef/active?page=0&size=12`)).json();
  const chef = chefs.exploreChefResponseDtoList[0];
  const detail = await (await request.get(`${API}/api/chef/${chef.id}`)).json();
  const dish = detail.dishes[0];
  const res = await request.post(`${API}/api/order`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      chefId: chef.id,
      receiverName: "Cancel E2E",
      receiverPhoneNumber: "+37490000000",
      receiverEmail: "cancel-e2e@example.com",
      paymentType: "CASH",
      deliveryMethod: "TAKEAWAY",
      note: "",
      createOrderDishes: [{ dishId: dish.id, quantity: dish.minimumOrderCount || 1 }],
    },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).number as string;
}

async function acceptOrderViaAdminApi(request: APIRequestContext, number: string) {
  const login = await request.post(`${API}/admin/auth/login`, {
    data: { username: "admin", password: "admin123" },
  });
  expect(login.ok()).toBeTruthy();
  const { token } = await login.json();
  const order = await (await request.get(`${API}/api/order/number/${number}`)).json();
  const res = await request.patch(`${API}/admin/order/${order.id}/status`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { status: "ACCEPTED" },
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
  await expect(dialog.getByText("This can't be undone.")).toBeVisible();
  const cancelResponse = page.waitForResponse((r) => r.url().includes(`/orders/${number}/cancel`));
  await dialog.getByRole("button", { name: "Cancel order" }).click();
  await cancelResponse;
  await expect(dialog).toBeHidden();
}

const VIEWPORTS = [
  { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
  {
    name: "mobile",
    use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  },
];

test.describe("Cancel order", () => {
  for (const { name, use } of VIEWPORTS) {
    test.describe(name, () => {
      test.use(use);

      test(`customer cancels a received order from My Orders (${name})`, async ({ page, request }) => {
        const { token, email } = await registerCustomerViaApi(request, API);
        const number = await placeOrderViaApi(request, token);
        await signIn(page, email, "/orders");

        const row = page.getByRole("listitem").filter({ hasText: number });
        await expect(row.getByText("Received")).toBeVisible();
        await row.getByRole("button", { name: "Cancel order" }).click();
        await confirmCancel(page, number);

        await expect(row.getByText("Cancelled", { exact: true })).toBeVisible();
        await expect(row.getByRole("button", { name: "Cancel order" })).toHaveCount(0);
      });
    });
  }

  test("keep order closes the dialog and leaves the order received", async ({ page, request }) => {
    const { token, email } = await registerCustomerViaApi(request, API);
    const number = await placeOrderViaApi(request, token);
    await signIn(page, email, "/orders");

    const row = page.getByRole("listitem").filter({ hasText: number });
    await row.getByRole("button", { name: "Cancel order" }).click();
    const dialog = page.getByRole("dialog", { name: `Cancel order ${number}?` });
    await dialog.getByRole("button", { name: "Keep order" }).click();

    await expect(dialog).toBeHidden();
    await expect(row.getByText("Received")).toBeVisible();
    await expect(row.getByRole("button", { name: "Cancel order" })).toBeVisible();
  });

  test("order accepted before the customer confirms shows the reason and its real status", async ({
    page,
    request,
  }) => {
    const { token, email } = await registerCustomerViaApi(request, API);
    const number = await placeOrderViaApi(request, token);
    await signIn(page, email, "/orders");

    const row = page.getByRole("listitem").filter({ hasText: number });
    await row.getByRole("button", { name: "Cancel order" }).click();
    await acceptOrderViaAdminApi(request, number);
    await confirmCancel(page, number);

    await expect(row.getByRole("alert")).toHaveText("Only new orders can be cancelled.");
    await expect(row.getByText("Preparing")).toBeVisible();
    await expect(row.getByRole("button", { name: "Cancel order" })).toHaveCount(0);
  });

  test("customer cancels from the tracking page and the progress bar is gone", async ({
    page,
    request,
  }) => {
    const { token, email } = await registerCustomerViaApi(request, API);
    const number = await placeOrderViaApi(request, token);
    await signIn(page, email, "/orders");
    await page.goto(`/tracking/${number}`);

    await expect(page.getByText("Order received")).toBeVisible();
    await page.getByRole("button", { name: "Cancel order" }).click();
    await confirmCancel(page, number);

    await expect(page.getByText("You cancelled this order before the kitchen accepted it.")).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "Preparing" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);
  });

  test("tracking page offers no cancel to a signed-out visitor", async ({ page, request }) => {
    const { token } = await registerCustomerViaApi(request, API);
    const number = await placeOrderViaApi(request, token);

    await page.goto(`/tracking/${number}`);

    await expect(page.getByText("Order received")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);
  });
});
