import React from "react";
import { C, DISP, label } from "../theme";
import { fmtMin } from "../lib/dates";

/* Stacked focus / other-work columns with an optional per-bar goal marker. */
export function BarChart({ bars, height = 150, onBar, targetLabel = "Daily goal" }) {
  const peak = Math.max(60, ...bars.map((b) => Math.max(b.f + b.o, b.target || 0)));
  const topH = Math.ceil(peak / 60);
  const step = topH <= 6 ? 1 : topH <= 12 ? 2 : Math.ceil(topH / 5);
  const scaleH = Math.ceil(topH / step) * step;
  const scale = scaleH * 60;
  const lines = [];
  for (let h = step; h <= scaleH; h += step) lines.push(h);
  const gap = bars.length > 40 ? 1 : bars.length > 14 ? 2 : 4;
  const hasTarget = bars.some((b) => b.target);

  return (
    <div>
      <div style={{ display: "flex", gap: 6 }}>
        <div style={{ position: "relative", width: 26, height, flexShrink: 0 }}>
          {lines.map((h) => (
            <div key={h} style={{ position: "absolute", right: 0, bottom: `calc(${(h / scaleH) * 100}% - 6px)`, fontSize: 9, color: C.inkSoft }}>
              {h}h
            </div>
          ))}
        </div>
        <div style={{ flex: 1, overflowX: "auto", minWidth: 0 }}>
          <div style={{ minWidth: bars.length * (bars.length > 40 ? 6 : 10) }}>
            <div style={{ position: "relative", height, display: "flex", alignItems: "stretch", gap, borderBottom: `1.5px solid ${C.ink}` }}>
              {lines.map((h) => (
                <div
                  key={h}
                  style={{ position: "absolute", left: 0, right: 0, bottom: `${(h / scaleH) * 100}%`, borderTop: `1px solid ${C.ruleFaint}`, pointerEvents: "none" }}
                />
              ))}
              {bars.map((b) => {
                const total = b.f + b.o;
                const tip = `${b.label} — ${total ? fmtMin(total) : "nothing"}${b.f ? ` (focus ${fmtMin(b.f)})` : ""}${
                  b.target ? ` · goal ${fmtMin(b.target)}` : ""
                }`;
                return (
                  <button
                    key={b.key}
                    className="barcol"
                    title={tip}
                    aria-label={tip}
                    disabled={!onBar || !b.drill}
                    onClick={() => onBar && b.drill && onBar(b)}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      position: "relative",
                      display: "flex",
                      flexDirection: "column-reverse",
                      background: b.highlight ? "rgba(43,74,122,0.07)" : "none",
                      border: "none",
                      padding: 0,
                      cursor: onBar && b.drill ? "pointer" : "default",
                      opacity: 1,
                    }}
                  >
                    <div style={{ height: `${(b.f / scale) * 100}%`, background: C.gold, flexShrink: 0 }} />
                    <div style={{ height: `${(b.o / scale) * 100}%`, background: C.fill[3], flexShrink: 0 }} />
                    {b.future && <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, borderTop: `1px dashed ${C.rule}` }} />}
                    {b.target > 0 && (
                      <div
                        style={{
                          position: "absolute",
                          left: -gap / 2,
                          right: -gap / 2,
                          bottom: `${(b.target / scale) * 100}%`,
                          borderTop: `1.5px dashed ${C.red}`,
                          pointerEvents: "none",
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap, marginTop: 4 }}>
              {bars.map((b) => (
                <div
                  key={b.key}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 9,
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    overflow: "visible",
                    color: b.highlight ? C.ink : C.inkSoft,
                    fontWeight: b.highlight ? 600 : 400,
                  }}
                >
                  {b.short}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 11, color: C.inkSoft, flexWrap: "wrap" }}>
        <Swatch color={C.gold} text="Focus sessions" />
        <Swatch color={C.fill[3]} text="Other work" />
        {hasTarget && (
          <span style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <span style={{ width: 14, borderTop: `1.5px dashed ${C.red}` }} /> {targetLabel}
          </span>
        )}
      </div>
    </div>
  );
}

export const Swatch = ({ color, text }) => (
  <span style={{ display: "flex", gap: 5, alignItems: "center" }}>
    <span style={{ width: 11, height: 11, background: color }} /> {text}
  </span>
);

export function Stat({ title, value, sub, color, onClick, testId }) {
  const body = (
    <>
      <div style={label}>{title}</div>
      <div style={{ fontFamily: DISP, fontSize: 26, fontWeight: 600, lineHeight: 1.15, color: color || C.ink }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>{sub}</div>}
    </>
  );
  const style = { border: `1px solid ${C.rule}`, background: C.card, padding: "10px 12px", textAlign: "left", minWidth: 0 };
  return onClick ? (
    <button data-testid={testId} onClick={onClick} style={{ ...style, cursor: "pointer", fontFamily: "inherit", color: "inherit" }}>
      {body}
    </button>
  ) : (
    <div data-testid={testId} style={style}>
      {body}
    </div>
  );
}

/* Progress toward a goal, with a tick where linear pace says you should be. */
export function GoalBar({ value, target, expected, height = 14 }) {
  const max = Math.max(target, value) || 1;
  const done = value >= target;
  return (
    <div style={{ position: "relative", background: C.paperDeep, height, border: `1px solid ${C.ruleFaint}` }}>
      <div className="bar" style={{ width: `${Math.min(100, (value / max) * 100)}%`, height: "100%", background: done ? C.forest : C.fill[3] }} />
      <div style={{ position: "absolute", top: -3, bottom: -3, left: `calc(${(target / max) * 100}% - 1px)`, borderLeft: `2px solid ${C.ink}` }} />
      {expected != null && expected < target && (
        <div
          title="Where linear pace says you should be by now"
          style={{ position: "absolute", top: -3, bottom: -3, left: `${(expected / max) * 100}%`, borderLeft: `1.5px dashed ${C.red}` }}
        />
      )}
    </div>
  );
}

/* Horizontal share bars (projects, weekdays). */
export function HBars({ rows, max }) {
  const m = max || Math.max(1, ...rows.map((r) => r.value));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {rows.map((r) => (
        <div key={r.key} title={r.title}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: r.bold ? 600 : 400 }}>{r.name}</span>
            <span style={{ color: C.inkSoft, whiteSpace: "nowrap" }}>{r.right}</span>
          </div>
          <div style={{ display: "flex", height: 8, background: C.paperDeep, marginTop: 3 }}>
            <div style={{ width: `${((r.focus || 0) / m) * 100}%`, background: C.gold }} />
            <div style={{ width: `${((r.value - (r.focus || 0)) / m) * 100}%`, background: C.fill[3] }} />
          </div>
        </div>
      ))}
    </div>
  );
}
