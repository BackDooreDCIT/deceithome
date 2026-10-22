import * as settings from './settings.js';
import { deepGet, debounce } from './dom.js';
import { isHttpUrl } from './url.js';
import { THEME_PRESETS } from './presets.js';
import * as perms from './permissions.js';
import { ENGINES } from './engines.js';
import { zoneList } from './time.js';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

const PERM_CHECKBOXES = {
  'suggest-use-history': { permission: 'history', path: 'search.suggest.useHistory' },
  'suggest-use-bookmarks': { permission: 'bookmarks', path: 'search.suggest.useBookmarks' },
  'suggest-use-topsites': { permission: 'topSites', path: 'search.suggest.useTopSites' }
};

let panelEl = null;
let gearEl = null;
let scrimEl = null;
let lastFocused = null;

function $all(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

function coerceValue(el) {
  if (el.type === 'checkbox') return el.checked;
  if (el.type === 'range' || el.type === 'number') return Number(el.value);
  return el.value;
}

function setControlValue(el, value) {
  if (el.type === 'checkbox') {
    el.checked = !!value;
    return;
  }
  if (document.activeElement === el) return; // don't yank the cursor mid-edit
  el.value = value;
}

function updateOutput(inputEl) {
  const out = document.querySelector(`[data-output-for="${inputEl.id}"]`);
  if (!out) return;
  const suffix = out.dataset.outputSuffix || '';
  out.textContent = `${inputEl.value}${suffix}`;
}

function syncBgKindVisibility(kind) {
  $all('[data-bg-kind]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.bgKind === kind)));
  $all('[data-kind-pane]').forEach((p) => p.classList.toggle('is-active', p.dataset.kindPane === kind));
}

function syncLayoutAlign(align) {
  $all('[data-layout-align]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.layoutAlign === align)));
}

function syncSidebarOpenOn(openOn) {
  $all('[data-sidebar-open-on]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sidebarOpenOn === openOn)));
}

function syncClockFace(face) {
  $all('[data-clock-face]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.clockFace === face)));
}

function syncThemePreset(preset) {
  $all('[data-theme-preset]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themePreset === preset)));
}

function syncSearchEngineVisibility(engine) {
  $all('[data-engine-pane]').forEach((p) => p.classList.toggle('is-active', engine === 'custom'));
}

function validateSearchTemplate(tpl) {
  if (!tpl) return '';
  if (!tpl.includes('%s')) return 'Must contain %s where the query goes.';
  try {
    if (new URL(tpl.replace('%s', 'x')).protocol !== 'https:') return 'Must use https://.';
  } catch {
    return 'Enter a valid URL.';
  }
  return '';
}

function showPermNote(msg) {
  const el = document.getElementById('suggest-perm-note');
  if (el) el.textContent = msg;
}

async function refreshPermCheckboxes(prefs) {
  for (const [id, cfg] of Object.entries(PERM_CHECKBOXES)) {
    const el = document.getElementById(id);
    if (!el || document.activeElement === el) continue;
    const granted = await perms.has(cfg.permission);
    el.checked = granted && !!deepGet(prefs, cfg.path);
  }
  const remoteEl = document.getElementById('suggest-remote');
  if (remoteEl && document.activeElement !== remoteEl) {
    remoteEl.checked = !!prefs.search.suggest.remote;
  }
}

async function onPermCheckbox(el) {
  const cfg = PERM_CHECKBOXES[el.id];
  if (cfg) {
    if (el.checked) {
      const granted = await perms.request([cfg.permission]);
      el.checked = granted;
      settings.setPref(cfg.path, granted);
      if (!granted) showPermNote(`Permission wasn't granted; that source stays off.`);
      else showPermNote('');
    } else {
      await perms.revoke([cfg.permission]);
      settings.setPref(cfg.path, false);
    }
    return true;
  }
  if (el.id === 'suggest-remote') {
    if (el.checked) {
      const { prefs } = settings.get();
      const origin = ENGINES[prefs.search.engine]?.origin;
      const granted = origin ? await perms.request([], [origin]) : true;
      el.checked = granted;
      settings.setPref('search.suggest.remote', granted);
      if (!granted) showPermNote(`Access wasn't granted; remote completions stay off.`);
      else showPermNote('');
    } else {
      settings.setPref('search.suggest.remote', false);
    }
    return true;
  }
  return false;
}

function refreshFromState(state) {
  $all('[data-pref]', panelEl).forEach((el) => {
    const value = deepGet(state.prefs, el.dataset.pref);
    if (value === undefined) return;
    setControlValue(el, value);
    if (el.type === 'range') updateOutput(el);
  });
  syncBgKindVisibility(state.prefs.background.kind);
  syncLayoutAlign(state.prefs.layout.align);
  syncThemePreset(state.prefs.theme.preset);
  syncClockFace(state.prefs.clock.face);
  syncSearchEngineVisibility(state.prefs.search.engine);
  syncSidebarOpenOn(state.prefs.sidebar.openOn);
  refreshPermCheckboxes(state.prefs);
}

function onControlInput(e) {
  const el = e.target;
  if (!el.matches('[data-pref]')) return;
  if (el.id === 'bg-url') return; // handled separately, with a load-check before committing
  const path = el.dataset.pref;
  const value = coerceValue(el);
  settings.setPref(path, value);
  if (el.type === 'range') updateOutput(el);
  if (path.startsWith('theme.') && path !== 'theme.preset') {
    settings.setPref('theme.preset', 'custom');
    syncThemePreset('custom');
  }
  if (path === 'search.engine') syncSearchEngineVisibility(value);
  if (el.id === 'search-custom-search-url' || el.id === 'search-custom-suggest-url') {
    const errorEl = document.getElementById(`${el.id}-error`);
    if (errorEl) errorEl.textContent = validateSearchTemplate(value.trim());
  }
}

let urlCheckToken = 0;
function checkBgUrl(raw) {
  const errorEl = document.getElementById('bg-url-error');
  const myToken = ++urlCheckToken;
  if (!raw) {
    if (errorEl) errorEl.textContent = '';
    return;
  }
  if (!isHttpUrl(raw)) {
    if (errorEl) errorEl.textContent = 'Enter a valid http(s) URL.';
    return;
  }
  const probe = new Image();
  probe.onload = () => {
    if (myToken !== urlCheckToken) return;
    if (errorEl) errorEl.textContent = '';
    settings.setPref('background.url', raw);
  };
  probe.onerror = () => {
    if (myToken !== urlCheckToken) return;
    if (errorEl) errorEl.textContent = "That image couldn't be loaded.";
  };
  probe.src = raw;
}
const debouncedCheckBgUrl = debounce((raw) => checkBgUrl(raw), 400);

async function handleBgUpload(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const maxEdge = 2560;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.82 });
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    settings.setLocal({ bgImage: dataUrl, bgImageMeta: { width: w, height: h, size: blob.size } });
    settings.setPref('background.kind', 'image');
    syncBgKindVisibility('image');
  } catch {
    alert("That image couldn't be loaded.");
  }
}

function exportSettings() {
  const blob = new Blob([settings.exportJson()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'deceithome-settings.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function handleImportFile(file) {
  try {
    const text = await file.text();
    await settings.importJson(text);
    refreshFromState(settings.get());
  } catch {
    alert('That file could not be imported.');
  }
}

function onPanelChange(e) {
  const el = e.target;
  if (el.id in PERM_CHECKBOXES || el.id === 'suggest-remote') {
    onPermCheckbox(el);
    return;
  }
  if (el.matches('[data-act="bg-upload"]')) {
    const file = el.files[0];
    el.value = '';
    if (file) handleBgUpload(file);
    return;
  }
  if (el.matches('[data-act="import-file"]')) {
    const file = el.files[0];
    el.value = '';
    if (file) handleImportFile(file);
    return;
  }
  if (el.id === 'bg-url') {
    debouncedCheckBgUrl(el.value.trim());
    return;
  }
  onControlInput(e);
}

function switchTab(id) {
  $all('.panel-tab', panelEl).forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === id)));
  $all('.panel-pane', panelEl).forEach((p) => { p.hidden = p.dataset.pane !== id; });
}

function onPanelClick(e) {
  const tab = e.target.closest('[data-tab]');
  if (tab) { switchTab(tab.dataset.tab); return; }

  const bgKind = e.target.closest('[data-bg-kind]');
  if (bgKind) {
    settings.setPref('background.kind', bgKind.dataset.bgKind);
    syncBgKindVisibility(bgKind.dataset.bgKind);
    return;
  }

  const align = e.target.closest('[data-layout-align]');
  if (align) {
    settings.setPref('layout.align', align.dataset.layoutAlign);
    syncLayoutAlign(align.dataset.layoutAlign);
    return;
  }

  const sidebarOpenOn = e.target.closest('[data-sidebar-open-on]');
  if (sidebarOpenOn) {
    settings.setPref('sidebar.openOn', sidebarOpenOn.dataset.sidebarOpenOn);
    syncSidebarOpenOn(sidebarOpenOn.dataset.sidebarOpenOn);
    return;
  }

  const clockFace = e.target.closest('[data-clock-face]');
  if (clockFace) {
    settings.setPref('clock.face', clockFace.dataset.clockFace);
    syncClockFace(clockFace.dataset.clockFace);
    return;
  }

  const preset = e.target.closest('[data-theme-preset]');
  if (preset) {
    const key = preset.dataset.themePreset;
    const colors = THEME_PRESETS[key];
    if (colors) {
      settings.patchPrefs({ theme: { ...colors, preset: key } });
      refreshFromState(settings.get());
    }
    return;
  }

  const act = e.target.closest('[data-act]');
  if (!act) return;
  switch (act.dataset.act) {
    case 'close':
      closePanel();
      break;
    case 'bg-default':
      settings.setPref('background.kind', 'default');
      syncBgKindVisibility('default');
      break;
    case 'reset-all':
      if (confirm('Reset all settings to defaults? This cannot be undone.')) {
        settings.resetAll().then(() => refreshFromState(settings.get()));
      }
      break;
    case 'export':
      exportSettings();
      break;
    case 'import-trigger':
      document.getElementById('import-file')?.click();
      break;
  }
}

function trapFocus(e) {
  const focusables = $all(FOCUSABLE, panelEl).filter((el) => !el.disabled && el.offsetParent !== null);
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function onPanelKeydown(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    closePanel();
    return;
  }
  if (e.key === 'Tab') trapFocus(e);
}

function openPanel() {
  if (!panelEl.hidden) return;
  lastFocused = document.activeElement;
  refreshFromState(settings.get());
  panelEl.hidden = false;
  document.documentElement.classList.add('panel-open');
  gearEl.setAttribute('aria-expanded', 'true');
  const firstTab = panelEl.querySelector('.panel-tab');
  if (firstTab) firstTab.focus();
  document.addEventListener('keydown', onPanelKeydown, true);
}

function closePanel() {
  if (panelEl.hidden) return;
  panelEl.hidden = true;
  document.documentElement.classList.remove('panel-open');
  gearEl.setAttribute('aria-expanded', 'false');
  document.removeEventListener('keydown', onPanelKeydown, true);
  (lastFocused || gearEl).focus({ preventScroll: true });
}

function populateTimezones() {
  const list = document.getElementById('tz-list');
  if (!list) return;
  const frag = document.createDocumentFragment();
  for (const zone of zoneList()) {
    const opt = document.createElement('option');
    opt.value = zone;
    frag.appendChild(opt);
  }
  list.appendChild(frag);
}

export function init() {
  panelEl = document.getElementById('settings-panel');
  gearEl = document.getElementById('panel-gear');
  scrimEl = document.getElementById('panel-scrim');
  if (!panelEl || !gearEl || !scrimEl) return;

  populateTimezones();

  panelEl.addEventListener('input', onControlInput);
  panelEl.addEventListener('change', onPanelChange);
  panelEl.addEventListener('click', onPanelClick);
  gearEl.addEventListener('click', () => (panelEl.hidden ? openPanel() : closePanel()));
  scrimEl.addEventListener('click', closePanel);

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === ',') {
      e.preventDefault();
      panelEl.hidden ? openPanel() : closePanel();
    }
  });

  settings.subscribe((state) => {
    if (!panelEl.hidden) refreshFromState(state);
  });
}
