import {
  addDays,
  dayKey,
  daysBetween,
  daysInMonth,
  fmtDay,
  fmtDayLong,
  fmtMin,
  fmtMonth,
  fmtMonthShort,
  hhmm,
  isValidKey,
  parseKey,
  shiftKey,
  startMinuteOf,
  todayKey,
} from "./dates";

export const isVerified = (e) => !!e.evidence?.trim();
export const isFocus = (e) => e.mode === "focus" && (e.mult || 1) > 1;
export const isAborted = (e) => e.mode === "focus" && (e.mult || 1) < 1;

export const PERIOD_KINDS = ["day", "week", "month", "year", "all"];
const UNIT = { day: "day", week: "week", month: "month", year: "year", all: "stretch" };

export const firstEntryKey = (entries) =>
  entries.reduce((min, e) => (isValidKey(e.date) && (!min || e.date < min) ? e.date : min), null);

/* ---------- periods ---------- */

export function periodRange(kind, anchor, firstKey = null) {
  const today = todayKey();
  const a = parseKey(anchor);
  let start, end, label, prevAnchor = null, nextAnchor = null;
  if (kind === "day") {
    start = end = anchor;
    label = fmtDayLong(anchor);
    prevAnchor = shiftKey(anchor, -1);
    nextAnchor = shiftKey(anchor, 1);
  } else if (kind === "week") {
    const s = addDays(a, -a.getDay());
    start = dayKey(s);
    end = dayKey(addDays(s, 6));
    label = `${fmtDay(start)} – ${fmtDay(end)}`;
    prevAnchor = dayKey(addDays(s, -7));
    nextAnchor = dayKey(addDays(s, 7));
  } else if (kind === "month") {
    const y = a.getFullYear();
    const m = a.getMonth();
    start = dayKey(new Date(y, m, 1, 12));
    end = dayKey(new Date(y, m, daysInMonth(y, m), 12));
    label = fmtMonth(start);
    prevAnchor = dayKey(new Date(y, m - 1, 1, 12));
    nextAnchor = dayKey(new Date(y, m + 1, 1, 12));
  } else if (kind === "year") {
    const y = a.getFullYear();
    start = `${y}-01-01`;
    end = `${y}-12-31`;
    label = String(y);
    prevAnchor = `${y - 1}-01-01`;
    nextAnchor = `${y + 1}-01-01`;
  } else {
    kind = "all";
    start = firstKey && firstKey < today ? firstKey : today;
    end = today;
    label = "All time";
  }
  const days = daysBetween(start, end) + 1;
  const elapsedDays = today < start ? 0 : today > end ? days : daysBetween(start, today) + 1;
  return {
    kind,
    anchor,
    start,
    end,
    label,
    days,
    elapsedDays,
    unit: UNIT[kind],
    containsToday: today >= start && today <= end,
    isFuture: start > today,
    prevAnchor,
    nextAnchor: nextAnchor && nextAnchor <= today ? nextAnchor : null,
  };
}

/* ---------- summarize a date range ---------- */

export function summarize(entries, start, end) {
  const s = {
    min: 0,
    vMin: 0,
    uMin: 0,
    focusMin: 0,
    abortMin: 0,
    payMin: 0,
    sessions: 0,
    focusSessions: 0,
    abortedSessions: 0,
    pauses: 0,
    ratingSum: 0,
    ratingCount: 0,
    longest: null,
    firstStart: null,
    lastEnd: null,
    days: {},
    projects: {},
    hours: Array.from({ length: 24 }, () => ({ f: 0, o: 0 })),
    weekday: Array(7).fill(0),
    knownStartMin: 0,
    list: [],
  };
  for (const e of entries) {
    if (!isValidKey(e.date) || e.date < start || e.date > end) continue;
    const m = Math.max(0, Number(e.minutes) || 0);
    const focus = isFocus(e);
    s.list.push(e);
    s.min += m;
    s.sessions++;
    if (isVerified(e)) {
      s.vMin += m;
      s.payMin += m * (e.mult || 1);
    } else s.uMin += m;
    if (focus) {
      s.focusMin += m;
      s.focusSessions++;
    }
    if (isAborted(e)) {
      s.abortMin += m;
      s.abortedSessions++;
    }
    s.pauses += e.pauseCount || 0;
    if (typeof e.rating === "number") {
      s.ratingSum += e.rating;
      s.ratingCount++;
    }
    if (!s.longest || m > s.longest.minutes) s.longest = e;

    const d = (s.days[e.date] = s.days[e.date] || { min: 0, focusMin: 0, vMin: 0 });
    d.min += m;
    if (focus) d.focusMin += m;
    if (isVerified(e)) d.vMin += m;

    const name = e.project?.trim() || "Untitled";
    const p = (s.projects[name] = s.projects[name] || { name, min: 0, focusMin: 0, sessions: 0 });
    p.min += m;
    p.sessions++;
    if (focus) p.focusMin += m;

    s.weekday[parseKey(e.date).getDay()] += m;

    const st = startMinuteOf(e);
    if (st != null) {
      s.knownStartMin += m;
      if (s.firstStart == null || st < s.firstStart) s.firstStart = st;
      if (s.lastEnd == null || st + m > s.lastEnd) s.lastEnd = st + m;
      let rem = m;
      let cur = st;
      while (rem > 0) {
        const chunk = Math.min(rem, 60 - (cur % 60));
        s.hours[Math.floor(cur / 60) % 24][focus ? "f" : "o"] += chunk;
        rem -= chunk;
        cur += chunk;
      }
    }
  }
  s.activeDays = Object.keys(s.days).length;
  s.avgSession = s.sessions ? s.min / s.sessions : 0;
  s.focusShare = s.min ? s.focusMin / s.min : 0;
  s.bestDay = Object.entries(s.days).reduce((b, [k, d]) => (d.min > (b?.min || 0) ? { key: k, min: d.min } : b), null);
  s.projectList = Object.values(s.projects).sort((a, b) => b.min - a.min);
  return s;
}

/* ---------- comparison with the previous period ---------- */

export function comparePrev(entries, range) {
  if (range.kind === "all" || !range.prevAnchor || range.isFuture) return null;
  const prev = periodRange(range.kind, range.prevAnchor);
  let end = prev.end;
  let partial = false;
  if (range.containsToday && range.kind !== "day") {
    const cut = shiftKey(prev.start, range.elapsedDays - 1);
    if (cut < prev.end) {
      end = cut;
      partial = true;
    }
  }
  const s = summarize(entries, prev.start, end);
  const text =
    range.kind === "day"
      ? "vs the day before"
      : partial
        ? `vs the same ${range.elapsedDays} day${range.elapsedDays === 1 ? "" : "s"} of last ${range.unit}`
        : `vs the previous ${range.unit}`;
  return { min: s.min, focusMin: s.focusMin, text, anchor: prev.anchor };
}

/* ---------- goals ---------- */

// Fraction of a working day (06:00 → 22:00) that has passed.
export const dayFraction = (now = new Date()) => Math.min(1, Math.max(0, (now.getHours() + now.getMinutes() / 60 - 6) / 16));

export function goalFor(range, settings, now = new Date()) {
  const daily = (Number(settings.dailyGoal) || 0) * 60;
  const weekly = (Number(settings.weeklyGoal) || 0) * 60;
  let target = 0;
  if (range.kind === "day") target = daily;
  else if (range.kind === "week") target = weekly;
  else if (range.kind === "month" || range.kind === "year") target = (weekly * range.days) / 7;
  if (!target) return null;
  let expected;
  if (range.isFuture) expected = 0;
  else if (!range.containsToday) expected = target;
  else if (range.kind === "day") expected = target * dayFraction(now);
  else expected = (target * (range.elapsedDays - 1 + dayFraction(now))) / range.days;
  return { target, expected };
}

/* ---------- chart series ---------- */

export function chartSeries(range, sum, settings) {
  const today = todayKey();
  const dGoal = (Number(settings.dailyGoal) || 0) * 60 || null;
  const wGoal = (Number(settings.weeklyGoal) || 0) * 60;
  if (range.kind === "day") {
    return sum.hours.map((h, i) => ({
      key: `h${i}`,
      label: `${hhmm(i * 60)}–${hhmm((i + 1) * 60)}`,
      short: i % 3 === 0 ? String(i).padStart(2, "0") : "",
      f: h.f,
      o: h.o,
    }));
  }
  if (range.kind === "week" || range.kind === "month") {
    const out = [];
    for (let i = 0; i < range.days; i++) {
      const k = shiftKey(range.start, i);
      const d = sum.days[k] || { min: 0, focusMin: 0 };
      const date = parseKey(k).getDate();
      out.push({
        key: k,
        label: fmtDay(k),
        short:
          range.kind === "week"
            ? parseKey(k).toLocaleDateString(undefined, { weekday: "short" }) + " " + date
            : date === 1 || date % 5 === 0
              ? String(date)
              : "",
        f: d.focusMin,
        o: d.min - d.focusMin,
        target: dGoal,
        future: k > today,
        highlight: k === today,
        drill: { kind: "day", anchor: k },
      });
    }
    return out;
  }
  // year / all: bucket by month (or by year when history is long)
  const months = [];
  const s = parseKey(range.start);
  const e = parseKey(range.end);
  let y = s.getFullYear();
  let m = range.kind === "year" ? 0 : s.getMonth();
  const endY = e.getFullYear();
  const endM = range.kind === "year" ? 11 : e.getMonth();
  while (y < endY || (y === endY && m <= endM)) {
    months.push([y, m]);
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  const monthOf = (k) => k.slice(0, 7);
  const byMonth = {};
  Object.entries(sum.days).forEach(([k, d]) => {
    const b = (byMonth[monthOf(k)] = byMonth[monthOf(k)] || { min: 0, focusMin: 0 });
    b.min += d.min;
    b.focusMin += d.focusMin;
  });
  const thisMonth = monthOf(today);
  if (months.length > 36) {
    const years = {};
    months.forEach(([yy]) => (years[yy] = { min: 0, focusMin: 0 }));
    Object.entries(byMonth).forEach(([mk, b]) => {
      const yy = Number(mk.slice(0, 4));
      if (years[yy]) {
        years[yy].min += b.min;
        years[yy].focusMin += b.focusMin;
      }
    });
    return Object.entries(years).map(([yy, b]) => ({
      key: yy,
      label: yy,
      short: yy,
      f: b.focusMin,
      o: b.min - b.focusMin,
      target: wGoal ? wGoal * 52 : null,
      highlight: Number(yy) === new Date().getFullYear(),
      drill: { kind: "year", anchor: `${yy}-01-01` },
    }));
  }
  return months.map(([yy, mm], i) => {
    const key = `${yy}-${String(mm + 1).padStart(2, "0")}`;
    const b = byMonth[key] || { min: 0, focusMin: 0 };
    const first = `${key}-01`;
    const shown = months.length <= 18 || mm % 3 === 0;
    return {
      key,
      label: fmtMonth(first),
      short: !shown ? "" : range.kind === "all" && (mm === 0 || i === 0) ? `${fmtMonthShort(first)} '${String(yy).slice(2)}` : fmtMonthShort(first),
      f: b.focusMin,
      o: b.min - b.focusMin,
      target: wGoal ? (wGoal * daysInMonth(yy, mm)) / 7 : null,
      future: key > thisMonth,
      highlight: key === thisMonth,
      drill: { kind: "month", anchor: first },
    };
  });
}

/* ---------- weekday pattern ---------- */

// Average minutes per weekday over the elapsed part of the range.
export function weekdayAverages(range, sum) {
  const counts = Array(7).fill(0);
  const last = range.containsToday ? todayKey() : range.end;
  const n = Math.max(0, daysBetween(range.start, last) + 1);
  for (let i = 0; i < n; i++) counts[parseKey(shiftKey(range.start, i)).getDay()]++;
  return sum.weekday.map((m, i) => ({ day: i, avg: counts[i] ? m / counts[i] : 0, samples: counts[i] }));
}

// Best contiguous window of `span` hours by logged time.
export function peakWindow(sum, span = 3) {
  let best = { start: 0, min: 0 };
  for (let h = 0; h <= 24 - span; h++) {
    let t = 0;
    for (let j = 0; j < span; j++) t += sum.hours[h + j].f + sum.hours[h + j].o;
    if (t > best.min) best = { start: h, min: t };
  }
  return best;
}

/* ---------- the honest read ---------- */

export function honestRead(range, sum, prev, goal) {
  const out = [];
  const unit = range.unit;
  const pct = (x) => `${Math.round(x * 100)}%`;
  if (range.isFuture) return [{ tone: "neutral", text: `This ${unit} hasn't started yet.` }];
  if (sum.min === 0) {
    out.push({
      tone: "bad",
      text: range.containsToday
        ? `Nothing logged yet this ${unit}. The first block is the hardest — start the clock.`
        : `Nothing logged this ${unit}.`,
    });
    return out;
  }

  if (goal && goal.target) {
    if (sum.min >= goal.target) out.push({ tone: "good", text: `Goal hit: ${fmtMin(sum.min)} of ${fmtMin(goal.target)}.` });
    else if (range.containsToday) {
      const diff = sum.min - goal.expected;
      out.push(
        diff >= 0
          ? { tone: "good", text: `On pace for your goal — ${fmtMin(diff)} ahead of where you need to be. ${fmtMin(goal.target - sum.min)} still to go.` }
          : { tone: "bad", text: `Behind goal pace by ${fmtMin(-diff)}. You need ${fmtMin(goal.target - sum.min)} more to hit ${fmtMin(goal.target)}.` }
      );
    } else out.push({ tone: "bad", text: `Missed the goal by ${fmtMin(goal.target - sum.min)} (${fmtMin(sum.min)} of ${fmtMin(goal.target)}).` });
  }

  if (prev && (prev.min > 0 || sum.min > 0)) {
    const diff = sum.min - prev.min;
    if (Math.abs(diff) >= 5) {
      const rel = prev.min ? ` (${diff > 0 ? "+" : "−"}${pct(Math.abs(diff) / prev.min)})` : "";
      out.push({
        tone: diff > 0 ? "good" : "bad",
        text: `${diff > 0 ? "Up" : "Down"} ${fmtMin(Math.abs(diff))}${rel} ${prev.text}.`,
      });
    }
  }

  if (range.kind !== "day") {
    const idle = range.elapsedDays - sum.activeDays;
    const ratio = range.elapsedDays ? sum.activeDays / range.elapsedDays : 0;
    out.push({
      tone: ratio >= 0.7 ? "good" : ratio < 0.4 ? "bad" : "neutral",
      text: `Worked ${sum.activeDays} of ${range.elapsedDays} day${range.elapsedDays === 1 ? "" : "s"}${
        idle > 0 ? ` — ${idle} blank` : " — no blank days"
      }. That's ${fmtMin(sum.min / Math.max(1, sum.activeDays))} per working day, ${fmtMin(
        sum.min / Math.max(1, range.elapsedDays)
      )} per calendar day.`,
    });
  }

  if (sum.focusSessions === 0) {
    out.push({
      tone: "bad",
      text: `No focus sessions — all ${fmtMin(sum.min)} was unstructured clock time. Commit to one Focus 50′ block next.`,
    });
  } else {
    out.push({
      tone: sum.focusShare >= 0.5 ? "good" : sum.focusShare < 0.2 ? "bad" : "neutral",
      text: `${pct(sum.focusShare)} of your time was deep focus: ${fmtMin(sum.focusMin)} across ${sum.focusSessions} completed session${
        sum.focusSessions === 1 ? "" : "s"
      }.`,
    });
  }
  if (sum.abortedSessions > 0) {
    const total = sum.focusSessions + sum.abortedSessions;
    out.push({
      tone: "bad",
      text: `You bailed on ${sum.abortedSessions} of ${total} focus session${total === 1 ? "" : "s"} (${fmtMin(sum.abortMin)} paid at half rate).`,
    });
  }

  if (sum.sessions >= 3 && sum.avgSession < 25) {
    out.push({
      tone: "bad",
      text: `Your average block is only ${fmtMin(sum.avgSession)} — fragmented. Deep work usually needs 50+ unbroken minutes.`,
    });
  } else if (sum.avgSession >= 50) {
    out.push({ tone: "good", text: `Average block of ${fmtMin(sum.avgSession)} — long, unbroken stretches.` });
  }
  if (sum.sessions >= 2 && sum.pauses / sum.sessions >= 1) {
    out.push({ tone: "bad", text: `You paused ${(sum.pauses / sum.sessions).toFixed(1)}× per block on average.` });
  }

  if (sum.uMin > 0) {
    const share = sum.uMin / sum.min;
    out.push({
      tone: share >= 0.2 ? "bad" : "neutral",
      text: `${fmtMin(sum.uMin)} (${pct(share)}) has no evidence link — time you can't prove shipped anything.`,
    });
  }

  if (range.kind !== "day" && sum.activeDays > 1 && sum.bestDay) {
    out.push({ tone: "neutral", text: `Best day: ${fmtDay(sum.bestDay.key)} with ${fmtMin(sum.bestDay.min)}.` });
  }

  if (sum.knownStartMin >= 60 && range.kind !== "day") {
    const pk = peakWindow(sum);
    if (pk.min > 0) {
      out.push({
        tone: "neutral",
        text: `Your peak window is ${hhmm(pk.start * 60)}–${hhmm((pk.start + 3) * 60)}: ${pct(pk.min / sum.knownStartMin)} of your timed work lands there.`,
      });
    }
  }

  if (sum.ratingCount >= 2) {
    const avg = sum.ratingSum / sum.ratingCount;
    out.push({
      tone: avg >= 7 ? "good" : avg < 5 ? "bad" : "neutral",
      text: `You rated your sessions ${avg.toFixed(1)}/10 on average (${sum.ratingCount} rated).`,
    });
  }
  return out;
}

/* ---------- all-time records (verified time only, so they can't be padded) ---------- */

export function records(entries, now = new Date()) {
  const dayTotals = {};
  let totalMin = 0;
  let totalFocus = 0;
  let longestSession = null;
  entries.forEach((e) => {
    if (!isValidKey(e.date)) return;
    totalMin += e.minutes || 0;
    if (isFocus(e)) totalFocus += e.minutes || 0;
    if (!longestSession || e.minutes > longestSession.minutes) longestSession = e;
    if (isVerified(e)) dayTotals[e.date] = (dayTotals[e.date] || 0) + e.minutes;
  });
  const best = (obj) => Object.entries(obj).reduce((b, [k, m]) => (m > b.min ? { key: k, min: m } : b), { key: null, min: 0 });
  const weekTotals = {};
  const monthTotals = {};
  Object.entries(dayTotals).forEach(([k, m]) => {
    const d = parseKey(k);
    const ws = dayKey(addDays(d, -d.getDay()));
    weekTotals[ws] = (weekTotals[ws] || 0) + m;
    monthTotals[k.slice(0, 7) + "-01"] = (monthTotals[k.slice(0, 7) + "-01"] || 0) + m;
  });

  const tKey = dayKey(now);
  let streak = 0;
  let cursor = dayTotals[tKey] ? tKey : shiftKey(tKey, -1);
  while (dayTotals[cursor]) {
    streak++;
    cursor = shiftKey(cursor, -1);
  }
  let longestStreak = 0;
  let run = 0;
  let prev = null;
  Object.keys(dayTotals)
    .sort()
    .forEach((k) => {
      run = prev && daysBetween(prev, k) === 1 ? run + 1 : 1;
      longestStreak = Math.max(longestStreak, run);
      prev = k;
    });

  const bestDay = best(dayTotals);
  const bestWeek = best(weekTotals);
  const thisWeekKey = dayKey(addDays(now, -now.getDay()));
  return {
    bestDay,
    bestWeek,
    bestMonth: best(monthTotals),
    streak,
    longestStreak,
    longestSession,
    totalMin,
    totalFocus,
    today: dayTotals[tKey] || 0,
    dayRecordIsToday: bestDay.key === tKey && bestDay.min > 0,
    weekRecordIsNow: bestWeek.key === thisWeekKey && bestWeek.min > 0,
  };
}
