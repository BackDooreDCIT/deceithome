import * as settings from './settings.js';
import { hashColor, downscaleToDataUrl } from './dom.js';
import { hasScheme, isHttpUrl } from './url.js';
import { AVATAR_PALETTE } from './presets.js';

const ICON_KINDS = ['auto', 'emoji', 'url', 'upload'];

let sidebarEl = null;
let listEl = null;
let formEl = null;
let nameInput = null;
let urlInput = null;
let iconEmojiInput = null;
let iconUrlInput = null;
let iconUploadInput = null;
let handle = null;
let chevronEl = null;

let editingId = null;
let formIcon = { kind: 'auto', value: '' };
let formIconDataUrl = null;
let pinned = false;
let hovering = false;

function hostnameOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function faviconUrl(pageUrl, size = 32) {
  try {
    const u = new URL(chrome.runtime.getURL('/_favicon/'));
    u.searchParams.set('pageUrl', pageUrl);
    u.searchParams.set('size', String(size));
    return u.toString();
  } catch {
    return '';
  }
}

function genId() {
  return `t_${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeIcon(icon) {
  if (!icon || typeof icon !== 'object' || !ICON_KINDS.includes(icon.kind)) return { kind: 'auto', value: '' };
  return { kind: icon.kind, value: typeof icon.value === 'string' ? icon.value : '' };
}

function button(act, label, tileName) {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.act = act;
  b.textContent = label;
  b.setAttribute('aria-label', `${act} ${tileName}`);
  return b;
}

function buildIcon(tile) {
  const icon = sanitizeIcon(tile.icon);
  const wrap = document.createElement('span');
  wrap.className = 'tile-icon';

  if (icon.kind === 'emoji' && icon.value) {
    const span = document.createElement('span');
    span.className = 'tile-emoji';
    span.textContent = icon.value;
    wrap.appendChild(span);
    return wrap;
  }

  const fallback = document.createElement('span');
  fallback.className = 'tile-fallback';
  fallback.textContent = (tile.name || hostnameOf(tile.url) || '?')[0].toUpperCase();
  fallback.style.backgroundColor = tile.color;

  const img = document.createElement('img');
  img.alt = '';
  img.hidden = true;

  let src = '';
  if (icon.kind === 'url' && icon.value) {
    src = icon.value;
  } else if (icon.kind === 'upload' && icon.value) {
    src = settings.get().local.tileIcons?.[icon.value] || '';
  }
  if (!src) src = faviconUrl(tile.url, 32);

  if (src) {
    // The _favicon endpoint (and a broken image URL) can return HTTP 200
    // with a transparent/zero-size image, so onerror alone isn't enough.
    img.addEventListener('load', () => { if (img.naturalWidth > 0) { img.hidden = false; fallback.hidden = true; } }, { once: true });
    fallback.hidden = false;
    img.src = src;
  } else {
    fallback.hidden = false;
  }

  wrap.appendChild(img);
  wrap.appendChild(fallback);
  return wrap;
}

function renderTile(tile) {
  const li = document.createElement('li');
  li.className = 'tile';
  li.dataset.id = tile.id;

  const link = document.createElement('a');
  link.className = 'tile-link';
  link.href = tile.url;
  link.rel = 'noopener';
  link.appendChild(buildIcon(tile));

  const label = document.createElement('span');
  label.className = 'tile-label';
  label.textContent = tile.name;
  link.appendChild(label);

  const actions = document.createElement('span');
  actions.className = 'tile-actions';
  actions.appendChild(button('up', '↑', tile.name));
  actions.appendChild(button('down', '↓', tile.name));
  actions.appendChild(button('edit', '✎', tile.name));
  actions.appendChild(button('del', '✕', tile.name));

  li.appendChild(link);
  li.appendChild(actions);
  return li;
}

function render() {
  const { tiles } = settings.get();
  listEl.replaceChildren();
  sidebarEl.classList.toggle('is-empty', tiles.length === 0);
  if (!tiles.length) {
    const empty = document.createElement('li');
    empty.className = 'tile-empty';
    empty.textContent = 'No shortcuts yet.';
    listEl.appendChild(empty);
    return;
  }
  tiles.forEach((t) => listEl.appendChild(renderTile(t)));
}

function syncIconKindUI(kind) {
  Array.from(formEl.querySelectorAll('[data-tile-icon-kind]')).forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.tileIconKind === kind));
  });
  Array.from(formEl.querySelectorAll('[data-icon-kind-pane]')).forEach((p) => {
    p.classList.toggle('is-active', p.dataset.iconKindPane === kind);
  });
}

function openForm(tile) {
  editingId = tile ? tile.id : null;
  nameInput.value = tile ? tile.name : '';
  urlInput.value = tile ? tile.url : '';
  formIcon = sanitizeIcon(tile ? tile.icon : null);
  formIconDataUrl = null;
  iconEmojiInput.value = formIcon.kind === 'emoji' ? formIcon.value : '';
  iconUrlInput.value = formIcon.kind === 'url' ? formIcon.value : '';
  iconUploadInput.value = '';
  syncIconKindUI(formIcon.kind);
  formEl.hidden = false;
  document.documentElement.classList.add('dialog-open');
  nameInput.focus();
}

function closeForm() {
  formEl.hidden = true;
  editingId = null;
  formIconDataUrl = null;
  document.documentElement.classList.remove('dialog-open');
}

async function handleIconUpload(file) {
  try {
    const { dataUrl } = await downscaleToDataUrl(file, 128);
    formIconDataUrl = dataUrl;
  } catch {
    alert("That image couldn't be loaded.");
  }
}

function resolveIconForSave(id, previousIcon) {
  if (formIcon.kind === 'emoji') return { kind: 'emoji', value: iconEmojiInput.value.trim().slice(0, 4) };
  if (formIcon.kind === 'url') return { kind: 'url', value: iconUrlInput.value.trim() };
  if (formIcon.kind === 'upload') {
    if (formIconDataUrl) {
      const { local } = settings.get();
      settings.setLocal({ tileIcons: { ...local.tileIcons, [id]: formIconDataUrl } });
      return { kind: 'upload', value: id };
    }
    // "Upload" selected but nothing newly chosen — keep whatever was there before.
    if (previousIcon?.kind === 'upload') return previousIcon;
    return { kind: 'auto', value: '' };
  }
  return { kind: 'auto', value: '' };
}

function saveForm() {
  const name = nameInput.value.trim();
  let url = urlInput.value.trim();
  if (!name || !url) return;
  if (!hasScheme(url)) url = 'https://' + url;
  if (!isHttpUrl(url)) return;

  const { tiles } = settings.get();
  const id = editingId || genId();
  const previousTile = editingId ? tiles.find((t) => t.id === editingId) : null;
  const icon = resolveIconForSave(id, previousTile?.icon);

  if (editingId) {
    settings.setTiles(tiles.map((t) => (t.id === editingId ? { ...t, name, url, icon } : t)));
  } else {
    const color = AVATAR_PALETTE[hashColor(hostnameOf(url), AVATAR_PALETTE.length)];
    settings.setTiles([...tiles, { id, name, url, color, icon }]);
  }
  closeForm();
}

function move(id, dir) {
  const { tiles } = settings.get();
  const idx = tiles.findIndex((t) => t.id === id);
  const next = idx + dir;
  if (idx < 0 || next < 0 || next >= tiles.length) return;
  const copy = tiles.slice();
  [copy[idx], copy[next]] = [copy[next], copy[idx]];
  settings.setTiles(copy);
}

function remove(id) {
  const { tiles, local } = settings.get();
  settings.setTiles(tiles.filter((t) => t.id !== id));
  // Orphaned uploaded blobs would otherwise accumulate in storage.local forever.
  if (local.tileIcons && id in local.tileIcons) {
    const nextIcons = { ...local.tileIcons };
    delete nextIcons[id];
    settings.setLocal({ tileIcons: nextIcons });
  }
}

function onListClick(e) {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const li = btn.closest('[data-id]');
  if (!li) return;
  const id = li.dataset.id;
  const { tiles } = settings.get();
  switch (btn.dataset.act) {
    case 'up':
      move(id, -1);
      break;
    case 'down':
      move(id, 1);
      break;
    case 'edit': {
      const tile = tiles.find((t) => t.id === id);
      if (tile) openForm(tile);
      break;
    }
    case 'del':
      remove(id);
      break;
  }
}

function syncPrefs(sidebarPrefs) {
  sidebarEl.classList.toggle('sidebar-hidden', !sidebarPrefs.enabled);
  sidebarEl.classList.toggle('click-mode', sidebarPrefs.openOn === 'click');
}

function refreshHandleState() {
  const expanded = pinned || (hovering && !sidebarEl.classList.contains('click-mode'));
  handle.setAttribute('aria-expanded', String(expanded));
  chevronEl.textContent = expanded ? '›' : '‹';
}

export function init() {
  sidebarEl = document.getElementById('sidebar');
  listEl = document.getElementById('tile-list');
  formEl = document.getElementById('tile-form');
  nameInput = document.getElementById('tile-name');
  urlInput = document.getElementById('tile-url');
  iconEmojiInput = document.getElementById('tile-icon-emoji');
  iconUrlInput = document.getElementById('tile-icon-url');
  iconUploadInput = document.getElementById('tile-icon-upload');
  const addBtn = document.getElementById('tile-add');
  handle = document.getElementById('sidebar-handle');
  chevronEl = document.getElementById('sidebar-handle-chevron');
  const saveBtn = formEl?.querySelector('[data-act="tile-save"]');
  const cancelBtn = formEl?.querySelector('[data-act="tile-cancel"]');
  if (!sidebarEl || !listEl || !formEl || !nameInput || !urlInput || !iconEmojiInput || !iconUrlInput
    || !iconUploadInput || !addBtn || !handle || !chevronEl || !saveBtn || !cancelBtn) return;

  render();
  settings.subscribe((state, paths) => {
    if (paths.includes('*') || paths.includes('tiles')) render();
    syncPrefs(state.prefs.sidebar);
  });

  listEl.addEventListener('click', onListClick);
  addBtn.addEventListener('click', () => openForm(null));
  saveBtn.addEventListener('click', saveForm);
  cancelBtn.addEventListener('click', closeForm);
  formEl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeForm();
    } else if (e.key === 'Enter' && e.target !== cancelBtn) {
      e.preventDefault();
      saveForm();
    }
  });

  formEl.addEventListener('click', (e) => {
    const kindBtn = e.target.closest('[data-tile-icon-kind]');
    if (!kindBtn) return;
    formIcon = { kind: kindBtn.dataset.tileIconKind, value: formIcon.value };
    syncIconKindUI(formIcon.kind);
  });
  iconUploadInput.addEventListener('change', () => {
    const file = iconUploadInput.files[0];
    if (file) handleIconUpload(file);
  });

  handle.addEventListener('click', () => {
    pinned = !pinned;
    sidebarEl.classList.toggle('expanded', pinned);
    refreshHandleState();
  });
  sidebarEl.addEventListener('mouseenter', () => { hovering = true; refreshHandleState(); });
  sidebarEl.addEventListener('mouseleave', () => { hovering = false; refreshHandleState(); });

  syncPrefs(settings.get().prefs.sidebar);
  refreshHandleState();
}
