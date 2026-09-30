import React, { useMemo, useState } from "react";
import { C, DISP, big, btn, ghostBtn, h2, input, label, linkBtn, note } from "../theme";
import { addDays, clockFmt, dayKey, fmtDay, fmtMin, hhmm, hrs, shiftKey, todayKey } from "../lib/dates";
import { dayFraction, isVerified, summarize } from "../lib/insights";
import EntryList from "../components/EntryList";
import { GoalBar, Stat } from "../components/Charts";

export default function TodayPage(p) {
  const { entries, settings, money, stats, recs, running, elapsedSec, focusDone, focusLeft, go, tick } = p;
  const [showPayslip, setShowPayslip] = useState(false);
  const today = todayKey();

  /* ---------- today readout ---------- */
  const day = useMemo(() => summarize(entries, today, today), [entries, today]);
  const typical = useMemo(() => {
    const s = summarize(entries, shiftKey(today, -28), shiftKey(today, -1));
    return s.activeDays ? s.min / s.activeDays : 0;
  }, [entries, today]);
  const liveMin = running ? elapsedSec / 60 : 0;
  const workedNow = day.min + liveMin;
  const dailyGoal = (Number(settings.dailyGoal) || 0) * 60;
  const expectedNow = dailyGoal * dayFraction();

  /* ---------- shadow race: this week vs trailing 4-week average, paced to now ---------- */
  const race = useMemo(() => {
    const verOn = {};
    entries.forEach((e) => {
      if (isVerified(e)) verOn[e.date] = (verOn[e.date] || 0) + e.minutes;
    });
    const now = new Date();
    const todayIdx = now.getDay();
    const weekStart = addDays(now, -todayIdx);
    let mine = 0;
    for (let d = 0; d <= todayIdx; d++) mine += verOn[dayKey(addDays(weekStart, d))] || 0;
    const frac = dayFraction(now);
    let weeksWithData = 0,
      total = 0,
      fullWeekTotal = 0;
    for (let w = 1; w <= 4; w++) {
      const ws = addDays(weekStart, -7 * w);
      let any = false,
        sum = 0,
        full = 0;
      for (let d = 0; d < 7; d++) {
        const m = verOn[dayKey(addDays(ws, d))] || 0;
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
  }, [entries, tick]);

  /* ---------- payslip ---------- */
  const payslip = useMemo(() => {
    const now = new Date();
    const ws = dayKey(addDays(now, -now.getDay()));
    const we = dayKey(addDays(now, 6 - now.getDay()));
    let baseMin = 0,
      focusMin = 0,
      abortMin = 0;
    entries.forEach((e) => {
      if (!isVerified(e) || e.date < ws || e.date > we) return;
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

  const delta = race.mine - race.shadowNow;
  const ahead = delta >= 0;
  const barMax = Math.max(race.mine, race.shadowNow, 60) * 1.15;

  const todays = entries.filter((e) => e.date === today);
  const recent = entries
    .filter((e) => e.date < today)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.startedAt || 0) - (a.startedAt || 0))
    .slice(0, 5);

  return (
    <div>
      {entries.length === 0 && (
        <div data-testid="empty-hint" style={{ margin: "16px 20px 0", border: `1.5px solid ${C.stamp}`, background: C.card, padding: "12px 14px" }}>
          <div style={{ ...label, color: C.stamp }}>Empty ledger</div>
          <div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>
            Logged work before at a different web address or on another device? Your history is still there — bring it over with Restore.
          </div>
          <button style={{ ...ghostBtn(), marginTop: 10, padding: "7px 14px" }} onClick={() => go("/ledger/backup")}>
            Restore my history →
          </button>
        </div>
      )}
      {entries.length > 0 && (!settings.lastBackupAt || Date.now() - settings.lastBackupAt > 7 * 86400000) && (
        <div
          data-testid="backup-reminder"
          style={{ margin: "16px 20px 0", border: `1.5px solid ${C.gold}`, background: C.card, padding: "10px 14px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}
        >
          <div style={{ fontSize: 12, flex: "1 1 220px", lineHeight: 1.5 }}>
            <b>{settings.lastBackupAt ? `Last backup ${Math.floor((Date.now() - settings.lastBackupAt) / 86400000)} days ago.` : "No backup yet."}</b> Your
            ledger only lives in this browser — keep a copy in case it gets cleared.
          </div>
          <button style={{ ...btn(C.gold, C.paper), padding: "7px 14px" }} onClick={p.onBackup}>
            Download backup
          </button>
        </div>
      )}
      <Clock {...p} />

      {/* TODAY SO FAR */}
      <div style={{ padding: "18px 20px", borderBottom: `2px solid ${C.ink}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
          <div style={h2}>TODAY SO FAR</div>
          <button style={linkBtn} onClick={() => go(`/insights/day/${today}`)}>
            full day breakdown →
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginTop: 12 }}>
          <Stat
            testId="today-worked"
            title="Worked"
            value={fmtMin(workedNow)}
            sub={running ? `incl. ${fmtMin(liveMin)} running now` : `${fmtMin(day.vMin)} verified`}
          />
          <Stat
            title="Deep focus"
            value={fmtMin(day.focusMin)}
            color={day.focusMin ? C.gold : undefined}
            sub={day.min ? `${Math.round(day.focusShare * 100)}% of today` : "no focus block yet"}
          />
          <Stat title="Blocks" value={day.sessions} sub={day.sessions ? `avg ${fmtMin(day.avgSession)}` : "none filed"} />
          <Stat
            title="Vs your usual"
            value={typical ? `${workedNow >= typical ? "+" : "−"}${fmtMin(Math.abs(workedNow - typical))}` : "—"}
            color={typical ? (workedNow >= typical ? C.forest : C.red) : undefined}
            sub={typical ? `typical working day: ${fmtMin(typical)}` : "needs a few days of history"}
          />
        </div>
        {dailyGoal > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
              <span style={label}>Daily goal · {fmtMin(dailyGoal)}</span>
              <span style={{ fontSize: 12, color: workedNow >= dailyGoal ? C.forest : workedNow >= expectedNow ? C.stamp : C.red }}>
                {workedNow >= dailyGoal
                  ? `✓ goal hit — ${fmtMin(workedNow - dailyGoal)} over`
                  : `${fmtMin(dailyGoal - workedNow)} to go · ${workedNow >= expectedNow ? "on pace" : `${fmtMin(expectedNow - workedNow)} behind pace`}`}
              </span>
            </div>
            <GoalBar value={workedNow} target={dailyGoal} expected={expectedNow} />
          </div>
        )}
        {day.firstStart != null && (
          <div style={{ ...note, marginTop: 8 }}>
            First block started {hhmm(day.firstStart)} · last one ended {hhmm(day.lastEnd)}
          </div>
        )}
      </div>

      {/* THE RACE */}
      <div style={{ padding: "18px 20px", borderBottom: `2px solid ${C.ink}`, background: C.card }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
          <div style={h2}>THIS WEEK vs THE SHADOW</div>
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
                {ahead ? "AHEAD" : "BEHIND"} {ahead ? "+" : "−"}
                {money(Math.abs(delta))}
              </div>
            )}
            <button
              onClick={() => setShowPayslip((s) => !s)}
              style={{ ...ghostBtn(payslip.isPayday ? C.gold : C.stamp, payslip.isPayday ? C.gold : C.rule), padding: "5px 12px" }}
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
            <div style={{ ...note, marginTop: 8 }}>
              {race.weeksWithData > 0 && `vs shadow: ${ahead ? "ahead by" : "behind by"} ${fmtMin(Math.abs(delta))}. `}
              {recs.weekRecordIsNow && "★ Week record in progress. "}
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
            <RaceBar name="You" value={race.mine} max={barMax} fill={C.fill[3]} color={C.ink} />
            <RaceBar
              name="Shadow"
              value={race.shadowNow}
              max={barMax}
              fill={`repeating-linear-gradient(45deg, ${C.shadow}, ${C.shadow} 5px, transparent 5px, transparent 9px)`}
              color={C.shadow}
            />
            <div style={{ ...note, marginTop: 8 }}>
              Shadow = trailing {race.weeksWithData}-week average of verified time, paced to this moment. Full-week target: {hrs(race.shadowFullWeek)} h.
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginTop: 14 }}>
          <RecordTile
            title="Day record"
            value={`${hrs(recs.bestDay.min)} h`}
            flag={recs.dayRecordIsToday && "★ NEW — SET TODAY"}
            sub={recs.bestDay.key ? fmtDay(recs.bestDay.key) : "—"}
            onClick={recs.bestDay.key ? () => go(`/insights/day/${recs.bestDay.key}`) : null}
          />
          <RecordTile
            title="Week record"
            value={`${hrs(recs.bestWeek.min)} h`}
            flag={recs.weekRecordIsNow && "★ LIVE — THIS WEEK"}
            sub={recs.bestWeek.key ? `week of ${fmtDay(recs.bestWeek.key)}` : "—"}
            onClick={recs.bestWeek.key ? () => go(`/insights/week/${recs.bestWeek.key}`) : null}
          />
          <RecordTile
            title="Today · verified"
            value={fmtMin(recs.today)}
            sub={recs.bestDay.min > recs.today ? `${fmtMin(recs.bestDay.min - recs.today)} to the record` : "record pace"}
          />
          <RecordTile title="Streak" value={`${stats.streak} d`} sub={`evidenced days in a row · best ${recs.longestStreak} d`} />
        </div>
      </div>

      {/* TODAY'S BLOCKS */}
      <div style={{ padding: "18px 20px 0" }}>
        <div style={{ ...h2, fontSize: 16, marginBottom: 10 }}>TODAY'S BLOCKS</div>
        <EntryList
          list={todays}
          money={money}
          onSave={p.onSave}
          onDelete={p.onDelete}
          emptyText="No blocks yet today. Start the clock, then close the block with a link to what you shipped."
        />
        {recent.length > 0 && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "22px 0 10px", gap: 8 }}>
              <div style={{ ...h2, fontSize: 16 }}>EARLIER</div>
              <button style={linkBtn} onClick={() => go("/ledger")}>
                full ledger →
              </button>
            </div>
            <EntryList list={recent} showDate money={money} onSave={p.onSave} onDelete={p.onDelete} />
          </>
        )}
      </div>
    </div>
  );
}

function RaceBar({ name, value, max, fill, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
      <div style={{ ...label, width: 62, color }}>{name}</div>
      <div style={{ flex: 1, background: C.paperDeep, height: 22 }}>
        <div className="bar" style={{ width: `${Math.min(100, (value / max) * 100)}%`, height: "100%", background: fill }} />
      </div>
      <div style={{ fontFamily: DISP, fontSize: 18, fontWeight: 600, width: 70, textAlign: "right", color }}>{hrs(value)} h</div>
    </div>
  );
}

function RecordTile({ title, value, flag, sub, onClick }) {
  const inner = (
    <>
      <div style={label}>{title}</div>
      <div style={big}>
        {value} {flag && <span style={{ fontSize: 11, color: C.red, letterSpacing: "0.14em" }}>{flag}</span>}
      </div>
      <div style={note}>
        {sub}
        {onClick && <span style={{ color: C.stamp }}> · view →</span>}
      </div>
    </>
  );
  const base = { textAlign: "left", padding: "6px 0", minWidth: 0 };
  return onClick ? (
    <button onClick={onClick} style={{ ...base, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", color: "inherit" }}>
      {inner}
    </button>
  ) : (
    <div style={base}>{inner}</div>
  );
}

function Clock({ running, elapsedSec, focusDone, focusLeft, money, projectField, setProjectField, start, pause, resume, stop, manual, inCooldown, projects }) {
  if (running)
    return (
      <div style={{ padding: "18px 20px", borderBottom: `1px solid ${C.rule}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          {!running.pausedAt && <div className="pulse" style={{ width: 9, height: 9, background: running.mode === "focus" ? C.gold : C.red, borderRadius: 9 }} />}
          {running.pausedAt && (
            <div style={{ fontFamily: DISP, fontSize: 12, letterSpacing: "0.14em", color: C.inkSoft, border: `1px solid ${C.rule}`, padding: "2px 8px" }}>PAUSED</div>
          )}
          <div
            style={{ fontFamily: DISP, fontSize: 38, fontWeight: 600, letterSpacing: "0.04em", lineHeight: 1, color: running.pausedAt ? C.inkSoft : C.ink }}
          >
            {clockFmt(elapsedSec)}
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            {running.mode === "focus" ? (
              <>
                <div style={{ ...label, color: C.gold }}>
                  FOCUS · {running.targetMin} min · 1.5× ({money(90)}/h)
                </div>
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
              <button style={btn(C.stamp, C.paper)} onClick={resume}>
                Resume
              </button>
            ) : (
              <button style={ghostBtn(C.ink)} onClick={pause}>
                Pause
              </button>
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
    );

  return (
    <div style={{ padding: "18px 20px", borderBottom: `1px solid ${C.rule}` }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 220px" }}>
          <div style={label}>Project</div>
          <input
            style={input}
            value={projectField}
            list="project-names"
            placeholder="UniTold / FrameFusion / Signals & Systems"
            onChange={(e) => setProjectField(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && start("normal")}
          />
          <datalist id="project-names">
            {projects.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
        <button style={btn(C.ink, C.paper)} disabled={inCooldown || !projectField.trim()} onClick={() => start("normal")}>
          {inCooldown ? "…" : "Start clock"}
        </button>
        <button style={btn(C.gold, C.paper)} disabled={inCooldown || !projectField.trim()} onClick={() => start("focus", 50)}>
          Focus 50′ · 1.5×
        </button>
        <button style={btn(C.gold, C.paper)} disabled={inCooldown || !projectField.trim()} onClick={() => start("focus", 90)}>
          Focus 90′ · 1.5×
        </button>
        <button style={ghostBtn()} onClick={() => manual()}>
          Log past block
        </button>
      </div>
      <div style={{ ...note, marginTop: 8 }}>
        {projectField.trim()
          ? `Focus = committed duration, no pause, ${money(90)}/h if you finish — half rate if you abort. Hours on the statement stay real either way.`
          : "Name a project to start the clock."}
      </div>
    </div>
  );
}
