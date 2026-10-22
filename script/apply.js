import { clamp, luminance } from './dom.js';
import { isHttpUrl } from './url.js';
import { setFace, setOpts, start, stop } from './clock.js';
import { remeasure } from './search.js';

const DEFAULT_IMG = "url('../img/default.jpg')";
const FIT_MIN_GAP = 24;

function cssEscapeUrl(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function timeOfDayMessage() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning,';
  if (h < 18) return 'Good afternoon,';
  return 'Good evening,';
}

export function applyTheme(prefs) {
  const t = prefs.theme;
  const root = document.documentElement;
  root.style.setProperty('--color-bg', t.bg);
  root.style.setProperty('--color-fg', t.fg);
  root.style.setProperty('--color-fg-strong', t.fgStrong);
  root.style.setProperty('--color-accent', t.accent);
  root.style.setProperty('--color-shadow', t.shadow);
  root.style.setProperty('--radius', `${t.radius}px`);
  root.style.setProperty('--surface-opacity', String(clamp(t.surfaceOpacity, 0, 1)));
  root.style.setProperty('color-scheme', luminance(t.bg) > 0.5 ? 'light' : 'dark');
}

export function applyBackground(state) {
  const bg = state.prefs.background;
  const root = document.documentElement;
  let img = DEFAULT_IMG;

  switch (bg.kind) {
    case 'image':
      img = state.local.bgImage ? `url("${cssEscapeUrl(state.local.bgImage)}")` : DEFAULT_IMG;
      break;
    case 'url':
      img = isHttpUrl(bg.url) ? `url("${cssEscapeUrl(bg.url)}")` : DEFAULT_IMG;
      break;
    case 'color':
      img = 'none';
      break;
    case 'gradient':
      img = `linear-gradient(${bg.gradient.angle}deg, ${bg.gradient.from}, ${bg.gradient.to})`;
      break;
    default:
      img = DEFAULT_IMG;
  }

  root.style.setProperty('--bg-image', img);
  root.style.setProperty('--bg-color', bg.color);
  root.style.setProperty('--bg-blur', `${clamp(bg.blur, 0, 24)}px`);
  root.style.setProperty('--bg-dim', String(clamp(bg.dim, 0, 100) / 100));
  root.style.setProperty('--bg-size', bg.size || 'cover');
}

export function applyLayout(prefs) {
  const l = prefs.layout;
  const root = document.documentElement;
  root.style.setProperty('--page-pad-block', `${l.padBlock}px`);
  root.style.setProperty('--page-pad-inline', `${l.padInline}px`);
  root.classList.toggle('align-center', l.align === 'center');
}

export function applyGreeting(prefs) {
  const g = prefs.greeting;
  const root = document.documentElement;
  root.style.setProperty('--greeting-size', `${g.size}px`);
  const main = document.querySelector('.main-content');
  if (main) main.classList.toggle('greeting-hidden', !g.enabled);
  const msgEl = document.querySelector('.welcomemsg');
  const nameEl = document.querySelector('.username');
  if (msgEl) msgEl.textContent = g.timeOfDay ? timeOfDayMessage() : g.message;
  if (nameEl) nameEl.textContent = `${g.name}${g.punctuation}`;
}

export function applyClockVars(prefs) {
  const c = prefs.clock;
  const root = document.documentElement;
  root.classList.toggle('clock-hidden', !c.enabled);
  setFace(c.face);
  setOpts({
    hour12: c.hour12,
    showSeconds: c.showSeconds,
    showDate: c.showDate,
    dateFormat: c.dateFormat,
    smoothSeconds: c.smoothSeconds
  });
  if (c.enabled) start();
  else stop();
}

// The clock's chosen scale can't be allowed to claim more vertical room than
// the window actually has, or the search bar gets pushed below the fold.
// This must derive the cap from prefs + the greeting/anchor's own heights
// only — never from .clock-wrap's current (already-scaled) height, which
// would feed back into itself and oscillate.
export function applyFit(prefs) {
  const root = document.documentElement;
  const main = document.querySelector('.main-content');
  const meta = document.getElementById('clock-meta');
  const welcome = document.querySelector('.welcome');
  const anchor = document.getElementById('search-anchor');
  const wrap = document.querySelector('.clock-wrap');
  if (!main || !anchor) return;

  const wanted = clamp(prefs.clock.scale, 0.6, 3);
  if (!prefs.clock.enabled) {
    root.style.setProperty('--clock-scale', String(wanted));
    return;
  }

  const cs = getComputedStyle(main);
  const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  const avail = main.clientHeight - padY;

  // #clock-meta is :empty { display: none } when there's nothing to show
  // (no date, no 12-hour AM/PM), so its offsetHeight is already 0 then —
  // no separate guard needed.
  const metaH = meta ? meta.offsetHeight : 0;
  const greetH = prefs.greeting.enabled && welcome ? welcome.offsetHeight : 0;
  const room = avail - metaH - greetH - anchor.offsetHeight - FIT_MIN_GAP;

  const natural = wrap ? parseFloat(getComputedStyle(wrap).getPropertyValue('--clock-h')) || 100 : 100;
  const maxScale = Math.max(0.6, room / natural);
  root.style.setProperty('--clock-scale', String(Math.min(wanted, maxScale)));
}

export function applySearchVars(prefs) {
  const s = prefs.search;
  const root = document.documentElement;
  root.style.setProperty('--search-focus-blur', `${clamp(s.focusBlur, 0, 24)}px`);
}

export function applySidebarVars(prefs) {
  const sb = prefs.sidebar;
  const root = document.documentElement;
  root.style.setProperty('--tile-icon', `${sb.iconSize}px`);
}

export function applyAll(state) {
  applyTheme(state.prefs);
  applyBackground(state);
  applyLayout(state.prefs);
  applyGreeting(state.prefs);
  applyClockVars(state.prefs);
  applyFit(state.prefs);
  applySearchVars(state.prefs);
  applySidebarVars(state.prefs);
  remeasure();
}
