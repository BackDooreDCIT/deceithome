import * as settings from './settings.js';
import { deepGet, debounce } from './dom.js';
import { isHttpUrl } from './url.js';
import { THEME_PRESETS } from './presets.js';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

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

function syncThemePreset(preset) {
  $all('[data-theme-preset]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themePreset === preset)));
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
}

function onControlInput(e) {
  const el = e.target;
  if (!el.matches('[data-pref]')) return;
  if (el.id === 'bg-url') return; // handled separately, with a load-check before committing
  const path = el.dataset.pref;
  settings.setPref(path, coerceValue(el));
  if (el.type === 'range') updateOutput(el);
  if (path.startsWith('theme.') && path !== 'theme.preset') {
    settings.setPref('theme.preset', 'custom');
    syncThemePreset('custom');
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

export function init() {
  panelEl = document.getElementById('settings-panel');
  gearEl = document.getElementById('panel-gear');
  scrimEl = document.getElementById('panel-scrim');
  if (!panelEl || !gearEl || !scrimEl) return;

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
