import React, { useState } from "react";
import { C, btn, card, ghostBtn, h2, input, label, note } from "../theme";
import { fmtMin } from "../lib/dates";
import { makeBackup, parseBackup } from "../lib/backup";
import { download } from "../lib/statement";

const CONSOLE_CMD = 'copy(localStorage.getItem("worklog:v1"))';

export default function BackupPanel({ entries, settings, world, onRestore }) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState(null);
  const [msg, setMsg] = useState(null);

  const check = (t) => {
    setMsg(null);
    try {
      setParsed(parseBackup(t));
    } catch (e) {
      setParsed(null);
      setMsg({ tone: "bad", text: e.message });
    }
  };

  const onFile = async (ev) => {
    const f = ev.target.files?.[0];
    ev.target.value = "";
    if (!f) return;
    const t = await f.text();
    setText(t);
    check(t);
  };

  const restore = () => {
    const r = onRestore(parsed);
    setParsed(null);
    setText("");
    setMsg({
      tone: "good",
      text: `Restored ${r.added} block${r.added === 1 ? "" : "s"}${r.duplicates ? ` (${r.duplicates} already here, skipped)` : ""}${
        r.plots ? ` and ${r.plots} forest plot${r.plots === 1 ? "" : "s"}` : ""
      }.`,
    });
  };

  const total = parsed ? parsed.entries.reduce((s, e) => s + e.minutes, 0) : 0;
  const dates = parsed?.entries.map((e) => e.date).sort() || [];

  return (
    <div id="backup" data-testid="backup" style={{ padding: "22px 20px 8px", scrollMarginTop: 60 }}>
      <div style={{ ...h2, marginBottom: 6 }}>BACKUP & RESTORE</div>
      <div style={{ ...note, fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>
        Your ledger lives in this browser, at this exact web address. Download a backup now and then — and use restore to bring history over from
        another address or device. Restoring only adds blocks; it never deletes anything.
      </div>

      <button
        style={{ ...btn(C.ink, C.paper), marginBottom: 18 }}
        onClick={() =>
          download(`workledger-backup-${new Date().toISOString().slice(0, 10)}.json`, makeBackup({ entries, settings, world }), "application/json")
        }
      >
        Download backup ({entries.length} blocks)
      </button>

      <div style={card}>
        <div style={label}>Restore</div>
        <textarea
          aria-label="Backup data"
          rows={4}
          value={text}
          placeholder="Paste the copied data here, or choose a file below"
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value.trim()) check(e.target.value);
            else {
              setParsed(null);
              setMsg(null);
            }
          }}
          style={{ ...input, border: `1px solid ${C.rule}`, padding: 8, marginTop: 8, resize: "vertical", fontSize: 11 }}
        />
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
          <label style={{ ...ghostBtn(), padding: "7px 14px", display: "inline-block" }}>
            Choose file…
            <input type="file" accept=".json,.md,.txt,application/json,text/markdown,text/plain" onChange={onFile} style={{ display: "none" }} />
          </label>
          <span style={note}>A backup (.json) or an exported statement (.md)</span>
        </div>

        {parsed && (
          <div style={{ marginTop: 14, borderTop: `1px dashed ${C.rule}`, paddingTop: 12 }}>
            <div style={{ fontSize: 13 }}>
              Found <b>{parsed.entries.length} blocks</b> · {fmtMin(total)}
              {dates.length > 0 && ` · ${dates[0]} → ${dates[dates.length - 1]}`}
              {parsed.world?.length ? ` · ${parsed.world.length} forest plots` : ""}
            </div>
            {parsed.rejected > 0 && <div style={{ ...note, color: C.red, marginTop: 4 }}>{parsed.rejected} unreadable item(s) will be skipped.</div>}
            {parsed.lossy && (
              <div style={{ ...note, marginTop: 4 }}>
                From a statement file: focus multipliers and start times aren't in that format, so focus blocks come back as regular time.
              </div>
            )}
            <button style={{ ...btn(C.forest, C.paper), marginTop: 12 }} onClick={restore}>
              Restore these blocks
            </button>
          </div>
        )}
        {msg && <div style={{ fontSize: 12, marginTop: 12, color: msg.tone === "good" ? C.forest : C.red }}>{msg.text}</div>}
      </div>

      <details style={{ marginTop: 14, fontSize: 12, lineHeight: 1.6 }}>
        <summary style={{ cursor: "pointer", color: C.stamp }}>How do I get my data out of an old address?</summary>
        <ol style={{ paddingLeft: 18, margin: "8px 0" }}>
          <li>On a computer, open the old address — the one that still has your blocks.</li>
          <li>
            Press <b>F12</b> (Mac: <b>Cmd+Option+J</b>) and click the <b>Console</b> tab.
          </li>
          <li>
            Type this and press Enter: <code style={{ background: C.paperDeep, padding: "1px 4px" }}>{CONSOLE_CMD}</code>
            <button style={{ ...ghostBtn(), padding: "2px 8px", marginLeft: 6, fontSize: 10 }} onClick={() => navigator.clipboard?.writeText(CONSOLE_CMD)}>
              copy command
            </button>
          </li>
          <li>Your data is now on the clipboard. Come back here and paste it into the box above.</li>
        </ol>
        <div style={note}>
          On a phone: open the old address, go to the record section, tap <b>Export statement</b>, then choose that file here.
        </div>
      </details>
    </div>
  );
}
