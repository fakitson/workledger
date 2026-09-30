import React, { useState } from "react";
import { C, DISP, btn, ghostBtn, input, label } from "../theme";
import { isValidKey } from "../lib/dates";

export default function DraftForm({ draft, setDraft, onCommit, money }) {
  const [err, setErr] = useState("");
  const minutes = Math.round(Number(draft.minutes)) || 0;
  const pay = minutes * (draft.mult || 1);

  const file = () => {
    if (!draft.project.trim()) return setErr("Name the project.");
    if (!draft.output.trim()) return setErr("Write one line about what shipped — that's what makes it a record.");
    if (!isValidKey(draft.date)) return setErr("Pick a valid date.");
    if (minutes < 1) return setErr("Minutes must be at least 1.");
    setErr("");
    onCommit();
  };

  return (
    <div id="draft" style={{ padding: "18px 20px", borderBottom: `2px solid ${C.ink}`, background: C.paperDeep }}>
      {draft.suspect && (
        <div style={{ border: `1.5px solid ${C.red}`, padding: "10px 14px", marginBottom: 14, background: C.paper }}>
          <div style={{ fontFamily: DISP, fontSize: 13, letterSpacing: "0.1em", color: C.red }}>UNDER 5 MINUTES — ACCIDENTAL START?</div>
          <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 4 }}>
            This block is {draft.minutes} min. Scrap it, or confirm below that it's real work you want on the record.
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button style={btn(C.red, C.paper)} onClick={() => setDraft(null)}>
              Scrap it
            </button>
            <button style={ghostBtn(C.ink)} onClick={() => setDraft({ ...draft, suspect: false })}>
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 16 }}>
            <div>
              <div style={label}>Date</div>
              <input style={input} type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
            </div>
            {draft.manual && (
              <div>
                <div style={label}>Started at</div>
                <input style={input} type="time" value={draft.started} onChange={(e) => setDraft({ ...draft, started: e.target.value })} />
              </div>
            )}
            <div>
              <div style={label}>Minutes</div>
              <input style={input} type="number" min="1" value={draft.minutes} onChange={(e) => setDraft({ ...draft, minutes: e.target.value })} />
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
          {err && <div style={{ fontSize: 12, color: C.red, marginTop: 12 }}>{err}</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 18, alignItems: "center", flexWrap: "wrap" }}>
            <button style={btn(C.ink, C.paper)} onClick={file}>
              File it
            </button>
            <button style={ghostBtn(C.inkSoft)} onClick={() => setDraft(null)}>
              Discard
            </button>
            <span style={{ fontSize: 11, color: draft.evidence.trim() ? C.stamp : C.red }}>
              {draft.evidence.trim()
                ? `Pays ${money(pay)}${draft.mult !== 1 ? ` (${draft.mult}×)` : ""}`
                : "No link — logs as unverified, pays nothing"}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
