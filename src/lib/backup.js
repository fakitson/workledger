import { isValidKey, uid } from "./dates";

/* Backup / restore. Accepts:
   - a backup file made by this app ({ app: "workledger", entries, settings, world })
   - the raw saved state copied out of another address's browser storage
     (localStorage "worklog:v1"), even if it arrives double-quoted
   - a bare array of entries
   - the markdown "Export statement" from any version (lossy: no focus
     multipliers or start times survive in that format) */

export function makeBackup({ entries, settings, world }) {
  return JSON.stringify({ app: "workledger", version: 1, exportedAt: new Date().toISOString(), entries, settings, world }, null, 2);
}

const cleanEntry = (e) => {
  if (!e || typeof e !== "object" || !isValidKey(e.date)) return null;
  const minutes = Math.round(Number(e.minutes));
  if (!Number.isFinite(minutes) || minutes < 1) return null;
  return {
    ...e,
    id: typeof e.id === "string" && e.id ? e.id : uid(),
    minutes,
    project: String(e.project ?? "").trim() || "Untitled",
    output: String(e.output ?? "").trim() || "(no description)",
    evidence: String(e.evidence ?? ""),
    mult: typeof e.mult === "number" ? e.mult : 1,
    mode: e.mode === "focus" ? "focus" : "normal",
    pauseCount: Number(e.pauseCount) || 0,
    started: e.started || "—",
    suspect: false,
  };
};

function parseStatement(text) {
  const entries = [];
  let date = null;
  let last = null;
  for (const raw of text.split(/\r?\n/)) {
    const day = /^\*\*(\d{4}-\d{2}-\d{2})\*\*/.exec(raw);
    if (day) {
      date = day[1];
      continue;
    }
    const m = /^- `(\d+)h (\d{2})m` \*\*(.+?)\*\* — (.*?)(?: · \[evidence\]\((.+)\)| · _unverified_)(?: · (\d{1,2})\/10)?\s*$/.exec(raw);
    if (m && date) {
      last = {
        date,
        minutes: Number(m[1]) * 60 + Number(m[2]),
        project: m[3],
        output: m[4],
        evidence: m[5] || "",
        ...(m[6] ? { rating: Number(m[6]) } : {}),
        imported: "statement",
      };
      entries.push(last);
      continue;
    }
    const refl = /^ {2}- _(.*)_\s*$/.exec(raw);
    if (refl && last) last.reflection = refl[1];
  }
  return { entries, settings: null, world: null, lossy: true };
}

export function parseBackup(text) {
  const t = String(text || "").trim();
  if (!t) throw new Error("Nothing to restore — paste your data or choose a file.");
  if (t.startsWith("# WORK STATEMENT") || /^\*\*\d{4}-\d{2}-\d{2}\*\*/m.test(t)) {
    const r = parseStatement(t);
    if (!r.entries.length) throw new Error("That statement has no entries in it.");
    return finish(r);
  }
  let data;
  try {
    data = JSON.parse(t);
    if (typeof data === "string") data = JSON.parse(data);
  } catch {
    throw new Error("That doesn't look like Work Ledger data. Paste exactly what was copied, or choose the backup file.");
  }
  if (Array.isArray(data)) return finish({ entries: data, settings: null, world: null });
  if (!data || typeof data !== "object" || !Array.isArray(data.entries)) throw new Error("No entries found in that data.");
  return finish({
    entries: data.entries,
    settings: data.settings && typeof data.settings === "object" ? data.settings : null,
    world: Array.isArray(data.world) ? data.world.filter((i) => Number.isInteger(i)) : null,
  });
}

function finish(r) {
  const entries = r.entries.map(cleanEntry).filter(Boolean);
  return { ...r, entries, rejected: r.entries.length - entries.length };
}

const signature = (e) => [e.date, e.minutes, e.project.trim().toLowerCase(), e.output.trim().toLowerCase()].join("|");

// Adds entries that aren't already present (by id or by identical content); never deletes.
export function mergeBackup(current, incoming, defaults) {
  const ids = new Set(current.entries.map((e) => e.id));
  const sigs = new Set(current.entries.map(signature));
  const added = [];
  for (const e of incoming.entries) {
    if (ids.has(e.id) || sigs.has(signature(e))) continue;
    ids.add(e.id);
    sigs.add(signature(e));
    added.push(e);
  }
  const world = incoming.world ? [...new Set([...current.world, ...incoming.world])] : current.world;
  const untouchedSettings = ["name", "rate", "currency"].every((k) => current.settings[k] === defaults[k]);
  const settings = incoming.settings && untouchedSettings ? { ...current.settings, ...incoming.settings } : current.settings;
  return {
    entries: [...current.entries, ...added],
    world,
    settings,
    added: added.length,
    duplicates: incoming.entries.length - added.length,
    plots: world.length - current.world.length,
  };
}
