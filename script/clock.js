import faceBlock from './clock/face-block.js';
import faceAnalog from './clock/face-analog.js';
import faceText from './clock/face-text.js';
import { getParts } from './time.js';

const FACES = { block: faceBlock, analog: faceAnalog, text: faceText };

let current = null;
let opts = {
  hour12: false,
  showSeconds: true,
  showDate: false,
  dateFormat: 'medium',
  smoothSeconds: true,
  timeZone: ''
};
let rafId = null;
let running = false;
let lastKey = '';
let faceEl = null;
let wrapEl = null;
let metaEl = null;

let dateFormatter = null;
let dateFormatterKey = '';

function getDateFormatter(dateFormat, timeZone) {
  const key = `${dateFormat}|${timeZone || ''}`;
  if (key !== dateFormatterKey) {
    try {
      dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: dateFormat, timeZone: timeZone || undefined });
    } catch {
      dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: dateFormat }); // invalid/removed zone -> system
    }
    dateFormatterKey = key;
  }
  return dateFormatter;
}

function ensureEls() {
  if (!faceEl) faceEl = document.getElementById('clock-face');
  if (!wrapEl) wrapEl = document.querySelector('.clock-wrap');
  if (!metaEl) metaEl = document.getElementById('clock-meta');
}

function renderMeta(d, parts) {
  if (!metaEl) return;
  const metaParts = [];
  // The text face's own Intl formatter already prints AM/PM; showing it again
  // here would read as "02:30:15 PM PM".
  if (opts.hour12 && (!current || current.id !== 'text')) {
    metaParts.push(parts.h < 12 ? 'AM' : 'PM');
  }
  if (opts.showDate) {
    metaParts.push(getDateFormatter(opts.dateFormat, opts.timeZone).format(d));
  }
  metaEl.textContent = metaParts.join(' · ');
}

function tick() {
  rafId = requestAnimationFrame(tick);
  if (!current) return;
  const d = new Date();
  const parts = getParts(d, opts.timeZone);
  if (!(current.wantsRaf && opts.smoothSeconds)) {
    const key = `${parts.h}:${parts.m}:${parts.s}`;
    if (key === lastKey) return;
    lastKey = key;
  }
  current.update(d, opts, parts);
  renderMeta(d, parts);
}

export function setFace(id) {
  ensureEls();
  if (!faceEl || !wrapEl) return;
  const next = FACES[id] || FACES.block;
  if (current && current.id === next.id) return;
  stop();
  if (current) current.unmount();
  faceEl.replaceChildren();
  faceEl.className = `clock-face clock-face--${next.id}`;
  const { w, h } = next.mount(faceEl, opts);
  wrapEl.style.setProperty('--clock-w', `${w}px`);
  wrapEl.style.setProperty('--clock-h', `${h}px`);
  current = next;
  lastKey = '';
  start();
}

export function setOpts(nextOpts) {
  opts = { ...opts, ...nextOpts };
  lastKey = '';
  const d = new Date();
  const parts = getParts(d, opts.timeZone);
  if (current) current.update(d, opts, parts);
  renderMeta(d, parts);
}

export function start() {
  if (running) return;
  running = true;
  rafId = requestAnimationFrame(tick);
}

export function stop() {
  running = false;
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stop();
  else if (current) start();
});
