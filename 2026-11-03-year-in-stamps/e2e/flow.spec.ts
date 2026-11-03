import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { OUTPUT_DIR, expectPreviewReady, imageDifference, liveCanvas, openExport, pngSize, saveDownload, seedDraft } from "./helpers";

test.describe("complete flow", () => {
  test("create → collect → customise → theme → edit → export PNG", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

    await page.goto("/");
    await page.getByRole("link", { name: /Create my passport/ }).first().click();
    await expect(page).toHaveURL(/\/create$/);

    // Add destinations from the real catalog.
    const search = page.getByPlaceholder("Search a country, territory or city");
    for (const [query, button] of [
      ["Korea", /^Add South Korea,/],
      ["Busan", /^Add Busan, .*South Korea/],
      ["Paris", /^Add Paris, .*France/],
      ["Hong Kong", /^Add Hong Kong, Special Administrative Region of China/],
      ["Barcelona", /^Add Barcelona, .*Spain/],
    ] as const) {
      await search.fill(query);
      await page.getByRole("button", { name: button }).click();
    }
    await expect(page.getByRole("list", { name: "Collected stamps" }).getByRole("listitem")).toHaveCount(5);

    // A duplicate add is refused; "another visit" is explicit.
    await search.fill("Busan");
    await expect(page.getByRole("button", { name: /^Add Busan, / })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Add another visit to Busan/ }).first()).toBeVisible();

    // Customise one stamp: postage style and a visit month.
    await page.getByRole("button", { name: "Edit date and design of Busan" }).click();
    const editor = page.getByRole("dialog", { name: "Busan" });
    await editor.getByText("Month", { exact: true }).click();
    await editor.getByLabel("Month of visit, in 2026").fill("2026-03");
    await editor.getByText("Postage", { exact: true }).click();
    await editor.getByRole("button", { name: "Save stamp" }).click();
    await expect(editor).toBeHidden();

    await page.getByRole("link", { name: /Continue to studio/ }).first().click();
    await expect(page).toHaveURL(/\/studio$/);
    await expect(liveCanvas(page)).toBeVisible();

    // Theme + direct manipulation.
    await page.getByRole("radio", { name: /Pink Postcard/ }).click();
    const stamp = page.locator("g.collage-stamp").first();
    const box = (await stamp.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 30, { steps: 8 });
    await page.mouse.up();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("year-in-stamps:draft")!).draft.studio);
    expect(stored.themeId).toBe("pink");
    expect(Object.keys(stored.overrides.story)).toHaveLength(1);

    // Deselect (click the paper margin) so the editor shows exactly what will be exported.
    const canvasBox = (await liveCanvas(page).boundingBox())!;
    await page.mouse.click(canvasBox.x + 6, canvasBox.y + canvasBox.height - 6);
    const live = await liveCanvas(page).screenshot();

    const dialog = await openExport(page);
    const downloadPromise = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "Save My Passport" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("my-2026-passport-story.png");
    const path = await saveDownload(download, "flow/story-pink.png");
    expect(pngSize(path)).toEqual({ width: 1080, height: 1920 });
    await expect(dialog.getByRole("status").filter({ hasText: "Download started" })).toBeVisible();

    // The file matches the editor preview.
    const diff = await imageDifference(page, live, (await import("node:fs")).readFileSync(path));
    expect(diff).toBeLessThan(14);

    // Square from the same dialog.
    await dialog.getByText("Square", { exact: true }).click();
    await expectPreviewReady(page);
    const squarePromise = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "Save My Passport" }).click();
    const square = await saveDownload(await squarePromise, "flow/square-pink.png");
    expect(pngSize(square)).toEqual({ width: 1080, height: 1080 });

    // Refresh: the exact design comes back.
    await page.keyboard.press("Escape");
    await page.reload();
    await expect(liveCanvas(page)).toHaveAttribute("viewBox", "0 0 1080 1080");
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem("year-in-stamps:draft")!).draft);
    expect(after.studio.themeId).toBe("pink");
    expect(after.entries.find((e: { place: { name: string } }) => e.place.name === "Busan").design.style).toBe("postage");

    expect(errors).toEqual([]);
  });
});

test.describe("visual export matrix", () => {
  for (const themeId of ["classic", "pink", "editorial"]) {
    for (const formatId of ["story", "square"] as const) {
      test(`${themeId} / ${formatId} exports a PNG that matches the studio`, async ({ page }) => {
        await seedDraft(page, { count: 12, themeId, formatId, title: "Collected Along the Way" });
        await page.goto("/studio");
        await expect(liveCanvas(page)).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        const live = await liveCanvas(page).screenshot();
        const dialog = await openExport(page);
        const dl = page.waitForEvent("download");
        await dialog.getByRole("button", { name: "Save My Passport" }).click();
        const path = await saveDownload(await dl, `matrix/${themeId}-${formatId}.png`);
        expect(pngSize(path)).toEqual(formatId === "story" ? { width: 1080, height: 1920 } : { width: 1080, height: 1080 });
        const diff = await imageDifference(page, live, (await import("node:fs")).readFileSync(path));
        expect(diff).toBeLessThan(14);
      });
    }
  }
});

test("40 stamps export as three pages in one ZIP", async ({ page }) => {
  await seedDraft(page, { count: 40, themeId: "classic", formatId: "story", preset: "scattered" });
  await page.goto("/studio");
  const dialog = await openExport(page);
  await expect(dialog.getByText("Your 40 stamps fill 3 pages")).toBeVisible();
  const dl = page.waitForEvent("download");
  await dialog.getByRole("button", { name: /Export All Pages/ }).click();
  const download = await dl;
  expect(download.suggestedFilename()).toBe("my-2026-passport-story-all-pages.zip");
  const zipPath = await saveDownload(download, "pages/all-pages.zip");
  const outDir = join(OUTPUT_DIR, "pages", "unzipped");
  mkdirSync(outDir, { recursive: true });
  execFileSync("unzip", ["-o", "-q", zipPath, "-d", outDir]);
  const files = readdirSync(outDir).sort();
  expect(files).toEqual(["my-2026-passport-story-page-1.png", "my-2026-passport-story-page-2.png", "my-2026-passport-story-page-3.png"]);
  for (const f of files) expect(pngSize(join(outDir, f))).toEqual({ width: 1080, height: 1920 });
});

test("sharing: supported, cancelled and failing share sheets", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __shareMode: string; __shared: string[] };
    w.__shareMode = "ok";
    w.__shared = [];
    Object.defineProperty(navigator, "canShare", { value: (d: { files?: File[] }) => !!d.files?.length, configurable: true });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (d: { files: File[] }) => {
        if (w.__shareMode === "cancel") throw new DOMException("closed", "AbortError");
        if (w.__shareMode === "fail") throw new DOMException("nope", "NotAllowedError");
        w.__shared.push(...d.files.map((f) => `${f.name}:${f.type}:${f.size > 1000}`));
      },
    });
  });
  await seedDraft(page, { count: 3, themeId: "editorial", formatId: "story" });
  await page.goto("/studio");
  const dialog = await openExport(page);
  const share = dialog.getByRole("button", { name: "Share My Passport" });
  await share.click();
  await expect(dialog.getByText("Sent to the share sheet.")).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __shared: string[] }).__shared)).toEqual(["my-2026-passport-story.png:image/png:true"]);

  await page.evaluate(() => ((window as unknown as { __shareMode: string }).__shareMode = "cancel"));
  await share.click();
  await expect(dialog.getByRole("alert")).toHaveCount(0);

  await page.evaluate(() => ((window as unknown as { __shareMode: string }).__shareMode = "fail"));
  await share.click();
  await expect(dialog.getByRole("alert")).toContainText("Use “Save My Passport” instead");
  // The download fallback still works.
  const dl = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Save My Passport" }).click();
  expect((await dl).suggestedFilename()).toBe("my-2026-passport-story.png");
});

test("without the Web Share API only Save is offered", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true });
  });
  await seedDraft(page, { count: 2, themeId: "classic", formatId: "square" });
  await page.goto("/studio");
  const dialog = await openExport(page);
  await expect(dialog.getByRole("button", { name: "Share My Passport" })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Save My Passport" })).toBeEnabled();
});

test("a font that can't be loaded stops the export with a clear message", async ({ page }) => {
  await seedDraft(page, { count: 3, themeId: "pink", formatId: "story" });
  await page.goto("/studio");
  await page.evaluate(() => document.fonts.ready);
  await page.route("**/*.woff2", (route) => route.abort());
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog", { name: /Save your passport/ }).getByRole("alert")).toContainText("couldn't load the lettering");
  await expect(page.getByRole("button", { name: "Save My Passport" })).toBeDisabled();
});

test("an empty passport can't be exported", async ({ page }) => {
  await seedDraft(page, { count: 0, themeId: "classic", formatId: "story" });
  await page.goto("/studio");
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
});

test("Clear My Data removes only this app's storage", async ({ page }) => {
  await seedDraft(page, { count: 3, themeId: "classic", formatId: "story" });
  await page.evaluate(() => localStorage.setItem("someone-else:prefs", "keep me"));
  await page.goto("/privacy");
  await page.getByRole("button", { name: "Clear My Data" }).click();
  await page.getByRole("button", { name: "Keep my passport" }).click();
  expect(await page.evaluate(() => localStorage.getItem("year-in-stamps:draft"))).not.toBeNull();
  await page.getByRole("button", { name: "Clear My Data" }).click();
  await page.getByRole("button", { name: "Yes, clear it" }).click();
  await expect(page.getByText("Your passport and its backups were removed")).toBeVisible();
  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys).toEqual(["someone-else:prefs"]);
  await page.goto("/create");
  await expect(page.getByText("Your passport is waiting for its first stamp.")).toBeVisible();
});

test("Phase 1 (v1) drafts still open and export", async ({ page }) => {
  await page.goto("/privacy");
  await page.evaluate(() =>
    localStorage.setItem(
      "year-in-stamps:draft",
      JSON.stringify({
        version: 1,
        savedAt: "2026-11-03T00:00:00Z",
        draft: { year: 2026, nickname: "Mochi", title: "", themeId: "pink", formatId: "story", stamps: [{ destinationId: "city:kr-busan", visitMonth: "2026-02" }, { destinationId: "region:HK" }] },
      }),
    ),
  );
  await page.goto("/studio");
  await expect(page.locator("g.collage-stamp")).toHaveCount(2);
  const dialog = await openExport(page);
  const dl = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Save My Passport" }).click();
  expect((await dl).suggestedFilename()).toBe("mochi-2026-passport-story.png");
});

test("@mobile export and editing on a phone", async ({ page }) => {
  await seedDraft(page, { count: 6, themeId: "classic", formatId: "story" });
  await page.goto("/studio");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  // Tap to select, then use the Stamp panel's accessible controls.
  await page.locator("g.collage-stamp").first().tap();
  await page.getByRole("navigation", { name: "Editing tools" }).getByRole("button", { name: /Stamp/ }).tap();
  await page.getByRole("dialog", { name: "Stamp" }).getByLabel(/Rotation/).fill("20");
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("year-in-stamps:draft")!).draft.studio.overrides.story);
  expect(Object.values(stored)[0]).toMatchObject({ rotation: 20 });
  await page.getByRole("button", { name: "Close panel" }).tap();
  const dialog = await openExport(page);
  const dl = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Save My Passport" }).tap();
  const path = await saveDownload(await dl, "mobile/story.png");
  expect(pngSize(path)).toEqual({ width: 1080, height: 1920 });
});
