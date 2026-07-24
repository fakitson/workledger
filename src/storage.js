// Storage backend for the work ledger.
// State shape: { entries: [], settings: {}, running: {}|null, lastProject: "", world: [] }

const KEY = "worklog:v1";

export async function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error("save failed", e);
  }
}
