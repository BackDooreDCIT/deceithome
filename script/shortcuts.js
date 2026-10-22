import * as settings from './settings.js';
import { hashColor } from './dom.js';
import { hasScheme, isHttpUrl } from './url.js';
import { AVATAR_PALETTE } from './presets.js';

let sidebarEl = null;
let listEl = null;
let formEl = null;
let nameInput = null;
let urlInput = null;
let handle = null;
let chevronEl = null;

let editingId = null;
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

function button(act, label, tileName) {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.act = act;
  b.textContent = label;
  b.setAttribute('aria-label', `${act} ${tileName}`);
  return b;
}

function renderTile(tile) {
  const li = document.createElement('li');
  li.className = 'tile';
  li.dataset.id = tile.id;

  const link = document.createElement('a');
  link.className = 'tile-link';
  link.href = tile.url;
  link.rel = 'noopener';

  const iconWrap = document.createElement('span');
  iconWrap.className = 'tile-icon';

  const img = document.createElement('img');
  img.alt = '';
  img.hidden = true;

  const fallback = document.createElement('span');
  fallback.className = 'tile-fallback';
  fallback.textContent = (tile.name || hostnameOf(tile.url) || '?')[0].toUpperCase();
  fallback.style.backgroundColor = tile.color;

  const favicon = faviconUrl(tile.url, 32);
  if (favicon) {
    // The _favicon endpoint returns HTTP 200 with a transparent image when
    // it has nothing cached for this URL, so onerror alone isn't enough.
    img.addEventListener('load', () => { if (img.naturalWidth > 0) { img.hidden = false; fallback.hidden = true; } }, { once: true });
    fallback.hidden = false;
    img.src = favicon;
  } else {
    fallback.hidden = false;
  }

  iconWrap.appendChild(img);
  iconWrap.appendChild(fallback);

  const label = document.createElement('span');
  label.className = 'tile-label';
  label.textContent = tile.name;

  link.appendChild(iconWrap);
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

function openForm(tile) {
  editingId = tile ? tile.id : null;
  nameInput.value = tile ? tile.name : '';
  urlInput.value = tile ? tile.url : '';
  formEl.hidden = false;
  document.documentElement.classList.add('dialog-open');
  nameInput.focus();
}

function closeForm() {
  formEl.hidden = true;
  editingId = null;
  document.documentElement.classList.remove('dialog-open');
}

function saveForm() {
  const name = nameInput.value.trim();
  let url = urlInput.value.trim();
  if (!name || !url) return;
  if (!hasScheme(url)) url = 'https://' + url;
  if (!isHttpUrl(url)) return;

  const { tiles } = settings.get();
  if (editingId) {
    settings.setTiles(tiles.map((t) => (t.id === editingId ? { ...t, name, url } : t)));
  } else {
    const color = AVATAR_PALETTE[hashColor(hostnameOf(url), AVATAR_PALETTE.length)];
    settings.setTiles([...tiles, { id: genId(), name, url, color }]);
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
  const { tiles } = settings.get();
  settings.setTiles(tiles.filter((t) => t.id !== id));
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
  const addBtn = document.getElementById('tile-add');
  handle = document.getElementById('sidebar-handle');
  chevronEl = document.getElementById('sidebar-handle-chevron');
  const saveBtn = formEl?.querySelector('[data-act="tile-save"]');
  const cancelBtn = formEl?.querySelector('[data-act="tile-cancel"]');
  if (!sidebarEl || !listEl || !formEl || !nameInput || !urlInput || !addBtn || !handle || !chevronEl || !saveBtn || !cancelBtn) return;

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
