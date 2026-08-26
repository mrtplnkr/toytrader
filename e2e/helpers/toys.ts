import { Page } from "@playwright/test";

/**
 * Lists a new toy via /addNew: fills the title, uploads a fixture image to
 * the Storage emulator, waits for the upload preview, and submits.
 */
export async function addToy(page: Page, title: string, filePath: string) {
  await page.goto("/addNew");
  await page.fill("#title", title);
  await page.setInputFiles("#picture", filePath);
  await page.waitForSelector('img[alt="newImg"]');
  await page.getByRole("button", { name: "Add" }).click();
  await page.waitForURL("**/myToys");
}
