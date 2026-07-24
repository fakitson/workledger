import { test, expect } from "@playwright/test";
import fs from "node:fs";

const KEY = "worklog:v1";

/* Date helpers mirroring the app (local time, Sunday week start). */
const dayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
// Sunday that starts the week containing `d`, minus `weeksBack` weeks.
const sundayOf = (d, weeksBack = 0) => addDays(d, -d.getDay() - 7 * weeksBack);

const entry = (over) => ({
  id: crypto.randomUUID(),
  date: dayKey(new Date()),
  minutes: 60,
  project: "Seeded",
  output: "seeded work",
  evidence: "https://example.com/evidence",
  mult: 1,
  mode: "normal",
  pauseCount: 0,
  started: "09:00",
  ...over,
});

/** Seed app state; the guard keeps reloads from clobbering in-test updates. */
async function seed(page, state) {
  await page.addInitScript(
    ([key, json]) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, json);
    },
    [KEY, JSON.stringify(state)]
  );
}

test("start, pause, resume, stop a block; accidental-start guard; file with evidence", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("UniTold / FrameFusion / Signals & Systems").fill("Prod migration");
  await page.getByRole("button", { name: "Start clock" }).click();

  await expect(page.getByRole("button", { name: "Stop" })).toBeVisible();
  await expect(page.getByText("On the clock", { exact: false })).toBeVisible();

  // pause freezes the clock
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByText("PAUSED", { exact: true })).toBeVisible();

  // resume
  await page.getByRole("button", { name: "Resume" }).click();
  await expect(page.getByText("PAUSED", { exact: true })).toHaveCount(0);

  // stop after <5 min -> accidental-start guard
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByText("UNDER 5 MINUTES — ACCIDENTAL START?")).toBeVisible();
  await page.getByRole("button", { name: "It's real — keep it" }).click();

  // file it with evidence
  await expect(page.getByText("Close block — evidence required to bill")).toBeVisible();
  await page.getByPlaceholder("Rewrote Stripe Connect payout webhook and deployed to prod").fill("Tested the timer");
  await page.getByPlaceholder("commit, PR, doc, deploy URL, sent email").fill("https://example.com/pr/1");
  await page.getByRole("button", { name: "File it" }).click();

  await expect(page.getByText("Tested the timer")).toBeVisible();
  await expect(page.getByText("VERIFIED ↗").first()).toBeVisible();
});

test("paused timer survives closing the app (reload) in paused state with frozen clock", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("UniTold / FrameFusion / Signals & Systems").fill("Persistence check");
  await page.getByRole("button", { name: "Start clock" }).click();
  await page.waitForTimeout(2000);
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByText("PAUSED", { exact: true })).toBeVisible();
  const frozen = await page.getByText(/^\d{2}:\d{2}:\d{2}$/).textContent();

  await page.reload();

  await expect(page.getByText("PAUSED", { exact: true })).toBeVisible();
  await expect(page.getByText(/^\d{2}:\d{2}:\d{2}$/)).toHaveText(frozen);
  // still resumable after reload
  await page.getByRole("button", { name: "Resume" }).click();
  await expect(page.getByText("PAUSED", { exact: true })).toHaveCount(0);
});

test("running (unpaused) timer survives reload and keeps counting", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("UniTold / FrameFusion / Signals & Systems").fill("Running reload");
  await page.getByRole("button", { name: "Start clock" }).click();
  await page.waitForTimeout(1200);
  await page.reload();
  await expect(page.getByRole("button", { name: "Stop" })).toBeVisible();
  const t1 = await page.getByText(/^\d{2}:\d{2}:\d{2}$/).textContent();
  await page.waitForTimeout(1500);
  const t2 = await page.getByText(/^\d{2}:\d{2}:\d{2}$/).textContent();
  expect(t2 > t1).toBeTruthy();
});

test("plant a tree: deducts wallet money and persists across reload", async ({ page }) => {
  // 300 verified minutes at €25/h = €125 in the wallet; a plot costs €50.
  await seed(page, {
    entries: [entry({ minutes: 300, project: "Forest fund", output: "earned the wallet" })],
    settings: { name: "", rate: 25, currency: "EUR" },
    running: null,
    lastProject: "",
    world: [],
  });
  await page.goto("/");

  await expect(page.getByText("€125.00").first()).toBeVisible();
  await expect(page.getByText(/planted 0\//)).toBeVisible();

  await page.locator("button.plot").first().click();
  await expect(page.getByText(/Planted in /)).toBeVisible();
  await expect(page.getByText(/planted 1\//)).toBeVisible();
  await expect(page.getByText("€75.00").first()).toBeVisible(); // 125 - 50

  await page.reload();
  await expect(page.getByText(/planted 1\//)).toBeVisible();
  await expect(page.getByText("€75.00").first()).toBeVisible();
});

test("cannot plant with an empty wallet", async ({ page }) => {
  await page.goto("/");
  await page.locator("button.plot").first().click();
  await expect(page.getByText(/Not enough in the wallet/)).toBeVisible();
  await expect(page.getByText(/planted 0\//)).toBeVisible();
});

test("edit an entry: reflection and rating save and persist", async ({ page }) => {
  await seed(page, {
    entries: [entry({ project: "Editable", output: "the entry to edit" })],
    settings: { name: "", rate: 25, currency: "EUR" },
    running: null,
    lastProject: "",
    world: [],
  });
  await page.goto("/");

  await page.getByText("the entry to edit").click();
  await expect(page.getByText("Session satisfaction")).toBeVisible();
  await page.locator("textarea").fill("Deep work went well; ship earlier next time.");
  await page.getByRole("button", { name: "8", exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();

  await expect(page.getByText("8/10")).toBeVisible();
  await expect(page.getByText(/Deep work went well/)).toBeVisible();

  await page.reload();
  await expect(page.getByText("8/10")).toBeVisible();
  await expect(page.getByText(/Deep work went well/)).toBeVisible();
});

test("bank statement groups Sun-Sat and export markdown has correct structure", async ({ page }) => {
  const now = new Date();
  const wSunday = sundayOf(now, 2); // Sunday two weeks back
  const wSaturday = addDays(wSunday, 6); // Saturday, same week
  const nextSunday = addDays(wSunday, 7); // next week's Sunday
  await seed(page, {
    entries: [
      entry({ date: dayKey(wSunday), minutes: 60, project: "WeekA", output: "sunday work" }),
      entry({ date: dayKey(wSaturday), minutes: 45, project: "WeekA", output: "saturday work" }),
      entry({ date: dayKey(nextSunday), minutes: 30, project: "WeekB", output: "next week work" }),
      entry({ date: dayKey(wSaturday), minutes: 25, project: "WeekA", output: "unverified work", evidence: "" }),
    ],
    settings: { name: "Tester", rate: 25, currency: "EUR" },
    running: null,
    lastProject: "",
    world: [],
  });
  await page.goto("/");

  // Sunday-start and Saturday-end land in the SAME week row; next Sunday starts a new one.
  const weekRows = page.getByRole("button", { name: /WEEK OF/ });
  await expect(weekRows).toHaveCount(2);

  // Verified week total for week A: 60 + 45 = 1h 45m (unverified 25m excluded)
  await weekRows.last().click();
  await expect(page.getByText("1h 45m").first()).toBeVisible();
  await expect(page.getByText("sunday work", { exact: true })).toBeVisible();
  await expect(page.getByText("saturday work", { exact: true })).toBeVisible();
  await expect(page.getByText(/unverified today: 0h 25m/)).toBeVisible();

  // Export and verify markdown structure
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export statement" }).click();
  const download = await downloadPromise;
  const md = fs.readFileSync(await download.path(), "utf-8");

  expect(md).toContain("# WORK STATEMENT — Tester");
  // Week headers keyed by the Sunday, verified totals minute-exact
  expect(md).toContain(`## Week of ${dayKey(wSunday)} — 1h 45m verified`);
  expect(md).toContain(`## Week of ${dayKey(nextSunday)} — 0h 30m verified`);
  // Day lines under the right week header, in ascending order
  const weekAIdx = md.indexOf(`## Week of ${dayKey(wSunday)}`);
  const weekBIdx = md.indexOf(`## Week of ${dayKey(nextSunday)}`);
  const satIdx = md.indexOf(`**${dayKey(wSaturday)}**`);
  expect(weekAIdx).toBeGreaterThan(-1);
  expect(satIdx).toBeGreaterThan(weekAIdx);
  expect(satIdx).toBeLessThan(weekBIdx);
  // Entry lines: minute formatting + evidence link + unverified marker
  expect(md).toContain("- `0h 45m` **WeekA** — saturday work · [evidence](https://example.com/evidence)");
  expect(md).toContain("- `0h 25m` **WeekA** — unverified work · _unverified_");
  expect(md).toContain("- `1h 00m` **WeekA** — sunday work");
});

test("export includes reflection and rating", async ({ page }) => {
  await seed(page, {
    entries: [
      entry({
        project: "Rated",
        output: "rated work",
        reflection: "Solid session.",
        rating: 9,
      }),
    ],
    settings: { name: "", rate: 25, currency: "EUR" },
    running: null,
    lastProject: "",
    world: [],
  });
  await page.goto("/");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export statement" }).click();
  const md = fs.readFileSync(await (await downloadPromise).path(), "utf-8");
  expect(md).toContain("**Rated** — rated work · [evidence](https://example.com/evidence) · 9/10");
  expect(md).toContain("  - _Solid session._");
});

test("grid cells carry hover tooltips (title) and aria labels", async ({ page }) => {
  await page.goto("/");
  const cell = page.locator("button.cell").first();
  await expect(cell).toHaveAttribute("title", /—/);
  await expect(cell).toHaveAttribute("aria-label", /\d{4}-\d{2}-\d{2}: .* hours/);
  const count = await page.locator("button.cell").count();
  expect(count).toBe(26 * 7);
});

test("focus session aborted early pays 0.5x", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("UniTold / FrameFusion / Signals & Systems").fill("Focus test");
  await page.getByRole("button", { name: "Focus 50′ · 1.5×" }).click();
  await expect(page.getByText("FOCUS · 50 min", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Abort — pays 0.5×" }).click();
  await page.getByRole("button", { name: "It's real — keep it" }).click();
  await expect(page.getByText("FOCUS ABORTED · 0.5×")).toBeVisible();
});
