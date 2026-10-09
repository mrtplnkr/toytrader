import { Page } from "@playwright/test";

export interface TestUser {
  email: string;
  displayName: string;
}

/**
 * Signs in through the Firebase Auth Emulator's fake Google IDP widget - a
 * real popup served by the emulator (http://127.0.0.1:9099/emulator/auth/...),
 * not a mock we control. Selectors below (#add-account-button, #email-input,
 * #display-name-input, #sign-in) are the emulator's own widget IDs.
 */
export async function signInWithFakeGoogle(page: Page, user: TestUser) {
  await page.goto("/login");

  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    page.click("text=Google login"),
  ]);

  // The emulator's fake-IDP widget renders its controls via its own JS after
  // the initial document loads - domcontentloaded alone doesn't guarantee
  // #add-account-button exists yet. Wait for it explicitly rather than
  // relying on click()'s default actionability timeout to cover a possibly
  // slow-starting popup under load.
  await popup.waitForLoadState("domcontentloaded");
  await popup.locator("#add-account-button").waitFor({ state: "visible", timeout: 20_000 });
  await popup.click("#add-account-button");
  await popup.fill("#email-input", user.email);
  await popup.fill("#display-name-input", user.displayName);
  await popup.click("#sign-in");

  await page.waitForURL("**/list", { timeout: 20_000 });
}
