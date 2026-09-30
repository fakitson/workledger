import React, { useEffect, useMemo, useRef, useState } from "react";
import { loadState, saveState } from "./storage";
import { C, DISP, MONO, h2, input, label, linkBtn } from "./theme";
import { clockFmt, dayKey, fmtMin, hhmmOf, isValidKey, shiftKey, todayKey, uid, weekStartKey } from "./lib/dates";
import { isVerified, records, summarize } from "./lib/insights";
import { buildBank, download, statementMarkdown } from "./lib/statement";
import { PLOT_PRICE_MIN } from "./lib/world";
import { makeBackup, mergeBackup } from "./lib/backup";
import DraftForm from "./components/DraftForm";
import BackupPanel from "./components/BackupPanel";
import TodayPage from "./pages/TodayPage";
import InsightsPage from "./pages/InsightsPage";
import LedgerPage from "./pages/LedgerPage";
import WorldPage from "./pages/WorldPage";

const CURRENCIES = { EUR: "€", USD: "$", GBP: "£", BRL: "R$" };
export const DEFAULT_SETTINGS = { name: "", rate: 25, currency: "EUR", dailyGoal: 4, weeklyGoal: 20 };

const PAGES = [
  { id: "today", label: "Today" },
  { id: "insights", label: "Insights" },
  { id: "ledger", label: "Ledger" },
  { id: "world", label: "World" },
];

function parseHash() {
  const parts = (window.location.hash || "").replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const page = PAGES.some((p) => p.id === parts[0]) ? parts[0] : "today";
  return { page, a: parts[1] || null, b: parts[2] || null };
}

// Entries saved while the date field was blank lost their day; recover it from the start time when possible.
function repairEntries(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((e) => e && typeof e === "object")
    .map((e) => (!isValidKey(e.date) && Number.isFinite(e.startedAt) ? { ...e, date: dayKey(e.startedAt) } : e));
}

export default function WorkLedger() {
  const [ready, setReady] = useState(false);
  const [entries, setEntries] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [running, setRunning] = useState(null);
  const [tick, setTick] = useState(0);
  const [draft, setDraft] = useState(null);
  const [projectField, setProjectField] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [world, setWorld] = useState([]);
  const [route, setRoute] = useState(parseHash);
  const first = useRef(true);

  useEffect(() => {
    (async () => {
      const s = await loadState();
      if (s) {
        setEntries(repairEntries(s.entries));
        setSettings({ ...DEFAULT_SETTINGS, ...(s.settings || {}) });
        setRunning(s.running || null);
        setProjectField(s.running?.project || s.lastProject || "");
        setWorld(Array.isArray(s.world) ? s.world : []);
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

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.page]);

  const go = (path) => {
    window.location.hash = path;
  };

  const sym = CURRENCIES[settings.currency] || "€";
  const rate = Number(settings.rate) || 0;
  const money = (m) => `${sym}${((m / 60) * rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  /* ---------- timer ---------- */
  const effMs = (r, at = Date.now()) => {
    if (!r) return 0;
    const paused = r.pausedMs + (r.pausedAt ? at - r.pausedAt : 0);
    return at - r.startedAt - paused;
  };
  const elapsedSec = running ? Math.max(0, Math.floor(effMs(running) / 1000)) : 0;
  const focusDone = running?.mode === "focus" && elapsedSec >= running.targetMin * 60;
  const focusLeft = running?.mode === "focus" ? Math.max(0, running.targetMin * 60 - elapsedSec) : 0;

  useEffect(() => {
    document.title = running ? `${running.pausedAt ? "❚❚" : "●"} ${clockFmt(elapsedSec)} · ${running.project}` : "Work Ledger";
  }, [running, elapsedSec]);

  /* ---------- lifetime numbers ---------- */
  const stats = useMemo(() => {
    let vMin = 0,
      uMin = 0,
      payMin = 0,
      last28PayMin = 0;
    const cutoff = shiftKey(todayKey(), -28);
    entries.forEach((e) => {
      const mult = e.mult || 1;
      if (isVerified(e)) {
        vMin += e.minutes;
        payMin += e.minutes * mult;
        if (e.date >= cutoff) last28PayMin += e.minutes * mult;
      } else uMin += e.minutes;
    });
    const weeklyRun = last28PayMin / 4;
    return { vMin, uMin, payMin, weeklyRun, annualMin: weeklyRun * 52 };
  }, [entries]);
  const today = todayKey();
  const recs = useMemo(() => records(entries), [entries, today]);
  const walletMin = stats.payMin - world.length * PLOT_PRICE_MIN;

  const frames = useMemo(() => {
    const ws = weekStartKey(today);
    const ms = today.slice(0, 8) + "01";
    return [
      { id: "day", title: "Today", s: summarize(entries, today, today) },
      { id: "week", title: "This week", s: summarize(entries, ws, shiftKey(ws, 6)) },
      { id: "month", title: "This month", s: summarize(entries, ms, today.slice(0, 8) + "31") },
      { id: "all", title: "All time", s: summarize(entries, "0000-01-01", "9999-12-31") },
    ];
  }, [entries, today]);

  const projects = useMemo(() => {
    const seen = new Map();
    [...entries].sort((a, b) => b.date.localeCompare(a.date)).forEach((e) => e.project && !seen.has(e.project) && seen.set(e.project, 1));
    return [...seen.keys()].slice(0, 20);
  }, [entries]);

  /* ---------- actions ---------- */
  const inCooldown = Date.now() < cooldownUntil;
  const start = (mode, targetMin = 0) => {
    if (!projectField.trim() || Date.now() < cooldownUntil || running) return;
    setRunning({ startedAt: Date.now(), project: projectField.trim(), mode, targetMin, pausedMs: 0, pausedAt: null, pauseCount: 0 });
  };
  const pause = () => setRunning((r) => (r && !r.pausedAt ? { ...r, pausedAt: Date.now(), pauseCount: r.pauseCount + 1 } : r));
  const resume = () => setRunning((r) => (r && r.pausedAt ? { ...r, pausedMs: r.pausedMs + (Date.now() - r.pausedAt), pausedAt: null } : r));
  const stop = () => {
    if (!running) return;
    const mins = Math.max(1, Math.round(effMs(running) / 60000));
    let mult = 1;
    if (running.mode === "focus") mult = mins >= running.targetMin ? 1.5 : 0.5;
    setDraft({
      id: uid(),
      date: dayKey(running.startedAt),
      minutes: mins,
      project: running.project,
      output: "",
      evidence: "",
      mult,
      mode: running.mode,
      pauseCount: running.pauseCount,
      targetMin: running.targetMin,
      startedAt: running.startedAt,
      endedAt: Date.now(),
      started: hhmmOf(running.startedAt),
      suspect: mins < 5,
    });
    setRunning(null);
    setCooldownUntil(Date.now() + 3000);
  };
  const manual = (date = todayKey()) => {
    setDraft({
      id: uid(),
      date,
      minutes: "60",
      project: projectField || "",
      output: "",
      evidence: "",
      mult: 1,
      mode: "normal",
      pauseCount: 0,
      started: "",
      manual: true,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const commit = () => {
    const minutes = Math.max(1, Math.round(Number(draft.minutes)) || 1);
    const e = {
      ...draft,
      minutes,
      project: draft.project.trim(),
      output: draft.output.trim(),
      evidence: draft.evidence.trim(),
      suspect: false,
    };
    if (draft.manual) {
      if (/^\d{2}:\d{2}$/.test(draft.started)) e.startedAt = new Date(`${draft.date}T${draft.started}:00`).getTime();
      else e.started = "—";
    }
    setEntries((list) => [...list, e]);
    setProjectField(e.project);
    setDraft(null);
  };
  const updateEntry = (id, patch) => setEntries((list) => list.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const deleteEntry = (id) => setEntries((list) => list.filter((x) => x.id !== id));
  const downloadBackup = () => {
    download(`workledger-backup-${new Date().toISOString().slice(0, 10)}.json`, makeBackup({ entries, settings, world }), "application/json");
    setSettings((s) => ({ ...s, lastBackupAt: Date.now() }));
  };
  const restoreBackup = (incoming) => {
    const r = mergeBackup({ entries, settings, world }, incoming, DEFAULT_SETTINGS);
    setEntries(r.entries);
    setWorld(r.world);
    setSettings(r.settings);
    return r;
  };
  const exportStatement = () =>
    download(`work-statement-${new Date().toISOString().slice(0, 10)}.md`, statementMarkdown({ bank: buildBank(entries), settings, stats, sym }));

  if (!ready) return <div style={{ background: C.paper, color: C.inkSoft, fontFamily: MONO, padding: 40 }}>Opening the ledger…</div>;

  const pageProps = { entries, settings, money, go, route, recs, onSave: updateEntry, onDelete: deleteEntry };

  return (
    <div style={{ background: C.paper, color: C.ink, fontFamily: MONO, minHeight: "100%", padding: "0 0 48px" }}>
      {/* header */}
      <div style={{ padding: "22px 20px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontFamily: DISP, fontSize: 34, fontWeight: 600, letterSpacing: "0.06em", lineHeight: 1 }}>TIMESHEET</div>
            <div style={{ ...label, marginTop: 6 }}>
              {settings.name || "unsigned"} · {sym}
              {settings.rate}/hr base
              <button onClick={() => setShowSettings((s) => !s)} style={{ ...linkBtn, marginLeft: 10 }}>
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
              <select style={input} value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value })}>
                {Object.keys(CURRENCIES).map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ width: 120 }}>
              <div style={label}>Daily goal · h</div>
              <input
                style={input}
                type="number"
                min="0"
                step="0.5"
                value={settings.dailyGoal}
                onChange={(e) => setSettings({ ...settings, dailyGoal: Math.max(0, Number(e.target.value) || 0) })}
              />
            </div>
            <div style={{ width: 120 }}>
              <div style={label}>Weekly goal · h</div>
              <input
                style={input}
                type="number"
                min="0"
                step="1"
                value={settings.weeklyGoal}
                onChange={(e) => setSettings({ ...settings, weeklyGoal: Math.max(0, Number(e.target.value) || 0) })}
              />
            </div>
          </div>
        )}

        {/* time frames at a glance */}
        <div data-testid="frames" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 0, marginTop: 16, border: `1.5px solid ${C.ink}` }}>
          {frames.map((f, i) => (
            <button
              key={f.id}
              onClick={() => go(`/insights/${f.id}/${today}`)}
              style={{
                background: "none",
                border: "none",
                borderLeft: i ? `1px solid ${C.rule}` : "none",
                padding: "8px 12px",
                textAlign: "left",
                cursor: "pointer",
                fontFamily: "inherit",
                color: "inherit",
              }}
            >
              <div style={label}>{f.title}</div>
              <div style={{ fontFamily: DISP, fontSize: 20, fontWeight: 600 }}>{fmtMin(f.s.min)}</div>
              <div style={{ fontSize: 10, color: f.s.focusMin ? C.gold : C.inkSoft }}>{fmtMin(f.s.focusMin)} focus</div>
            </button>
          ))}
        </div>
      </div>

      {/* navigation */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          background: C.paper,
          borderTop: `2px solid ${C.ink}`,
          borderBottom: `2px solid ${C.ink}`,
          display: "flex",
          alignItems: "stretch",
          flexWrap: "wrap",
          padding: "0 12px",
        }}
      >
        {PAGES.map((p) => {
          const active = route.page === p.id;
          return (
            <a
              key={p.id}
              href={`#/${p.id}`}
              aria-current={active ? "page" : undefined}
              style={{
                ...h2,
                fontSize: 14,
                padding: "12px 10px 10px",
                color: active ? C.ink : C.inkSoft,
                textDecoration: "none",
                borderBottom: `3px solid ${active ? C.red : "transparent"}`,
              }}
            >
              {p.label.toUpperCase()}
            </a>
          );
        })}
        {running && route.page !== "today" && (
          <a
            href="#/today"
            data-testid="running-pill"
            style={{
              marginLeft: "auto",
              alignSelf: "center",
              fontSize: 12,
              color: running.pausedAt ? C.inkSoft : running.mode === "focus" ? C.gold : C.red,
              textDecoration: "none",
              border: `1px solid currentColor`,
              padding: "3px 8px",
              whiteSpace: "nowrap",
            }}
          >
            {running.pausedAt ? "❚❚ paused" : "● on the clock"} · {Math.floor(elapsedSec / 60)} min · {running.project}
          </a>
        )}
      </nav>

      {draft && <DraftForm key={draft.id} draft={draft} setDraft={setDraft} onCommit={commit} money={money} />}

      {route.page === "today" && (
        <TodayPage
          {...pageProps}
          stats={{ ...stats, streak: recs.streak }}
          running={running}
          elapsedSec={elapsedSec}
          focusDone={focusDone}
          focusLeft={focusLeft}
          projectField={projectField}
          setProjectField={setProjectField}
          projects={projects}
          start={start}
          pause={pause}
          resume={resume}
          stop={stop}
          manual={manual}
          inCooldown={inCooldown}
          tick={tick}
          onBackup={downloadBackup}
        />
      )}
      {route.page === "insights" && <InsightsPage {...pageProps} />}
      {route.page === "ledger" && (
        <LedgerPage
          {...pageProps}
          onLogOn={manual}
          onExport={exportStatement}
          backup={<BackupPanel entries={entries} settings={settings} onRestore={restoreBackup} onDownload={downloadBackup} />}
        />
      )}
      {route.page === "world" && <WorldPage world={world} setWorld={setWorld} walletMin={walletMin} money={money} />}

      <footer data-testid="version" style={{ padding: "36px 20px 0", fontSize: 10, color: C.inkSoft, textAlign: "center" }}>
        Work Ledger · version {__BUILD_COMMIT__} · built{" "}
        {new Date(__BUILD_TIME__).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
      </footer>
    </div>
  );
}
