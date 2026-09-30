export const C = {
  paper: "#E6ECE2",
  paperDeep: "#DBE3D6",
  card: "#EFF3EC",
  rule: "#A9BCA6",
  ruleFaint: "#C4D2C0",
  ink: "#18241F",
  inkSoft: "#5E6F65",
  stamp: "#2B4A7A",
  red: "#A62B21",
  gold: "#8A6D1F",
  shadow: "#6E7F74",
  ocean: "#C9D8DC",
  soil: "#CBB98F",
  forest: "#2F6B33",
  fill: ["#DBE3D6", "#B6CBA9", "#87AD79", "#54844B", "#2A5A2E"],
};

export const MONO = "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace";
export const DISP = "'Oswald', 'Arial Narrow', Impact, sans-serif";

export const label = { fontFamily: DISP, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: C.inkSoft };

export const input = {
  fontFamily: MONO,
  fontSize: 13,
  background: "transparent",
  border: "none",
  borderBottom: `1px solid ${C.rule}`,
  color: C.ink,
  padding: "6px 2px",
  width: "100%",
  outline: "none",
};

export const btn = (bg, fg) => ({
  fontFamily: DISP,
  fontSize: 12,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  background: bg,
  color: fg,
  border: "none",
  padding: "10px 18px",
  cursor: "pointer",
});

export const ghostBtn = (fg = C.stamp, border = C.rule) => ({ ...btn("transparent", fg), border: `1px solid ${border}` });

export const linkBtn = { ...label, background: "none", border: "none", cursor: "pointer", color: C.stamp, padding: 0 };

export const h2 = { fontFamily: DISP, fontSize: 18, fontWeight: 600, letterSpacing: "0.1em" };

export const big = { fontFamily: DISP, fontSize: 20, fontWeight: 600 };

export const note = { fontSize: 11, color: C.inkSoft };

export const section = { padding: "22px 20px 8px" };

export const card = { border: `1.5px solid ${C.ink}`, background: C.card, padding: "14px 16px" };

export const toneColor = (tone) => (tone === "good" ? C.forest : tone === "bad" ? C.red : C.stamp);
