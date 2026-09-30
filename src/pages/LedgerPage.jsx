import React, { useEffect, useMemo, useRef, useState } from "react";
import { C, DISP, card, ghostBtn, h2, label, linkBtn, note } from "../theme";
import { addDays, dayKey, fmtDay, fmtDayLong, fmtMin, fmtMonthShort, hrs, isValidKey, parseKey } from "../lib/dates";
import { isVerified, summarize } from "../lib/insights";
import { buildBank } from "../lib/statement";
import EntryList from "../components/EntryList";

const WEEKS = 26;
const level = (m) => (m === 0 ? 0 : m < 60 ? 1 : m < 150 ? 2 : m < 300 ? 3 : 4);

export default function LedgerPage({ entries, money, route, go, onSave, onDelete, onLogOn, onExport, backup }) {
  const [openWeeks, setOpenWeeks] = useState({});
  const selDay = isValidKey(route.a) ? route.a : null;
  const detailRef = useRef(null);

  const byDay = useMemo(() => {
    const m = {};
    entries.forEach((e) => (m[e.date] = m[e.date] || []).push(e));
    return m;
  }, [entries]);

  const grid = useMemo(() => {
    const today = new Date();
    const end = addDays(today, 6 - today.getDay());
    const start = addDays(end, -(WEEKS * 7) + 1);
    const weeks = [];
    for (let w = 0; w < WEEKS; w++) {
      const col = [];
      for (let d = 0; d < 7; d++) {
        const date = addDays(start, w * 7 + d);
        const key = dayKey(date);
        const list = byDay[key] || [];
        col.push({ key, mins: list.reduce((s, e) => s + e.minutes, 0), future: date > today, verified: list.some(isVerified) });
      }
      const firstOfMonth = col.find((c) => parseKey(c.key).getDate() === 1);
      weeks.push({ col, month: w === 0 ? col[0].key : firstOfMonth?.key });
    }
    return weeks;
  }, [byDay]);

  const bank = useMemo(() => buildBank(entries), [entries]);
  const undated = entries.filter((e) => !isValidKey(e.date));
  const daySum = useMemo(() => (selDay ? summarize(entries, selDay, selDay) : null), [entries, selDay]);

  useEffect(() => {
    if (selDay && detailRef.current) detailRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selDay]);

  useEffect(() => {
    if (route.a === "backup") document.getElementById("backup")?.scrollIntoView({ block: "start" });
  }, [route.a]);

  return (
    <div>
      {undated.length > 0 && (
        <div style={{ padding: "16px 20px 0" }}>
          <div style={{ ...card, borderColor: C.red }}>
            <div style={{ ...label, color: C.red }}>Needs a date · {undated.length}</div>
            <div style={{ ...note, margin: "4px 0 8px" }}>These entries lost their date and can't be counted anywhere. Open each one and pick the day.</div>
            <EntryList list={undated} money={money} onSave={onSave} onDelete={onDelete} />
          </div>
        </div>
      )}

      {/* the record grid */}
      <div style={{ padding: "22px 20px 8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div style={h2}>THE RECORD · 26 WEEKS</div>
          <button style={{ ...ghostBtn(), padding: "7px 14px" }} onClick={onExport}>
            Export statement
          </button>
        </div>
        <div style={{ overflowX: "auto", paddingBottom: 6 }}>
          <div style={{ display: "flex", gap: 3, minWidth: "max-content" }}>
            {grid.map((week, wi) => (
              <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ height: 12, fontSize: 9, color: C.inkSoft, whiteSpace: "nowrap", width: 13, overflow: "visible" }}>
                  {week.month ? fmtMonthShort(week.month) : ""}
                </div>
                {week.col.map((d) => (
                  <button
                    key={d.key}
                    className="cell"
                    title={`${fmtDay(d.key)} — ${d.mins ? fmtMin(d.mins) : "nothing logged"}`}
                    aria-label={`${d.key}: ${hrs(d.mins)} hours`}
                    aria-pressed={selDay === d.key}
                    onClick={() => go(selDay === d.key ? "/ledger" : `/ledger/${d.key}`)}
                    style={{
                      width: 13,
                      height: 13,
                      padding: 0,
                      cursor: "pointer",
                      background: d.future ? "transparent" : C.fill[level(d.mins)],
                      border: d.future ? `1px dashed ${C.ruleFaint}` : d.mins && !d.verified ? `1px solid ${C.red}` : `1px solid ${C.ruleFaint}`,
                      outline: selDay === d.key ? `2px solid ${C.stamp}` : "none",
                      outlineOffset: 1,
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
          {!selDay && <span style={{ color: C.stamp }}>Tap any square to open that day.</span>}
        </div>

        {/* selected day, right under the grid */}
        {selDay && (
          <div ref={detailRef} data-testid="day-detail" style={{ ...card, marginTop: 16, scrollMarginTop: 70 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontFamily: DISP, fontSize: 17, fontWeight: 600, letterSpacing: "0.06em" }}>{fmtDayLong(selDay).toUpperCase()}</div>
              <div style={{ display: "flex", gap: 14 }}>
                <button style={linkBtn} onClick={() => go(`/insights/day/${selDay}`)}>
                  insights →
                </button>
                <button style={linkBtn} onClick={() => go("/ledger")}>
                  close ✕
                </button>
              </div>
            </div>
            <div style={{ fontSize: 12, color: C.inkSoft, margin: "6px 0 10px" }}>
              {daySum.min
                ? `${fmtMin(daySum.min)} worked · ${fmtMin(daySum.focusMin)} focus · ${fmtMin(daySum.vMin)} verified · ${money(daySum.payMin)} earned`
                : "Nothing logged."}
            </div>
            <EntryList list={daySum.list} money={money} onSave={onSave} onDelete={onDelete} emptyText="Nothing filed for this day." />
            <button style={{ ...ghostBtn(), marginTop: 12, padding: "7px 14px" }} onClick={() => onLogOn(selDay)}>
              + Log a block on this day
            </button>
          </div>
        )}
      </div>

      {/* THE BANK */}
      <div style={{ padding: "22px 20px 8px" }}>
        <div style={{ ...h2, marginBottom: 12 }}>THE BANK · WEEK BY WEEK</div>
        {bank.length === 0 ? (
          <div style={{ fontSize: 13, color: C.inkSoft, borderTop: `1px solid ${C.rule}`, padding: "20px 0" }}>No deposits yet.</div>
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
                    fontFamily: "inherit",
                    color: C.ink,
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontFamily: DISP, fontSize: 14, letterSpacing: "0.06em", flex: 1 }}>
                    {openWeeks[w.ws] ? "▾" : "▸"} WEEK OF {fmtDay(w.ws).toUpperCase()}
                  </span>
                  <span style={{ fontSize: 13 }}>{fmtMin(w.vMin)}</span>
                  <span style={{ fontFamily: DISP, fontSize: 16, fontWeight: 600, color: C.red, width: 100, textAlign: "right" }}>{money(w.payMin)}</span>
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
                              <button style={{ ...linkBtn, fontFamily: "inherit", fontSize: 12, fontWeight: 600, letterSpacing: 0, textTransform: "none", color: C.ink, flex: 1, textAlign: "left" }} onClick={() => go(`/ledger/${dk}`)}>
                                {fmtDay(dk)}
                              </button>
                              <span style={{ fontSize: 12 }}>{fmtMin(day.vMin)}</span>
                              <span style={{ fontSize: 12, color: C.red, width: 100, textAlign: "right" }}>{money(day.payMin)}</span>
                            </div>
                            {day.list.map((e) => (
                              <div key={e.id} style={{ display: "flex", gap: 10, fontSize: 11, color: C.inkSoft, padding: "2px 0 2px 12px" }}>
                                <span style={{ minWidth: 56 }}>{fmtMin(e.minutes)}</span>
                                <span style={{ flex: 1, overflowWrap: "anywhere" }}>
                                  <b style={{ color: C.ink }}>{e.project}</b> — {e.output}
                                  {e.mult === 1.5 && <span style={{ color: C.gold }}> · 1.5×</span>}
                                  {e.mult === 0.5 && <span style={{ color: C.red }}> · 0.5×</span>}
                                  {!isVerified(e) && <span style={{ color: C.red }}> · unverified</span>}
                                </span>
                                <span style={{ width: 70, textAlign: "right" }}>{isVerified(e) ? money(e.minutes * (e.mult || 1)) : "—"}</span>
                              </div>
                            ))}
                            {day.uMin > 0 && <div style={{ fontSize: 10, color: C.red, paddingLeft: 12 }}>unverified today: {fmtMin(day.uMin)} (pays nothing)</div>}
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

      {backup}
    </div>
  );
}
