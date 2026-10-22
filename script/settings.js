import { clamp, deepGet, deepSet, deepMerge, debounce } from './dom.js';

export const SCHEMA_VERSION = 1;

export const DEFAULT_PREFS = {
  schemaVersion: 1,
  theme: {
    preset: 'midnight',
    bg: '#1a1a1a',
    fg: '#f5f5f5',
    fgStrong: '#ffffff',
    accent: '#ecb7ff',
    shadow: '#000000',
    surfaceOpacity: 0.72,
    radius: 12
  },
  background: {
    kind: 'default',
    url: '',
    color: '#1a1a1a',
    gradient: { from: '#1a1a1a', to: '#2b2b3a', angle: 160 },
    blur: 5,
    dim: 0,
    size: 'cover',
    position: 'center'
  },
  clock: {
    face: 'block',
    hour12: false,
    showSeconds: true,
    showDate: false,
    dateFormat: 'medium',
    scale: 1.35,
    smoothSeconds: true,
    enabled: true,
    timeZone: ''
  },
  greeting: {
    enabled: true,
    name: 'guest',
    message: 'Welcome,',
    timeOfDay: false,
    punctuation: '.',
    size: 60
  },
  search: {
    engine: 'google',
    customSearchUrl: '',
    customSuggestUrl: '',
    openInNewTab: false,
    focusMode: true,
    focusBlur: 6,
    suggest: {
      enabled: true,
      maxLocal: 3,
      maxRemote: 5,
      remote: true,
      useHistory: true,
      useBookmarks: true,
      useTopSites: true
    }
  },
  sidebar: { enabled: true, openOn: 'hover', showLabels: true, iconSize: 32 },
  layout: { padBlock: 110, padInline: 100, align: 'left' }
};

export const DEFAULT_TILES = [];

const ENUM = {
  'background.kind': ['default', 'image', 'url', 'color', 'gradient'],
  'background.size': ['cover', 'contain'],
  'clock.face': ['block', 'analog', 'text'],
  'clock.dateFormat': ['short', 'medium', 'long'],
  'search.engine': ['google', 'duckduckgo', 'bing', 'custom'],
  'sidebar.openOn': ['hover', 'click'],
  'layout.align': ['left', 'center'],
  'theme.preset': ['midnight', 'paper', 'nord', 'rose', 'custom']
};

function deepDefaults(target, defaults) {
  for (const [k, v] of Object.entries(defaults)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if (typeof target[k] !== 'object' || target[k] === null || Array.isArray(target[k])) target[k] = {};
      deepDefaults(target[k], v);
    } else if (!(k in target) || target[k] === undefined) {
      target[k] = v;
    }
  }
  return target;
}

function checkEnum(path, value, fallback) {
  const allowed = ENUM[path];
  return allowed && !allowed.includes(value) ? fallback : value;
}

function sanitize(prefs) {
  const p = prefs;
  if (p.background) {
    p.background.kind = checkEnum('background.kind', p.background.kind, DEFAULT_PREFS.background.kind);
    p.background.size = checkEnum('background.size', p.background.size, DEFAULT_PREFS.background.size);
    if (typeof p.background.blur === 'number') p.background.blur = clamp(p.background.blur, 0, 24);
    if (typeof p.background.dim === 'number') p.background.dim = clamp(p.background.dim, 0, 100);
  }
  if (p.clock) {
    p.clock.face = checkEnum('clock.face', p.clock.face, DEFAULT_PREFS.clock.face);
    p.clock.dateFormat = checkEnum('clock.dateFormat', p.clock.dateFormat, DEFAULT_PREFS.clock.dateFormat);
    if (typeof p.clock.scale === 'number') p.clock.scale = clamp(p.clock.scale, 0.6, 3);
  }
  if (p.search) {
    p.search.engine = checkEnum('search.engine', p.search.engine, DEFAULT_PREFS.search.engine);
    if (typeof p.search.focusBlur === 'number') p.search.focusBlur = clamp(p.search.focusBlur, 0, 24);
  }
  if (p.sidebar) {
    p.sidebar.openOn = checkEnum('sidebar.openOn', p.sidebar.openOn, DEFAULT_PREFS.sidebar.openOn);
  }
  if (p.layout) {
    p.layout.align = checkEnum('layout.align', p.layout.align, DEFAULT_PREFS.layout.align);
  }
  if (p.theme) {
    p.theme.preset = checkEnum('theme.preset', p.theme.preset, DEFAULT_PREFS.theme.preset);
    if (typeof p.theme.surfaceOpacity === 'number') p.theme.surfaceOpacity = clamp(p.theme.surfaceOpacity, 0, 1);
  }
  return p;
}

function migrate(raw) {
  let p = raw && typeof raw === 'object' ? raw : {};
  switch (p.schemaVersion) {
    case undefined:
    case SCHEMA_VERSION:
      break;
    default:
      p = {};
  }
  p.schemaVersion = SCHEMA_VERSION;
  return deepDefaults(sanitize(p), DEFAULT_PREFS);
}

const state = {
  prefs: structuredClone(DEFAULT_PREFS),
  tiles: structuredClone(DEFAULT_TILES),
  local: { bgImage: null, bgImageMeta: null, topSitesCache: null }
};

const subscribers = new Set();

function notify(changedPaths) {
  const snapshot = get();
  for (const fn of subscribers) {
    try { fn(snapshot, changedPaths); } catch { /* a bad subscriber must not break the others */ }
  }
}

async function persistPrefs() {
  try {
    await chrome.storage.sync.set({ prefs: state.prefs });
  } catch {
    try { await chrome.storage.local.set({ prefs: state.prefs, __syncFailed: true }); } catch { /* nothing left to try */ }
  }
}

async function persistTiles() {
  try {
    await chrome.storage.sync.set({ tiles: state.tiles });
  } catch {
    try { await chrome.storage.local.set({ tiles: state.tiles, __syncFailed: true }); } catch { /* nothing left to try */ }
  }
}

async function persistLocal() {
  try {
    await chrome.storage.local.set(state.local);
  } catch { /* local quota exceeded — nothing more to do */ }
}

const schedulePersistPrefs = debounce(persistPrefs, 400);
const schedulePersistTiles = debounce(persistTiles, 400);
const schedulePersistLocal = debounce(persistLocal, 400);

function wireCrossTabSync() {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.prefs) {
      state.prefs = migrate(changes.prefs.newValue);
      notify(['*']);
    }
    if (area === 'sync' && changes.tiles) {
      state.tiles = Array.isArray(changes.tiles.newValue) ? changes.tiles.newValue : structuredClone(DEFAULT_TILES);
      notify(['tiles']);
    }
    if (area === 'local' && changes.bgImage) {
      state.local.bgImage = changes.bgImage.newValue ?? null;
      notify(['local.bgImage']);
    }
  });
}

export async function init() {
  let rawPrefs;
  let rawTiles;
  try {
    const synced = await chrome.storage.sync.get(['prefs', 'tiles']);
    rawPrefs = synced.prefs;
    rawTiles = synced.tiles;
    if (rawPrefs === undefined) {
      const local = await chrome.storage.local.get(['prefs', 'tiles', '__syncFailed']);
      if (local.__syncFailed) {
        rawPrefs = local.prefs;
        rawTiles = local.tiles;
      }
    }
  } catch {
    try {
      const local = await chrome.storage.local.get(['prefs', 'tiles']);
      rawPrefs = local.prefs;
      rawTiles = local.tiles;
    } catch { /* fall through to defaults */ }
  }

  const isFirstRun = rawPrefs === undefined;
  state.prefs = migrate(rawPrefs);
  state.tiles = Array.isArray(rawTiles) ? rawTiles : structuredClone(DEFAULT_TILES);

  try {
    const local = await chrome.storage.local.get(['bgImage', 'bgImageMeta', 'topSitesCache']);
    state.local.bgImage = local.bgImage ?? null;
    state.local.bgImageMeta = local.bgImageMeta ?? null;
    state.local.topSitesCache = local.topSitesCache ?? null;
  } catch { /* keep in-memory defaults */ }

  if (isFirstRun) {
    schedulePersistPrefs.flush();
    schedulePersistTiles.flush();
  }

  wireCrossTabSync();
  return get();
}

export function get() {
  return { prefs: state.prefs, tiles: state.tiles, local: state.local };
}

export function getPref(path, fallback) {
  const v = deepGet(state.prefs, path);
  return v === undefined ? fallback : v;
}

export function setPref(path, value) {
  deepSet(state.prefs, path, value);
  notify([path]);
  schedulePersistPrefs();
}

export function patchPrefs(partial) {
  deepMerge(state.prefs, partial);
  notify(['*']);
  schedulePersistPrefs();
}

export function setTiles(tiles) {
  state.tiles = tiles;
  notify(['tiles']);
  schedulePersistTiles();
}

export function setLocal(partial) {
  Object.assign(state.local, partial);
  notify(Object.keys(partial).map((k) => `local.${k}`));
  schedulePersistLocal();
}

export async function flush() {
  schedulePersistPrefs.cancel();
  schedulePersistTiles.cancel();
  schedulePersistLocal.cancel();
  await Promise.all([persistPrefs(), persistTiles(), persistLocal()]);
}

export async function resetAll() {
  state.prefs = structuredClone(DEFAULT_PREFS);
  state.tiles = structuredClone(DEFAULT_TILES);
  state.local = { bgImage: null, bgImageMeta: null, topSitesCache: null };
  notify(['*']);
  await flush();
}

export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function exportJson() {
  return JSON.stringify({ schemaVersion: SCHEMA_VERSION, prefs: state.prefs, tiles: state.tiles }, null, 2);
}

export async function importJson(text) {
  const data = JSON.parse(text);
  state.prefs = migrate(data.prefs);
  state.tiles = Array.isArray(data.tiles) ? data.tiles : structuredClone(DEFAULT_TILES);
  notify(['*']);
  schedulePersistPrefs();
  schedulePersistTiles();
}
