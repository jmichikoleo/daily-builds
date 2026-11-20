// e2e/arcade.spec.ts
// browser tests. a fake clock drives requestAnimationFrame and performance.now,
// so a whole minute of play runs in a few seconds and always the same way.

import { expect, test, type Page } from "@playwright/test";

const GAMES = [
  { id: "star-catcher", title: "Star Catcher" },
  { id: "panic-button", title: "Panic Button" },
  { id: "frog-traffic", title: "Frog Traffic" },
  { id: "wrong-delivery", title: "Wrong Delivery" },
  { id: "garden-emergency", title: "Garden Emergency" },
  { id: "ghost-hunt", title: "Ghost Hunt" },
];

const debug = (page: Page) => page.evaluate(() => (window as unknown as { __oma: { loops: number; listeners: number; phase: string; score: number } }).__oma);
const phase = (page: Page) => page.locator(".game-host").getAttribute("data-phase");
const score = async (page: Page) => Number(await page.getByTestId("score").textContent());
const timer = (page: Page) => page.getByTestId("timer").textContent();

async function startGame(page: Page, id: string) {
  // freeze time so nothing moves unless the test says so
  await page.clock.install({ time: 0 });
  await page.goto(`/play/${id}`);
  await page.clock.pauseAt(10_000);
  await page.getByRole("button", { name: "start" }).click();
  await expect(page.getByTestId("countdown")).toBeVisible();
  await page.clock.runFor(3000);
  await expect.poll(() => phase(page)).toBe("playing");
}

test.describe("homepage", () => {
  test("shows the arcade and six cartridges", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("ONE MINUTE ARCADE")).toBeVisible();
    await expect(page.getByText("Little games. Big nonsense.")).toBeVisible();
    for (const g of GAMES) {
      const cart = page.getByTestId(`cart-${g.id}`);
      await expect(cart.getByRole("heading", { name: g.title })).toBeVisible();
      await expect(cart.getByText("best 0")).toBeVisible();
      await expect(cart.getByLabel(/difficulty/)).toBeVisible();
    }
  });

  test("navigates between pages", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "my records" }).click();
    await expect(page).toHaveURL(/\/records$/);
    await expect(page.getByRole("heading", { name: "my records" })).toBeVisible();
    await page.getByRole("link", { name: "settings" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await page.getByRole("link", { name: "all games" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole("button", { name: "play Frog Traffic" }).click();
    await expect(page).toHaveURL(/\/play\/frog-traffic$/);
    await page.getByRole("button", { name: "back to the arcade" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/play\/frog-traffic$/);
  });

  test("menus work with the keyboard", async ({ page }) => {
    await page.goto("/");
    const play = page.getByRole("button", { name: "play Star Catcher" });
    await play.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/play\/star-catcher$/);
    // the start button has focus, so enter starts the game
    await expect(page.getByRole("button", { name: "start" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("countdown")).toBeVisible();
  });

  test("unknown pages get a friendly message", async ({ page }) => {
    await page.goto("/play/not-a-game");
    await expect(page.getByRole("heading", { name: "no cartridge here" })).toBeVisible();
  });
});

for (const g of GAMES) {
  test(`${g.title} runs a full minute, pauses, ends and replays`, async ({ page }) => {
    await startGame(page, g.id);
    expect(await debug(page)).toMatchObject({ loops: 1 });

    await page.clock.runFor(5000);
    const t1 = await timer(page);
    expect(t1).toMatch(/^0:5[45]$/);

    // pause freezes the clock
    await page.getByRole("button", { name: "pause" }).click();
    await expect(page.getByRole("heading", { name: "paused" })).toBeVisible();
    await page.clock.runFor(10_000);
    expect(await timer(page)).toBe(t1);
    await page.getByRole("button", { name: "resume" }).first().click();
    await expect.poll(() => phase(page)).toBe("playing");

    // escape pauses too
    await page.keyboard.press("Escape");
    await expect.poll(() => phase(page)).toBe("paused");
    await page.keyboard.press("Escape");
    await expect.poll(() => phase(page)).toBe("playing");

    // play out the rest of the minute
    await page.clock.runFor(54_000);
    expect(await phase(page)).toBe("playing");
    await expect(page.getByRole("timer")).toHaveClass(/is-urgent/);
    await page.clock.runFor(1_000);
    await expect.poll(() => phase(page)).toBe("finished");
    await expect(page.getByText("TIME'S UP")).toBeVisible();
    expect(await timer(page)).toBe("0:00");
    await page.clock.runFor(1_500);
    const results = page.getByTestId("results");
    await expect(results).toBeVisible();
    const final = Number(await results.getByTestId("final-score").textContent());
    expect(final).toBe(await score(page));

    // play again starts clean
    await results.getByRole("button", { name: "play again" }).click();
    await expect.poll(() => phase(page)).toBe("countdown");
    expect(await score(page)).toBe(0);
    expect(await timer(page)).toBe("1:00");
    await page.clock.runFor(3000);
    await expect.poll(() => phase(page)).toBe("playing");

    // leaving the game leaves nothing running
    await page.getByRole("button", { name: "back to the arcade" }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(await debug(page)).toMatchObject({ loops: 0, listeners: 0 });
  });
}

test("wrong delivery scores keyboard sorting", async ({ page }) => {
  await startGame(page, "wrong-delivery");
  await page.clock.runFor(1500);
  const front = page.getByTestId("front-package");
  await expect(front).not.toHaveAttribute("data-category", "");
  const cat = await front.getAttribute("data-category");
  const key = { food: "1", space: "2", magic: "3" }[cat!]!;
  await page.keyboard.press(key);
  expect(await score(page)).toBe(10);
  // a wrong door costs points, floored at zero
  await page.clock.runFor(1800);
  const next = await front.getAttribute("data-category");
  if (next) {
    const wrong = { food: "2", space: "3", magic: "1" }[next]!;
    await page.keyboard.press(wrong);
    expect(await score(page)).toBe(5);
  }
});

test("garden emergency tools work by key and click", async ({ page }) => {
  await startGame(page, "garden-emergency");
  await page.keyboard.press("2");
  await expect(page.getByTestId("tool-glove")).toHaveAttribute("aria-pressed", "true");
  // wait for something to need help
  await expect
    .poll(async () => {
      await page.clock.runFor(500);
      return page.locator('[data-kind="thirsty"], [data-kind="bud"], [data-kind="weed"]').count();
    })
    .toBeGreaterThan(0);
  const plot = page.locator('[data-kind="thirsty"], [data-kind="bud"], [data-kind="weed"]').first();
  const kind = await plot.getAttribute("data-kind");
  const tool = { thirsty: "water", bud: "sun", weed: "glove" }[kind!]!;
  await page.getByTestId(`tool-${tool}`).click();
  await plot.click();
  expect(await score(page)).toBe({ thirsty: 10, bud: 20, weed: 5 }[kind!]);
});

test("ghost hunt rewards a ghost and punishes laundry", async ({ page }) => {
  await startGame(page, "ghost-hunt");
  await expect
    .poll(async () => {
      await page.clock.runFor(200);
      return page.locator('[data-spook="ghost"], [data-spook="rare"]').count();
    })
    .toBeGreaterThan(0);
  const spot = page.locator('[data-spook="ghost"], [data-spook="rare"]').first();
  const kind = await spot.getAttribute("data-spook");
  // the furniture floats, so skip the stable element wait
  await spot.click({ force: true });
  expect(await score(page)).toBe(kind === "rare" ? 30 : 10);
  // an empty spot costs points
  const empty = page.locator('.spot[data-spook=""]').first();
  await empty.click({ force: true });
  expect(await score(page)).toBe(kind === "rare" ? 25 : 5);
});

test("frog traffic hops with the keyboard and the on screen pad", async ({ page }) => {
  await startGame(page, "frog-traffic");
  // hopping sideways on the bank is always safe and never changes the score
  await page.keyboard.press("ArrowLeft");
  await page.clock.runFor(300);
  await page.getByRole("button", { name: "hop right" }).click();
  await page.clock.runFor(300);
  expect(await score(page)).toBe(0);
  // keep hopping forward. sooner or later the frog lands on a pad and scores
  await expect
    .poll(async () => {
      await page.keyboard.press("ArrowUp");
      await page.clock.runFor(900);
      return score(page);
    }, { timeout: 30_000 })
    .toBeGreaterThan(0);
});

test("panic button controls respond to keys", async ({ page }) => {
  await startGame(page, "panic-button");
  const valve = page.getByRole("button", { name: /pressure valve/ });
  await expect(valve).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("w");
  await expect(valve).toHaveAttribute("aria-pressed", "true");
  const cool = page.getByRole("button", { name: /hold to lower heat/ });
  await page.keyboard.down("q");
  await page.clock.runFor(200);
  await expect(cool).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.up("q");
  await page.clock.runFor(200);
  await expect(cool).toHaveAttribute("aria-pressed", "false");
  // staying green earns points
  await page.keyboard.press("w");
  await page.clock.runFor(2000);
  expect(await score(page)).toBeGreaterThan(0);
});

test("surprise me launches a valid game other than the last one", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("one-minute-arcade:records", JSON.stringify({ version: 1, games: {}, totalPlayMs: 0, lastGameId: "ghost-hunt" })));
  await page.reload();
  await page.getByTestId("surprise").click();
  await expect(page.locator(".cart.is-shuffling").first()).toBeVisible();
  await expect(page).toHaveURL(/\/play\/[a-z-]+$/, { timeout: 5000 });
  const id = page.url().split("/").pop();
  expect(GAMES.map((g) => g.id)).toContain(id);
  expect(id).not.toBe("ghost-hunt");
  await expect(page.getByRole("button", { name: "start" })).toBeVisible();
});

test("records and settings persist after a reload", async ({ page }) => {
  await startGame(page, "wrong-delivery");
  await page.clock.runFor(1500);
  const cat = await page.getByTestId("front-package").getAttribute("data-category");
  await page.keyboard.press({ food: "1", space: "2", magic: "3" }[cat!]!);
  const earned = await score(page);
  expect(earned).toBeGreaterThan(0);
  // let packages fall off the belt for the rest of the minute
  await page.clock.runFor(60_000);
  await page.clock.runFor(1500);
  await expect(page.getByTestId("results")).toBeVisible();
  const final = Number(await page.getByTestId("final-score").textContent());
  await expect(page.getByTestId("new-best").or(page.getByText(/personal best/))).toBeVisible();

  await page.goto("/records");
  await page.reload();
  await expect(page.getByTestId("total-plays")).toHaveText("1");
  await expect(page.getByTestId("best-wrong-delivery")).toHaveText(String(final));

  await page.goto("/settings");
  const sound = page.getByTestId("sound-toggle");
  await expect(sound).toBeChecked();
  await sound.click();
  await expect(sound).not.toBeChecked();
  await page.getByText("reduce motion", { exact: true }).click();
  await page.reload();
  await expect(page.getByTestId("sound-toggle")).not.toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
});

test("direct navigation and refresh work on nested routes", async ({ page }) => {
  for (const path of ["/records", "/settings", "/play/ghost-hunt", "/play/panic-button"]) {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await page.reload();
    await expect(page.locator("#root")).not.toBeEmpty();
  }
  await expect(page.getByRole("heading", { name: "Panic Button" })).toBeVisible();
});

test("switching games cleans up the previous one", async ({ page }) => {
  await startGame(page, "star-catcher");
  await page.clock.runFor(2000);
  const inGame = await debug(page);
  expect(inGame.loops).toBe(1);
  await page.getByRole("button", { name: "back to the arcade" }).click();
  expect(await debug(page)).toMatchObject({ loops: 0, listeners: 0 });
  await page.getByRole("button", { name: "play Panic Button" }).click();
  await page.getByRole("button", { name: "start" }).click();
  await page.clock.runFor(3000);
  const d = await debug(page);
  expect(d.loops).toBe(1);
  expect(d.phase).toBe("playing");
  // star catcher had 3 key listeners, panic has 4. only panic's should be live
  expect(d.listeners).toBe(3 + 4);
});

test.describe("mobile", () => {
  test("home fits a phone without sideways scrolling @mobile", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.getByTestId("surprise")).toBeVisible();
  });

  test("games fit the screen and take taps @mobile", async ({ page }) => {
    await startGame(page, "wrong-delivery");
    await page.clock.runFor(1500);
    const noScroll = await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1);
    expect(noScroll).toBe(true);
    const cat = await page.getByTestId("front-package").getAttribute("data-category");
    await page.getByTestId(`door-${cat}`).tap();
    expect(await score(page)).toBe(10);
    // every door is fully on screen and big enough to hit
    for (const c of ["food", "space", "magic"]) {
      const box = await page.getByTestId(`door-${c}`).boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    }
  });

  test("touch controls are on screen for every game @mobile", async ({ page }) => {
    const vh = page.viewportSize()!.height;
    const checks: [string, string][] = [
      ["frog-traffic", "hop forward"],
      ["panic-button", "reset the power. key e"],
      ["garden-emergency", "plot 12"],
    ];
    for (const [id, name] of checks) {
      await page.goto(`/play/${id}`);
      await page.getByRole("button", { name: "start" }).tap();
      const box = await page.getByRole("button", { name, exact: false }).first().boundingBox();
      expect(box, id).not.toBeNull();
      expect(box!.y + box!.height, id).toBeLessThanOrEqual(vh);
    }
  });

  test("star catcher follows a finger @mobile", async ({ page }) => {
    await startGame(page, "star-catcher");
    const canvas = page.locator("canvas");
    const box = (await canvas.boundingBox())!;
    // drag along the bottom for a while. stars land in the basket eventually
    await expect
      .poll(async () => {
        const x = box.x + Math.random() * box.width;
        await canvas.dispatchEvent("pointerdown", { clientX: x, clientY: box.y + box.height * 0.9, pointerType: "touch", buttons: 1 });
        await page.clock.runFor(700);
        return score(page);
      }, { timeout: 40_000 })
      .not.toBe(0);
  });
});
