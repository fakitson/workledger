// Storage backend for the work ledger.
//
// State shape: { entries: [], settings: {}, running: {}|null, lastProject: "", world: [] }
//
// localStorage is the synchronous write-through cache — every save lands there
// immediately, so a refresh or closed tab never loses data. When Supabase is
// configured, the same state mirrors to the `ledger` table (one row per user,
// RLS-scoped) on a short debounce, flushed when the tab is hidden or closed.
// On load, whichever copy has the newest savedAt wins.
//
// The ledger table columns are (user_id, entries jsonb, settings jsonb,
// world int[]). Runtime state (running timer, lastProject, savedAt) travels
// inside the settings jsonb under "_runtime" and is split back out on load.

import { supabase } from "./supabaseClient";

const KEY = "worklog:v1";
const SYNC_DEBOUNCE_MS = 800;

function readLocal() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLocal(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error("local save failed", e);
  }
}

/* ---------- supabase auth: anonymous session, persisted per device ---------- */

let userIdPromise = null;

function ensureUserId() {
  if (!supabase) return Promise.resolve(null);
  if (!userIdPromise) {
    userIdPromise = (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user) return sessionData.session.user.id;
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        console.error("anonymous sign-in failed (enable it in Supabase auth settings)", error);
        return null;
      }
      return data.user?.id ?? null;
    })().catch((e) => {
      console.error("supabase auth failed", e);
      return null;
    });
  }
  return userIdPromise;
}

/* ---------- row <-> state mapping ---------- */

function rowToState(row) {
  const settings = row.settings || {};
  const { _runtime, ...userSettings } = settings;
  return {
    entries: row.entries || [],
    settings: userSettings,
    running: _runtime?.running ?? null,
    lastProject: _runtime?.lastProject ?? "",
    world: row.world || [],
    savedAt: _runtime?.savedAt ?? 0,
  };
}

function stateToRow(state, userId) {
  return {
    user_id: userId,
    entries: state.entries || [],
    settings: {
      ...(state.settings || {}),
      _runtime: {
        running: state.running ?? null,
        lastProject: state.lastProject ?? "",
        savedAt: state.savedAt ?? Date.now(),
      },
    },
    world: state.world || [],
  };
}

/* ---------- remote sync (debounced) ---------- */

let pendingState = null;
let syncTimer = null;

async function pushRemote(state) {
  const userId = await ensureUserId();
  if (!userId) return;
  const { error } = await supabase.from("ledger").upsert(stateToRow(state, userId), { onConflict: "user_id" });
  if (error) console.error("supabase save failed", error);
}

function flushRemote() {
  if (!pendingState) return;
  const state = pendingState;
  pendingState = null;
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
  pushRemote(state);
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushRemote();
  });
  window.addEventListener("pagehide", flushRemote);
}

/* ---------- public api ---------- */

export async function loadState() {
  const local = readLocal();
  if (!supabase) return local;

  try {
    const userId = await ensureUserId();
    if (!userId) return local;
    const { data, error } = await supabase
      .from("ledger")
      .select("entries, settings, world")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return local;
    const remote = rowToState(data);
    if (!local) return remote;
    return (remote.savedAt || 0) > (local.savedAt || 0) ? remote : local;
  } catch (e) {
    console.error("supabase load failed", e);
    return local;
  }
}

export async function saveState(state) {
  const stamped = { ...state, savedAt: Date.now() };
  writeLocal(stamped);
  if (!supabase) return;
  pendingState = stamped;
  if (!syncTimer) {
    syncTimer = setTimeout(() => {
      syncTimer = null;
      flushRemote();
    }, SYNC_DEBOUNCE_MS);
  }
}
