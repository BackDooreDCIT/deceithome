import { isLikelyUrl, normalizeUrl } from './url.js';
import { buildSearchUrl } from './engines.js';
import { getPref, get as getState } from './settings.js';

let anchor = null;
let form = null;
let input = null;

function measureAnchor() {
  if (!anchor) return;
  const rect = anchor.getBoundingClientRect();
  document.documentElement.style.setProperty('--search-rest-y', `${Math.round(rect.top)}px`);
}

function updateInputStyle() {
  const raw = (input.value || '').trim();
  input.classList.toggle('is-url', isLikelyUrl(raw));
}

function navigate(href, newTab) {
  if (newTab) window.open(href, '_blank', 'noopener');
  else window.location.assign(href);
}

function handleSubmit(e) {
  e.preventDefault();
  const raw = (input.value || '').trim();
  if (!raw) return;
  const href = isLikelyUrl(raw) ? normalizeUrl(raw) : buildSearchUrl(getState().prefs, raw);
  navigate(href, e.ctrlKey || e.metaKey || getPref('search.openInNewTab', false));
}

export function init() {
  anchor = document.getElementById('search-anchor');
  form = document.getElementById('search-form');
  input = document.getElementById('search-input');
  if (!anchor || !form || !input) return;

  measureAnchor();
  new ResizeObserver(measureAnchor).observe(anchor);
  window.addEventListener('resize', measureAnchor);

  input.addEventListener('input', updateInputStyle);
  updateInputStyle();

  form.addEventListener('submit', handleSubmit);
}
