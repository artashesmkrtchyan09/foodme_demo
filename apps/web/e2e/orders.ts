import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const API = process.env.VITE_API_BASE_URL || "http://localhost:8081";

/** Places a takeaway CASH order for the first active chef's first dish. Returns the order number. */
export async function placeOrderViaApi(request: APIRequestContext, token: string) {
  const chefs = await (await request.get(`${API}/api/chef/active?page=0&size=12`)).json();
  const chef = chefs.exploreChefResponseDtoList[0];
  const detail = await (await request.get(`${API}/api/chef/${chef.id}`)).json();
  const dish = detail.dishes[0];

  const res = await request.post(`${API}/api/order`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      chefId: chef.id,
      receiverName: "E2E Customer",
      receiverPhoneNumber: "+37490000000",
      receiverEmail: "e2e-ratings@example.com",
      paymentType: "CASH",
      deliveryMethod: "TAKEAWAY",
      createOrderDishes: [{ dishId: dish.id, quantity: dish.minimumOrderCount ?? 1 }],
    },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).number as string;
}

/**
 * Moves an order NEW → ACCEPTED → DELIVERED. Only the back office can do this, so the
 * precondition goes through the admin API; nothing about the back office is asserted here.
 */
export async function markDeliveredViaApi(request: APIRequestContext, number: string) {
  const login = await request.post(`${API}/admin/auth/login`, {
    data: { username: "admin", password: "admin123" },
  });
  expect(login.ok()).toBeTruthy();
  const { token } = await login.json();
  const order = await (await request.get(`${API}/api/order/number/${number}`)).json();

  for (const status of ["ACCEPTED", "DELIVERED"]) {
    const res = await request.patch(`${API}/admin/order/${order.id}/status`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { status },
    });
    expect(res.ok()).toBeTruthy();
  }
}

/** Signs in through the storefront form and lands on the order history. */
export async function signInToOrders(page: Page, email: string, password = "secret123") {
  await page.goto("/login?next=/orders");
  const form = page.getByRole("form", { name: "Sign in" });
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Password").fill(password);
  await form.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Your orders" })).toBeVisible();
}
