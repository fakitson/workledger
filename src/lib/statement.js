import { addDays, dayKey, fmtMin, isValidKey, parseKey } from "./dates";
import { isVerified } from "./insights";

/* Bank statement: weeks (Sun–Sat) -> days -> entries, minute-exact, newest week first. */
export function buildBank(entries) {
  const weeks = {};
  entries.forEach((e) => {
    if (!isValidKey(e.date)) return;
    const d = parseKey(e.date);
    const ws = dayKey(addDays(d, -d.getDay()));
    const w = (weeks[ws] = weeks[ws] || { ws, vMin: 0, payMin: 0, uMin: 0, days: {} });
    const day = (w.days[e.date] = w.days[e.date] || { vMin: 0, payMin: 0, uMin: 0, list: [] });
    day.list.push(e);
    if (isVerified(e)) {
      const p = e.minutes * (e.mult || 1);
      w.vMin += e.minutes;
      w.payMin += p;
      day.vMin += e.minutes;
      day.payMin += p;
    } else {
      w.uMin += e.minutes;
      day.uMin += e.minutes;
    }
  });
  return Object.values(weeks).sort((a, b) => b.ws.localeCompare(a.ws));
}

export function statementMarkdown({ bank, settings, stats, sym }) {
  let out = `# WORK STATEMENT${settings.name ? " — " + settings.name : ""}\n\n`;
  out += `Base rate: ${sym}${settings.rate}/hr · Generated ${new Date().toISOString().slice(0, 10)}\n\n`;
  out += `**Verified: ${fmtMin(stats.vMin)}** (hours are actual clock time — focus premiums affect pay only)  \n`;
  out += `Run-rate: ${sym}${((stats.weeklyRun / 60) * settings.rate).toFixed(0)}/wk pace  \n`;
  out += `Unverified (excluded): ${fmtMin(stats.uMin)}\n\n---\n\n`;
  [...bank]
    .sort((a, b) => a.ws.localeCompare(b.ws))
    .forEach((w) => {
      out += `## Week of ${w.ws} — ${fmtMin(w.vMin)} verified (${sym}${((w.payMin / 60) * settings.rate).toFixed(2)})\n\n`;
      Object.keys(w.days)
        .sort()
        .forEach((dk) => {
          const day = w.days[dk];
          out += `**${dk}** — ${fmtMin(day.vMin)} (${sym}${((day.payMin / 60) * settings.rate).toFixed(2)})\n\n`;
          day.list.forEach((e) => {
            out += `- \`${fmtMin(e.minutes)}\` **${e.project}** — ${e.output}${
              isVerified(e) ? ` · [evidence](${e.evidence.trim()})` : " · _unverified_"
            }${typeof e.rating === "number" ? ` · ${e.rating}/10` : ""}\n`;
            if (e.reflection?.trim()) out += `  - _${e.reflection.trim()}_\n`;
          });
          out += "\n";
        });
    });
  return out;
}

export function download(filename, text, type = "text/markdown") {
  const blob = new Blob([text], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
