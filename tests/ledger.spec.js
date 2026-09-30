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
  await page.goto("/#/world");

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
  await page.goto("/#/world");
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
  await page.goto("/#/ledger");

  // Sunday-start and Saturday-end land in the SAME week row; next Sunday starts a new one.
  const weekRows = page.getByRole("button", { name: /WEEK OF/ });
  await expect(weekRows).toHaveCount(2);

  // Verified week total for week A: 60 + 45 = 1h 45m (unverified 25m excluded)
  await weekRows.last().click();
  await expect(page.getByText("1h 45m").first()).toBeVisible();
  await expect(page.getByText("sunday work")).toBeVisible();
  await expect(page.getByText("saturday work")).toBeVisible();
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
  await page.goto("/#/ledger");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export statement" }).click();
  const md = fs.readFileSync(await (await downloadPromise).path(), "utf-8");
  expect(md).toContain("**Rated** — rated work · [evidence](https://example.com/evidence) · 9/10");
  expect(md).toContain("  - _Solid session._");
});

test("grid cells carry hover tooltips (title) and aria labels", async ({ page }) => {
  await page.goto("/#/ledger");
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

/* ---------- pages, insights and the bug fixes ---------- */

const baseState = (entries, settings = {}) => ({
  entries,
  settings: { name: "", rate: 25, currency: "EUR", dailyGoal: 4, weeklyGoal: 20, ...settings },
  running: null,
  lastProject: "",
  world: [],
});

test("header shows today / week / month / all-time totals and links into insights", async ({ page }) => {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15, 12);
  await seed(
    page,
    baseState([
      entry({ minutes: 90, mode: "focus", mult: 1.5 }),
      entry({ minutes: 30 }),
      entry({ date: dayKey(lastMonth), minutes: 600 }),
    ])
  );
  await page.goto("/");
  const frames = page.getByTestId("frames");
  const [today, , month, all] = [0, 1, 2, 3].map((i) => frames.getByRole("button").nth(i));
  await expect(today).toContainText("Today");
  await expect(today).toContainText("2h 00m");
  await expect(today).toContainText("1h 30m focus");
  await expect(month).toContainText("2h 00m");
  await expect(all).toContainText("12h 00m");

  await month.click();
  await expect(page).toHaveURL(/#\/insights\/month\//);
  await expect(page.getByTestId("stat-worked")).toContainText("2h 00m");
  await expect(page.getByTestId("stat-focus")).toContainText("1h 30m");
  await expect(page.getByTestId("stat-focus")).toContainText("75% of your time");
});

test("insights: switch periods and step back to the previous month", async ({ page }) => {
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 3, 12);
  await seed(page, baseState([entry({ minutes: 45 }), entry({ date: dayKey(prevMonth), minutes: 200, project: "Older" })]));
  await page.goto("/#/insights");

  await page.getByRole("tab", { name: "Month" }).click();
  const monthName = now.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  await expect(page.getByTestId("period-label")).toHaveText(monthName);
  await expect(page.getByText("in progress")).toBeVisible();
  await expect(page.getByRole("button", { name: "Next period" })).toBeDisabled();

  await page.getByRole("button", { name: "Previous period" }).click();
  const prevName = prevMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  await expect(page.getByTestId("period-label")).toHaveText(prevName);
  await expect(page.getByTestId("stat-worked")).toContainText("3h 20m");
  await expect(page.getByText("Older", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "This month", exact: true }).click();
  await expect(page.getByTestId("period-label")).toHaveText(monthName);

  await page.getByRole("tab", { name: "All time" }).click();
  await expect(page.getByTestId("stat-worked")).toContainText("4h 05m");
});

test("insights: the honest read calls out missing focus and unverified time", async ({ page }) => {
  await seed(page, baseState([entry({ minutes: 60 }), entry({ minutes: 60, evidence: "" })]));
  await page.goto(`/#/insights/day/${dayKey(new Date())}`);
  const read = page.getByTestId("honest-read");
  await expect(read).toContainText("No focus sessions");
  await expect(read).toContainText("1h 00m (50%) has no evidence link");
  // the day view lists that day's blocks
  await expect(page.getByText("seeded work")).toHaveCount(2);
});

test("clicking a day in the record grid opens it right under the grid", async ({ page }) => {
  const y = addDays(new Date(), -1);
  await seed(page, baseState([entry({ date: dayKey(y), output: "yesterday's block" })]));
  await page.goto("/#/ledger");
  await page.locator(`button.cell[aria-label^="${dayKey(y)}"]`).click();
  const detail = page.getByTestId("day-detail");
  await expect(detail).toBeInViewport();
  await expect(detail.getByText("yesterday's block")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`#/ledger/${dayKey(y)}$`));
});

test("record tiles on Today open the matching day in insights", async ({ page }) => {
  const d = addDays(new Date(), -3);
  await seed(page, baseState([entry({ date: dayKey(d), minutes: 300 })]));
  await page.goto("/");
  await page.getByRole("button", { name: /Day record/ }).click();
  await expect(page).toHaveURL(new RegExp(`#/insights/day/${dayKey(d)}$`));
  await expect(page.getByTestId("stat-worked")).toContainText("5h 00m");
});

test("saving an entry with a cleared date is refused instead of corrupting it", async ({ page }) => {
  await seed(page, baseState([entry({ output: "keep my date" })]));
  await page.goto("/");
  await page.getByText("keep my date").click();
  await page.locator('input[type="date"]').fill("");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/Pick a valid date/)).toBeVisible();
  const dates = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).entries.map((e) => e.date), KEY);
  expect(dates).toEqual([dayKey(new Date())]);
});

test("filing a block without 'what shipped' explains why instead of doing nothing", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Log past block" }).click();
  await page.locator("#draft input").nth(3).fill("Manual project");
  await page.getByRole("button", { name: "File it" }).click();
  await expect(page.getByText(/Write one line about what shipped/)).toBeVisible();

  await page.getByPlaceholder("Rewrote Stripe Connect payout webhook and deployed to prod").fill("Wrote the report");
  await page.locator('#draft input[type="time"]').fill("14:30");
  await page.getByRole("button", { name: "File it" }).click();
  await expect(page.getByText("Wrote the report")).toBeVisible();
  const e = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).entries[0], KEY);
  expect(e.started).toBe("14:30");
  expect(new Date(e.startedAt).getHours()).toBe(14);
});

test("a running clock shows in the nav on other pages", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("UniTold / FrameFusion / Signals & Systems").fill("Background run");
  await page.getByRole("button", { name: "Start clock" }).click();
  await page.getByRole("link", { name: "INSIGHTS" }).click();
  await expect(page.getByTestId("running-pill")).toContainText("Background run");
  await page.getByTestId("running-pill").click();
  await expect(page.getByRole("button", { name: "Stop" })).toBeVisible();
});

test("goals are editable and drive the daily goal bar", async ({ page }) => {
  await seed(page, baseState([entry({ minutes: 150 })], { dailyGoal: 2 }));
  await page.goto("/");
  await expect(page.getByText(/goal hit — 0h 30m over/)).toBeVisible();
  await page.getByRole("button", { name: "edit" }).click();
  const goalInput = page.locator("input[step='0.5']");
  await goalInput.fill("5");
  await expect(page.getByText(/2h 30m to go/)).toBeVisible();
});

/* ---------- backup & restore ---------- */

// Exactly what the pre-insights version kept in localStorage.
const oldVersionState = () => ({
  entries: [
    entry({ id: "old-1", date: dayKey(addDays(new Date(), -2)), minutes: 120, project: "OldProj", output: "old focus", mode: "focus", mult: 1.5, started: "09:15 AM" }),
    entry({ id: "old-2", date: dayKey(addDays(new Date(), -1)), minutes: 45, project: "OldProj", output: "old unverified", evidence: "" }),
  ],
  settings: { name: "Datallain", rate: 30, currency: "EUR" },
  running: null,
  lastProject: "OldProj",
  world: [900],
  savedAt: Date.now(),
});

test("restore pasted data copied from another address's browser storage", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("empty-hint")).toBeVisible();
  await page.getByRole("button", { name: "Restore my history →" }).click();
  await expect(page).toHaveURL(/#\/ledger\/backup$/);

  // copy(localStorage.getItem(...)) yields the raw JSON string
  await page.getByLabel("Backup data").fill(JSON.stringify(oldVersionState()));
  await expect(page.getByTestId("backup")).toContainText("Found 2 blocks · 2h 45m");
  await page.getByRole("button", { name: "Restore these blocks" }).click();
  await expect(page.getByText("Restored 2 blocks and 1 forest plot.")).toBeVisible();

  // settings come across into a fresh ledger; focus multiplier survives: 120min × 1.5 at €30/h = €90
  await expect(page.getByText("DATALLAIN · €30/HR BASE", { exact: false })).toBeVisible();
  await page.reload();
  await page.goto("/#/insights/all");
  await expect(page.getByTestId("stat-worked")).toContainText("2h 45m");
  await expect(page.getByTestId("stat-focus")).toContainText("2h 00m");

  // restoring the same thing again adds nothing
  await page.goto("/#/ledger/backup");
  await page.getByLabel("Backup data").fill(JSON.stringify(JSON.stringify(oldVersionState()))); // double-quoted paste
  await page.getByRole("button", { name: "Restore these blocks" }).click();
  await expect(page.getByText("Restored 0 blocks (2 already here, skipped).")).toBeVisible();
});

test("restore never overwrites existing blocks or settings", async ({ page }) => {
  await seed(page, baseState([entry({ output: "already here" })], { name: "Current", rate: 40 }));
  await page.goto("/#/ledger/backup");
  await page.getByLabel("Backup data").fill(JSON.stringify(oldVersionState()));
  await page.getByRole("button", { name: "Restore these blocks" }).click();
  await expect(page.getByText(/Restored 2 blocks/)).toBeVisible();
  const s = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
  expect(s.entries.map((e) => e.output).sort()).toEqual(["already here", "old focus", "old unverified"]);
  expect(s.settings.name).toBe("Current");
  expect(s.settings.rate).toBe(40);
});

test("download a backup, then restore it and a statement file in a fresh browser", async ({ page, browser }) => {
  await seed(page, baseState([entry({ output: "backed up", reflection: "note to self", rating: 7 }), entry({ output: "second", evidence: "" })]));
  await page.goto("/#/ledger");

  const dl1 = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download backup \(2 blocks\)/ }).click();
  const backupPath = await (await dl1).path();
  const backup = JSON.parse(fs.readFileSync(backupPath, "utf-8"));
  expect(backup.app).toBe("workledger");
  expect(backup.entries).toHaveLength(2);

  const dl2 = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export statement" }).click();
  const mdPath = await (await dl2).path();

  // fresh context = a different browser with empty storage
  const ctx = await browser.newContext();
  const fresh = await ctx.newPage();
  await fresh.goto("/#/ledger/backup");
  await fresh.locator('#backup input[type="file"]').setInputFiles({ name: "statement.md", mimeType: "text/markdown", buffer: fs.readFileSync(mdPath) });
  await expect(fresh.getByTestId("backup")).toContainText("Found 2 blocks");
  await expect(fresh.getByTestId("backup")).toContainText("From a statement file");
  await fresh.getByRole("button", { name: "Restore these blocks" }).click();
  const restored = await fresh.evaluate((k) => JSON.parse(localStorage.getItem(k)).entries, KEY);
  const b = restored.find((e) => e.output === "backed up");
  expect(b.reflection).toBe("note to self");
  expect(b.rating).toBe(7);
  expect(b.evidence).toBe("https://example.com/evidence");
  expect(restored.find((e) => e.output === "second").evidence).toBe("");

  // the JSON backup on top adds nothing new (same content)
  await fresh.locator('#backup input[type="file"]').setInputFiles(backupPath);
  await fresh.getByRole("button", { name: "Restore these blocks" }).click();
  await expect(fresh.getByText("Restored 0 blocks (2 already here, skipped).")).toBeVisible();
  await ctx.close();
});

test("restore rejects junk with a clear message", async ({ page }) => {
  await page.goto("/#/ledger/backup");
  await page.getByLabel("Backup data").fill("hello this is not data");
  await expect(page.getByText(/doesn't look like Work Ledger data/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Restore these blocks" })).toHaveCount(0);
});

test("backup reminder appears until you download a backup; version stamp is shown", async ({ page }) => {
  await seed(page, baseState([entry()]));
  await page.goto("/");
  await expect(page.getByTestId("version")).toContainText(/version \w+ · built/);
  const reminder = page.getByTestId("backup-reminder");
  await expect(reminder).toContainText("No backup yet.");
  const dl = page.waitForEvent("download");
  await reminder.getByRole("button", { name: "Download backup" }).click();
  expect((await dl).suggestedFilename()).toMatch(/^workledger-backup-.*\.json$/);
  await expect(reminder).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("backup-reminder")).toHaveCount(0);
});
