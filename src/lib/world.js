/* Pixel earth: 5° grid, 72 x 33 (85N..-80S). */

export const COLS = 72;
export const ROWS = 33;
export const PLOT_PRICE_MIN = 120; // 120 rate-minutes = €50 at €25/h

const inBox = (lat, lon, a, b, c, d) => lat >= a && lat <= b && lon >= c && lon <= d;

const isLand = (lat, lon) => {
  // North America
  if (inBox(lat, lon, 55, 71, -166, -140)) return true; // Alaska
  if (inBox(lat, lon, 50, 70, -130, -60)) return true; // Canada
  if (inBox(lat, lon, 30, 50, -124, -70)) return true; // USA
  if (inBox(lat, lon, 15, 30, -115, -86)) return true; // Mexico
  if (inBox(lat, lon, 8, 15, -92, -77)) return true; // Central America
  if (inBox(lat, lon, 60, 82, -52, -22)) return true; // Greenland
  // South America
  if (inBox(lat, lon, 0, 11, -80, -50)) return true;
  if (inBox(lat, lon, -20, 0, -79, -35)) return true;
  if (inBox(lat, lon, -35, -20, -72, -40)) return true;
  if (inBox(lat, lon, -55, -35, -74, -62)) return true;
  // Africa
  if (inBox(lat, lon, 20, 36, -14, 34)) return true;
  if (inBox(lat, lon, 5, 20, -17, 50)) return true;
  if (inBox(lat, lon, -10, 5, 8, 43)) return true;
  if (inBox(lat, lon, -35, -10, 12, 40)) return true;
  if (inBox(lat, lon, -25, -12, 43, 50)) return true; // Madagascar
  // Europe
  if (inBox(lat, lon, 44, 60, -9, 40)) return true;
  if (inBox(lat, lon, 36, 44, -9, 28)) return true; // Iberia + Med
  if (inBox(lat, lon, 58, 70, 5, 30)) return true; // Scandinavia
  if (inBox(lat, lon, 50, 59, -10, 1)) return true; // UK + Ireland
  // Asia
  if (inBox(lat, lon, 50, 76, 40, 179)) return true; // Russia
  if (inBox(lat, lon, 35, 50, 40, 135)) return true; // Central Asia + China
  if (inBox(lat, lon, 20, 35, 60, 122)) return true; // India + S China
  if (inBox(lat, lon, 8, 20, 73, 79)) return true; // S India
  if (inBox(lat, lon, 8, 20, 95, 109)) return true; // SE Asia
  if (inBox(lat, lon, 15, 32, 34, 59)) return true; // Arabia
  if (inBox(lat, lon, -9, 6, 95, 141)) return true; // Indonesia + PNG
  if (inBox(lat, lon, 31, 44, 129, 143)) return true; // Japan
  // Oceania
  if (inBox(lat, lon, -38, -12, 113, 154)) return true; // Australia
  if (inBox(lat, lon, -46, -34, 166, 178)) return true; // NZ
  return false;
};

const regionOf = (lat, lon) => {
  if (inBox(lat, lon, -34, 5, -74, -35)) return "Brazil";
  if (inBox(lat, lon, 50, 54, 3, 8)) return "Netherlands";
  if (inBox(lat, lon, 36, 44, -9, 4)) return "Spain";
  if (lon < -30 && lat > 13) return "North America";
  if (lon < -30) return "South America";
  if (lat > 36 && lon < 45) return "Europe";
  if (lat > 12 && lon < 34 && lon >= -17) return "Africa";
  if (lon >= -17 && lon < 52 && lat <= 36) return "Africa";
  if (lat < -10 && lon > 110) return "Oceania";
  return "Asia";
};

export const CELLS = (() => {
  const out = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const lat = 85 - r * 5 - 2.5;
      const lon = -180 + c * 5 + 2.5;
      if (isLand(lat, lon)) out.push({ i: r * COLS + c, r, c, region: regionOf(lat, lon) });
    }
  }
  return out;
})();

export const CELL_BY_INDEX = new Map(CELLS.map((x) => [x.i, x]));
export const REGION_TOTALS = CELLS.reduce((a, x) => ((a[x.region] = (a[x.region] || 0) + 1), a), {});
