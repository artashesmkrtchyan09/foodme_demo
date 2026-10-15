// Helpers shared by the admin specs: admin sign-in, orders created through the
// public API, and the dashboard's revenue window.
import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const API = process.env.VITE_API_BASE_URL || "http://localhost:8081";

export async function loginAsAdmin(page: Page) {
  await page.goto("/#/login");
  await expect(page.getByRole("heading", { name: "FoodMe Admin" })).toBeVisible();
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("admin123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("menuitem", { name: "Orders" })).toBeVisible({ timeout: 15000 });
}

export async function createOrderViaApi(request: APIRequestContext) {
  const chefs = await (await request.get(`${API}/api/chef/active?page=0&size=12`)).json();
  const chef = chefs.exploreChefResponseDtoList[0];
  const detail = await (await request.get(`${API}/api/chef/${chef.id}`)).json();
  const dish = detail.dishes[0];
  const email = `admin-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
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
  return {
    ...(await createRes.json()),
    customerToken: token as string,
    chefId: chef.id as number,
    dishId: dish.id as number,
  };
}

export type ApiOrder = { number: string; totalPrice: number; customerToken: string; chefId: number; dishId: number };
export type ListedOrder = { number: string; status: string; totalPrice: number };

// Places `count` more orders for the same customer, chef and dish, all newer than
// `after`. Sent in parallel batches so that filling the dashboard's 100-order window
// stays well inside the test timeout under the backend's simulated latency.
export async function placeMoreOrdersViaApi(
  request: APIRequestContext,
  after: ApiOrder,
  count: number,
  quantity = 1,
) {
  const placed: { number: string; totalPrice: number }[] = [];
  for (let start = 0; start < count; start += 25) {
    const batch = Array.from({ length: Math.min(25, count - start) }, () =>
      request.post(`${API}/api/order`, {
        headers: { Authorization: `Bearer ${after.customerToken}` },
        data: {
          chefId: after.chefId,
          receiverName: "Admin E2E",
          receiverPhoneNumber: "+37495555666",
          receiverEmail: "admin-e2e@example.com",
          paymentType: "CASH",
          deliveryMethod: "TAKEAWAY",
          note: "admin e2e order",
          createOrderDishes: [{ dishId: after.dishId, quantity }],
        },
      }),
    );
    for (const res of await Promise.all(batch)) {
      expect(res.ok()).toBeTruthy();
      placed.push(await res.json());
    }
  }
  return placed;
}

export async function setStatusViaAdminApi(
  request: APIRequestContext,
  number: string,
  status: "ACCEPTED" | "REJECTED",
) {
  const login = await request.post(`${API}/admin/auth/login`, {
    data: { username: "admin", password: "admin123" },
  });
  expect(login.ok()).toBeTruthy();
  const { token } = await login.json();
  const order = await (await request.get(`${API}/api/order/number/${number}`)).json();
  const res = await request.patch(`${API}/admin/order/${order.id}/status`, {
    headers: { Authorization: `Bearer ${token}` },
    data: status === "REJECTED" ? { status, rejectReason: "Out of stock" } : { status },
  });
  expect(res.ok()).toBeTruthy();
}

// Reloads the dashboard and returns the orders its "Recent revenue" is summed over
// (the 100 most recent, newest first), as the dashboard itself received them.
export async function refreshDashboard(page: Page): Promise<ListedOrder[]> {
  await page.goto("/#/");
  // Let the dashboard's own first load finish (the card shows a skeleton until then),
  // so the response waited for below can only be the one the Refresh click triggers,
  // never a request sent before the test created its orders.
  await expect(page.getByTestId("recent-revenue")).toContainText("AMD", { timeout: 15000 });
  const recentResponse = page.waitForResponse(
    (r) => r.url().includes("/admin/order?") && r.url().includes("size=100") && r.ok(),
  );
  await page.getByRole("button", { name: "Refresh" }).click();
  return (await (await recentResponse).json()).list;
}

export function revenueOf(orders: ListedOrder[]) {
  return orders
    .filter((o) => o.status !== "CANCELLED" && o.status !== "REJECTED")
    .reduce((sum, o) => sum + (o.totalPrice ?? 0), 0);
}

export function amd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "AMD",
    maximumFractionDigits: 0,
  }).format(value);
}

export async function cancelOrderViaApi(
  request: APIRequestContext,
  order: { number: string; customerToken: string },
) {
  const res = await request.post(`${API}/api/customer/orders/${order.number}/cancel`, {
    headers: { Authorization: `Bearer ${order.customerToken}` },
  });
  expect(res.ok()).toBeTruthy();
}

