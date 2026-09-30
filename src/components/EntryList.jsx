import React, { useState } from "react";
import { C, DISP, btn, ghostBtn, input, label } from "../theme";
import { fmtMin, hhmm, isValidKey, startMinuteOf } from "../lib/dates";
import { isVerified } from "../lib/insights";

const ratingColor = (r) => (r >= 7 ? C.forest : r >= 4 ? C.gold : C.red);

const stampStyle = (color) => ({
  fontFamily: DISP,
  fontSize: 10,
  letterSpacing: "0.16em",
  color,
  border: `1.5px solid ${color}`,
  padding: "3px 7px",
  textDecoration: "none",
  display: "inline-block",
  transform: "rotate(-2deg)",
});

export default function EntryList({ list, showDate = false, money, onSave, onDelete, emptyText = "Nothing filed." }) {
  const [editId, setEditId] = useState(null);
  const [edit, setEdit] = useState(null);
  const [err, setErr] = useState("");

  const openEdit = (entry) => {
    setErr("");
    if (!entry) {
      setEditId(null);
      setEdit(null);
      return;
    }
    const st = startMinuteOf(entry);
    setEditId(entry.id);
    setEdit({
      date: entry.date,
      minutes: String(entry.minutes),
      start: st == null ? "" : hhmm(st),
      project: entry.project,
      output: entry.output,
      evidence: entry.evidence || "",
      reflection: entry.reflection || "",
      rating: typeof entry.rating === "number" ? entry.rating : null,
    });
  };

  const save = (entry) => {
    if (!isValidKey(edit.date)) return setErr("Pick a valid date — the entry keeps its old one until you do.");
    const minutes = Math.round(Number(edit.minutes));
    if (!Number.isFinite(minutes) || minutes < 1) return setErr("Minutes must be at least 1.");
    const patch = {
      date: edit.date,
      minutes,
      project: edit.project.trim() || entry.project,
      output: edit.output.trim() || entry.output,
      evidence: edit.evidence.trim(),
      reflection: edit.reflection.trim(),
      rating: edit.rating,
    };
    if (/^\d{2}:\d{2}$/.test(edit.start)) {
      patch.started = edit.start;
      patch.startedAt = new Date(`${edit.date}T${edit.start}:00`).getTime();
    } else if (!edit.start) {
      patch.started = "—";
      patch.startedAt = undefined;
    }
    onSave(entry.id, patch);
    openEdit(null);
  };

  if (!list.length)
    return <div style={{ padding: "22px 0", color: C.inkSoft, fontSize: 13, borderTop: `1px solid ${C.rule}` }}>{emptyText}</div>;

  return (
    <div style={{ borderTop: `1px solid ${C.rule}` }}>
      {list.map((e) => {
        const open = editId === e.id;
        const verified = isVerified(e);
        return (
          <div key={e.id} style={{ borderBottom: `1px solid ${C.ruleFaint}` }}>
            <div
              onClick={() => openEdit(open ? null : e)}
              style={{ display: "flex", gap: 14, padding: "12px 0", alignItems: "flex-start", flexWrap: "wrap", cursor: "pointer" }}
            >
              <div style={{ fontFamily: DISP, fontSize: 20, fontWeight: 600, minWidth: 74 }}>{fmtMin(e.minutes)}</div>
              <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflowWrap: "anywhere" }}>
                  {e.project}
                  {e.mult === 1.5 && <span style={{ color: C.gold, marginLeft: 8, fontSize: 11 }}>FOCUS 1.5×</span>}
                  {e.mult === 0.5 && <span style={{ color: C.red, marginLeft: 8, fontSize: 11 }}>ABORTED 0.5×</span>}
                  {typeof e.rating === "number" && (
                    <span
                      style={{ marginLeft: 8, fontSize: 11, color: ratingColor(e.rating), border: `1px solid ${ratingColor(e.rating)}`, padding: "1px 5px" }}
                    >
                      {e.rating}/10
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 2, overflowWrap: "anywhere" }}>{e.output}</div>
                {e.reflection?.trim() && !open && (
                  <div style={{ fontSize: 12, color: C.stamp, marginTop: 3, fontStyle: "italic" }}>
                    ✎ {e.reflection.length > 90 ? e.reflection.slice(0, 90) + "…" : e.reflection}
                  </div>
                )}
                <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 4 }}>
                  {showDate && e.date + " · "}
                  {e.started || "—"}
                  {e.pauseCount > 0 && ` · paused ×${e.pauseCount}`}
                  <span style={{ color: C.stamp }}> · {open ? "close" : "edit"}</span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                {verified ? (
                  <a href={e.evidence} target="_blank" rel="noreferrer" onClick={(ev) => ev.stopPropagation()} style={stampStyle(C.stamp)}>
                    VERIFIED ↗
                  </a>
                ) : (
                  <span style={stampStyle(C.red)}>UNVERIFIED</span>
                )}
                <div style={{ fontSize: 12, marginTop: 6, color: verified ? C.ink : C.inkSoft }}>
                  {verified ? money(e.minutes * (e.mult || 1)) : "—"}
                </div>
              </div>
            </div>

            {open && edit && (
              <div style={{ margin: "0 0 14px", border: `1.5px solid ${C.ink}`, background: C.card, padding: "14px 16px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 14 }}>
                  <div>
                    <div style={label}>Date</div>
                    <input style={input} type="date" value={edit.date} onChange={(ev) => setEdit({ ...edit, date: ev.target.value })} />
                  </div>
                  <div>
                    <div style={label}>Started</div>
                    <input style={input} type="time" value={edit.start} onChange={(ev) => setEdit({ ...edit, start: ev.target.value })} />
                  </div>
                  <div>
                    <div style={label}>Minutes</div>
                    <input style={input} type="number" min="1" value={edit.minutes} onChange={(ev) => setEdit({ ...edit, minutes: ev.target.value })} />
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
                    style={{ ...input, border: `1px solid ${C.rule}`, resize: "vertical", padding: 8 }}
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
                          background: edit.rating === n ? ratingColor(n) : "transparent",
                          color: edit.rating === n ? C.paper : C.ink,
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                {err && <div style={{ fontSize: 12, color: C.red, marginTop: 12 }}>{err}</div>}
                <div style={{ display: "flex", gap: 10, marginTop: 16, alignItems: "center", flexWrap: "wrap" }}>
                  <button style={btn(C.ink, C.paper)} onClick={() => save(e)}>
                    Save
                  </button>
                  <button style={ghostBtn(C.inkSoft)} onClick={() => openEdit(null)}>
                    Cancel
                  </button>
                  <button
                    style={{ ...ghostBtn(C.red, C.red), marginLeft: "auto" }}
                    onClick={() => {
                      if (window.confirm(`Delete this ${fmtMin(e.minutes)} block for good?`)) {
                        onDelete(e.id);
                        openEdit(null);
                      }
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
}
