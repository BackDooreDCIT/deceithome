// This face owns #clock-face exclusively: its only children are ever the 60
// .block divs plus the trailing .divider. Nothing else gets appended here —
// clock.css keys digit gaps and leading zeros off raw nth-child index.

const NUMBERS = [
  [1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1], // 0
  [1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1], // 1
  [1, 0, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 0, 1], // 2
  [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1], // 3
  [1, 1, 1, 0, 0, 0, 0, 1, 0, 0, 1, 1, 1, 1, 1], // 4
  [1, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1], // 5
  [1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1], // 6
  [1, 0, 0, 0, 0, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0], // 7
  [1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1], // 8
  [1, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1]  // 9
];

let digits = [];
let blocks = [];
let state = { h: '', m: '', s: '', secondIdx: null };

function setNum(block, digit) {
  const pattern = NUMBERS[Number(digit)];
  for (let i = 0; i < block.length; i++) {
    block[i].classList.toggle('active', pattern[i] === 1);
  }
}

function mount(root) {
  const frag = document.createDocumentFragment();
  digits = [];
  for (let i = 0; i < 60; i++) {
    const b = document.createElement('div');
    b.className = 'block';
    b.setAttribute('data-num', i);
    digits.push(b);
    frag.appendChild(b);
  }
  const divider = document.createElement('div');
  divider.className = 'divider';
  frag.appendChild(divider);
  root.appendChild(frag);

  blocks = [digits.slice(0, 15), digits.slice(15, 30), digits.slice(30, 45), digits.slice(45, 60)];
  state = { h: '', m: '', s: '', secondIdx: null };

  // 320 = --clock-grid-w (280, twelve 23.33px columns) + --clock-gaps-w
  // (the 10+20+10 of inter-digit margin clock.css's gap rules add on top
  // of the grid) — the box must match what actually gets painted or
  // centering (and the hour/minute divider's position) drifts.
  return { w: 320, h: 100 };
}

function update(d, opts) {
  const mStr = d.getMinutes().toString().padStart(2, '0');
  const sStr = d.getSeconds().toString().padStart(2, '0');

  let displayHour;
  if (opts.hour12) {
    const h12 = d.getHours() % 12;
    displayHour = h12 === 0 ? 12 : h12;
  } else {
    displayHour = d.getHours();
  }
  const hStr = displayHour.toString().padStart(2, '0');
  const hKey = `${opts.hour12 ? '12' : '24'}:${hStr}`;

  if (opts.showSeconds) {
    if (sStr !== state.s) {
      const idx = Number(sStr);
      if (state.secondIdx !== null) digits[state.secondIdx].classList.remove('second');
      digits[idx].classList.add('second');
      state.secondIdx = idx;
      state.s = sStr;
    }
  } else if (state.secondIdx !== null) {
    digits[state.secondIdx].classList.remove('second');
    state.secondIdx = null;
    state.s = '';
  }

  if (mStr !== state.m) {
    setNum(blocks[2], mStr[0]);
    setNum(blocks[3], mStr[1]);
    state.m = mStr;
  }

  if (hKey !== state.h) {
    setNum(blocks[0], hStr[0]);
    setNum(blocks[1], hStr[1]);
    state.h = hKey;
  }
}

function unmount() {
  digits = [];
  blocks = [];
  state = { h: '', m: '', s: '', secondIdx: null };
}

export default { id: 'block', wantsRaf: false, mount, update, unmount };
