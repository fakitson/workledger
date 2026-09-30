import React, { useState } from "react";
import { C, h2 } from "../theme";
import { CELL_BY_INDEX, CELLS, COLS, PLOT_PRICE_MIN, REGION_TOTALS, ROWS } from "../lib/world";

export default function WorldPage({ world, setWorld, walletMin, money }) {
  const [msg, setMsg] = useState("");
  const plantedSet = new Set(world);
  const regionPlanted = CELLS.reduce((a, x) => (plantedSet.has(x.i) ? ((a[x.region] = (a[x.region] || 0) + 1), a) : a), {});
  const worldPct = ((world.length / CELLS.length) * 100).toFixed(1);
  const spentMin = world.length * PLOT_PRICE_MIN;

  const plant = (cell) => {
    if (plantedSet.has(cell.i)) return setMsg(`${cell.region}: already forested.`);
    if (walletMin < PLOT_PRICE_MIN) return setMsg(`Not enough in the wallet — a plot costs ${money(PLOT_PRICE_MIN)}. Go earn it.`);
    setWorld((w) => (w.includes(cell.i) ? w : [...w, cell.i]));
    setMsg(`Planted in ${cell.region} — ${money(PLOT_PRICE_MIN)} spent.`);
  };

  return (
    <div style={{ padding: "22px 20px 8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
        <div style={h2}>THE WORLD · {worldPct}% FORESTED</div>
        <div style={{ fontSize: 12, color: C.inkSoft }}>
          plot: <b style={{ color: C.ink }}>{money(PLOT_PRICE_MIN)}</b> · planted {world.length}/{CELLS.length} · spent {money(spentMin)}
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 10 }}>
        Tap a land plot to plant a forest with wallet money ({money(walletMin)} available). Green the whole Earth and Mars unlocks.
        {msg && <span style={{ color: C.stamp }}> {msg}</span>}
      </div>
      <div style={{ overflowX: "auto", paddingBottom: 6 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${COLS}, 9px)`,
            gridAutoRows: "9px",
            gap: 1,
            minWidth: "max-content",
            background: C.ocean,
            padding: 4,
            border: `1.5px solid ${C.ink}`,
          }}
        >
          {Array.from({ length: ROWS * COLS }, (_, i) => {
            const cell = CELL_BY_INDEX.get(i);
            if (!cell) return <div key={i} style={{ background: C.ocean }} />;
            const planted = plantedSet.has(i);
            return (
              <button
                key={i}
                className="plot"
                title={`${cell.region}${planted ? " · forested" : ` · ${money(PLOT_PRICE_MIN)}`}`}
                onClick={() => plant(cell)}
                style={{ background: planted ? C.forest : C.soil, border: "none", padding: 0, cursor: "pointer" }}
              />
            );
          })}
        </div>
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11, color: C.inkSoft, flexWrap: "wrap" }}>
        <span style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <span style={{ width: 11, height: 11, background: C.soil }} /> unclaimed land
        </span>
        <span style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <span style={{ width: 11, height: 11, background: C.forest }} /> your forest
        </span>
        {["Brazil", "Netherlands", "Spain"].map((r) => (
          <span key={r}>
            {r}: {regionPlanted[r] || 0}/{REGION_TOTALS[r] || 0}
          </span>
        ))}
        {world.length === CELLS.length && CELLS.length > 0 && <span style={{ color: C.gold, fontWeight: 600 }}>★ EARTH COMPLETE — MARS AWAITS</span>}
      </div>
    </div>
  );
}
