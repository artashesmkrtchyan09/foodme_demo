import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { API, createOrderViaApi, loginAsAdmin } from "./helpers";

async function orderIdByNumber(request: APIRequestContext, number: string) {
  const res = await request.get(`${API}/api/order/number/${number}`);
  expect(res.ok()).toBeTruthy();
  return (await res.json()).id as number;
}

async function markDeliveredViaApi(request: APIRequestContext, orderId: number) {
  const login = await request.post(`${API}/admin/auth/login`, {
    data: { username: "admin", password: "admin123" },
  });
  expect(login.ok()).toBeTruthy();
  const { token } = await login.json();
  for (const status of ["ACCEPTED", "DELIVERED"]) {
    const res = await request.patch(`${API}/admin/order/${orderId}/status`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { status },
    });
    expect(res.ok()).toBeTruthy();
  }
}

async function openOrder(page: Page, orderId: number, number: string) {
  await page.goto(`/#/orders/${orderId}/show`);
  await expect(page.getByRole("heading", { name: `Order ${number}`, level: 5 })).toBeVisible();
}

test.describe("Order reviews", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("rated order shows the customer review on its page and in the list", async ({
    page,
    request,
  }) => {
    const order = await createOrderViaApi(request);
    const orderId = await orderIdByNumber(request, order.number);
    await markDeliveredViaApi(request, orderId);
    const review = await request.post(`${API}/api/customer/orders/${order.number}/review`, {
      headers: { Authorization: `Bearer ${order.customerToken}` },
      data: { stars: 2, comment: "Arrived cold" },
    });
    expect(review.ok()).toBeTruthy();

    await openOrder(page, orderId, order.number);
    const section = page.getByRole("region", { name: "Customer review" });
    await expect(section.getByRole("img", { name: "Rated 2 out of 5 stars" })).toBeVisible();
    await expect(section.getByText("Arrived cold")).toBeVisible();
    await expect(section.getByText("No review yet")).toHaveCount(0);

    await page.goto("/#/orders");
    await page.getByRole("button", { name: "Refresh" }).click();
    const row = page.getByRole("row").filter({ hasText: order.number });
    await expect(row.getByRole("img", { name: "Rated 2 out of 5 stars" })).toBeVisible({
      timeout: 15000,
    });
  });

  test("delivered order without a review says No review yet", async ({ page, request }) => {
    const order = await createOrderViaApi(request);
    const orderId = await orderIdByNumber(request, order.number);
    await markDeliveredViaApi(request, orderId);

    await openOrder(page, orderId, order.number);
    const section = page.getByRole("region", { name: "Customer review" });
    await expect(section.getByText("No review yet")).toBeVisible();
  });

  test("order that isn't delivered has no customer review section", async ({ page, request }) => {
    const order = await createOrderViaApi(request);
    const orderId = await orderIdByNumber(request, order.number);

    await openOrder(page, orderId, order.number);
    await expect(page.getByRole("button", { name: "Mark as ACCEPTED" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Customer review" })).toHaveCount(0);
  });
});
