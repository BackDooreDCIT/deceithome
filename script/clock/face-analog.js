const SVG_NS = 'http://www.w3.org/2000/svg';

let hourEl = null;
let minuteEl = null;
let secondEl = null;

function createHand(cls, length) {
  const line = document.createElementNS(SVG_NS, 'line');
  line.setAttribute('x1', '100');
  line.setAttribute('y1', '100');
  line.setAttribute('x2', '100');
  line.setAttribute('y2', String(100 - length));
  line.setAttribute('class', cls);
  line.style.transformOrigin = '100px 100px';
  return line;
}

function mount(root) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 200 200');
  svg.setAttribute('class', 'analog-face');

  for (let i = 0; i < 60; i++) {
    const major = i % 5 === 0;
    const tick = document.createElementNS(SVG_NS, 'line');
    tick.setAttribute('x1', '100');
    tick.setAttribute('x2', '100');
    tick.setAttribute('y1', major ? '8' : '14');
    tick.setAttribute('y2', '20');
    tick.setAttribute('class', major ? 'tick tick--major' : 'tick');
    tick.style.transformOrigin = '100px 100px';
    tick.style.rotate = `${i * 6}deg`;
    svg.appendChild(tick);
  }

  hourEl = createHand('hand hand--h', 40);
  minuteEl = createHand('hand hand--m', 65);
  secondEl = createHand('hand hand--s', 75);
  svg.appendChild(hourEl);
  svg.appendChild(minuteEl);
  svg.appendChild(secondEl);

  const hub = document.createElementNS(SVG_NS, 'circle');
  hub.setAttribute('cx', '100');
  hub.setAttribute('cy', '100');
  hub.setAttribute('r', '4');
  hub.setAttribute('class', 'hub');
  svg.appendChild(hub);

  root.appendChild(svg);
  return { w: 200, h: 200 };
}

function update(d, opts, parts) {
  const ms = parts.ms;
  const s = parts.s;
  const m = parts.m;
  const h = parts.h % 12;

  const secDeg = opts.smoothSeconds ? (s + ms / 1000) * 6 : s * 6;
  const minDeg = m * 6 + (opts.smoothSeconds ? (s / 60) * 6 : 0);
  const hourDeg = h * 30 + (m / 60) * 30;

  secondEl.style.rotate = `${secDeg}deg`;
  minuteEl.style.rotate = `${minDeg}deg`;
  hourEl.style.rotate = `${hourDeg}deg`;
}

function unmount() {
  hourEl = null;
  minuteEl = null;
  secondEl = null;
}

export default { id: 'analog', wantsRaf: true, mount, update, unmount };
