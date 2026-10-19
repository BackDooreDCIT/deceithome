import * as settings from './settings.js';
import { localSuggestions, remoteSuggestions, actionRow } from './suggest.js';
import { normalizeForDedupe } from './url.js';
import { buildSearchUrl } from './engines.js';
import { debounce } from './dom.js';
import { navigate } from './search.js';

const ICONS = { action: '↵', history: '⏱', bookmark: '★', topsite: '■', query: '⌕' };

let input = null;
let listEl = null;

let rows = [];
let localRows = [];
let activeIdx = -1;
let seq = 0;
let currentQuery = '';
let remoteAbort = null;

function dedupeAgainstAction(list) {
  const seen = new Set();
  const out = [];
  for (const row of list) {
    if (!row.url) {
      out.push(row);
      continue;
    }
    const key = normalizeForDedupe(row.url);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function renderRows() {
  listEl.replaceChildren();
  rows.forEach((row, i) => {
    const li = document.createElement('li');
    li.id = `sg-${i}`;
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', String(i === activeIdx));
    li.dataset.idx = String(i);
    li.className = 'suggest-row';

    const icon = document.createElement('span');
    icon.className = 'suggest-icon';
    icon.textContent = ICONS[row.kind] || '';
    const text = document.createElement('span');
    text.className = 'suggest-text';
    text.textContent = row.title;

    li.appendChild(icon);
    li.appendChild(text);
    listEl.appendChild(li);
  });
  listEl.hidden = rows.length === 0;
  input.setAttribute('aria-expanded', String(rows.length > 0));
  syncActiveDescendant(false);
}

function syncActiveDescendant(scroll = true) {
  Array.from(listEl.children).forEach((li, i) => li.setAttribute('aria-selected', String(i === activeIdx)));
  input.setAttribute('aria-activedescendant', activeIdx >= 0 ? `sg-${activeIdx}` : '');
  if (scroll) listEl.children[activeIdx]?.scrollIntoView({ block: 'nearest' });
}

function clearRows() {
  rows = [];
  localRows = [];
  activeIdx = -1;
  seq++;
  remoteAbort?.abort();
  renderRows();
}

function hrefForRow(row) {
  if (row.url) return row.url;
  const { prefs } = settings.get();
  return buildSearchUrl(prefs, row.kind === 'action' ? currentQuery : row.title);
}

function chooseRow(idx) {
  const row = rows[idx];
  if (!row) return;
  const href = hrefForRow(row);
  clearRows();
  navigate(href, false);
}

function acceptHighlightText() {
  const row = rows[activeIdx];
  if (!row) return;
  input.value = row.url || row.title;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function runLocal(q, mySeq) {
  const { prefs } = settings.get();
  const local = await localSuggestions(q, prefs);
  if (mySeq !== seq) return;
  localRows = local;
  rows = dedupeAgainstAction([actionRow(q, prefs), ...local]);
  renderRows();
}

async function runRemote(q, mySeq) {
  const { prefs } = settings.get();
  if (!prefs.search.suggest.remote) return;
  remoteAbort?.abort();
  remoteAbort = new AbortController();
  const remote = await remoteSuggestions(q, prefs, remoteAbort.signal);
  if (mySeq !== seq) return;
  rows = dedupeAgainstAction([actionRow(q, prefs), ...localRows, ...remote]);
  renderRows();
}

const debouncedLocal = debounce((q, mySeq) => runLocal(q, mySeq), 120);
const debouncedRemote = debounce((q, mySeq) => runRemote(q, mySeq), 220);

function onInput() {
  const q = input.value.trim();
  currentQuery = q;
  const mySeq = ++seq;
  remoteAbort?.abort();

  const { prefs } = settings.get();
  if (!q || !prefs.search.suggest.enabled) {
    rows = [];
    localRows = [];
    activeIdx = -1;
    renderRows();
    return;
  }

  rows = [actionRow(q, prefs)];
  localRows = [];
  activeIdx = -1;
  renderRows();

  debouncedLocal(q, mySeq);
  debouncedRemote(q, mySeq);
}

function onKeydown(e) {
  if (e.key === 'Escape') {
    if (rows.length) {
      e.preventDefault();
      clearRows();
      return;
    }
    if (document.documentElement.classList.contains('focus-mode')) {
      e.preventDefault();
      input.blur();
    }
    return;
  }
  if (!rows.length) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    activeIdx = (activeIdx + 1) % rows.length;
    syncActiveDescendant();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    activeIdx = (activeIdx - 1 + rows.length) % rows.length;
    syncActiveDescendant();
  } else if (e.key === 'Tab' && activeIdx >= 0) {
    e.preventDefault();
    acceptHighlightText();
  } else if (e.key === 'Enter' && activeIdx >= 0) {
    e.preventDefault();
    chooseRow(activeIdx);
  }
}

export function init() {
  input = document.getElementById('search-input');
  listEl = document.getElementById('suggest-list');
  if (!input || !listEl) return;

  // Bound before search.js's submit handler so a highlighted row's Enter
  // never reaches the native form submit.
  input.addEventListener('keydown', onKeydown);
  input.addEventListener('input', onInput);

  listEl.addEventListener('mouseover', (e) => {
    const li = e.target.closest('li[data-idx]');
    if (!li) return;
    activeIdx = Number(li.dataset.idx);
    syncActiveDescendant(false);
  });
  listEl.addEventListener('mousedown', (e) => {
    const li = e.target.closest('li[data-idx]');
    if (!li) return;
    e.preventDefault(); // keep focus in the input; click fires after blur
    chooseRow(Number(li.dataset.idx));
  });

  input.addEventListener('focusout', (e) => {
    if (listEl.contains(e.relatedTarget)) return;
    clearRows();
  });
}
