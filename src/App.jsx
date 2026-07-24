import React, { useState, useEffect, useMemo, useRef } from "react";
import { loadState, saveState } from "./storage";

const C = {
  paper: "#E6ECE2",
  paperDeep: "#DBE3D6",
  card: "#EFF3EC",
  rule: "#A9BCA6",
  ruleFaint: "#C4D2C0",
  ink: "#18241F",
  inkSoft: "#5E6F65",
  stamp: "#2B4A7A",
  red: "#A62B21",
  gold: "#8A6D1F",
  shadow: "#6E7F74",
  ocean: "#C9D8DC",
  soil: "#CBB98F",
  forest: "#2F6B33",
  fill: ["#DBE3D6", "#B6CBA9", "#87AD79", "#54844B", "#2A5A2E"],
};

const MONO = "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace";
const DISP = "'Oswald', 'Arial Narrow', Impact, sans-serif";
const CURRENCIES = { EUR: "€", USD: "$", GBP: "£", BRL: "R$" };
const PLOT_PRICE_MIN = 120; // 120 rate-minutes = €50 at €25/h

/* ---------- date helpers ---------- */
const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const fmtDay = (key) =>
  new Date(key + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
const hrs = (m) => (m / 60).toFixed(m % 60 === 0 ? 0 : 1);
const fmtMin = (m) => `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, "0")}m`;
const clockFmt = (sec) =>
  `${String(Math.floor(sec / 3600)).padStart(2, "0")}:${String(Math.floor((sec % 3600) / 60)).padStart(2, "0")}:${String(
    Math.floor(sec % 60)
  ).padStart(2, "0")}`;

/* ---------- pixel earth: 5° grid, 72 x 33 (85N..-80S) ---------- */
const COLS = 72;
const ROWS = 33;
const inBox = (lat, lon, a, b, c, d) => lat >= a && lat <= b && lon >= c && lon <= d;
const isLand = (lat, lon) => {
  // North America
  if (inBox(lat, lon, 55, 71, -166, -140)) return true; // Alaska
  if (inBox(lat, lon, 50, 70, -130, -60)) return true; // Canada
  if (inBox(lat, lon, 30, 50, -124, -70)) return true; // USA
  if (inBox(lat, lon, 15, 30, -115, -86)) return true; // Mexico
  if (inBox(lat, lon, 8, 15, -92, -77)) return true; // Central America
  if (inBox(lat, lon, 60, 82, -52, -22)) return true; // Greenland
  // South America
  if (inBox(lat, lon, 0, 11, -80, -50)) return true;
  if (inBox(lat, lon, -20, 0, -79, -35)) return true;
  if (inBox(lat, lon, -35, -20, -72, -40)) return true;
  if (inBox(lat, lon, -55, -35, -74, -62)) return true;
  // Africa
  if (inBox(lat, lon, 20, 36, -14, 34)) return true;
  if (inBox(lat, lon, 5, 20, -17, 50)) return true;
  if (inBox(lat, lon, -10, 5, 8, 43)) return true;
  if (inBox(lat, lon, -35, -10, 12, 40)) return true;
  if (inBox(lat, lon, -25, -12, 43, 50)) return true; // Madagascar
  // Europe
  if (inBox(lat, lon, 44, 60, -9, 40)) return true;
  if (inBox(lat, lon, 36, 44, -9, 28)) return true; // Iberia + Med
  if (inBox(lat, lon, 58, 70, 5, 30)) return true; // Scandinavia
  if (inBox(lat, lon, 50, 59, -10, 1)) return true; // UK + Ireland
  // Asia
  if (inBox(lat, lon, 50, 76, 40, 179)) return true; // Russia
  if (inBox(lat, lon, 35, 50, 40, 135)) return true; // Central Asia + China
  if (inBox(lat, lon, 20, 35, 60, 122)) return true; // India + S China
  if (inBox(lat, lon, 8, 20, 73, 79)) return true; // S India
  if (inBox(lat, lon, 8, 20, 95, 109)) return true; // SE Asia
  if (inBox(lat, lon, 15, 32, 34, 59)) return true; // Arabia
  if (inBox(lat, lon, -9, 6, 95, 141)) return true; // Indonesia + PNG
  if (inBox(lat, lon, 31, 44, 129, 143)) return true; // Japan
  // Oceania
  if (inBox(lat, lon, -38, -12, 113, 154)) return true; // Australia
  if (inBox(lat, lon, -46, -34, 166, 178)) return true; // NZ
  return false;
};
const regionOf = (lat, lon) => {
  if (inBox(lat, lon, -34, 5, -74, -35)) return "Brazil";
  if (inBox(lat, lon, 50, 54, 3, 8)) return "Netherlands";
  if (inBox(lat, lon, 36, 44, -9, 4)) return "Spain";
  if (lon < -30 && lat > 13) return "North America";
  if (lon < -30) return "South America";
  if (lat > 36 && lon < 45) return "Europe";
  if (lat > 12 && lon < 34 && lon >= -17) return "Africa";
  if (lon >= -17 && lon < 52 && lat <= 36) return "Africa";
  if (lat < -10 && lon > 110) return "Oceania";
  return "Asia";
};
const CELLS = (() => {
  const out = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const lat = 85 - r * 5 - 2.5;
      const lon = -180 + c * 5 + 2.5;
      if (isLand(lat, lon)) out.push({ i: r * COLS + c, r, c, region: regionOf(lat, lon) });
    }
  }
  return out;
})();
const LAND_SET = new Set(CELLS.map((x) => x.i));
const REGION_TOTALS = CELLS.reduce((a, x) => ((a[x.region] = (a[x.region] || 0) + 1), a), {});

export default function WorkLedger() {
  const [ready, setReady] = useState(false);
  const [entries, setEntries] = useState([]);
  const [settings, setSettings] = useState({ name: "", rate: 25, currency: "EUR" });
  const [running, setRunning] = useState(null);
  const [tick, setTick] = useState(0);
  const [draft, setDraft] = useState(null);
  const [selDay, setSelDay] = useState(null);
  const [projectField, setProjectField] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showPayslip, setShowPayslip] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [openWeeks, setOpenWeeks] = useState({});
  const [world, setWorld] = useState([]); // planted cell indices
  const [worldMsg, setWorldMsg] = useState("");
  const [editId, setEditId] = useState(null);
  const [edit, setEdit] = useState(null);
  const first = useRef(true);

  useEffect(() => {
    (async () => {
      const s = await loadState();
      if (s) {
        setEntries(s.entries || []);
        setSettings(s.settings || { name: "", rate: 25, currency: "EUR" });
        setRunning(s.running || null);
        setProjectField(s.running?.project || s.lastProject || "");
        setWorld(s.world || []);
      }
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (first.current) {
      first.current = false;
      return;
    }
    saveState({ entries, settings, running, lastProject: projectField, world });
  }, [entries, settings, running, ready, projectField, world]);

  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), running ? 1000 : 30000);
    return () => clearInterval(i);
  }, [running]);

  const sym = CURRENCIES[settings.currency] || "€";

  /* ---------- timer ---------- */
  const effMs = (r, at = Date.now()) => {
    if (!r) return 0;
    const paused = r.pausedMs + (r.pausedAt ? at - r.pausedAt : 0);
    return at - r.startedAt - paused;
  };
  const elapsedSec = running ? Math.max(0, Math.floor(effMs(running) / 1000)) : 0;
  const focusDone = running?.mode === "focus" && elapsedSec >= running.targetMin * 60;
  const focusLeft = running?.mode === "focus" ? Math.max(0, running.targetMin * 60 - elapsedSec) : 0;

  /* ---------- derived ---------- */
  const byDay = useMemo(() => {
    const m = {};
    entries.forEach((e) => {
      (m[e.date] = m[e.date] || []).push(e);
    });
    return m;
  }, [entries]);

  const verMinOn = (key) =>
    (byDay[key] || []).filter((e) => e.evidence?.trim()).reduce((s, e) => s + e.minutes, 0);

  const stats = useMemo(() => {
    let vMin = 0,
      uMin = 0,
      payMin = 0,
      last28PayMin = 0;
    const cutoff = dayKey(addDays(new Date(), -28));
    entries.forEach((e) => {
      const mult = e.mult || 1;
      if (e.evidence && e.evidence.trim()) {
        vMin += e.minutes;
        payMin += e.minutes * mult;
        if (e.date >= cutoff) last28PayMin += e.minutes * mult;
      } else uMin += e.minutes;
    });
    let streak = 0;
    let cursor = new Date();
    if (!(byDay[dayKey(cursor)] || []).some((e) => e.evidence?.trim())) cursor = addDays(cursor, -1);
    while ((byDay[dayKey(cursor)] || []).some((e) => e.evidence?.trim())) {
      streak++;
      cursor = addDays(cursor, -1);
    }
    const weeklyRun = last28PayMin / 4;
    return { vMin, uMin, payMin, streak, weeklyRun, annualMin: weeklyRun * 52 };
  }, [entries, byDay]);

  const spentMin = world.length * PLOT_PRICE_MIN;
  const walletMin = stats.payMin - spentMin;

  /* ---------- shadow race ---------- */
  const race = useMemo(() => {
    const now = new Date();
    const todayIdx = now.getDay();
    const weekStart = addDays(now, -todayIdx);
    let mine = 0;
    for (let d = 0; d <= todayIdx; d++) mine += verMinOn(dayKey(addDays(weekStart, d)));
    const h = now.getHours() + now.getMinutes() / 60;
    const frac = Math.min(1, Math.max(0, (h - 6) / 16));
    let weeksWithData = 0,
      total = 0,
      fullWeekTotal = 0;
    for (let w = 1; w <= 4; w++) {
      const ws = addDays(weekStart, -7 * w);
      let any = false,
        sum = 0,
        full = 0;
      for (let d = 0; d < 7; d++) {
        const m = verMinOn(dayKey(addDays(ws, d)));
        full += m;
        if (m > 0) any = true;
        if (d < todayIdx) sum += m;
        if (d === todayIdx) sum += frac * m;
      }
      if (!any) continue;
      weeksWithData++;
      total += sum;
      fullWeekTotal += full;
    }
    return {
      mine,
      shadowNow: weeksWithData ? total / weeksWithData : 0,
      shadowFullWeek: weeksWithData ? fullWeekTotal / weeksWithData : 0,
      weeksWithData,
    };
  }, [byDay, tick]);

  /* ---------- records ---------- */
  const prs = useMemo(() => {
    const dayTotals = {};
    entries.forEach((e) => {
      if (e.evidence?.trim()) dayTotals[e.date] = (dayTotals[e.date] || 0) + e.minutes;
    });
    let bestDay = { key: null, min: 0 };
    Object.entries(dayTotals).forEach(([k, m]) => {
      if (m > bestDay.min) bestDay = { key: k, min: m };
    });
    const weekTotals = {};
    Object.entries(dayTotals).forEach(([k, m]) => {
      const d = new Date(k + "T12:00:00");
      const ws = dayKey(addDays(d, -d.getDay()));
      weekTotals[ws] = (weekTotals[ws] || 0) + m;
    });
    let bestWeek = { key: null, min: 0 };
    Object.entries(weekTotals).forEach(([k, m]) => {
      if (m > bestWeek.min) bestWeek = { key: k, min: m };
    });
    const todayKey = dayKey(new Date());
    const thisWeekKey = dayKey(addDays(new Date(), -new Date().getDay()));
    return {
      bestDay,
      bestWeek,
      today: dayTotals[todayKey] || 0,
      dayRecordIsToday: bestDay.key === todayKey && bestDay.min > 0,
      weekRecordIsNow: bestWeek.key === thisWeekKey && bestWeek.min > 0,
    };
  }, [entries]);

  /* ---------- payslip ---------- */
  const payslip = useMemo(() => {
    const now = new Date();
    const ws = dayKey(addDays(now, -now.getDay()));
    const we = dayKey(addDays(now, 6 - now.getDay()));
    let baseMin = 0,
      focusMin = 0,
      abortMin = 0;
    entries.forEach((e) => {
      if (!e.evidence?.trim() || e.date < ws || e.date > we) return;
      const m = e.mult || 1;
      if (m === 1.5) focusMin += e.minutes;
      else if (m === 0.5) abortMin += e.minutes;
      else baseMin += e.minutes;
    });
    return {
      ws,
      baseMin,
      focusMin,
      abortMin,
      grossMin: baseMin + focusMin * 1.5 + abortMin * 0.5,
      premiumMin: focusMin * 0.5,
      penaltyMin: abortMin * 0.5,
      totalHrs: baseMin + focusMin + abortMin,
      isPayday: (now.getDay() === 5 && now.getHours() >= 18) || now.getDay() === 6,
    };
  }, [entries, tick]);

  /* ---------- bank statement: weeks -> days -> entries, minute-exact ---------- */
  const bank = useMemo(() => {
    const weeks = {};
    entries.forEach((e) => {
      const d = new Date(e.date + "T12:00:00");
      const ws = dayKey(addDays(d, -d.getDay()));
      const w = (weeks[ws] = weeks[ws] || { ws, vMin: 0, payMin: 0, uMin: 0, days: {} });
      const day = (w.days[e.date] = w.days[e.date] || { vMin: 0, payMin: 0, uMin: 0, list: [] });
      day.list.push(e);
      if (e.evidence?.trim()) {
        const p = e.minutes * (e.mult || 1);
        w.vMin += e.minutes;
        w.payMin += p;
        day.vMin += e.minutes;
        day.payMin += p;
      } else {
        w.uMin += e.minutes;
        day.uMin += e.minutes;
      }
    });
    return Object.values(weeks).sort((a, b) => b.ws.localeCompare(a.ws));
  }, [entries]);

  const grid = useMemo(() => {
    const today = new Date();
    const end = addDays(today, 6 - today.getDay());
    const start = addDays(end, -(26 * 7) + 1);
    const weeks = [];
    for (let w = 0; w < 26; w++) {
      const col = [];
      for (let d = 0; d < 7; d++) {
        const date = addDays(start, w * 7 + d);
        const key = dayKey(date);
        const list = byDay[key] || [];
        const mins = list.reduce((s, e) => s + e.minutes, 0);
        col.push({ key, mins, future: date > today, verified: list.some((e) => e.evidence?.trim()) });
      }
      weeks.push(col);
    }
    return weeks;
  }, [byDay]);

  const level = (m) => (m === 0 ? 0 : m < 60 ? 1 : m < 150 ? 2 : m < 300 ? 3 : 4);

  /* ---------- actions ---------- */
  const inCooldown = Date.now() < cooldownUntil;
  const start = (mode, targetMin = 0) => {
    if (!projectField.trim() || Date.now() < cooldownUntil) return;
    setRunning({ startedAt: Date.now(), project: projectField.trim(), mode, targetMin, pausedMs: 0, pausedAt: null, pauseCount: 0 });
  };
  const pause = () => setRunning((r) => (r && !r.pausedAt ? { ...r, pausedAt: Date.now(), pauseCount: r.pauseCount + 1 } : r));
  const resume = () =>
    setRunning((r) => (r && r.pausedAt ? { ...r, pausedMs: r.pausedMs + (Date.now() - r.pausedAt), pausedAt: null } : r));
  const stop = () => {
    const mins = Math.max(1, Math.round(effMs(running) / 60000));
    let mult = 1;
    if (running.mode === "focus") mult = mins >= running.targetMin ? 1.5 : 0.5;
    setDraft({
      id: crypto.randomUUID(),
      date: dayKey(new Date()),
      minutes: mins,
      project: running.project,
      output: "",
      evidence: "",
      mult,
      mode: running.mode,
      pauseCount: running.pauseCount,
      targetMin: running.targetMin,
      started: new Date(running.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      suspect: mins < 5,
    });
    setRunning(null);
    setCooldownUntil(Date.now() + 3000);
  };
  const manual = () =>
    setDraft({
      id: crypto.randomUUID(),
      date: dayKey(new Date()),
      minutes: 60,
      project: projectField || "",
      output: "",
      evidence: "",
      mult: 1,
      mode: "normal",
      pauseCount: 0,
      started: "—",
      manual: true,
    });
  const commit = () => {
    if (!draft.project.trim() || !draft.output.trim()) return;
    setEntries((e) => [...e, { ...draft, project: draft.project.trim(), output: draft.output.trim(), suspect: false }]);
    setProjectField(draft.project.trim());
    setDraft(null);
  };
  const remove = (id) => setEntries((e) => e.filter((x) => x.id !== id));

  const openEdit = (entry) => {
    if (!entry) {
      setEditId(null);
      setEdit(null);
      return;
    }
    setEditId(entry.id);
    setEdit({
      date: entry.date,
      minutes: entry.minutes,
      project: entry.project,
      output: entry.output,
      evidence: entry.evidence || "",
      reflection: entry.reflection || "",
      rating: typeof entry.rating === "number" ? entry.rating : null,
    });
  };
  const saveEdit = () => {
    setEntries((list) =>
      list.map((x) =>
        x.id === editId
          ? {
              ...x,
              date: edit.date,
              minutes: edit.minutes,
              project: edit.project.trim() || x.project,
              output: edit.output.trim() || x.output,
              evidence: edit.evidence.trim(),
              reflection: edit.reflection.trim(),
              rating: edit.rating,
            }
          : x
      )
    );
    setEditId(null);
    setEdit(null);
  };

  const plant = (cell) => {
    if (world.includes(cell.i)) {
      setWorldMsg(`${cell.region}: already forested.`);
      return;
    }
    if (walletMin < PLOT_PRICE_MIN) {
      setWorldMsg(`Not enough in the wallet — a plot costs ${money(PLOT_PRICE_MIN)}. Go earn it.`);
      return;
    }
    setWorld((w) => [...w, cell.i]);
    setWorldMsg(`Planted in ${cell.region} — ${money(PLOT_PRICE_MIN)} spent.`);
  };

  const exportStatement = () => {
    let out = `# WORK STATEMENT${settings.name ? " — " + settings.name : ""}\n\n`;
    out += `Base rate: ${sym}${settings.rate}/hr · Generated ${new Date().toISOString().slice(0, 10)}\n\n`;
    out += `**Verified: ${fmtMin(stats.vMin)}** (hours are actual clock time — focus premiums affect pay only)  \n`;
    out += `Run-rate: ${sym}${((stats.weeklyRun / 60) * settings.rate).toFixed(0)}/wk pace  \n`;
    out += `Unverified (excluded): ${fmtMin(stats.uMin)}\n\n---\n\n`;
    [...bank]
      .sort((a, b) => a.ws.localeCompare(b.ws))
      .forEach((w) => {
        out += `## Week of ${w.ws} — ${fmtMin(w.vMin)} verified (${sym}${((w.payMin / 60) * settings.rate).toFixed(2)})\n\n`;
        Object.keys(w.days)
          .sort()
          .forEach((dk) => {
            const day = w.days[dk];
            out += `**${dk}** — ${fmtMin(day.vMin)} (${sym}${((day.payMin / 60) * settings.rate).toFixed(2)})\n\n`;
            day.list.forEach((e) => {
              out += `- \`${fmtMin(e.minutes)}\` **${e.project}** — ${e.output}${
                e.evidence?.trim() ? ` · [evidence](${e.evidence.trim()})` : " · _unverified_"
              }${typeof e.rating === "number" ? ` · ${e.rating}/10` : ""}\n`;
              if (e.reflection?.trim()) out += `  - _${e.reflection.trim()}_\n`;
            });
            out += "\n";
          });
      });
    const blob = new Blob([out], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `work-statement-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
  };

  if (!ready)
    return <div style={{ background: C.paper, color: C.inkSoft, fontFamily: MONO, padding: 40 }}>Opening the ledger…</div>;

  const money = (m) =>
    `${sym}${((m / 60) * settings.rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const label = { fontFamily: DISP, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: C.inkSoft };
  const input = {
    fontFamily: MONO,
    fontSize: 13,
    background: "transparent",
    border: "none",
    borderBottom: `1px solid ${C.rule}`,
    color: C.ink,
    padding: "6px 2px",
    width: "100%",
    outline: "none",
  };
  const btn = (bg, fg) => ({
    fontFamily: DISP,
    fontSize: 12,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    background: bg,
    color: fg,
    border: "none",
    padding: "10px 18px",
    cursor: "pointer",
  });

  const delta = race.mine - race.shadowNow;
  const ahead = delta >= 0;
  const barMax = Math.max(race.mine, race.shadowNow, 60) * 1.15;
  const draftPay = draft ? draft.minutes * (draft.mult || 1) : 0;
  const plantedSet = new Set(world);
  const regionPlanted = CELLS.reduce((a, x) => (plantedSet.has(x.i) ? ((a[x.region] = (a[x.region] || 0) + 1), a) : a), {});
  const worldPct = ((world.length / CELLS.length) * 100).toFixed(1);

  return (
    <div style={{ background: C.paper, color: C.ink, fontFamily: MONO, minHeight: "100%", padding: "0 0 48px" }}>
      {/* header */}
      <div style={{ borderBottom: `2px solid ${C.ink}`, padding: "22px 20px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontFamily: DISP, fontSize: 34, fontWeight: 600, letterSpacing: "0.06em", lineHeight: 1 }}>TIMESHEET</div>
            <div style={{ ...label, marginTop: 6 }}>
              {settings.name || "unsigned"} · {sym}
              {settings.rate}/hr base
              <button
                onClick={() => setShowSettings((s) => !s)}
                style={{ ...label, background: "none", border: "none", cursor: "pointer", color: C.stamp, marginLeft: 10 }}
              >
                edit
              </button>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={label}>Wallet · spendable</div>
            <div style={{ fontFamily: DISP, fontSize: 40, fontWeight: 600, color: C.red, lineHeight: 1 }}>{money(walletMin)}</div>
            <div style={{ fontSize: 12, color: C.inkSoft }}>
              lifetime earned {money(stats.payMin)} · {fmtMin(stats.vMin)} banked
            </div>
            {stats.weeklyRun > 0 && (
              <div style={{ fontSize: 11, color: C.stamp, marginTop: 4 }}>
                pace: {money(stats.weeklyRun)}/wk → {money(stats.annualMin)}/yr operation
              </div>
            )}
          </div>
        </div>

        {showSettings && (
          <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 160px" }}>
              <div style={label}>Name on statement</div>
              <input style={input} value={settings.name} placeholder="your name" onChange={(e) => setSettings({ ...settings, name: e.target.value })} />
            </div>
            <div style={{ width: 110 }}>
              <div style={label}>Base rate / hr</div>
              <input style={input} type="number" value={settings.rate} onChange={(e) => setSettings({ ...settings, rate: Number(e.target.value) || 0 })} />
            </div>
            <div style={{ width: 110 }}>
              <div style={label}>Currency</div>
              <select style={{ ...input, borderBottom: `1px solid ${C.rule}` }} value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value })}>
                {Object.keys(CURRENCIES).map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* THE RACE */}
      <div style={{ padding: "18px 20px", borderBottom: `2px solid ${C.ink}`, background: C.card }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontFamily: DISP, fontSize: 18, fontWeight: 600, letterSpacing: "0.1em" }}>THIS WEEK vs THE SHADOW</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {race.weeksWithData > 0 && (
              <div
                style={{
                  fontFamily: DISP,
                  fontSize: 13,
                  letterSpacing: "0.14em",
                  color: ahead ? C.stamp : C.red,
                  border: `1.5px solid ${ahead ? C.stamp : C.red}`,
                  padding: "3px 10px",
                  transform: "rotate(-1.5deg)",
                }}
              >
                {ahead ? "AHEAD" : "BEHIND"} {ahead ? "+" : "−"}{money(Math.abs(delta))}
              </div>
            )}
            <button
              onClick={() => setShowPayslip((s) => !s)}
              style={{ ...btn("transparent", payslip.isPayday ? C.gold : C.stamp), border: `1px solid ${payslip.isPayday ? C.gold : C.rule}`, padding: "5px 12px" }}
            >
              {payslip.isPayday ? "★ Payday" : "Payslip"}
            </button>
          </div>
        </div>

        {showPayslip && (
          <div style={{ marginTop: 14, border: `1.5px solid ${C.ink}`, background: C.paper, padding: "14px 16px" }}>
            <div style={{ ...label, color: C.ink }}>Payslip · week of {fmtDay(payslip.ws)}</div>
            <table style={{ width: "100%", fontSize: 13, marginTop: 10, borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td style={{ padding: "4px 0", color: C.inkSoft }}>Standard hours × 1.0</td>
                  <td style={{ textAlign: "right" }}>{fmtMin(payslip.baseMin)}</td>
                  <td style={{ textAlign: "right", width: 100 }}>{money(payslip.baseMin)}</td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 0", color: C.inkSoft }}>Focus sessions × 1.5</td>
                  <td style={{ textAlign: "right" }}>{fmtMin(payslip.focusMin)}</td>
                  <td style={{ textAlign: "right", color: C.gold }}>{money(payslip.focusMin * 1.5)}</td>
                </tr>
                {payslip.abortMin > 0 && (
                  <tr>
                    <td style={{ padding: "4px 0", color: C.red }}>Aborted focus × 0.5</td>
                    <td style={{ textAlign: "right" }}>{fmtMin(payslip.abortMin)}</td>
                    <td style={{ textAlign: "right", color: C.red }}>{money(payslip.abortMin * 0.5)}</td>
                  </tr>
                )}
                <tr style={{ borderTop: `1.5px solid ${C.ink}` }}>
                  <td style={{ padding: "6px 0", fontWeight: 600 }}>Gross deposit</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{fmtMin(payslip.totalHrs)}</td>
                  <td style={{ textAlign: "right", fontFamily: DISP, fontSize: 17, fontWeight: 600, color: C.red }}>{money(payslip.grossMin)}</td>
                </tr>
              </tbody>
            </table>
            <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 8 }}>
              {race.weeksWithData > 0 && `vs shadow: ${ahead ? "ahead by" : "behind by"} ${fmtMin(Math.abs(delta))}. `}
              {prs.weekRecordIsNow && "★ Week record in progress. "}
              {payslip.premiumMin > 0 && `Focus premium earned: ${money(payslip.premiumMin)}. `}
              {payslip.penaltyMin > 0 && `Lost to aborted sessions: ${money(payslip.penaltyMin)}.`}
            </div>
          </div>
        )}

        {race.weeksWithData === 0 ? (
          <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 10 }}>
            No shadow yet. This week becomes the baseline — everything you log now is the ghost you'll race next week.
          </div>
        ) : (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ ...label, width: 62, color: C.ink }}>You</div>
              <div style={{ flex: 1, background: C.paperDeep, height: 22 }}>
                <div className="bar" style={{ width: `${Math.min(100, (race.mine / barMax) * 100)}%`, height: "100%", background: C.fill[3] }} />
              </div>
              <div style={{ fontFamily: DISP, fontSize: 18, fontWeight: 600, width: 88, textAlign: "right" }}>{hrs(race.mine)} h</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
              <div style={{ ...label, width: 62 }}>Shadow</div>
              <div style={{ flex: 1, background: C.paperDeep, height: 22 }}>
                <div
                  className="bar"
                  style={{
                    width: `${Math.min(100, (race.shadowNow / barMax) * 100)}%`,
                    height: "100%",
                    background: `repeating-linear-gradient(45deg, ${C.shadow}, ${C.shadow} 5px, transparent 5px, transparent 9px)`,
                  }}
                />
              </div>
              <div style={{ fontFamily: DISP, fontSize: 18, fontWeight: 600, width: 88, textAlign: "right", color: C.shadow }}>{hrs(race.shadowNow)} h</div>
            </div>
            <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 8 }}>
              Shadow = trailing {race.weeksWithData}-week average, paced to this moment. Full-week target: {hrs(race.shadowFullWeek)} h.
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 24, marginTop: 14, flexWrap: "wrap" }}>
          <div>
            <div style={label}>Day record</div>
            <div style={{ fontFamily: DISP, fontSize: 20, fontWeight: 600 }}>
              {hrs(prs.bestDay.min)} h {prs.dayRecordIsToday && <span style={{ fontSize: 11, color: C.red, letterSpacing: "0.14em" }}>★ NEW — SET TODAY</span>}
            </div>
            <div style={{ fontSize: 11, color: C.inkSoft }}>{prs.bestDay.key ? fmtDay(prs.bestDay.key) : "—"}</div>
          </div>
          <div>
            <div style={label}>Week record</div>
            <div style={{ fontFamily: DISP, fontSize: 20, fontWeight: 600 }}>
              {hrs(prs.bestWeek.min)} h {prs.weekRecordIsNow && <span style={{ fontSize: 11, color: C.red, letterSpacing: "0.14em" }}>★ LIVE — THIS WEEK</span>}
            </div>
          </div>
          <div>
            <div style={label}>Today</div>
            <div style={{ fontFamily: DISP, fontSize: 20, fontWeight: 600 }}>{fmtMin(prs.today)}</div>
            <div style={{ fontSize: 11, color: C.inkSoft }}>
              {prs.bestDay.min > prs.today ? `${fmtMin(prs.bestDay.min - prs.today)} to the record` : "record pace"}
            </div>
          </div>
          <div>
            <div style={label}>Streak</div>
            <div style={{ fontFamily: DISP, fontSize: 20, fontWeight: 600 }}>{stats.streak} d</div>
            <div style={{ fontSize: 11, color: C.inkSoft }}>evidenced days in a row</div>
          </div>
        </div>
      </div>

      {/* clock */}
      <div style={{ padding: "18px 20px", borderBottom: `1px solid ${C.rule}` }}>
        {running ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
              {!running.pausedAt && (
                <div className="pulse" style={{ width: 9, height: 9, background: running.mode === "focus" ? C.gold : C.red, borderRadius: 9 }} />
              )}
              {running.pausedAt && (
                <div style={{ fontFamily: DISP, fontSize: 12, letterSpacing: "0.14em", color: C.inkSoft, border: `1px solid ${C.rule}`, padding: "2px 8px" }}>PAUSED</div>
              )}
              <div style={{ fontFamily: DISP, fontSize: 38, fontWeight: 600, letterSpacing: "0.04em", lineHeight: 1, color: running.pausedAt ? C.inkSoft : C.ink }}>
                {clockFmt(elapsedSec)}
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                {running.mode === "focus" ? (
                  <>
                    <div style={{ ...label, color: C.gold }}>FOCUS · {running.targetMin} min · 1.5× ({money(90)}/h)</div>
                    <div style={{ fontSize: 14 }}>
                      {running.project} ·{" "}
                      {focusDone ? (
                        <span style={{ color: C.gold, fontWeight: 600 }}>target hit — premium locked</span>
                      ) : (
                        <span style={{ color: C.inkSoft }}>{clockFmt(focusLeft)} to premium</span>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={label}>
                      On the clock · earning {money(60)}/h
                      {running.pauseCount > 0 && ` · paused ×${running.pauseCount}`}
                    </div>
                    <div style={{ fontSize: 14 }}>{running.project}</div>
                  </>
                )}
              </div>
              {running.mode === "normal" &&
                (running.pausedAt ? (
                  <button style={btn(C.stamp, C.paper)} onClick={resume}>Resume</button>
                ) : (
                  <button style={{ ...btn("transparent", C.ink), border: `1px solid ${C.rule}` }} onClick={pause}>Pause</button>
                ))}
              <button style={btn(focusDone ? C.gold : C.ink, C.paper)} onClick={stop}>
                {running.mode === "focus" ? (focusDone ? "Collect 1.5×" : "Abort — pays 0.5×") : "Stop"}
              </button>
            </div>
            {running.mode === "focus" && !focusDone && (
              <div style={{ fontSize: 11, color: C.red, marginTop: 8 }}>
                No pause in focus mode. Abort before {running.targetMin} min and the whole block pays half rate.
              </div>
            )}
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 220px" }}>
                <div style={label}>Project</div>
                <input
                  style={input}
                  value={projectField}
                  placeholder="UniTold / FrameFusion / Signals & Systems"
                  onChange={(e) => setProjectField(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && start("normal")}
                />
              </div>
              <button style={btn(C.ink, C.paper)} disabled={inCooldown} onClick={() => start("normal")}>
                {inCooldown ? "…" : "Start clock"}
              </button>
              <button style={btn(C.gold, C.paper)} disabled={inCooldown} onClick={() => start("focus", 50)}>Focus 50′ · 1.5×</button>
              <button style={btn(C.gold, C.paper)} disabled={inCooldown} onClick={() => start("focus", 90)}>Focus 90′ · 1.5×</button>
              <button style={{ ...btn("transparent", C.stamp), border: `1px solid ${C.rule}` }} onClick={manual}>Log past block</button>
            </div>
            <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 8 }}>
              Focus = committed duration, no pause, {money(90)}/h if you finish — half rate if you abort. Hours on the statement stay real either way.
            </div>
          </div>
        )}
      </div>

      {/* draft form */}
      {draft && (
        <div style={{ padding: "18px 20px", borderBottom: `2px solid ${C.ink}`, background: C.paperDeep }}>
          {draft.suspect && (
            <div style={{ border: `1.5px solid ${C.red}`, padding: "10px 14px", marginBottom: 14, background: C.paper }}>
              <div style={{ fontFamily: DISP, fontSize: 13, letterSpacing: "0.1em", color: C.red }}>UNDER 5 MINUTES — ACCIDENTAL START?</div>
              <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 4 }}>
                This block is {draft.minutes} min. Scrap it, or confirm below that it's real work you want on the record.
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button style={btn(C.red, C.paper)} onClick={() => setDraft(null)}>Scrap it</button>
                <button style={{ ...btn("transparent", C.ink), border: `1px solid ${C.rule}` }} onClick={() => setDraft({ ...draft, suspect: false })}>
                  It's real — keep it
                </button>
              </div>
            </div>
          )}
          {!draft.suspect && (
            <>
              <div style={{ ...label, color: C.ink, marginBottom: 12 }}>
                Close block — evidence required to bill
                {draft.mode === "focus" && (
                  <span style={{ color: draft.mult === 1.5 ? C.gold : C.red, marginLeft: 10 }}>
                    {draft.mult === 1.5 ? "FOCUS COMPLETE · 1.5×" : "FOCUS ABORTED · 0.5×"}
                  </span>
                )}
                {draft.pauseCount > 0 && <span style={{ marginLeft: 10 }}>paused ×{draft.pauseCount}</span>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 16 }}>
                <div>
                  <div style={label}>Date</div>
                  <input style={input} type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
                </div>
                <div>
                  <div style={label}>Minutes</div>
                  <input style={input} type="number" value={draft.minutes} onChange={(e) => setDraft({ ...draft, minutes: Math.max(1, Number(e.target.value) || 0) })} />
                </div>
                <div>
                  <div style={label}>Project</div>
                  <input style={input} value={draft.project} onChange={(e) => setDraft({ ...draft, project: e.target.value })} />
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <div style={label}>What shipped — one line, past tense</div>
                <input
                  style={input}
                  value={draft.output}
                  placeholder="Rewrote Stripe Connect payout webhook and deployed to prod"
                  onChange={(e) => setDraft({ ...draft, output: e.target.value })}
                />
              </div>
              <div style={{ marginTop: 14 }}>
                <div style={label}>Evidence link</div>
                <input
                  style={input}
                  value={draft.evidence}
                  placeholder="commit, PR, doc, deploy URL, sent email"
                  onChange={(e) => setDraft({ ...draft, evidence: e.target.value })}
                />
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 18, alignItems: "center", flexWrap: "wrap" }}>
                <button style={btn(C.ink, C.paper)} onClick={commit}>File it</button>
                <button style={{ ...btn("transparent", C.inkSoft), border: `1px solid ${C.rule}` }} onClick={() => setDraft(null)}>Discard</button>
                <span style={{ fontSize: 11, color: draft.evidence.trim() ? C.stamp : C.red }}>
                  {draft.evidence.trim() ? `Pays ${money(draftPay)}${draft.mult !== 1 ? ` (${draft.mult}×)` : ""}` : "No link — logs as unverified, pays nothing"}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ledger grid */}
      <div style={{ padding: "22px 20px 8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontFamily: DISP, fontSize: 18, fontWeight: 600, letterSpacing: "0.1em" }}>THE RECORD · 26 WEEKS</div>
          <button style={{ ...btn("transparent", C.stamp), border: `1px solid ${C.rule}`, padding: "7px 14px" }} onClick={exportStatement}>
            Export statement
          </button>
        </div>
        <div style={{ overflowX: "auto", paddingBottom: 6 }}>
          <div style={{ display: "flex", gap: 3, minWidth: "max-content" }}>
            {grid.map((week, wi) => (
              <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {week.map((d) => (
                  <button
                    key={d.key}
                    className="cell"
                    title={`${fmtDay(d.key)} — ${d.mins ? fmtMin(d.mins) : "nothing logged"}`}
                    aria-label={`${d.key}: ${hrs(d.mins)} hours`}
                    onClick={() => setSelDay(d.key)}
                    style={{
                      width: 13,
                      height: 13,
                      padding: 0,
                      cursor: "pointer",
                      background: d.future ? "transparent" : C.fill[level(d.mins)],
                      border: d.future ? `1px dashed ${C.ruleFaint}` : d.mins && !d.verified ? `1px solid ${C.red}` : `1px solid ${C.ruleFaint}`,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 10, alignItems: "center", fontSize: 11, color: C.inkSoft, flexWrap: "wrap" }}>
          <span>Lighter → heavier days</span>
          <span style={{ display: "flex", gap: 3 }}>
            {C.fill.map((f) => (
              <span key={f} style={{ width: 11, height: 11, background: f, border: `1px solid ${C.ruleFaint}` }} />
            ))}
          </span>
          <span style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <span style={{ width: 11, height: 11, background: C.fill[2], border: `1px solid ${C.red}` }} /> contains unverified time
          </span>
        </div>
      </div>

      {/* THE BANK */}
      <div style={{ padding: "22px 20px 8px" }}>
        <div style={{ fontFamily: DISP, fontSize: 18, fontWeight: 600, letterSpacing: "0.1em", marginBottom: 12 }}>
          THE BANK · WEEK BY WEEK
        </div>
        {bank.length === 0 ? (
          <div style={{ fontSize: 13, color: C.inkSoft, borderTop: `1px solid ${C.rule}`, padding: "20px 0" }}>
            No deposits yet.
          </div>
        ) : (
          <div style={{ borderTop: `1.5px solid ${C.ink}` }}>
            {bank.map((w) => (
              <div key={w.ws} style={{ borderBottom: `1px solid ${C.ruleFaint}` }}>
                <button
                  onClick={() => setOpenWeeks((o) => ({ ...o, [w.ws]: !o[w.ws] }))}
                  style={{
                    display: "flex",
                    width: "100%",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "12px 0",
                    alignItems: "baseline",
                    gap: 12,
                    fontFamily: MONO,
                    color: C.ink,
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontFamily: DISP, fontSize: 14, letterSpacing: "0.06em", flex: 1 }}>
                    {openWeeks[w.ws] ? "▾" : "▸"} WEEK OF {fmtDay(w.ws).toUpperCase()}
                  </span>
                  <span style={{ fontSize: 13 }}>{fmtMin(w.vMin)}</span>
                  <span style={{ fontFamily: DISP, fontSize: 16, fontWeight: 600, color: C.red, width: 110, textAlign: "right" }}>
                    {money(w.payMin)}
                  </span>
                </button>
                {openWeeks[w.ws] && (
                  <div style={{ paddingBottom: 12 }}>
                    {Object.keys(w.days)
                      .sort()
                      .reverse()
                      .map((dk) => {
                        const day = w.days[dk];
                        return (
                          <div key={dk} style={{ padding: "6px 0 6px 20px", borderTop: `1px dashed ${C.ruleFaint}` }}>
                            <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                              <span style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>{fmtDay(dk)}</span>
                              <span style={{ fontSize: 12 }}>{fmtMin(day.vMin)}</span>
                              <span style={{ fontSize: 12, color: C.red, width: 110, textAlign: "right" }}>{money(day.payMin)}</span>
                            </div>
                            {day.list.map((e) => (
                              <div key={e.id} style={{ display: "flex", gap: 10, fontSize: 11, color: C.inkSoft, padding: "2px 0 2px 12px" }}>
                                <span style={{ minWidth: 56 }}>{fmtMin(e.minutes)}</span>
                                <span style={{ flex: 1 }}>
                                  <b style={{ color: C.ink }}>{e.project}</b> — {e.output}
                                  {e.mult === 1.5 && <span style={{ color: C.gold }}> · 1.5×</span>}
                                  {e.mult === 0.5 && <span style={{ color: C.red }}> · 0.5×</span>}
                                  {!e.evidence?.trim() && <span style={{ color: C.red }}> · unverified</span>}
                                </span>
                                <span style={{ width: 80, textAlign: "right" }}>{e.evidence?.trim() ? money(e.minutes * (e.mult || 1)) : "—"}</span>
                              </div>
                            ))}
                            {day.uMin > 0 && (
                              <div style={{ fontSize: 10, color: C.red, paddingLeft: 12 }}>unverified today: {fmtMin(day.uMin)} (pays nothing)</div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* THE WORLD */}
      <div style={{ padding: "22px 20px 8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
          <div style={{ fontFamily: DISP, fontSize: 18, fontWeight: 600, letterSpacing: "0.1em" }}>THE WORLD · {worldPct}% FORESTED</div>
          <div style={{ fontSize: 12, color: C.inkSoft }}>
            plot: <b style={{ color: C.ink }}>{money(PLOT_PRICE_MIN)}</b> · planted {world.length}/{CELLS.length} · spent {money(spentMin)}
          </div>
        </div>
        <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 10 }}>
          Tap a land plot to plant a forest with wallet money. Green the whole Earth and Mars unlocks.
          {worldMsg && <span style={{ color: C.stamp }}> {worldMsg}</span>}
        </div>
        <div style={{ overflowX: "auto", paddingBottom: 6 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${COLS}, 9px)`,
              gridAutoRows: "9px",
              gap: 1,
              minWidth: "max-content",
              background: C.ocean,
              padding: 4,
              border: `1.5px solid ${C.ink}`,
            }}
          >
            {Array.from({ length: ROWS * COLS }, (_, i) => {
              if (!LAND_SET.has(i)) return <div key={i} style={{ background: C.ocean }} />;
              const cell = CELLS.find((x) => x.i === i);
              const planted = plantedSet.has(i);
              return (
                <button
                  key={i}
                  className="plot"
                  title={`${cell.region}${planted ? " · forested" : ` · ${money(PLOT_PRICE_MIN)}`}`}
                  onClick={() => plant(cell)}
                  style={{ background: planted ? C.forest : C.soil, border: "none", padding: 0, cursor: "pointer" }}
                />
              );
            })}
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11, color: C.inkSoft, flexWrap: "wrap" }}>
          <span style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <span style={{ width: 11, height: 11, background: C.soil }} /> unclaimed land
          </span>
          <span style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <span style={{ width: 11, height: 11, background: C.forest }} /> your forest
          </span>
          {["Brazil", "Netherlands", "Spain"].map((r) => (
            <span key={r}>
              {r}: {regionPlanted[r] || 0}/{REGION_TOTALS[r] || 0}
            </span>
          ))}
          {world.length === CELLS.length && CELLS.length > 0 && (
            <span style={{ color: C.gold, fontWeight: 600 }}>★ EARTH COMPLETE — MARS AWAITS</span>
          )}
        </div>
      </div>

      {/* day detail / recent */}
      <div style={{ padding: "18px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 10 }}>
          <div style={{ fontFamily: DISP, fontSize: 16, fontWeight: 600, letterSpacing: "0.1em" }}>
            {selDay ? fmtDay(selDay).toUpperCase() : "RECENT ENTRIES"}
          </div>
          {selDay && (
            <button style={{ ...label, background: "none", border: "none", cursor: "pointer", color: C.stamp }} onClick={() => setSelDay(null)}>
              show recent
            </button>
          )}
        </div>

        {(() => {
          const list = selDay ? byDay[selDay] || [] : [...entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
          if (!list.length)
            return (
              <div style={{ padding: "26px 0", color: C.inkSoft, fontSize: 13, borderTop: `1px solid ${C.rule}` }}>
                {selDay ? "Nothing filed for this day." : "No blocks yet. Start the clock, then close the block with a link to what you shipped."}
              </div>
            );
          return (
            <div style={{ borderTop: `1px solid ${C.rule}` }}>
              {list.map((e) => {
                const open = editId === e.id;
                return (
                  <div key={e.id} style={{ borderBottom: `1px solid ${C.ruleFaint}` }}>
                    <div
                      onClick={() => openEdit(open ? null : e)}
                      style={{ display: "flex", gap: 14, padding: "12px 0", alignItems: "flex-start", flexWrap: "wrap", cursor: "pointer" }}
                    >
                      <div style={{ fontFamily: DISP, fontSize: 20, fontWeight: 600, minWidth: 74 }}>{fmtMin(e.minutes)}</div>
                      <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                          {e.project}
                          {e.mult === 1.5 && <span style={{ color: C.gold, marginLeft: 8, fontSize: 11 }}>FOCUS 1.5×</span>}
                          {e.mult === 0.5 && <span style={{ color: C.red, marginLeft: 8, fontSize: 11 }}>ABORTED 0.5×</span>}
                          {typeof e.rating === "number" && (
                            <span
                              style={{
                                marginLeft: 8,
                                fontSize: 11,
                                color: e.rating >= 7 ? C.forest : e.rating >= 4 ? C.gold : C.red,
                                border: `1px solid ${e.rating >= 7 ? C.forest : e.rating >= 4 ? C.gold : C.red}`,
                                padding: "1px 5px",
                              }}
                            >
                              {e.rating}/10
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 2 }}>{e.output}</div>
                        {e.reflection?.trim() && !open && (
                          <div style={{ fontSize: 12, color: C.stamp, marginTop: 3, fontStyle: "italic" }}>
                            ✎ {e.reflection.length > 90 ? e.reflection.slice(0, 90) + "…" : e.reflection}
                          </div>
                        )}
                        <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 4 }}>
                          {!selDay && e.date + " · "}
                          {e.started}
                          {e.pauseCount > 0 && ` · paused ×${e.pauseCount}`}
                          <span style={{ color: C.stamp }}> · {open ? "close" : "open"}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        {e.evidence?.trim() ? (
                          <a
                            href={e.evidence}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(ev) => ev.stopPropagation()}
                            style={{
                              fontFamily: DISP,
                              fontSize: 10,
                              letterSpacing: "0.16em",
                              color: C.stamp,
                              border: `1.5px solid ${C.stamp}`,
                              padding: "3px 7px",
                              textDecoration: "none",
                              display: "inline-block",
                              transform: "rotate(-2deg)",
                            }}
                          >
                            VERIFIED ↗
                          </a>
                        ) : (
                          <span
                            style={{
                              fontFamily: DISP,
                              fontSize: 10,
                              letterSpacing: "0.16em",
                              color: C.red,
                              border: `1.5px solid ${C.red}`,
                              padding: "3px 7px",
                              display: "inline-block",
                              transform: "rotate(-2deg)",
                            }}
                          >
                            UNVERIFIED
                          </span>
                        )}
                        <div style={{ fontSize: 12, marginTop: 6, color: e.evidence?.trim() ? C.ink : C.inkSoft }}>
                          {e.evidence?.trim() ? money(e.minutes * (e.mult || 1)) : "—"}
                        </div>
                      </div>
                    </div>

                    {open && edit && (
                      <div style={{ margin: "0 0 14px", border: `1.5px solid ${C.ink}`, background: C.card, padding: "14px 16px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 14 }}>
                          <div>
                            <div style={label}>Date</div>
                            <input style={input} type="date" value={edit.date} onChange={(ev) => setEdit({ ...edit, date: ev.target.value })} />
                          </div>
                          <div>
                            <div style={label}>Minutes</div>
                            <input
                              style={input}
                              type="number"
                              value={edit.minutes}
                              onChange={(ev) => setEdit({ ...edit, minutes: Math.max(1, Number(ev.target.value) || 0) })}
                            />
                          </div>
                          <div>
                            <div style={label}>Project</div>
                            <input style={input} value={edit.project} onChange={(ev) => setEdit({ ...edit, project: ev.target.value })} />
                          </div>
                        </div>
                        <div style={{ marginTop: 12 }}>
                          <div style={label}>What shipped</div>
                          <input style={input} value={edit.output} onChange={(ev) => setEdit({ ...edit, output: ev.target.value })} />
                        </div>
                        <div style={{ marginTop: 12 }}>
                          <div style={label}>Evidence link</div>
                          <input style={input} value={edit.evidence} onChange={(ev) => setEdit({ ...edit, evidence: ev.target.value })} />
                        </div>
                        <div style={{ marginTop: 12 }}>
                          <div style={label}>Reflection — what worked, what dragged, what next</div>
                          <textarea
                            value={edit.reflection}
                            onChange={(ev) => setEdit({ ...edit, reflection: ev.target.value })}
                            rows={3}
                            style={{ ...input, borderBottom: "none", border: `1px solid ${C.rule}`, resize: "vertical", padding: 8 }}
                          />
                        </div>
                        <div style={{ marginTop: 12 }}>
                          <div style={label}>Session satisfaction</div>
                          <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                              <button
                                key={n}
                                onClick={() => setEdit({ ...edit, rating: edit.rating === n ? null : n })}
                                style={{
                                  fontFamily: DISP,
                                  fontSize: 13,
                                  width: 32,
                                  height: 30,
                                  cursor: "pointer",
                                  border: `1.5px solid ${edit.rating === n ? C.ink : C.rule}`,
                                  background: edit.rating === n ? (n >= 7 ? C.forest : n >= 4 ? C.gold : C.red) : "transparent",
                                  color: edit.rating === n ? C.paper : C.ink,
                                }}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 10, marginTop: 16, alignItems: "center", flexWrap: "wrap" }}>
                          <button style={btn(C.ink, C.paper)} onClick={saveEdit}>Save</button>
                          <button style={{ ...btn("transparent", C.inkSoft), border: `1px solid ${C.rule}` }} onClick={() => openEdit(null)}>Cancel</button>
                          <button
                            style={{ ...btn("transparent", C.red), border: `1px solid ${C.red}`, marginLeft: "auto" }}
                            onClick={() => {
                              remove(e.id);
                              openEdit(null);
                            }}
                          >
                            Delete entry
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
