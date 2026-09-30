import React, { useMemo } from "react";
import { C, DISP, btn, card, ghostBtn, h2, label, note, toneColor } from "../theme";
import { fmtDay, fmtMin, fmtMonth, hhmm, isValidKey, todayKey } from "../lib/dates";
import {
  PERIOD_KINDS,
  chartSeries,
  comparePrev,
  firstEntryKey,
  goalFor,
  honestRead,
  periodRange,
  summarize,
  weekdayAverages,
} from "../lib/insights";
import { BarChart, GoalBar, HBars, Stat } from "../components/Charts";
import EntryList from "../components/EntryList";

const KIND_LABEL = { day: "Day", week: "Week", month: "Month", year: "Year", all: "All time" };
const NOW_LABEL = { day: "Today", week: "This week", month: "This month", year: "This year" };
const CHART_TITLE = { day: "Hour by hour", week: "Day by day", month: "Day by day", year: "Month by month", all: "Over time" };
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function InsightsPage({ entries, settings, money, route, go, recs, onSave, onDelete }) {
  const kind = PERIOD_KINDS.includes(route.a) ? route.a : "week";
  const anchor = isValidKey(route.b) ? route.b : todayKey();
  const firstKey = useMemo(() => firstEntryKey(entries), [entries]);
  const range = useMemo(() => periodRange(kind, anchor, firstKey), [kind, anchor, firstKey]);
  const sum = useMemo(() => summarize(entries, range.start, range.end), [entries, range]);
  const prev = useMemo(() => comparePrev(entries, range), [entries, range]);
  const goal = goalFor(range, settings);
  const bars = useMemo(() => chartSeries(range, sum, settings), [range, sum, settings]);
  const read = useMemo(() => honestRead(range, sum, prev, goal), [range, sum, prev, goal?.target, goal?.expected]);
  const weekdays = useMemo(() => weekdayAverages(range, sum), [range, sum]);

  const nav = (k, a) => go(`/insights/${k}/${a}`);
  const isNow = range.containsToday;
  const diff = prev ? sum.min - prev.min : 0;
  const hourMax = Math.max(1, ...sum.hours.map((h) => h.f + h.o));

  return (
    <div>
      {/* period picker */}
      <div style={{ padding: "16px 20px", borderBottom: `2px solid ${C.ink}`, background: C.card }}>
        <div role="tablist" aria-label="Time frame" style={{ display: "flex", gap: 0, flexWrap: "wrap", border: `1.5px solid ${C.ink}`, width: "fit-content", maxWidth: "100%" }}>
          {PERIOD_KINDS.map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={k === kind}
              onClick={() => nav(k, k === "all" ? todayKey() : anchor)}
              style={{
                ...btn(k === kind ? C.ink : "transparent", k === kind ? C.paper : C.ink),
                padding: "8px 14px",
                borderRight: k === "all" ? "none" : `1px solid ${C.rule}`,
              }}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
          {range.kind !== "all" && (
            <button aria-label="Previous period" style={{ ...ghostBtn(C.ink), padding: "6px 12px", flexShrink: 0 }} onClick={() => nav(kind, range.prevAnchor)}>
              ‹
            </button>
          )}
          <div style={{ flex: "1 1 auto", minWidth: 0 }}>
            <div data-testid="period-label" style={{ fontFamily: DISP, fontSize: 22, fontWeight: 600, letterSpacing: "0.04em", lineHeight: 1.15 }}>
              {range.label}
            </div>
            {isNow && range.kind !== "all" && <div style={{ ...label, color: C.red, marginTop: 2 }}>in progress</div>}
          </div>
          {range.kind !== "all" && (
            <>
              {!isNow && (
                <button style={{ ...ghostBtn(), padding: "6px 12px", flexShrink: 0 }} onClick={() => nav(kind, todayKey())}>
                  {NOW_LABEL[kind]}
                </button>
              )}
              <button
                aria-label="Next period"
                disabled={!range.nextAnchor}
                style={{ ...ghostBtn(C.ink), padding: "6px 12px", flexShrink: 0 }}
                onClick={() => range.nextAnchor && nav(kind, range.nextAnchor)}
              >
                ›
              </button>
            </>
          )}
        </div>
      </div>

      {/* headline numbers */}
      <div style={{ padding: "18px 20px 6px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
          <Stat
            testId="stat-worked"
            title="Hours worked"
            value={fmtMin(sum.min)}
            sub={
              prev
                ? `${diff >= 0 ? "▲ +" : "▼ −"}${fmtMin(Math.abs(diff))} ${prev.text}`
                : `${sum.activeDays} active day${sum.activeDays === 1 ? "" : "s"}`
            }
          />
          <Stat
            testId="stat-focus"
            title="Deep focus"
            value={fmtMin(sum.focusMin)}
            color={sum.focusMin ? C.gold : undefined}
            sub={`${Math.round(sum.focusShare * 100)}% of your time · ${sum.focusSessions} session${sum.focusSessions === 1 ? "" : "s"}`}
          />
          {range.kind === "day" ? (
            <Stat
              title="Work window"
              value={sum.firstStart != null ? `${hhmm(sum.firstStart)}–${hhmm(sum.lastEnd)}` : "—"}
              sub={sum.firstStart != null ? `${fmtMin(sum.lastEnd - sum.firstStart)} span, ${fmtMin(sum.min)} worked` : "no start times"}
            />
          ) : (
            <Stat
              title="Days worked"
              value={`${sum.activeDays}/${range.elapsedDays}`}
              sub={sum.activeDays ? `avg ${fmtMin(sum.min / sum.activeDays)} per working day` : "no active days"}
            />
          )}
          <Stat
            title="Blocks"
            value={sum.sessions}
            sub={sum.sessions ? `avg ${fmtMin(sum.avgSession)} · longest ${fmtMin(sum.longest.minutes)}` : "none"}
          />
          <Stat title="Earned" value={money(sum.payMin)} color={C.red} sub={`${fmtMin(sum.vMin)} verified${sum.uMin ? ` · ${fmtMin(sum.uMin)} not` : ""}`} />
        </div>

        {goal && !range.isFuture && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
              <span style={label}>
                Goal · {fmtMin(goal.target)} this {range.unit}
              </span>
              <span style={{ fontSize: 12, color: sum.min >= goal.target ? C.forest : sum.min >= goal.expected ? C.stamp : C.red }}>
                {sum.min >= goal.target
                  ? `✓ hit — ${Math.round((sum.min / goal.target) * 100)}%`
                  : isNow
                    ? `${Math.round((sum.min / goal.target) * 100)}% · ${sum.min >= goal.expected ? "on pace" : `${fmtMin(goal.expected - sum.min)} behind pace`}`
                    : `missed — ${Math.round((sum.min / goal.target) * 100)}%`}
              </span>
            </div>
            <GoalBar value={sum.min} target={goal.target} expected={isNow ? goal.expected : null} />
            {isNow && <div style={{ ...note, marginTop: 5 }}>Dashed red tick = where steady pace puts you right now. Change goals under "edit" at the top.</div>}
          </div>
        )}
      </div>

      {/* chart */}
      <div style={{ padding: "16px 20px 6px" }}>
        <div style={{ ...h2, fontSize: 16, marginBottom: 10 }}>{CHART_TITLE[range.kind].toUpperCase()}</div>
        <BarChart
          bars={bars}
          targetLabel={range.kind === "week" || range.kind === "month" ? "Daily goal" : "Monthly goal"}
          onBar={(b) => nav(b.drill.kind, b.drill.anchor)}
        />
        {range.kind !== "day" && <div style={{ ...note, marginTop: 6 }}>Tap a bar to open that {range.kind === "week" || range.kind === "month" ? "day" : "period"}.</div>}
        {range.kind === "day" && sum.min > 0 && sum.knownStartMin < sum.min && (
          <div style={{ ...note, marginTop: 6 }}>{fmtMin(sum.min - sum.knownStartMin)} logged without a start time isn't placed on the hour chart.</div>
        )}
      </div>

      {/* honest read */}
      <div style={{ padding: "16px 20px 6px" }}>
        <div style={{ ...card, background: C.paper }}>
          <div style={{ ...h2, fontSize: 16 }}>THE HONEST READ</div>
          <ul data-testid="honest-read" style={{ listStyle: "none", padding: 0, margin: "10px 0 0" }}>
            {read.map((r, i) => (
              <li key={i} style={{ display: "flex", gap: 10, fontSize: 13, lineHeight: 1.45, padding: "5px 0", borderTop: i ? `1px dashed ${C.ruleFaint}` : "none" }}>
                <span style={{ color: toneColor(r.tone), fontWeight: 600, width: 12, flexShrink: 0 }}>
                  {r.tone === "good" ? "+" : r.tone === "bad" ? "!" : "·"}
                </span>
                <span>{r.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* breakdowns */}
      {sum.min > 0 && (
        <div style={{ padding: "16px 20px 6px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 22 }}>
          <div>
            <div style={{ ...h2, fontSize: 16, marginBottom: 10 }}>WHERE THE TIME WENT</div>
            <HBars
              rows={sum.projectList.map((p) => ({
                key: p.name,
                name: p.name,
                value: p.min,
                focus: p.focusMin,
                right: `${fmtMin(p.min)} · ${Math.round((p.min / sum.min) * 100)}%`,
                title: `${p.name}: ${fmtMin(p.min)} over ${p.sessions} block${p.sessions === 1 ? "" : "s"}, ${fmtMin(p.focusMin)} in focus`,
              }))}
            />
          </div>
          {range.kind !== "day" && sum.knownStartMin > 0 && (
            <div>
              <div style={{ ...h2, fontSize: 16, marginBottom: 10 }}>WHEN YOU WORK</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 90, borderBottom: `1.5px solid ${C.ink}` }}>
                {sum.hours.map((h, i) => (
                  <div
                    key={i}
                    title={`${hhmm(i * 60)}–${hhmm((i + 1) * 60)}: ${fmtMin(h.f + h.o)}`}
                    style={{ flex: 1, display: "flex", flexDirection: "column-reverse", height: "100%" }}
                  >
                    <div style={{ height: `${(h.f / hourMax) * 100}%`, background: C.gold }} />
                    <div style={{ height: `${(h.o / hourMax) * 100}%`, background: C.fill[3] }} />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: C.inkSoft, marginTop: 3 }}>
                {["00", "06", "12", "18", "24"].map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
              <div style={{ ...note, marginTop: 6 }}>Minutes by hour of day, from each block's start time.</div>
            </div>
          )}
          {(range.kind === "month" || range.kind === "year" || range.kind === "all") && (
            <div>
              <div style={{ ...h2, fontSize: 16, marginBottom: 10 }}>AVERAGE BY WEEKDAY</div>
              <HBars
                rows={[1, 2, 3, 4, 5, 6, 0].map((d) => ({
                  key: String(d),
                  name: WEEKDAYS[d],
                  value: weekdays[d].avg,
                  right: fmtMin(weekdays[d].avg),
                  title: `Average over ${weekdays[d].samples} ${WEEKDAYS[d]}s`,
                }))}
              />
            </div>
          )}
        </div>
      )}

      {range.kind === "day" && (
        <div style={{ padding: "16px 20px 6px" }}>
          <div style={{ ...h2, fontSize: 16, marginBottom: 10 }}>BLOCKS</div>
          <EntryList list={sum.list} money={money} onSave={onSave} onDelete={onDelete} emptyText="Nothing filed for this day." />
        </div>
      )}

      {/* all-time records */}
      <div style={{ padding: "22px 20px 6px" }}>
        <div style={{ ...h2, fontSize: 16, marginBottom: 10 }}>PERSONAL RECORDS · ALL TIME</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
          <Stat
            title="Best day"
            value={fmtMin(recs.bestDay.min)}
            sub={recs.bestDay.key ? `${fmtDay(recs.bestDay.key)} · view →` : "—"}
            onClick={recs.bestDay.key ? () => nav("day", recs.bestDay.key) : null}
          />
          <Stat
            title="Best week"
            value={fmtMin(recs.bestWeek.min)}
            sub={recs.bestWeek.key ? `from ${fmtDay(recs.bestWeek.key)} · view →` : "—"}
            onClick={recs.bestWeek.key ? () => nav("week", recs.bestWeek.key) : null}
          />
          <Stat
            title="Best month"
            value={fmtMin(recs.bestMonth.min)}
            sub={recs.bestMonth.key ? `${fmtMonth(recs.bestMonth.key)} · view →` : "—"}
            onClick={recs.bestMonth.key ? () => nav("month", recs.bestMonth.key) : null}
          />
          <Stat title="Streak" value={`${recs.streak} d`} sub={`longest ever: ${recs.longestStreak} d`} />
          <Stat
            title="Longest block"
            value={recs.longestSession ? fmtMin(recs.longestSession.minutes) : "—"}
            sub={recs.longestSession ? `${recs.longestSession.project} · ${fmtDay(recs.longestSession.date)}` : ""}
          />
          <Stat
            title="Lifetime focus"
            value={fmtMin(recs.totalFocus)}
            color={C.gold}
            sub={recs.totalMin ? `${Math.round((recs.totalFocus / recs.totalMin) * 100)}% of ${fmtMin(recs.totalMin)} total` : ""}
          />
        </div>
        <div style={{ ...note, marginTop: 8 }}>Day, week and month records count verified time only, so they can't be padded.</div>
      </div>
    </div>
  );
}
