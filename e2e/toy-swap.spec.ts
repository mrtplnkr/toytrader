import * as path from "path";
import { test, expect, Page } from "@playwright/test";
import { signInWithFakeGoogle } from "./helpers/auth";
import { addToy } from "./helpers/toys";
import { markShipmentPaid } from "./helpers/adminSeed";

const FIXTURE_IMAGE = path.join(__dirname, "fixtures", "toy.png");

async function registerOmnivaBarcode(page: Page, barcode: string) {
  // The picker is a search input backed by a custom (non-native-<select>)
  // results list fed by the real Functions emulator's listParcelMachines
  // (stub client, real public Omniva terminal data) - focusing it with an
  // empty filter shows every result, click the first one.
  const parcelMachineInput = page.getByPlaceholder("Search parcel machine by name or address...");
  await parcelMachineInput.click();
  const firstMachineOption = page.locator("ul li").first();
  await expect(firstMachineOption).toBeVisible();
  await firstMachineOption.click();

  await page.getByPlaceholder("Paste your Omniva barcode here").fill(barcode);
  await page.getByRole("button", { name: "Save my barcode" }).click();
  await expect(page.getByRole("button", { name: "View my QR code" })).toBeVisible();
}

test("two users trade toys: register with Omniva, ship, receive, and pay the service fee", async ({ browser }) => {
  const runId = Date.now();

  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const alice = await aliceContext.newPage();
  const bob = await bobContext.newPage();

  await signInWithFakeGoogle(alice, { email: `alice-${runId}@example.com`, displayName: "Alice" });
  await signInWithFakeGoogle(bob, { email: `bob-${runId}@example.com`, displayName: "Bob" });

  await addToy(alice, `Alice's Robot ${runId}`, FIXTURE_IMAGE);
  await addToy(bob, `Bob's Dinosaur ${runId}`, FIXTURE_IMAGE);

  // Bob browses the marketplace, opens Alice's toy, and offers his own toy
  // for it (src/pages/list.tsx + src/pages/addNewOffer.tsx's ToyDisplay).
  await bob.goto("/list");
  await bob.getByText(`Alice's Robot ${runId}`).click();

  const offerOverlay = bob.locator(".largeOffer");
  await expect(offerOverlay).toBeVisible();
  // First button in the overlay is the chevron that expands "your toys".
  await offerOverlay.locator("button").first().click();
  await bob.locator(`img[alt="Bob's Dinosaur ${runId}"]`).click();
  // The handshake button that actually proposes the trade.
  await offerOverlay.locator(".buttonFixedLeft").click();

  await bob.waitForURL("**/history");

  // Alice sees the incoming offer on My Offers and accepts it
  // (src/pages/myOffers.tsx).
  await alice.goto("/myOffers");
  await expect(alice.getByText("it's your turn to accept or decline this offer")).toBeVisible();
  await alice.getByRole("button", { name: "Accept" }).click();
  await expect(alice.getByText(/the offer was accepted/)).toBeVisible();

  // Neither this app nor its users have an Omniva business contract, so
  // shipment registration happens on Omniva's own site, entirely outside
  // this app - each side just pastes the resulting barcode in here
  // themselves (self-reported, client-writable - see submitOmnivaBarcode).
  await registerOmnivaBarcode(alice, "ALICE-TEST-BARCODE");
  await bob.goto("/myOffers");
  await registerOmnivaBarcode(bob, "BOB-TEST-BARCODE");

  // Posting is gated on BOTH sides having registered with Omniva (mutual
  // real-world commitment). Alice's own refresh() only ran when she
  // submitted her barcode - she needs a fresh pull to see Bob's barcode too.
  await alice.getByRole("button", { name: "refresh" }).click();
  await alice.getByRole("button", { name: "Mark my toy as dropped off" }).click();
  await expect(alice.getByText(/the offered.*toy was posted/)).toBeVisible();

  // Bob confirms he received the toy Alice shipped - this is what makes
  // Alice's side of the trade "successful" and unlocks her service fee.
  await bob.getByRole("button", { name: "refresh" }).click();
  await bob.getByRole("button", { name: "Mark the other toy as received" }).click();
  await expect(bob.getByText(/the offered.*toy was posted.*received on/)).toBeVisible();

  await alice.getByRole("button", { name: "refresh" }).click();

  // Alice's 1 EUR service fee only becomes payable now, after her shipment
  // is confirmed received - not upfront. There's no real Stripe test key
  // available, so the checkout-session creation call is mocked at the
  // network layer - everything else (auth, Firestore, the UI reacting to
  // it) is real. The mock also seeds Firestore exactly as the real
  // stripeWebhook function would once payment succeeds, via the Admin SDK
  // against the emulator.
  let capturedOfferId: string | undefined;
  let capturedSide: string | undefined;

  await alice.route("**/startShipmentCheckout", async (route) => {
    const body = route.request().postDataJSON();
    capturedOfferId = body.data.offerId;
    capturedSide = body.data.side;

    await markShipmentPaid(capturedOfferId!, capturedSide as "offer" | "target");

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        result: {
          checkoutUrl: `/shipment/result?offerId=${capturedOfferId}&side=${capturedSide}&status=success`,
        },
      }),
    });
  });

  await alice.getByRole("button", { name: /Pay service fee/ }).click();
  await alice.waitForURL("**/shipment/result*");

  expect(capturedOfferId).toBeTruthy();

  // The QR code shows Alice's own previously self-entered barcode, not
  // anything generated by payment.
  await expect(alice.locator("svg")).toBeVisible();
  await expect(alice.getByText("ALICE-TEST-BARCODE")).toBeVisible();
});
