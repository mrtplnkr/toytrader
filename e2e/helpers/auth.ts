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

  await popup.waitForLoadState("domcontentloaded");
  await popup.click("#add-account-button");
  await popup.fill("#email-input", user.email);
  await popup.fill("#display-name-input", user.displayName);
  await popup.click("#sign-in");

  await page.waitForURL("**/list");
}
