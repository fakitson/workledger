/* Local-time date helpers. Days are keyed "YYYY-MM-DD"; weeks start on Sunday. */

export const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

// Noon avoids DST edges when stepping whole days.
export const parseKey = (k) => new Date(k + "T12:00:00");

export const isValidKey = (k) => typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k) && !Number.isNaN(parseKey(k).getTime());

export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const shiftKey = (k, n) => dayKey(addDays(parseKey(k), n));

export const todayKey = () => dayKey(new Date());

export const weekStartKey = (k) => {
  const d = parseKey(k);
  return dayKey(addDays(d, -d.getDay()));
};

export const daysBetween = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 86400000);

export const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

export const fmtDay = (key) => parseKey(key).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

export const fmtDayLong = (key) =>
  parseKey(key).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export const fmtMonth = (key) => parseKey(key).toLocaleDateString(undefined, { month: "long", year: "numeric" });

export const fmtMonthShort = (key) => parseKey(key).toLocaleDateString(undefined, { month: "short" });

export const hrs = (m) => (m / 60).toFixed(m % 60 === 0 ? 0 : 1);

export const fmtMin = (m) => {
  const t = Math.round(m); // round total first so 119.5 -> "2h 00m", never "1h 60m"
  return `${Math.floor(t / 60)}h ${String(t % 60).padStart(2, "0")}m`;
};

export const clockFmt = (sec) =>
  `${String(Math.floor(sec / 3600)).padStart(2, "0")}:${String(Math.floor((sec % 3600) / 60)).padStart(2, "0")}:${String(
    Math.floor(sec % 60)
  ).padStart(2, "0")}`;

export const hhmm = (minuteOfDay) => {
  const m = ((Math.round(minuteOfDay) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

export const hhmmOf = (ms) => {
  const d = new Date(ms);
  return hhmm(d.getHours() * 60 + d.getMinutes());
};

// Minute of day an entry started, or null when unknown. Older entries only
// carry a locale-formatted "started" string ("09:30", "9:30 PM", "—").
export const startMinuteOf = (e) => {
  if (typeof e.startedAt === "number" && Number.isFinite(e.startedAt)) {
    const d = new Date(e.startedAt);
    return d.getHours() * 60 + d.getMinutes();
  }
  const m = /(\d{1,2}):(\d{2})\s*([AaPp])?/.exec(e.started || "");
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  if (m[3]) h = (h % 12) + (/p/i.test(m[3]) ? 12 : 0);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
};

export const uid = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};
