// e2e/passport.spec.ts
// the journeys from the brief, end to end in a real browser:
// onboarding to first stamp, visiting, a whole expedition, secrets,
// the journal, favourites, persistence, backup and restore, and mobile.

import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

// a tiny valid png (8x8, pink)
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGP4/+8/AwMDEwMDAwMAOf4D/Xj/0z8AAAAASUVORK5CYII=",
  "base64",
);

async function dismissCeremonies(page: Page) {
  const dialog = page.locator(".ceremony");
  for (let i = 0; i < 20; i++) {
    if (!(await dialog.isVisible())) return;
    await dialog.locator(".btn").first().click();
  }
}

async function onboard(page: Page, name = "Ada Lovelace", withPhoto = false) {
  await page.goto("/");
  await page.getByRole("button", { name: "start my application" }).click();
  await page.getByPlaceholder("what should the passport call you").fill(name);
  await page.getByPlaceholder("the tab hoarder").fill("the countess");
  await page.getByRole("button", { name: "next" }).click();
  if (withPhoto) {
    await page.locator('input[type="file"]').setInputFiles({ name: "me.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByAltText("your explorer photograph")).toBeVisible();
  }
  await page.getByRole("button", { name: "next" }).click();
  await page.locator(".territory-pick").filter({ hasText: "sound islands" }).click();
  await page.getByRole("button", { name: "next" }).click();
  await page.getByRole("button", { name: "one more tab" }).click();
  await page.locator(".cover-pick").filter({ hasText: "postal blue" }).click();
  await page.getByRole("button", { name: "next" }).click();
  await expect(page.getByRole("heading", { name: "check your details" })).toBeVisible();
  await page.getByRole("button", { name: "issue my passport" }).click();
  await page.getByRole("button", { name: "walk into the departure hall" }).click();
  await expect(page.locator(".ceremony")).toContainText("Passport Issued");
  await dismissCeremonies(page);
}

async function honourVisit(page: Page, id: string) {
  await page.goto(`/#/destination/${id}`);
  await page.getByRole("button", { name: "been here before? confirm without departing" }).click();
  await page.getByRole("button", { name: "i explored it, stamp my passport" }).click();
  await expect(page.locator(".ceremony")).toBeVisible();
  await dismissCeremonies(page);
}

function saved(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("internet-passport:v1") || "{}"));
}

test("onboarding through the first collected stamp, and it survives a refresh", async ({ page }) => {
  await onboard(page, "Ada Lovelace", true);
  await expect(page.getByRole("heading", { name: /good to see you, the countess/ })).toBeVisible();

  // depart opens the site in a new tab
  await page.goto("/#/destination/radio-garden");
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("link", { name: /depart for radio.garden/ }).click();
  const popup = await popupPromise;
  expect(popup.url()).toContain("radio.garden");
  await popup.close();

  await expect(page.getByRole("heading", { name: /welcome back|bon voyage/ })).toBeVisible();
  await page.getByLabel(/which city were you listening to/).fill("lisbon, fado");
  await page.getByRole("button", { name: "i explored it, stamp my passport" }).click();
  await expect(page.locator(".ceremony")).toContainText("Radio Garden");
  await page.locator(".ceremony .btn-primary").click();
  await expect(page.locator(".ceremony")).toContainText("First Departure");
  await dismissCeremonies(page);
  await expect(page.getByRole("heading", { name: "you have been here" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "you have been here" })).toBeVisible();
  await expect(page.getByText("lisbon, fado")).toBeVisible();
  const s = await saved(page);
  expect(s.profile.photo).toMatch(/^data:image\/jpeg/);
  expect(Object.keys(s.stamps)).toEqual(expect.arrayContaining(["welcome", "dest:radio-garden", "ach:first-departure"]));

  await page.goto("/#/passport");
  await page.getByRole("button", { name: "open your passport" }).click();
  await expect(page.getByAltText("photograph of Ada Lovelace")).toBeVisible();
});

test("a visited destination never gives a second stamp", async ({ page }) => {
  await onboard(page);
  await honourVisit(page, "silk");
  await page.goto("/#/destination/silk");
  await expect(page.getByRole("button", { name: /stamp my passport/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "visit again in a new tab" })).toBeVisible();
  const s = await saved(page);
  expect(s.visits.filter((v: { destinationId: string }) => v.destinationId === "silk")).toHaveLength(1);
});

test("a complete expedition seals it and reveals a secret", async ({ page }) => {
  await onboard(page);
  for (const id of ["wayback-machine", "geocities-gallery", "internet-arcade", "neocities"]) await honourVisit(page, id);
  await page.goto("/#/expeditions/forgotten-internet");
  await expect(page.getByText("4 of 5 stops", { exact: false })).toBeVisible();

  await page.goto("/#/destination/marginalia");
  await page.getByRole("button", { name: "been here before? confirm without departing" }).click();
  await page.getByRole("button", { name: "i explored it, stamp my passport" }).click();
  const seen: string[] = [];
  for (let i = 0; i < 10 && (await page.locator(".ceremony").isVisible()); i++) {
    seen.push((await page.locator(".ceremony").innerText()).replace(/\s+/g, " "));
    if (seen.at(-1)!.includes("hidden destination")) await page.getByRole("button", { name: "later" }).click();
    else await page.locator(".ceremony .btn-primary").click();
  }
  const all = seen.join(" | ");
  expect(all).toContain("Expedition 006 Complete");
  expect(all).toContain("Expedition Complete");
  expect(all).toContain("Cameron's World");

  await page.goto("/#/expeditions/forgotten-internet");
  await expect(page.getByText(/^completed /)).toBeVisible();
  await page.goto("/#/destination/camerons-world");
  await expect(page.getByRole("link", { name: /depart for cameronsworld.net/ })).toBeVisible();
});

test("secret destinations unlock from hidden things and stay locked before", async ({ page }) => {
  await onboard(page);
  await page.goto("/#/destination/wiby");
  await expect(page.getByRole("heading", { name: "a place not yet on your map" })).toBeVisible();
  await expect(page.getByRole("link", { name: /depart for/ })).toHaveCount(0);

  await page.goto("/#/atlas");
  await page.getByRole("button", { name: "something small floating in the sea" }).click();
  await expect(page.locator(".ceremony")).toContainText("Wiby");
  await page.getByRole("button", { name: "see where it leads" }).click();
  await expect(page).toHaveURL(/destination\/wiby/);
  await expect(page.getByRole("link", { name: /depart for wiby.me/ })).toBeVisible();

  await page.goto("/");
  const clock = page.getByRole("button", { name: "terminal clock, out of order" });
  await clock.click();
  await clock.click();
  await clock.click();
  await expect(page.locator(".ceremony")).toContainText("Space Jam");
  await dismissCeremonies(page);

  await page.goto("/#/atlas/hidden");
  await expect(page.getByText("2 of 11 revealed", { exact: false })).toBeVisible();
  await expect(page.getByText(/listen closely/)).toBeVisible();
});

test("the journal creates, edits and deletes postcards, and favourites persist", async ({ page }) => {
  await onboard(page);
  await honourVisit(page, "a-soft-murmur");
  await page.goto("/#/journal/new?dest=a-soft-murmur");
  await page.getByPlaceholder("the one thing you will remember").fill("the thunder slider");
  await page.getByRole("button", { name: "what surprised you here?" }).click();
  await page.getByPlaceholder(/dear diary/).fill("rain and fire together. very calm.");
  await page.getByPlaceholder("rainy day, show mum, bookmark").fill("calm, focus");
  await page.locator(".rating label").nth(4).click();
  await page.getByLabel("i would revisit this website").check();
  await page.getByRole("button", { name: "keep this postcard" }).click();

  await expect(page.locator(".postcard")).toHaveCount(1);
  await expect(page.locator(".postcard")).toContainText("A Soft Murmur");
  await expect(page.locator(".postcard")).toContainText("would revisit");

  await page.getByRole("link", { name: "edit", exact: true }).click();
  await page.getByPlaceholder(/dear diary/).fill("edited words");
  await page.getByRole("button", { name: "save changes" }).click();
  await expect(page.locator(".postcard")).toContainText("edited words");

  await page.reload();
  await expect(page.locator(".postcard")).toContainText("edited words");
  await page.getByRole("button", { name: "delete" }).click();
  await page.getByRole("button", { name: "delete it" }).click();
  await expect(page.getByText("no postcards yet")).toBeVisible();

  await page.goto("/#/destination/orb-farm");
  await page.getByRole("button", { name: /save Orb.Farm to places/ }).click();
  await page.reload();
  await page.goto("/#/journal/saved");
  await expect(page.locator(".dest-card")).toContainText("Orb.Farm");
});

test("backup downloads and restores after starting over", async ({ page }) => {
  await onboard(page, "Backup Person");
  await honourVisit(page, "patatap");
  await page.goto("/#/profile");
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "download a backup" }).click();
  const file = await (await dl).path();
  const text = readFileSync(file!, "utf8");
  expect(JSON.parse(text).kind).toBe("internet-passport-backup");

  await page.getByRole("button", { name: "cancel this passport" }).click();
  await page.getByLabel("type cancel to confirm").fill("cancel");
  await page.getByRole("button", { name: "erase everything" }).click();
  await expect(page.getByRole("button", { name: "start my application" })).toBeVisible();

  await onboard(page, "Someone Else");
  await page.goto("/#/profile");
  await page.getByLabel("choose a backup file").setInputFiles({ name: "b.json", mimeType: "application/json", buffer: Buffer.from(text) });
  await expect(page.getByText(/belongs to Backup Person/)).toBeVisible();
  await page.getByRole("button", { name: "replace with the backup" }).click();
  await expect(page.getByRole("heading", { name: "Backup Person" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Backup Person" })).toBeVisible();

  await page.getByLabel("choose a backup file").setInputFiles({ name: "x.json", mimeType: "application/json", buffer: Buffer.from("{nope") });
  await expect(page.getByText("that file is not valid json.")).toBeVisible();
});

test("damaged storage is set aside instead of crashing", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("internet-passport:v1", "{broken"));
  await page.reload();
  await expect(page.getByRole("heading", { name: /damaged file/ })).toBeVisible();
  await page.getByRole("button", { name: "set it aside and start fresh" }).click();
  await expect(page.getByRole("button", { name: "start my application" })).toBeVisible();
  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys.some((k) => k.includes("unreadable"))).toBe(true);
});

test("every navigation section loads", async ({ page }) => {
  await onboard(page);
  for (const [label, heading] of [
    ["world atlas", "a map of the internet, roughly"],
    ["my passport", "your passport"],
    ["expeditions", "curated journeys"],
    ["travel journal", "postcards from the internet"],
    ["explorer profile", "Ada Lovelace"],
    ["departure hall", /good to see you/],
  ] as const) {
    await page.getByRole("navigation", { name: "main" }).first().getByRole("link", { name: label }).click();
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }
  await page.goto("/#/atlas/sound");
  await expect(page.getByRole("heading", { name: "The Sound Islands" })).toBeVisible();
  await page.goto("/#/nowhere");
  await expect(page.getByText("this gate does not exist")).toBeVisible();
});

test("pocket passport on a phone @mobile", async ({ page }) => {
  await onboard(page, "Pocket Explorer");
  const bar = page.locator(".pocketbar");
  await expect(bar).toBeVisible();
  await bar.getByRole("link", { name: "passport" }).click();
  await page.getByRole("button", { name: "open your passport" }).click();
  await expect(page.getByText("page 1 of 4")).toBeVisible();
  const book = page.locator(".book");
  const box = (await book.boundingBox())!;
  await page.touchscreen.tap(box.x + 10, box.y + 10);
  await book.dispatchEvent("touchstart", { touches: [{ identifier: 1, clientX: box.x + box.width - 30, clientY: box.y + 100 }] });
  await book.dispatchEvent("touchend", { changedTouches: [{ identifier: 1, clientX: box.x + 30, clientY: box.y + 100 }] });
  await expect(page.getByText("page 2 of 4")).toBeVisible();

  // nothing should scroll sideways
  for (const path of ["/", "/#/atlas", "/#/passport", "/#/expeditions", "/#/journal", "/#/profile", "/#/destination/radio-garden"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
});
