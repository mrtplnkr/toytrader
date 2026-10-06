import * as path from "path";
import { test, expect } from "@playwright/test";
import { signInWithFakeGoogle } from "./helpers/auth";
import { addToy } from "./helpers/toys";
import { markShipmentPaid } from "./helpers/adminSeed";

const FIXTURE_IMAGE = path.join(__dirname, "fixtures", "toy.png");
const TEST_BARCODE = "E2E-TEST-BARCODE-123";

test("two users trade toys and the accepting side receives shipping instructions", async ({ browser }) => {
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

  // Alice pays for her shipment. There's no real Stripe test key available,
  // so the checkout-session creation call is mocked at the network layer -
  // everything else (auth, Firestore, the UI reacting to it) is real. The
  // mock also seeds Firestore exactly as the real stripeWebhook function
  // would once payment succeeds, via the Admin SDK against the emulator.
  let capturedOfferId: string | undefined;
  let capturedSide: string | undefined;
  let capturedParcelMachineId: string | undefined;
  let capturedToySize: string | undefined;

  await alice.route("**/startShipmentCheckout", async (route) => {
    const body = route.request().postDataJSON();
    capturedOfferId = body.data.offerId;
    capturedSide = body.data.side;
    capturedParcelMachineId = body.data.parcelMachineId;
    capturedToySize = body.data.toySize;

    await markShipmentPaid(
      capturedOfferId!,
      capturedSide as "offer" | "target",
      TEST_BARCODE,
      capturedParcelMachineId!,
      capturedToySize!
    );

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

  // The pay button is disabled until a parcel machine is chosen (the stub
  // Omniva client's listParcelMachines fixture, served through the real
  // Functions emulator - no mocking needed for this call). The page also
  // renders a second <select> for toy size (defaults to "S"), so scope to
  // the first one specifically.
  const parcelMachineSelect = alice.locator("select").first();
  await expect(parcelMachineSelect.locator("option").nth(1)).toBeAttached();
  await parcelMachineSelect.selectOption({ index: 1 });

  await alice.getByRole("button", { name: /Pay & Get QR Code/ }).click();
  await alice.waitForURL("**/shipment/result*");

  expect(capturedOfferId).toBeTruthy();

  // The QR code (instructions for dropping the toy at an Omniva parcel
  // machine) renders once the barcode is present on the offer.
  await expect(alice.locator("svg")).toBeVisible();
  await expect(alice.getByText(TEST_BARCODE)).toBeVisible();
});
