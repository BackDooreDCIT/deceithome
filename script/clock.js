import faceBlock from './clock/face-block.js';

const FACES = { block: faceBlock };

let current = null;
let opts = { hour12: false, showSeconds: true, showDate: false, dateFormat: 'medium', smoothSeconds: true };
let rafId = null;
let running = false;
let lastKey = '';
let faceEl = null;
let wrapEl = null;
let metaEl = null;

function ensureEls() {
  if (!faceEl) faceEl = document.getElementById('clock-face');
  if (!wrapEl) wrapEl = document.querySelector('.clock-wrap');
  if (!metaEl) metaEl = document.getElementById('clock-meta');
}

function renderMeta(d) {
  if (!metaEl) return;
  if (!opts.showDate) {
    metaEl.textContent = '';
    return;
  }
  metaEl.textContent = new Intl.DateTimeFormat(undefined, { dateStyle: opts.dateFormat }).format(d);
}

function tick() {
  rafId = requestAnimationFrame(tick);
  if (!current) return;
  const d = new Date();
  if (!(current.wantsRaf && opts.smoothSeconds)) {
    const key = `${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}`;
    if (key === lastKey) return;
    lastKey = key;
  }
  current.update(d, opts);
  renderMeta(d);
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
  if (current) current.update(new Date(), opts);
  renderMeta(new Date());
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
