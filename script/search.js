import { isLikelyUrl, normalizeUrl } from './url.js';
import { buildSearchUrl } from './engines.js';
import { getPref, get as getState } from './settings.js';

let anchor = null;
let dock = null;
let scrim = null;
let form = null;
let input = null;
let bootPhase = true;
let anchorObserver = null;

export function remeasure() {
  if (!anchor || !dock || document.documentElement.classList.contains('focus-mode')) return;
  const rect = anchor.getBoundingClientRect();
  const maxY = window.innerHeight - (dock.offsetHeight || 0) - 24;
  const y = Math.max(0, Math.min(Math.round(rect.top), maxY));
  document.documentElement.style.setProperty('--search-rest-y', `${y}px`);
}

function enter() {
  if (!getPref('search.focusMode', true)) return;
  document.documentElement.classList.add('focus-mode');
}

function exit() {
  document.documentElement.classList.remove('focus-mode');
  remeasure();
}

function updateInputStyle() {
  const raw = (input.value || '').trim();
  input.classList.toggle('is-url', isLikelyUrl(raw));
}

export function navigate(href, newTab) {
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
  dock = document.getElementById('search-dock');
  scrim = document.getElementById('search-scrim');
  form = document.getElementById('search-form');
  input = document.getElementById('search-input');
  if (!anchor || !dock || !scrim || !form || !input) return;

  remeasure();
  anchorObserver = new ResizeObserver(remeasure);
  anchorObserver.observe(anchor);
  window.addEventListener('resize', remeasure);

  input.addEventListener('input', updateInputStyle);
  updateInputStyle();

  form.addEventListener('submit', handleSubmit);

  // Module scripts run after parse, so an autofocus attribute would fire
  // before this code does and open every tab already risen and blurred.
  // Instead: focused-but-at-rest until the first real interaction, then the
  // first keystroke rises on the same frame as the first character.
  input.addEventListener('focusin', () => {
    if (!bootPhase) enter();
  });
  ['pointerdown', 'keydown', 'wheel'].forEach((type) => {
    window.addEventListener(type, () => {
      bootPhase = false;
      if (document.activeElement === input) enter();
    }, { once: true, capture: true });
  });
  input.addEventListener('focusout', (e) => {
    if (dock.contains(e.relatedTarget)) return; // clicking a suggestion must not exit
    if (input.value.trim()) return; // keep focus mode while a query is pending
    exit();
  });
  scrim.addEventListener('click', () => {
    input.blur();
    exit();
  });

  input.focus({ preventScroll: true });
}
