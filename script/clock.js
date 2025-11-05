// Build the 60 blocks + divider in the DOM first (so nth-child indices match)
const clockEl = document.getElementById('clock');
for (let i = 0; i < 60; i++) {
  const b = document.createElement('div');
  b.className = 'block';
  b.setAttribute('data-num', i);
  clockEl.appendChild(b);
}
const divider = document.createElement('div');
divider.className = 'divider';
clockEl.appendChild(divider);

// Digit patterns (4 groups × 15 blocks each)
const numbers = [
  [1,1,1,1,1,1,0,0,0,1,1,1,1,1,1], // 0
  [1,0,0,0,1,1,1,1,1,1,0,0,0,0,1], // 1
  [1,0,1,1,1,1,0,1,0,1,1,1,1,0,1], // 2
  [1,0,1,0,1,1,0,1,0,1,1,1,1,1,1], // 3
  [1,1,1,0,0,0,0,1,0,0,1,1,1,1,1], // 4
  [1,1,1,0,1,1,0,1,0,1,1,0,1,1,1], // 5
  [1,1,1,1,1,1,0,1,0,1,1,0,1,1,1], // 6
  [1,0,0,0,0,1,0,1,1,1,1,1,0,0,0], // 7
  [1,1,1,1,1,1,0,1,0,1,1,1,1,1,1], // 8
  [1,1,1,0,1,1,0,1,0,1,1,1,1,1,1]  // 9
];

const digits = Array.from(document.querySelectorAll('.block'));
const blocks = [];
for (let i = 0; i < 4; i++) {
  blocks.push(digits.slice(i * 15, i * 15 + 15));
}

const setNum = (block, num) => {
  const n = numbers[Number(num)];
  for (let i = 0; i < block.length; i++) {
    block[i].classList[n[i] === 1 ? 'add' : 'remove']('active');
  }
};

const time = { s: '', m: '', h: '', p: null };

const animator = () => {
  const d = new Date();
  let h = d.getHours().toString();
  let m = d.getMinutes().toString();
  let s = d.getSeconds().toString();

  if (s.length === 1) s = '0' + s;
  if (m.length === 1) m = '0' + m;
  if (h.length === 1) h = '0' + h;

  // Orange "second" marker on the corresponding block index (0..59)
  if (s !== time.s) {
    const idx = Number(s);
    if (time.p !== null) digits[time.p].classList.remove('second');
    digits[idx].classList.add('second');
    time.p = idx;
    time.s = s;
  }

  // Minutes
  if (m !== time.m) {
    setNum(blocks[2], m[0]);
    setNum(blocks[3], m[1]);
    time.m = m;
  }

  // Hours
  if (h !== time.h) {
    setNum(blocks[0], h[0]);
    setNum(blocks[1], h[1]);
    time.h = h;
  }

  window.requestAnimationFrame(animator);
};

// Kick off
window.requestAnimationFrame(animator);
