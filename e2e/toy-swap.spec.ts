import * as path from "path";
import { test, expect, Page } from "@playwright/test";
import { signInWithFakeGoogle } from "./helpers/auth";
import { addToy } from "./helpers/toys";
import { markTipPaid, getUidByEmail } from "./helpers/adminSeed";

const FIXTURE_IMAGE = path.join(__dirname, "fixtures", "toy.png");

async function registerOmnivaBarcode(page: Page, barcode: string) {
  // There's no way to deep-link a chosen parcel machine into Omniva's own
  // site, so the app only asks for a country here (enough to route to the
  // right Omniva domain) - the actual terminal is picked over there, outside
  // this app, which is why this test only fills in the self-reported barcode.
  await page.getByLabel("Shipping country:").selectOption("EE");

  await page.getByPlaceholder("Paste your Omniva barcode here").fill(barcode);
  await page.getByRole("button", { name: "Save my barcode" }).click();
  await expect(page.getByRole("button", { name: "View my QR code" })).toBeVisible();
}

test("two users trade toys: register with Omniva, ship, receive, rate, and leave the optional tip", async ({ browser }) => {
  const runId = Date.now();
  const aliceEmail = `alice-${runId}@example.com`;
  const bobEmail = `bob-${runId}@example.com`;

  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const alice = await aliceContext.newPage();
  const bob = await bobContext.newPage();

  await signInWithFakeGoogle(alice, { email: aliceEmail, displayName: "Alice" });
  await signInWithFakeGoogle(bob, { email: bobEmail, displayName: "Bob" });

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
  //
  // Bob is the initiator here (he's the one who clicked the handshake
  // button with his own toy), so Alice is the *receiver* - her own shipment
  // is toyTargeted (her robot), which the status list labels "the requested
  // toy" regardless of who's viewing it (that text is the same for both
  // sides, not relative to "my"/"other").
  await alice.getByRole("button", { name: "refresh" }).click();
  await alice.getByRole("button", { name: "Mark my toy as dropped off" }).click();
  await expect(alice.getByText(/the requested.*toy was posted/)).toBeVisible();

  // Bob confirms he received the toy Alice shipped.
  await bob.getByRole("button", { name: "refresh" }).click();
  await bob.getByRole("button", { name: "Mark the other toy as received" }).click();
  await expect(bob.getByText(/the requested.*toy was posted.*received on/)).toBeVisible();

  // The optional tip is now per-trade, not per-side - it only unlocks once
  // BOTH directions of the trade have completed, so Bob posts and Alice
  // receives his own shipment (toyOffered, his Dinosaur) too.
  await bob.getByRole("button", { name: "refresh" }).click();
  await bob.getByRole("button", { name: "Mark my toy as dropped off" }).click();
  await expect(bob.getByText(/the offered.*toy was posted/)).toBeVisible();

  await alice.getByRole("button", { name: "refresh" }).click();
  await alice.getByRole("button", { name: "Mark the other toy as received" }).click();
  await expect(alice.getByText(/the offered.*toy was posted.*received on/)).toBeVisible();

  // The tip is also gated on the viewer's own feedback having been
  // recorded - Alice rates the toy she received (Bob's Dinosaur) before the
  // tip prompt becomes available to her.
  await alice.getByRole("button", { name: /Rate 5 star/ }).click();
  await alice.getByRole("button", { name: "Submit rating" }).click();
  await expect(alice.getByRole("button", { name: "Submit rating" })).toBeHidden();

  // Alice's optional "buy me a coffee" tip only becomes offerable now, after
  // the whole trade is complete and she's left her rating - not upfront.
  // There's no real Stripe test key available, so the checkout-session
  // creation call is mocked at the network layer - everything else (auth,
  // Firestore, the UI reacting to it) is real. The mock also seeds
  // Firestore exactly as the real stripeWebhook function would once payment
  // succeeds, via the Admin SDK against the emulator.
  let capturedOfferId: string | undefined;
  const aliceUid = await getUidByEmail(aliceEmail);

  await alice.route("**/startShipmentCheckout", async (route) => {
    const body = route.request().postDataJSON();
    capturedOfferId = body.data.offerId;

    await markTipPaid(capturedOfferId!, aliceUid);

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        result: {
          checkoutUrl: `/shipment/result?offerId=${capturedOfferId}&status=success`,
        },
      }),
    });
  });

  await alice.getByRole("button", { name: /Buy me a coffee/ }).click();
  await alice.waitForURL("**/shipment/result*");

  expect(capturedOfferId).toBeTruthy();

  // The tip redirect no longer carries `side` (it's per-trade, not
  // per-side), so this lands on the payment-confirmation branch rather than
  // the barcode/QR view - that view is still reachable separately via
  // "View my QR code", untouched by this change.
  await expect(alice.getByText("Thanks so much for the coffee!")).toBeVisible();
});
