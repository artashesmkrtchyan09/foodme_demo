import { test, expect, type Page } from "@playwright/test";
import { registerCustomerViaApi } from "./auth";
import { API, markDeliveredViaApi, placeOrderViaApi, signInToOrders } from "./orders";

function orderCard(page: Page, number: string) {
  return page.getByTestId("order-card").filter({ hasText: number });
}

test.describe("Order ratings", () => {
  test("customer rates a delivered order and still sees the rating after reload", async ({
    page,
    request,
  }) => {
    const { token, email } = await registerCustomerViaApi(request, API);
    const number = await placeOrderViaApi(request, token);
    await markDeliveredViaApi(request, number);

    await signInToOrders(page, email);
    const card = orderCard(page, number);
    await card.getByRole("button", { name: "Rate order" }).click();

    const dialog = page.getByRole("dialog", { name: `Rate order ${number}` });
    await expect(dialog.getByPlaceholder("Tell us about your order")).toBeVisible();
    await dialog.getByRole("radio", { name: "4 stars" }).click();
    await dialog.getByLabel("Comment (optional)").fill("Warm and tasty");
    await dialog.getByRole("button", { name: "Submit rating" }).click();

    await expect(dialog).toBeHidden();
    await expect(card.getByRole("img", { name: "Rated 4 out of 5 stars" })).toBeVisible();
    await expect(card.getByRole("button", { name: "Rate order" })).toHaveCount(0);

    await page.reload();
    await expect(orderCard(page, number).getByRole("img", { name: "Rated 4 out of 5 stars" })).toBeVisible();

    await orderCard(page, number).getByRole("link").click();
    await expect(page).toHaveURL(new RegExp(`/tracking/${number}$`));
    const review = page.getByRole("region", { name: "Your rating" });
    await expect(review.getByRole("img", { name: "Rated 4 out of 5 stars" })).toBeVisible();
    await expect(review.getByText("Warm and tasty")).toBeVisible();
  });

  test("stars can be chosen with the keyboard", async ({ page, request }) => {
    const { token, email } = await registerCustomerViaApi(request, API);
    const number = await placeOrderViaApi(request, token);
    await markDeliveredViaApi(request, number);

    await signInToOrders(page, email);
    await orderCard(page, number).getByRole("button", { name: "Rate order" }).click();
    const dialog = page.getByRole("dialog", { name: `Rate order ${number}` });

    // The window opens with focus on the first star.
    await expect(dialog.getByRole("radio", { name: "1 star", exact: true })).toBeFocused();
    // Radix selects the star that receives focus only while the arrow key is still down, and it
    // moves focus on a timer, so hold each key briefly the way a person does.
    await page.keyboard.press("ArrowRight", { delay: 100 });
    await expect(dialog.getByRole("radio", { name: "2 stars" })).toBeChecked();
    await page.keyboard.press("ArrowRight", { delay: 100 });
    await expect(dialog.getByRole("radio", { name: "3 stars" })).toBeChecked();

    await dialog.getByRole("button", { name: "Submit rating" }).click();
    await expect(dialog).toBeHidden();
    await expect(
      orderCard(page, number).getByRole("img", { name: "Rated 3 out of 5 stars" }),
    ).toBeVisible();
  });

  test("order that isn't delivered has no rating option", async ({ page, request }) => {
    const { token, email } = await registerCustomerViaApi(request, API);
    const number = await placeOrderViaApi(request, token);

    await signInToOrders(page, email);
    const card = orderCard(page, number);
    await expect(card).toBeVisible();
    await expect(card.getByRole("button", { name: "Rate order" })).toHaveCount(0);
  });

  test("submitting without stars asks for a rating", async ({ page, request }) => {
    const { token, email } = await registerCustomerViaApi(request, API);
    const number = await placeOrderViaApi(request, token);
    await markDeliveredViaApi(request, number);

    await signInToOrders(page, email);
    await orderCard(page, number).getByRole("button", { name: "Rate order" }).click();
    const dialog = page.getByRole("dialog", { name: `Rate order ${number}` });
    await dialog.getByRole("button", { name: "Submit rating" }).click();

    await expect(dialog.getByText("Choose a rating")).toBeVisible();
    await expect(dialog).toBeVisible();
  });

  test("rating that can't be saved shows the reason and keeps the window open", async ({
    page,
    request,
  }) => {
    const { token, email } = await registerCustomerViaApi(request, API);
    const number = await placeOrderViaApi(request, token);
    await markDeliveredViaApi(request, number);

    await signInToOrders(page, email);
    await orderCard(page, number).getByRole("button", { name: "Rate order" }).click();
    const dialog = page.getByRole("dialog", { name: `Rate order ${number}` });

    // The order gets rated elsewhere (another tab) while this window is open.
    const other = await request.post(`${API}/api/customer/orders/${number}/review`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { stars: 5 },
    });
    expect(other.ok()).toBeTruthy();

    await dialog.getByRole("radio", { name: "2 stars" }).click();
    await dialog.getByRole("button", { name: "Submit rating" }).click();

    await expect(dialog.getByRole("alert")).toHaveText("Order already reviewed.");
    await expect(dialog.getByRole("button", { name: "Submit rating" })).toBeEnabled();
  });
});
